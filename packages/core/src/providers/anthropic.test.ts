import assert from 'node:assert/strict'
import { test } from 'node:test'
import Anthropic from '@anthropic-ai/sdk'
import { anthropicProvider, createSession, type AnthropicClient } from './anthropic.ts'
import { TurnError, type TurnFailureKind } from './tool-use.ts'

const client = {} as AnthropicClient

function respondingSession(result: unknown): { session: ReturnType<typeof createSession>; requests: Record<string, unknown>[] } {
  const requests: Record<string, unknown>[] = []
  const fake = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        requests.push(params)
        if (result instanceof Error) throw result
        return result
      },
    },
    models: { list: async () => ({ data: [] }) },
  } as unknown as AnthropicClient
  const session = createSession(fake, 'claude-test', 'system')
  session.ask('build a rig')
  return { session, requests }
}

function assertTurnError(kind: TurnFailureKind) {
  return (err: unknown) => {
    assert.ok(err instanceof TurnError, `expected a TurnError, got ${String(err)}`)
    assert.equal((err as TurnError).kind, kind)
    return true
  }
}

test('Anthropic session resumes native message history', () => {
  const history = [{ role: 'user', content: 'previous turn' }]
  const session = createSession(client, 'fake-model', 'system', history)

  assert.deepEqual(session.history(), history)
  assert.notEqual(session.history(), history)
})

test('Anthropic provider exposes the SDK model catalog through the core shape', async () => {
  const fake = {
    models: {
      list: async () => ({ data: [{ id: 'claude-test', created_at: '2026-01-15T00:00:00Z' }] }),
    },
  } as unknown as AnthropicClient

  assert.deepEqual(await anthropicProvider(fake).listModels(), [
    {
      provider: 'anthropic',
      providerLabel: 'Anthropic',
      id: 'claude-test',
      releasedAt: Date.parse('2026-01-15T00:00:00Z'),
    },
  ])
})

test('Anthropic provider defaults releasedAt to 0 when the SDK omits created_at', async () => {
  const fake = {
    models: {
      list: async () => ({ data: [{ id: 'claude-test' }] }),
    },
  } as unknown as AnthropicClient

  const [model] = await anthropicProvider(fake).listModels()
  assert.equal(model.releasedAt, 0)
})

test('a model override wins over ANTHROPIC_MODEL and the hardcoded default', () => {
  const previous = process.env['ANTHROPIC_MODEL']
  process.env['ANTHROPIC_MODEL'] = 'claude-env-model'
  try {
    const provider = anthropicProvider(client, 'claude-picked-in-ui')
    assert.equal(provider.model(), 'claude-picked-in-ui')
    assert.equal(provider.createSession('system').model(), 'claude-picked-in-ui')
  } finally {
    if (previous === undefined) delete process.env['ANTHROPIC_MODEL']
    else process.env['ANTHROPIC_MODEL'] = previous
  }
})

test('an empty override falls back to ANTHROPIC_MODEL, never sends an empty model string', () => {
  const previous = process.env['ANTHROPIC_MODEL']
  process.env['ANTHROPIC_MODEL'] = 'claude-env-model'
  try {
    assert.equal(anthropicProvider(client, '').model(), 'claude-env-model')
    assert.equal(anthropicProvider(client, undefined).model(), 'claude-env-model')
  } finally {
    if (previous === undefined) delete process.env['ANTHROPIC_MODEL']
    else process.env['ANTHROPIC_MODEL'] = previous
  }
})

// --------------------------------------------------------------- respond failures

test('a max_tokens stop (output ceiling) fails as truncated and leaves history untouched', async () => {
  const { session } = respondingSession({
    stop_reason: 'max_tokens',
    content: [],
    usage: { input_tokens: 1, output_tokens: 1 },
  })
  const before = (session.history() as unknown[]).length

  await assert.rejects(session.respond([], null), assertTurnError('truncated'))
  assert.equal((session.history() as unknown[]).length, before, 'a truncated turn must not pollute the history')
})

test('respond asks for the raised 32k output ceiling', async () => {
  const { session, requests } = respondingSession({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'hello' }],
    usage: { input_tokens: 1, output_tokens: 1 },
  })

  await session.respond([], null)
  assert.equal(requests[0].max_tokens, 32000)
})

test('SDK errors surface as categorized turn errors', async () => {
  const headers = new Headers()
  const cases: Array<[Error, TurnFailureKind]> = [
    [new Anthropic.AuthenticationError(401, undefined, 'bad key', headers), 'auth'],
    [new Anthropic.PermissionDeniedError(403, undefined, 'denied', headers), 'no-access'],
    [new Anthropic.NotFoundError(404, undefined, 'model not found', headers), 'model-unavailable'],
    [new Anthropic.RateLimitError(429, undefined, 'slow down', headers), 'rate'],
    [new Anthropic.APIConnectionError({ cause: new Error('offline') }), 'connection'],
    [new Anthropic.BadRequestError(400, undefined, 'bad request', headers), 'other'],
  ]
  for (const [error, kind] of cases) {
    const { session } = respondingSession(error)
    await assert.rejects(session.respond([], null), assertTurnError(kind))
  }
})
