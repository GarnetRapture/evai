package evai.android.media

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.facebook.react.viewmanagers.EvaiVideoViewManagerDelegate
import com.facebook.react.viewmanagers.EvaiVideoViewManagerInterface

@ReactModule(name = VideoViewManager.NAME)
class VideoViewManager : SimpleViewManager<VideoView>(), EvaiVideoViewManagerInterface<VideoView>, VideoView.VideoEvents {
    private class VideoEvent(surfaceId: Int, viewId: Int, private val name: String, private val payload: WritableMap) :
        Event<VideoEvent>(surfaceId, viewId) {
        override fun getEventName(): String = name

        override fun getEventData(): WritableMap = payload
    }

    private val delegate: ViewManagerDelegate<VideoView> = EvaiVideoViewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<VideoView> = delegate

    override fun getName(): String = NAME

    override fun createViewInstance(context: ThemedReactContext): VideoView = VideoView(context, this)

    override fun onDropViewInstance(view: VideoView) {
        view.release()
        super.onDropViewInstance(view)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
        READY_EVENT to mapOf("registrationName" to "onVideoReady"),
        END_EVENT to mapOf("registrationName" to "onVideoEnd"),
        ERROR_EVENT to mapOf("registrationName" to "onVideoError"),
    )

    @ReactProp(name = "source")
    override fun setSource(view: VideoView, value: String?) {
        view.setSource(value)
    }

    @ReactProp(name = "paused")
    override fun setPaused(view: VideoView, value: Boolean) {
        view.setPaused(value)
    }

    @ReactProp(name = "muted")
    override fun setMuted(view: VideoView, value: Boolean) {
        view.setMuted(value)
    }

    @ReactProp(name = "loop")
    override fun setLoop(view: VideoView, value: Boolean) {
        view.setLoop(value)
    }

    @ReactProp(name = "contain")
    override fun setContain(view: VideoView, value: Boolean) {
        view.setContain(value)
    }

    override fun onReady(view: VideoView, durationSeconds: Double) {
        dispatch(view, READY_EVENT, Arguments.createMap().apply { putDouble("duration", durationSeconds) })
    }

    override fun onEnd(view: VideoView, completed: Boolean) {
        dispatch(view, END_EVENT, Arguments.createMap().apply { putBoolean("completed", completed) })
    }

    override fun onError(view: VideoView, message: String) {
        dispatch(view, ERROR_EVENT, Arguments.createMap().apply { putString("message", message) })
    }

    private fun dispatch(view: VideoView, name: String, payload: WritableMap) {
        val context = view.context as ReactContext
        val surfaceId = UIManagerHelper.getSurfaceId(context)
        UIManagerHelper.getEventDispatcherForReactTag(context, view.id)?.dispatchEvent(VideoEvent(surfaceId, view.id, name, payload))
    }

    companion object {
        const val NAME = "EvaiVideoView"
        private const val READY_EVENT = "topVideoReady"
        private const val END_EVENT = "topVideoEnd"
        private const val ERROR_EVENT = "topVideoError"
    }
}
