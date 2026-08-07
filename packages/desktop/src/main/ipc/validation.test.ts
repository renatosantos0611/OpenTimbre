import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isValidatedChannel, validatePayload } from './validation.ts'

test('validates renderer payloads before domain side effects', () => {
  assert.equal(validatePayload('chat:send', 'make a clean tone'), 'make a clean tone')
  assert.deepEqual(validatePayload('keys:save', ['openai', 'sk-test']), ['openai', 'sk-test'])
})

test('rejects malformed payloads at the IPC boundary', () => {
  assert.throws(() => validatePayload('chat:send', ''), /at least 1 character/)
  assert.throws(() => validatePayload('window:setLocale', 'fr'), /Invalid enum value/)
  assert.throws(() => validatePayload('keys:save', ['openai']), /at least 2 element/)
})

test('recognizes only channels with runtime schemas', () => {
  assert.equal(isValidatedChannel('chat:send'), true)
  assert.equal(isValidatedChannel('unknown:channel'), false)
})
