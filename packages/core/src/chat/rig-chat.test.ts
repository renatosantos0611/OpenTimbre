/**
 * RigChat behavior without a provider network call. The fake provider records
 * tools and replays native session responses so catalog selection and resume
 * remain deterministic.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Guitar, Rig, Turn } from '@opentimbre/contracts'
import { CATALOG } from '../plugins/catalog.ts'
import type { Call, Response, Session, ToolDef } from '../providers/tool-use.ts'
import { createRigChat, listModels, type RigChatProvider, type RigChatSnapshot } from './rig-chat.ts'

const GUITAR: Guitar = {
  model: 'Test guitar',
  pickups: 'humbucker',
  tuning: 'E standard',
  strings: 6,
}

function response(call: Call | null, text = ''): Response {
  return { text, call, raw: { fake: true }, usage: { input: 1, output: 1 }, stopReason: 'end_turn' }
}

function provider(responses: Response[], history: unknown[] = []): RigChatProvider & { tools: ToolDef[][]; asks: string[] } {
  const tools: ToolDef[][] = []
  const asks: string[] = []
  let currentHistory = [...history]
  return {
    id: 'anthropic',
    label: 'Fake Anthropic',
    model: () => 'fake-model',
    tools,
    asks,
    listModels: async () => [{ provider: 'anthropic', providerLabel: 'Fake Anthropic', id: 'fake-model' }],
    createSession: () => {
      let responseIndex = 0
      const session: Session = {
        label: 'Fake',
        model: () => 'fake-model',
        ask(text) {
          asks.push(text)
          currentHistory.push({ role: 'user', text })
        },
        async respond(defs) {
          tools.push([...defs])
          const next = responses[responseIndex++]
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
  for (const field of [...Object.entries(spec.ampParams), ...Object.entries(spec.params)]) {
    const [name, definition] = field
    if (!definition.required) continue
    params[name] = definition.type === 'knob'
      ? 5
      : definition.type === 'toggle'
        ? false
        : Object.keys(definition.options ?? {})[0]!
  }

  return {
    plugin,
    song: 'Test song',
    artist: 'Test artist',
    amp: plugin === 'petrucci' ? 'PIEZO' : 'CLN',
    note: 'Test note',
    scenes: {
      base: {
        title: 'Base',
        summary: 'Test scene',
        explanation: 'A test scene for catalog selection.',
        guitar: { pickupPosition: 'bridge', volume: 10, tone: 10, technique: 'picking' },
        params,
      },
    },
  }
}

test('RigChat exposes one tool per catalog plugin and uses the selected tool', async () => {
  const selected = CATALOG.find((spec) => spec.id === 'petrucci')!
  const { plugin, ...args } = rig(selected.id)
  const fake = provider([{ text: 'Here is the rig.', call: { id: '1', name: `apply_rig_${selected.id}`, args }, raw: {}, usage: { input: 1, output: 1 }, stopReason: 'tool_use' }])
  const chat = createRigChat({ providers: [fake], locale: 'en', guitar: GUITAR })

  const turn = await chat.send('Make a Petrucci tone')

  assert.equal((turn as Turn).text, 'Here is the rig.')
  assert.equal(plugin, selected.id)
  assert.equal((turn as Turn).rig?.plugin, 'petrucci')
  assert.equal(fake.tools[0]?.length, CATALOG.length)
  assert.deepEqual(fake.tools[0]?.map((tool) => tool.name), CATALOG.map((spec) => `apply_rig_${spec.id}`))
})

test('RigChat accepts a text-only model answer without inventing a rig', async () => {
  const fake = provider([response(null, 'Which song should I target?')])
  const chat = createRigChat({ providers: [fake], locale: 'en', guitar: GUITAR })

  assert.deepEqual(await chat.send('Help me choose a tone'), {
    text: 'Which song should I target?',
    rig: null,
    cards: null,
  })
})

test('RigChat keeps the successful response text after one validation correction', async () => {
  const selected = CATALOG.find((spec) => spec.id === 'gojira')!
  const { plugin, ...args } = rig(selected.id)
  const fake = provider([
    response({ id: 'bad', name: `apply_rig_${selected.id}`, args: { invalid: true } }, 'Try one more time.'),
    response({ id: 'good', name: `apply_rig_${selected.id}`, args }, 'Corrected rig.'),
  ])
  const chat = createRigChat({ providers: [fake], locale: 'en', guitar: GUITAR })

  const turn = await chat.send('Make a Gojira tone')

  assert.equal(turn.text, 'Corrected rig.')
  assert.equal(plugin, selected.id)
  assert.equal(turn.rig?.plugin, 'gojira')
})

test('RigChat exports and resumes provider-native history', async () => {
  const fake = provider([response(null, 'First answer')])
  const chat = createRigChat({ providers: [fake], locale: 'en', guitar: GUITAR })
  await chat.send('First request')

  const snapshot = chat.export()
  assert.equal(snapshot.provider, 'anthropic')
  assert.equal(snapshot.model, 'fake-model')
  assert.ok(Array.isArray(snapshot.history))

  const resumed = createRigChat({ providers: [provider([response(null, 'Resumed answer')])], locale: 'en', guitar: GUITAR, resume: snapshot })
  assert.equal((await resumed.send('Continue')).text, 'Resumed answer')
  assert.equal(resumed.memoryLost, false)
})

test('incompatible resume data starts fresh and reports memory loss', async () => {
  const snapshot: RigChatSnapshot = { provider: 'openai', model: 'old-model', history: { impossible: true } }
  const chat = createRigChat({ providers: [provider([response(null, 'Fresh answer')])], locale: 'en', guitar: GUITAR, resume: snapshot })

  assert.equal((await chat.send('Start over')).text, 'Fresh answer')
  assert.equal(chat.memoryLost, true)
})

test('listModels combines model catalogs without contacting a live provider in the test', async () => {
  const fake = provider([])

  assert.deepEqual(await listModels([fake]), [
    { provider: 'anthropic', providerLabel: 'Fake Anthropic', id: 'fake-model' },
  ])
})
