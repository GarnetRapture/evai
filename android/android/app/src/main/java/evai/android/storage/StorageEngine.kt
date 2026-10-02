package evai.android.storage

object StorageEngine {
    init {
        System.loadLibrary("evai_native")
    }

    external fun nativeOpen(databasePath: ByteArray): ByteArray

    external fun nativeReadDocument(request: ByteArray): ByteArray

    external fun nativeQueryEntries(request: ByteArray): ByteArray

    external fun nativeCountEntries(request: ByteArray): ByteArray

    external fun nativeCommitWrites(request: ByteArray): ByteArray

    external fun nativeRestoreSnapshot(request: ByteArray): ByteArray

    external fun nativeResetStorage(): ByteArray

    external fun nativeReadStatus(): ByteArray

    external fun nativeReadSchema(): ByteArray
}
