import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import type { Guitar, Result, Rig, Turn } from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import type { Call, Response, Session } from '@opentimbre/core/src/providers/tool-use.ts'
import type { RigChatProvider } from '@opentimbre/core/src/chat/rig-chat.ts'
import type { SceneApplier } from '../rig/scene-applier.ts'
import { createConversationRepository, type ConversationRepository } from './conversation-repository.ts'
import { createChatController, type ChatControllerOptions } from './chat-controller.ts'

const GUITAR: Guitar = {
  model: 'Test guitar',
  pickups: 'humbucker',
  tuning: 'E standard',
  strings: 6,
}

function response(call: Call | null, text = ''): Response {
  return { text, call, raw: { fake: true }, usage: { input: 1, output: 1 }, stopReason: 'end_turn' }
}

/** A fake provider whose native history records the exchange, like rig-chat.test.ts. */
function provider(label: string, responses: Response[]): RigChatProvider & { sessions: () => number } {
  let currentHistory: unknown[] = []
  let sessions = 0
  return {
    id: 'anthropic',
    label,
    model: () => 'fake-model',
    sessions: () => sessions,
    listModels: async () => [{ provider: 'anthropic', providerLabel: label, id: 'fake-model' }],
    createSession: () => {
      sessions++
      let index = 0
      const session: Session = {
        label: 'Fake',
        model: () => 'fake-model',
        ask(text) {
          currentHistory.push({ role: 'user', text })
        },
        async respond(tools, force) {
          void force
          void tools
          const next = responses[index++]
          if (!next) throw new Error('fake provider ran out of responses')
          currentHistory.push(next)
          return next
        },
        correct(_call, feedback) {
          currentHistory.push({ correction: feedback })
        },
        confirm(_call, text) {
          currentHistory.push({ confirmation: text })
        },
        mark: () => currentHistory.length,
        rollback(mark) {
          currentHistory = currentHistory.slice(0, mark)
        },
        history: () => currentHistory,
      }
      return session
    },
  }
}

function rig(plugin: string): Rig {
  const spec = CATALOG.find((entry) => entry.id === plugin)!
  const params: Record<string, number | boolean | string> = {}
  for (const [name, definition] of [...Object.entries(spec.ampParams), ...Object.entries(spec.params)]) {
    if (!definition.required) continue
    params[name] = definition.type === 'knob' ? 5 : definition.type === 'toggle' ? false : Object.keys(definition.options ?? {})[0]!
  }
  return {
    plugin,
    song: 'Song',
    artist: 'Artist',
    amp: plugin === 'petrucci' ? 'PIEZO' : 'CLN',
    note: 'Note',
    scenes: {
      base: {
        title: 'Base',
        summary: 's',
        explanation: 'e',
        guitar: { pickupPosition: 'bridge', volume: 10, tone: 10, technique: 'picking' },
        params,
      },
    },
  }
}

function toolArgs(plugin: string): Record<string, unknown> {
  const r = rig(plugin)
  return { song: r.song, artist: r.artist, amp: r.amp, note: r.note, scenes: r.scenes }
}

function rigResponse(plugin: string, text = 'Here is the rig.'): Response {
  return response({ id: '1', name: `apply_rig_${plugin}`, args: toolArgs(plugin) }, text)
}

function memRepo(): ConversationRepository {
  return createConversationRepository(new DatabaseSync(':memory:'))
}

function fakeApplier() {
  const rigs: Array<Rig | null> = []
  const applier: SceneApplier = { setRig: (r) => rigs.push(r), apply: async (s) => ({ scene: s, amp: 'CLN', ccsSent: 0, ms: 0, warnings: [] }) }
  return { applier, rigs }
}

function harness(over: Partial<ChatControllerOptions> = {}) {
  const statuses: Array<string | null> = []
  let now = '2026-01-01T00:00:00.000Z'
  let id = 0
  const { applier, rigs } = fakeApplier()
  const options: ChatControllerOptions = {
    repo: memRepo(),
    getProviders: () => [provider('Fake', [])],
    getGuitar: () => GUITAR,
    getLocale: () => 'en' as Locale,
    applier,
    send: (_channel, payload) => statuses.push(payload as string | null),
    clock: () => now,
    idGen: () => `conv-${++id}`,
    ...over,
  }
  return { controller: createChatController(options), statuses, rigs, advance: (iso: string) => (now = iso) }
}

test('first send lazily creates a provider session and persists the conversation', async () => {
  const { controller, statuses } = harness({
    getProviders: () => [provider('Fake', [rigResponse('gojira')])],
  })

  const turn = (await controller.send('Make a Gojira tone')) as Turn
  assert.equal(turn.rig?.plugin, 'gojira')
  assert.equal(turn.text, 'Here is the rig.')

  const list = (await controller.list()) as Result<unknown>
  assert.equal((list as { length: number }).length, 1, 'a conversation was persisted after the first turn')
  assert.deepEqual(statuses, ['querying', 'validating', null], 'status pill cycles then clears')
})

test('a second send in the same conversation persists an adjustment turn', async () => {
  const { controller } = harness({
    getProviders: () => [provider('Fake', [rigResponse('gojira'), rigResponse('gojira', 'Adjusted.')])],
  })

  await controller.send('Make a Gojira tone')
  const second = (await controller.send('More gain')) as Turn
  assert.equal(second.text, 'Adjusted.')

  const list = (await controller.list()) as { length: number }
  assert.equal(list.length, 1, 'still one conversation')
  const open = (await controller.open('conv-1')) as { messages: unknown[] }
  assert.equal(open.messages.length, 4, 'two turns persisted as four messages')
})

test('status phase changes surface via chat:status events', async () => {
  const { controller, statuses } = harness({
    getProviders: () => [
      provider('Fake', [
        response({ id: 'bad', name: 'apply_rig_gojira', args: { invalid: true } }, 'Retry.'),
        rigResponse('gojira', 'Fixed.'),
      ]),
    ],
  })

  await controller.send('Make a tone')

  assert.deepEqual(
    statuses,
    ['querying', 'validating', 'correcting', 'querying', 'validating', null],
    'a correction exposes querying → validating → correcting → validating',
  )
})

test('opening a compatible conversation resumes transcript, rig, and plugin', async () => {
  // Simulate a restart: a fresh controller over the same repo.
  const repo = memRepo()
  const first = harness({ repo, getProviders: () => [provider('Fake', [rigResponse('petrucci')])] })
  await first.controller.send('Make a Petrucci tone')

  const second = harness({ repo, getProviders: () => [provider('Fake', [])] })
  const resumed = (await second.controller.open('conv-1')) as {
    plugin: string | null
    memoryLost: boolean
    messages: unknown[]
  }
  assert.equal(resumed.plugin, 'petrucci')
  assert.equal(resumed.memoryLost, false)
  assert.equal(resumed.messages.length, 2)
  assert.equal(second.rigs[second.rigs.length - 1]?.plugin, 'petrucci', 'the loaded rig is reproduced for applying')
})

test('incompatible opaque history sets memoryLost while preserving messages', async () => {
  // Seed a conversation whose stored history is an older format / other provider.
  const db = new DatabaseSync(':memory:')
  const writeRepo = createConversationRepository(db)
  writeRepo.save({
    id: 'legacy',
    title: 'Old',
    plugin: 'gojira',
    provider: 'openai',
    model: 'ancient-model',
    history: { opaque: true },
    updatedAt: '2025-01-01T00:00:00.000Z',
    messages: [
      { role: 'user' as const, text: 'A readable old message' },
      { role: 'ai' as const, text: 'The old answer' },
    ],
  })

  const legacy = harness({ repo: writeRepo, getProviders: () => [provider('Fake', [])] })
  const opened = (await legacy.controller.open('legacy')) as { memoryLost: boolean; messages: unknown[]; plugin: string | null }
  assert.equal(opened.memoryLost, true, 'an incompatible history reports memory loss')
  assert.equal(opened.messages.length, 2, 'the readable messages are still shown')
  assert.equal(opened.plugin, 'gojira')
})

test('deleting the open conversation clears active chat and rig state', async () => {
  const { controller, rigs } = harness({ getProviders: () => [provider('Fake', [rigResponse('gojira')])] })
  await controller.send('Make a Gojira tone')
  assert.equal(rigs[rigs.length - 1]?.plugin, 'gojira')

  await controller.delete('conv-1')

  assert.equal(rigs[rigs.length - 1], null, 'deleting the open conversation clears the rig')
  const list = (await controller.list()) as { length: number }
  assert.equal(list.length, 0)
})

test('a provider failure is a localized chat error, never a thrown promise', async () => {
  const { controller } = harness({
    getProviders: () => [provider('Fake', [])], // empty responses → the fake throws
  })

  const result = (await controller.send('Anything')) as { error: string }
  assert.ok('error' in result, 'a failure is returned, not thrown')
  assert.match(result.error, /couldn't answer/i)

  const list = (await controller.list()) as { length: number }
  assert.equal(list.length, 1, 'an error turn is still persisted so the failure is visible')
})

test('a storage failure leaves the in-memory conversation usable', async () => {
  const failing: ConversationRepository = {
    save: () => { throw new Error('disk full') },
    get: () => null,
    list: () => [],
    remove: () => false,
  }
  const fake = provider('Fake', [rigResponse('gojira'), rigResponse('gojira', 'Second.')])
  const { controller } = harness({
    repo: failing,
    getProviders: () => [fake],
  })

  const first = (await controller.send('Make a Gojira tone')) as Turn
  assert.equal(first.rig?.plugin, 'gojira', 'the first turn succeeds despite the storage failure')

  const second = (await controller.send('Adjust')) as Turn
  assert.equal(second.text, 'Second.', 'the conversation stays usable for the next turn')
  assert.equal(fake.sessions(), 1, 'the same session (not a new conversation) serves the second turn')
})