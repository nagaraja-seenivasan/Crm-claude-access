package dev.codeagent.llm

import android.content.Context
import android.os.SystemClock
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * MediaPipe LLM Inference (LiteRT) backend.
 *
 * Backend selection: we ask for GPU (Adreno 750 on the ROG Phone 8 Pro) and fall
 * back to CPU if GPU init fails. MediaPipe does not currently expose a Hexagon
 * NPU delegate for LLM inference on Snapdragon — see README "Honest limitations".
 */
class MediaPipeEngine(private val context: Context) : InferenceEngine {

    private val _state = MutableStateFlow<EngineState>(EngineState.NotLoaded)
    override val state: StateFlow<EngineState> = _state.asStateFlow()

    private val _stats = MutableStateFlow(GenerationStats())
    override val stats: StateFlow<GenerationStats> = _stats.asStateFlow()

    private var llm: LlmInference? = null
    private var session: LlmInferenceSession? = null
    private var config = EngineConfig()
    private val generating = AtomicBoolean(false)

    override suspend fun load(modelPath: String, config: EngineConfig) = withContext(Dispatchers.IO) {
        this@MediaPipeEngine.config = config
        unload()
        val modelName = File(modelPath).name
        val firstBackend = if (config.preferGpu) "GPU" else "CPU"
        _state.value = EngineState.Loading("Loading $modelName on $firstBackend…")
        try {
            llm = createInference(modelPath, config.preferGpu)
            _state.value = EngineState.Ready(firstBackend, modelName)
        } catch (t: Throwable) {
            if (config.preferGpu) {
                _state.value = EngineState.Loading("GPU init failed, retrying on CPU…")
                try {
                    llm = createInference(modelPath, preferGpu = false)
                    _state.value = EngineState.Ready("CPU (GPU unavailable)", modelName)
                } catch (t2: Throwable) {
                    _state.value = EngineState.Error(t2.message ?: "Failed to load model")
                }
            } else {
                _state.value = EngineState.Error(t.message ?: "Failed to load model")
            }
        }
    }

    private fun createInference(modelPath: String, preferGpu: Boolean): LlmInference {
        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelPath)
            .setMaxTokens(config.maxTokens)
            .setPreferredBackend(if (preferGpu) LlmInference.Backend.GPU else LlmInference.Backend.CPU)
            .build()
        return LlmInference.createFromOptions(context, options)
    }

    override fun generate(
        prompt: String,
        onPartial: (String) -> Unit,
        onComplete: (String) -> Unit,
        onError: (Throwable) -> Unit,
    ) {
        val inference = llm ?: run {
            onError(IllegalStateException("No model loaded"))
            return
        }
        if (!generating.compareAndSet(false, true)) {
            onError(IllegalStateException("A generation is already running"))
            return
        }

        try {
            // Fresh session per request: conversation history lives in the prompt
            // we build ourselves (see PromptBuilder), so there is no hidden KV
            // state drifting out of sync with what the UI shows.
            session?.close()
            session = LlmInferenceSession.createFromOptions(
                inference,
                LlmInferenceSession.LlmInferenceSessionOptions.builder()
                    .setTemperature(config.temperature)
                    .setTopK(config.topK)
                    .setTopP(config.topP)
                    .build()
            )

            val output = StringBuilder()
            val startedAt = SystemClock.elapsedRealtime()
            var tokenCount = 0
            _stats.value = GenerationStats(generating = true)

            session!!.addQueryChunk(prompt)
            session!!.generateResponseAsync { partial, done ->
                output.append(partial)
                // MediaPipe streams roughly one token per callback, so callback
                // count is a good-enough tokens/sec approximation.
                tokenCount++
                _stats.value = GenerationStats(
                    generating = !done,
                    tokens = tokenCount,
                    elapsedMs = SystemClock.elapsedRealtime() - startedAt,
                )
                onPartial(partial)
                if (done) {
                    generating.set(false)
                    onComplete(output.toString())
                }
            }
        } catch (t: Throwable) {
            generating.set(false)
            _stats.value = _stats.value.copy(generating = false)
            onError(t)
        }
    }

    override fun stopGeneration() {
        if (!generating.get()) return
        runCatching { session?.cancelGenerateResponseAsync() }
        generating.set(false)
        _stats.value = _stats.value.copy(generating = false)
    }

    override fun unload() {
        stopGeneration()
        runCatching { session?.close() }
        runCatching { llm?.close() }
        session = null
        llm = null
        _state.value = EngineState.NotLoaded
    }
}
