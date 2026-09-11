package pro.everlib.ai.llm

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
