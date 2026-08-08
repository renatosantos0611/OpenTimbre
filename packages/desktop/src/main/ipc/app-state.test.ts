import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initStore } from '../storage/desktop-store.ts'
import { buildAppState, resolveTheme } from './app-state.ts'

const DEFAULT_GUITAR = { model: 'Tele', pickups: 'humbucker' as const, tuning: 'E standard', strings: 6 }
const KEY = { provider: 'openai' as const, label: 'OpenAI', env: 'OPENAI_API_KEY', source: 'app' as const, hint: 'sk-…f3a', updatedAt: 'now', protected: true, readable: true }

test('resolveTheme maps system to a concrete value', () => {
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('system'), 'dark')
})

test('buildAppState returns the contract camelCase shape', () => {
  const store = initStore(':memory:')
  const state = buildAppState({
    store,
    listKeys: () => [KEY],
    getGuitar: () => DEFAULT_GUITAR,
    getLocale: () => 'en',
    ai: { provider: 'openai', label: 'OpenAI', model: 'gpt-4o', available: [] },
    version: '3.0-dev',
  })

  assert.equal(state.locale, 'en')
  assert.equal(state.theme.chosen, 'system')
  assert.equal(state.theme.resolved, 'dark')
  assert.deepEqual(state.guitar, DEFAULT_GUITAR)
  assert.equal(state.keys[0]!.hint, 'sk-…f3a')
  assert.equal(state.ai!.model, 'gpt-4o')
  assert.equal(state.providerPreference, 'auto')
  assert.deepEqual(state.pluginIds, ['gojira', 'soldano', 'tim-henson', 'petrucci'])
  assert.equal(state.forcedProvider, null)
  assert.equal(state.version, '3.0-dev')
})

test('a persisted preference and model flow into AppState', () => {
  const store = initStore(':memory:')
  store.set('provider_preference', 'anthropic')
  store.set('model_id', 'claude-opus')
  store.set('provider_id', 'anthropic')
  store.set('theme', 'light')

  const state = buildAppState({
    store,
    listKeys: () => [],
    getGuitar: () => DEFAULT_GUITAR,
    getLocale: () => 'pt',
    ai: { provider: 'anthropic', label: 'Anthropic', model: 'claude-opus', available: [] },
    version: 'x',
  })
  assert.equal(state.providerPreference, 'anthropic')
  assert.equal(state.ai!.model, 'claude-opus')
  assert.equal(state.theme.chosen, 'light')
  assert.equal(state.theme.resolved, 'light')
  assert.equal(state.locale, 'pt')
})