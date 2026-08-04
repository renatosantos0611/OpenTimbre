/**
 * Behavior tests for Gojira-specific quirks — the things a generic
 * amp-modeling assumption would get wrong, per capabilities.md's "Achado"
 * notes and confirmed against `gojira.ts` itself.
 *
 * These assert against the real `gojiraSpec`, not a fixture: the quirks
 * below are facts about *this* plugin (an asymmetric amp, a mislabeled
 * internal parameter, a pedal with a stage name), not general `PluginSpec`
 * behavior — `types.test.ts` already covers the generic mechanics against a
 * fixture. Losing one of these assertions on a future probe-session
 * correction is exactly the point: it means the quirk changed and the
 * transcription needs to change with it.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { gojiraSpec } from './gojira.ts'

describe('CLN is the odd amp out', () => {
  test('CLN has no Presence and no Depth (resonance) — only RUST and HOT do', () => {
    assert.equal(gojiraSpec.ampCC['CLN']?.['presence'], undefined)
    assert.equal(gojiraSpec.ampCC['CLN']?.['resonance'], undefined)
    assert.notEqual(gojiraSpec.ampCC['RUST']?.['presence'], undefined)
    assert.notEqual(gojiraSpec.ampCC['RUST']?.['resonance'], undefined)
    assert.notEqual(gojiraSpec.ampCC['HOT']?.['presence'], undefined)
    assert.notEqual(gojiraSpec.ampCC['HOT']?.['resonance'], undefined)
  })

  test('CLN is the only amp with a Bright switch', () => {
    assert.notEqual(gojiraSpec.ampCC['CLN']?.['bright'], undefined)
    assert.equal(gojiraSpec.ampCC['RUST']?.['bright'], undefined)
    assert.equal(gojiraSpec.ampCC['HOT']?.['bright'], undefined)
  })

  test('CLN also has no Master (level) — the field the amp-core check excludes on purpose', () => {
    assert.equal(gojiraSpec.ampCC['CLN']?.['level'], undefined)
    assert.notEqual(gojiraSpec.ampCC['RUST']?.['level'], undefined)
    assert.notEqual(gojiraSpec.ampCC['HOT']?.['level'], undefined)
  })
})

describe('rvbShimmer is not a mode selector', () => {
  test("the plugin's reverbMode parameter is modeled as the Shimmer toggle, not a select", () => {
    assert.equal(gojiraSpec.params['rvbShimmer']?.type, 'toggle')
    assert.equal(gojiraSpec.params['rvbShimmer']?.cc, 64)
  })

  test('no parameter is literally named reverbMode — that name is the plugin-internal one, never surfaced', () => {
    assert.equal(gojiraSpec.params['reverbMode'], undefined)
  })
})

describe('the WOW pedal is FATSO, with 3 sub-modes', () => {
  test('wowMode is a select with exactly FATSO, BLADE1, BLADE2', () => {
    const wowMode = gojiraSpec.params['wowMode']
    assert.equal(wowMode?.type, 'select')
    assert.deepEqual(wowMode?.options, { FATSO: 0, BLADE1: 64, BLADE2: 127 })
  })

  test('wowMix only makes sense in FATSO mode, per its own description', () => {
    assert.match(gojiraSpec.params['wowMix']?.desc ?? '', /FATSO/)
  })
})

describe('each amp has its own 9-band graphic EQ', () => {
  test('CLN, RUST, and HOT each have all 9 bands plus eqOn mapped', () => {
    for (const amp of ['CLN', 'RUST', 'HOT']) {
      const cc = gojiraSpec.ampCC[amp] ?? {}
      assert.notEqual(cc['eqOn'], undefined, `${amp} is missing eqOn`)
      for (let band = 1; band <= 9; band++) {
        assert.notEqual(cc[`eq${band}`], undefined, `${amp} is missing eq${band}`)
      }
    }
  })

  test('the EQ is per-amp, not shared — no amp reuses another amp’s EQ CCs', () => {
    const eqCCs = ['CLN', 'RUST', 'HOT'].flatMap((amp) => {
      const cc = gojiraSpec.ampCC[amp] ?? {}
      return [cc['eqOn'], ...Array.from({ length: 9 }, (_, i) => cc[`eq${i + 1}`])]
    })
    assert.equal(new Set(eqCCs).size, eqCCs.length, 'two amps sharing an EQ CC would mean moving one amp’s EQ silently moves the other’s')
  })
})

describe('the cabinet has two independent microphones', () => {
  const IR_CHOICES = ['DYN57', 'DYN421', 'COND414', 'COND184', 'RIB160', 'RIB121']

  test('each mic chooses among the same 6 IRs', () => {
    assert.deepEqual(Object.keys(gojiraSpec.params['cab1Mic']?.options ?? {}), IR_CHOICES)
    assert.deepEqual(Object.keys(gojiraSpec.params['cab2Mic']?.options ?? {}), IR_CHOICES)
  })

  test('each mic has its own position, distance, level, and pan', () => {
    for (const mic of ['cab1', 'cab2']) {
      for (const control of ['Position', 'Distance', 'Level', 'Pan']) {
        assert.ok(gojiraSpec.params[`${mic}${control}`], `${mic}${control} is not a parameter`)
      }
    }
  })

  test('the two mics are on independent CCs — mixing them does not collide', () => {
    const cc1 = gojiraSpec.params['cab1Mic']?.cc
    const cc2 = gojiraSpec.params['cab2Mic']?.cc
    assert.notEqual(cc1, undefined)
    assert.notEqual(cc2, undefined)
    assert.notEqual(cc1, cc2)
  })
})
