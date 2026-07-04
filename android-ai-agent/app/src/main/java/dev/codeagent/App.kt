package dev.codeagent

import android.app.Application
import dev.codeagent.data.ProjectRepository
import dev.codeagent.llm.InferenceEngine
import dev.codeagent.llm.MediaPipeEngine
import dev.codeagent.llm.ModelManager

/**
 * Plain service locator — the app is small enough that a DI framework
 * would be pure overhead.
 */
class App : Application() {
    val engine: InferenceEngine by lazy { MediaPipeEngine(this) }
    val models: ModelManager by lazy { ModelManager(this) }
    val projects: ProjectRepository by lazy { ProjectRepository(this) }
}
