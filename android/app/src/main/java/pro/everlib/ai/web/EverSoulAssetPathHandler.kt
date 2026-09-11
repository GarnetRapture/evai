package pro.everlib.ai.web

import android.content.res.AssetManager
import android.net.Uri
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException
import pro.everlib.ai.AppConstants

class EverSoulAssetPathHandler(private val assets: AssetManager) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse {
        val assetPath = Uri.decode(path).trimStart('/').ifEmpty { AppConstants.APP_INDEX_FILE }
        return try {
            WebResourceResponse(mimeTypeOf(assetPath), null, 200, "OK", RESPONSE_HEADERS, assets.open(assetPath))
        } catch (error: FileNotFoundException) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", RESPONSE_HEADERS, ByteArrayInputStream(ByteArray(0)))
        }
    }

    private fun mimeTypeOf(assetPath: String): String {
        val extension = assetPath.substringAfterLast('.', "").lowercase()
        return MIME_TYPES[extension] ?: "application/octet-stream"
    }

    private companion object {
        val RESPONSE_HEADERS = mapOf(
            "Cross-Origin-Opener-Policy" to "same-origin",
            "Cross-Origin-Embedder-Policy" to "require-corp",
            "Cross-Origin-Resource-Policy" to "same-origin",
        )
        val MIME_TYPES = mapOf(
            "html" to "text/html",
            "js" to "text/javascript",
            "mjs" to "text/javascript",
            "css" to "text/css",
            "json" to "application/json",
            "wasm" to "application/wasm",
            "png" to "image/png",
            "jpg" to "image/jpeg",
            "jpeg" to "image/jpeg",
            "webp" to "image/webp",
            "gif" to "image/gif",
            "svg" to "image/svg+xml",
            "ico" to "image/x-icon",
            "woff2" to "font/woff2",
            "mp3" to "audio/mpeg",
            "ogg" to "audio/ogg",
        )
    }
}
