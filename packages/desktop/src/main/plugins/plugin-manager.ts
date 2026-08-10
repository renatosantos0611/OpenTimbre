/**
 * Owns catalog-derived plugin state and the plugin lifecycle actions the
 * renderer calls over IPC. Every plugin id is resolved through `CATALOG` —
 * paths, names, mappings, and CCs never get copied into the desktop; the
 * `PluginHost` already knows them via the spec (see `opentimbre-plugin-spec`).
 *
 * The manager also owns the status polling tied to the window lifecycle: a
 * `setInterval` walks the catalog and emits `plugin:changed` only when a
 * plugin's state differs from the last known one, so an unchanged plugin
 * never re-paints the Settings screen. The timer is injectable so tests can
 * drive polls deterministically without a real clock.
 *
 * The `setInterval`/`clearInterval` pair is injected rather than the manager
 * calling the globals directly, and `onChanged` returns an unsubscribe
 * function, so tests can fire polls on demand and registerers can detach —
 * see `opentimbre-testing` and `opentimbre-electron-ipc`'s push-channel rule.
 */
import type { PluginState, Result } from '@opentimbre/contracts'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import type { PluginSpec } from '@opentimbre/core/src/plugins/types.ts'
import type { PluginHost } from '@opentimbre/platform-node/src/plugin-host.ts'

/** How long between polls. A named constant so the window wiring can read intent. */
const POLL_INTERVAL_MS = 5000

/** The tiny `setInterval` surface the manager needs, injectable for tests. */
export type PluginManagerTimer = {
  setInterval(callback: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

const defaultTimer: PluginManagerTimer = {
  setInterval: (cb, ms) => setInterval(cb, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

export type PluginManagerOptions = {
  host: PluginHost
  /** Directory holding `<spec.app.mapping>` files, passed to the host on install. */
  mappingDir: string
  timer?: PluginManagerTimer
}

export type PluginManager = {
  start(): void
  stop(): void
  onChanged(callback: (state: PluginState) => void): () => void
  getState(id: string): Promise<Result<PluginState>>
  open(id: string): Promise<Result<PluginState>>
  installMapping(id: string): Promise<Result<PluginState>>
}

/** Two states are "the same" for the renderer when these fields all match. */
function sameState(a: PluginState, b: PluginState): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.installed === b.installed &&
    a.path === b.path &&
    a.running === b.running &&
    a.mappingStatus === b.mappingStatus
  )
}

export function createPluginManager(options: PluginManagerOptions): PluginManager {
  const { host, mappingDir } = options
  const timer = options.timer ?? defaultTimer

  const lastKnown = new Map<string, PluginState>()
  const listeners = new Set<(state: PluginState) => void>()
  let pollHandle: unknown = null

  function emit(state: PluginState): void {
    for (const listener of listeners) listener(state)
  }

  /** Records a state as current so the next poll won't treat it as a change. */
  function noteCurrent(state: PluginState): void {
    lastKnown.set(state.id, state)
  }

  /** Resolves an id through the catalog — a miss is a failure, never a throw. */
  function resolve(specId: string): Result<PluginSpec> {
    const spec = CATALOG.find((c) => c.id === specId)
    if (!spec) return { error: `Unknown plugin id '${specId}'.` }
    return spec
  }

  async function poll(): Promise<void> {
    for (const spec of CATALOG) {
      const state = await host.inspect(spec)
      const known = lastKnown.get(spec.id)
      if (known === undefined || !sameState(state, known)) {
        noteCurrent(state)
        emit(state)
      }
    }
  }

  return {
    start() {
      if (pollHandle !== null) return // a second window must not double the polling
      void poll() // immediate first poll so the renderer has states before the AI suggests a plugin
      pollHandle = timer.setInterval(() => void poll(), POLL_INTERVAL_MS)
    },
    stop() {
      if (pollHandle !== null) {
        timer.clearInterval(pollHandle)
        pollHandle = null
      }
    },
    onChanged(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    async getState(id) {
      const resolved = resolve(id)
      if ('error' in resolved) return resolved
      const state = await host.inspect(resolved)
      noteCurrent(state)
      return state
    },
    async open(id) {
      const resolved = resolve(id)
      if ('error' in resolved) return resolved
      const result = await host.launch(resolved)
      if (!('error' in result)) noteCurrent(result)
      return result
    },
    async installMapping(id) {
      const resolved = resolve(id)
      if ('error' in resolved) return resolved
      const result = await host.installMapping(resolved, `${mappingDir}/${resolved.app.mapping}`)
      noteCurrent(result)
      return result
    },
  }
}