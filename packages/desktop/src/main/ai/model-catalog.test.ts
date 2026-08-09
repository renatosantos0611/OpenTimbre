import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProviderId } from '@opentimbre/contracts'
import type { RigChatProvider } from '@opentimbre/core/src/chat/rig-chat.ts'
import { listAvailableModels, modelLabel, modelTier } from './model-catalog.ts'

function provider(
  id: ProviderId,
  ids: string[] | (() => Promise<string[]>),
  releasedAt: Record<string, number> = {},
): RigChatProvider {
  const first = (): string => (typeof ids === 'function' ? '' : (ids[0] ?? ''))
  return {
    id,
    label: id,
    model: first,
    createSession: () => {
      throw new Error('unused')
    },
    listModels: async () => {
      const value = typeof ids === 'function' ? await (ids as () => Promise<string[]>)() : ids
      return value.map((m) => ({ provider: id, providerLabel: id, id: m, releasedAt: releasedAt[m] ?? 0 }))
    },
  }
}

test('modelLabel prettifies the gpt codename family and passes Anthropic through', () => {
  assert.equal(modelLabel('openai', 'gpt-5.6-sol'), 'GPT-5.6 Sol')
  assert.equal(modelLabel('openai', 'gpt-5.6'), 'GPT-5.6')
  assert.equal(modelLabel('openai', 'gpt-4o'), 'gpt-4o')
  assert.equal(modelLabel('anthropic', 'claude-opus-5'), 'claude-opus-5')
})

test('modelTier derives a cost bucket from the id', () => {
  assert.equal(modelTier('openai', 'o4'), 'high')
  assert.equal(modelTier('openai', 'gpt-5.6-sol'), 'high')
  assert.equal(modelTier('openai', 'gpt-5.2'), 'mid')
  assert.equal(modelTier('openai', 'gpt-4o'), 'low')
  assert.equal(modelTier('anthropic', 'claude-sonnet-4-5'), 'high')
  assert.equal(modelTier('anthropic', 'claude-sonnet-4.5'), 'high')
  assert.equal(modelTier('anthropic', 'claude-sonnet-4'), 'mid')
  assert.equal(modelTier('anthropic', 'claude-haiku-3-5'), 'low')
  assert.equal(modelTier('anthropic', 'claude-haiku-3.5'), 'low')
  assert.equal(modelTier('openai', 'weird'), 'mid')
})

test('listAvailableModels merges both providers', async () => {
  const models = await listAvailableModels([
    provider('openai', ['gpt-5.6-sol']),
    provider('anthropic', ['claude-opus-5']),
  ])
  assert.equal(models.length, 2)
  assert.deepEqual(
    models.map((m) => m.id),
    ['gpt-5.6-sol', 'claude-opus-5'],
  )
})

test('listAvailableModels sorts every provider merged, newest release first', async () => {
  const models = await listAvailableModels([
    provider('openai', ['gpt-old', 'gpt-new'], { 'gpt-old': 1000, 'gpt-new': 3000 }),
    provider('anthropic', ['claude-mid'], { 'claude-mid': 2000 }),
  ])
  assert.deepEqual(
    models.map((m) => m.id),
    ['gpt-new', 'claude-mid', 'gpt-old'],
  )
})

test('a model with no reported release date sorts after every dated model', async () => {
  const models = await listAvailableModels([
    provider('openai', ['gpt-dated', 'gpt-undated'], { 'gpt-dated': 1000 }),
  ])
  assert.deepEqual(
    models.map((m) => m.id),
    ['gpt-dated', 'gpt-undated'],
  )
})

test('a provider that errors contributes nothing but does not fail the call', async () => {
  const models = await listAvailableModels([
    provider('openai', ['gpt-5.6-sol']),
    provider('anthropic', async () => Promise.reject(new Error('network down'))),
  ])
  assert.deepEqual(models.map((m) => m.provider), ['openai'])
})

test('a malformed response body drops that provider without failing the call', async () => {
  const bad: RigChatProvider = {
    id: 'openai',
    label: 'openai',
    model: () => '',
    createSession: () => {
      throw new Error('unused')
    },
    listModels: async () => [{ provider: 'openai', providerLabel: 'OpenAI' } as never],
  }
  const good = provider('anthropic', ['claude-sonnet-4'])
  const models = await listAvailableModels([bad, good])
  assert.deepEqual(models.map((m) => m.provider), ['anthropic'])
})

test('a single valid key contributes just that provider', async () => {
  const models = await listAvailableModels([provider('openai', ['gpt-5.6-sol'])])
  assert.deepEqual(models.map((m) => m.provider), ['openai'])
})

test('an empty provider set contributes nothing', async () => {
  const models = await listAvailableModels([])
  assert.deepEqual(models, [])
})

test('no key value leaks into any returned ModelInfo', async () => {
  const models = await listAvailableModels([provider('openai', ['gpt-5.6-sol'])])
  const serialized = JSON.stringify(models)
  assert.ok(!serialized.includes('sk-'))
  assert.ok(!serialized.includes('apiKey'))
})