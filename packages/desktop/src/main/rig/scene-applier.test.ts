import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AppliedScene, Rig } from '@opentimbre/contracts'
import type { MidiTransport } from '@opentimbre/core/src/ports/midi-transport.ts'
import { gojiraSpec } from '@opentimbre/core/src/plugins/gojira.ts'
import { planScene } from '@opentimbre/core/src/scenes/plan-scene.ts'
import { createSceneApplier, type SceneApplierClock } from './scene-applier.ts'

/** Records every send and lets the test force connect() to fail. */
function fakeTransport(connectError: string | null = null) {
  const sends: Array<[number, number]> = []
  const count = { value: 0 }
  const transport: MidiTransport = {
    async connect() {
      count.value++
      if (connectError) return { error: connectError }
      return { send: (cc, value) => sends.push([cc, value]) }
    },
  }
  return { transport, sends, connectCount: count }
}

/** A fake clock: the test advances time and the applier reads the current value. */
function fakeClock() {
  let now = 0
  const clock: SceneApplierClock = () => now
  return { clock, advance: (ms: number) => (now += ms) }
}

function rig(amp = 'CLN', plugin = 'gojira'): Rig {
  return {
    plugin,
    song: 'song',
    artist: 'artist',
    amp,
    note: '',
    scenes: {
      Verse: {
        title: 'Verse',
        summary: 's',
        explanation: 'e',
        guitar: { pickupPosition: 'bridge', volume: 8, tone: 6, technique: 'pick' },
        params: { gain: 6, bass: 4, mid: 5, treble: 6, output: 7, wowOn: true, wowMix: 5 },
      },
    },
  }
}

test('applies a scene: switches the amp, sends the planned CCs, and reports counts and time', async () => {
  const { clock, advance } = fakeClock()
  const sends: Array<[number, number]> = []
  // Each send advances the fake clock, so the applier's elapsed `ms` is measurable.
  const transport: MidiTransport = {
    connect: async () => ({ send: (cc, value) => { sends.push([cc, value]); advance(1) } }),
  }
  const applier = createSceneApplier({ transport, clock })
  applier.setRig(rig())

  const result = (await applier.apply('Verse')) as AppliedScene

  const expected = planScene(gojiraSpec, rig().scenes.Verse.params, 'CLN')
  // The catalog-declared strategy sends the amp selector first (CC 20 -> CLN=0),
  // then the planned knob CCs.
  assert.deepEqual(sends, [[20, 0], ...expected.map((c) => [c.cc, c.value])])
  assert.equal(result.scene, 'Verse')
  assert.equal(result.amp, 'CLN')
  assert.equal(result.ccsSent, expected.length, 'ccsSent counts the scene plan, not the selector')
  assert.equal(result.ms, expected.length, 'elapsed ms measures the plan loop; the selector goes out before it')
  assert.deepEqual(result.warnings, [], 'a MIDI-switched amp leaves no manual instruction')
})

test('an unmapped amp falls back to a mapped one and surfaces the warning', async () => {
  const { transport, sends } = fakeTransport()
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })
  const r = rig('UNMAPPED')
  applier.setRig(r)

  const result = (await applier.apply('Verse')) as AppliedScene

  assert.equal(result.amp, 'CLN', 'falls back to the first mapped amp')
  assert.ok(result.warnings.some((w) => /no mapped knobs/.test(w)), 'resolveAmp warning surfaces')
  assert.deepEqual(sends[0], [20, 0], 'the selector switches to the RESOLVED amp, not the unmapped request')
})

test('a missing scene is a contained failure', async () => {
  const { transport, sends } = fakeTransport()
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })
  applier.setRig(rig())

  const result = await applier.apply('NoSuchScene')

  assert.ok('error' in result)
  assert.equal(sends.length, 0, 'nothing is sent for a missing scene')
})

test('no rig loaded is a contained failure', async () => {
  const { transport, sends } = fakeTransport()
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })

  const result = await applier.apply('Verse')

  assert.ok('error' in result)
  assert.equal(sends.length, 0)
})

test('an unknown plugin in the rig is a contained failure', async () => {
  const { transport, sends } = fakeTransport()
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })
  applier.setRig(rig('CLN', 'not-a-plugin'))

  const result = await applier.apply('Verse')

  assert.ok('error' in result)
  assert.equal(sends.length, 0)
})

test('connect() reports the real MIDI state without a loaded rig or an apply', async () => {
  const { transport, connectCount } = fakeTransport()
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })

  assert.deepEqual(applier.midiState(), { port: null, error: null }, 'unknown before the first connect attempt')

  await applier.connect()

  assert.deepEqual(applier.midiState(), { port: 'VoiceRig', error: null })
  assert.equal(connectCount.value, 1)
})

test('connect() surfaces a failed connection without a loaded rig', async () => {
  const { transport } = fakeTransport('Port not found. Create it in loopMIDI.')
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })

  await applier.connect()

  assert.deepEqual(applier.midiState(), { port: null, error: 'Port not found. Create it in loopMIDI.' })
})

test('a disconnected MIDI port fails the apply and sends nothing', async () => {
  const { transport, sends, connectCount } = fakeTransport('Port not found. Create it in loopMIDI.')
  const applier = createSceneApplier({ transport, clock: fakeClock().clock })
  applier.setRig(rig())

  const result = await applier.apply('Verse')

  assert.ok('error' in result)
  assert.match((result as { error: string }).error, /Port not found/)
  assert.equal(sends.length, 0, 'a failed connect sends no CCs')
  assert.equal(connectCount.value, 1, 'connect is attempted once')
})