package pro.everlib.ai

object AppConstants {
    const val APP_ASSET_DOMAIN = "appassets.androidplatform.net"
    const val APP_START_URL = "https://$APP_ASSET_DOMAIN/index.html"
    const val APP_INDEX_FILE = "index.html"
    const val BRIDGE_NAME = "EverSoulAndroid"
    const val BRIDGE_RECEIVER = "__everSoulAndroidReceive"
    const val MODEL_DIRECTORY = "litertlm-models"
    const val MODEL_FILE_EXTENSION = ".litertlm"
    const val MODEL_PARTIAL_SUFFIX = ".partial"
    const val PREFERENCES_NAME = "eversoul-android"
    const val BACKUP_TREE_URI_KEY = "backup_tree_uri"
    const val BACKUP_FILE_MIME_TYPE = "application/json"
    const val COPY_BUFFER_BYTES = 1024 * 1024
    const val MODEL_IMPORT_PROGRESS_STEP_BYTES = 8L * 1024 * 1024
    const val LITERT_LM_MAX_NUM_TOKENS = 4096
    const val LITERT_LM_DEFAULT_MAX_OUTPUT_TOKENS = 1024
    const val MODEL_DOWNLOAD_TIMEOUT_MS = 30000
    const val MODEL_DOWNLOAD_MAX_REDIRECTS = 5
    const val MODEL_DOWNLOAD_USER_AGENT = "EverSoulAIChat/1.0 (Android; LiteRT-LM)"
}
