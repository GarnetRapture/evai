package evai.android.assets

import android.content.res.AssetManager
import java.io.FileNotFoundException

data class AssetSource(
    val host: String,
    val repo: String,
    val branch: String,
    val listPath: String,
    val filePath: String,
    val prefix: String,
) {
    val configured: Boolean
        get() = host.isNotEmpty() && repo.isNotEmpty() && listPath.isNotEmpty() && filePath.isNotEmpty()

    fun expandTarget(pattern: String, path: String): String {
        val expanded = StringBuilder(pattern.length + path.length)
        var index = 0
        while (index < pattern.length) {
            if (pattern[index] != '{') {
                expanded.append(pattern[index])
                index += 1
                continue
            }
            val close = pattern.indexOf('}', index + 1)
            if (close < 0) {
                expanded.append(pattern, index, pattern.length)
                break
            }
            when (pattern.substring(index + 1, close)) {
                "repo" -> expanded.append(repo)
                "branch" -> expanded.append(branch)
                "path" -> expanded.append(path)
            }
            index = close + 1
        }
        return expanded.toString()
    }

    fun url(target: String): String = "https://$host$target"

    companion object {
        private const val ENCODED_SOURCE_ASSET = "source/evai-assets.bin"
        private const val SOURCE_MAGIC = "EVAS1"
        private const val SOURCE_KEY = "evai-local-asset-index"
        private const val DEFAULT_BRANCH = "main"

        fun read(assets: AssetManager): AssetSource {
            val body = try {
                decode(assets.open(ENCODED_SOURCE_ASSET).use { stream -> stream.readBytes() })
            } catch (missing: FileNotFoundException) {
                ""
            }
            val branch = parseValue(body, "branch")
            return AssetSource(
                host = parseValue(body, "host"),
                repo = parseValue(body, "repo"),
                branch = branch.ifEmpty { DEFAULT_BRANCH },
                listPath = parseValue(body, "list"),
                filePath = parseValue(body, "file"),
                prefix = parseValue(body, "prefix"),
            )
        }

        fun parseValue(body: String, key: String): String {
            for (line in body.split('\n')) {
                val separator = line.indexOf('=')
                if (separator < 0) {
                    continue
                }
                if (line.substring(0, separator).trim(' ', '\t') != key) {
                    continue
                }
                return line.substring(separator + 1).trimStart(' ', '\t').trimEnd(' ', '\t', '\r')
            }
            return ""
        }

        private fun decode(raw: ByteArray): String {
            val magic = SOURCE_MAGIC.toByteArray(Charsets.US_ASCII)
            if (raw.size < magic.size || !raw.copyOfRange(0, magic.size).contentEquals(magic)) {
                return raw.toString(Charsets.UTF_8)
            }
            val key = SOURCE_KEY.toByteArray(Charsets.US_ASCII)
            val decoded = ByteArray(raw.size - magic.size)
            for (offset in decoded.indices) {
                val keyByte = key[offset % key.size].toInt() and 0xFF
                val mask = (keyByte xor ((offset.toLong() * 31L + 7L).toInt() and 0xFF)) and 0xFF
                decoded[offset] = ((raw[offset + magic.size].toInt() and 0xFF) xor mask).toByte()
            }
            return decoded.toString(Charsets.UTF_8)
        }
    }
}
