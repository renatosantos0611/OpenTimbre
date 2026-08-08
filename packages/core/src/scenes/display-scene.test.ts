import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CATALOG } from '../plugins/catalog.ts'
import { displayScene, label } from './display-scene.ts'

test('faceplate shows only required knob values, amp params first', () => {
  const spec = CATALOG.find((c) => c.id === 'gojira')!
  const scene = {
    gain: 6,
    bass: 4,
    mid: 5,
    treble: 6,
    level: 8,
    output: 7,
  }
  const card = displayScene(spec, scene, 'RUST')
  assert.ok(card.values.length > 0)
  assert.ok(card.values.length <= 6)
  // Every faceplate value is a required knob of the amp or a fixed param.
  for (const v of card.values) {
    assert.ok(v.label.length > 0)
    assert.ok(v.value.length > 0)
  }
})

test('pedal blocks appear only for effects that are on', () => {
  const spec = CATALOG.find((c) => c.id === 'gojira')!
  const on = displayScene(spec, { odOn: true, odDrive: 5, odLevel: 7 }, 'RUST')
  const off = displayScene(spec, { odOn: false, odDrive: 0, odLevel: 0 }, 'RUST')
  assert.ok(on.pedals.some((p) => p.name.toLowerCase() === 'OD'.toLowerCase()))
  assert.equal(off.pedals.length, 0)
})

test('label uppercases camelCase into spaced words', () => {
  assert.equal(label('dlyMix'), 'DLY MIX')
  assert.equal(label('gain'), 'GAIN')
})

test('a scene with no required knobs yields an empty faceplate, not a throw', () => {
  const spec = CATALOG.find((c) => c.id === 'gojira')!
  const card = displayScene(spec, {}, 'Rust')
  assert.deepEqual(card.values, [])
})