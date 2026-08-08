import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createConversationRepository, type ConversationRecord } from './conversation-repository.ts'

function memdb(): DatabaseSync {
  return new DatabaseSync(':memory:')
}

function record(over: Partial<ConversationRecord> = {}): ConversationRecord {
  return {
    id: 'c1',
    title: 'First song',
    plugin: 'gojira',
    provider: 'anthropic',
    model: 'fake-model',
    history: [{ role: 'user', content: 'hi' }],
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [
      { role: 'user' as const, text: 'Make a Gojira tone' },
      {
        role: 'ai' as const,
        text: 'Here is the rig.',
        rig: { plugin: 'gojira', song: 's', artist: 'a', amp: 'CLN', note: '', scenes: {} },
      },
    ],
    ...over,
  }
}

test('save persists a conversation and get returns it intact', () => {
  const repo = createConversationRepository(memdb())
  repo.save(record())

  const got = repo.get('c1')
  assert.ok(got)
  assert.equal(got.id, 'c1')
  assert.equal(got.title, 'First song')
  assert.equal(got.plugin, 'gojira')
  assert.equal(got.provider, 'anthropic')
  assert.equal(got.model, 'fake-model')
  assert.deepEqual(got.history, [{ role: 'user', content: 'hi' }])
  assert.equal(got.updatedAt, '2026-01-01T00:00:00.000Z')
  assert.equal(got.messages.length, 2)
  assert.deepEqual(got.messages[1].rig, record().messages[1].rig)
})

test('save replaces the previous state atomically (one transaction per turn)', () => {
  const repo = createConversationRepository(memdb())
  repo.save(record())
  const next = record({ title: 'Second song', plugin: null, messages: [{ role: 'user' as const, text: 'One more' }] })
  repo.save(next)

  const got = repo.get('c1')!
  assert.equal(got.title, 'Second song')
  assert.equal(got.plugin, null)
  assert.equal(got.messages.length, 1, 'old messages are replaced, not duplicated')
})

test('get returns null for an unknown id', () => {
  const repo = createConversationRepository(memdb())
  assert.equal(repo.get('missing'), null)
})

test('list returns summaries ordered by most recent update', () => {
  const repo = createConversationRepository(memdb())
  repo.save(record({ id: 'older', updatedAt: '2026-01-01T00:00:00.000Z' }))
  repo.save(record({ id: 'newer', title: 'Newer', updatedAt: '2026-01-02T00:00:00.000Z' }))

  const list = repo.list()
  assert.equal(list.length, 2)
  assert.equal(list[0].id, 'newer')
  assert.equal(list[1].id, 'older')
  assert.equal(list[0].turns, 2, 'turns counts the persisted messages')
})

test('remove deletes a conversation and its messages, reporting whether it existed', () => {
  const repo = createConversationRepository(memdb())
  repo.save(record())

  assert.equal(repo.remove('c1'), true)
  assert.equal(repo.get('c1'), null)
  assert.equal(repo.list().length, 0)
  assert.equal(repo.remove('c1'), false, 'removing again reports nothing was deleted')
})

test('a zero-history conversation round-trips with opaque history preserved', () => {
  const repo = createConversationRepository(memdb())
  const r = record({ history: { impossible: true } })
  repo.save(r)
  assert.deepEqual(repo.get('c1')!.history, { impossible: true })
})

test('migrates the schema once and is idempotent across repositories', () => {
  const db = memdb()
  createConversationRepository(db)
  createConversationRepository(db) // a second open must not fail or duplicate
  const repo = createConversationRepository(db)
  repo.save(record())
  assert.ok(repo.get('c1'))
})