/** Creates the secure 420x700 desktop window and applies navigation lockdown. */
import { BrowserWindow, session } from './electron.ts'
import type { BrowserWindowType, Rectangle } from './electron.ts'
import { fileURLToPath } from 'node:url'
import { isTrustedNavigation } from './security.ts'

export const APP_ORIGIN = 'app://opentimbre'

export type WindowBounds = { x: number; y: number; width: number; height: number }

export function createMainWindow(opts: {
  alwaysOnTop: boolean
  bounds: Partial<WindowBounds>
  onBoundsChanged: (bounds: Rectangle) => void
}): BrowserWindowType {
  const window = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 520,
    x: opts.bounds.x,
    y: opts.bounds.y,
    show: false,
    alwaysOnTop: opts.alwaysOnTop,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      preload: fileURLToPath(new URL('../preload/preload.cjs', import.meta.url)),
    },
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, target) => {
    if (!isTrustedNavigation(target, APP_ORIGIN)) event.preventDefault()
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  window.on('move', () => opts.onBoundsChanged(window.getBounds()))
  window.on('resize', () => opts.onBoundsChanged(window.getBounds()))
  window.once('ready-to-show', () => window.show())
  void window.loadURL(`${APP_ORIGIN}/index.html`)
  return window
}
