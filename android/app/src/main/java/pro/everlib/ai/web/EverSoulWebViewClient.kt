package pro.everlib.ai.web

import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import pro.everlib.ai.AppConstants

class EverSoulWebViewClient(
    private val assetLoader: WebViewAssetLoader,
    private val openExternal: (Uri) -> Unit,
) : WebViewClientCompat() {
    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
        assetLoader.shouldInterceptRequest(request.url)

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (request.url.host == AppConstants.APP_ASSET_DOMAIN) {
            return false
        }
        openExternal(request.url)
        return true
    }
}
