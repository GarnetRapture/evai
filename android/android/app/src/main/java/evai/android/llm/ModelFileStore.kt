package evai.android.llm

import android.content.ContentResolver
import android.content.res.AssetManager
import android.net.Uri
import android.provider.OpenableColumns
import evai.android.transfer.HttpDownload
import evai.android.transfer.TransferCancelled
import java.io.File
import java.io.FileNotFoundException
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

class ModelFileStore(
    private val directory: File,
    private val assets: AssetManager,
    private val bundledAt: Long,
) {
    private val download = HttpDownload(HttpDownload.HTTP_AND_HTTPS)
    private val bundledModels: Map<String, Long> by lazy {
        assets.list(BUNDLED_MODEL_DIRECTORY).orEmpty()
            .filter(::isModelFileName)
            .associateWith { name -> assets.openFd("$BUNDLED_MODEL_DIRECTORY/$name").use { descriptor -> descriptor.length } }
    }

    fun list(): JSONArray {
        val files = directory.listFiles { file -> file.isFile && isModelFileName(file.name) }.orEmpty()
            .filter { file -> file.name !in bundledModels }
            .map(::describe)
        val bundled = bundledModels.map { (name, size) -> describeBundled(name, size) }
        return JSONArray((files + bundled).sortedBy { entry -> entry.getString("file_name") })
    }

    fun resolve(fileName: String): File {
        val name = requireModelFileName(fileName)
        val file = File(directory, name)
        val bundledSize = bundledModels[name]
        if (bundledSize != null && (!file.isFile || file.length() != bundledSize)) {
            extractBundled(name, file)
        }
        if (!file.isFile) {
            throw FileNotFoundException(fileName)
        }
        return file
    }

    fun importDocument(
        resolver: ContentResolver,
        uri: Uri,
        cancelled: () -> Boolean,
        onProgress: (Long, Long) -> Unit,
    ): JSONObject {
        val (displayName, totalBytes) = readDocumentIdentity(resolver, uri)
        val fileName = requireModelFileName(displayName)
        directory.mkdirs()
        val staging = File(directory, fileName + HttpDownload.PART_SUFFIX)
        var copied = 0L
        try {
            val input = resolver.openInputStream(uri) ?: throw IOException("cannot open $displayName")
            input.use { stream ->
                FileOutputStream(staging, false).use { output ->
                    val buffer = ByteArray(COPY_BUFFER_BYTES)
                    while (true) {
                        if (cancelled()) {
                            throw TransferCancelled(displayName)
                        }
                        val read = stream.read(buffer)
                        if (read < 0) {
                            break
                        }
                        if (copied == 0L && read >= GGUF_MAGIC.size && !startsWithGgufMagic(buffer)) {
                            throw InvalidModelFile(displayName)
                        }
                        output.write(buffer, 0, read)
                        copied += read
                        onProgress(copied, totalBytes)
                    }
                }
            }
        } catch (failure: Throwable) {
            staging.delete()
            throw failure
        }
        if (!hasGgufMagic(staging)) {
            staging.delete()
            throw InvalidModelFile(displayName)
        }
        val target = File(directory, fileName)
        if (target.exists() && !target.delete()) {
            staging.delete()
            throw IOException("cannot replace the installed model $fileName")
        }
        if (!staging.renameTo(target)) {
            staging.delete()
            throw IOException("cannot install the model $fileName")
        }
        return describe(target)
    }

    fun downloadFile(
        url: String,
        fileName: String,
        expectedBytes: Long,
        cancelled: () -> Boolean,
        onProgress: (Long, Long) -> Unit,
    ): JSONObject {
        val target = File(directory, requireModelFileName(fileName))
        directory.mkdirs()
        val staging = File(target.path + HttpDownload.PART_SUFFIX)
        var received = if (staging.isFile) staging.length() else 0L
        var total = expectedBytes
        download.fetch(url, target, expectedBytes, cancelled, { length -> if (expectedBytes <= 0) total = length }) { bytes ->
            received += bytes
            onProgress(received, total)
        }
        if (!hasGgufMagic(target)) {
            target.delete()
            throw InvalidModelFile(fileName)
        }
        return describe(target)
    }

    fun remove(fileName: String) {
        val file = File(directory, requireModelFileName(fileName))
        File(file.path + HttpDownload.PART_SUFFIX).delete()
        if (file.exists() && !file.delete()) {
            throw IOException("cannot remove the model $fileName")
        }
    }

    private fun extractBundled(name: String, target: File) {
        directory.mkdirs()
        val staging = File(target.path + HttpDownload.PART_SUFFIX)
        try {
            assets.open("$BUNDLED_MODEL_DIRECTORY/$name").use { input ->
                FileOutputStream(staging, false).use { output -> input.copyTo(output, COPY_BUFFER_BYTES) }
            }
            if (!hasGgufMagic(staging)) {
                throw InvalidModelFile(name)
            }
            if (target.exists() && !target.delete()) {
                throw IOException("cannot replace the bundled model copy $name")
            }
            if (!staging.renameTo(target)) {
                throw IOException("cannot place the bundled model $name")
            }
        } catch (failure: Throwable) {
            staging.delete()
            throw failure
        }
    }

    private fun describe(file: File): JSONObject = JSONObject()
        .put("file_name", file.name)
        .put("size_bytes", file.length())
        .put("installed_at", Instant.ofEpochMilli(file.lastModified()).toString())
        .put("bundled", false)

    private fun describeBundled(name: String, size: Long): JSONObject = JSONObject()
        .put("file_name", name)
        .put("size_bytes", size)
        .put("installed_at", Instant.ofEpochMilli(bundledAt).toString())
        .put("bundled", true)

    private fun readDocumentIdentity(resolver: ContentResolver, uri: Uri): Pair<String, Long> {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                val name = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                val size = if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) cursor.getLong(sizeIndex) else 0L
                if (!name.isNullOrBlank()) {
                    return name to size
                }
            }
        }
        throw IOException("the chosen document has no display name: $uri")
    }

    private fun hasGgufMagic(file: File): Boolean {
        RandomAccessFile(file, "r").use { stream ->
            val header = ByteArray(GGUF_MAGIC.size)
            return stream.read(header) == header.size && header.contentEquals(GGUF_MAGIC)
        }
    }

    private fun startsWithGgufMagic(buffer: ByteArray): Boolean =
        buffer.copyOfRange(0, GGUF_MAGIC.size).contentEquals(GGUF_MAGIC)

    class InvalidModelFile(fileName: String) : IOException(fileName)

    companion object {
        private const val MODEL_FILE_EXTENSION = ".gguf"
        private const val BUNDLED_MODEL_DIRECTORY = "models"
        private const val COPY_BUFFER_BYTES = 1024 * 1024
        private val GGUF_MAGIC = byteArrayOf(0x47, 0x47, 0x55, 0x46)

        fun isModelFileName(fileName: String): Boolean =
            fileName.endsWith(MODEL_FILE_EXTENSION, ignoreCase = true) && fileName.length > MODEL_FILE_EXTENSION.length

        fun requireModelFileName(fileName: String): String {
            val candidate = fileName.trim()
            if (!isModelFileName(candidate) || candidate.contains('/') || candidate.contains('\\') || candidate.startsWith('.')) {
                throw InvalidModelFile(fileName)
            }
            return candidate
        }
    }
}
