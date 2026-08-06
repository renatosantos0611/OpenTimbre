/**
 * Catalog-driven chat session. It hides provider-native history and lets the
 * model choose the plugin by calling exactly one tool per catalog entry.
 */
import type { AvailableModel, Guitar, ProviderId, Rig, Turn } from '@opentimbre/contracts'
import { loadSystemPrompt } from '../rig-builder.ts'
import { CATALOG } from '../plugins/catalog.ts'
import type { PluginSpec } from '../plugins/types.ts'
import { rigJsonSchema, toolName, validateRig } from '../providers/rig-schema.ts'
import { execute, issuesToText, type Session, type ToolDef } from '../providers/tool-use.ts'
import type { Locale } from '../i18n/index.ts'

export type RigChatSnapshot = {
  readonly provider: ProviderId
  readonly model: string
  readonly history: unknown
}

export type RigChatProvider = {
  readonly id: ProviderId
  readonly label: string
  model(): string
  createSession(system: string, history?: unknown): Session
  listModels(): Promise<AvailableModel[]>
}

export type RigChatOptions = {
  readonly providers: readonly RigChatProvider[]
  readonly locale: Locale
  readonly guitar: Guitar
  readonly resume?: RigChatSnapshot
}

export type RigChat = {
  readonly provider: ProviderId
  readonly model: string
  readonly memoryLost: boolean
  send(text: string): Promise<Turn>
  export(): RigChatSnapshot
}

function toolsForCatalog(): ToolDef[] {
  return CATALOG.map((spec) => ({
    name: toolName(spec),
    description: `Builds a rig on the ${spec.name}. Knobs range 0.0 to 10.0.`,
    schema: rigJsonSchema(spec),
  }))
}

function specForCall(callName: string): PluginSpec | undefined {
  return CATALOG.find((spec) => toolName(spec) === callName)
}

function invalidCall(name: string) {
  const issues = [{ path: ['tool'], message: `unknown catalog tool '${name}'` }]
  return { ok: false as const, issues, feedback: issuesToText(issues) }
}

export function createRigChat(options: RigChatOptions): RigChat {
  if (options.providers.length === 0) throw new Error('RigChat requires at least one configured provider.')

  const snapshot = options.resume
  let memoryLost = false
  let provider = snapshot
    ? options.providers.find((candidate) => candidate.id === snapshot.provider && candidate.model() === snapshot.model)
    : options.providers[0]

  const canResume = Boolean(snapshot && provider && Array.isArray(snapshot.history))
  if (snapshot && !canResume) memoryLost = true
  provider ??= options.providers[0]!

  const system = loadSystemPrompt(options.locale)
  const session = provider.createSession(system, canResume ? snapshot!.history : undefined)
  const tools = toolsForCatalog()
  let lastText = ''

  return {
    provider: provider.id,
    model: provider.model(),
    get memoryLost() {
      return memoryLost
    },
    async send(text: string): Promise<Turn> {
      lastText = ''
      const result = await execute<Rig | null>({
        session,
        request: `Guitar: ${JSON.stringify(options.guitar)}\n\nUser request: ${text}`,
        tools,
        force: null,
        onNoCall: (answer) => {
          lastText = answer
          return null
        },
        validate: (call, responseText) => {
          lastText = responseText
          const spec = specForCall(call.name)
          if (!spec) return invalidCall(call.name)
          const verdict = validateRig(spec, call.args)
          return verdict.ok
            ? { ok: true, value: verdict.value }
            : { ok: false, issues: verdict.issues, feedback: issuesToText(verdict.issues) }
        },
      })

      return result === null
        ? { text: lastText, rig: null, cards: null }
        : { text: lastText, rig: result, cards: null }
    },
    export(): RigChatSnapshot {
      return { provider: provider!.id, model: provider!.model(), history: session.history() }
    },
  }
}

export async function listModels(providers: readonly RigChatProvider[]): Promise<AvailableModel[]> {
  const groups = await Promise.all(providers.map((provider) => provider.listModels()))
  return groups.flat()
}
