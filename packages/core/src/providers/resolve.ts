/**
 * Picks the AI provider by testing which key is **actually valid**.
 *
 * A present env var isn't enough — a revoked key, a half-pasted one, or one
 * copied from `.env.example` is "present" and only fails once a rig is being
 * generated. So each candidate whose key-store entry isn't `'none'` is
 * checked, in order, and the first that validates wins. Ported from legacy's
 * `provider.ts`.
 *
 * Preference order: `AI_PROVIDER` (if set) forces a single candidate; else
 * the caller's preference **orders**, it doesn't force — with both keys
 * saved, whoever prefers GPT gets GPT, but with only one valid the app keeps
 * working instead of failing over a preference.
 *
 * Deviation from legacy: legacy's `Provider.validate()` calls the provider's
 * real model-listing endpoint directly. This module never may — per
 * `opentimbre-testing`, no test here may touch a network. So `validate` is a
 * parameter on `ProviderCandidate`, an injected port exactly like
 * `MidiTransport`/`Vault`: this module owns *which one wins*, never *how a
 * key is actually checked*. `anthropic.ts`/`openai.ts` supply that function
 * with a real, SDK-typed client injected in turn; tests supply a canned one.
 */
import type { ProviderId, ProviderPreference } from '@opentimbre/contracts'
import { applyToEnvironment, list } from '../secrets/key-store.ts'

export type Validation =
  | { readonly ok: true; readonly detail: string }
  | {
      readonly ok: false
      readonly reason: 'no-key' | 'invalid-key' | 'no-access' | 'error'
      readonly detail: string
    }

export type ProviderCandidate = {
  readonly id: ProviderId
  readonly label: string
  /** Env var name, used only in error messages. */
  readonly keyEnv: string
  /** The free/cheap call that proves the key works — injected, never called by a test. */
  validate(): Promise<Validation>
}

export type ProviderCheck = { readonly candidate: ProviderCandidate; readonly validation: Validation }
export type Resolution = { readonly chosen: ProviderCandidate; readonly checks: ProviderCheck[] }

/**
 * `forcedEnv` forces a single candidate — if its key doesn't work, that's an
 * error, never a silent fall-through to another provider. `preference` only
 * reorders the field.
 */
function orderedCandidates(
  candidates: readonly ProviderCandidate[],
  preference: ProviderPreference,
  forcedEnv: string | undefined,
): ProviderCandidate[] {
  const forced = forcedEnv?.trim().toLowerCase()
  if (forced) {
    const match = candidates.find((c) => c.id === forced)
    if (!match) {
      throw new Error(
        `AI_PROVIDER='${forced}' is unknown. Use: ${candidates.map((c) => c.id).join(' | ')}.`,
      )
    }
    return [match]
  }
  if (preference === 'auto') return [...candidates]
  return [...candidates].sort((a, b) => Number(b.id === preference) - Number(a.id === preference))
}

/**
 * Tests candidates in order and returns the first that validates.
 *
 * Syncs `process.env` from the key store first (`applyToEnvironment`) so an
 * app-entered key — which wins over `.env` per `opentimbre-secrets` — is
 * what actually gets validated. `list()` then answers "does this provider
 * have any key at all" cheaply, without spending a network call on a
 * provider nobody configured.
 */
export async function resolveProvider(
  candidates: readonly ProviderCandidate[],
  opts: { preference?: ProviderPreference; forcedEnv?: string } = {},
): Promise<Resolution> {
  applyToEnvironment()
  const ordered = orderedCandidates(candidates, opts.preference ?? 'auto', opts.forcedEnv)
  const keys = list()

  const checks: ProviderCheck[] = []
  for (const candidate of ordered) {
    const known = keys.find((k) => k.provider === candidate.id)
    const validation: Validation =
      known && known.source !== 'none'
        ? await candidate.validate()
        : { ok: false, reason: 'no-key', detail: `${candidate.keyEnv} not set` }

    checks.push({ candidate, validation })
    if (validation.ok) return { chosen: candidate, checks }
  }

  const detail = checks.map((c) => `  ${c.candidate.label}: ${c.validation.detail}`).join('\n')
  const forced = ordered.length < candidates.length
  const header = forced
    ? `AI_PROVIDER='${ordered[0]!.id}' was forced, but its key doesn't work.`
    : 'No valid AI key.'
  const hint = forced
    ? `Fix ${ordered[0]!.keyEnv}, or unset AI_PROVIDER to try every provider.`
    : `Set a key for ${candidates.map((c) => c.keyEnv).join(' or ')} (Settings, or the environment).`

  throw new Error(`${header}\n${detail}\n\n${hint}`)
}
