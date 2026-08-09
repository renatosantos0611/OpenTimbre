/**
 * Owns the update lifecycle for the desktop app: the typed status stream the
 * renderer renders (available / downloading / ready / error) and the two
 * explicit user decisions — download and restart-to-install.
 *
 * The seam exists because `electron-updater` does network + filesystem +
 * process-relaunch I/O that must never run under `node --test`: `createUpdater`
 * is pure orchestration over `UpdaterRuntime` (the rules, fixture-tested), and
 * only `createElectronUpdaterRuntime` touches electron-updater — through an
 * injectable loader, so its event mapping is fixture-tested too. Downloads and
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
 * The surface of electron-updater's `autoUpdater` this wrapper consumes —
 * small enough to drive from an EventEmitter-like fake under `node --test`
 * (injected via `createElectronUpdaterRuntime`'s loader).
 */
export type AutoUpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(): void
  on(channel: string, listener: (payload: unknown) => void): unknown
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
 * Loads electron-updater from the packaged main process. `createRequire`
 * instead of a static import: a static import would run electron-updater's
 * entry point the moment this module loads — including under `node --test`
 * for this module's tests — pulling in Electron internals that don't exist
 * outside the main process (same pattern as `renderer-protocol.ts`).
 */
function loadAutoUpdater(): AutoUpdaterLike {
  const require = createRequire(import.meta.url)
  return (require('electron-updater') as { autoUpdater: AutoUpdaterLike }).autoUpdater
}

/**
 * Thin wrapper over electron-updater's `autoUpdater`; `load` is injectable so
 * tests can drive the event mapping with a fake, defaulting to the lazy
 * `createRequire` load.
 */
export function createElectronUpdaterRuntime(load: () => AutoUpdaterLike = loadAutoUpdater): UpdaterRuntime {
  const autoUpdater = load()
  // Download only after the user confirms in the banner; a silent download
  // would burn bandwidth on updates the user may never install.
  autoUpdater.autoDownload = false
  // A downloaded update applies ONLY via the explicit install action (banner
  // Restart button -> `updater:install` IPC); quitting the app never installs
  // silently (user-ratified spec reading: restart-and-install needs an
  // explicit install message).
  autoUpdater.autoInstallOnAppQuit = false

  const listeners = new Set<(s: UpdaterStatus) => void>()
  const emit = (status: UpdaterStatus): void => {
    for (const cb of listeners) cb(status)
  }
  // True only while an explicit download is in flight. electron-updater
  // reports feed failures (unreachable feed, no release published yet,
  // offline boot) through the same `error` event as download failures; the
  // ratified contract is silence for those — no error banner may paint at
  // startup, so errors before any download never reach the renderer.
  let downloadInFlight = false
  autoUpdater.on('update-available', (payload) =>
    emit({ state: 'available', version: String((payload as { version: unknown }).version) }),
  )
  autoUpdater.on('download-progress', (payload) =>
    emit({ state: 'downloading', percent: Number((payload as { percent: unknown }).percent) }),
  )
  autoUpdater.on('update-downloaded', () => emit({ state: 'ready' }))
  // Only the short message crosses toward the renderer — never stack traces,
  // paths, or anything else the error object carries (opentimbre-secrets:
  // no sensitive material in IPC payloads).
  autoUpdater.on('error', (payload) => {
    if (!downloadInFlight) return
    downloadInFlight = false
    emit({ state: 'error', message: payload instanceof Error ? payload.message : String(payload) })
  })
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
      downloadInFlight = true
      // Reset the phase on either settlement: after a failed download the
      // user retries with the flag clean, and after success a later feed
      // error stays silent again.
      return autoUpdater.downloadUpdate().then(
        () => {
          downloadInFlight = false
        },
        (e) => {
          downloadInFlight = false
          throw e
        },
      )
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
