package evai.android.storage

import org.json.JSONObject

class StorageException(val status: Int, body: ByteArray) : Exception(String(body, Charsets.UTF_8)) {
    val error: String
    val detail: String

    init {
        val parsed = JSONObject(message ?: "{}")
        error = parsed.optString("error", "storage_error")
        detail = parsed.optString("detail", status.toString())
    }
}
