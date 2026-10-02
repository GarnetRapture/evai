package evai.android.llm

fun interface LlamaTextSink {
    fun accept(chunk: ByteArray)
}
