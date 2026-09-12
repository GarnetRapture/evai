package pro.everlib.ai.llm

import android.content.Context
import android.os.Build
import com.google.ai.edge.aicore.Content
import com.google.ai.edge.aicore.DownloadCallback
import com.google.ai.edge.aicore.DownloadConfig
import com.google.ai.edge.aicore.GenerativeAIException
import com.google.ai.edge.aicore.GenerativeModel
import com.google.ai.edge.aicore.content
import com.google.ai.edge.aicore.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import pro.everlib.ai.bridge.BridgeException

enum class GeminiNanoAvailability { UNSUPPORTED, DOWNLOADABLE, DOWNLOADING, AVAILABLE, FAILED }

data class GeminiNanoStatus(
    val availability: GeminiNanoAvailability,
    val downloadedBytes: Long?,
    val errorMessage: String?,
)

sealed interface GeminiNanoDownloadEvent {
    data class Started(val totalBytes: Long) : GeminiNanoDownloadEvent
    data class Progress(val downloadedBytes: Long) : GeminiNanoDownloadEvent
}

class GeminiNanoRuntime(private val context: Context) : AutoCloseable {
    private val generationMutex = Mutex()
    private val preparationMutex = Mutex()
    @Volatile private var availability = if (isSupportedDevice()) GeminiNanoAvailability.DOWNLOADABLE else GeminiNanoAvailability.UNSUPPORTED
    @Volatile private var downloadedBytes: Long? = null
    @Volatile private var lastErrorMessage: String? = null
    @Volatile private var activeGeneration: Job? = null

    fun status(): GeminiNanoStatus = GeminiNanoStatus(availability, downloadedBytes, lastErrorMessage)

    suspend fun prepare(onDownload: (GeminiNanoDownloadEvent) -> Unit): GeminiNanoStatus = preparationMutex.withLock {
        requireSupportedDevice()
        if (availability == GeminiNanoAvailability.AVAILABLE) {
            return@withLock status()
        }
        withContext(Dispatchers.IO) {
            val callback = object : DownloadCallback {
                override fun onDownloadStarted(bytesToDownload: Long) {
                    availability = GeminiNanoAvailability.DOWNLOADING
                    onDownload(GeminiNanoDownloadEvent.Started(bytesToDownload))
                }

                override fun onDownloadProgress(totalBytesDownloaded: Long) {
                    downloadedBytes = totalBytesDownloaded
                    onDownload(GeminiNanoDownloadEvent.Progress(totalBytesDownloaded))
                }

                override fun onDownloadFailed(failureStatus: String, e: GenerativeAIException) {
                    lastErrorMessage = "$failureStatus:${e.errorCode}:${e.message}"
                }

                override fun onDownloadDidNotStart(e: GenerativeAIException) {
                    lastErrorMessage = "download_did_not_start:${e.errorCode}:${e.message}"
                }
            }
            val model = GenerativeModel(generationConfig { this.context = this@GeminiNanoRuntime.context }, DownloadConfig(callback))
            try {
                model.prepareInferenceEngine()
                availability = GeminiNanoAvailability.AVAILABLE
                lastErrorMessage = null
            } catch (error: GenerativeAIException) {
                availability = GeminiNanoAvailability.FAILED
                lastErrorMessage = "${error.errorCode}:${error.message}"
                throw BridgeException("model_not_ready", lastErrorMessage.orEmpty())
            } finally {
                model.close()
            }
            status()
        }
    }

    suspend fun generate(request: LocalGenerationRequest, onChunk: (String) -> Unit): LocalGenerationOutcome =
        generationMutex.withLock {
            requireSupportedDevice()
            if (availability != GeminiNanoAvailability.AVAILABLE) {
                throw BridgeException("model_not_ready", availability.name.lowercase())
            }
            val generated = StringBuilder()
            val config = generationConfig {
                this.context = this@GeminiNanoRuntime.context
                temperature = request.sampling.temperature.toFloat()
                topK = request.sampling.topK
                maxOutputTokens = request.maxOutputTokens
            }
            withContext(Dispatchers.IO) {
                val model = GenerativeModel(config)
                try {
                    coroutineScope {
                        val job = launch {
                            model.generateContentStream(*conversationContents(request)).collect { response ->
                                val chunk = response.text.orEmpty()
                                if (chunk.isNotEmpty()) {
                                    generated.append(chunk)
                                    onChunk(chunk)
                                }
                            }
                        }
                        activeGeneration = job
                        job.join()
                        if (job.isCancelled) {
                            LocalGenerationOutcome.Cancelled(generated.toString())
                        } else {
                            LocalGenerationOutcome.Completed(generated.toString(), null)
                        }
                    }
                } catch (error: CancellationException) {
                    LocalGenerationOutcome.Cancelled(generated.toString())
                } catch (error: GenerativeAIException) {
                    lastErrorMessage = "${error.errorCode}:${error.message}"
                    LocalGenerationOutcome.Failed(BridgeException("native_runtime", lastErrorMessage.orEmpty()))
                } finally {
                    activeGeneration = null
                    model.close()
                }
            }
        }

    fun cancel() {
        activeGeneration?.cancel()
    }

    override fun close() {
        cancel()
    }

    private fun isSupportedDevice(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    private fun requireSupportedDevice() {
        if (!isSupportedDevice()) {
            throw BridgeException("model_not_ready", "gemini_nano_requires_android_12")
        }
    }

    private fun conversationContents(request: LocalGenerationRequest): Array<Content> {
        val turns = mutableListOf<Pair<LocalMessageRole, StringBuilder>>()
        fun append(role: LocalMessageRole, text: String) {
            val last = turns.lastOrNull()
            if (last != null && last.first == role) {
                last.second.append("\n\n").append(text)
            } else {
                turns.add(role to StringBuilder(text))
            }
        }
        request.systemPrompt?.let { append(LocalMessageRole.USER, it) }
        request.history.forEach { append(it.role, it.content) }
        append(LocalMessageRole.USER, request.userMessage)
        return turns.map { (role, text) ->
            content(if (role == LocalMessageRole.ASSISTANT) Content.Role.MODEL else Content.Role.USER) {
                text(text.toString())
            }
        }.toTypedArray()
    }
}
