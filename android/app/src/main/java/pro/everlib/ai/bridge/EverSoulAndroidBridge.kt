package pro.everlib.ai.bridge

import android.content.Context
import android.os.Build
import android.util.Base64
import android.webkit.JavascriptInterface
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import pro.everlib.ai.AppConstants
import pro.everlib.ai.files.BackupDirectoryStore
import pro.everlib.ai.files.DocumentRequestCoordinator
import pro.everlib.ai.llm.DeviceAcceleratorDetector
import pro.everlib.ai.llm.GeminiNanoDownloadEvent
import pro.everlib.ai.llm.GeminiNanoRuntime
import pro.everlib.ai.llm.GeminiNanoStatus
import pro.everlib.ai.llm.InstalledLiteRtLmModel
import pro.everlib.ai.llm.LiteRtLmModelStore
import pro.everlib.ai.llm.LiteRtLmRuntime
import pro.everlib.ai.llm.LiteRtLmStatus
import pro.everlib.ai.llm.LocalGenerationOutcome
import pro.everlib.ai.llm.LocalGenerationPayloadParser

class EverSoulAndroidBridge(
    private val context: Context,
    private val events: BridgeEventSink,
    private val documents: DocumentRequestCoordinator,
) : AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val modelStore = LiteRtLmModelStore(context)
    private val runtime = LiteRtLmRuntime(context)
    private val geminiNano = GeminiNanoRuntime(context)
    private val backupDirectory = BackupDirectoryStore(context)

    @JavascriptInterface
    fun platformInfo(): String {
        val profile = DeviceAcceleratorDetector.detect()
        return JSONObject()
            .put("sdk_int", Build.VERSION.SDK_INT)
            .put("device_model", Build.MODEL)
            .put("manufacturer", Build.MANUFACTURER)
            .put("accelerator_vendor", profile.vendor.name.lowercase())
            .put("soc_model", profile.socModel)
            .put("soc_match_keys", JSONArray(profile.socMatchKeys))
            .toString()
    }

    @JavascriptInterface
    fun downloadLiteRtLmModel(requestId: String, url: String, fileName: String) {
        launchRequest(requestId) {
            val installed = modelStore.download(url, fileName) { copiedBytes, totalBytes ->
                val progress = JSONObject().put("loaded_bytes", copiedBytes)
                if (totalBytes != null && totalBytes > 0) {
                    progress.put("ratio", copiedBytes.toDouble() / totalBytes.toDouble())
                }
                events.emit(requestId, "progress", progress)
            }
            events.emit(requestId, "result", JSONObject().put("model", installed.toJson()))
        }
    }

    @JavascriptInterface
    fun listLiteRtLmModels(): String = JSONArray(modelStore.list().map { it.toJson() }).toString()

    @JavascriptInterface
    fun liteRtLmStatus(): String = runtime.status().toJson().toString()

    @JavascriptInterface
    fun importLiteRtLmModel(requestId: String) {
        launchRequest(requestId) {
            val uri = documents.openDocument(arrayOf("*/*"))
            if (uri == null) {
                events.emit(requestId, "cancelled")
                return@launchRequest
            }
            val installed = modelStore.import(uri) { copiedBytes, totalBytes ->
                val progress = JSONObject().put("loaded_bytes", copiedBytes)
                if (totalBytes != null && totalBytes > 0) {
                    progress.put("ratio", copiedBytes.toDouble() / totalBytes.toDouble())
                }
                events.emit(requestId, "progress", progress)
            }
            events.emit(requestId, "result", JSONObject().put("model", installed.toJson()))
        }
    }

    @JavascriptInterface
    fun removeLiteRtLmModel(requestId: String, fileName: String) {
        launchRequest(requestId) {
            if (runtime.status().loadedFileName == fileName) {
                runtime.unload()
            }
            modelStore.remove(fileName)
            events.emit(requestId, "result")
        }
    }

    @JavascriptInterface
    fun loadLiteRtLmModel(requestId: String, fileName: String) {
        launchRequest(requestId) {
            val status = runtime.load(modelStore.file(fileName))
            events.emit(requestId, "result", JSONObject().put("status", status.toJson()))
        }
    }

    @JavascriptInterface
    fun unloadLiteRtLmModel(requestId: String) {
        launchRequest(requestId) {
            runtime.unload()
            events.emit(requestId, "result")
        }
    }

    @JavascriptInterface
    fun generateLiteRtLm(requestId: String, payloadJson: String) {
        launchRequest(requestId) {
            val outcome = runtime.generate(requestId, LocalGenerationPayloadParser.parse(payloadJson)) { chunk ->
                events.emit(requestId, "chunk", JSONObject().put("text", chunk))
            }
            emitGenerationOutcome(requestId, outcome)
        }
    }

    @JavascriptInterface
    fun cancelLiteRtLm(requestId: String) {
        runtime.cancel(requestId)
    }

    @JavascriptInterface
    fun geminiNanoStatus(): String = geminiNano.status().toJson().toString()

    @JavascriptInterface
    fun prepareGeminiNano(requestId: String) {
        launchRequest(requestId) {
            var totalBytes: Long? = null
            val status = geminiNano.prepare { event ->
                when (event) {
                    is GeminiNanoDownloadEvent.Started -> totalBytes = event.totalBytes
                    is GeminiNanoDownloadEvent.Progress -> {
                        val progress = JSONObject().put("loaded_bytes", event.downloadedBytes)
                        totalBytes?.takeIf { it > 0 }?.let { progress.put("ratio", event.downloadedBytes.toDouble() / it.toDouble()) }
                        events.emit(requestId, "progress", progress)
                    }
                }
            }
            events.emit(requestId, "result", JSONObject().put("gemini_nano", status.toJson()))
        }
    }

    @JavascriptInterface
    fun generateGeminiNano(requestId: String, payloadJson: String) {
        launchRequest(requestId) {
            val outcome = geminiNano.generate(LocalGenerationPayloadParser.parse(payloadJson)) { chunk ->
                events.emit(requestId, "chunk", JSONObject().put("text", chunk))
            }
            emitGenerationOutcome(requestId, outcome)
        }
    }

    @JavascriptInterface
    fun cancelGeminiNano(requestId: String) {
        geminiNano.cancel()
    }

    @JavascriptInterface
    fun saveDocument(requestId: String, suggestedName: String, mimeType: String, base64Content: String) {
        launchRequest(requestId) {
            val uri = documents.createDocument(suggestedName, mimeType)
            if (uri == null) {
                events.emit(requestId, "cancelled")
                return@launchRequest
            }
            val bytes = Base64.decode(base64Content, Base64.DEFAULT)
            withContext(Dispatchers.IO) {
                context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) }
                    ?: throw BridgeException("storage", suggestedName)
            }
            events.emit(requestId, "result", JSONObject().put("name", uri.lastPathSegment ?: suggestedName))
        }
    }

    @JavascriptInterface
    fun linkBackupDirectory(requestId: String) {
        launchRequest(requestId) {
            val treeUri = documents.openDocumentTree()
            if (treeUri == null) {
                events.emit(requestId, "cancelled")
                return@launchRequest
            }
            backupDirectory.link(treeUri)
            events.emit(requestId, "result", backupDirectoryStateJson())
        }
    }

    @JavascriptInterface
    fun backupDirectoryState(): String = backupDirectoryStateJson().toString()

    @JavascriptInterface
    fun unlinkBackupDirectory() {
        backupDirectory.unlink()
    }

    @JavascriptInterface
    fun writeBackupFile(requestId: String, fileName: String, content: String) {
        launchRequest(requestId) {
            backupDirectory.write(fileName, content)
            events.emit(requestId, "result")
        }
    }

    @JavascriptInterface
    fun readBackupFile(requestId: String, fileName: String) {
        launchRequest(requestId) {
            events.emit(requestId, "result", JSONObject().put("content", backupDirectory.read(fileName)))
        }
    }

    @JavascriptInterface
    fun listBackupFiles(requestId: String) {
        launchRequest(requestId) {
            val files = JSONArray(backupDirectory.list().map { entry ->
                JSONObject()
                    .put("name", entry.name)
                    .put("size_bytes", entry.sizeBytes)
                    .put("modified_at", Instant.ofEpochMilli(entry.modifiedAtMillis).toString())
            })
            events.emit(requestId, "result", JSONObject().put("files", files))
        }
    }

    @JavascriptInterface
    fun removeBackupFile(requestId: String, fileName: String) {
        launchRequest(requestId) {
            backupDirectory.remove(fileName)
            events.emit(requestId, "result")
        }
    }

    override fun close() {
        runtime.close()
        geminiNano.close()
        scope.cancel()
    }

    private fun launchRequest(requestId: String, block: suspend () -> Unit) {
        scope.launch {
            try {
                block()
            } catch (error: Throwable) {
                events.emitError(requestId, error)
            }
        }
    }

    private fun backupDirectoryStateJson(): JSONObject {
        val state = backupDirectory.state()
        return JSONObject()
            .put("linked", state.linked)
            .put("name", state.name ?: JSONObject.NULL)
            .put("writable", state.writable)
    }

    private fun emitGenerationOutcome(requestId: String, outcome: LocalGenerationOutcome) {
        when (outcome) {
            is LocalGenerationOutcome.Completed -> events.emit(
                requestId,
                "result",
                JSONObject().put("text", outcome.text).put("token_count", outcome.tokenCount ?: JSONObject.NULL),
            )
            is LocalGenerationOutcome.Cancelled -> events.emit(requestId, "cancelled", JSONObject().put("text", outcome.text))
            is LocalGenerationOutcome.Failed -> events.emitError(requestId, outcome.error)
        }
    }

    private fun GeminiNanoStatus.toJson(): JSONObject = JSONObject()
        .put("availability", availability.name.lowercase())
        .put("downloaded_bytes", downloadedBytes ?: JSONObject.NULL)
        .put("error_message", errorMessage ?: JSONObject.NULL)

    private fun InstalledLiteRtLmModel.toJson(): JSONObject = JSONObject()
        .put("file_name", fileName)
        .put("size_bytes", sizeBytes)
        .put("installed_at", Instant.ofEpochMilli(installedAtMillis).toString())

    private fun LiteRtLmStatus.toJson(): JSONObject = JSONObject()
        .put("loaded_file_name", loadedFileName ?: JSONObject.NULL)
        .put("backend", backend ?: JSONObject.NULL)
        .put("context_window", contextWindow ?: JSONObject.NULL)
        .put("error_message", errorMessage ?: JSONObject.NULL)
}
