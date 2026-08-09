import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UpdaterStatus } from '@opentimbre/contracts'
import { createElectronUpdaterRuntime, createUpdater, inertUpdaterRuntime, type AutoUpdaterLike, type UpdaterRuntime } from './updater.ts'

/** Recorded push sent toward the renderer window. */
type Sent = { channel: string; payload: unknown }

type FakeRuntime = UpdaterRuntime & {
  emit(status: UpdaterStatus): void
  downloads(): number
  installs(): number
  failNextDownload(message: string): void
}

/**
 * The runtime is the I/O boundary (electron-updater) — legitimately faked per
 * `opentimbre-testing`. It records statuses emitted and lets each test script
 * the download outcome.
 */
function fakeRuntime(): FakeRuntime {
  const listeners = new Set<(s: UpdaterStatus) => void>()
  let downloads = 0
  let installs = 0
  let failure: string | null = null
  return {
    checkForUpdates() {},
    async downloadUpdate() {
      downloads++
      if (failure) throw new Error(failure)
    },
    quitAndInstall() {
      installs++
    },
    onStatus(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    emit(status) {
      for (const cb of listeners) cb(status)
    },
    downloads: () => downloads,
    installs: () => installs,
    failNextDownload(message) {
      failure = message
    },
  }
}

function recorder(): { sent: Sent[]; send: (channel: string, payload: unknown) => void } {
  const sent: Sent[] = []
  return { sent, send: (channel, payload) => sent.push({ channel, payload }) }
}

test('runtime statuses reach the renderer verbatim as updater:status', () => {
  const runtime = fakeRuntime()
  const { sent, send } = recorder()
  createUpdater({ runtime, send })
  runtime.emit({ state: 'available', version: '3.1.0' })
  runtime.emit({ state: 'downloading', percent: 42 })
  runtime.emit({ state: 'ready' })
  assert.deepEqual(sent, [
    { channel: 'updater:status', payload: { state: 'available', version: '3.1.0' } },
    { channel: 'updater:status', payload: { state: 'downloading', percent: 42 } },
    { channel: 'updater:status', payload: { state: 'ready' } },
  ])
})

test('a runtime error status reaches the renderer so the banner can offer retry', () => {
  const runtime = fakeRuntime()
  const { sent, send } = recorder()
  createUpdater({ runtime, send })
  runtime.emit({ state: 'error', message: 'feed unreachable' })
  assert.deepEqual(sent, [{ channel: 'updater:status', payload: { state: 'error', message: 'feed unreachable' } }])
})

test('download success resolves and delegates to the runtime exactly once', async () => {
  const runtime = fakeRuntime()
  const { send } = recorder()
  const updater = createUpdater({ runtime, send })
  await assert.doesNotReject(() => updater.download())
  assert.equal(runtime.downloads(), 1)
})

test('download failure notifies the renderer AND rejects', async () => {
  const runtime = fakeRuntime()
  runtime.failNextDownload('network down')
  const { sent, send } = recorder()
  const updater = createUpdater({ runtime, send })
  // Without the status push the banner stays stuck on the spinner while the
  // invoke already failed; without the rejection the handler answers success.
  await assert.rejects(() => updater.download(), /network down/)
  assert.deepEqual(sent, [{ channel: 'updater:status', payload: { state: 'error', message: 'network down' } }])
})

test('install delegates to quitAndInstall', () => {
  const runtime = fakeRuntime()
  const { send } = recorder()
  const updater = createUpdater({ runtime, send })
  updater.install()
  assert.equal(runtime.installs(), 1)
})

test('the inert runtime never emits a status — dev runs and portable stay silent', async () => {
  const runtime = inertUpdaterRuntime()
  const statuses: UpdaterStatus[] = []
  const unsubscribe = runtime.onStatus((s) => statuses.push(s))
  runtime.checkForUpdates()
  await runtime.downloadUpdate()
  runtime.quitAndInstall()
  assert.equal(statuses.length, 0)
  unsubscribe()
})

// ── electron-updater wrapper (loader seam) ─────────────────────────────
// `createElectronUpdaterRuntime` takes an injectable loader so these tests
// drive the real event mapping with an EventEmitter-like fake — no Electron and
// no network, per `opentimbre-testing`.

/** A scriptable `AutoUpdaterLike`: record listeners, fire events, settle the in-flight download. */
function fakeAutoUpdater(): AutoUpdaterLike & {
  fire(channel: string, payload: unknown): void
  settleDownload(outcome: 'resolve' | 'reject', error?: Error): void
} {
  const listeners = new Map<string, ((payload: unknown) => void)[]>()
  let resolveDownload: (() => void) | null = null
  let rejectDownload: ((e: Error) => void) | null = null
  return {
    // Start both on to prove the wrapper forces them off.
    autoDownload: true,
    autoInstallOnAppQuit: true,
    checkForUpdates() {
      return Promise.resolve()
    },
    downloadUpdate() {
      return new Promise<void>((resolve, reject) => {
        resolveDownload = () => resolve()
        rejectDownload = (e) => reject(e)
      })
    },
    quitAndInstall() {},
    on(channel, listener) {
      const list = listeners.get(channel) ?? []
      list.push(listener)
      listeners.set(channel, list)
      return undefined
    },
    fire(channel, payload) {
      for (const l of listeners.get(channel) ?? []) l(payload)
    },
    settleDownload(outcome, error) {
      if (outcome === 'resolve') resolveDownload?.()
      else rejectDownload?.(error ?? new Error('download failed'))
    },
  }
}

test('the electron runtime forces autoDownload and autoInstallOnAppQuit off', () => {
  const fake = fakeAutoUpdater()
  createElectronUpdaterRuntime(() => fake)
  // Download only on explicit confirm; install only on the explicit restart
  // action — never on quit.
  assert.equal(fake.autoDownload, false)
  assert.equal(fake.autoInstallOnAppQuit, false)
})

test('a feed error before any download is silent — no error banner at boot', () => {
  const fake = fakeAutoUpdater()
  const runtime = createElectronUpdaterRuntime(() => fake)
  const statuses: UpdaterStatus[] = []
  runtime.onStatus((s) => statuses.push(s))
  runtime.checkForUpdates()
  // Unreachable feed / no release yet surface as an `error` event pre-download
  // — the ratified contract swallows them.
  fake.fire('error', new Error('net::ERR_NAME_NOT_RESOLVED'))
  fake.fire('update-not-available', undefined)
  assert.equal(statuses.length, 0)
})

test('an error during an in-flight download reaches the renderer', async () => {
  const fake = fakeAutoUpdater()
  const runtime = createElectronUpdaterRuntime(() => fake)
  const statuses: UpdaterStatus[] = []
  runtime.onStatus((s) => statuses.push(s))
  const pending = runtime.downloadUpdate()
  fake.fire('error', new Error('interrupted download'))
  fake.settleDownload('reject', new Error('interrupted download'))
  await assert.rejects(() => pending, /interrupted download/)
  assert.deepEqual(statuses, [{ state: 'error', message: 'interrupted download' }])
})

test('available/downloading/ready map through unchanged; not-available sends nothing', () => {
  const fake = fakeAutoUpdater()
  const runtime = createElectronUpdaterRuntime(() => fake)
  const statuses: UpdaterStatus[] = []
  runtime.onStatus((s) => statuses.push(s))
  fake.fire('update-available', { version: '9.9.9' })
  fake.fire('download-progress', { percent: 42.5 })
  fake.fire('update-downloaded', undefined)
  fake.fire('update-not-available', undefined)
  assert.deepEqual(statuses, [
    { state: 'available', version: '9.9.9' },
    { state: 'downloading', percent: 42.5 },
    { state: 'ready' },
  ])
})

test('after a failed download the phase resets, so the retry surfaces its failure', async () => {
  const fake = fakeAutoUpdater()
  const runtime = createElectronUpdaterRuntime(() => fake)
  const statuses: UpdaterStatus[] = []
  runtime.onStatus((s) => statuses.push(s))
  // First attempt fails; the wrapper reports it and clears the phase.
  const first = runtime.downloadUpdate()
  fake.fire('error', new Error('first attempt failed'))
  fake.settleDownload('reject', new Error('first attempt failed'))
  await assert.rejects(() => first, /first attempt failed/)
  // A stray feed error between attempts stays silent — phase was reset.
  fake.fire('error', new Error('transient feed blip'))
  // Second attempt must not be swallowed by the earlier failure.
  const second = runtime.downloadUpdate()
  fake.fire('error', new Error('second attempt failed'))
  fake.settleDownload('reject', new Error('second attempt failed'))
  await assert.rejects(() => second, /second attempt failed/)
  assert.deepEqual(statuses, [
    { state: 'error', message: 'first attempt failed' },
    { state: 'error', message: 'second attempt failed' },
  ])
})
