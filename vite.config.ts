import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function readGitMeta(command: string, fallback: string) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback
  } catch {
    return fallback
  }
}

const ciRunNumber = process.env.GITHUB_RUN_NUMBER?.trim()
const commitCount = ciRunNumber && /^\d+$/.test(ciRunNumber) ? ciRunNumber : readGitMeta('git rev-list --count HEAD', '0')
const commitHash = readGitMeta('git rev-parse --short HEAD', 'local')
const releaseStage = 'Preview'
const appVersion = `0.0.${commitCount}`
const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const roadmapLayoutPath = path.join(projectRoot, 'src/content/roadmap-layout.json')

type LayoutPoint = {
  x: number
  y: number
}

type LayoutLeaf = LayoutPoint & {
  boxX: number
  boxY: number
}

type RoadmapLayoutPayload = {
  version: 1
  updatedAt: string
  areas: Record<string, LayoutPoint>
  rootAreas: Record<string, LayoutPoint>
  topics: Record<string, LayoutLeaf>
  rootTopics: Record<string, LayoutLeaf>
}

function localRoadmapLayoutPlugin(): Plugin {
  return {
    name: 'local-roadmap-layout-save',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestPath = req.url?.split('?')[0]
        if (requestPath !== '/__layout/roadmap' && requestPath !== '/profile/__layout/roadmap') {
          next()
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method not allowed' })
          return
        }

        try {
          const body = await readRequestBody(req, 1_000_000)
          const payload = normalizeRoadmapLayoutPayload(JSON.parse(body))
          await fs.writeFile(roadmapLayoutPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
          sendJson(res, 200, { ok: true })
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid layout payload' })
        }
      })
    },
  }
}

function readRequestBody(req: IncomingMessage, limit: number) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
      if (body.length > limit) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function normalizeRoadmapLayoutPayload(value: unknown): RoadmapLayoutPayload {
  if (!isRecord(value) || value.version !== 1) throw new Error('Invalid layout version')
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    areas: readPointMap(value.areas),
    rootAreas: readPointMap(value.rootAreas),
    topics: readLeafMap(value.topics),
    rootTopics: readLeafMap(value.rootTopics),
  }
}

function readPointMap(value: unknown) {
  if (!isRecord(value)) return {}
  return sortedRecord(
    Object.entries(value).map(([key, point]) => {
      if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
        throw new Error(`Invalid layout point: ${key}`)
      }
      return [key, { x: point.x, y: point.y }]
    }),
  )
}

function readLeafMap(value: unknown) {
  if (!isRecord(value)) return {}
  return sortedRecord(
    Object.entries(value).map(([key, point]) => {
      if (
        !isRecord(point) ||
        !isFiniteNumber(point.x) ||
        !isFiniteNumber(point.y) ||
        !isFiniteNumber(point.boxX) ||
        !isFiniteNumber(point.boxY)
      ) {
        throw new Error(`Invalid layout leaf: ${key}`)
      }
      return [key, { x: point.x, y: point.y, boxX: point.boxX, boxY: point.boxY }]
    }),
  )
}

function sortedRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

// https://vite.dev/config/
export default defineConfig({
  base: '/profile/',
  plugins: [react(), localRoadmapLayoutPlugin()],
  define: {
    __APP_RELEASE_STAGE__: JSON.stringify(releaseStage),
    __APP_BUILD_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_HASH__: JSON.stringify(commitHash),
  },
})
