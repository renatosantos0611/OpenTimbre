import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidatedChannel, validatePayload } from './validation.ts'

test('validates renderer payloads before domain side effects', () => {
  assert.equal(validatePayload('chat:send', 'make a clean tone'), 'make a clean tone')
  assert.equal(validatePayload('conversations:open', 'conv-1'), 'conv-1')
  assert.equal(validatePayload('conversations:delete', 'conv-1'), 'conv-1')
  assert.deepEqual(validatePayload('keys:save', ['openai', 'sk-test']), ['openai', 'sk-test'])
})

test('rejects malformed payloads at the IPC boundary', () => {
  assert.throws(() => validatePayload('chat:send', ''), /at least 1 character/)
  assert.throws(() => validatePayload('chat:send', 'x'.repeat(4001)), /at most 4000/)
  assert.throws(() => validatePayload('window:setLocale', 'fr'), /Invalid enum value/)
  assert.throws(() => validatePayload('keys:save', ['openai']), /at least 2 element/)
})

test('recognizes only channels with runtime schemas', () => {
  assert.equal(isValidatedChannel('chat:send'), true)
  assert.equal(isValidatedChannel('unknown:channel'), false)
})

test('multi-arg channels expect a single tuple payload, as the preload sends', () => {
  // The preload packages provider/id (and provider/key) as one tuple
  // argument; the handler and schema must agree on that shape.
  assert.deepEqual(validatePayload('ai:model', ['openai', 'gpt-4o']), ['openai', 'gpt-4o'])
  assert.deepEqual(validatePayload('keys:save', ['openai', 'sk-test']), ['openai', 'sk-test'])
  assert.throws(() => validatePayload('ai:model', 'openai'), /array/)
  assert.throws(() => validatePayload('keys:save', 'openai'), /array/)
})

test('config:guitar validates a full Guitar object', () => {
  const guitar = { model: 'Tele', pickups: 'HSS', tuning: 'Drop D', strings: 6 }
  assert.deepEqual(validatePayload('config:guitar', guitar), guitar)
  assert.throws(() => validatePayload('config:guitar', { model: 'x' }), /pickups/)
  assert.throws(() => validatePayload('config:guitar', 'stratocaster'), /object/)
})
