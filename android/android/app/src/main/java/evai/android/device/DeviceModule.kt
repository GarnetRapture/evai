package evai.android.device

import android.app.ActivityManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.LocaleList
import android.os.StatFs
import android.view.Window
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableArray
import com.facebook.react.interfaces.ExtraWindowEventListener
import evai.android.BuildConfig
import evai.android.specs.NativeEvaiDeviceSpec
import java.security.SecureRandom
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

class DeviceModule(context: ReactApplicationContext) : NativeEvaiDeviceSpec(context) {
    private val random = SecureRandom()
    private val insetsObserver: (WindowInsetsTracker.Insets) -> Unit = ::emitWindowInsets
    private val extraWindowListener = object : ExtraWindowEventListener {
        override fun onExtraWindowCreate(window: Window) {
            WindowInsetsTracker.track(window)
        }

        override fun onExtraWindowDestroy(window: Window) {
            WindowInsetsTracker.untrack(window)
        }
    }

    init {
        WindowInsetsTracker.observe(insetsObserver)
        context.addExtraWindowEventListener(extraWindowListener)
    }

    override fun readEnvironment(promise: Promise) {
        val activityManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memory = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memory)
        val storage = StatFs(reactApplicationContext.filesDir.absolutePath)
        val environment = JSONObject()
            .put("manufacturer", Build.MANUFACTURER)
            .put("model", Build.MODEL)
            .put("device", Build.DEVICE)
            .put("android_release", Build.VERSION.RELEASE)
            .put("sdk_int", Build.VERSION.SDK_INT)
            .put("abis", JSONArray(Build.SUPPORTED_ABIS.toList()))
            .put("soc_manufacturer", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MANUFACTURER else Build.HARDWARE)
            .put("soc_model", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MODEL else Build.BOARD)
            .put("cpu_cores", Runtime.getRuntime().availableProcessors())
            .put("memory_total_bytes", memory.totalMem)
            .put("memory_available_bytes", memory.availMem)
            .put("low_memory", memory.lowMemory)
            .put("storage_total_bytes", storage.totalBytes)
            .put("storage_available_bytes", storage.availableBytes)
            .put("app_version", BuildConfig.VERSION_NAME)
            .put("locales", JSONArray(localeTags()))
        promise.resolve(environment.toString())
    }

    override fun readLocales(): WritableArray {
        val tags = Arguments.createArray()
        localeTags().forEach(tags::pushString)
        return tags
    }

    override fun createUuid(): String = UUID.randomUUID().toString()

    override fun randomSeed(limit: Double): Double = random.nextInt(limit.toInt().coerceAtLeast(1)).toDouble()

    override fun restartApplication(reason: String) {
        UiThreadUtil.runOnUiThread {
            (reactApplicationContext.applicationContext as ReactApplication).reactHost?.reload(reason)
        }
    }

    override fun readWindowInsets(): String = WindowInsetsTracker.current.toJson()

    override fun copyText(text: String) {
        val clipboard = reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(CLIP_LABEL, text))
    }

    override fun invalidate() {
        reactApplicationContext.removeExtraWindowEventListener(extraWindowListener)
        WindowInsetsTracker.release(insetsObserver)
        super.invalidate()
    }

    private fun emitWindowInsets(insets: WindowInsetsTracker.Insets) {
        val event = Arguments.createMap()
        event.putDouble("top", insets.top)
        event.putDouble("bottom", insets.bottom)
        event.putDouble("left", insets.left)
        event.putDouble("right", insets.right)
        event.putDouble("ime", insets.ime)
        reactApplicationContext.emitDeviceEvent(WINDOW_INSETS_EVENT, event)
    }

    private fun localeTags(): List<String> {
        val locales = LocaleList.getDefault()
        return (0 until locales.size()).map { index -> locales[index].toLanguageTag() }
    }

    companion object {
        private const val WINDOW_INSETS_EVENT = "EvaiWindowInsets"
        private const val CLIP_LABEL = "EverSoul AI Chat"
    }
}
