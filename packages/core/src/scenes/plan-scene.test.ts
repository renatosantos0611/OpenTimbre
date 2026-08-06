/**
 * Behavior tests for `planScene`, against a fixture `PluginSpec` — per
 * `opentimbre-testing`, scene-translation behavior belongs on a fixture, not
 * the real catalog, so a Fase 0 probe correcting a real CC never breaks this
 * suite. `catalog-invariants.test.ts` (a later task) is what walks Gojira.
 *
 * Ported from legacy's `plugins/cena.test.ts` logic (read via `cena.ts`,
 * legacy's test file itself wasn't part of this task's reading list) onto the
 * new pure signature `planScene(spec, scene, amp) -> {cc, value}[]`.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { knobToMidi, type PluginSpec } from '../plugins/types.ts'
import { planScene } from './plan-scene.ts'

// ------------------------------------------------------------------ fixture

/**
 * Amp A is mapped (has both `ampCore` controls) and has the EQ. Amp B is
 * missing `tone`, so it's unmapped and any request for B must fall back to
 * A's CCs — never a mix of A's and B's numbers, and never B's CC 30 for
 * `gain`. Amp C is mapped too, but genuinely lacks the EQ controls (absence
 * is data, per `opentimbre-plugin-spec` — like Gojira's CLN lacking Presence).
 */
const FIXTURE: PluginSpec = {
  id: 'fixture',
  name: 'Fixture Plugin',
  whenToUse: 'never — this is a fixture',
  signalChain: 'IN -> DRIVE -> AMP -> EQ -> OUT',
  doc: 'fixture.md',

  amps: ['A', 'B', 'C'],
  ampDescriptions: { A: 'amp a', B: 'amp b', C: 'amp c' },
  ampSelect: { cc: 20, values: { A: 0, B: 64, C: 127 } },
  ampCore: ['gain', 'tone'],
  ampParams: {
    gain: { type: 'knob', required: true, desc: 'gain' },
    tone: { type: 'knob', required: true, desc: 'tone' },
    eqOn: { type: 'toggle', required: false, desc: 'graphic eq on' },
    // off defaults to 0 when absent; eq1 sets it to 5 (flat), like Gojira's bands.
    eq1: { type: 'knob', required: false, off: 5, desc: 'eq band 1' },
  },
  ampCC: {
    A: { gain: 10, tone: 11, eqOn: 12, eq1: 13 },
    B: { gain: 30 }, // missing 'tone' -> not mapped
    C: { gain: 50, tone: 51 }, // mapped, but genuinely has no EQ
  },
  params: {
    driveOn: { cc: 40, type: 'toggle', required: true, desc: 'drive on' },
    driveLevel: { cc: 41, type: 'knob', required: false, desc: 'drive level' },
    mode: {
      cc: 42,
      type: 'select',
      required: false,
      options: { CLEAN: 0, DIRTY: 127 },
      desc: 'voicing mode',
    },
  },
  groups: { eqOn: ['eq1'], driveOn: ['driveLevel'] },
  alwaysOn: { sectionA: 1, sectionB: 2 },

  app: {
    candidates: { win32: ['C:\\fixture.exe'] },
    process: 'fixture.exe',
    settings: 'fixture',
    midiFolder: 'MIDI',
    mapping: 'fixture.xml',
  },
}

// ----------------------------------------------------------------- alwaysOn

describe('alwaysOn bypasses', () => {
  test('every alwaysOn CC is prepended at 127, before any scene value', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'A')

    assert.deepEqual(messages.slice(0, 2), [
      { cc: 1, value: 127 },
      { cc: 2, value: 127 },
    ])
  })
})

// --------------------------------------------------------- toggle groups

describe('toggle groups', () => {
  test('a governed knob gets its off value when the toggle is off — never undefined', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'A')

    // driveOn itself always resolves (toggle), and the knob it governs
    // (driveLevel) rests at its off value (0, no `off` override) even though
    // the scene never mentions driveLevel at all.
    assert.deepEqual(
      messages.filter((m) => m.cc === 40 || m.cc === 41),
      [
        { cc: 40, value: 0 }, // driveOn = false
        { cc: 41, value: 0 }, // driveLevel rests at 0
      ],
    )
  })

  test('a governed knob uses the scene value when the toggle is on', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: true, driveLevel: 8 }, 'A')

    assert.deepEqual(
      messages.filter((m) => m.cc === 40 || m.cc === 41),
      [
        { cc: 40, value: 127 }, // driveOn = true
        { cc: 41, value: knobToMidi(8) },
      ],
    )
  })

  test('EQ band rests at its own off value (5, flat) rather than the default 0', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false, eqOn: false }, 'A')

    assert.deepEqual(
      messages.filter((m) => m.cc === 13),
      [{ cc: 13, value: knobToMidi(5) }],
    )
  })

  test('a toggle omitted from the scene is treated as off, never left undefined', () => {
    // `eqOn` isn't in the scene at all — must resolve to false, not skip.
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'A')

    assert.deepEqual(
      messages.filter((m) => m.cc === 12),
      [{ cc: 12, value: 0 }],
    )
  })
})

// -------------------------------------------------------------- resolveAmp

describe('resolveAmp fallback', () => {
  test('an unmapped requested amp plans the resolved (fallback) amp\u2019s CCs, not its own', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'B')

    // B's own 'gain' CC is 30 — it must never appear. The plan uses A's CCs.
    assert.ok(
      messages.every((m) => m.cc !== 30),
      'must not send to the unmapped amp\u2019s own CC map',
    )
    assert.deepEqual(
      messages.filter((m) => m.cc === 10),
      [{ cc: 10, value: knobToMidi(5) }],
      'falls back to the mapped amp (A) and plans its gain CC',
    )
  })

  test('a mapped requested amp plans its own CCs directly', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'A')

    assert.deepEqual(
      messages.filter((m) => m.cc === 10),
      [{ cc: 10, value: knobToMidi(5) }],
    )
  })
})

// ------------------------------------------------------------------ select

describe('select parameters', () => {
  test('resolves to the option\u2019s MIDI value when the scene names a valid option', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false, mode: 'DIRTY' }, 'A')

    assert.deepEqual(
      messages.filter((m) => m.cc === 42),
      [{ cc: 42, value: 127 }],
    )
  })

  test('sends nothing for a select the scene never named', () => {
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'A')

    assert.ok(messages.every((m) => m.cc !== 42))
  })
})

// -------------------------------------------------------- amp-scoped params

describe('amp-scoped parameters', () => {
  test('a param the resolved amp does not have in ampCC is skipped, never sent as 0', () => {
    // Amp C is mapped (no fallback), but has no 'eqOn'/'eq1' entries at all.
    const messages = planScene(FIXTURE, { gain: 5, tone: 5, driveOn: false }, 'C')

    assert.ok(messages.every((m) => m.cc !== 12 && m.cc !== 13))
    assert.deepEqual(
      messages.filter((m) => m.cc === 50),
      [{ cc: 50, value: knobToMidi(5) }],
      'C’s own gain CC is used since C is directly mapped, not a fallback',
    )
  })
})
