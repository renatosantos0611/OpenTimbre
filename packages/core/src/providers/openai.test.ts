import assert from 'node:assert/strict'
import { test } from 'node:test'
import OpenAI from 'openai'
import { openaiProvider, createSession, type OpenAIClient } from './openai.ts'
import { TurnError, type TurnFailureKind } from './tool-use.ts'

const client = {} as OpenAIClient

function respondingSession(result: unknown): { session: ReturnType<typeof createSession> } {
  const fake = {
    responses: {
      create: async () => {
        if (result instanceof Error) throw result
        return result
      },
    },
    models: { list: async () => ({ data: [] }) },
  } as unknown as OpenAIClient
  const session = createSession(fake, 'gpt-test', 'system')
  session.ask('build a rig')
  return { session }
}

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
      list: async () => ({ data: [{ id: 'gpt-test', created: 1700000000 }] }),
    },
  } as unknown as OpenAIClient

  assert.deepEqual(await openaiProvider(fake).listModels(), [
    { provider: 'openai', providerLabel: 'OpenAI', id: 'gpt-test', releasedAt: 1700000000_000 },
  ])
})

test('OpenAI provider defaults releasedAt to 0 when the SDK omits created', async () => {
  const fake = {
    models: {
      list: async () => ({ data: [{ id: 'gpt-test' }] }),
    },
  } as unknown as OpenAIClient

  const [model] = await openaiProvider(fake).listModels()
  assert.equal(model.releasedAt, 0)
})

test('a model override wins over OPENAI_MODEL and the hardcoded default', () => {
  const previous = process.env['OPENAI_MODEL']
  process.env['OPENAI_MODEL'] = 'gpt-env-model'
  try {
    const provider = openaiProvider(client, 'gpt-picked-in-ui')
    assert.equal(provider.model(), 'gpt-picked-in-ui')
    assert.equal(provider.createSession('system').model(), 'gpt-picked-in-ui')
  } finally {
    if (previous === undefined) delete process.env['OPENAI_MODEL']
    else process.env['OPENAI_MODEL'] = previous
  }
})

test('an empty override falls back to OPENAI_MODEL, never sends an empty model string', () => {
  const previous = process.env['OPENAI_MODEL']
  process.env['OPENAI_MODEL'] = 'gpt-env-model'
  try {
    assert.equal(openaiProvider(client, '').model(), 'gpt-env-model')
    assert.equal(openaiProvider(client, undefined).model(), 'gpt-env-model')
  } finally {
    if (previous === undefined) delete process.env['OPENAI_MODEL']
    else process.env['OPENAI_MODEL'] = previous
  }
})

// --------------------------------------------------------------- respond failures

function assertTurnError(kind: TurnFailureKind) {
  return (err: unknown) => {
    assert.ok(err instanceof TurnError, `expected a TurnError, got ${String(err)}`)
    assert.equal((err as TurnError).kind, kind)
    return true
  }
}

test('an incomplete response (output-token ceiling) fails as truncated and leaves history untouched', async () => {
  const { session } = respondingSession({
    status: 'incomplete',
    output: [],
    output_text: '',
    usage: { input_tokens: 1, output_tokens: 1 },
  })
  const before = (session.history() as unknown[]).length

  await assert.rejects(session.respond([], null), assertTurnError('truncated'))
  assert.equal((session.history() as unknown[]).length, before, 'a truncated turn must not pollute the history')
})

test('an incomplete response with an explicit max_output_tokens reason is truncated', async () => {
  const { session } = respondingSession({
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    output: [],
    output_text: '',
    usage: { input_tokens: 1, output_tokens: 1 },
  })

  await assert.rejects(session.respond([], null), assertTurnError('truncated'))
})

test('a content-filter cutoff fails as blocked, not truncated', async () => {
  const { session } = respondingSession({
    status: 'incomplete',
    incomplete_details: { reason: 'content_filter' },
    output: [],
    output_text: '',
    usage: { input_tokens: 1, output_tokens: 1 },
  })

  await assert.rejects(session.respond([], null), assertTurnError('blocked'))
})

test('a tool call whose arguments are not valid JSON fails as validation', async () => {
  const { session } = respondingSession({
    status: 'completed',
    output: [{ type: 'function_call', call_id: 'c1', name: 'apply_rig_gojira', arguments: '{ broken' }],
    output_text: '',
    usage: { input_tokens: 1, output_tokens: 1 },
  })

  await assert.rejects(session.respond([], null), assertTurnError('validation'))
})

test('SDK errors surface as categorized turn errors', async () => {
  const headers = new Headers()
  const cases: Array<[Error, TurnFailureKind]> = [
    [new OpenAI.AuthenticationError(401, undefined, 'bad key', headers), 'auth'],
    [new OpenAI.PermissionDeniedError(403, undefined, 'denied', headers), 'no-access'],
    [new OpenAI.NotFoundError(404, undefined, 'model not found', headers), 'model-unavailable'],
    [new OpenAI.RateLimitError(429, undefined, 'slow down', headers), 'rate'],
    [new OpenAI.APIConnectionError({ cause: new Error('offline') }), 'connection'],
    [new OpenAI.BadRequestError(400, undefined, 'bad request', headers), 'other'],
  ]
  for (const [error, kind] of cases) {
    const { session } = respondingSession(error)
    await assert.rejects(session.respond([], null), assertTurnError(kind))
  }
})
