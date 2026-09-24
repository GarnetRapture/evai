package evai.android

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class EvaiNativeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val executor = Executors.newSingleThreadExecutor()
    private val database = EvaiDatabase(context)
    private var loadedModelName: String? = null
    @Volatile private var modelPickerPromise: Promise? = null
    private val modelPickerCode = 7281
    private val modelPickerListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != modelPickerCode) return
            val promise = modelPickerPromise ?: return
            modelPickerPromise = null
            val uri = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.resolve(null)
                return
            }
            work(promise) { copyModel(uri) }
        }
    }
    private val stores = setOf(
        "auth_session", "chat_room", "chat_message", "persona_profile",
        "persona_localized_prompt", "persona_memory", "style_profile",
        "knowledge_chunk", "sync_metadata", "general_settings",
        "imported_module", "file_handle",
    )

    init {
        System.loadLibrary("evai_llama")
        context.addActivityEventListener(modelPickerListener)
    }

    override fun getName(): String = "EvaiNative"

    override fun invalidate() {
        nativeCancel()
        modelPickerPromise?.reject("EVAI_NATIVE", "Android screen was closed")
        modelPickerPromise = null
        context.removeActivityEventListener(modelPickerListener)
        executor.execute {
            nativeUnload()
            loadedModelName = null
            database.close()
        }
        executor.shutdown()
        super.invalidate()
    }

    private fun work(promise: Promise, action: () -> Any?) {
        executor.execute {
            try {
                promise.resolve(action())
            } catch (error: Exception) {
                promise.reject("EVAI_NATIVE", error.message ?: "Native operation failed", error)
            }
        }
    }

    private fun store(name: String): String {
        require(name in stores) { "Unknown store: $name" }
        return name
    }

    @ReactMethod
    fun listSpirits(promise: Promise) = work(promise) {
        val result = Arguments.createArray()
        context.assets.list("")
            ?.filter { it.endsWith(".json") }
            ?.sorted()
            ?.forEach { name ->
                context.assets.open(name).bufferedReader().use { reader ->
                    val detail = JSONObject(reader.readText())
                    val spirit = Arguments.createMap()
                    spirit.putString("id", detail.getString("id"))
                    spirit.putString("name", detail.getString("name"))
                    spirit.putString("name_en", detail.optString("name_en"))
                    spirit.putString("grade", detail.optString("grade"))
                    spirit.putString("race", detail.optString("race"))
                    spirit.putString("name_zh_cn", detail.optJSONObject("i18n")?.optJSONObject("name")?.optString("zh_cn"))
                    spirit.putString("archive_key", name.removeSuffix(".json"))
                    result.pushMap(spirit)
                }
            }
        result
    }

    @ReactMethod
    fun readSpirit(archiveKey: String, promise: Promise) = work(promise) {
        require(archiveKey.matches(Regex("[\\p{L}\\p{N}_-]+"))) { "Invalid spirit key" }
        context.assets.open("$archiveKey.json").bufferedReader().use { it.readText() }
    }

    @ReactMethod
    fun readRecord(storeName: String, key: String, promise: Promise) = work(promise) {
        database.read(store(storeName), key)
    }

    @ReactMethod
    fun listRecords(storeName: String, promise: Promise) = work(promise) {
        val result = Arguments.createArray()
        database.list(store(storeName)).forEach(result::pushString)
        result
    }

    @ReactMethod
    fun countRecords(storeName: String, promise: Promise) = work(promise) {
        database.count(store(storeName)).toDouble()
    }

    @ReactMethod
    fun listRoomsForPersona(personaId: String, promise: Promise) = work(promise) {
        val result = Arguments.createArray()
        database.listRoomsForPersona(personaId).forEach(result::pushString)
        result
    }

    @ReactMethod
    fun listMessagesForRoom(roomId: String, promise: Promise) = work(promise) {
        val result = Arguments.createArray()
        database.listMessagesForRoom(roomId).forEach(result::pushString)
        result
    }

    @ReactMethod
    fun listMessagesForPersona(personaId: String, promise: Promise) = work(promise) {
        val result = Arguments.createArray()
        database.listMessagesForPersona(personaId).forEach(result::pushString)
        result
    }

    @ReactMethod
    fun writeRecord(storeName: String, key: String, value: String, promise: Promise) = work(promise) {
        database.write(store(storeName), key, value)
        null
    }

    @ReactMethod
    fun writeBatch(entriesJson: String, promise: Promise) = work(promise) {
        val entries = JSONArray(entriesJson)
        require(entries.length() > 0) { "No records to write" }
        val writes = ArrayList<Triple<String, String, String>>(entries.length())
        for (index in 0 until entries.length()) {
            val entry = entries.getJSONArray(index)
            require(entry.length() == 3) { "Record write entry needs store, key and value" }
            writes.add(Triple(store(entry.getString(0)), entry.getString(1), entry.getString(2)))
        }
        database.writeAll(writes)
        null
    }

    @ReactMethod
    fun deleteRecord(storeName: String, key: String, promise: Promise) = work(promise) {
        database.remove(store(storeName), key)
        null
    }

    @ReactMethod
    fun listModels(promise: Promise) = work(promise) {
        val result = Arguments.createArray()
        File(context.filesDir, "models").listFiles()
            ?.filter { it.isFile && it.extension.equals("gguf", ignoreCase = true) }
            ?.sortedBy { it.name }
            ?.forEach { result.pushString(it.name) }
        result
    }

    @ReactMethod
    fun pickModel(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("EVAI_NATIVE", "No active Android screen")
            return
        }
        if (modelPickerPromise != null) {
            promise.reject("EVAI_NATIVE", "Model picker is already open")
            return
        }
        modelPickerPromise = promise
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        activity.runOnUiThread {
            try {
                activity.startActivityForResult(intent, modelPickerCode)
            } catch (error: Exception) {
                modelPickerPromise = null
                promise.reject("EVAI_NATIVE", error.message, error)
            }
        }
    }

    private fun copyModel(uri: Uri): String {
        val cursor: Cursor = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
            ?: throw IllegalArgumentException("Cannot read selected model metadata")
        val (name, size) = cursor.use {
            require(it.moveToFirst()) { "Selected model has no metadata" }
            Pair(it.getString(0), if (it.isNull(1)) -1L else it.getLong(1))
        }
        require(name == File(name).name && name.endsWith(".gguf", ignoreCase = true)) { "Select a GGUF model" }
        val directory = File(context.filesDir, "models")
        require(directory.isDirectory || directory.mkdirs()) { "Cannot create model directory" }
        if (size >= 0) require(directory.usableSpace > size) { "Not enough storage for model" }
        val destination = File(directory, name)
        require(!destination.exists()) { "Model already exists: $name" }
        val pending = File(directory, "$name.part")
        try {
            context.contentResolver.openInputStream(uri).use { input ->
                requireNotNull(input) { "Cannot open selected model" }
                FileOutputStream(pending).use { output -> input.copyTo(output, 1024 * 1024) }
            }
            require(pending.length() > 0 && (size < 0 || pending.length() == size)) { "Model copy is incomplete" }
            require(pending.renameTo(destination)) { "Cannot finish model import" }
            return name
        } finally {
            if (pending.exists()) pending.delete()
        }
    }

    @ReactMethod
    fun loadModel(fileName: String, contextTokens: Int, promise: Promise) = work(promise) {
        require(fileName == File(fileName).name && fileName.endsWith(".gguf", ignoreCase = true)) { "Invalid model name" }
        require(contextTokens in 512..32768) { "Invalid context size" }
        val file = File(File(context.filesDir, "models"), fileName)
        require(file.isFile) { "Model file is missing: $fileName" }
        loadedModelName = null
        val version = nativeLoadModel(file.absolutePath.toByteArray(Charsets.UTF_8), contextTokens)
        loadedModelName = fileName
        version
    }

    @ReactMethod
    fun deleteModel(fileName: String, promise: Promise) = work(promise) {
        require(fileName == File(fileName).name && fileName.endsWith(".gguf", ignoreCase = true)) { "Invalid model name" }
        require(fileName != loadedModelName) { "Unload this model before deleting it" }
        val file = File(File(context.filesDir, "models"), fileName)
        require(file.isFile) { "Model file is missing: $fileName" }
        check(file.delete()) { "Could not delete model: $fileName" }
        null
    }

    @ReactMethod
    fun generate(messagesJson: String, maxTokens: Int, promise: Promise) = work(promise) {
        require(maxTokens in 1..4096) { "Invalid output limit" }
        val messages = JSONArray(messagesJson)
        require(messages.length() > 0) { "Chat messages are missing" }
        val roles = arrayOfNulls<String>(messages.length())
        val contents = arrayOfNulls<ByteArray>(messages.length())
        for (index in 0 until messages.length()) {
            val message = messages.getJSONObject(index)
            val role = message.getString("role")
            require(role in setOf("system", "user", "assistant")) { "Invalid chat message role: $role" }
            val content = message.getString("content")
            require(content.isNotEmpty()) { "Chat message content is empty" }
            roles[index] = role
            contents[index] = content.toByteArray(Charsets.UTF_8)
        }
        require(roles[0] == "system") { "Chat messages must open with the system prompt" }
        require(roles[messages.length() - 1] == "user") { "Chat messages must close with the Savior turn" }
        val output = nativeGenerate(roles, contents, maxTokens)
        String(output, Charsets.UTF_8)
    }

    @ReactMethod
    fun cancelGeneration() {
        nativeCancel()
    }

    @ReactMethod
    fun unloadModel(promise: Promise) = work(promise) {
        nativeUnload()
        loadedModelName = null
        null
    }

    private external fun nativeLoadModel(path: ByteArray, contextTokens: Int): String
    private external fun nativeGenerate(roles: Array<String?>, contents: Array<ByteArray?>, maxTokens: Int): ByteArray
    private external fun nativeCancel()
    private external fun nativeUnload()
}
