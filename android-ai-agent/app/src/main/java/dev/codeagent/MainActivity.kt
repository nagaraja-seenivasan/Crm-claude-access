package dev.codeagent

import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import dev.codeagent.ui.ChatScreen
import dev.codeagent.ui.ChatViewModel
import dev.codeagent.ui.FileViewerScreen
import dev.codeagent.ui.FilesScreen
import dev.codeagent.ui.theme.CodeAgentTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CodeAgentTheme {
                AppRoot()
            }
        }
    }
}

@Composable
private fun AppRoot(vm: ChatViewModel = viewModel()) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route ?: "chat"
    val context = LocalContext.current

    // Surface one-line events (saves, exports, errors) as toasts.
    LaunchedEffect(Unit) {
        vm.events.collect { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = currentRoute == "chat",
                    onClick = { nav.navigate("chat") { popUpTo("chat"); launchSingleTop = true } },
                    icon = { Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null) },
                    label = { Text("Chat") },
                )
                NavigationBarItem(
                    selected = currentRoute.startsWith("files") || currentRoute.startsWith("viewer"),
                    onClick = { nav.navigate("files") { popUpTo("chat"); launchSingleTop = true } },
                    icon = { Icon(Icons.Filled.Folder, contentDescription = null) },
                    label = { Text("Projects") },
                )
            }
        }
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = "chat",
            modifier = Modifier.padding(padding),
        ) {
            composable("chat") { ChatScreen(vm) }
            composable("files") {
                FilesScreen(
                    vm = vm,
                    onOpenFile = { project, file ->
                        nav.navigate("viewer?project=${Uri.encode(project)}&file=${Uri.encode(file)}")
                    },
                )
            }
            composable("viewer?project={project}&file={file}") { entry ->
                val project = entry.arguments?.getString("project") ?: return@composable
                val file = entry.arguments?.getString("file") ?: return@composable
                FileViewerScreen(
                    vm = vm,
                    project = project,
                    path = file,
                    onBack = { nav.popBackStack() },
                )
            }
        }
    }
}
