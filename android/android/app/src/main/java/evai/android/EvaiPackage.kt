package evai.android

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import evai.android.assets.AssetsModule
import evai.android.device.DeviceModule
import evai.android.files.FilesModule
import evai.android.graphics.PatternViewManager
import evai.android.graphics.VectorViewManager
import evai.android.llm.LlmModule
import evai.android.media.AudioModule
import evai.android.media.VideoViewManager
import evai.android.preferences.PreferencesModule
import evai.android.specs.NativeEvaiAssetsSpec
import evai.android.specs.NativeEvaiAudioSpec
import evai.android.specs.NativeEvaiDeviceSpec
import evai.android.specs.NativeEvaiFilesSpec
import evai.android.specs.NativeEvaiLlmSpec
import evai.android.specs.NativeEvaiPreferencesSpec
import evai.android.specs.NativeEvaiStorageSpec
import evai.android.storage.StorageModule

class EvaiPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? = when (name) {
        NativeEvaiStorageSpec.NAME -> StorageModule(reactContext)
        NativeEvaiLlmSpec.NAME -> LlmModule(reactContext)
        NativeEvaiFilesSpec.NAME -> FilesModule(reactContext)
        NativeEvaiAssetsSpec.NAME -> AssetsModule(reactContext)
        NativeEvaiAudioSpec.NAME -> AudioModule(reactContext)
        NativeEvaiDeviceSpec.NAME -> DeviceModule(reactContext)
        NativeEvaiPreferencesSpec.NAME -> PreferencesModule(reactContext)
        else -> null
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        MODULE_NAMES.associateWith { name -> ReactModuleInfo(name, name, false, false, false, true) }
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(VectorViewManager(), VideoViewManager(), PatternViewManager())

    companion object {
        private val MODULE_NAMES = listOf(
            NativeEvaiStorageSpec.NAME,
            NativeEvaiLlmSpec.NAME,
            NativeEvaiFilesSpec.NAME,
            NativeEvaiAssetsSpec.NAME,
            NativeEvaiAudioSpec.NAME,
            NativeEvaiDeviceSpec.NAME,
            NativeEvaiPreferencesSpec.NAME,
        )
    }
}
