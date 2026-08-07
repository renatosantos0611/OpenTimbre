/** Creates the secure 420x700 desktop window and applies navigation lockdown. */
import { BrowserWindow, session } from 'electron'
import { fileURLToPath } from 'node:url'
import { isTrustedNavigation } from './security.ts'

export const APP_ORIGIN = 'app://opentimbre'

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 520,
    show: false,
    alwaysOnTop: true,
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
  window.once('ready-to-show', () => window.show())
  void window.loadURL(`${APP_ORIGIN}/index.html`)
  return window
}
