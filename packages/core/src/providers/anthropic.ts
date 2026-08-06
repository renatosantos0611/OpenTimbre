/**
 * Anthropic provider: a `Session` (the `tool-use.ts` protocol) built over the
 * Messages API's own history shape, plus the free-call key validation that
 * `resolve.ts` needs to decide whether this provider is usable.
 *
 * Ported from legacy's `providers/anthropic.ts`. Two things particular to
 * this API, handled in `createSession`:
 * - `system` travels OUTSIDE the messages array, so resuming later already
 *   uses the current prompt.
 * - After a `tool_use`, the API requires a `tool_result` with the same id
 *   before anything else can be sent. Instead of spending a call just to
 *   close it, the result is held and travels with the next `ask()`.
 *
 * **On the client type.** Legacy calls `new Anthropic()` directly in this
 * file. This module keeps the client INJECTED instead — a constructor
 * parameter, not a module-level `new Anthropic()` — for the same reason
 * `secrets/key-store.ts` injects its vault: per `opentimbre-testing`, no
 * test may make a live API call, so whatever exercises this module's session
 * logic needs to hand it a fake client. `AnthropicClient` below is typed
 * entirely in terms of `@anthropic-ai/sdk`'s own exported request/response
 * types (`Anthropic.MessageCreateParamsNonStreaming`, `Anthropic.Message`,
 * `Anthropic.ModelInfo`, ...) — not a hand-rolled duplicate of them — so a
 * real `new Anthropic({ apiKey })` instance satisfies it as-is, and a test
 * can satisfy it with a plain object shaped like the SDK's real response
 * types, without a live call.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { AvailableModel, ProviderId } from '@opentimbre/contracts'
import type { Validation } from './resolve.ts'
import type { Call, Response, Session, ToolDef } from './tool-use.ts'

export const KEY_ENV = 'ANTHROPIC_API_KEY'
const DEFAULT_MODEL = 'claude-opus-5'
const MAX_OUTPUT = 16000

// -------------------------------------------------------------- the port

/**
 * The narrow slice of the Anthropic SDK this module needs — a port, not a
 * copy of the client. Every type it mentions comes from `@anthropic-ai/sdk`
 * itself; a real client satisfies this structurally with no adapter code.
 */
export type AnthropicClient = {
  readonly messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>
  }
  readonly models: {
    /** Model-listing endpoint: free, no tokens spent — proves the key and confirms the model exists. */
    list(params?: Anthropic.ModelListParams): Promise<{ readonly data: readonly Anthropic.ModelInfo[] }>
  }
}

// ----------------------------------------------------------------- session

/** By TYPE of block, never by position: with thinking on, the first block isn't the tool_use. */
function findToolUse(content: readonly Anthropic.ContentBlock[]): Anthropic.ToolUseBlock | null {
  return content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use') ?? null
}

function textOf(content: readonly Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export function createSession(client: AnthropicClient, model: string, system: string, history?: unknown): Session {
  const messages: Anthropic.MessageParam[] = Array.isArray(history)
    ? [...history] as Anthropic.MessageParam[]
    : []
  let pending: Anthropic.ToolResultBlockParam | null = null

  return {
    label: 'Anthropic',
    model: () => model,

    ask(text) {
      const content: Anthropic.ContentBlockParam[] = []
      if (pending) {
        content.push(pending)
        pending = null
      }
      content.push({ type: 'text', text })
      messages.push({ role: 'user', content })
    },

    async respond(tools: readonly ToolDef[], force: string | null): Promise<Response> {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_OUTPUT,
        system,
        tools: tools.map((t): Anthropic.Tool => ({
          name: t.name,
          description: t.description,
          input_schema: t.schema as Anthropic.Tool.InputSchema,
        })),
        ...(force ? { tool_choice: { type: 'tool' as const, name: force } } : {}),
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })
      const block = findToolUse(response.content)

      return {
        text: textOf(response.content),
        call: block ? { id: block.id, name: block.name, args: block.input } : null,
        raw: response,
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        stopReason: response.stop_reason,
      }
    },

    correct(call: Call, feedback: string) {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: call.id, is_error: true, content: feedback }],
      })
    },

    confirm(call: Call, text: string) {
      pending = { type: 'tool_result', tool_use_id: call.id, content: text }
    },

    mark: () => messages.length,
    rollback(mark: number) {
      messages.length = mark
    },
    history: () => messages,
  }
}

// --------------------------------------------------------------- validation

function hasKey(): boolean {
  return Boolean(process.env[KEY_ENV]?.trim())
}

function model(): string {
  return process.env['ANTHROPIC_MODEL'] ?? DEFAULT_MODEL
}

/**
 * Classified from the SDK's own typed exceptions — a 401 reads differently
 * to the user than "no connection to api.anthropic.com". `Anthropic` is
 * imported for its type namespace throughout this file; these three error
 * classes are its only VALUE use, so a test that never exercises this catch
 * block never needs to construct a real `Anthropic` instance either.
 */
function classify(err: unknown): Validation {
  if (err instanceof Anthropic.AuthenticationError) {
    return { ok: false, reason: 'invalid-key', detail: `${KEY_ENV} rejected (401)` }
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { ok: false, reason: 'no-access', detail: `${KEY_ENV} lacks permission (403)` }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { ok: false, reason: 'error', detail: 'no connection to api.anthropic.com' }
  }
  return { ok: false, reason: 'error', detail: err instanceof Error ? err.message : String(err) }
}

async function validate(client: AnthropicClient): Promise<Validation> {
  if (!hasKey()) return { ok: false, reason: 'no-key', detail: `${KEY_ENV} not set` }
  try {
    const page = await client.models.list({ limit: 20 })
    const ids = page.data.map((m) => m.id)
    const wanted = model()
    const known = ids.includes(wanted)
    return {
      ok: true,
      detail: known
        ? `key valid, model '${wanted}' available`
        : `key valid (model '${wanted}' wasn't in the first page — may still exist)`,
    }
  } catch (err) {
    return classify(err)
  }
}

// ------------------------------------------------------------------ provider

export type AnthropicProvider = {
  readonly id: ProviderId
  readonly label: string
  readonly keyEnv: string
  model(): string
  hasKey(): boolean
  validate(): Promise<Validation>
  createSession(system: string, history?: unknown): Session
  listModels(): Promise<AvailableModel[]>
}

/** Binds this provider's session/validation logic to an injected client. */
export function anthropicProvider(client: AnthropicClient): AnthropicProvider {
  return {
    id: 'anthropic',
    label: 'Anthropic',
    keyEnv: KEY_ENV,
    model,
    hasKey,
    validate: () => validate(client),
    createSession: (system, history) => createSession(client, model(), system, history),
    listModels: async () => {
      const page = await client.models.list({ limit: 100 })
      return page.data.map((item) => ({ provider: 'anthropic', providerLabel: 'Anthropic', id: item.id }))
    },
  }
}
