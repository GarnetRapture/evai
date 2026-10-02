package evai.android.llm

object LlamaEngine {
    init {
        System.loadLibrary("evai_native")
    }

    external fun nativeLoad(modelPath: ByteArray, requestedContext: Int): ByteArray

    external fun nativeUnload()

    external fun nativeState(): ByteArray

    external fun nativeMeasure(roles: Array<String>, contents: Array<ByteArray>, addAssistant: Boolean): Int

    external fun nativePrefill(roles: Array<String>, contents: Array<ByteArray>): ByteArray

    external fun nativeGenerate(
        roles: Array<String>,
        contents: Array<ByteArray>,
        grammar: ByteArray,
        maxOutputTokens: Int,
        topK: Int,
        topP: Float,
        temperature: Float,
        seed: Long,
        sink: LlamaTextSink,
    ): ByteArray

    external fun nativeClearCancel()

    external fun nativeCancel()
}
