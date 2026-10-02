package evai.android.graphics

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.LruCache
import android.view.View
import java.io.IOException
import java.util.concurrent.Executors

class PatternView(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val shaderMatrix = Matrix()
    private var source = ""
    private var tileWidth = 0f
    private var tileHeight = 0f
    private var bitmap: Bitmap? = null

    fun setSource(value: String?) {
        val next = value.orEmpty()
        if (next == source) {
            return
        }
        source = next
        applyBitmap(null)
        if (next.isEmpty()) {
            return
        }
        PatternBitmaps.load(context.contentResolver, next) { loaded ->
            if (source == next) {
                applyBitmap(loaded)
            }
        }
    }

    fun setTileWidth(value: Float) {
        tileWidth = value
        applyTile()
    }

    fun setTileHeight(value: Float) {
        tileHeight = value
        applyTile()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (paint.shader == null || width == 0 || height == 0) {
            return
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
    }

    private fun applyBitmap(loaded: Bitmap?) {
        bitmap = loaded
        paint.shader = loaded?.let { image -> BitmapShader(image, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT) }
        applyTile()
    }

    private fun applyTile() {
        val image = bitmap
        val shader = paint.shader
        if (image != null && shader != null) {
            val density = resources.displayMetrics.density
            val naturalWidth = image.width.toFloat()
            val naturalHeight = image.height.toFloat()
            val tilePixelsWidth = when {
                tileWidth > 0f -> tileWidth * density
                tileHeight > 0f -> tileHeight * density * naturalWidth / naturalHeight
                else -> naturalWidth * density
            }
            val tilePixelsHeight = when {
                tileHeight > 0f -> tileHeight * density
                else -> tilePixelsWidth * naturalHeight / naturalWidth
            }
            shaderMatrix.setScale(tilePixelsWidth / naturalWidth, tilePixelsHeight / naturalHeight)
            shader.setLocalMatrix(shaderMatrix)
        }
        invalidate()
    }

    private object PatternBitmaps {
        private const val TAG = "EvaiPatternView"
        private const val CACHE_BYTES = 16 * 1024 * 1024

        private val cache = object : LruCache<String, Bitmap>(CACHE_BYTES) {
            override fun sizeOf(key: String, value: Bitmap): Int = value.byteCount
        }
        private val pending = HashMap<String, MutableList<(Bitmap) -> Unit>>()
        private val decoder = Executors.newSingleThreadExecutor()
        private val main = Handler(Looper.getMainLooper())

        fun load(resolver: ContentResolver, source: String, callback: (Bitmap) -> Unit) {
            val cached = cache.get(source)
            if (cached != null) {
                callback(cached)
                return
            }
            val waiting = pending[source]
            if (waiting != null) {
                waiting.add(callback)
                return
            }
            pending[source] = mutableListOf(callback)
            decoder.execute {
                val decoded = try {
                    Result.success(decode(resolver, source))
                } catch (failure: IOException) {
                    Result.failure(failure)
                }
                main.post { finish(source, decoded) }
            }
        }

        private fun decode(resolver: ContentResolver, source: String): Bitmap {
            val stream = resolver.openInputStream(Uri.parse(source)) ?: throw IOException("pattern source unavailable: $source")
            return stream.use { input -> BitmapFactory.decodeStream(input) } ?: throw IOException("pattern image undecodable: $source")
        }

        private fun finish(source: String, decoded: Result<Bitmap>) {
            val callbacks = pending.remove(source).orEmpty()
            decoded.onSuccess { loaded ->
                cache.put(source, loaded)
                callbacks.forEach { callback -> callback(loaded) }
            }
            decoded.onFailure { failure -> Log.e(TAG, "pattern load failed: $source", failure) }
        }
    }
}
