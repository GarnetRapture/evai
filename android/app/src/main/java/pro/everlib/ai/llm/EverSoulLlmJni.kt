package pro.everlib.ai.llm

object EverSoulLlmJni {
    init {
        System.loadLibrary("eversoul_jni")
    }

    const val BACKEND_GPU: Int = 0
    const val BACKEND_CPU: Int = 1

    fun interface ChunkSink {
        fun onChunk(text: String)
    }

    external fun nativeLoad(modelPath: String, backend: Int, cacheDir: String): Long
    external fun nativeContextWindow(handle: Long): Int
    external fun nativeCancel(handle: Long)
    external fun nativeUnload(handle: Long)
    external fun nativeGenerate(
        handle: Long,
        systemPrompt: String,
        historyJson: String,
        userMessage: String,
        maxTokens: Int,
        chunkSink: ChunkSink,
    ): String
}
