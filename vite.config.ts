import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig, normalizePath } from 'vite'

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const applicationEntryDocuments = ['index.html']

const nonApplicationDirectories = ['android', 'build', 'native', 'third_party', 'tmp-claude', 'docs', 'vite', '.claude', '.github']

const nonApplicationWatchPatterns = nonApplicationDirectories
  .map((directory) => `${normalizePath(resolve(import.meta.dirname, directory))}/**`)

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  optimizeDeps: { entries: applicationEntryDocuments },
  server: { headers: crossOriginIsolationHeaders, watch: { ignored: nonApplicationWatchPatterns } },
  preview: { headers: crossOriginIsolationHeaders },
})
