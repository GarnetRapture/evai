package pro.everlib.ai.files

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.edit
import androidx.documentfile.provider.DocumentFile
import pro.everlib.ai.AppConstants
import pro.everlib.ai.bridge.BridgeException

data class BackupDirectoryState(val linked: Boolean, val name: String?, val writable: Boolean)

data class BackupDirectoryEntry(val name: String, val sizeBytes: Long, val modifiedAtMillis: Long)

class BackupDirectoryStore(private val context: Context) {
    private val preferences = context.getSharedPreferences(AppConstants.PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val permissionFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION

    fun link(treeUri: Uri) {
        linkedTreeUri()?.let { releasePermission(it) }
        context.contentResolver.takePersistableUriPermission(treeUri, permissionFlags)
        preferences.edit { putString(AppConstants.BACKUP_TREE_URI_KEY, treeUri.toString()) }
    }

    fun unlink() {
        linkedTreeUri()?.let { releasePermission(it) }
        preferences.edit { remove(AppConstants.BACKUP_TREE_URI_KEY) }
    }

    fun state(): BackupDirectoryState {
        val treeUri = linkedTreeUri() ?: return BackupDirectoryState(linked = false, name = null, writable = false)
        val directory = DocumentFile.fromTreeUri(context, treeUri)
        val writable = hasPersistedWritePermission(treeUri) && directory?.canWrite() == true
        return BackupDirectoryState(linked = true, name = directory?.name ?: treeUri.lastPathSegment, writable = writable)
    }

    fun write(fileName: String, content: String) {
        val directory = requireDirectory()
        val file = directory.findFile(fileName) ?: directory.createFile(AppConstants.BACKUP_FILE_MIME_TYPE, fileName)
            ?: throw BridgeException("storage", fileName)
        context.contentResolver.openOutputStream(file.uri, "wt")?.use { output ->
            output.write(content.toByteArray(Charsets.UTF_8))
        } ?: throw BridgeException("storage", fileName)
    }

    fun read(fileName: String): String {
        val file = requireDirectory().findFile(fileName) ?: throw BridgeException("not_found", fileName)
        return context.contentResolver.openInputStream(file.uri)?.use { input ->
            input.readBytes().toString(Charsets.UTF_8)
        } ?: throw BridgeException("storage", fileName)
    }

    fun list(): List<BackupDirectoryEntry> =
        requireDirectory().listFiles()
            .filter { it.isFile && it.name != null }
            .map { BackupDirectoryEntry(it.name.orEmpty(), it.length(), it.lastModified()) }
            .sortedByDescending { it.modifiedAtMillis }

    fun remove(fileName: String) {
        val file = requireDirectory().findFile(fileName) ?: return
        if (!file.delete()) {
            throw BridgeException("storage", fileName)
        }
    }

    private fun requireDirectory(): DocumentFile {
        val treeUri = linkedTreeUri() ?: throw BridgeException("not_found", AppConstants.BACKUP_TREE_URI_KEY)
        if (!hasPersistedWritePermission(treeUri)) {
            throw BridgeException("storage", treeUri.toString())
        }
        return DocumentFile.fromTreeUri(context, treeUri) ?: throw BridgeException("storage", treeUri.toString())
    }

    private fun linkedTreeUri(): Uri? = preferences.getString(AppConstants.BACKUP_TREE_URI_KEY, null)?.let(Uri::parse)

    private fun hasPersistedWritePermission(treeUri: Uri): Boolean =
        context.contentResolver.persistedUriPermissions.any { it.uri == treeUri && it.isWritePermission && it.isReadPermission }

    private fun releasePermission(treeUri: Uri) {
        if (context.contentResolver.persistedUriPermissions.any { it.uri == treeUri }) {
            context.contentResolver.releasePersistableUriPermission(treeUri, permissionFlags)
        }
    }
}
