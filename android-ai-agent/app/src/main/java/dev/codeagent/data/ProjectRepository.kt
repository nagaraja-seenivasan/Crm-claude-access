package dev.codeagent.data

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import dev.codeagent.agent.ProjectParser
import java.io.File

data class ProjectInfo(val name: String, val fileCount: Int, val lastModified: Long)

data class FileEntry(val relativePath: String, val sizeBytes: Long)

/**
 * File tools over app-scoped external storage:
 *   /sdcard/Android/data/dev.codeagent/files/projects/<name>/...
 *
 * App-scoped means create/read/list/edit need no permissions, and the user can
 * still browse the tree with any file manager. Export-to-Downloads goes through
 * MediaStore (also permission-free on API 29+).
 */
class ProjectRepository(private val context: Context) {

    val root: File
        get() = File(context.getExternalFilesDir(null), "projects").apply { mkdirs() }

    // ---- list / read ----

    fun listProjects(): List<ProjectInfo> =
        root.listFiles { f -> f.isDirectory }
            ?.map { dir ->
                ProjectInfo(
                    name = dir.name,
                    fileCount = dir.walkTopDown().count { it.isFile },
                    lastModified = dir.lastModified(),
                )
            }
            ?.sortedByDescending { it.lastModified }
            ?: emptyList()

    fun listFiles(project: String): List<FileEntry> {
        val dir = projectDir(project) ?: return emptyList()
        return dir.walkTopDown()
            .filter { it.isFile }
            .map { FileEntry(it.relativeTo(dir).path, it.length()) }
            .sortedBy { it.relativePath }
            .toList()
    }

    fun readFile(project: String, relativePath: String): String? =
        resolve(project, relativePath)?.takeIf { it.isFile }?.readText()

    // ---- create / edit / delete ----

    fun writeFile(project: String, relativePath: String, content: String): Boolean {
        val file = resolve(project, relativePath) ?: return false
        file.parentFile?.mkdirs()
        file.writeText(content)
        return true
    }

    fun deleteFile(project: String, relativePath: String): Boolean =
        resolve(project, relativePath)?.delete() ?: false

    fun deleteProject(project: String): Boolean =
        projectDir(project)?.deleteRecursively() ?: false

    // ---- export / share ----

    /** Copies every file of the project to Downloads/CodeAgent/<project>/. Returns count. */
    fun exportProjectToDownloads(project: String): Int {
        val dir = projectDir(project) ?: return 0
        var exported = 0
        dir.walkTopDown().filter { it.isFile }.forEach { file ->
            val subDir = file.relativeTo(dir).parent?.replace(File.separatorChar, '/') ?: ""
            if (exportOne(file, "CodeAgent/$project" + if (subDir.isEmpty()) "" else "/$subDir")) {
                exported++
            }
        }
        return exported
    }

    fun exportFileToDownloads(project: String, relativePath: String): Boolean {
        val file = resolve(project, relativePath)?.takeIf { it.isFile } ?: return false
        return exportOne(file, "CodeAgent/$project")
    }

    private fun exportOne(file: File, downloadsSubDir: String): Boolean {
        val mime = MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(file.extension.lowercase())
            ?: "text/plain"
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, file.name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$downloadsSubDir")
        }
        val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: return false
        context.contentResolver.openOutputStream(uri)?.use { out ->
            file.inputStream().use { it.copyTo(out) }
        } ?: return false
        return true
    }

    /** Content URI for ACTION_SEND sharing via FileProvider. */
    fun shareUri(project: String, relativePath: String): Uri? {
        val file = resolve(project, relativePath)?.takeIf { it.isFile } ?: return null
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }

    // ---- path safety ----

    private fun projectDir(project: String): File? {
        val safe = ProjectParser.sanitizePath(project)?.takeIf { !it.contains('/') } ?: return null
        return File(root, safe).takeIf { it.isDirectory || !it.exists() }
    }

    private fun resolve(project: String, relativePath: String): File? {
        val dir = projectDir(project) ?: return null
        val safe = ProjectParser.sanitizePath(relativePath) ?: return null
        val file = File(dir, safe)
        // Belt and braces: never touch anything that resolved outside the project.
        if (!file.canonicalPath.startsWith(dir.canonicalPath + File.separator) &&
            file.canonicalPath != dir.canonicalPath
        ) return null
        return file
    }
}
