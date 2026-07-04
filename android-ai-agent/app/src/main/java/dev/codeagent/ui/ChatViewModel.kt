package dev.codeagent.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import dev.codeagent.App
import dev.codeagent.agent.ProjectParser
import dev.codeagent.agent.PromptBuilder
import dev.codeagent.agent.Prompts
import dev.codeagent.data.FileEntry
import dev.codeagent.data.ProjectInfo
import dev.codeagent.llm.EngineConfig
import dev.codeagent.llm.EngineState
import dev.codeagent.util.ThermalMonitor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class Role { USER, ASSISTANT }

data class ChatMessage(
    val role: Role,
    val content: String,
    val streaming: Boolean = false,
    /** relative paths saved to the project, when this reply produced files */
    val savedFiles: List<String> = emptyList(),
    val savedProject: String? = null,
)

class ChatViewModel(app: Application) : AndroidViewModel(app) {

    private val engine = (app as App).engine
    private val models = (app as App).models
    private val projects = (app as App).projects

    val engineState = engine.state
    val stats = engine.stats

    val thermalStatus = ThermalMonitor.statusFlow(app)
        .stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages = _messages.asStateFlow()

    private val _config = MutableStateFlow(EngineConfig())
    val config = _config.asStateFlow()

    private val _contextTrimmed = MutableStateFlow(false)
    val contextTrimmed = _contextTrimmed.asStateFlow()

    /** 0..1 while a model file is being copied in, null otherwise */
    private val _importProgress = MutableStateFlow<Float?>(null)
    val importProgress = _importProgress.asStateFlow()

    private val _events = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val events = _events.asSharedFlow()

    init {
        // Auto-load a previously imported model on launch.
        models.activeModelPath?.let { loadModel(it) }

        // Thermal guard: hard-stop generation before the SoC melts down.
        viewModelScope.launch {
            thermalStatus.collect { status ->
                if (ThermalMonitor.shouldStopGeneration(status) && stats.value.generating) {
                    engine.stopGeneration()
                    _events.tryEmit("Generation stopped: device thermal status is ${ThermalMonitor.label(status)}")
                }
            }
        }
    }

    // ---- model management ----

    fun importModel(uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            _importProgress.value = 0f
            try {
                val file = models.import(uri) { _importProgress.value = it }
                _importProgress.value = null
                _events.tryEmit("Imported ${file.name}")
                loadModel(file.absolutePath)
            } catch (t: Throwable) {
                _importProgress.value = null
                _events.tryEmit("Import failed: ${t.message}")
            }
        }
    }

    fun loadModel(path: String) {
        models.activeModelPath = path
        viewModelScope.launch { engine.load(path, _config.value) }
    }

    fun availableModels() = models.listModels()

    fun updateConfig(config: EngineConfig) {
        _config.value = config
        // Context size / backend changes require a reload.
        models.activeModelPath?.let { path ->
            if (engineState.value is EngineState.Ready) loadModel(path)
        }
    }

    // ---- chat ----

    fun send(text: String, projectMode: Boolean, projectName: String) {
        if (text.isBlank()) return
        if (engineState.value !is EngineState.Ready) {
            _events.tryEmit("Load a model first (Import model)")
            return
        }
        if (stats.value.generating) return

        val userVisible = text.trim()
        val userForModel =
            if (projectMode) userVisible + Prompts.PROJECT_INSTRUCTION else userVisible

        _messages.value += ChatMessage(Role.USER, userVisible)

        // Build the prompt with the model-facing variant of the last message.
        val historyForPrompt = _messages.value.dropLast(1) +
            ChatMessage(Role.USER, userForModel)
        val built = PromptBuilder.build(historyForPrompt, _config.value)
        _contextTrimmed.value = built.trimmed

        _messages.value += ChatMessage(Role.ASSISTANT, "", streaming = true)

        engine.generate(
            prompt = built.prompt,
            onPartial = { chunk ->
                updateLastAssistant { it.copy(content = it.content + chunk) }
            },
            onComplete = { full ->
                if (projectMode) {
                    saveGeneratedFiles(full, projectName)
                } else {
                    updateLastAssistant { it.copy(streaming = false) }
                }
            },
            onError = { t ->
                updateLastAssistant {
                    it.copy(streaming = false, content = it.content + "\n\n⚠️ ${t.message}")
                }
            },
        )
    }

    fun stopGeneration() {
        engine.stopGeneration()
        updateLastAssistant { it.copy(streaming = false) }
    }

    fun clearChat() {
        if (stats.value.generating) engine.stopGeneration()
        _messages.value = emptyList()
        _contextTrimmed.value = false
    }

    fun defaultProjectName(): String =
        "project-" + SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date())

    private fun saveGeneratedFiles(output: String, projectName: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val name = projectName.ifBlank { defaultProjectName() }
            val files = ProjectParser.parseLoose(output)
            val saved = files.filter { projects.writeFile(name, it.path, it.content) }
            updateLastAssistant {
                it.copy(
                    streaming = false,
                    savedFiles = saved.map { f -> f.path },
                    savedProject = if (saved.isEmpty()) null else name,
                )
            }
            _events.tryEmit(
                if (saved.isEmpty()) "No file blocks found in the reply — nothing saved"
                else "Saved ${saved.size} file(s) to project \"$name\""
            )
        }
    }

    private fun updateLastAssistant(transform: (ChatMessage) -> ChatMessage) {
        _messages.value = _messages.value.toMutableList().also { list ->
            val idx = list.indexOfLast { it.role == Role.ASSISTANT }
            if (idx >= 0) list[idx] = transform(list[idx])
        }
    }

    // ---- file browser passthroughs ----

    fun listProjects(): List<ProjectInfo> = projects.listProjects()
    fun listFiles(project: String): List<FileEntry> = projects.listFiles(project)
    fun readFile(project: String, path: String): String? = projects.readFile(project, path)
    fun saveFile(project: String, path: String, content: String) {
        if (projects.writeFile(project, path, content)) _events.tryEmit("Saved $path")
        else _events.tryEmit("Could not save $path")
    }

    fun deleteProject(project: String) {
        projects.deleteProject(project)
        _events.tryEmit("Deleted project \"$project\"")
    }

    fun exportProject(project: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val n = projects.exportProjectToDownloads(project)
            _events.tryEmit("Exported $n file(s) to Downloads/CodeAgent/$project")
        }
    }

    fun exportFile(project: String, path: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val ok = projects.exportFileToDownloads(project, path)
            _events.tryEmit(if (ok) "Exported to Downloads/CodeAgent/$project" else "Export failed")
        }
    }

    fun shareUri(project: String, path: String): Uri? = projects.shareUri(project, path)
}
