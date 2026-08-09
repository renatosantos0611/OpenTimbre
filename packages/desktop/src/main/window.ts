/**
 * Creates the secure 678x864 desktop window and applies navigation lockdown.
 * Frameless: the OS title bar (app name) and the default File/Edit/View/Window
 * menu are replaced by the in-content hamburger row (`ot-titlebar`), which
 * already draws its own `-webkit-app-region: drag` strip. `titleBarStyle:
 * 'hidden'` keeps the native minimize/maximize/close buttons — Electron
 * composites them into `titleBarOverlay`'s reserved top-right area — instead
 * of hand-drawing a second set that would fight the OS over hover/snap
 * behavior.
 */
import { BrowserWindow, session } from './electron.ts'
import type { BrowserWindowType, Rectangle } from './electron.ts'
import { fileURLToPath } from 'node:url'
import { isTrustedNavigation } from './security.ts'

export const APP_ORIGIN = 'app://opentimbre'

export type WindowBounds = { x: number; y: number; width: number; height: number }

/** Matches `ot-titlebar`'s `:host { height: 40px }` so the overlay row lines up with it. */
export const TITLE_BAR_HEIGHT = 40

export type TitleBarOverlayColors = { color: string; symbolColor: string }

export function createMainWindow(opts: {
  alwaysOnTop: boolean
  bounds: Partial<WindowBounds>
  onBoundsChanged: (bounds: Rectangle) => void
  overlay: TitleBarOverlayColors
}): BrowserWindowType {
  const window = new BrowserWindow({
    width: 678,
    height: 864,
    minWidth: 360,
    minHeight: 520,
    x: opts.bounds.x,
    y: opts.bounds.y,
    show: false,
    alwaysOnTop: opts.alwaysOnTop,
    // Reuses the renderer's own icon asset (`public/icon.png`, copied into
    // `dist/renderer/browser/` by the Angular build and shown in the About
    // pane) instead of shipping a second copy just for the taskbar icon.
    icon: fileURLToPath(new URL('../renderer/browser/icon.png', import.meta.url)),
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...opts.overlay, height: TITLE_BAR_HEIGHT },
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
