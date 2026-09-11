package pro.everlib.ai.files

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DocumentRequestCoordinator(activity: ComponentActivity) {
    private var pendingOpenDocument: CompletableDeferred<Uri?>? = null
    private var pendingCreateDocument: CompletableDeferred<Uri?>? = null
    private var pendingOpenTree: CompletableDeferred<Uri?>? = null

    private val openDocumentLauncher = activity.registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        pendingOpenDocument?.complete(uri)
        pendingOpenDocument = null
    }

    private val createDocumentLauncher = activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        pendingCreateDocument?.complete(if (result.resultCode == Activity.RESULT_OK) result.data?.data else null)
        pendingCreateDocument = null
    }

    private val openTreeLauncher = activity.registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        pendingOpenTree?.complete(uri)
        pendingOpenTree = null
    }

    suspend fun openDocument(mimeTypes: Array<String>): Uri? = withContext(Dispatchers.Main) {
        pendingOpenDocument?.complete(null)
        val request = CompletableDeferred<Uri?>()
        pendingOpenDocument = request
        openDocumentLauncher.launch(mimeTypes)
        request.await()
    }

    suspend fun createDocument(suggestedName: String, mimeType: String): Uri? = withContext(Dispatchers.Main) {
        pendingCreateDocument?.complete(null)
        val request = CompletableDeferred<Uri?>()
        pendingCreateDocument = request
        createDocumentLauncher.launch(
            Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mimeType)
                .putExtra(Intent.EXTRA_TITLE, suggestedName),
        )
        request.await()
    }

    suspend fun openDocumentTree(): Uri? = withContext(Dispatchers.Main) {
        pendingOpenTree?.complete(null)
        val request = CompletableDeferred<Uri?>()
        pendingOpenTree = request
        openTreeLauncher.launch(null)
        request.await()
    }
}
