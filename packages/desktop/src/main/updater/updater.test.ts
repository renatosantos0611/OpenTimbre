import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UpdaterStatus } from '@opentimbre/contracts'
import { createUpdater, inertUpdaterRuntime, type UpdaterRuntime } from './updater.ts'

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
