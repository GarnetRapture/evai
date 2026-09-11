package pro.everlib.ai.files

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns

data class DocumentMetadata(val displayName: String, val sizeBytes: Long?)

fun ContentResolver.readDocumentMetadata(uri: Uri): DocumentMetadata? {
    query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) {
            return null
        }
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        val displayName = if (nameIndex >= 0) cursor.getString(nameIndex) else null
        val sizeBytes = if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) cursor.getLong(sizeIndex) else null
        return displayName?.let { DocumentMetadata(it, sizeBytes) }
    }
    return null
}
