package evai.android.assets

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import evai.android.specs.NativeEvaiAssetsSpec
import java.io.FileNotFoundException
import java.util.Collections
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class AssetsModule(context: ReactApplicationContext) : NativeEvaiAssetsSpec(context) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val networkExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val downloadExecutor: ExecutorService = Executors.newFixedThreadPool(DOWNLOAD_THREADS)
    private val library = AssetLibrary(context.filesDir, context.assets, AssetSource.read(context.assets))
    private val cancelledFetches: MutableSet<String> = Collections.synchronizedSet(HashSet())

    override fun readAssetRoot(): String = "file://${reactApplicationContext.filesDir.absolutePath}"

    override fun readDatasetFile(path: String, promise: Promise) = run(promise) {
        reactApplicationContext.assets.open(datasetPath(path)).use { input -> input.readBytes().toString(Charsets.UTF_8) }
    }

    override fun listDatasetFiles(directory: String, promise: Promise) = run(promise) {
        JSONArray(reactApplicationContext.assets.list(datasetPath(directory)).orEmpty().sorted()).toString()
    }

    override fun readAssetText(path: String, promise: Promise) = run(promise) {
        library.readText(path)
    }

    override fun readAssetState(voice: String, promise: Promise) = run(promise, networkExecutor) {
        library.seedBundledList()
        val listError = if (library.configured) library.refreshAssetList() else ""
        JSONObject()
            .put("source_configured", library.configured)
            .put("satisfied", library.manifestSatisfied(voice))
            .put("list_error", listError)
            .toString()
    }

    override fun fetchAssets(requestId: String, voice: String, promise: Promise) = run(promise, networkExecutor) {
        try {
            library.seedBundledList()
            val plan = library.plan(voice)
            if (plan.error.isNotEmpty()) {
                return@run outcome(plan, AssetLibrary.AssetOutcome(0, plan.pending.size, 0, plan.error), false).toString()
            }
            val result = library.fetch(plan, downloadExecutor, { cancelledFetches.contains(requestId) }) { progress ->
                val event = Arguments.createMap()
                event.putString("request_id", requestId)
                event.putInt("completed", progress.completed)
                event.putInt("total", progress.total)
                event.putDouble("bytes", progress.bytes.toDouble())
                event.putDouble("total_bytes", progress.totalBytes.toDouble())
                event.putString("current", progress.current)
                reactApplicationContext.emitDeviceEvent(PROGRESS_EVENT, event)
            }
            if (result.failed == 0 && result.error.isEmpty()) {
                library.storeManifest(voice)
            }
            outcome(plan, result, cancelledFetches.contains(requestId)).toString()
        } finally {
            cancelledFetches.remove(requestId)
        }
    }

    override fun cancelFetch(requestId: String) {
        cancelledFetches.add(requestId)
    }

    override fun invalidate() {
        executor.shutdown()
        networkExecutor.shutdownNow()
        downloadExecutor.shutdownNow()
        super.invalidate()
    }

    private fun outcome(plan: AssetLibrary.AssetPlan, result: AssetLibrary.AssetOutcome, cancelled: Boolean): JSONObject = JSONObject()
        .put("present", plan.present)
        .put("relocated", plan.relocated)
        .put("downloaded", result.downloaded)
        .put("failed", result.failed)
        .put("bytes", result.bytes)
        .put("error", result.error)
        .put("cancelled", cancelled)

    private fun datasetPath(path: String): String {
        require(AssetLibrary.isSafeRelative(path) || path.isEmpty()) { "unsafe dataset path: $path" }
        return if (path.isEmpty()) DATASET_ASSET_ROOT else "$DATASET_ASSET_ROOT/$path"
    }

    private fun run(promise: Promise, target: ExecutorService = executor, operation: () -> String) {
        target.execute {
            try {
                promise.resolve(operation())
            } catch (failure: FileNotFoundException) {
                promise.reject(NOT_FOUND_CODE, failure.message ?: NOT_FOUND_CODE, failure)
            } catch (failure: Exception) {
                promise.reject(STORAGE_CODE, failure.message ?: STORAGE_CODE, failure)
            }
        }
    }

    companion object {
        private const val DOWNLOAD_THREADS = 16
        private const val DATASET_ASSET_ROOT = "dataset"
        private const val PROGRESS_EVENT = "EvaiAssetProgress"
        private const val NOT_FOUND_CODE = "not_found"
        private const val STORAGE_CODE = "storage"
    }
}
