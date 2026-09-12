package pro.everlib.ai.llm

import org.json.JSONObject
import pro.everlib.ai.AppConstants
import pro.everlib.ai.bridge.BridgeException

enum class LocalMessageRole { USER, ASSISTANT }

data class LocalHistoryMessage(val role: LocalMessageRole, val content: String)

data class LocalSampling(val topK: Int, val topP: Double, val temperature: Double, val seed: Int)

data class LocalGenerationRequest(
    val systemPrompt: String?,
    val history: List<LocalHistoryMessage>,
    val userMessage: String,
    val responseSchema: String?,
    val maxOutputTokens: Int,
    val sampling: LocalSampling,
)

sealed interface LocalGenerationOutcome {
    data class Completed(val text: String, val tokenCount: Int?) : LocalGenerationOutcome
    data class Cancelled(val text: String) : LocalGenerationOutcome
    data class Failed(val error: Throwable) : LocalGenerationOutcome
}

object LocalGenerationPayloadParser {
    fun parse(payloadJson: String): LocalGenerationRequest {
        val payload = JSONObject(payloadJson)
        val messages = payload.getJSONArray("messages")
        if (messages.length() == 0) {
            throw BridgeException("native_runtime", "empty_generation_messages")
        }
        val last = messages.getJSONObject(messages.length() - 1)
        if (last.getString("role") != "user") {
            throw BridgeException("native_runtime", "last_generation_message_must_be_user")
        }
        val history = (0 until messages.length() - 1).map { index ->
            val message = messages.getJSONObject(index)
            LocalHistoryMessage(
                role = if (message.getString("role") == "assistant") LocalMessageRole.ASSISTANT else LocalMessageRole.USER,
                content = message.getString("content"),
            )
        }
        val sampling = payload.getJSONObject("sampling")
        return LocalGenerationRequest(
            systemPrompt = payload.optString("system_prompt").takeIf { it.isNotEmpty() },
            history = history,
            userMessage = last.getString("content"),
            responseSchema = if (payload.isNull("response_schema")) null else payload.getString("response_schema"),
            maxOutputTokens = payload.optInt("max_output_tokens", AppConstants.LITERT_LM_DEFAULT_MAX_OUTPUT_TOKENS),
            sampling = LocalSampling(
                topK = sampling.getInt("top_k"),
                topP = sampling.getDouble("top_p"),
                temperature = sampling.getDouble("temperature"),
                seed = sampling.getInt("seed"),
            ),
        )
    }
}
