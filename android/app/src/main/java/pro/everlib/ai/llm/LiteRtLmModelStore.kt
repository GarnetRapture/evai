package pro.everlib.ai.llm

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext
import pro.everlib.ai.AppConstants
import pro.everlib.ai.bridge.BridgeException
import pro.everlib.ai.files.readDocumentMetadata

data class InstalledLiteRtLmModel(val fileName: String, val sizeBytes: Long, val installedAtMillis: Long)

class LiteRtLmModelStore(private val context: Context) {
    private val directory: File
        get() = File(context.filesDir, AppConstants.MODEL_DIRECTORY).apply { mkdirs() }

    fun list(): List<InstalledLiteRtLmModel> =
        directory.listFiles { file -> file.isFile && isModelFileName(file.name) }
            .orEmpty()
            .sortedByDescending { it.lastModified() }
            .map { InstalledLiteRtLmModel(it.name, it.length(), it.lastModified()) }

    fun file(fileName: String): File {
        requireValidModelFileName(fileName)
        val file = File(directory, fileName)
        if (!file.isFile) {
            throw BridgeException("not_found", fileName)
        }
        return file
    }

    fun remove(fileName: String) {
        requireValidModelFileName(fileName)
        val file = File(directory, fileName)
        if (file.exists() && !file.delete()) {
            throw BridgeException("storage", fileName)
        }
    }

    suspend fun download(url: String, fileName: String, onProgress: (Long, Long?) -> Unit): InstalledLiteRtLmModel = withContext(Dispatchers.IO) {
        requireValidModelFileName(fileName)
        val target = File(directory, fileName)
        val partial = File(directory, fileName + AppConstants.MODEL_PARTIAL_SUFFIX)
        val connection = openFollowingRedirects(url)
        try {
            val declaredLength = connection.contentLengthLong.takeIf { it > 0 }
            connection.inputStream.use { source ->
                FileOutputStream(partial).use { output ->
                    copyWithProgress(source, output, declaredLength, onProgress)
                }
            }
            if (target.exists() && !target.delete()) {
                throw BridgeException("storage", fileName)
            }
            if (!partial.renameTo(target)) {
                throw BridgeException("storage", fileName)
            }
        } finally {
            connection.disconnect()
            if (partial.exists()) {
                partial.delete()
            }
        }
        InstalledLiteRtLmModel(target.name, target.length(), target.lastModified())
    }

    private suspend fun copyWithProgress(source: InputStream, output: FileOutputStream, totalBytes: Long?, onProgress: (Long, Long?) -> Unit) {
        val buffer = ByteArray(AppConstants.COPY_BUFFER_BYTES)
        var copiedBytes = 0L
        var reportedBytes = 0L
        while (true) {
            coroutineContext.ensureActive()
            val read = source.read(buffer)
            if (read < 0) {
                break
            }
            output.write(buffer, 0, read)
            copiedBytes += read
            if (copiedBytes - reportedBytes >= AppConstants.MODEL_IMPORT_PROGRESS_STEP_BYTES) {
                reportedBytes = copiedBytes
                onProgress(copiedBytes, totalBytes)
            }
        }
        onProgress(copiedBytes, totalBytes)
    }

    private fun openFollowingRedirects(url: String): HttpURLConnection {
        var current = url
        var redirects = 0
        while (true) {
            val connection = URL(current).openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = AppConstants.MODEL_DOWNLOAD_TIMEOUT_MS
            connection.readTimeout = AppConstants.MODEL_DOWNLOAD_TIMEOUT_MS
            connection.setRequestProperty("User-Agent", AppConstants.MODEL_DOWNLOAD_USER_AGENT)
            connection.connect()
            val status = connection.responseCode
            if (status in intArrayOf(HttpURLConnection.HTTP_MOVED_PERM, HttpURLConnection.HTTP_MOVED_TEMP, HttpURLConnection.HTTP_SEE_OTHER, 307, 308)) {
                val location = connection.getHeaderField("Location")
                connection.disconnect()
                if (location == null || redirects >= AppConstants.MODEL_DOWNLOAD_MAX_REDIRECTS) {
                    throw BridgeException("native_runtime", "download_redirect_failed:$url")
                }
                current = if (location.startsWith("http")) location else URL(URL(current), location).toString()
                redirects += 1
                continue
            }
            if (status != HttpURLConnection.HTTP_OK) {
                connection.disconnect()
                throw BridgeException(if (status == HttpURLConnection.HTTP_UNAUTHORIZED || status == HttpURLConnection.HTTP_FORBIDDEN) "storage" else "native_runtime", "download_http_$status:$url")
            }
            return connection
        }
    }

    suspend fun import(uri: Uri, onProgress: (Long, Long?) -> Unit): InstalledLiteRtLmModel = withContext(Dispatchers.IO) {
        val metadata = context.contentResolver.readDocumentMetadata(uri) ?: throw BridgeException("invalid_model_file", uri.toString())
        requireValidModelFileName(metadata.displayName)
        val target = File(directory, metadata.displayName)
        val partial = File(directory, metadata.displayName + AppConstants.MODEL_PARTIAL_SUFFIX)
        try {
            val input = context.contentResolver.openInputStream(uri) ?: throw BridgeException("storage", metadata.displayName)
            input.use { source ->
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(AppConstants.COPY_BUFFER_BYTES)
                    var copiedBytes = 0L
                    var reportedBytes = 0L
                    while (true) {
                        val read = source.read(buffer)
                        if (read < 0) {
                            break
                        }
                        output.write(buffer, 0, read)
                        copiedBytes += read
                        if (copiedBytes - reportedBytes >= AppConstants.MODEL_IMPORT_PROGRESS_STEP_BYTES) {
                            reportedBytes = copiedBytes
                            onProgress(copiedBytes, metadata.sizeBytes)
                        }
                    }
                    onProgress(copiedBytes, metadata.sizeBytes)
                }
            }
            if (target.exists() && !target.delete()) {
                throw BridgeException("storage", metadata.displayName)
            }
            if (!partial.renameTo(target)) {
                throw BridgeException("storage", metadata.displayName)
            }
        } finally {
            if (partial.exists()) {
                partial.delete()
            }
        }
        InstalledLiteRtLmModel(target.name, target.length(), target.lastModified())
    }

    private fun isModelFileName(fileName: String): Boolean =
        fileName.endsWith(AppConstants.MODEL_FILE_EXTENSION, ignoreCase = true)

    private fun requireValidModelFileName(fileName: String) {
        if (!isModelFileName(fileName) || fileName.contains('/') || fileName.contains('\\') || fileName.startsWith(".")) {
            throw BridgeException("invalid_model_file", fileName)
        }
    }
}
