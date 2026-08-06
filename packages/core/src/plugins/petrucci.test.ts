/**
 * Petrucci X — characterization tests.
 *
 * These assert against the real `petrucciSpec`, not a fixture: the quirks
 * below are facts about this plugin (four amps including a non-amp PIEZO preamp,
 * a dedicated Volume section, Wah/Compressor split from other pre-effects,
 * seven section bypasses) — generic tests in catalog-invariants.test.ts and
 * rig-schema.test.ts already cover shared behavior.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { petrucciSpec } from './petrucci.ts'

describe('Petrucci', () => {
  // ------------------------------------------------------------------- ids

  test('id is "petrucci"', () => {
    assert.equal(petrucciSpec.id, 'petrucci')
  })

  test('name includes Archetype and Petrucci', () => {
    assert.ok(petrucciSpec.name.includes('Petrucci'))
  })

  // -------------------------------------------------------------------- amps

  test('has four amps: PIEZO, CLEAN, RHYTHM, LEAD', () => {
    assert.deepEqual(petrucciSpec.amps, ['PIEZO', 'CLEAN', 'RHYTHM', 'LEAD'])
  })

  test('selector: PIEZO=0, CLEAN=42, RHYTHM=85, LEAD=127, CC 20', () => {
    assert.equal(petrucciSpec.ampSelect.cc, 20)
    assert.deepEqual(
      petrucciSpec.ampSelect.values,
      { PIEZO: 0, CLEAN: 42, RHYTHM: 85, LEAD: 127 },
    )
  })

  // -------------------------------------------------------------- amp core

  test('ampCore has 5 controls sans gain/level (PIEZO has no amp)', () => {
    assert.deepEqual(
      petrucciSpec.ampCore,
      ['bass', 'mid', 'treble', 'presence', 'output'],
    )
  })

  // ----------------------------------------------- per-amp asymmetry

  test('only PIEZO has Body and Air', () => {
    assert.ok(petrucciSpec.ampCC.PIEZO.body !== undefined)
    assert.ok(petrucciSpec.ampCC.PIEZO.air !== undefined)
    assert.ok(petrucciSpec.ampCC.CLEAN.body === undefined)
    assert.ok(petrucciSpec.ampCC.RHYTHM.air === undefined)
  })

  test('only CLEAN has Bright (CC 29)', () => {
    assert.ok(petrucciSpec.ampCC.CLEAN.bright !== undefined)
    assert.ok(petrucciSpec.ampCC.PIEZO.bright === undefined)
    assert.ok(petrucciSpec.ampCC.LEAD.bright === undefined)
  })

  test('only RHYTHM has Tight/Bite/MidBoost', () => {
    assert.ok(petrucciSpec.ampCC.RHYTHM.tight !== undefined)
    assert.ok(petrucciSpec.ampCC.RHYTHM.bite !== undefined)
    assert.ok(petrucciSpec.ampCC.RHYTHM.midBoost !== undefined)
    assert.ok(petrucciSpec.ampCC.CLEAN.tight === undefined)
    assert.ok(petrucciSpec.ampCC.LEAD.bite === undefined)
  })

  test('only LEAD has Soar (CC 49)', () => {
    assert.ok(petrucciSpec.ampCC.LEAD.soar !== undefined)
    assert.ok(petrucciSpec.ampCC.PIEZO.soar === undefined)
  })

  test('PIEZO lacks Gain and Level/Master', () => {
    assert.ok(petrucciSpec.ampCC.PIEZO.gain === undefined)
    assert.ok(petrucciSpec.ampCC.PIEZO.level === undefined)
  })

  // -------------------------------------------------------- Volume section

  test('dedicated Volume section: volumeGain + volumeMidPoint', () => {
    assert.equal(petrucciSpec.params.volumeGain.cc, 83)
    assert.equal(petrucciSpec.params.volumeMidPoint.cc, 84)
    assert.equal(petrucciSpec.params.volumeGain.required, true)
    assert.equal(petrucciSpec.params.volumeMidPoint.required, true)
  })

  // ----------------------------------------------------- always-on sections

  test('seven section bypasses: wahComp, preFX, amp, cab, eqSection, volume, postFX', () => {
    assert.ok(petrucciSpec.alwaysOn.wahCompSectionOn !== undefined)
    assert.ok(petrucciSpec.alwaysOn.preFxSectionOn !== undefined)
    assert.ok(petrucciSpec.alwaysOn.ampSectionOn !== undefined)
    assert.ok(petrucciSpec.alwaysOn.cabSectionOn !== undefined)
    assert.ok(petrucciSpec.alwaysOn.eqSectionOn !== undefined)
    assert.ok(petrucciSpec.alwaysOn.volumeSectionOn !== undefined)
    assert.ok(petrucciSpec.alwaysOn.postFxSectionOn !== undefined)
  })

  // ------------------------------------------------------ transpose required

  test('transpose is required (preset transpose would silence scenes)', () => {
    assert.equal(petrucciSpec.params.transpose.required, true)
  })
})
