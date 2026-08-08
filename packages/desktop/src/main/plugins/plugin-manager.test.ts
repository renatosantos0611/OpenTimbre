import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PluginState, Result } from '@opentimbre/contracts'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import type { PluginHost } from '@opentimbre/platform-node/src/plugin-host.ts'
import { createPluginManager, type PluginManagerTimer } from './plugin-manager.ts'

/** A catalog-shaped state for an id, so fakes can return something plausible. */
function stateFor(id: string): PluginState {
  const spec = CATALOG.find((c) => c.id === id) ?? { id, name: id }
  return {
    id: spec.id,
    name: spec.name,
    installed: true,
    path: `/apps/${id}`,
    running: false,
    mappingStatus: 'ok',
  }
}

/** A host whose per-id result is controllable, recording every call it receives. */
function controllableHost() {
  const states = new Map<string, PluginState>()
  const calls: string[] = []
  const host: PluginHost = {
    async inspect(spec) {
      calls.push(`inspect:${spec.id}`)
      return states.get(spec.id) ?? stateFor(spec.id)
    },
    async launch(spec) {
      calls.push(`open:${spec.id}`)
      return states.get(spec.id) ?? stateFor(spec.id)
    },
    async installMapping(spec) {
      calls.push(`map:${spec.id}`)
      return states.get(spec.id) ?? stateFor(spec.id)
    },
  }
  return {
    host,
    calls,
    setState: (id: string, s: PluginState) => states.set(id, s),
  }
}

/** A `setInterval` twin that records the callback and lets the test fire it. */
function fakeTimer() {
  let cb: (() => void) | null = null
  const handle = {}
  const timer: PluginManagerTimer = {
    setInterval: (c) => {
      cb = c
      return handle
    },
    clearInterval: (h) => {
      if (h === handle) cb = null
    },
  }
  // `poll` is async and emits in microtasks after its awaited `inspect` calls,
  // so a real macrotask turn is needed before the emits are observable.
  const tick = async () => {
    cb?.()
    await new Promise((resolve) => setImmediate(resolve))
  }
  return { timer, tick }
}

function manager(timer: PluginManagerTimer, host: PluginHost, mappingDir = '/mappings') {
  return createPluginManager({ host, mappingDir, timer })
}

test('routes every catalog plugin through one manager to the host', async () => {
  const { host, calls } = controllableHost()
  const mgr = manager(fakeTimer().timer, host)

  for (const spec of CATALOG) {
    const get = await mgr.getState(spec.id)
    assert.equal((get as PluginState).id, spec.id, `${spec.id} getState resolves through the catalog`)
    const open = await mgr.open(spec.id)
    assert.equal((open as PluginState).id, spec.id, `${spec.id} open resolves through the catalog`)
    const map = await mgr.installMapping(spec.id)
    assert.equal((map as PluginState).id, spec.id, `${spec.id} installMapping resolves through the catalog`)
  }

  assert.equal(calls.length, CATALOG.length * 3)
  for (const spec of CATALOG) {
    assert.ok(calls.includes(`inspect:${spec.id}`), `poll walks ${spec.id}`)
    assert.ok(calls.includes(`open:${spec.id}`), `${spec.id} opens`)
    assert.ok(calls.includes(`map:${spec.id}`), `${spec.id} installs a mapping`)
  }
})

test('an unknown plugin id is a contained failure, never a throw', async () => {
  const { host } = controllableHost()
  const mgr = manager(fakeTimer().timer, host)

  for (const op of ['getState', 'open', 'installMapping'] as const) {
    const result = (await mgr[op]('not-a-plugin')) as Result<PluginState>
    assert.ok('error' in result, `${op} returns a failure for an unknown id`)
    assert.equal(typeof result.error, 'string')
  }
})

test('open and installMapping return the host result directly on failure', async () => {
  const { host, setState } = controllableHost()
  const mgr = manager(fakeTimer().timer, host)
  setState(CATALOG[0].id, { ...stateFor(CATALOG[0].id), mappingStatus: 'missing' })

  const open = await mgr.open(CATALOG[0].id)
  assert.equal((open as PluginState).mappingStatus, 'missing', 'open returns the host inspect result')

  const map = await mgr.installMapping(CATALOG[0].id)
  assert.equal((map as PluginState).mappingStatus, 'missing', 'installMapping returns the host inspect result')
})

test('polling emits plugin:changed only when a state differs from the last known', async () => {
  const { host, setState } = controllableHost()
  const { timer, tick } = fakeTimer()
  const mgr = manager(timer, host)
  const emitted: string[] = []
  mgr.onChanged((s) => emitted.push(s.id))

  mgr.start()
  await tick() // baseline: all states go from "unknown" to their current value
  assert.equal(emitted.length, CATALOG.length, 'first poll emits every plugin once')

  await tick() // nothing changed since the last poll
  assert.equal(emitted.length, CATALOG.length, 'a poll with no change emits nothing')

  setState(CATALOG[0].id, { ...stateFor(CATALOG[0].id), running: true })
  await tick()
  assert.equal(emitted.length, CATALOG.length + 1, 'a poll with one change emits only that plugin')
  assert.equal(emitted[emitted.length - 1], CATALOG[0].id)

  await tick()
  assert.equal(emitted.length, CATALOG.length + 1, 'the now-known unchanged state emits nothing again')
})

test('an operation updates the last-known state so polling does not re-emit it', async () => {
  const { host, setState } = controllableHost()
  const { timer, tick } = fakeTimer()
  const mgr = manager(timer, host)
  const emitted: string[] = []
  mgr.onChanged((s) => emitted.push(s.id))

  const id = CATALOG[0].id
  const current = await mgr.getState(id)
  assert.equal((current as PluginState).running, false, 'getState returns the host state')

  mgr.start()
  await tick() // poll sees the surfaced state as known; the other three are new
  assert.ok(!emitted.includes('gojira'), 'poll does not re-emit a state the operation already returned')
  assert.equal(emitted.length, CATALOG.length - 1, 'only the never-surfaced plugins emit on the first poll')

  setState(id, { ...stateFor(id), running: true })
  await tick()
  assert.ok(emitted.includes(id), 'a real change still emits once')
  assert.equal(emitted.length, CATALOG.length, 'after the change every plugin is known')
})

test('start is idempotent and stop stops polling', async () => {
  const { host } = controllableHost()
  const { timer, tick } = fakeTimer()
  const mgr = manager(timer, host)
  const emitted: string[] = []
  mgr.onChanged((s) => emitted.push(s.id))

  mgr.start()
  mgr.start() // a second window must not schedule a second interval
  await tick()
  const firstPoll = emitted.length
  assert.equal(firstPoll, CATALOG.length)

  mgr.stop()
  await tick()
  assert.equal(emitted.length, firstPoll, 'after stop, a tick emits nothing')
})