package evai.android.files

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.provider.DocumentsContract
import java.io.FileNotFoundException
import java.io.IOException
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

class BackupDirectory(context: Context) {
    private val resolver: ContentResolver = context.contentResolver
    private val preferences: SharedPreferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun link(treeUri: Uri): JSONObject {
        resolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        val previous = linkedTree()
        if (previous != null && previous != treeUri) {
            releasePermission(previous)
        }
        preferences.edit().putString(TREE_URI_KEY, treeUri.toString()).apply()
        return state()
    }

    fun unlink() {
        linkedTree()?.let(::releasePermission)
        preferences.edit().remove(TREE_URI_KEY).apply()
    }

    fun state(): JSONObject {
        val tree = linkedTree() ?: return JSONObject().put("linked", false).put("name", JSONObject.NULL).put("writable", false)
        return JSONObject()
            .put("linked", true)
            .put("name", directoryName(tree) ?: tree.lastPathSegment ?: tree.toString())
            .put("writable", writable(tree))
    }

    fun list(): JSONArray {
        val tree = requireWritableTree()
        val entries = children(tree)
            .filter { child -> child.mimeType != DocumentsContract.Document.MIME_TYPE_DIR }
            .sortedByDescending { child -> child.modifiedAt }
        return JSONArray(entries.map { child ->
            JSONObject()
                .put("name", child.name)
                .put("size_bytes", child.sizeBytes)
                .put("modified_at", Instant.ofEpochMilli(child.modifiedAt).toString())
        })
    }

    fun write(fileName: String, content: String) {
        val tree = requireWritableTree()
        val existing = children(tree).firstOrNull { child -> child.name == fileName }
        val target = existing?.uri ?: DocumentsContract.createDocument(resolver, directoryUri(tree), BACKUP_MIME_TYPE, fileName)
            ?: throw IOException("cannot create $fileName")
        resolver.openOutputStream(target, TRUNCATE_WRITE_MODE)?.use { output ->
            output.write(content.toByteArray(Charsets.UTF_8))
        } ?: throw IOException("cannot write $fileName")
    }

    fun read(fileName: String): String {
        val tree = requireWritableTree()
        val child = children(tree).firstOrNull { entry -> entry.name == fileName } ?: throw FileNotFoundException(fileName)
        return resolver.openInputStream(child.uri)?.use { input -> input.readBytes().toString(Charsets.UTF_8) }
            ?: throw IOException("cannot read $fileName")
    }

    fun remove(fileName: String) {
        val tree = requireWritableTree()
        val child = children(tree).firstOrNull { entry -> entry.name == fileName } ?: throw FileNotFoundException(fileName)
        if (!DocumentsContract.deleteDocument(resolver, child.uri)) {
            throw IOException("cannot remove $fileName")
        }
    }

    private fun linkedTree(): Uri? = preferences.getString(TREE_URI_KEY, null)?.let(Uri::parse)

    private fun requireWritableTree(): Uri {
        val tree = linkedTree() ?: throw FileNotFoundException(TREE_URI_KEY)
        if (!writable(tree)) {
            throw IOException("backup folder permission is missing: ${directoryName(tree) ?: tree}")
        }
        return tree
    }

    private fun writable(tree: Uri): Boolean =
        resolver.persistedUriPermissions.any { permission -> permission.uri == tree && permission.isWritePermission && permission.isReadPermission } &&
            directoryName(tree) != null

    private fun releasePermission(tree: Uri) {
        if (resolver.persistedUriPermissions.any { permission -> permission.uri == tree }) {
            resolver.releasePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
    }

    private fun directoryUri(tree: Uri): Uri =
        DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))

    private fun directoryName(tree: Uri): String? = try {
        resolver.query(directoryUri(tree), arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    } catch (failure: SecurityException) {
        null
    } catch (failure: IllegalArgumentException) {
        null
    }

    private fun children(tree: Uri): List<DocumentEntry> {
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val columns = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        )
        val entries = mutableListOf<DocumentEntry>()
        resolver.query(childrenUri, columns, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                entries += DocumentEntry(
                    uri = DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0)),
                    name = cursor.getString(1),
                    sizeBytes = if (cursor.isNull(2)) 0L else cursor.getLong(2),
                    modifiedAt = if (cursor.isNull(3)) 0L else cursor.getLong(3),
                    mimeType = cursor.getString(4) ?: "",
                )
            }
        } ?: throw IOException("cannot list ${directoryName(tree) ?: tree}")
        return entries
    }

    private data class DocumentEntry(val uri: Uri, val name: String, val sizeBytes: Long, val modifiedAt: Long, val mimeType: String)

    companion object {
        private const val PREFERENCES_NAME = "evai.files"
        private const val TREE_URI_KEY = "backup_directory"
        private const val BACKUP_MIME_TYPE = "application/json"
        private const val TRUNCATE_WRITE_MODE = "wt"
    }
}
