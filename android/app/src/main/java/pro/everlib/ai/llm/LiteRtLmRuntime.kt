package pro.everlib.ai.llm

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.ResponseFormat
import com.google.ai.edge.litertlm.SamplerConfig
import java.io.File
import java.util.concurrent.CancellationException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import pro.everlib.ai.AppConstants
import pro.everlib.ai.bridge.BridgeException

data class LiteRtLmStatus(
    val loadedFileName: String?,
    val backend: String?,
    val contextWindow: Int?,
    val errorMessage: String?,
)

class LiteRtLmRuntime(private val context: Context) : AutoCloseable {
    private val engineMutex = Mutex()
    private val generationMutex = Mutex()
    private val cancelRequested = AtomicBoolean(false)
    @Volatile private var engine: Engine? = null
    @Volatile private var activeConversation: Conversation? = null
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
            if (loadedFileName == modelFile.name && engine != null) {
                return@withContext status()
            }
            closeEngineAfterGeneration()
            val failures = mutableListOf<String>()
            for ((backendName, backend) in listOf("GPU" to Backend.GPU(), "CPU" to Backend.CPU())) {
                val candidate = Engine(
                    EngineConfig(
                        modelPath = modelFile.absolutePath,
                        backend = backend,
                        maxNumTokens = AppConstants.LITERT_LM_MAX_NUM_TOKENS,
                        cacheDir = context.cacheDir.absolutePath,
                    ),
                )
                try {
                    candidate.initialize()
                } catch (error: Exception) {
                    candidate.close()
                    failures.add("$backendName:${error.message ?: error.javaClass.simpleName}")
                    continue
                }
                engine = candidate
                loadedBackend = backendName
                loadedFileName = modelFile.name
                contextWindow = AppConstants.LITERT_LM_MAX_NUM_TOKENS
                lastErrorMessage = null
                return@withContext status()
            }
            lastErrorMessage = failures.joinToString(" | ")
            throw BridgeException("native_runtime", "engine_load_failed:${modelFile.name}:$lastErrorMessage")
        }
    }

    suspend fun unload() = engineMutex.withLock {
        withContext(Dispatchers.IO) { closeEngineAfterGeneration() }
    }

    suspend fun generate(requestId: String, request: LocalGenerationRequest, onChunk: (String) -> Unit): LocalGenerationOutcome =
        generationMutex.withLock {
            val activeEngine = engine ?: throw BridgeException("model_not_ready", "unloaded")
            withContext(Dispatchers.IO) {
                cancelRequested.set(false)
                activeEngine.createConversation(conversationConfig(request)).use { conversation ->
                    activeConversation = conversation
                    try {
                        streamReply(conversation, request, onChunk)
                    } finally {
                        activeConversation = null
                    }
                }
            }
        }

    fun cancel(requestId: String) {
        cancelRequested.set(true)
        try {
            activeConversation?.cancelProcess()
        } catch (error: IllegalStateException) {
            lastErrorMessage = error.message
        }
    }

    override fun close() {
        cancel("")
        closeEngine()
    }

    private fun conversationConfig(request: LocalGenerationRequest): ConversationConfig = ConversationConfig(
        systemInstruction = request.systemPrompt?.let { Contents.of(it) },
        initialMessages = request.history.map { message ->
            if (message.role == LocalMessageRole.ASSISTANT) Message.model(message.content) else Message.user(message.content)
        },
        samplerConfig = SamplerConfig(
            topK = request.sampling.topK,
            topP = request.sampling.topP,
            temperature = request.sampling.temperature,
            seed = request.sampling.seed,
        ),
        maxOutputToken = request.maxOutputTokens,
        enableResponseFormat = request.responseSchema != null,
    )

    private suspend fun streamReply(
        conversation: Conversation,
        request: LocalGenerationRequest,
        onChunk: (String) -> Unit,
    ): LocalGenerationOutcome = suspendCancellableCoroutine { continuation ->
        val generated = StringBuilder()
        val finished = AtomicBoolean(false)
        fun finish(outcome: LocalGenerationOutcome) {
            if (finished.compareAndSet(false, true)) {
                continuation.resume(outcome)
            }
        }
        continuation.invokeOnCancellation { cancel("") }
        conversation.sendMessageAsync(
            message = Message.user(request.userMessage),
            callback = object : MessageCallback {
                override fun onMessage(message: Message) {
                    val chunk = message.contents.contents.filterIsInstance<Content.Text>().joinToString("") { it.text }
                    if (chunk.isNotEmpty()) {
                        synchronized(generated) { generated.append(chunk) }
                        onChunk(chunk)
                    }
                }

                override fun onDone() {
                    val text = synchronized(generated) { generated.toString() }
                    if (cancelRequested.get()) {
                        finish(LocalGenerationOutcome.Cancelled(text))
                    } else {
                        finish(LocalGenerationOutcome.Completed(text, conversation.getTokenCount()))
                    }
                }

                override fun onError(throwable: Throwable) {
                    val text = synchronized(generated) { generated.toString() }
                    if (throwable is CancellationException || cancelRequested.get()) {
                        finish(LocalGenerationOutcome.Cancelled(text))
                    } else {
                        finish(LocalGenerationOutcome.Failed(throwable))
                    }
                }
            },
            maxOutputToken = request.maxOutputTokens,
            responseFormat = request.responseSchema?.let { ResponseFormat.json(it) },
        )
    }

    private suspend fun closeEngineAfterGeneration() {
        cancel("")
        generationMutex.withLock { closeEngine() }
    }

    private fun closeEngine() {
        engine?.close()
        engine = null
        loadedFileName = null
        loadedBackend = null
        contextWindow = null
    }
}
