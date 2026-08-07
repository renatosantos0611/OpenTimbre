import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initStore, DEFAULTS } from './desktop-store.ts'

const defaultPath = ':memory:'

/** Creates a fresh store for each test so they don't share state. */
function newStore() {
  return initStore(defaultPath)
}

test('initializes with migration version 1', () => {
  const store = newStore()
  assert.equal(store.migrationVersion(), 1)
})

test('get returns empty string for an unknown unset key', () => {
  const store = newStore()
  assert.equal(store.get('__unknown_xyz__'), '')
})

test('set/get persists a guitar value correctly', () => {
  const store = newStore()
  store.set('guitar', 'les_paul')
  assert.equal(store.get('guitar'), 'les_paul')
})

test('setBool/getBool round-trips true and false', () => {
  const store = newStore()
  store.setBool('dim_on_unfocus', true)
  assert.equal(store.getBool('dim_on_unfocus'), true)
  store.setBool('dim_on_unfocus', false)
  assert.equal(store.getBool('dim_on_unfocus'), false)
})

test('setNumber/getNumber round-trips integer values', () => {
  const store = newStore()
  store.setNumber('width', 480)
  assert.equal(store.getNumber('width'), 480)
})

test('get returns defaults when nothing has been set', () => {
  const store = newStore()
  assert.equal(store.get('guitar'), DEFAULTS.guitar)
  assert.equal(store.getBool('always_on_top'), DEFAULTS.always_on_top)
  assert.equal(store.getNumber('height'), DEFAULTS.height)
})

test('toJson includes persisted and default values', () => {
  const store = newStore()
  store.set('guitar', 'custom')
  const json = store.toJson()
  assert.equal(json.guitar, 'custom')
  assert.equal(json.always_on_top, true)
  assert.equal(json.auto_apply, false)
})
