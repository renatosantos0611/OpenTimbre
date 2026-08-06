import assert from 'node:assert/strict'
import { test } from 'node:test'
import { anthropicProvider, createSession, type AnthropicClient } from './anthropic.ts'

const client = {} as AnthropicClient

test('Anthropic session resumes native message history', () => {
  const history = [{ role: 'user', content: 'previous turn' }]
  const session = createSession(client, 'fake-model', 'system', history)

  assert.deepEqual(session.history(), history)
  assert.notEqual(session.history(), history)
})

test('Anthropic provider exposes the SDK model catalog through the core shape', async () => {
  const fake = {
    models: {
      list: async () => ({ data: [{ id: 'claude-test' }] }),
    },
  } as unknown as AnthropicClient

  assert.deepEqual(await anthropicProvider(fake).listModels(), [
    { provider: 'anthropic', providerLabel: 'Anthropic', id: 'claude-test' },
  ])
})
