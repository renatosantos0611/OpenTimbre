/**
 * Serves the bundled Angular renderer over the privileged `app` scheme so the
 * window's `app://opentimbre/index.html` navigation actually loads. The path
 * resolver is pure — no Electron, no I/O — so the traversal defenses are
 * unit-testable under plain `node --test`; only the registration below
 * touches Electron.
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export type RendererAsset = { file: string; contentType: string }

/** The only extensions the renderer bundle may serve, with their MIME types. */
const CONTENT_TYPES = new Map<string, string>([
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.css', 'text/css'],
  ['.json', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
])

/**
 * Maps an `app://` request pathname to the bundle file it may serve, or null
 * when the request escapes `rendererDir`, carries an unknown extension, or is
 * malformed — the caller turns null into a 404.
 */
export function resolveRendererAsset(pathname: string, rendererDir: string): RendererAsset | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  // Backslashes are never legitimate URL separators in the bundle and are the
  // classic Windows traversal vector; null bytes truncate paths in some layers.
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const root = path.resolve(rendererDir)
  // Leading `./` neutralizes absolute-looking inputs so they land inside root.
  const relative = decoded === '/' ? './index.html' : `.${decoded}`
  const file = path.resolve(root, relative)
  if (file !== root && !file.startsWith(root + path.sep)) return null
  const contentType = CONTENT_TYPES.get(path.extname(file).toLowerCase())
  if (!contentType) return null
  return { file, contentType }
}

/**
 * Routes every `app://` request through the resolver. `electron` is loaded
 * via `createRequire` instead of a static import: a static import would run
 * the npm `electron` package's entry point the moment this module loads —
 * including under `node --test` for the resolver tests — where it exports a
 * binary path string instead of the API (see `windows.ts` for the same
 * pattern). Inside the real main process the require resolves to Electron's
 * API object.
 */
export function registerRendererProtocol(rendererDir: string): void {
  const require = createRequire(import.meta.url)
  const { net, protocol } = require('electron') as typeof import('electron')
  protocol.handle('app', async (request) => {
    const asset = resolveRendererAsset(new URL(request.url).pathname, rendererDir)
    if (!asset) return new Response('not found', { status: 404 })
    const fetched = await net.fetch(pathToFileURL(asset.file).href)
    return new Response(fetched.body, { status: fetched.status, headers: { 'content-type': asset.contentType } })
  })
}
