/**
 * Characterization tests for `execute` (`tool-use.ts`'s protocol), against a
 * fake `Session` — never a real API, per `opentimbre-testing` and per the
 * module's own doctrine ("`execute` is testable with a fake `Session`, no
 * network and no key"). What's under test is the dance itself: two attempts
 * at most, the failed first attempt's feedback reaching the second attempt's
 * `ask`/`correct`, issue formatting, and history rollback when both attempts
 * fail — the exact four things `padroes.md` §1 says used to be reimplemented
 * per provider and drifted.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  CONFIRMATION,
  execute,
  issuesToError,
  issuesToText,
  type Call,
  type Response,
  type Session,
  type ToolDef,
  type Trace,
  type Verdict,
} from './tool-use.ts'

// -------------------------------------------------------------------- fixtures

const TOOL: ToolDef = { name: 'apply_rig_fixture', description: 'apply a rig', schema: {} }

function callResponse(args: unknown): Response {
  return {
    text: '',
    call: { id: 'call-1', name: TOOL.name, args },
    raw: { fake: true },
    usage: { input: 10, output: 20 },
    stopReason: 'tool_use',
  }
}

function textResponse(text: string): Response {
  return { text, call: null, raw: { fake: true }, usage: { input: 1, output: 1 }, stopReason: 'end_turn' }
}

/**
 * A `Session` double that plays back a queue of canned responses (one per
 * `respond()` call) and records every call the protocol makes on it, so
 * assertions can check ordering and arguments without any network.
 */
function fakeSession(responses: Response[]) {
  const calls: {
    asked: string[]
    responded: number
    corrected: { call: Call; feedback: string }[]
    confirmed: { call: Call; text: string }[]
    rolledBackTo: number[]
  } = { asked: [], responded: 0, corrected: [], confirmed: [], rolledBackTo: [] }

  let history: unknown[] = []

  const session: Session = {
    label: 'Fake',
    model: () => 'fake-model',
    ask(text) {
      calls.asked.push(text)
      history = [...history, { role: 'user', text }]
    },
    async respond() {
      const response = responses[calls.responded]
      calls.responded++
      history = [...history, { role: 'assistant', response }]
      if (!response) throw new Error('fakeSession: ran out of canned responses')
      return response
    },
    correct(call, feedback) {
      calls.corrected.push({ call, feedback })
      history = [...history, { role: 'user', correction: feedback }]
    },
    confirm(call, text) {
      calls.confirmed.push({ call, text })
    },
    mark: () => history.length,
    rollback(mark) {
      calls.rolledBackTo.push(mark)
      history = history.slice(0, mark)
    },
    history: () => history,
  }

  return { session, calls, historyLength: () => history.length }
}

/** Rejects any `args` that isn't the literal string 'valid', zod-issue-shaped. */
function validate(call: Call): Verdict<string> {
  if (call.args === 'valid') return { ok: true, value: 'validated-rig' }
  const issues = [{ path: ['amp'], message: "invalid enum value, expected 'A' | 'B'" }]
  return { ok: false, issues, feedback: issuesToText(issues) }
}

function fakeTrace(): { trace: Trace; events: string[] } {
  const events: string[] = []
  return {
    events,
    trace: {
      response: () => events.push('response'),
      output: () => events.push('output'),
      validation: (ok) => events.push(`validation:${ok}`),
      retry: (feedback) => events.push(`retry:${feedback}`),
    },
  }
}

// ------------------------------------------------------------------- success

describe('execute — success on the first attempt', () => {
  test('returns the validated value and confirms the call, without a retry', async () => {
    const { session, calls } = fakeSession([callResponse('valid')])

    const value = await execute({
      session,
      request: 'build a rig for Master of Puppets',
      tools: [TOOL],
      force: TOOL.name,
      validate,
    })

    assert.equal(value, 'validated-rig')
    assert.equal(calls.responded, 1, 'only one call to the model — no retry needed')
    assert.equal(calls.corrected.length, 0)
    assert.deepEqual(calls.confirmed, [{ call: { id: 'call-1', name: TOOL.name, args: 'valid' }, text: CONFIRMATION }])
    assert.deepEqual(calls.rolledBackTo, [], 'a successful call never rolls back')
  })

  test('asks with the exact request text passed in', async () => {
    const { session, calls } = fakeSession([callResponse('valid')])

    await execute({ session, request: 'the exact request', tools: [TOOL], force: TOOL.name, validate })

    assert.deepEqual(calls.asked, ['the exact request'])
  })
})

// --------------------------------------------------------- retry (the trace)

describe('execute — failure then retry', () => {
  test('a failed first attempt’s feedback is fed back via correct(), and the second attempt can still succeed', async () => {
    const { session, calls } = fakeSession([callResponse('bogus'), callResponse('valid')])

    const value = await execute({
      session,
      request: 'build a rig',
      tools: [TOOL],
      force: TOOL.name,
      validate,
    })

    assert.equal(value, 'validated-rig')
    assert.equal(calls.responded, 2, 'exactly two attempts — the retry')
    assert.equal(calls.corrected.length, 1, 'the failed attempt’s issues are corrected exactly once')
    assert.equal(calls.corrected[0]!.call.args, 'bogus', 'correct() is about the call that FAILED, not the retry')
    assert.match(
      calls.corrected[0]!.feedback,
      /invalid enum value/,
      'the feedback fed back to the model is the validation issue text',
    )
    assert.equal(calls.confirmed.length, 1, 'only the successful (second) call gets confirmed')
  })

  test('trace hooks fire in order: response, output, validation(false), retry, then success', async () => {
    const { session } = fakeSession([callResponse('bogus'), callResponse('valid')])
    const { trace, events } = fakeTrace()

    await execute({ session, request: 'req', tools: [TOOL], force: TOOL.name, validate, trace })

    assert.deepEqual(events, [
      'response',
      'output',
      'validation:false',
      'retry:The rig failed validation. Fix exactly these points and call the tool again:\n- amp: invalid enum value, expected \'A\' | \'B\'',
      'response',
      'output',
      'validation:true',
    ])
  })
})

// ---------------------------------------------------- both attempts fail

describe('execute — both attempts fail', () => {
  test('throws with the zod-issue-shaped detail after exactly two attempts, no third', async () => {
    const { session, calls } = fakeSession([callResponse('bogus'), callResponse('still bogus')])

    await assert.rejects(
      execute({ session, request: 'req', tools: [TOOL], force: TOOL.name, validate }),
      (err: Error) => {
        assert.match(err.message, /failed validation twice/)
        assert.match(err.message, /amp: invalid enum value/)
        return true
      },
    )

    assert.equal(calls.responded, 2, 'never a third attempt')
    assert.equal(calls.corrected.length, 1, 'only the first failure gets a correction — the second is terminal')
  })

  test('rolls the session history back to exactly where it stood before this call', async () => {
    const { session, calls, historyLength } = fakeSession([callResponse('bogus'), callResponse('still bogus')])

    // Seed some pre-existing history, the way a real session would carry one.
    session.ask('an earlier turn, already answered')
    const preExistingLength = historyLength()

    await assert.rejects(execute({ session, request: 'req', tools: [TOOL], force: TOOL.name, validate }))

    assert.deepEqual(calls.rolledBackTo, [preExistingLength])
    assert.equal(
      historyLength(),
      preExistingLength,
      'the half-finished turn must not linger and poison the next call',
    )
  })

  test('issuesToError formats every issue with its path and message', () => {
    const err = issuesToError([
      { path: ['scenes', 'base', 'params', 'gain'], message: 'expected number, received string' },
      { path: [], message: 'top-level problem' },
    ])
    assert.match(err.message, /scenes\.base\.params\.gain: expected number, received string/)
    assert.match(err.message, /\(root\): top-level problem/)
  })
})

// ---------------------------------------------------------------- no call

describe('execute — the model answers without calling the tool', () => {
  test('throws, naming the required tool and the stop reason, when there is no onNoCall', async () => {
    const { session } = fakeSession([textResponse('I have a question first.')])

    await assert.rejects(
      execute({ session, request: 'req', tools: [TOOL], force: TOOL.name, validate }),
      /apply_rig_fixture/,
    )
  })

  test('delegates to onNoCall and returns its value when provided (the chat case)', async () => {
    const { session, calls } = fakeSession([textResponse('what album is this from?')])

    const value = await execute<{ text: string }>({
      session,
      request: 'req',
      tools: [TOOL],
      force: null,
      validate: () => {
        throw new Error('validate must not run when there is no call')
      },
      onNoCall: (text) => ({ text }),
    })

    assert.deepEqual(value, { text: 'what album is this from?' })
    assert.equal(calls.confirmed.length, 0)
    assert.equal(calls.rolledBackTo.length, 0, 'answering without a tool call is not a failure')
  })
})

// --------------------------------------------------------------- issue text

describe('issuesToText', () => {
  test('lists every issue as a bullet with its dotted path', () => {
    const text = issuesToText([
      { path: ['scenes', 'base', 'gain'], message: 'too high' },
      { path: ['amp'], message: 'unknown amp' },
    ])
    assert.match(text, /- scenes\.base\.gain: too high/)
    assert.match(text, /- amp: unknown amp/)
  })

  test('a root-level issue (empty path) reads as (root), not a blank segment', () => {
    const text = issuesToText([{ path: [], message: 'must contain a "base" scene' }])
    assert.match(text, /\(root\): must contain a "base" scene/)
  })
})
