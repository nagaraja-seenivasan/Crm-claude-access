package dev.codeagent.llm

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Finds and imports model files. Models live in app-scoped external storage:
 *
 *   /sdcard/Android/data/dev.codeagent/files/models/
 *
 * Two ways to get a model there (no permissions needed for either):
 *  1. `adb push model.task <dir>` — instant, no duplicate copy. Recommended.
 *  2. In-app "Import model" button — SAF picker, streams the file into the
 *     models dir (multi-GB copy; progress is reported).
 */
class ModelManager(private val context: Context) {

    private val prefs = context.getSharedPreferences("models", Context.MODE_PRIVATE)

    val modelsDir: File
        get() = File(context.getExternalFilesDir(null), "models").apply { mkdirs() }

    private val supportedExtensions = setOf("task", "litertlm", "bin", "tflite")

    fun listModels(): List<File> =
        modelsDir.listFiles { f -> f.isFile && f.extension.lowercase() in supportedExtensions }
            ?.sortedBy { it.name }
            ?: emptyList()

    /** Last explicitly chosen model, else the first one found on disk. */
    var activeModelPath: String?
        get() = prefs.getString("active", null)
            ?.takeIf { File(it).exists() }
            ?: listModels().firstOrNull()?.absolutePath
        set(value) {
            prefs.edit().putString("active", value).apply()
        }

    suspend fun import(uri: Uri, onProgress: (Float) -> Unit): File = withContext(Dispatchers.IO) {
        val (name, size) = queryNameAndSize(uri)
        val dest = File(modelsDir, name)
        val input = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("Cannot open selected file")
        input.use { src ->
            dest.outputStream().use { out ->
                val buffer = ByteArray(1 shl 20) // 1 MiB
                var copied = 0L
                while (true) {
                    val read = src.read(buffer)
                    if (read < 0) break
                    out.write(buffer, 0, read)
                    copied += read
                    if (size > 0) onProgress(copied.toFloat() / size)
                }
            }
        }
        activeModelPath = dest.absolutePath
        dest
    }

    fun delete(model: File) {
        model.delete()
        if (prefs.getString("active", null) == model.absolutePath) {
            prefs.edit().remove("active").apply()
        }
    }

    private fun queryNameAndSize(uri: Uri): Pair<String, Long> {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                val name = if (nameIdx >= 0) cursor.getString(nameIdx) else null
                val size = if (sizeIdx >= 0) cursor.getLong(sizeIdx) else -1L
                return (name ?: "model.task") to size
            }
        }
        return "model.task" to -1L
    }
}
