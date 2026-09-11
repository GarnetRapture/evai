package pro.everlib.ai.llm

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
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
    private data class LiteRtLmStreamResult(val text: String, val cancelled: Boolean, val error: Throwable?)

    private val engineMutex = Mutex()
    private val generationMutex = Mutex()
    private val activeConversations = ConcurrentHashMap<String, Conversation>()
    private val cancelledRequests = ConcurrentHashMap.newKeySet<String>()
    private var engine: Engine? = null
    private var loadedFileName: String? = null
    private var loadedBackend: String? = null
    private var lastErrorMessage: String? = null

    fun status(): LiteRtLmStatus = LiteRtLmStatus(
        loadedFileName = loadedFileName,
        backend = loadedBackend,
        contextWindow = engine?.engineConfig?.maxNumTokens,
        errorMessage = lastErrorMessage,
    )

    suspend fun load(modelFile: File): LiteRtLmStatus = engineMutex.withLock {
        withContext(Dispatchers.IO) {
            if (loadedFileName == modelFile.name && engine?.isInitialized() == true) {
                return@withContext status()
            }
            closeEngineAfterGeneration()
            try {
                val gpuEngine = runCatching { createEngine(modelFile, Backend.GPU()) }
                val created = gpuEngine.getOrNull()?.let { it to "GPU" } ?: (createEngine(modelFile, Backend.CPU()) to "CPU")
                engine = created.first
                loadedBackend = created.second
                loadedFileName = modelFile.name
                lastErrorMessage = null
            } catch (error: Throwable) {
                lastErrorMessage = error.message ?: error.javaClass.simpleName
                throw error
            }
            status()
        }
    }

    suspend fun unload() = engineMutex.withLock {
        withContext(Dispatchers.IO) { closeEngineAfterGeneration() }
    }

    suspend fun generate(requestId: String, request: LiteRtLmGenerationRequest, onChunk: (String) -> Unit): LiteRtLmGenerationOutcome =
        generationMutex.withLock {
            val activeEngine = engine ?: throw BridgeException("model_not_ready", "unloaded")
            val conversation = withContext(Dispatchers.IO) {
                activeEngine.createConversation(
                    ConversationConfig(
                        systemInstruction = request.systemPrompt?.let { Contents.of(it) },
                        initialMessages = request.history.map { it.toMessage() },
                        maxOutputToken = request.maxOutputTokens,
                    ),
                )
            }
            activeConversations[requestId] = conversation
            if (cancelledRequests.contains(requestId)) {
                conversation.cancelProcess()
            }
            try {
                val stream = awaitGeneration(requestId, conversation, request.userMessage, onChunk)
                when {
                    stream.error != null && !stream.cancelled -> LiteRtLmGenerationOutcome.Failed(stream.error)
                    stream.cancelled -> LiteRtLmGenerationOutcome.Cancelled(stream.text)
                    else -> LiteRtLmGenerationOutcome.Completed(stream.text, withContext(Dispatchers.IO) { conversation.getTokenCount() })
                }
            } finally {
                activeConversations.remove(requestId)
                cancelledRequests.remove(requestId)
                withContext(Dispatchers.IO) { conversation.close() }
            }
        }

    fun cancel(requestId: String) {
        cancelledRequests.add(requestId)
        activeConversations[requestId]?.cancelProcess()
    }

    override fun close() {
        activeConversations.values.forEach { it.cancelProcess() }
        closeEngine()
    }

    private suspend fun awaitGeneration(
        requestId: String,
        conversation: Conversation,
        userMessage: String,
        onChunk: (String) -> Unit,
    ): LiteRtLmStreamResult = suspendCancellableCoroutine { continuation ->
        val generated = StringBuilder()
        continuation.invokeOnCancellation { conversation.cancelProcess() }
        conversation.sendMessageAsync(
            Message.user(userMessage),
            object : MessageCallback {
                override fun onMessage(message: Message) {
                    val chunk = message.toString()
                    if (chunk.isNotEmpty()) {
                        generated.append(chunk)
                        onChunk(chunk)
                    }
                }

                override fun onDone() {
                    if (continuation.isActive) {
                        continuation.resume(LiteRtLmStreamResult(generated.toString(), cancelledRequests.contains(requestId), null))
                    }
                }

                override fun onError(throwable: Throwable) {
                    if (continuation.isActive) {
                        continuation.resume(LiteRtLmStreamResult(generated.toString(), cancelledRequests.contains(requestId), throwable))
                    }
                }
            },
        )
    }

    private fun createEngine(modelFile: File, backend: Backend): Engine {
        val created = Engine(
            EngineConfig(
                modelPath = modelFile.absolutePath,
                backend = backend,
                maxNumTokens = AppConstants.LITERT_LM_MAX_NUM_TOKENS,
                cacheDir = context.cacheDir.absolutePath,
            ),
        )
        try {
            created.initialize()
        } catch (error: Throwable) {
            created.close()
            throw error
        }
        return created
    }

    private suspend fun closeEngineAfterGeneration() {
        activeConversations.keys.forEach { cancel(it) }
        generationMutex.withLock { closeEngine() }
    }

    private fun closeEngine() {
        engine?.close()
        engine = null
        loadedFileName = null
        loadedBackend = null
    }

    private fun LiteRtLmHistoryMessage.toMessage(): Message = when (role) {
        LiteRtLmMessageRole.USER -> Message.user(content)
        LiteRtLmMessageRole.ASSISTANT -> Message.model(content)
    }
}
