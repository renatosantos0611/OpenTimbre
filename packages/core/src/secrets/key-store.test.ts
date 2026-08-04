/**
 * Characterization tests for `key-store.ts`, encoding the invariants legacy's
 * `chaves.ts` validated informally: rejection at the boundary, app-key
 * precedence over `.env`, reversible removal (including restoring true
 * absence), the unprotected marking when no vault is configured, and a vault
 * that can't decrypt being treated as a lost key rather than a crash.
 *
 * Every test calls `configure({ file: ':memory:', ... })` first — per
 * `key-store.ts`'s own contract, that always opens a fresh in-memory database
 * and resets the captured environment snapshot, so tests never see another
 * test's rows or environment capture.
 */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import type { Vault } from '../ports/vault.ts'
import { applyToEnvironment, configure, list, remove, save } from './key-store.ts'

const ANTHROPIC_ENV = 'ANTHROPIC_API_KEY'
const OPENAI_ENV = 'OPENAI_API_KEY'

/** A trivial in-memory vault, per `opentimbre-testing` (never a real keychain). */
function fakeVault(): Vault {
  const prefix = 'sealed:'
  return {
    protect: (plain) => Buffer.from(prefix + plain, 'utf8'),
    reveal: (sealed) => {
      const text = Buffer.from(sealed).toString('utf8')
      if (!text.startsWith(prefix)) throw new Error('not sealed by this vault')
      return text.slice(prefix.length)
    },
  }
}

/** Simulates a database copied from another machine, or a different Windows account. */
function unreadableVault(): Vault {
  return {
    protect: () => {
      throw new Error('not exercised in these tests')
    },
    reveal: () => {
      throw new Error('cannot decrypt: wrong account')
    },
  }
}

// Tests mutate process.env to control the "original environment" each
// scenario captures; restore both keys afterward so this file leaves no trace
// on the rest of the suite.
afterEach(() => {
  delete process.env[ANTHROPIC_ENV]
  delete process.env[OPENAI_ENV]
})

test('save() rejects an empty key', () => {
  configure({ file: ':memory:', vault: null })
  assert.throws(() => save('anthropic', ''), /Empty key/)
  assert.throws(() => save('anthropic', '   '), /Empty key/)
})

test('save() rejects a key with whitespace in the middle', () => {
  configure({ file: ':memory:', vault: null })
  assert.throws(() => save('anthropic', 'sk-ant abc123'), /whitespace in the middle/)
})

test('a saved app key takes precedence over an environment variable for the same provider', () => {
  process.env[ANTHROPIC_ENV] = 'env-value'
  configure({ file: ':memory:', vault: null })

  save('anthropic', 'app-value')

  assert.equal(process.env[ANTHROPIC_ENV], 'app-value')
  const info = list().find((k) => k.provider === 'anthropic')
  assert.equal(info?.source, 'app')
})

test('removing a key restores the original environment value', () => {
  process.env[ANTHROPIC_ENV] = 'env-value'
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'app-value')
  assert.equal(process.env[ANTHROPIC_ENV], 'app-value')

  remove('anthropic')

  assert.equal(process.env[ANTHROPIC_ENV], 'env-value')
})

test('removing a key restores true absence, not an empty string, when there was no original value', () => {
  delete process.env[ANTHROPIC_ENV]
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'app-value')
  assert.equal(process.env[ANTHROPIC_ENV], 'app-value')

  remove('anthropic')

  assert.equal(ANTHROPIC_ENV in process.env, false)
  assert.equal(process.env[ANTHROPIC_ENV], undefined)
})

test('a row saved with no vault configured is marked unprotected, not silently claimed as protected', () => {
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'app-value')

  const info = list().find((k) => k.provider === 'anthropic')
  assert.equal(info?.protected, false)
  assert.equal(info?.readable, true)
})

test('a row saved with a vault configured is marked protected and stays readable', () => {
  configure({ file: ':memory:', vault: fakeVault() })
  save('anthropic', 'app-value')

  const info = list().find((k) => k.provider === 'anthropic')
  assert.equal(info?.protected, true)
  assert.equal(info?.readable, true)
  assert.equal(process.env[ANTHROPIC_ENV], 'app-value')
})

test("list() reports source as 'app', 'environment', or 'none' depending on what's actually usable", () => {
  delete process.env[ANTHROPIC_ENV]
  process.env[OPENAI_ENV] = 'env-value'
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'app-value')
  // openai gets no app key at all — its info should come from the environment.

  const info = list()
  const anthropic = info.find((k) => k.provider === 'anthropic')
  const openai = info.find((k) => k.provider === 'openai')

  assert.equal(anthropic?.source, 'app')
  assert.equal(openai?.source, 'environment')
})

test("list() reports source 'none' when neither an app key nor an environment variable is present", () => {
  delete process.env[ANTHROPIC_ENV]
  delete process.env[OPENAI_ENV]
  configure({ file: ':memory:', vault: null })

  const info = list()
  assert.equal(info.find((k) => k.provider === 'anthropic')?.source, 'none')
  assert.equal(info.find((k) => k.provider === 'openai')?.source, 'none')
})

test('a vault that fails to reveal a row (wrong account, copied database) is a lost key, not a crash', () => {
  delete process.env[ANTHROPIC_ENV]
  configure({ file: ':memory:', vault: fakeVault() })
  save('anthropic', 'app-value')

  // Swap only the vault — same database, simulating the row surviving a move
  // to another machine or a different Windows account.
  configure({ vault: unreadableVault() })

  const info = list().find((k) => k.provider === 'anthropic')
  assert.equal(info?.readable, false)
  assert.equal(info?.source, 'none')

  assert.doesNotThrow(() => applyToEnvironment())
  assert.equal(ANTHROPIC_ENV in process.env, false)
})
