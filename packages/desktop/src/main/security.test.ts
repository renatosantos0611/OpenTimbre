import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertTrustedSender, denyPermission, isTrustedNavigation } from './security.ts'

test('accepts only the configured application origin', () => {
  assert.doesNotThrow(() => assertTrustedSender({ url: 'app://opentimbre/index.html' }, 'app://opentimbre'))
  assert.throws(() => assertTrustedSender({ url: 'https://evil.example/' }, 'app://opentimbre'), /Untrusted IPC sender/)
})

test('navigation policy rejects external origins', () => {
  assert.equal(isTrustedNavigation('app://opentimbre/settings', 'app://opentimbre'), true)
  assert.equal(isTrustedNavigation('https://evil.example', 'app://opentimbre'), false)
})

test('permission policy denies every permission request by default', () => {
  assert.equal(denyPermission(), false)
})
