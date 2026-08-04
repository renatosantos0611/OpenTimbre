/**
 * Behavior tests for `resolveProvider`'s first-valid-key-wins logic, against
 * fake `ProviderCandidate`s whose `validate()` is a canned function — never a
 * real network call, per `opentimbre-testing`. What's under test is the
 * ordering/forcing/short-circuit decisions ported from legacy's
 * `provider.ts`, not any provider's actual validation mechanics.
 */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { configure, save } from '../secrets/key-store.ts'
import { resolveProvider, type ProviderCandidate, type Validation } from './resolve.ts'

const ANTHROPIC_ENV = 'ANTHROPIC_API_KEY'
const OPENAI_ENV = 'OPENAI_API_KEY'

afterEach(() => {
  delete process.env[ANTHROPIC_ENV]
  delete process.env[OPENAI_ENV]
})

function candidate(
  id: 'anthropic' | 'openai',
  keyEnv: string,
  result: Validation | (() => never),
): ProviderCandidate & { calls: number } {
  let calls = 0
  const c = {
    id,
    label: id,
    keyEnv,
    calls: 0,
    async validate(): Promise<Validation> {
      calls++
      c.calls = calls
      if (typeof result === 'function') return result()
      return result
    },
  }
  return c
}

test('picks the first candidate whose key validates', async () => {
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'ant-key')

  const anthropic = candidate('anthropic', ANTHROPIC_ENV, { ok: true, detail: 'good' })
  const openai = candidate('openai', OPENAI_ENV, () => {
    throw new Error('must not be reached — anthropic already won')
  })

  const resolution = await resolveProvider([anthropic, openai])

  assert.equal(resolution.chosen.id, 'anthropic')
  assert.equal(anthropic.calls, 1)
})

test('falls through to the next candidate when the first has a key but it doesn’t validate', async () => {
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'ant-key')
  save('openai', 'oai-key')

  const anthropic = candidate('anthropic', ANTHROPIC_ENV, {
    ok: false,
    reason: 'invalid-key',
    detail: 'rejected (401)',
  })
  const openai = candidate('openai', OPENAI_ENV, { ok: true, detail: 'good' })

  const resolution = await resolveProvider([anthropic, openai])

  assert.equal(resolution.chosen.id, 'openai')
  assert.equal(resolution.checks.length, 2)
  assert.equal(resolution.checks[0]!.validation.ok, false)
})

test('never calls validate() for a candidate with no key at all — no network call to spend', async () => {
  configure({ file: ':memory:', vault: null })
  save('openai', 'oai-key')
  // no key ever saved or set in env for anthropic

  const anthropic = candidate('anthropic', ANTHROPIC_ENV, () => {
    throw new Error('validate() must not be called when list() already knows there is no key')
  })
  const openai = candidate('openai', OPENAI_ENV, { ok: true, detail: 'good' })

  const resolution = await resolveProvider([anthropic, openai])

  assert.equal(resolution.chosen.id, 'openai')
  const firstCheck = resolution.checks[0]!.validation
  assert.equal(firstCheck.ok, false)
  assert.equal(!firstCheck.ok && firstCheck.reason, 'no-key')
})

test('an app-saved key wins over an environment variable, per opentimbre-secrets precedence', async () => {
  configure({ file: ':memory:', vault: null })
  process.env[ANTHROPIC_ENV] = 'env-key-should-lose'
  save('anthropic', 'app-key-should-win')

  let seenEnvValue: string | undefined
  const anthropic: ProviderCandidate = {
    id: 'anthropic',
    label: 'Anthropic',
    keyEnv: ANTHROPIC_ENV,
    async validate() {
      seenEnvValue = process.env[ANTHROPIC_ENV]
      return { ok: true, detail: 'good' }
    },
  }

  await resolveProvider([anthropic])

  assert.equal(seenEnvValue, 'app-key-should-win')
})

test('AI_PROVIDER forces a single candidate — an invalid key there is a terminal error, not a fallback', async () => {
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'ant-key')
  save('openai', 'oai-key')

  const anthropic = candidate('anthropic', ANTHROPIC_ENV, {
    ok: false,
    reason: 'invalid-key',
    detail: 'rejected (401)',
  })
  const openai = candidate('openai', OPENAI_ENV, () => {
    throw new Error('must not be reached — AI_PROVIDER=anthropic forces only that candidate')
  })

  await assert.rejects(
    resolveProvider([anthropic, openai], { forcedEnv: 'anthropic' }),
    /AI_PROVIDER='anthropic' was forced, but its key doesn't work/,
  )
})

test('an unknown AI_PROVIDER value fails immediately, listing the known ids', async () => {
  configure({ file: ':memory:', vault: null })
  const anthropic = candidate('anthropic', ANTHROPIC_ENV, { ok: true, detail: 'good' })
  const openai = candidate('openai', OPENAI_ENV, { ok: true, detail: 'good' })

  await assert.rejects(
    resolveProvider([anthropic, openai], { forcedEnv: 'made-up' }),
    /'made-up' is unknown.*anthropic \| openai/s,
  )
})

test('a preference orders candidates but does not force them — the other still wins if the preferred key fails', async () => {
  configure({ file: ':memory:', vault: null })
  save('anthropic', 'ant-key')
  save('openai', 'oai-key')

  const anthropic = candidate('anthropic', ANTHROPIC_ENV, {
    ok: false,
    reason: 'invalid-key',
    detail: 'rejected',
  })
  const openai = candidate('openai', OPENAI_ENV, { ok: true, detail: 'good' })

  // Preference is anthropic, but its key doesn't validate — openai still wins.
  const resolution = await resolveProvider([anthropic, openai], { preference: 'anthropic' })

  assert.equal(resolution.chosen.id, 'openai')
})

test('no key anywhere throws "No valid AI key", without forcing', async () => {
  configure({ file: ':memory:', vault: null })

  const anthropic = candidate('anthropic', ANTHROPIC_ENV, () => {
    throw new Error('must not be called — no key configured')
  })
  const openai = candidate('openai', OPENAI_ENV, () => {
    throw new Error('must not be called — no key configured')
  })

  await assert.rejects(resolveProvider([anthropic, openai]), /No valid AI key/)
})
