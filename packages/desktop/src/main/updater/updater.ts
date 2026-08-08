/**
 * Owns the update lifecycle for the desktop app: the typed status stream the
 * renderer renders (available / downloading / ready / error) and the two
 * explicit user decisions — download and restart-to-install.
 *
 * The seam exists because `electron-updater` does network + filesystem +
 * process-relaunch I/O that must never run under `node --test`: `createUpdater`
 * is pure orchestration over `UpdaterRuntime` (the rules, fixture-tested), and
 * only `createElectronUpdaterRuntime` touches electron-updater. Downloads and
 * installs happen solely on explicit renderer confirmation — nothing here
 * installs silently (see the phase 4 spec, update service).
 */
import { createRequire } from 'node:module'
import type { UpdaterStatus } from '@opentimbre/contracts'

export type UpdaterRuntime = {
  checkForUpdates(): void
  downloadUpdate(): Promise<void>
  quitAndInstall(): void
  onStatus(cb: (s: UpdaterStatus) => void): () => void
}

export type Updater = {
  download(): Promise<void>
  install(): void
}

/**
 * Forwards every runtime status verbatim over `send` as `updater:status` and
 * exposes the two confirmed actions. `download()` rejects after emitting the
 * error status so the IPC handler can also answer `Result { error }` — the
 * banner needs the push, the invoke needs the rejection.
 */
export function createUpdater(deps: {
  runtime: UpdaterRuntime
  send: (channel: string, payload: unknown) => void
}): Updater {
  deps.runtime.onStatus((status) => deps.send('updater:status', status))
  return {
    async download() {
      try {
        await deps.runtime.downloadUpdate()
      } catch (e) {
        deps.send('updater:status', { state: 'error', message: e instanceof Error ? e.message : String(e) })
        throw e
      }
    },
    install() {
      deps.runtime.quitAndInstall()
    },
  }
}

/**
 * Thin wrapper over electron-updater's `autoUpdater`. Loaded via
 * `createRequire` instead of a static import: a static import would run
 * electron-updater's entry point the moment this module loads — including
 * under `node --test` for the `createUpdater` tests — pulling in Electron
 * internals that don't exist outside the main process (same pattern as
 * `renderer-protocol.ts`).
 */
export function createElectronUpdaterRuntime(): UpdaterRuntime {
  const require = createRequire(import.meta.url)
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
  // Download only after the user confirms in the banner; a silent download
  // would burn bandwidth on updates the user may never install.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const listeners = new Set<(s: UpdaterStatus) => void>()
  const emit = (status: UpdaterStatus): void => {
    for (const cb of listeners) cb(status)
  }
  autoUpdater.on('update-available', (info) => emit({ state: 'available', version: String(info.version) }))
  autoUpdater.on('download-progress', (progress) => emit({ state: 'downloading', percent: Number(progress.percent) }))
  autoUpdater.on('update-downloaded', () => emit({ state: 'ready' }))
  // Only the short message crosses toward the renderer — never stack traces,
  // paths, or anything else the error object carries (opentimbre-secrets:
  // no sensitive material in IPC payloads).
  autoUpdater.on('error', (e) => emit({ state: 'error', message: e instanceof Error ? e.message : String(e) }))
  return {
    checkForUpdates() {
      // Feed or network failure must never throw into the app lifecycle —
      // the app boots the same way with or without a reachable update feed.
      try {
        void Promise.resolve(autoUpdater.checkForUpdates()).catch(() => undefined)
      } catch {
        /* silence: an unreachable feed is not a startup error */
      }
    },
    downloadUpdate() {
      return autoUpdater.downloadUpdate().then(() => undefined)
    },
    quitAndInstall() {
      autoUpdater.quitAndInstall()
    },
    onStatus(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}

/**
 * Dev runs and the portable build get silence through the same seam — no
 * checks, no events — so the renderer's update code path never branches on
 * how the app was launched.
 */
export function inertUpdaterRuntime(): UpdaterRuntime {
  return {
    checkForUpdates() {},
    downloadUpdate() {
      return Promise.resolve()
    },
    quitAndInstall() {},
    onStatus() {
      return () => {}
    },
  }
}
