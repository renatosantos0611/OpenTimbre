#!/usr/bin/env node
/**
 * Minimal static file server for the built renderer (`dist/renderer/browser`),
 * used by the Playwright e2e. The Angular output is a fully static SPA: this
 * serves index.html, the hashed JS/CSS, and the bundled Fontsource assets with
 * the MIME types Chromium needs. Nothing here is part of the app runtime.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/renderer/browser', import.meta.url))
const port = Number(process.env.E2E_PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '')
    const filePath = normalize(join(root, relative))
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('forbidden')
      return
    }
    const body = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`serving renderer on http://localhost:${port}`))