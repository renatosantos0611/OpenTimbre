/**
 * The only thing the page may reach from the preload world. Declared here so
 * `DesktopService` can reference `window.api` typed; the value is written by
 * `contextBridge.exposeInMainWorld('api', ...)` in `preload.cts` before
 * Angular bootstraps. Every other module imports the type, never `window`.
 */
import type { DesktopApi } from '@opentimbre/contracts'

declare global {
  interface Window {
    api: DesktopApi
  }
}

export {}