package evai.android.llm

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import evai.android.documents.DocumentRequests
import evai.android.specs.NativeEvaiLlmSpec
import evai.android.transfer.TransferCancelled
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.Collections
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class LlmModule(context: ReactApplicationContext) : NativeEvaiLlmSpec(context) {
    private val engineExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val transferExecutor: ExecutorService = Executors.newCachedThreadPool()
    private val store = ModelFileStore(
        File(context.filesDir, MODEL_DIRECTORY_NAME),
        context.assets,
        File(context.applicationInfo.sourceDir).lastModified(),
    )
    private val documents = DocumentRequests(context)
    private val requestLock = Any()
    private val queuedRequests = HashSet<String>()
    private val cancelledRequests = HashSet<String>()
    private var activeRequestId: String? = null
    private val cancelledTransfers: MutableSet<String> = Collections.synchronizedSet(HashSet())
    @Volatile private var modelState: JSONObject = unloadedState(null)

    override fun readState(promise: Promise) {
        promise.resolve(modelState.toString())
    }

    override fun loadModel(fileName: String, contextTokens: Double, promise: Promise) {
        engineExecutor.execute {
            try {
                val file = store.resolve(fileName)
                val native = JSONObject(String(LlamaEngine.nativeLoad(file.path.toByteArray(Charsets.UTF_8), contextTokens.toInt()), Charsets.UTF_8))
                modelState = loadedState(native)
                promise.resolve(modelState.toString())
            } catch (failure: Exception) {
                modelState = unloadedState(failure.message ?: fileName)
                reject(promise, failure)
            }
        }
    }

    override fun unloadModel(promise: Promise) {
        engineExecutor.execute {
            try {
                LlamaEngine.nativeUnload()
                modelState = unloadedState(null)
                promise.resolve(null)
            } catch (failure: Exception) {
                reject(promise, failure)
            }
        }
    }

    override fun measurePrompt(messages: String, addAssistant: Boolean, promise: Promise) {
        engineExecutor.execute {
            try {
                val (roles, contents) = readMessages(JSONArray(messages))
                promise.resolve(LlamaEngine.nativeMeasure(roles, contents, addAssistant).toDouble())
            } catch (failure: Exception) {
                reject(promise, failure)
            }
        }
    }

    override fun prefill(messages: String, promise: Promise) {
        engineExecutor.execute {
            try {
                val (roles, contents) = readMessages(JSONArray(messages))
                synchronized(requestLock) {
                    LlamaEngine.nativeClearCancel()
                }
                promise.resolve(String(LlamaEngine.nativePrefill(roles, contents), Charsets.UTF_8))
            } catch (failure: Exception) {
                reject(promise, failure)
            }
        }
    }

    override fun generate(requestId: String, request: String, promise: Promise) {
        synchronized(requestLock) {
            queuedRequests.add(requestId)
        }
        engineExecutor.execute {
            val startable = synchronized(requestLock) {
                queuedRequests.remove(requestId)
                if (cancelledRequests.remove(requestId)) {
                    false
                } else {
                    LlamaEngine.nativeClearCancel()
                    activeRequestId = requestId
                    true
                }
            }
            if (!startable) {
                promise.resolve(cancelledResult().toString())
                return@execute
            }
            try {
                val payload = JSONObject(request)
                val (roles, contents) = readMessages(payload.getJSONArray("messages"))
                val sampling = payload.getJSONObject("sampling")
                val result = LlamaEngine.nativeGenerate(
                    roles,
                    contents,
                    payload.optString("grammar", "").toByteArray(Charsets.UTF_8),
                    payload.getInt("max_output_tokens"),
                    sampling.getInt("top_k"),
                    sampling.getDouble("top_p").toFloat(),
                    sampling.getDouble("temperature").toFloat(),
                    sampling.getLong("seed"),
                ) { chunk -> emitChunk(requestId, String(chunk, Charsets.UTF_8)) }
                promise.resolve(String(result, Charsets.UTF_8))
            } catch (failure: Exception) {
                reject(promise, failure)
            } finally {
                synchronized(requestLock) {
                    activeRequestId = null
                }
            }
        }
    }

    override fun cancel(requestId: String) {
        synchronized(requestLock) {
            if (activeRequestId == requestId) {
                LlamaEngine.nativeCancel()
            } else if (queuedRequests.contains(requestId)) {
                cancelledRequests.add(requestId)
            }
        }
    }

    override fun listModels(promise: Promise) {
        transferExecutor.execute {
            try {
                promise.resolve(store.list().toString())
            } catch (failure: Exception) {
                reject(promise, failure)
            }
        }
    }

    override fun importModel(requestId: String, promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(ANY_DOCUMENT_TYPE)
        documents.launch(intent, { failure -> reject(promise, failure) }) { resultCode, data ->
            val uri: Uri? = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.resolve(emptyModelResult(false).toString())
                return@launch
            }
            runTransfer(requestId, promise) {
                store.importDocument(reactApplicationContext.contentResolver, uri, { cancelledTransfers.contains(requestId) }) { loaded, total ->
                    emitTransfer(requestId, loaded, total)
                }
            }
        }
    }

    override fun downloadModel(requestId: String, url: String, fileName: String, expectedBytes: Double, promise: Promise) {
        runTransfer(requestId, promise) {
            store.downloadFile(url, fileName, expectedBytes.toLong(), { cancelledTransfers.contains(requestId) }) { loaded, total ->
                emitTransfer(requestId, loaded, total)
            }
        }
    }

    override fun cancelTransfer(requestId: String) {
        cancelledTransfers.add(requestId)
    }

    override fun removeModel(fileName: String, promise: Promise) {
        engineExecutor.execute {
            try {
                if (modelState.optString("loaded_file_name") == fileName) {
                    LlamaEngine.nativeUnload()
                    modelState = unloadedState(null)
                }
                store.remove(fileName)
                promise.resolve(null)
            } catch (failure: Exception) {
                reject(promise, failure)
            }
        }
    }

    override fun invalidate() {
        LlamaEngine.nativeCancel()
        documents.dispose()
        engineExecutor.execute { LlamaEngine.nativeUnload() }
        engineExecutor.shutdown()
        transferExecutor.shutdownNow()
        super.invalidate()
    }

    private fun runTransfer(requestId: String, promise: Promise, transfer: () -> JSONObject) {
        transferExecutor.execute {
            try {
                promise.resolve(JSONObject().put("model", transfer()).put("cancelled", false).toString())
            } catch (failure: TransferCancelled) {
                promise.resolve(emptyModelResult(true).toString())
            } catch (failure: Exception) {
                reject(promise, failure)
            } finally {
                cancelledTransfers.remove(requestId)
            }
        }
    }

    private fun reject(promise: Promise, failure: Throwable) {
        val code = when (failure) {
            is ModelFileStore.InvalidModelFile -> INVALID_MODEL_FILE_CODE
            is LlamaFailure -> NATIVE_RUNTIME_CODE
            is FileNotFoundException -> NOT_FOUND_CODE
            is IOException -> STORAGE_CODE
            is IllegalArgumentException -> STORAGE_CODE
            else -> NATIVE_RUNTIME_CODE
        }
        promise.reject(code, failure.message ?: code, failure)
    }

    private fun readMessages(messages: JSONArray): Pair<Array<String>, Array<ByteArray>> {
        val roles = Array(messages.length()) { index -> messages.getJSONObject(index).getString("role") }
        val contents = Array(messages.length()) { index ->
            messages.getJSONObject(index).getString("content").toByteArray(Charsets.UTF_8)
        }
        return roles to contents
    }

    private fun emitChunk(requestId: String, text: String) {
        val event = Arguments.createMap()
        event.putString("request_id", requestId)
        event.putString("text", text)
        reactApplicationContext.emitDeviceEvent(CHUNK_EVENT, event)
    }

    private fun emitTransfer(requestId: String, loaded: Long, total: Long) {
        val event = Arguments.createMap()
        event.putString("request_id", requestId)
        event.putDouble("loaded_bytes", loaded.toDouble())
        event.putDouble("total_bytes", total.toDouble())
        event.putDouble("ratio", if (total > 0) (loaded.toDouble() / total.toDouble()).coerceIn(0.0, 1.0) else 0.0)
        reactApplicationContext.emitDeviceEvent(TRANSFER_EVENT, event)
    }

    private fun cancelledResult(): JSONObject = JSONObject()
        .put("text", "")
        .put("cancelled", true)
        .put("prompt_tokens", 0)
        .put("reused_prefix_tokens", 0)
        .put("generated_tokens", 0)
        .put("cached_tokens", 0)
        .put("cache_reset", false)

    private fun emptyModelResult(cancelled: Boolean): JSONObject = JSONObject()
        .put("model", JSONObject.NULL)
        .put("cancelled", cancelled)

    private fun loadedState(native: JSONObject): JSONObject = JSONObject()
        .put("loaded_file_name", File(native.getString("file_path")).name)
        .put("context_window", native.getInt("context_window"))
        .put("maximum_context_window", native.getInt("maximum_context_window"))
        .put("backend", CPU_BACKEND)
        .put("description", native.getString("description"))
        .put("error_message", JSONObject.NULL)

    private fun unloadedState(errorMessage: String?): JSONObject = JSONObject()
        .put("loaded_file_name", JSONObject.NULL)
        .put("context_window", JSONObject.NULL)
        .put("maximum_context_window", JSONObject.NULL)
        .put("backend", JSONObject.NULL)
        .put("description", JSONObject.NULL)
        .put("error_message", errorMessage ?: JSONObject.NULL)

    companion object {
        private const val MODEL_DIRECTORY_NAME = "models"
        private const val ANY_DOCUMENT_TYPE = "*/*"
        private const val CHUNK_EVENT = "EvaiLlmChunk"
        private const val TRANSFER_EVENT = "EvaiLlmTransfer"
        private const val CPU_BACKEND = "cpu"
        private const val NATIVE_RUNTIME_CODE = "native_runtime"
        private const val NOT_FOUND_CODE = "not_found"
        private const val STORAGE_CODE = "storage"
        private const val INVALID_MODEL_FILE_CODE = "invalid_model_file"
    }
}
