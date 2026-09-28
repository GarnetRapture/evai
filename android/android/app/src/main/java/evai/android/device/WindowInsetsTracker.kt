package evai.android.device

import android.app.Activity
import android.view.View
import android.view.ViewGroup
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

    @Volatile
    var current: Insets = Insets(0.0, 0.0, 0.0, 0.0, 0.0)
        private set

    @Volatile
    private var observer: ((Insets) -> Unit)? = null

    fun attach(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        val probe = View(activity)
        val density = activity.resources.displayMetrics.density
        ViewCompat.setOnApplyWindowInsetsListener(probe) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            publish(
                Insets(
                    top = (bars.top / density).toDouble(),
                    bottom = (bars.bottom / density).toDouble(),
                    left = (bars.left / density).toDouble(),
                    right = (bars.right / density).toDouble(),
                    ime = (ime.bottom / density).toDouble(),
                ),
            )
            insets
        }
        content.addView(probe, 0, ViewGroup.LayoutParams(0, 0))
        ViewCompat.requestApplyInsets(probe)
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
