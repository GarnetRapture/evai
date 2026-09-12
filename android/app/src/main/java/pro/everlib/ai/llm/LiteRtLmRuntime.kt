package pro.everlib.ai.llm

import android.content.Context
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import pro.everlib.ai.AppConstants
import pro.everlib.ai.bridge.BridgeException

enum class LiteRtLmMessageRole { USER, ASSISTANT }

data class LiteRtLmHistoryMessage(val role: LiteRtLmMessageRole, val content: String)

data class LiteRtLmGenerationRequest(
    val systemPrompt: String?,
    val history: List<LiteRtLmHistoryMessage>,
    val userMessage: String,
    val responsePrefix: String,
    val maxOutputTokens: Int,
)

data class LiteRtLmStatus(
    val loadedFileName: String?,
    val backend: String?,
    val contextWindow: Int?,
    val errorMessage: String?,
)

sealed interface LiteRtLmGenerationOutcome {
    data class Completed(val text: String, val tokenCount: Int) : LiteRtLmGenerationOutcome
    data class Cancelled(val text: String) : LiteRtLmGenerationOutcome
    data class Failed(val error: Throwable) : LiteRtLmGenerationOutcome
}

class LiteRtLmRuntime(private val context: Context) : AutoCloseable {
    private val engineMutex = Mutex()
    private val generationMutex = Mutex()
    private var handle: Long = 0
    private var loadedFileName: String? = null
    private var loadedBackend: String? = null
    private var contextWindow: Int? = null
    private var lastErrorMessage: String? = null

    fun status(): LiteRtLmStatus = LiteRtLmStatus(
        loadedFileName = loadedFileName,
        backend = loadedBackend,
        contextWindow = contextWindow,
        errorMessage = lastErrorMessage,
    )

    suspend fun load(modelFile: File): LiteRtLmStatus = engineMutex.withLock {
        withContext(Dispatchers.IO) {
            if (loadedFileName == modelFile.name && handle != 0L) {
                return@withContext status()
            }
            closeEngineAfterGeneration()
            val gpuHandle = EverSoulLlmJni.nativeLoad(modelFile.absolutePath, EverSoulLlmJni.BACKEND_GPU, context.cacheDir.absolutePath)
            val (loadedHandle, backend) = if (gpuHandle != 0L) {
                gpuHandle to "GPU"
            } else {
                EverSoulLlmJni.nativeLoad(modelFile.absolutePath, EverSoulLlmJni.BACKEND_CPU, context.cacheDir.absolutePath) to "CPU"
            }
            if (loadedHandle == 0L) {
                lastErrorMessage = "engine_load_failed"
                throw BridgeException("native_runtime", "engine_load_failed:${modelFile.name}")
            }
            handle = loadedHandle
            loadedBackend = backend
            loadedFileName = modelFile.name
            contextWindow = EverSoulLlmJni.nativeContextWindow(loadedHandle)
            lastErrorMessage = null
            status()
        }
    }

    suspend fun unload() = engineMutex.withLock {
        withContext(Dispatchers.IO) { closeEngineAfterGeneration() }
    }

    suspend fun generate(requestId: String, request: LiteRtLmGenerationRequest, onChunk: (String) -> Unit): LiteRtLmGenerationOutcome =
        generationMutex.withLock {
            val activeHandle = handle
            if (activeHandle == 0L) {
                throw BridgeException("model_not_ready", "unloaded")
            }
            withContext(Dispatchers.IO) {
                val generated = StringBuilder(request.responsePrefix)
                val resultJson = EverSoulLlmJni.nativeGenerate(
                    activeHandle,
                    request.systemPrompt.orEmpty(),
                    historyJson(request.history),
                    request.userMessage,
                    request.responsePrefix,
                    request.maxOutputTokens,
                    EverSoulLlmJni.ChunkSink { chunk ->
                        if (chunk.isNotEmpty()) {
                            generated.append(chunk)
                            onChunk(chunk)
                        }
                    },
                )
                parseOutcome(resultJson, generated.toString())
            }
        }

    fun cancel(requestId: String) {
        val activeHandle = handle
        if (activeHandle != 0L) {
            EverSoulLlmJni.nativeCancel(activeHandle)
        }
    }

    override fun close() {
        val activeHandle = handle
        if (activeHandle != 0L) {
            EverSoulLlmJni.nativeCancel(activeHandle)
        }
        closeEngine()
    }

    private fun parseOutcome(resultJson: String, streamedText: String): LiteRtLmGenerationOutcome {
        val payload = JSONObject(resultJson)
        if (payload.has("error")) {
            return LiteRtLmGenerationOutcome.Failed(BridgeException(payload.getString("error"), payload.optString("detail")))
        }
        val generatedTokens = payload.optInt("generated_tokens", 0)
        return if (payload.optString("status") == "cancelled") {
            LiteRtLmGenerationOutcome.Cancelled(streamedText)
        } else {
            LiteRtLmGenerationOutcome.Completed(streamedText, generatedTokens)
        }
    }

    private fun historyJson(history: List<LiteRtLmHistoryMessage>): String {
        val array = JSONArray()
        for (message in history) {
            val entry = JSONObject()
            entry.put("role", if (message.role == LiteRtLmMessageRole.ASSISTANT) "assistant" else "user")
            entry.put("content", message.content)
            array.put(entry)
        }
        return array.toString()
    }

    private suspend fun closeEngineAfterGeneration() {
        cancel("")
        generationMutex.withLock { closeEngine() }
    }

    private fun closeEngine() {
        val activeHandle = handle
        if (activeHandle != 0L) {
            EverSoulLlmJni.nativeUnload(activeHandle)
        }
        handle = 0
        loadedFileName = null
        loadedBackend = null
        contextWindow = null
    }
}
