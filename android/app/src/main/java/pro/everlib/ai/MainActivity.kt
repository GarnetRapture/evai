package pro.everlib.ai

import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import pro.everlib.ai.bridge.BridgeEventSink
import pro.everlib.ai.bridge.EverSoulAndroidBridge
import pro.everlib.ai.files.DocumentRequestCoordinator
import pro.everlib.ai.web.EverSoulAssetPathHandler
import pro.everlib.ai.web.EverSoulWebViewClient

class MainActivity : ComponentActivity() {
    private val documents = DocumentRequestCoordinator(this)
    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = pendingFileChooser ?: return@registerForActivityResult
        pendingFileChooser = null
        callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }
    private lateinit var webView: WebView
    private lateinit var bridge: EverSoulAndroidBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        bridge = EverSoulAndroidBridge(applicationContext, BridgeEventSink(webView), documents)
        webView.addJavascriptInterface(bridge, AppConstants.BRIDGE_NAME)
        onBackPressedDispatcher.addCallback(this) {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(AppConstants.APP_START_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        bridge.close()
        webView.destroy()
        super.onDestroy()
    }

    private fun configureWebView() {
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain(AppConstants.APP_ASSET_DOMAIN)
            .addPathHandler("/", EverSoulAssetPathHandler(assets))
            .build()
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
        }
        webView.webViewClient = EverSoulWebViewClient(assetLoader, ::openExternal)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                pendingFileChooser?.onReceiveValue(null)
                pendingFileChooser = filePathCallback
                return try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (error: ActivityNotFoundException) {
                    pendingFileChooser = null
                    filePathCallback.onReceiveValue(null)
                    true
                }
            }
        }
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (error: ActivityNotFoundException) {
            Toast.makeText(this, R.string.external_link_unavailable, Toast.LENGTH_LONG).show()
        }
    }
}
