package dev.codeagent.llm

import kotlinx.coroutines.flow.StateFlow

sealed interface EngineState {
    data object NotLoaded : EngineState
    data class Loading(val detail: String) : EngineState
    data class Ready(val backend: String, val modelName: String) : EngineState
    data class Error(val message: String) : EngineState
}

/**
 * @param maxTokens total context window (input + output). 4B-class models on
 *   MediaPipe are happiest at 8–16K; more eats RAM and prefill time.
 * @param outputReserve tokens kept free for the reply when trimming history.
 */
data class EngineConfig(
    val preferGpu: Boolean = true,
    val maxTokens: Int = 8192,
    val temperature: Float = 0.6f,
    val topK: Int = 40,
    val topP: Float = 0.95f,
    val outputReserve: Int = 1536,
)

data class GenerationStats(
    val generating: Boolean = false,
    val tokens: Int = 0,
    val elapsedMs: Long = 0,
) {
    val tokensPerSecond: Float
        get() = if (elapsedMs > 0) tokens * 1000f / elapsedMs else 0f
}

interface InferenceEngine {
    val state: StateFlow<EngineState>
    val stats: StateFlow<GenerationStats>

    /** Loads a model from an absolute file path. Safe to call repeatedly. */
    suspend fun load(modelPath: String, config: EngineConfig)

    /**
     * Streams a completion for [prompt]. Exactly one of [onComplete]/[onError]
     * fires at the end. Callbacks arrive on a background thread.
     */
    fun generate(
        prompt: String,
        onPartial: (String) -> Unit,
        onComplete: (String) -> Unit,
        onError: (Throwable) -> Unit,
    )

    /** Best-effort cancel of an in-flight generation. */
    fun stopGeneration()

    /**
     * Cheap heuristic (~4 chars/token for code+English). We deliberately avoid
     * the tokenizer API here so estimation can run on the UI path before a
     * model is even loaded.
     */
    fun estimateTokens(text: String): Int = text.length / 4 + 1

    fun unload()
}
