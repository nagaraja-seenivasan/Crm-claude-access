package dev.codeagent.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import dev.codeagent.llm.EngineConfig
import dev.codeagent.llm.EngineState
import dev.codeagent.util.ThermalMonitor
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(vm: ChatViewModel) {
    val messages by vm.messages.collectAsState()
    val engineState by vm.engineState.collectAsState()
    val stats by vm.stats.collectAsState()
    val thermal by vm.thermalStatus.collectAsState()
    val contextTrimmed by vm.contextTrimmed.collectAsState()
    val importProgress by vm.importProgress.collectAsState()
    val config by vm.config.collectAsState()

    var input by remember { mutableStateOf("") }
    var projectMode by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var showProjectNameDialog by remember { mutableStateOf(false) }
    var projectName by remember { mutableStateOf("") }

    val listState = rememberLazyListState()
    LaunchedEffect(messages.size, (messages.lastOrNull()?.content?.length ?: 0) / 200) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    val pickModel = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let(vm::importModel) }

    fun doSend() {
        if (projectMode) {
            projectName = vm.defaultProjectName()
            showProjectNameDialog = true
        } else {
            vm.send(input, projectMode = false, projectName = "")
            input = ""
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("CodeAgent")
                        Text(
                            text = when (val s = engineState) {
                                is EngineState.NotLoaded -> "No model loaded"
                                is EngineState.Loading -> s.detail
                                is EngineState.Ready -> "${s.modelName} · ${s.backend}"
                                is EngineState.Error -> "Error: ${s.message}"
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        pickModel.launch(arrayOf("application/octet-stream", "*/*"))
                    }) {
                        Icon(Icons.Filled.Memory, contentDescription = "Import model")
                    }
                    IconButton(onClick = { vm.clearChat() }) {
                        Icon(Icons.Filled.DeleteSweep, contentDescription = "Clear chat")
                    }
                    IconButton(onClick = { showSettings = true }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Settings")
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {

            importProgress?.let { p ->
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Text("Importing model… ${(p * 100).roundToInt()}%",
                        style = MaterialTheme.typography.labelMedium)
                    LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth())
                }
            }

            if (ThermalMonitor.shouldWarn(thermal)) {
                Banner("Device is ${ThermalMonitor.label(thermal).lowercase()} — generation " +
                    "will auto-stop at severe throttling.")
            }
            if (contextTrimmed) {
                Banner("Context window full: oldest messages were dropped from the prompt. " +
                    "Consider clearing the chat.")
            }

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (messages.isEmpty()) {
                    item { EmptyHint(engineState) }
                }
                items(messages) { message -> MessageBubble(message) }
            }

            // Status strip: tokens/sec + stop while generating.
            if (stats.generating || stats.tokens > 0) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (stats.generating) {
                        CircularProgressIndicator(
                            modifier = Modifier.width(16.dp),
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(
                        "%d tokens · %.1f tok/s".format(stats.tokens, stats.tokensPerSecond),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                Column(Modifier.weight(1f)) {
                    FilterChip(
                        selected = projectMode,
                        onClick = { projectMode = !projectMode },
                        label = { Text(if (projectMode) "Project mode: files will be saved" else "Project mode") },
                    )
                    OutlinedTextField(
                        value = input,
                        onValueChange = { input = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(if (projectMode) "Describe the project to generate…" else "Ask for code…")
                        },
                        maxLines = 5,
                    )
                }
                Spacer(Modifier.width(8.dp))
                if (stats.generating) {
                    FilledIconButton(onClick = { vm.stopGeneration() }) {
                        Icon(Icons.Filled.Stop, contentDescription = "Stop")
                    }
                } else {
                    FilledIconButton(
                        onClick = { doSend() },
                        enabled = input.isNotBlank() && engineState is EngineState.Ready,
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                    }
                }
            }
        }
    }

    if (showProjectNameDialog) {
        AlertDialog(
            onDismissRequest = { showProjectNameDialog = false },
            title = { Text("Project name") },
            text = {
                OutlinedTextField(
                    value = projectName,
                    onValueChange = { projectName = it },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showProjectNameDialog = false
                    vm.send(input, projectMode = true, projectName = projectName)
                    input = ""
                }) { Text("Generate") }
            },
            dismissButton = {
                TextButton(onClick = { showProjectNameDialog = false }) { Text("Cancel") }
            },
        )
    }

    if (showSettings) {
        SettingsDialog(
            config = config,
            onDismiss = { showSettings = false },
            onApply = { newConfig ->
                showSettings = false
                vm.updateConfig(newConfig)
            },
        )
    }
}

@Composable
private fun Banner(text: String) {
    Surface(
        color = MaterialTheme.colorScheme.tertiaryContainer,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp),
        shape = RoundedCornerShape(8.dp),
    ) {
        Text(
            text,
            modifier = Modifier.padding(10.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun EmptyHint(engineState: EngineState) {
    Column(Modifier.fillMaxWidth().padding(24.dp)) {
        Text("On-device coding agent", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.width(8.dp))
        Text(
            if (engineState is EngineState.Ready)
                "Ask for code, or flip on Project mode to generate files straight into a project."
            else
                "First: tap the chip icon (top right) and pick a .task / .litertlm model file, " +
                    "or adb-push one to Android/data/dev.codeagent/files/models/. See README for links.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    val isUser = message.role == Role.USER
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = if (isUser) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.widthIn(max = 340.dp),
        ) {
            Column(Modifier.padding(10.dp)) {
                Text(
                    text = message.content.ifEmpty { if (message.streaming) "…" else "" },
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = if (isUser) null else FontFamily.Monospace
                    ),
                )
                if (message.savedProject != null) {
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "💾 ${message.savedFiles.size} file(s) → ${message.savedProject} " +
                            "(see Projects tab)",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(6.dp))
                            .padding(6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingsDialog(
    config: EngineConfig,
    onDismiss: () -> Unit,
    onApply: (EngineConfig) -> Unit,
) {
    var preferGpu by remember { mutableStateOf(config.preferGpu) }
    var maxTokens by remember { mutableStateOf(config.maxTokens.toFloat()) }
    var temperature by remember { mutableStateOf(config.temperature) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Inference settings") },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Prefer GPU (Adreno)", Modifier.weight(1f))
                    Switch(checked = preferGpu, onCheckedChange = { preferGpu = it })
                }
                Text("Context window: ${maxTokens.roundToInt()} tokens")
                Slider(
                    value = maxTokens,
                    onValueChange = { maxTokens = it },
                    valueRange = 2048f..16384f,
                    steps = 6,
                )
                Text("Temperature: %.2f".format(temperature))
                Slider(
                    value = temperature,
                    onValueChange = { temperature = it },
                    valueRange = 0f..1.5f,
                )
                Text(
                    "Changing these reloads the model. Larger context = more RAM and " +
                        "slower prefill; 8K is a good default for a 4B model.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onApply(
                    config.copy(
                        preferGpu = preferGpu,
                        maxTokens = maxTokens.roundToInt(),
                        temperature = temperature,
                    )
                )
            }) { Text("Apply") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
