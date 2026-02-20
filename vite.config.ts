import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function readGitMeta(command: string, fallback: string) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback
  } catch {
    return fallback
  }
}

const commitCount = readGitMeta('git rev-list --count HEAD', '0')
const commitHash = readGitMeta('git rev-parse --short HEAD', 'local')
const releaseStage = 'Preview'
const appVersion = `0.0.${commitCount}`

// https://vite.dev/config/
export default defineConfig({
  base: '/profile/',
  plugins: [react()],
  define: {
    __APP_RELEASE_STAGE__: JSON.stringify(releaseStage),
    __APP_BUILD_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_HASH__: JSON.stringify(commitHash),
  },
})
