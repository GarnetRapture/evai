package evai.android.graphics

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.EvaiVectorViewManagerDelegate
import com.facebook.react.viewmanagers.EvaiVectorViewManagerInterface

@ReactModule(name = VectorViewManager.NAME)
class VectorViewManager : SimpleViewManager<VectorView>(), EvaiVectorViewManagerInterface<VectorView> {
    private val delegate: ViewManagerDelegate<VectorView> = EvaiVectorViewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<VectorView> = delegate

    override fun getName(): String = NAME

    override fun createViewInstance(context: ThemedReactContext): VectorView = VectorView(context)

    @ReactProp(name = "shapes")
    override fun setShapes(view: VectorView, value: String?) {
        view.setShapes(value)
    }

    @ReactProp(name = "viewBoxX")
    override fun setViewBoxX(view: VectorView, value: Float) {
        view.setViewBoxX(value)
    }

    @ReactProp(name = "viewBoxY")
    override fun setViewBoxY(view: VectorView, value: Float) {
        view.setViewBoxY(value)
    }

    @ReactProp(name = "viewBoxWidth")
    override fun setViewBoxWidth(view: VectorView, value: Float) {
        view.setViewBoxWidth(value)
    }

    @ReactProp(name = "viewBoxHeight")
    override fun setViewBoxHeight(view: VectorView, value: Float) {
        view.setViewBoxHeight(value)
    }

    companion object {
        const val NAME = "EvaiVectorView"
    }
}
