/**
 * Soldano SLO-100 X — characterization tests.
 *
 * These tests encode facts about the real plugin so that when the descriptor
 * is transcribed they can be checked against it instead of hoping someone
 * remembers what to put where. After Step 2 turns green, generic behavior
 * is covered by the catalog-walking invariants; schema generation goes to
 * rig-schema.test.ts; this file is documentation-by-test.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { soldanoSpec } from './soldano.ts'

describe('Soldano', () => {
  // ------------------------------------------------------------------- ids

  test('id is "soldano"', () => {
    assert.equal(soldanoSpec.id, 'soldano')
  })

  test('name matches legacy', () => {
    assert.ok(soldanoSpec.name.includes('Soldano'))
  })

  // -------------------------------------------------------------------- amps

  test('has exactly two amps: NORMAL and OVERDRIVE', () => {
    assert.deepEqual(soldanoSpec.amps, ['NORMAL', 'OVERDRIVE'])
  })

  test('NORMAL selector at 0, OVERDRIVE at 127', () => {
    assert.equal(soldanoSpec.ampSelect.cc, 20)
    assert.deepEqual(soldanoSpec.ampSelect.values, { NORMAL: 0, OVERDRIVE: 127 })
  })

  // -------------------------------------------------------------- amp core

  test('ampCore has gain and level only', () => {
    assert.deepEqual(soldanoSpec.ampCore, ['gain', 'level'])
  })

  test('ampParams: gain and level are knobs, required', () => {
    assert.equal(soldanoSpec.ampParams.gain.type, 'knob')
    assert.equal(soldanoSpec.ampParams.gain.required, true)
    assert.equal(soldanoSpec.ampParams.level.type, 'knob')
    assert.equal(soldanoSpec.ampParams.level.required, true)
  })

  // ------------------------------------------------------- per-amp CCs

  test('NORMAL owns gain(21), level(22), bright(23), mode(24)', () => {
    assert.deepEqual(soldanoSpec.ampCC.NORMAL, { gain: 21, level: 22, bright: 23, mode: 24 })
  })

  test('OVERDRIVE owns gain(25), level(26) only', () => {
    assert.deepEqual(soldanoSpec.ampCC.OVERDRIVE, { gain: 25, level: 26 })
  })

  // ------------------------------------------------ tonestack shared params

  test('tonestack bass/mid/treble/presence/depth share across both channels', () => {
    assert.equal(soldanoSpec.params.bass.cc, 27)
    assert.equal(soldanoSpec.params.mid.cc, 28)
    assert.equal(soldanoSpec.params.treble.cc, 29)
    assert.equal(soldanoSpec.params.presence.cc, 30)
    assert.equal(soldanoSpec.params.depth.cc, 31)
    for (const name of ['bass', 'mid', 'treble', 'presence', 'depth']) {
      assert.equal(soldanoSpec.params[name].type, 'knob')
    }
  })

  // -------------------------------------------------------- always-on sections

  test('four section bypasses pre-fx, amp, cab, post-fx', () => {
    assert.ok(soldanoSpec.alwaysOn.preFxSectionOn !== undefined)
    assert.ok(soldanoSpec.alwaysOn.ampSectionOn !== undefined)
    assert.ok(soldanoSpec.alwaysOn.cabSectionOn !== undefined)
    assert.ok(soldanoSpec.alwaysOn.postFxSectionOn !== undefined)
  })

  // --------------------------------------------------------- Bright & Mode

  test('Bright switch only on NORMAL channel', () => {
    assert.ok(soldanoSpec.ampCC.NORMAL.bright !== undefined)
    assert.ok(soldanoSpec.ampCC.OVERDRIVE.bright === undefined)
  })

  test('Mode switch only on NORMAL channel', () => {
    assert.ok(soldanoSpec.ampCC.NORMAL.mode !== undefined)
    assert.ok(soldanoSpec.ampCC.OVERDRIVE.mode === undefined)
  })
})
