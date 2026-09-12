import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execFileSync, spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { defineConfig, type Plugin } from 'vite'

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const maximumNativeRequestBytes = 8 * 1024 * 1024
const nativeHostName = 'pro.everlib.eversoul.context'
const nativeExecutableName = process.platform === 'win32' ? 'eversoul-native-host.exe' : 'eversoul-native-host'

function existingNativeExecutable(candidate: string | undefined): string | null {
  if (!candidate) return null
  const normalized = resolve(candidate.trim().replace(/^"|"$/gu, ''))
  const executable = existsSync(normalized) && statSync(normalized).isDirectory()
    ? join(normalized, nativeExecutableName)
    : normalized
  return basename(executable).toLowerCase() === nativeExecutableName.toLowerCase()
    && existsSync(executable)
    && statSync(executable).isFile()
    ? executable
    : null
}

function executableFromManifest(manifestPath: string): string | null {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { path?: unknown }
    return typeof manifest.path === 'string' ? existingNativeExecutable(manifest.path) : null
  } catch {
    return null
  }
}

function windowsRegisteredManifestPaths(): string[] {
  if (process.platform !== 'win32') return []
  const keys = [
    `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${nativeHostName}`,
    `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${nativeHostName}`,
    `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${nativeHostName}`,
    `HKLM\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${nativeHostName}`,
    `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${nativeHostName}`,
    `HKLM\\Software\\Mozilla\\NativeMessagingHosts\\${nativeHostName}`,
  ]
  const manifests: string[] = []
  for (const key of keys) {
    try {
      const output = execFileSync('reg.exe', ['query', key, '/ve'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const match = output.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)$/imu)
      if (match?.[1]) manifests.push(match[1].trim())
    } catch {
      // This browser has no registered host; continue through the discovery list.
    }
  }
  return manifests
}

function registeredManifestPaths(): string[] {
  if (process.platform === 'win32') return windowsRegisteredManifestPaths()
  const home = homedir()
  return [
    join(home, '.config', 'google-chrome', 'NativeMessagingHosts', `${nativeHostName}.json`),
    join(home, '.config', 'chromium', 'NativeMessagingHosts', `${nativeHostName}.json`),
    join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts', `${nativeHostName}.json`),
    join(home, '.mozilla', 'native-messaging-hosts', `${nativeHostName}.json`),
    `/etc/opt/chrome/native-messaging-hosts/${nativeHostName}.json`,
    `/etc/chromium/native-messaging-hosts/${nativeHostName}.json`,
    `/usr/lib/mozilla/native-messaging-hosts/${nativeHostName}.json`,
  ]
}

function standardNativeExecutableCandidates(): string[] {
  const projectBuild = join(process.cwd(), 'native', 'build', nativeExecutableName)
  if (process.platform === 'win32') {
    const candidates = [
      process.env.EVERSOUL_NATIVE_HOST ?? '',
      projectBuild,
      join(process.cwd(), nativeExecutableName),
    ]
    if (process.env.LOCALAPPDATA) {
      candidates.push(
        join(process.env.LOCALAPPDATA, 'EverSoulAI', nativeExecutableName),
        join(process.env.LOCALAPPDATA, 'Programs', 'EverSoulAI', nativeExecutableName),
      )
    }
    if (process.env.ProgramFiles) candidates.push(join(process.env.ProgramFiles, 'EverSoulAI', nativeExecutableName))
    if (process.env['ProgramFiles(x86)']) candidates.push(join(process.env['ProgramFiles(x86)'], 'EverSoulAI', nativeExecutableName))
    return candidates
  }
  return [
    process.env.EVERSOUL_NATIVE_HOST ?? '',
    projectBuild,
    join(process.cwd(), nativeExecutableName),
    join(homedir(), '.local', 'lib', 'eversoul-ai', nativeExecutableName),
    join('/usr/local/lib/eversoul-ai', nativeExecutableName),
    join('/opt/eversoul-ai', nativeExecutableName),
  ]
}

function discoverNativeExecutable(preferredPath: string | null): string | null {
  if (preferredPath) {
    if (!isAbsolute(preferredPath)) return null
    return existingNativeExecutable(preferredPath)
  }
  for (const manifestPath of registeredManifestPaths()) {
    const executable = executableFromManifest(manifestPath)
    if (executable) return executable
  }
  for (const candidate of standardNativeExecutableCandidates()) {
    const executable = existingNativeExecutable(candidate)
    if (executable) return executable
  }
  return null
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maximumNativeRequestBytes) throw new Error('request_too_large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

interface PendingNativeCall {
  resolve: (response: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

class PersistentNativeContextHost {
  private child: ChildProcessWithoutNullStreams | null = null
  private executable: string | null = null
  private stdoutBuffer = ''
  private stderrBuffer = ''
  private pending: PendingNativeCall[] = []

  call(executable: string, payload: string): Promise<string> {
    this.ensureRunning(executable)
    return new Promise((resolveResponse, reject) => {
      const timeout = setTimeout(() => {
        this.failAndStop(new Error('native_host_timeout'))
      }, 8_000)
      this.pending.push({ resolve: resolveResponse, reject, timeout })
      this.child?.stdin.write(`${payload}\n`, (error) => {
        if (error) this.failAndStop(error)
      })
    })
  }

  close(): void {
    const child = this.child
    this.child = null
    this.executable = null
    this.rejectPending(new Error('native_host_closed'))
    if (child && child.exitCode === null) child.kill()
  }

  private ensureRunning(executable: string): void {
    if (this.child && this.child.exitCode === null && this.executable === executable) return
    if (this.child) this.close()
    const child = spawn(executable, ['--jsonl'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    this.executable = executable
    this.stdoutBuffer = ''
    this.stderrBuffer = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.consumeStdout(child, chunk))
    child.stderr.on('data', (chunk: string) => {
      if (this.child !== child) return
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-8_192)
    })
    child.on('error', (error) => {
      if (this.child === child) this.failAndStop(error)
    })
    child.on('close', (code) => {
      if (this.child !== child) return
      const detail = this.stderrBuffer.trim() || `native_host_exit_${code ?? 'unknown'}`
      this.child = null
      this.executable = null
      this.rejectPending(new Error(detail))
    })
  }

  private consumeStdout(child: ChildProcessWithoutNullStreams, chunk: string): void {
    if (this.child !== child) return
    this.stdoutBuffer += chunk
    while (true) {
      const newline = this.stdoutBuffer.indexOf('\n')
      if (newline < 0) return
      const line = this.stdoutBuffer.slice(0, newline).replace(/\r$/u, '').trim()
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1)
      if (!line) continue
      const call = this.pending.shift()
      if (!call) {
        this.failAndStop(new Error('native_host_unexpected_response'))
        return
      }
      clearTimeout(call.timeout)
      call.resolve(line)
    }
  }

  private failAndStop(error: Error): void {
    const child = this.child
    this.child = null
    this.executable = null
    this.rejectPending(error)
    if (child && child.exitCode === null) child.kill()
  }

  private rejectPending(error: Error): void {
    for (const call of this.pending.splice(0)) {
      clearTimeout(call.timeout)
      call.reject(error)
    }
  }
}

function nativeContextDevelopmentBridge(): Plugin {
  const nativeHost = new PersistentNativeContextHost()
  return {
    name: 'eversoul-native-context-development-bridge',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('close', () => nativeHost.close())
      server.middlewares.use('/__eversoul/native-context', async (request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }))
          return
        }
        try {
          const body = await readRequestBody(request)
          const payload = JSON.parse(body) as { operation?: unknown; host_executable_path?: unknown }
          if (payload.operation === 'disconnect_native_host') {
            nativeHost.close()
            response.end(JSON.stringify({ ok: true }))
            return
          }
          const preferredPath = typeof payload.host_executable_path === 'string' && payload.host_executable_path.trim().length > 0
            ? payload.host_executable_path.trim()
            : null
          const executable = discoverNativeExecutable(preferredPath)
          if (!executable) {
            response.statusCode = 503
            response.end(JSON.stringify({ ok: false, error: preferredPath ? 'native_host_path_not_found' : 'native_host_not_found' }))
            return
          }
          response.end(await nativeHost.call(executable, body))
        } catch (error) {
          response.statusCode = 502
          response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'native_bridge_failed' }))
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [nativeContextDevelopmentBridge(), react(), tailwindcss()],
  server: { headers: crossOriginIsolationHeaders },
  preview: { headers: crossOriginIsolationHeaders },
})
