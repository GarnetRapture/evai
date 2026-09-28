package evai.android.graphics

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import kotlin.math.min
import org.json.JSONArray
import org.json.JSONObject

class VectorView(context: Context) : View(context) {
    private class VectorShape(val path: Path, val fill: Paint?, val stroke: Paint?)

    private var shapes: List<VectorShape> = emptyList()
    private var viewBoxX = 0f
    private var viewBoxY = 0f
    private var viewBoxWidth = DEFAULT_VIEW_BOX
    private var viewBoxHeight = DEFAULT_VIEW_BOX

    fun setShapes(value: String?) {
        shapes = if (value.isNullOrEmpty()) emptyList() else parseShapes(JSONArray(value))
        invalidate()
    }

    fun setViewBox(x: Float, y: Float, width: Float, height: Float) {
        viewBoxX = x
        viewBoxY = y
        viewBoxWidth = if (width > 0f) width else DEFAULT_VIEW_BOX
        viewBoxHeight = if (height > 0f) height else DEFAULT_VIEW_BOX
        invalidate()
    }

    fun setViewBoxX(value: Float) = setViewBox(value, viewBoxY, viewBoxWidth, viewBoxHeight)

    fun setViewBoxY(value: Float) = setViewBox(viewBoxX, value, viewBoxWidth, viewBoxHeight)

    fun setViewBoxWidth(value: Float) = setViewBox(viewBoxX, viewBoxY, value, viewBoxHeight)

    fun setViewBoxHeight(value: Float) = setViewBox(viewBoxX, viewBoxY, viewBoxWidth, value)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (shapes.isEmpty() || width == 0 || height == 0) {
            return
        }
        val scale = min(width / viewBoxWidth, height / viewBoxHeight)
        val offsetX = (width - viewBoxWidth * scale) / 2f
        val offsetY = (height - viewBoxHeight * scale) / 2f
        val saved = canvas.save()
        canvas.translate(offsetX, offsetY)
        canvas.scale(scale, scale)
        canvas.translate(-viewBoxX, -viewBoxY)
        for (shape in shapes) {
            shape.fill?.let { paint -> canvas.drawPath(shape.path, paint) }
            shape.stroke?.let { paint -> canvas.drawPath(shape.path, paint) }
        }
        canvas.restoreToCount(saved)
    }

    private fun parseShapes(array: JSONArray): List<VectorShape> = (0 until array.length()).map { index ->
        val shape = array.getJSONObject(index)
        val path = SvgPathParser(shape.getString("d")).parse()
        val opacity = shape.optDouble("opacity", 1.0).toFloat().coerceIn(0f, 1f)
        VectorShape(path, fillPaint(shape, opacity), strokePaint(shape, opacity))
    }

    private fun fillPaint(shape: JSONObject, opacity: Float): Paint? {
        val color = shape.optString("fill", "")
        if (color.isEmpty() || color == NONE) {
            return null
        }
        return Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            this.color = withOpacity(Color.parseColor(color), opacity)
        }
    }

    private fun strokePaint(shape: JSONObject, opacity: Float): Paint? {
        val color = shape.optString("stroke", "")
        if (color.isEmpty() || color == NONE) {
            return null
        }
        return Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            this.color = withOpacity(Color.parseColor(color), opacity)
            strokeWidth = shape.optDouble("strokeWidth", 1.0).toFloat()
            strokeCap = when (shape.optString("cap", "round")) {
                "butt" -> Paint.Cap.BUTT
                "square" -> Paint.Cap.SQUARE
                else -> Paint.Cap.ROUND
            }
            strokeJoin = when (shape.optString("join", "round")) {
                "miter" -> Paint.Join.MITER
                "bevel" -> Paint.Join.BEVEL
                else -> Paint.Join.ROUND
            }
            shape.optJSONArray("dash")?.let { dash ->
                if (dash.length() >= 2) {
                    pathEffect = DashPathEffect(FloatArray(dash.length()) { item -> dash.getDouble(item).toFloat() }, 0f)
                }
            }
        }
    }

    private fun withOpacity(color: Int, opacity: Float): Int =
        Color.argb((Color.alpha(color) * opacity).toInt(), Color.red(color), Color.green(color), Color.blue(color))

    companion object {
        private const val DEFAULT_VIEW_BOX = 24f
        private const val NONE = "none"
    }
}
