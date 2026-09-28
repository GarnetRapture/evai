package evai.android.assets

import android.content.res.AssetManager
import evai.android.transfer.HttpDownload
import evai.android.transfer.TransferCancelled
import java.io.File
import java.io.FileNotFoundException
import java.io.IOException
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

class AssetLibrary(private val root: File, private val assets: AssetManager, private val source: AssetSource) {
    private val download = HttpDownload()

    data class AssetEntry(val path: String, val size: Long)

    data class AssetPlan(
        val pending: List<AssetEntry>,
        val pendingBytes: Long,
        val present: Int,
        val relocated: Int,
        val error: String,
    )

    data class AssetProgress(val completed: Int, val total: Int, val bytes: Long, val totalBytes: Long, val current: String)

    data class AssetOutcome(val downloaded: Int, val failed: Int, val bytes: Long, val error: String)

    private data class DirectoryMeasure(val files: Long, val bytes: Long)

    private class LocalIndex {
        val byPath = HashMap<String, Long>()
        val byName = HashMap<String, MutableList<String>>()
    }

    val configured: Boolean
        get() = source.configured

    fun seedBundledList() {
        val list = File(root, ASSET_LIST_NAME)
        if (list.isFile || File(root, "data/manifest.txt").isFile) {
            return
        }
        try {
            assets.open(BUNDLED_LIST_ASSET).use { input ->
                root.mkdirs()
                list.outputStream().use { output -> input.copyTo(output) }
            }
        } catch (missing: FileNotFoundException) {
            return
        }
    }

    fun refreshAssetList(): String {
        return try {
            val body = fetchRemoteList()
            parseAssetList(body)
            body.copyTo(File(root, ASSET_LIST_NAME), overwrite = true)
            ""
        } catch (failure: Exception) {
            failure.message ?: failure.toString()
        }
    }

    fun manifestSatisfied(voice: String): Boolean {
        val manifest = File(root, ASSET_MANIFEST_NAME)
        if (!manifest.isFile) {
            return false
        }
        val body = manifest.readText(Charsets.UTF_8)
        if (AssetSource.parseValue(body, MANIFEST_REPO_KEY) != source.repo) {
            return false
        }
        if (AssetSource.parseValue(body, MANIFEST_VOICE_KEY) != voice) {
            return false
        }
        val listed = measureAssetList()
        if (listed.files == 0L) {
            return false
        }
        if (AssetSource.parseValue(body, MANIFEST_LIST_FILES_KEY) != listed.files.toString() ||
            AssetSource.parseValue(body, MANIFEST_LIST_BYTES_KEY) != listed.bytes.toString()
        ) {
            return false
        }
        val measure = measureDirectory(File(root, ASSET_ROOT_NAME))
        if (measure.files == 0L) {
            return false
        }
        return AssetSource.parseValue(body, MANIFEST_FILES_KEY) == measure.files.toString() &&
            AssetSource.parseValue(body, MANIFEST_BYTES_KEY) == measure.bytes.toString()
    }

    fun storeManifest(voice: String) {
        val measure = measureDirectory(File(root, ASSET_ROOT_NAME))
        val listed = measureAssetList()
        File(root, ASSET_MANIFEST_NAME).writeText(
            "$MANIFEST_REPO_KEY = ${source.repo}\n" +
                "$MANIFEST_VOICE_KEY = $voice\n" +
                "$MANIFEST_FILES_KEY = ${measure.files}\n" +
                "$MANIFEST_BYTES_KEY = ${measure.bytes}\n" +
                "$MANIFEST_LIST_FILES_KEY = ${listed.files}\n" +
                "$MANIFEST_LIST_BYTES_KEY = ${listed.bytes}\n",
            Charsets.UTF_8,
        )
    }

    fun plan(voice: String): AssetPlan {
        val remote = try {
            loadAssetList()
        } catch (failure: Exception) {
            return AssetPlan(emptyList(), 0, 0, 0, failure.message ?: failure.toString())
        }
        val index = buildLocalIndex()
        val pending = mutableListOf<AssetEntry>()
        var pendingBytes = 0L
        var present = 0
        var relocated = 0
        for (entry in remote) {
            if (!isSafeRelative(entry.path) || !voiceWanted(entry.path, voice)) {
                continue
            }
            if (source.prefix.isNotEmpty() && !entry.path.startsWith(source.prefix)) {
                continue
            }
            val known = index.byPath[entry.path]
            if (known != null && (entry.size == 0L || known == entry.size)) {
                present += 1
                continue
            }
            if (known == null && relocateExisting(index, entry)) {
                relocated += 1
                continue
            }
            val carried = index.byPath["${entry.path}${HttpDownload.PART_SUFFIX}"] ?: 0L
            pending += entry
            pendingBytes += if (entry.size > carried) entry.size - carried else 0L
        }
        return AssetPlan(pending, pendingBytes, present, relocated, "")
    }

    fun fetch(
        plan: AssetPlan,
        executor: ExecutorService,
        cancelled: () -> Boolean,
        report: (AssetProgress) -> Unit,
    ): AssetOutcome {
        if (plan.pending.isEmpty()) {
            return AssetOutcome(0, 0, 0, "")
        }
        val completed = AtomicInteger(0)
        val downloaded = AtomicInteger(0)
        val failed = AtomicInteger(0)
        val bytes = AtomicLong(0)
        val written = AtomicLong(0)
        val errors = StringBuffer()
        report(AssetProgress(0, plan.pending.size, 0, plan.pendingBytes, ""))
        val transfers: List<Future<*>> = plan.pending.map { entry ->
            executor.submit {
                val destination = File(root, entry.path)
                try {
                    val received = download.fetch(
                        source.url(source.expandTarget(source.filePath, encodePath(entry.path))),
                        destination,
                        entry.size,
                        cancelled,
                    ) { delta -> bytes.addAndGet(delta) }
                    written.addAndGet(received)
                    downloaded.incrementAndGet()
                } catch (failure: TransferCancelled) {
                    failed.incrementAndGet()
                    errors.append("${entry.path}: cancelled\n")
                } catch (failure: Exception) {
                    failed.incrementAndGet()
                    errors.append("${entry.path}: ${failure.message ?: failure.toString()}\n")
                }
                report(AssetProgress(completed.incrementAndGet(), plan.pending.size, bytes.get(), plan.pendingBytes, entry.path))
            }
        }
        transfers.forEach { transfer -> transfer.get() }
        return AssetOutcome(downloaded.get(), failed.get(), written.get(), errors.toString())
    }

    fun readText(path: String): String {
        require(isSafeRelative(path) && path.startsWith("$ASSET_ROOT_NAME/")) { "unsafe asset path: $path" }
        val file = File(root, path)
        if (!file.isFile) {
            throw FileNotFoundException(path)
        }
        return file.readText(Charsets.UTF_8)
    }

    private fun loadAssetList(): List<AssetEntry> {
        for (file in listOf(File(root, ASSET_LIST_NAME), File(root, "data/manifest.txt"))) {
            if (file.isFile) {
                return parseAssetList(file)
            }
        }
        val body = fetchRemoteList()
        val entries = parseAssetList(body)
        body.copyTo(File(root, ASSET_LIST_NAME), overwrite = true)
        return entries
    }

    private fun fetchRemoteList(): File {
        if (!source.configured) {
            throw IOException("asset source is not configured")
        }
        val scratch = File(root, ASSET_SCRATCH_NAME)
        scratch.mkdirs()
        val body = File(scratch, "manifest.txt")
        body.delete()
        File(body.path + HttpDownload.PART_SUFFIX).delete()
        download.fetch(source.url(source.expandTarget(source.listPath, "")), body, 0, { false }) { }
        return body
    }

    private fun parseAssetList(file: File): List<AssetEntry> {
        val entries = mutableListOf<AssetEntry>()
        file.useLines(Charsets.UTF_8) { lines ->
            lines.forEachIndexed { index, raw ->
                val line = raw.trimEnd('\r')
                val tab = line.indexOf('\t')
                val path = if (tab < 0) line else line.substring(0, tab)
                val sizeText = if (tab < 0) "" else line.substring(tab + 1)
                val size = if (sizeText.isNotEmpty() && sizeText.all { character -> character in '0'..'9' }) sizeText.toLongOrNull() else null
                if (size == null || !isSafeRelative(path) || path.contains('\\') || !path.startsWith("$ASSET_ROOT_NAME/")) {
                    throw IllegalArgumentException("invalid asset list ${file.path} line ${index + 1}")
                }
                entries += AssetEntry(path, size)
            }
        }
        if (entries.isEmpty()) {
            throw IllegalArgumentException("empty or unreadable asset list: ${file.path}")
        }
        return entries
    }

    private fun measureAssetList(): DirectoryMeasure {
        for (file in listOf(File(root, ASSET_LIST_NAME), File(root, "data/manifest.txt"))) {
            if (!file.isFile) {
                continue
            }
            var files = 0L
            var bytes = 0L
            file.useLines(Charsets.UTF_8) { lines ->
                for (raw in lines) {
                    val line = raw.trimEnd('\r')
                    val tab = line.indexOf('\t')
                    if (tab < 0) {
                        continue
                    }
                    val size = line.substring(tab + 1).takeWhile { character -> character in '0'..'9' }.toLongOrNull() ?: continue
                    files += 1
                    bytes += size
                }
            }
            return DirectoryMeasure(files, bytes)
        }
        return DirectoryMeasure(0, 0)
    }

    private fun measureDirectory(directory: File): DirectoryMeasure {
        if (!directory.isDirectory) {
            return DirectoryMeasure(0, 0)
        }
        var files = 0L
        var bytes = 0L
        directory.walkTopDown().filter { file -> file.isFile }.forEach { file ->
            files += 1
            bytes += file.length()
        }
        return DirectoryMeasure(files, bytes)
    }

    private fun buildLocalIndex(): LocalIndex {
        val index = LocalIndex()
        if (!root.isDirectory) {
            return index
        }
        root.walkTopDown()
            .onEnter { directory -> directory == root || directory.name !in EXCLUDED_DIRECTORIES }
            .filter { file -> file.isFile }
            .forEach { file ->
                val relative = file.relativeTo(root).invariantSeparatorsPath
                if (relative.isEmpty()) {
                    return@forEach
                }
                index.byName.getOrPut(file.name) { mutableListOf() } += relative
                index.byPath[relative] = file.length()
            }
        return index
    }

    private fun relocateExisting(index: LocalIndex, entry: AssetEntry): Boolean {
        val name = File(entry.path).name
        val candidates = index.byName[name] ?: return false
        val wanted = suffixOf(entry.path)
        for (candidate in candidates) {
            if (candidate == entry.path || !candidate.endsWith(wanted)) {
                continue
            }
            val known = index.byPath[candidate] ?: continue
            if (entry.size != 0L && known != entry.size) {
                continue
            }
            val sourceFile = File(root, candidate)
            val destination = File(root, entry.path)
            destination.parentFile?.mkdirs()
            if (!sourceFile.renameTo(destination)) {
                try {
                    sourceFile.copyTo(destination, overwrite = true)
                } catch (failure: IOException) {
                    continue
                }
                sourceFile.delete()
            }
            index.byPath.remove(candidate)
            index.byPath[entry.path] = entry.size
            return true
        }
        return false
    }

    companion object {
        const val ASSET_ROOT_NAME = "data"
        private const val ASSET_MANIFEST_NAME = "evai-assets.manifest"
        private const val ASSET_LIST_NAME = "evai-assets.list"
        private const val ASSET_SCRATCH_NAME = "evai-assets.cache"
        private const val BUNDLED_LIST_ASSET = "source/evai-assets.list"
        private const val MANIFEST_REPO_KEY = "repo"
        private const val MANIFEST_VOICE_KEY = "voice"
        private const val MANIFEST_FILES_KEY = "files"
        private const val MANIFEST_BYTES_KEY = "bytes"
        private const val MANIFEST_LIST_FILES_KEY = "list_files"
        private const val MANIFEST_LIST_BYTES_KEY = "list_bytes"
        private val EXCLUDED_DIRECTORIES = setOf(
            ".git", ".xmake", "node_modules", "third_party", "tmp", "tmp-claude", "tmp-codex", "dist",
            ASSET_SCRATCH_NAME, "evai-database", "models",
        )

        fun isSafeRelative(path: String): Boolean =
            path.isNotEmpty() && !path.startsWith('/') && !path.contains("..") && !path.contains(':')

        fun voiceWanted(path: String, voice: String): Boolean {
            if (!path.contains("/voice/")) {
                return true
            }
            val korean = path.contains("/ko/")
            val japanese = path.contains("/ja/")
            if (!korean && !japanese) {
                return true
            }
            return when (voice) {
                "ko" -> korean
                "ja" -> japanese
                "both" -> true
                else -> false
            }
        }

        private fun suffixOf(path: String): String {
            val separator = path.indexOf('/')
            return if (separator < 0) path else path.substring(separator + 1)
        }

        fun encodePath(value: String): String {
            val encoded = StringBuilder(value.length)
            for (byte in value.toByteArray(Charsets.UTF_8)) {
                val character = byte.toInt() and 0xFF
                val plain = character in 'a'.code..'z'.code || character in 'A'.code..'Z'.code ||
                    character in '0'.code..'9'.code || character == '/'.code || character == '-'.code ||
                    character == '_'.code || character == '.'.code || character == '~'.code
                if (plain) {
                    encoded.append(character.toChar())
                } else {
                    encoded.append('%').append(String.format("%02X", character))
                }
            }
            return encoded.toString()
        }
    }
}
