/**
 * OpenAI provider — targets the **Responses API**, not `chat.completions`.
 *
 * Legacy's justification (`padroes.md` §9, this file's own header) still
 * holds and is carried forward rather than "simplified" away: reasoning
 * models refuse function tools on the older endpoint —
 *
 *   "Function tools with reasoning_effort are not supported for gpt-5.6-sol
 *    in /v1/chat/completions. To use function tools, use /v1/responses or
 *    set reasoning_effort to 'none'."
 *
 * Turning reasoning off to fit the old endpoint would trade tone quality for
 * plumbing convenience. The Responses API takes both together and serves the
 * older models fine too, so it's the one this module targets.
 *
 * What's particular to this API and lives here: a tool call's arguments
 * arrive as a **JSON string** (parsed with a handled error), the system
 * prompt travels as `instructions`, and a turn's output becomes the next
 * turn's input verbatim — that's how the API's own reasoning trail survives
 * between calls.
 *
 * **On the client type.** Same as `anthropic.ts`: the client is INJECTED (a
 * constructor parameter) rather than built here with `new OpenAI()`, so
 * nothing in this module ever needs a live key to be exercised. `OpenAIClient`
 * is typed entirely off `openai`'s own exported types
 * (`OpenAI.Responses.ResponseCreateParamsNonStreaming`, `OpenAI.Responses.Response`,
 * `OpenAI.Models.Model`, ...) rather than a hand-rolled duplicate of them, so
 * a real `new OpenAI({ apiKey })` instance satisfies it as-is.
 *
 * Narrowed from legacy: the model-catalog filtering/sorting
 * (`listarModelos`'s family/version/codename rules) and the reasoning-strip
 * rewrite for resuming a chat under a different model both exist only to
 * serve `createChat`, which is out of this task's scope (`buildRig` /
 * `adjustScene` only). Not ported here; a later task adds them alongside
 * chat itself, if `createChat` gets ported.
 */
import OpenAI from 'openai'
import type { AvailableModel, ProviderId } from '@opentimbre/contracts'
import type { Validation } from './resolve.ts'
import type { Call, Response, Session, ToolDef } from './tool-use.ts'

export const KEY_ENV = 'OPENAI_API_KEY'
const DEFAULT_MODEL = 'gpt-5'
/**
 * Ceiling on output tokens. In reasoning models the reasoning tokens count
 * against this too, so the limit needs real headroom beyond the rig itself —
 * too tight and the response comes back `incomplete` mid-tool.
 */
const MAX_OUTPUT = 32000

// -------------------------------------------------------------- the port

/**
 * The narrow slice of the OpenAI SDK this module needs — a port, not a copy
 * of the client. Every type it mentions comes from `openai` itself; a real
 * client satisfies this structurally with no adapter code.
 */
export type OpenAIClient = {
  readonly responses: {
    create(params: OpenAI.Responses.ResponseCreateParamsNonStreaming): Promise<OpenAI.Responses.Response>
  }
  readonly models: {
    list(): Promise<{ readonly data: readonly OpenAI.Models.Model[] }>
  }
}

// ----------------------------------------------------------------- session

type InputItem = OpenAI.Responses.ResponseInputItem
type OutputItem = OpenAI.Responses.ResponseOutputItem
type FunctionCall = OpenAI.Responses.ResponseFunctionToolCall

/** By type, not by position — reasoning blocks come before the call. */
function findCall(output: readonly OutputItem[]): FunctionCall | null {
  for (const item of output) if (item.type === 'function_call') return item
  return null
}

function parseArgs(call: FunctionCall): unknown {
  try {
    return JSON.parse(call.arguments)
  } catch {
    throw new Error(`The function's arguments aren't valid JSON:\n${call.arguments.slice(0, 500)}`)
  }
}

/** A tool call's result. Needs the same `call_id`. */
function output(call: Call, text: string): InputItem {
  return { type: 'function_call_output', call_id: call.id, output: text }
}

/**
 * Feeds a turn's output back in as the next turn's input — that's how the
 * Responses API preserves the reasoning trail between calls.
 *
 * The cast exists because the SDK's OUTPUT union carries a variant whose
 * `role` is wider than what INPUT accepts. For the items this code actually
 * produces — `reasoning`, `message`, `function_call` — the conversion is
 * exact, and it's the API's own contract: what comes out goes back in.
 */
function asInput(output: readonly OutputItem[]): InputItem[] {
  return output as unknown as InputItem[]
}

export function createSession(client: OpenAIClient, model: string, system: string, history?: unknown): Session {
  const input: InputItem[] = Array.isArray(history) ? [...history] as InputItem[] : []
  let pending: InputItem | null = null

  return {
    label: 'OpenAI',
    model: () => model,

    ask(text) {
      if (pending) {
        input.push(pending)
        pending = null
      }
      input.push({ type: 'message', role: 'user', content: text })
    },

    async respond(tools: readonly ToolDef[], force: string | null): Promise<Response> {
      const r = await client.responses.create({
        model,
        instructions: system,
        input,
        tools: tools.map((t): OpenAI.Responses.FunctionTool => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.schema,
          // The zod-derived schema has optional fields; OpenAI's strict mode requires every field required.
          strict: false,
        })),
        tool_choice: force ? { type: 'function', name: force } : 'auto',
        max_output_tokens: MAX_OUTPUT,
      })

      input.push(...asInput(r.output))
      const call = findCall(r.output)

      return {
        text: r.output_text.trim(),
        call: call ? { id: call.call_id, name: call.name, args: parseArgs(call) } : null,
        raw: r,
        usage: { input: r.usage?.input_tokens, output: r.usage?.output_tokens },
        // `incomplete` here is usually the output-token ceiling hit mid-tool.
        stopReason: r.status ?? null,
      }
    },

    correct(call: Call, feedback: string) {
      input.push(output(call, feedback))
    },

    confirm(call: Call, text: string) {
      pending = output(call, text)
    },

    mark: () => input.length,
    rollback(mark: number) {
      input.length = mark
    },
    history: () => input,
  }
}

// --------------------------------------------------------------- validation

function hasKey(): boolean {
  return Boolean(process.env[KEY_ENV]?.trim())
}

function model(): string {
  return process.env['OPENAI_MODEL'] ?? DEFAULT_MODEL
}

/**
 * Classified from the SDK's own typed exceptions. `OpenAI` is imported for
 * its type namespace throughout this file; these three error classes are
 * its only VALUE use, so a test that never exercises this catch block never
 * needs a real `OpenAI` instance either.
 */
function classify(err: unknown): Validation {
  if (err instanceof OpenAI.AuthenticationError) {
    return { ok: false, reason: 'invalid-key', detail: `${KEY_ENV} rejected (401)` }
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return { ok: false, reason: 'no-access', detail: `${KEY_ENV} lacks permission (403)` }
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { ok: false, reason: 'error', detail: 'no connection to api.openai.com' }
  }
  return { ok: false, reason: 'error', detail: err instanceof Error ? err.message : String(err) }
}

async function validate(client: OpenAIClient): Promise<Validation> {
  if (!hasKey()) return { ok: false, reason: 'no-key', detail: `${KEY_ENV} not set` }
  try {
    const page = await client.models.list()
    const ids = page.data.map((m) => m.id)
    const wanted = model()
    if (!ids.includes(wanted)) {
      return {
        ok: false,
        reason: 'no-access',
        detail: `key valid, but model '${wanted}' isn't available on this account. Adjust OPENAI_MODEL.`,
      }
    }
    return { ok: true, detail: `key valid, model '${wanted}' available` }
  } catch (err) {
    return classify(err)
  }
}

// ------------------------------------------------------------------ provider

export type OpenAIProvider = {
  readonly id: ProviderId
  readonly label: string
  readonly keyEnv: string
  model(): string
  hasKey(): boolean
  validate(): Promise<Validation>
  createSession(system: string, history?: unknown): Session
  listModels(): Promise<AvailableModel[]>
}

/**
 * Binds this provider's session/validation logic to an injected client.
 * `modelOverride` — the model the guitarist actually picked in the composer —
 * wins over `OPENAI_MODEL`/`DEFAULT_MODEL` when given; `validate()` keeps
 * checking the env-configured model, since it answers "is this key usable at
 * all", not "is the guitarist's current pick usable".
 */
export function openaiProvider(client: OpenAIClient, modelOverride?: string): OpenAIProvider {
  const activeModel = (): string => modelOverride || model()
  return {
    id: 'openai',
    label: 'OpenAI',
    keyEnv: KEY_ENV,
    model: activeModel,
    hasKey,
    validate: () => validate(client),
    createSession: (system, history) => createSession(client, activeModel(), system, history),
    listModels: async () => {
      const page = await client.models.list()
      return page.data.map((item) => ({
        provider: 'openai',
        providerLabel: 'OpenAI',
        id: item.id,
        // `created` is Unix seconds; 0 (not `NaN`) so a missing value still sorts last.
        releasedAt: item.created ? item.created * 1000 : 0,
      }))
    },
  }
}
