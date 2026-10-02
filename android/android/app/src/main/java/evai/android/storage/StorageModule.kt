package evai.android.storage

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import evai.android.specs.NativeEvaiStorageSpec
import java.io.File
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future

class StorageModule(context: ReactApplicationContext) : NativeEvaiStorageSpec(context) {
    private val executor: ExecutorService = Executors.newFixedThreadPool(STORAGE_THREADS)
    private val opened: Future<ByteArray> = executor.submit<ByteArray> {
        StorageEngine.nativeOpen(databaseFile(context).path.toByteArray(Charsets.UTF_8))
    }

    override fun readDocument(request: String, promise: Promise) = run(promise) {
        StorageEngine.nativeReadDocument(request.toByteArray(Charsets.UTF_8))
    }

    override fun queryEntries(request: String, promise: Promise) = run(promise) {
        StorageEngine.nativeQueryEntries(request.toByteArray(Charsets.UTF_8))
    }

    override fun countEntries(request: String, promise: Promise) = run(promise) {
        StorageEngine.nativeCountEntries(request.toByteArray(Charsets.UTF_8))
    }

    override fun commitWrites(request: String, promise: Promise) = run(promise) {
        StorageEngine.nativeCommitWrites(request.toByteArray(Charsets.UTF_8))
    }

    override fun restoreSnapshot(request: String, promise: Promise) = run(promise) {
        StorageEngine.nativeRestoreSnapshot(request.toByteArray(Charsets.UTF_8))
    }

    override fun resetStorage(promise: Promise) = run(promise) {
        StorageEngine.nativeResetStorage()
    }

    override fun readStatus(promise: Promise) = run(promise) {
        StorageEngine.nativeReadStatus()
    }

    override fun readSchema(promise: Promise) = run(promise) {
        StorageEngine.nativeReadSchema()
    }

    override fun invalidate() {
        executor.shutdown()
        super.invalidate()
    }

    private fun run(promise: Promise, operation: () -> ByteArray) {
        executor.execute {
            try {
                opened.get()
                promise.resolve(String(operation(), Charsets.UTF_8))
            } catch (failure: StorageException) {
                promise.reject(failure.error, failure.detail, failure)
            } catch (failure: ExecutionException) {
                promise.reject(OPEN_FAILED_CODE, failure.cause?.message ?: OPEN_FAILED_CODE, failure.cause ?: failure)
            } catch (failure: StorageFailure) {
                promise.reject(STORAGE_ERROR_CODE, failure.message ?: STORAGE_ERROR_CODE, failure)
            }
        }
    }

    companion object {
        private const val STORAGE_THREADS = 4
        private const val DATABASE_DIRECTORY_NAME = "evai-database"
        private const val DATABASE_FILE_NAME = "evai.sqlite3"
        private const val OPEN_FAILED_CODE = "storage_open_failed"
        private const val STORAGE_ERROR_CODE = "storage_error"

        fun databaseFile(context: ReactApplicationContext): File =
            File(File(context.filesDir, DATABASE_DIRECTORY_NAME), DATABASE_FILE_NAME)
    }
}
