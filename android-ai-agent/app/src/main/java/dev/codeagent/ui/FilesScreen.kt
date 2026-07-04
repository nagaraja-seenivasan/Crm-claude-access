package dev.codeagent.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import dev.codeagent.data.ProjectInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilesScreen(
    vm: ChatViewModel,
    onOpenFile: (project: String, file: String) -> Unit,
) {
    // A bump counter forces recomposition after a delete/export/refresh.
    var refresh by remember { mutableStateOf(0) }
    val projects = remember(refresh) { vm.listProjects() }
    var expanded by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Projects") },
                actions = {
                    IconButton(onClick = { refresh++ }) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
    ) { padding ->
        if (projects.isEmpty()) {
            Column(Modifier.padding(padding).fillMaxSize().padding(24.dp)) {
                Text("No projects yet", style = MaterialTheme.typography.titleMedium)
                Text(
                    "Turn on Project mode in Chat and describe something to build. " +
                        "Generated files land here under " +
                        "Android/data/dev.codeagent/files/projects/.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            return@Scaffold
        }

        LazyColumn(Modifier.padding(padding).fillMaxSize()) {
            items(projects) { project ->
                ProjectRow(
                    project = project,
                    expanded = expanded == project.name,
                    onToggle = { expanded = if (expanded == project.name) null else project.name },
                    onExport = { vm.exportProject(project.name); refresh++ },
                    onDelete = {
                        vm.deleteProject(project.name)
                        if (expanded == project.name) expanded = null
                        refresh++
                    },
                    files = if (expanded == project.name) vm.listFiles(project.name) else emptyList(),
                    onOpenFile = { file -> onOpenFile(project.name, file) },
                )
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun ProjectRow(
    project: ProjectInfo,
    expanded: Boolean,
    onToggle: () -> Unit,
    onExport: () -> Unit,
    onDelete: () -> Unit,
    files: List<dev.codeagent.data.FileEntry>,
    onOpenFile: (String) -> Unit,
) {
    Column {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Folder, contentDescription = null)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(project.name, style = MaterialTheme.typography.bodyLarge)
                Text(
                    "${project.fileCount} file(s)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onExport) {
                Icon(Icons.Filled.Download, contentDescription = "Export to Downloads")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete project")
            }
            Icon(
                if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                contentDescription = null,
            )
        }
        if (expanded) {
            files.forEach { file ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { onOpenFile(file.relativePath) }
                        .padding(start = 40.dp, top = 8.dp, bottom = 8.dp, end = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.InsertDriveFile,
                        contentDescription = null,
                        modifier = Modifier.width(18.dp),
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        file.relativePath,
                        style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace),
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "${file.sizeBytes} B",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
