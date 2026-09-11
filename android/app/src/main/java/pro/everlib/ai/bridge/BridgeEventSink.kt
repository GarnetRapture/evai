package pro.everlib.ai.bridge

import android.webkit.WebView
import org.json.JSONObject
import pro.everlib.ai.AppConstants

class BridgeEventSink(private val webView: WebView) {
    fun emit(requestId: String, type: String, fields: JSONObject = JSONObject()) {
        fields.put("request_id", requestId)
        fields.put("type", type)
        val script = "window.${AppConstants.BRIDGE_RECEIVER} && window.${AppConstants.BRIDGE_RECEIVER}(${JSONObject.quote(fields.toString())})"
        webView.post { webView.evaluateJavascript(script, null) }
    }

    fun emitError(requestId: String, error: Throwable) {
        val fields = JSONObject()
        if (error is BridgeException) {
            fields.put("code", error.code)
            fields.put("detail", error.detail)
        } else {
            fields.put("code", "native_runtime")
            fields.put("detail", error.message ?: error.javaClass.simpleName)
        }
        emit(requestId, "error", fields)
    }
}
