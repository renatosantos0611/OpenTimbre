/**
 * Characterization tests for `types.ts`: the 0-10 <-> 0-127 scales,
 * `resolveAmp`'s fallback, and the three amp-switching strategies.
 *
 * Uses a fake `PluginSpec`, not a catalog entry — the catalog is empty in
 * this task (no plugin data ported yet), and per `opentimbre-testing`
 * behavior tests belong on a fixture anyway: tying them to real CC numbers
 * would make every future probe-session correction break this suite.
 * `catalog-invariants.test.ts` is what walks the real `CATALOG`.
 *
 * Scene translation itself (`planScene`, turning a `Scene` into a list of CC
 * messages) is a later task — out of scope here.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  getAmpStrategy,
  knobToMidi,
  resolveAmp,
  toggleToMidi,
  type PluginSpec,
  type Send,
} from './types.ts'

// ------------------------------------------------------------------ fixture

/**
 * `ampCore` is just `['gain']`, so amp A and amp B are BOTH mapped (each has
 * a `gain` CC) — A additionally has `bright` mapped, but that's a non-core
 * extra irrelevant to mapped status. Amp C has no CC entries at all, so it's
 * unmapped. Two mapped amps (interchangeable as a fallback target) plus one
 * unmapped amp is what lets the fallback tests exercise "target amp isn't
 * mapped, falls back to a mapped one" without the fixture itself deciding
 * which mapped amp "should" win.
 */
const FAKE: PluginSpec = {
  id: 'fake',
  name: 'Test Plugin',
  whenToUse: 'never — this is a fixture',
  signalChain: 'OD -> AMP -> RVB',
  doc: 'missing.md',

  amps: ['A', 'B', 'C'],
  ampDescriptions: { A: 'amp a', B: 'amp b', C: 'amp c' },
  ampSelect: { cc: 20, values: { A: 0, B: 64, C: 127 } },
  ampCore: ['gain'],
  ampParams: {
    gain: { type: 'knob', required: true, desc: 'gain' },
    bright: { type: 'toggle', required: false, desc: 'brightness' },
  },
  ampCC: {
    A: { gain: 21, bright: 22 },
    B: { gain: 31 },
    // C: no entry at all -> unmapped.
  },
  params: {
    odOn: { cc: 40, type: 'toggle', required: true, desc: 'drive on' },
  },
  groups: { odOn: [] },
  alwaysOn: { sectionA: 110 },

  app: {
    candidates: { win32: ['C:\\fake.exe'] },
    process: 'fake.exe',
    settings: 'fake',
    midiFolder: 'MIDI',
    mapping: 'fake.xml',
  },
}

/** Same as FAKE, but no amp at all satisfies `ampCore`. */
const NO_AMP_MAPPED: PluginSpec = { ...FAKE, ampCC: {} }

/** Records every CC/value pair a strategy sends, in order. */
function recordedSend(): { send: Send; calls: { cc: number; value: number }[] } {
  const calls: { cc: number; value: number }[] = []
  return { send: (cc, value) => calls.push({ cc, value }), calls }
}

// ------------------------------------------------------------------ scales

describe('knobToMidi', () => {
  test('maps the ends of the range: 0 -> 0, 10 -> 127', () => {
    assert.equal(knobToMidi(0), 0)
    assert.equal(knobToMidi(10), 127)
  })

  test('follows the round(v * 12.7) formula in the middle of the range', () => {
    assert.equal(knobToMidi(5), 64) // 5 * 12.7 = 63.5, rounds up to 64
    assert.equal(knobToMidi(3), 38) // 3 * 12.7 = 38.1, rounds down to 38
  })

  test('clamps out-of-range input instead of overflowing 0-127', () => {
    assert.equal(knobToMidi(-1), 0)
    assert.equal(knobToMidi(11), 127)
  })
})

describe('toggleToMidi', () => {
  test('is 0 or 127, never a middle value', () => {
    assert.equal(toggleToMidi(true), 127)
    assert.equal(toggleToMidi(false), 0)
  })
})

// -------------------------------------------------------------- resolveAmp

describe('resolveAmp', () => {
  test('a mapped target amp is returned as-is, with no warning', () => {
    const resolved = resolveAmp(FAKE, 'A')
    assert.deepEqual(resolved, { amp: 'A', warning: null })
  })

  test('an unmapped target falls back to the first mapped amp, naming both in the warning', () => {
    const resolved = resolveAmp(FAKE, 'C')
    assert.equal(resolved.amp, 'A')
    assert.match(resolved.warning ?? '', /C/)
    assert.match(resolved.warning ?? '', /A/)
  })

  test('no amp mapped at all returns the target unchanged, with a warning saying so', () => {
    const resolved = resolveAmp(NO_AMP_MAPPED, 'B')
    assert.equal(resolved.amp, 'B', 'nothing to fall back to — the target passes through')
    assert.match(resolved.warning ?? '', /no amp has mapped knobs/)
  })
})

// ---------------------------------------------------------- amp strategies

describe("amp strategy 'continuous'", () => {
  test('sends exactly one CC value: the selector CC at the target amp\u2019s value', () => {
    const strategy = getAmpStrategy(FAKE, 'continuous')
    const { send, calls } = recordedSend()

    const instruction = strategy.apply('B', send)

    assert.equal(instruction, null)
    assert.deepEqual(calls, [{ cc: 20, value: 64 }])
  })

  test('an amp missing from the selector values fails instead of sending garbage', () => {
    const strategy = getAmpStrategy(FAKE, 'continuous')
    const { send, calls } = recordedSend()

    const instruction = strategy.apply('nonexistent', send)

    assert.match(instruction ?? '', /nonexistent/)
    assert.deepEqual(calls, [])
  })
})

describe("amp strategy 'increment'", () => {
  test('pulses the selector CC once per position of distance', () => {
    const strategy = getAmpStrategy(FAKE, 'increment')
    const { send, calls } = recordedSend()

    // Starts at amps[0] = 'A'; 'B' is one position away.
    strategy.apply('B', send)

    assert.deepEqual(calls, [
      { cc: 20, value: 127 },
      { cc: 20, value: 0 },
    ])
  })

  test('wraps around the end of the amp list', () => {
    const strategy = getAmpStrategy(FAKE, 'increment')
    const first = recordedSend()
    strategy.apply('C', first.send) // A -> C: 2 positions forward, current is now C

    const second = recordedSend()
    strategy.apply('A', second.send) // C -> A: wraps forward 1 position (not back 2)

    const pulses = second.calls.filter((c) => c.value === 127).length
    assert.equal(pulses, 1, 'C -> A is one step forward with wraparound, not two steps back')
  })

  test('needs reset() to resync after the amp was changed by hand', () => {
    const strategy = getAmpStrategy(FAKE, 'increment')
    strategy.apply('C', recordedSend().send) // internal state now thinks current = 'C'

    // Someone turns the knob on the plugin itself, back to 'A', without going
    // through this strategy — internal state is now wrong until reset() runs.
    strategy.reset('A')

    const { send, calls } = recordedSend()
    strategy.apply('B', send) // from the resynced 'A', not the stale 'C'

    const pulses = calls.filter((c) => c.value === 127).length
    assert.equal(pulses, 1, 'A -> B is one step; without reset() this would compute from C')
  })
})

describe("amp strategy 'manual'", () => {
  test('sends nothing and returns a text instruction instead', () => {
    const strategy = getAmpStrategy(FAKE, 'manual')
    const { send, calls } = recordedSend()

    const instruction = strategy.apply('B', send)

    assert.match(instruction ?? '', /B/)
    assert.deepEqual(calls, [], 'manual never sends MIDI — a human does the switching')
  })
})

describe('getAmpStrategy', () => {
  test('defaults to manual when no strategy name is given', () => {
    assert.equal(getAmpStrategy(FAKE).name, 'manual')
  })

  test('an unknown strategy name fails immediately, listing the accepted values', () => {
    assert.throws(() => getAmpStrategy(FAKE, 'teleport'), /manual \| continuous \| increment/)
  })
})
