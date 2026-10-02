package evai.android.device

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject

object WindowInsetsTracker {
    data class Insets(val top: Double, val bottom: Double, val left: Double, val right: Double, val ime: Double) {
        fun toJson(): String = JSONObject()
            .put("top", top)
            .put("bottom", bottom)
            .put("left", left)
            .put("right", right)
            .put("ime", ime)
            .toString()
    }

    private class TrackedWindow(val window: Window, var insets: Insets)

    private val emptyInsets = Insets(0.0, 0.0, 0.0, 0.0, 0.0)
    private val windows = ArrayList<TrackedWindow>()

    @Volatile
    var current: Insets = emptyInsets
        private set

    @Volatile
    private var observer: ((Insets) -> Unit)? = null

    fun attach(activity: Activity) {
        track(activity.window)
    }

    fun track(window: Window) {
        val content = checkNotNull(window.decorView.findViewById<ViewGroup>(android.R.id.content)) {
            "window has no content view to observe insets"
        }
        windows.removeAll { entry -> entry.window === window }
        val tracked = TrackedWindow(window, if (windows.isEmpty()) emptyInsets else windows.last().insets)
        windows.add(tracked)
        val probe = View(window.context)
        val density = window.context.resources.displayMetrics.density
        ViewCompat.setOnApplyWindowInsetsListener(probe) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            tracked.insets = Insets(
                top = (bars.top / density).toDouble(),
                bottom = (bars.bottom / density).toDouble(),
                left = (bars.left / density).toDouble(),
                right = (bars.right / density).toDouble(),
                ime = (ime.bottom / density).toDouble(),
            )
            if (windows.lastOrNull() === tracked) {
                publish(tracked.insets)
            }
            insets
        }
        content.addView(probe, 0, ViewGroup.LayoutParams(0, 0))
        ViewCompat.requestApplyInsets(probe)
        publish(tracked.insets)
    }

    fun untrack(window: Window) {
        windows.removeAll { entry -> entry.window === window }
        publish(windows.lastOrNull()?.insets ?: emptyInsets)
    }

    fun observe(callback: (Insets) -> Unit) {
        observer = callback
    }

    fun release(callback: (Insets) -> Unit) {
        if (observer === callback) {
            observer = null
        }
    }

    private fun publish(next: Insets) {
        if (next == current) {
            return
        }
        current = next
        observer?.invoke(next)
    }
}
