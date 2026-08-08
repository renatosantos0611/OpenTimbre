import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openaiProvider, createSession, type OpenAIClient } from './openai.ts'

const client = {} as OpenAIClient

test('OpenAI session resumes native response history', () => {
  const history = [{ type: 'message', role: 'user', content: 'previous turn' }]
  const session = createSession(client, 'fake-model', 'system', history)

  assert.deepEqual(session.history(), history)
  assert.notEqual(session.history(), history)
})

test('OpenAI session copies resumed history before appending new input', () => {
  const history = [{ type: 'message', role: 'user', content: 'previous turn' }]
  const session = createSession(client, 'fake-model', 'system', history)

  session.ask('next turn')

  assert.equal(history.length, 1)
  assert.equal((session.history() as unknown[]).length, 2)
})

test('OpenAI provider exposes the SDK model catalog through the core shape', async () => {
  const fake = {
    models: {
      list: async () => ({ data: [{ id: 'gpt-test' }] }),
    },
  } as unknown as OpenAIClient

  assert.deepEqual(await openaiProvider(fake).listModels(), [
    { provider: 'openai', providerLabel: 'OpenAI', id: 'gpt-test' },
  ])
})
