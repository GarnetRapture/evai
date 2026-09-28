package evai.android.media

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import evai.android.specs.NativeEvaiAudioSpec
import java.io.IOException

class AudioModule(context: ReactApplicationContext) : NativeEvaiAudioSpec(context) {
    private class AudioChannel(val player: MediaPlayer, var pending: Promise?)

    private val mainHandler = Handler(Looper.getMainLooper())
    private val channels = HashMap<String, AudioChannel>()

    override fun play(channel: String, uri: String, loop: Boolean, volume: Double, promise: Promise) {
        mainHandler.post {
            release(channel)
            val player = MediaPlayer()
            val entry = AudioChannel(player, promise)
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            player.isLooping = loop
            val level = volume.toFloat().coerceIn(0f, 1f)
            player.setVolume(level, level)
            player.setOnPreparedListener { prepared ->
                if (channels[channel] !== entry) {
                    return@setOnPreparedListener
                }
                prepared.start()
                entry.pending?.resolve(null)
                entry.pending = null
            }
            player.setOnCompletionListener { completed ->
                if (channels[channel] === entry && !completed.isLooping) {
                    emit(ENDED_EVENT, channel, null)
                }
            }
            player.setOnErrorListener { _, what, extra ->
                val message = "media error $what/$extra: $uri"
                val pending = entry.pending
                entry.pending = null
                if (channels[channel] === entry) {
                    channels.remove(channel)
                }
                player.release()
                if (pending != null) {
                    pending.reject(MEDIA_CODE, message)
                } else {
                    emit(ERROR_EVENT, channel, message)
                }
                true
            }
            channels[channel] = entry
            try {
                player.setDataSource(reactApplicationContext, Uri.parse(uri))
                player.prepareAsync()
            } catch (failure: IOException) {
                fail(channel, entry, failure)
            } catch (failure: IllegalStateException) {
                fail(channel, entry, failure)
            }
        }
    }

    override fun pause(channel: String) {
        mainHandler.post {
            channels[channel]?.player?.takeIf { player -> player.isPlaying }?.pause()
        }
    }

    override fun resume(channel: String) {
        mainHandler.post {
            val entry = channels[channel] ?: return@post
            if (entry.pending == null && !entry.player.isPlaying) {
                entry.player.start()
            }
        }
    }

    override fun stop(channel: String) {
        mainHandler.post {
            release(channel)
        }
    }

    override fun setVolume(channel: String, volume: Double) {
        mainHandler.post {
            val level = volume.toFloat().coerceIn(0f, 1f)
            channels[channel]?.player?.setVolume(level, level)
        }
    }

    override fun invalidate() {
        mainHandler.post {
            channels.keys.toList().forEach(::release)
        }
        super.invalidate()
    }

    private fun fail(channel: String, entry: AudioChannel, failure: Exception) {
        channels.remove(channel)
        entry.player.release()
        entry.pending?.reject(MEDIA_CODE, failure.message ?: channel, failure)
        entry.pending = null
    }

    private fun release(channel: String) {
        val entry = channels.remove(channel) ?: return
        entry.player.release()
        entry.pending?.resolve(null)
        entry.pending = null
    }

    private fun emit(eventName: String, channel: String, message: String?) {
        val event = Arguments.createMap()
        event.putString("channel", channel)
        if (message != null) {
            event.putString("message", message)
        }
        reactApplicationContext.emitDeviceEvent(eventName, event)
    }

    companion object {
        private const val ENDED_EVENT = "EvaiAudioEnded"
        private const val ERROR_EVENT = "EvaiAudioError"
        private const val MEDIA_CODE = "media"
    }
}
