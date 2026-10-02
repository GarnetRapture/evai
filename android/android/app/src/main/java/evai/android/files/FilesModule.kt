package evai.android.files

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import evai.android.documents.DocumentRequests
import evai.android.specs.NativeEvaiFilesSpec
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONObject

class FilesModule(context: ReactApplicationContext) : NativeEvaiFilesSpec(context) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val documents = DocumentRequests(context)
    private val backupDirectory = BackupDirectory(context)

    override fun openDocument(mimeTypes: ReadableArray, promise: Promise) {
        val types = Array(mimeTypes.size()) { index -> mimeTypes.getString(index) ?: ANY_DOCUMENT_TYPE }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(ANY_DOCUMENT_TYPE)
        if (types.isNotEmpty()) {
            intent.putExtra(Intent.EXTRA_MIME_TYPES, types)
        }
        documents.launch(intent, { failure -> reject(promise, failure) }) { resultCode, data ->
            val uri: Uri? = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.resolve(cancelledResult().toString())
                return@launch
            }
            run(promise) {
                val (name, size) = readIdentity(uri)
                JSONObject().put("cancelled", false).put("name", name).put("uri", uri.toString()).put("size_bytes", size).toString()
            }
        }
    }

    override fun readDocumentText(uri: String, promise: Promise) = run(promise) {
        readBytes(Uri.parse(uri)).toString(Charsets.UTF_8)
    }

    override fun readDocumentBase64(uri: String, promise: Promise) = run(promise) {
        Base64.encodeToString(readBytes(Uri.parse(uri)), Base64.NO_WRAP)
    }

    override fun saveDocument(suggestedName: String, mimeType: String, content: String, promise: Promise) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mimeType)
            .putExtra(Intent.EXTRA_TITLE, suggestedName)
        documents.launch(intent, { failure -> reject(promise, failure) }) { resultCode, data ->
            val uri: Uri? = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.resolve(cancelledResult().toString())
                return@launch
            }
            run(promise) {
                reactApplicationContext.contentResolver.openOutputStream(uri, TRUNCATE_WRITE_MODE)?.use { output ->
                    output.write(content.toByteArray(Charsets.UTF_8))
                } ?: throw IOException("cannot write $suggestedName")
                JSONObject().put("cancelled", false).put("name", readIdentity(uri).first).toString()
            }
        }
    }

    override fun linkBackupDirectory(promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        documents.launch(intent, { failure -> reject(promise, failure) }) { resultCode, data ->
            val uri: Uri? = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                promise.resolve(cancelledResult().toString())
                return@launch
            }
            run(promise) {
                backupDirectory.link(uri).put("cancelled", false).toString()
            }
        }
    }

    override fun unlinkBackupDirectory(promise: Promise) = run(promise) {
        backupDirectory.unlink()
        null
    }

    override fun readBackupDirectoryState(promise: Promise) = run(promise) {
        backupDirectory.state().toString()
    }

    override fun listBackupFiles(promise: Promise) = run(promise) {
        backupDirectory.list().toString()
    }

    override fun writeBackupFile(fileName: String, content: String, promise: Promise) = run(promise) {
        backupDirectory.write(fileName, content)
        null
    }

    override fun readBackupFile(fileName: String, promise: Promise) = run(promise) {
        backupDirectory.read(fileName)
    }

    override fun removeBackupFile(fileName: String, promise: Promise) = run(promise) {
        backupDirectory.remove(fileName)
        null
    }

    override fun invalidate() {
        documents.dispose()
        executor.shutdown()
        super.invalidate()
    }

    private fun run(promise: Promise, operation: () -> String?) {
        executor.execute {
            try {
                promise.resolve(operation())
            } catch (failure: Exception) {
                reject(promise, failure)
            }
        }
    }

    private fun reject(promise: Promise, failure: Throwable) {
        val code = when (failure) {
            is FileNotFoundException -> NOT_FOUND_CODE
            else -> STORAGE_CODE
        }
        promise.reject(code, failure.message ?: code, failure)
    }

    private fun readBytes(uri: Uri): ByteArray =
        reactApplicationContext.contentResolver.openInputStream(uri)?.use { input -> input.readBytes() }
            ?: throw FileNotFoundException(uri.toString())

    private fun readIdentity(uri: Uri): Pair<String, Long> {
        reactApplicationContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val name = cursor.getString(0) ?: uri.lastPathSegment ?: uri.toString()
                val size = if (cursor.isNull(1)) 0L else cursor.getLong(1)
                return name to size
            }
        }
        return (uri.lastPathSegment ?: uri.toString()) to 0L
    }

    private fun cancelledResult(): JSONObject = JSONObject().put("cancelled", true)

    companion object {
        private const val ANY_DOCUMENT_TYPE = "*/*"
        private const val TRUNCATE_WRITE_MODE = "wt"
        private const val NOT_FOUND_CODE = "not_found"
        private const val STORAGE_CODE = "storage"
    }
}
