package evai.android.transfer

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class HttpDownload(
    private val allowedProtocols: Set<String> = HTTPS_ONLY,
    private val attempts: Int = DEFAULT_ATTEMPTS,
) {
    fun fetch(
        url: String,
        target: File,
        expectedBytes: Long,
        cancelled: () -> Boolean,
        onLength: (Long) -> Unit = {},
        onBytes: (Long) -> Unit,
    ): Long {
        requireAllowedProtocol(URL(url))
        val staging = File(target.path + PART_SUFFIX)
        target.parentFile?.mkdirs()
        if (staging.isFile && expectedBytes > 0 && staging.length() >= expectedBytes) {
            staging.delete()
        }
        val carried = if (staging.isFile) staging.length() else 0L
        var remainingAttempts = attempts
        while (true) {
            try {
                transfer(url, staging, cancelled, onLength, onBytes)
                break
            } catch (error: IOException) {
                remainingAttempts -= 1
                if (remainingAttempts <= 0) {
                    throw error
                }
            }
        }
        val received = staging.length()
        if (expectedBytes > 0 && received != expectedBytes) {
            throw IOException("${target.name}: size $received expected $expectedBytes")
        }
        if (target.exists() && !target.delete()) {
            throw IOException("${target.name}: cannot replace the existing file")
        }
        if (!staging.renameTo(target)) {
            throw IOException("${target.name}: cannot move the downloaded file into place")
        }
        return if (received > carried) received - carried else 0L
    }

    private fun requireAllowedProtocol(url: URL) {
        require(url.protocol.lowercase() in allowedProtocols) { "download protocol ${url.protocol} is not allowed: $url" }
    }

    private fun connect(url: String, carried: Long): HttpURLConnection {
        var current = URL(url)
        repeat(MAXIMUM_REDIRECTS + 1) {
            requireAllowedProtocol(current)
            val connection = current.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = CONNECT_TIMEOUT_MILLIS
            connection.readTimeout = READ_TIMEOUT_MILLIS
            if (carried > 0) {
                connection.setRequestProperty("Range", "bytes=$carried-")
            }
            val status = connection.responseCode
            if (status !in REDIRECT_STATUSES) {
                return connection
            }
            val location = connection.getHeaderField(LOCATION_HEADER)
            connection.disconnect()
            if (location.isNullOrEmpty()) {
                throw IOException("$current: HTTP $status without a redirect location")
            }
            current = URL(current, location)
        }
        throw IOException("$url: more than $MAXIMUM_REDIRECTS redirects")
    }

    private fun transfer(url: String, staging: File, cancelled: () -> Boolean, onLength: (Long) -> Unit, onBytes: (Long) -> Unit) {
        val carried = if (staging.isFile) staging.length() else 0L
        val connection = connect(url, carried)
        try {
            val status = connection.responseCode
            if (status == HTTP_RANGE_NOT_SATISFIABLE && carried > 0) {
                staging.delete()
                throw IOException("$url: stale partial download discarded")
            }
            if (status != HttpURLConnection.HTTP_OK && status != HttpURLConnection.HTTP_PARTIAL) {
                throw IOException("$url: HTTP $status")
            }
            val append = status == HttpURLConnection.HTTP_PARTIAL
            val length = connection.contentLengthLong
            val total = if (append) {
                connection.getHeaderField(CONTENT_RANGE_HEADER)?.substringAfterLast('/')?.toLongOrNull()
                    ?: if (length >= 0) carried + length else -1L
            } else {
                length
            }
            if (total > 0) {
                onLength(total)
            }
            connection.inputStream.use { input ->
                FileOutputStream(staging, append).use { output ->
                    val buffer = ByteArray(BUFFER_BYTES)
                    while (true) {
                        if (cancelled()) {
                            throw TransferCancelled(url)
                        }
                        val read = input.read(buffer)
                        if (read < 0) {
                            break
                        }
                        output.write(buffer, 0, read)
                        onBytes(read.toLong())
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        private const val DEFAULT_ATTEMPTS = 4
        private const val CONNECT_TIMEOUT_MILLIS = 15_000
        private const val READ_TIMEOUT_MILLIS = 120_000
        private const val BUFFER_BYTES = 256 * 1024
        private const val HTTP_RANGE_NOT_SATISFIABLE = 416
        private const val MAXIMUM_REDIRECTS = 20
        private const val LOCATION_HEADER = "Location"
        private const val CONTENT_RANGE_HEADER = "Content-Range"
        private val REDIRECT_STATUSES = setOf(301, 302, 303, 307, 308)
        val HTTPS_ONLY: Set<String> = setOf("https")
        val HTTP_AND_HTTPS: Set<String> = setOf("http", "https")
        const val PART_SUFFIX = ".part"
    }
}
