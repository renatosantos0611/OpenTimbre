/**
 * Turns the provider model lists into the `ModelInfo[]` the model picker
 * shows. The label and cost-tier rules were ported from the legacy
 * (`legacy/desktop/renderer/app.ts` `rotuloModelo`); the tier is derived from
 * the model id because neither provider returns pricing. A provider that fails
 * to list simply contributes nothing — the call never fails wholesale (see
 * `opentimbre-testing`). The key is read by the caller (main) and never
 * reaches this module or its return value (see `opentimbre-secrets`).
 */
import type { ModelInfo, ProviderId } from '@opentimbre/contracts'
import type { RigChatProvider } from '@opentimbre/core/src/chat/rig-chat.ts'

/**
 * `"gpt-5.6-sol"` → `"GPT-5.6 Sol"`, `"claude-sonnet-4-5"` → `"Claude Sonnet
 * 4.5"`. Anthropic's trailing `-N-N` (or already-dotted `N.N`) is its point
 * release — same shape `modelTier` parses. An id that doesn't match its
 * provider's shape passes through unchanged.
 */
export function modelLabel(provider: ProviderId, id: string): string {
  if (provider === 'openai') {
    const match = /^gpt-(\d+(?:\.\d+)?)(?:-([a-z0-9]+))?$/i.exec(id)
    if (!match) return id
    const [, version, codename] = match
    const suffix = codename ? ` ${codename.charAt(0).toUpperCase()}${codename.slice(1)}` : ''
    return `GPT-${version}${suffix}`
  }
  const match = /^claude-([a-z]+)-(\d+(?:[-.]\d+)?)$/i.exec(id)
  if (!match) return id
  const [, family, version] = match
  return `Claude ${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.replace('-', '.')}`
}

/**
 * A coarse cost estimate bucketed from the model id. OpenAI's reasoning family
 * (`o*`) and the newest `gpt-5.6+` are `high`; `gpt-5.x` is `mid`; the older
 * `gpt-3.5/4` are `low`. Anthropic buckets by version: `4.5+` high, `4.x` mid,
 * older low. Unknown ids default to `mid`, never crash.
 */
export function modelTier(provider: ProviderId, id: string): 'low' | 'mid' | 'high' {
  if (provider === 'openai') {
    if (/^o\d/.test(id)) return 'high'
    const version = /^gpt-(\d+(?:\.\d+)?)/.exec(id)?.[1]
    if (!version) return 'mid'
    const n = Number(version)
    if (n >= 5.6) return 'high'
    if (n >= 5) return 'mid'
    return 'low'
  }
  const dashed = /-(\d+)-(\d+)$/.exec(id)
  const dotted = dashed ? null : /-(\d+(?:\.\d+)?)$/.exec(id)
  const n = dashed ? Number(dashed[1]) + Number(`0.${dashed[2]}`) : dotted ? Number(dotted[1]) : NaN
  if (!Number.isFinite(n)) return 'mid'
  if (n >= 4.5) return 'high'
  if (n >= 4) return 'mid'
  return 'low'
}

/**
 * Merges every provider's models into one list. Providers without a key are
 * absent from the array (the caller builds them only when a key exists), and a
 * provider whose list call fails — or returns a malformed response — is mapped
 * inside the `allSettled` callback so it contributes nothing instead of
 * failing the whole call.
 */
export async function listAvailableModels(providers: readonly RigChatProvider[]): Promise<ModelInfo[]> {
  const settled = await Promise.allSettled(
    providers.map(async (p) => {
      const models = await p.listModels()
      return models
        .filter((m) => typeof m?.id === 'string' && m.id.length > 0)
        .map((m) => ({
          provider: p.id,
          id: m.id,
          label: modelLabel(p.id, m.id),
          tier: modelTier(p.id, m.id),
          releasedAt: typeof m.releasedAt === 'number' ? m.releasedAt : 0,
        }))
    }),
  )
  const merged = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  // Newest first; a provider that didn't report a date (releasedAt 0) sorts last.
  merged.sort((a, b) => b.releasedAt - a.releasedAt)
  return merged.map(({ releasedAt: _releasedAt, ...model }) => model)
}