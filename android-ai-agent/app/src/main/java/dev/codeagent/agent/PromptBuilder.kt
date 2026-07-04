package dev.codeagent.agent

import dev.codeagent.llm.EngineConfig
import dev.codeagent.ui.ChatMessage
import dev.codeagent.ui.Role

object PromptBuilder {

    data class Result(
        val prompt: String,
        /** true when older turns were dropped to fit the context window */
        val trimmed: Boolean,
        val estimatedTokens: Int,
    )

    fun estimateTokens(text: String): Int = text.length / 4 + 1

    /**
     * Builds a plain-text transcript prompt from chat history, dropping the
     * oldest turns first when the estimate exceeds the input budget
     * (maxTokens - outputReserve). Plain "### User / ### Assistant" markers are
     * used instead of a model-specific chat template so the same prompt works
     * across Gemma/Qwen-style instruction-tuned bundles.
     */
    fun build(history: List<ChatMessage>, config: EngineConfig): Result {
        val budget = config.maxTokens - config.outputReserve - estimateTokens(Prompts.SYSTEM)

        val included = ArrayDeque<ChatMessage>()
        var used = 0
        for (message in history.asReversed()) {
            val cost = estimateTokens(message.content) + 8 // role marker overhead
            if (used + cost > budget && included.isNotEmpty()) break
            included.addFirst(message)
            used += cost
        }

        val sb = StringBuilder()
        sb.append(Prompts.SYSTEM).append("\n\n")
        for (message in included) {
            sb.append(if (message.role == Role.USER) "### User:\n" else "### Assistant:\n")
            sb.append(message.content.trim()).append("\n\n")
        }
        sb.append("### Assistant:\n")

        return Result(
            prompt = sb.toString(),
            trimmed = included.size < history.size,
            estimatedTokens = used,
        )
    }
}
