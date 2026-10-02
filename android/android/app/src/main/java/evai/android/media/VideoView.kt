package evai.android.media

import android.content.Context
import android.graphics.Matrix
import android.graphics.SurfaceTexture
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.TextureView
import java.io.IOException
import kotlin.math.max
import kotlin.math.min

class VideoView(context: Context, private val events: VideoEvents) : TextureView(context), TextureView.SurfaceTextureListener {
    interface VideoEvents {
        fun onReady(view: VideoView, durationSeconds: Double)
        fun onProgress(view: VideoView, positionSeconds: Double, durationSeconds: Double)
        fun onEnd(view: VideoView, completed: Boolean)
        fun onError(view: VideoView, message: String)
    }

    private var player: MediaPlayer? = null
    private var surface: Surface? = null
    private var source = ""
    private var paused = false
    private var muted = false
    private var loop = false
    private var contain = true
    private var prepared = false
    private var videoWidth = 0
    private var videoHeight = 0
    private var pendingSeekMilliseconds: Int? = null
    private val progressHandler = Handler(Looper.getMainLooper())
    private val progressTick = Runnable { reportProgress() }

    init {
        surfaceTextureListener = this
        isOpaque = false
    }

    fun setSource(value: String?) {
        val next = value.orEmpty()
        if (next == source) {
            return
        }
        source = next
        pendingSeekMilliseconds = null
        openPlayer()
    }

    fun setPaused(value: Boolean) {
        paused = value
        applyPlayback()
    }

    fun setMuted(value: Boolean) {
        muted = value
        applyVolume()
    }

    fun setLoop(value: Boolean) {
        loop = value
        player?.isLooping = value
    }

    fun setContain(value: Boolean) {
        contain = value
        applyTransform()
    }

    fun seekTo(seconds: Double) {
        val target = (seconds * MILLISECONDS_PER_SECOND).toInt().coerceAtLeast(0)
        val active = player
        if (active == null || !prepared) {
            pendingSeekMilliseconds = target
            return
        }
        active.seekTo(target)
    }

    fun release() {
        releasePlayer()
        surface?.release()
        surface = null
    }

    override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) {
        surface = Surface(texture)
        openPlayer()
    }

    override fun onSurfaceTextureSizeChanged(texture: SurfaceTexture, width: Int, height: Int) {
        applyTransform()
    }

    override fun onSurfaceTextureDestroyed(texture: SurfaceTexture): Boolean {
        releasePlayer()
        surface?.release()
        surface = null
        return true
    }

    override fun onSurfaceTextureUpdated(texture: SurfaceTexture) = Unit

    private fun openPlayer() {
        releasePlayer()
        val target = surface ?: return
        if (source.isEmpty()) {
            return
        }
        val created = MediaPlayer()
        player = created
        created.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE)
                .build(),
        )
        created.setSurface(target)
        created.isLooping = loop
        created.setOnVideoSizeChangedListener { _, width, height ->
            videoWidth = width
            videoHeight = height
            applyTransform()
        }
        created.setOnPreparedListener { ready ->
            if (player !== ready) {
                return@setOnPreparedListener
            }
            prepared = true
            pendingSeekMilliseconds?.let { milliseconds -> ready.seekTo(milliseconds) }
            pendingSeekMilliseconds = null
            applyVolume()
            applyPlayback()
            events.onReady(this, ready.duration / MILLISECONDS_PER_SECOND)
            reportProgress()
        }
        created.setOnSeekCompleteListener { seeked ->
            if (player === seeked) {
                reportProgress()
            }
        }
        created.setOnCompletionListener { finished ->
            if (player === finished && !finished.isLooping) {
                reportProgress()
                events.onEnd(this, true)
            }
        }
        created.setOnErrorListener { failed, what, extra ->
            if (player === failed) {
                releasePlayer()
                events.onError(this, "video error $what/$extra: $source")
            }
            true
        }
        try {
            created.setDataSource(context, Uri.parse(source))
            created.prepareAsync()
        } catch (failure: IOException) {
            releasePlayer()
            events.onError(this, failure.message ?: source)
        } catch (failure: IllegalStateException) {
            releasePlayer()
            events.onError(this, failure.message ?: source)
        }
    }

    private fun releasePlayer() {
        progressHandler.removeCallbacks(progressTick)
        player?.release()
        player = null
        prepared = false
    }

    private fun applyPlayback() {
        val active = player ?: return
        if (!prepared) {
            return
        }
        if (paused && active.isPlaying) {
            active.pause()
        } else if (!paused && !active.isPlaying) {
            active.start()
        }
        reportProgress()
    }

    private fun reportProgress() {
        progressHandler.removeCallbacks(progressTick)
        val active = player ?: return
        if (!prepared) {
            return
        }
        events.onProgress(this, active.currentPosition / MILLISECONDS_PER_SECOND, active.duration / MILLISECONDS_PER_SECOND)
        if (active.isPlaying) {
            progressHandler.postDelayed(progressTick, PROGRESS_INTERVAL_MILLISECONDS)
        }
    }

    private fun applyVolume() {
        val level = if (muted) 0f else 1f
        player?.setVolume(level, level)
    }

    private fun applyTransform() {
        if (videoWidth == 0 || videoHeight == 0 || width == 0 || height == 0) {
            return
        }
        val viewWidth = width.toFloat()
        val viewHeight = height.toFloat()
        val scaleToWidth = viewWidth / videoWidth
        val scaleToHeight = viewHeight / videoHeight
        val scale = if (contain) min(scaleToWidth, scaleToHeight) else max(scaleToWidth, scaleToHeight)
        val matrix = Matrix()
        matrix.setScale(videoWidth * scale / viewWidth, videoHeight * scale / viewHeight, viewWidth / 2f, viewHeight / 2f)
        setTransform(matrix)
        invalidate()
    }

    companion object {
        private const val MILLISECONDS_PER_SECOND = 1000.0
        private const val PROGRESS_INTERVAL_MILLISECONDS = 250L
    }
}
