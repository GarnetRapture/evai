package evai.android.graphics

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.EvaiPatternViewManagerDelegate
import com.facebook.react.viewmanagers.EvaiPatternViewManagerInterface

@ReactModule(name = PatternViewManager.NAME)
class PatternViewManager : SimpleViewManager<PatternView>(), EvaiPatternViewManagerInterface<PatternView> {
    private val delegate: ViewManagerDelegate<PatternView> = EvaiPatternViewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<PatternView> = delegate

    override fun getName(): String = NAME

    override fun createViewInstance(context: ThemedReactContext): PatternView = PatternView(context)

    @ReactProp(name = "source")
    override fun setSource(view: PatternView, value: String?) {
        view.setSource(value)
    }

    @ReactProp(name = "tileWidth")
    override fun setTileWidth(view: PatternView, value: Float) {
        view.setTileWidth(value)
    }

    @ReactProp(name = "tileHeight")
    override fun setTileHeight(view: PatternView, value: Float) {
        view.setTileHeight(value)
    }

    companion object {
        const val NAME = "EvaiPatternView"
    }
}
