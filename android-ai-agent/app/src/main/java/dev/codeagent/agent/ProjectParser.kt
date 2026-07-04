package dev.codeagent.agent

/** Extracts generated files from model output. */
object ProjectParser {

    data class GeneratedFile(val path: String, val content: String)

    private val FILE_BLOCK = Regex(
        pattern = "```file:\\s*([^\\n`]+)\\n(.*?)```",
        options = setOf(RegexOption.DOT_MATCHES_ALL)
    )

    private val ANY_CODE_BLOCK = Regex(
        pattern = "```([a-zA-Z0-9+#._-]*)\\n(.*?)```",
        options = setOf(RegexOption.DOT_MATCHES_ALL)
    )

    private val LANG_TO_EXT = mapOf(
        "python" to "py", "py" to "py",
        "kotlin" to "kt", "java" to "java",
        "javascript" to "js", "js" to "js", "typescript" to "ts", "ts" to "ts",
        "html" to "html", "css" to "css", "json" to "json", "xml" to "xml",
        "c" to "c", "cpp" to "cpp", "c++" to "cpp", "rust" to "rs", "go" to "go",
        "bash" to "sh", "sh" to "sh", "shell" to "sh",
        "sql" to "sql", "yaml" to "yml", "yml" to "yml", "markdown" to "md",
    )

    /** Files explicitly emitted in the ```file: path``` format. */
    fun parse(output: String): List<GeneratedFile> =
        FILE_BLOCK.findAll(output).mapNotNull { match ->
            val path = sanitizePath(match.groupValues[1].trim()) ?: return@mapNotNull null
            GeneratedFile(path, match.groupValues[2].trimEnd() + "\n")
        }.toList()

    /**
     * Fallback for small models that ignore the file format: promote plain
     * fenced code blocks to snippet files (snippet-1.py, snippet-2.kt, …).
     */
    fun parseLoose(output: String): List<GeneratedFile> {
        if (parse(output).isNotEmpty()) return parse(output)
        return ANY_CODE_BLOCK.findAll(output).mapIndexedNotNull { index, match ->
            val body = match.groupValues[2].trim()
            if (body.isEmpty()) return@mapIndexedNotNull null
            val ext = LANG_TO_EXT[match.groupValues[1].lowercase()] ?: "txt"
            GeneratedFile("snippet-${index + 1}.$ext", body + "\n")
        }.toList()
    }

    /**
     * Normalizes a model-emitted path and rejects traversal. Returns null for
     * anything that could escape the project directory.
     */
    fun sanitizePath(path: String): String? {
        val parts = path.replace('\\', '/')
            .split('/')
            .filter { it.isNotBlank() && it != "." }
        if (parts.isEmpty() || parts.any { it == ".." }) return null
        return parts.joinToString("/")
    }
}
