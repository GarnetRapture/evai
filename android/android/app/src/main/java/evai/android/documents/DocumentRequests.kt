package evai.android.documents

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class DocumentRequests(private val context: ReactApplicationContext) : BaseActivityEventListener() {
    private val pending = ConcurrentHashMap<Int, (Int, Intent?) -> Unit>()

    init {
        context.addActivityEventListener(this)
    }

    fun launch(intent: Intent, onFailure: (Throwable) -> Unit, onResult: (Int, Intent?) -> Unit) {
        UiThreadUtil.runOnUiThread {
            val activity = context.currentActivity
            if (activity == null) {
                onFailure(IllegalStateException(NO_ACTIVITY_MESSAGE))
                return@runOnUiThread
            }
            val requestCode = nextRequestCode()
            pending[requestCode] = onResult
            try {
                activity.startActivityForResult(intent, requestCode)
            } catch (failure: RuntimeException) {
                pending.remove(requestCode)
                onFailure(failure)
            }
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        pending.remove(requestCode)?.invoke(resultCode, data)
    }

    fun dispose() {
        context.removeActivityEventListener(this)
        pending.clear()
    }

    companion object {
        private const val REQUEST_CODE_BASE = 0x4E00
        private const val REQUEST_CODE_SPAN = 0x100
        private const val NO_ACTIVITY_MESSAGE = "no foreground activity"
        private val sequence = AtomicInteger(0)

        private fun nextRequestCode(): Int = REQUEST_CODE_BASE + Math.floorMod(sequence.getAndIncrement(), REQUEST_CODE_SPAN)
    }
}
