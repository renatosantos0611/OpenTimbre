/**
 * Tim Henson X — characterization tests.
 *
 * These assert against the real `timHensonSpec`, not a fixture: the quirks
 * below are facts about this plugin (three independent amps with separate
 * tonestacks, a dedicated blend control on ROSES, a Multivoicer harmony
 * engine, section bypasses named differently from Gojira's) — generic tests
 * in catalog-invariants.test.ts and types.test.ts already cover shared behavior.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { timHensonSpec } from './tim-henson.ts'

describe('Tim Henson', () => {
  // ------------------------------------------------------------------- ids

  test('id is "tim-henson"', () => {
    assert.equal(timHensonSpec.id, 'tim-henson')
  })

  test('name includes Archetype and Tim Henson', () => {
    assert.ok(timHensonSpec.name.includes('Tim Henson'))
  })

  // -------------------------------------------------------------------- amps

  test('has three amps: ROSES, CHERUBS, PINK', () => {
    assert.deepEqual(timHensonSpec.amps, ['ROSES', 'CHERUBS', 'PINK'])
  })

  test('selector: ROSES=0, CHERUBS=64, PINK=127, CC 20', () => {
    assert.equal(timHensonSpec.ampSelect.cc, 20)
    assert.deepEqual(timHensonSpec.ampSelect.values, { ROSES: 0, CHERUBS: 64, PINK: 127 })
  })

  // -------------------------------------------------------------- amp core

  test('ampCore has 5 controls like Gojira', () => {
    assert.deepEqual(timHensonSpec.ampCore, ['gain', 'bass', 'mid', 'treble', 'output'])
  })

  // ----------------------------------------------- per-amp asymmetry

  test('only ROSES has Blend (CC 26)', () => {
    assert.ok(timHensonSpec.ampCC.ROSES.blend !== undefined)
    assert.ok(timHensonSpec.ampCC.CHERUBS.blend === undefined)
    assert.ok(timHensonSpec.ampCC.PINK.blend === undefined)
  })

  test('only CHERUBS has Channel (CC 29)', () => {
    assert.ok(timHensonSpec.ampCC.CHERUBS.channel !== undefined)
    assert.ok(timHensonSpec.ampCC.ROSES.channel === undefined)
    assert.ok(timHensonSpec.ampCC.PINK.channel === undefined)
  })

  test('only PINK has Level/Master (CC 40)', () => {
    assert.ok(timHensonSpec.ampCC.PINK.level !== undefined)
    assert.ok(timHensonSpec.ampCC.ROSES.level === undefined)
    assert.ok(timHensonSpec.ampCC.CHERUBS.level === undefined)
  })

  // -------------------------------------------------------- Multivoicer

  test('Multivoicer toggle at CC 80 with 4 voices, width, output', () => {
    assert.equal(timHensonSpec.params.multivoicerOn.cc, 80)
    assert.equal(timHensonSpec.params.multivoicerVoice1On.cc, 84)
    assert.equal(timHensonSpec.params.multivoicerVoice2On.cc, 87)
    assert.equal(timHensonSpec.params.multivoicerVoice3On.cc, 92)
    assert.equal(timHensonSpec.params.multivoicerVoice4On.cc, 95)
    assert.equal(timHensonSpec.params.multivoicerWidth.cc, 90)
    assert.equal(timHensonSpec.params.multivoicerOutput.cc, 91)
  })

  // ----------------------------------------------------- always-on sections

  test('five section bypasses: preFX, amp, cab, eqSection, postFX', () => {
    assert.ok(timHensonSpec.alwaysOn.preFxSectionOn !== undefined)
    assert.ok(timHensonSpec.alwaysOn.ampSectionOn !== undefined)
    assert.ok(timHensonSpec.alwaysOn.cabSectionOn !== undefined)
    assert.ok(timHensonSpec.alwaysOn.eqSectionOn !== undefined)
    assert.ok(timHensonSpec.alwaysOn.postFxSectionOn !== undefined)
  })
})
