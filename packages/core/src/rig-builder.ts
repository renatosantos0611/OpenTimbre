/**
 * Assembles the system prompt, calls the AI via tool use, and validates the
 * response. Ported from legacy's `rig-builder.ts`.
 *
 * No "just return JSON": the tool's schema is `rig-schema.ts`'s zod-derived
 * JSON Schema, and the model's answer arrives already structured — no
 * markdown fence, no preamble to strip.
 *
 * Which provider actually serves the call — Anthropic or OpenAI — is decided
 * by `providers/resolve.ts`, testing which key is valid; this module only
 * delegates to whichever one wins.
 *
 * **Where the provider clients come from.** `buildRig`/`adjustScene`'s
 * signatures are fixed by this task's brief and carry no client parameter —
 * so, exactly like `secrets/key-store.ts`'s `configure({ file, vault })`,
 * this module holds an injected client per provider, set once by the host at
 * startup via `configure()`. Absent a configured client for a provider, that
 * provider simply isn't a candidate (mirrors `key-store`'s "absence is a
 * supported state, not a crash" — see `opentimbre-core-boundary`); with none
 * configured at all, `buildRig`/`adjustScene` fail early, naming the fix.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProviderPreference, Rig } from '@opentimbre/contracts'
import type { Locale } from './i18n/index.ts'
import { CATALOG } from './plugins/catalog.ts'
import type { PluginSpec, Scene } from './plugins/types.ts'
import { anthropicProvider, type AnthropicClient } from './providers/anthropic.ts'
import { openaiProvider, type OpenAIClient } from './providers/openai.ts'
import { resolveProvider, type ProviderCandidate } from './providers/resolve.ts'
import {
  ADJUST_TOOL_NAME,
  adjustJsonSchema,
  rigJsonSchema,
  toolName,
  validateAdjustment,
  validateRig,
  type Adjustment,
} from './providers/rig-schema.ts'
import { execute, issuesToText, type Session, type ToolDef } from './providers/tool-use.ts'

export type { Adjustment } from './providers/rig-schema.ts'

const ADJUST_TOOL_DESC =
  "Adjusts the currently loaded scene per a free-form instruction. Return only the fields that " +
  'change — never repeat what already sounds right.'

// ---------------------------------------------------------- provider wiring

type Provider = ProviderCandidate & { createSession(system: string): Session }

let anthropicClient: AnthropicClient | null = null
let openaiClient: OpenAIClient | null = null
let preference: ProviderPreference = 'auto'

/** Called once by the host at startup. Passing only some options leaves the rest as they were. */
export function configure(opts: {
  anthropicClient?: AnthropicClient | null
  openaiClient?: OpenAIClient | null
  preference?: ProviderPreference
}): void {
  if (opts.anthropicClient !== undefined) anthropicClient = opts.anthropicClient
  if (opts.openaiClient !== undefined) openaiClient = opts.openaiClient
  if (opts.preference !== undefined) preference = opts.preference
}

function configuredProviders(): Provider[] {
  const list: Provider[] = []
  if (anthropicClient) list.push(anthropicProvider(anthropicClient))
  if (openaiClient) list.push(openaiProvider(openaiClient))
  return list
}

async function chosenProvider(): Promise<Provider> {
  const providers = configuredProviders()
  if (providers.length === 0) {
    throw new Error(
      'No AI provider client configured. Call configure({ anthropicClient, openaiClient }) at startup.',
    )
  }
  const resolution = await resolveProvider(providers, { preference, forcedEnv: process.env['AI_PROVIDER'] })
  // `resolveProvider` only needs `ProviderCandidate`'s fields; find the matching
  // `Provider` back by id to get `createSession` too.
  return providers.find((p) => p.id === resolution.chosen.id)!
}

// -------------------------------------------------------------- operations

export async function buildRig(plugin: PluginSpec, request: string, systemPrompt: string): Promise<Rig> {
  const provider = await chosenProvider()
  const tool: ToolDef = {
    name: toolName(plugin),
    description: `Builds a rig on the ${plugin.name}. Knobs range 0.0 to 10.0.`,
    schema: rigJsonSchema(plugin),
  }

  return execute<Rig>({
    session: provider.createSession(systemPrompt),
    request: `Build a rig to play: ${request}`,
    tools: [tool],
    force: tool.name,
    validate: (call) => {
      const verdict = validateRig(plugin, call.args)
      return verdict.ok
        ? { ok: true, value: verdict.value }
        : { ok: false, issues: verdict.issues, feedback: issuesToText(verdict.issues) }
    },
  })
}

/** Adjusts the loaded scene per a free-form instruction ("more low end"). */
export async function adjustScene(
  plugin: PluginSpec,
  currentScene: Scene,
  amp: string,
  instruction: string,
  systemPrompt: string,
): Promise<Adjustment> {
  const provider = await chosenProvider()
  const tool: ToolDef = { name: ADJUST_TOOL_NAME, description: ADJUST_TOOL_DESC, schema: adjustJsonSchema(plugin) }

  return execute<Adjustment>({
    session: provider.createSession(systemPrompt),
    request:
      `Active amp: ${amp}\nCurrent scene (JSON): ${JSON.stringify(currentScene)}\n\n` +
      `User instruction: ${instruction}\n\n` +
      'Adjust the scene per the instruction. Return only the fields that change.',
    tools: [tool],
    force: ADJUST_TOOL_NAME,
    validate: (call) => {
      const verdict = validateAdjustment(plugin, currentScene, call.args)
      return verdict.ok
        ? { ok: true, value: verdict.value }
        : { ok: false, issues: verdict.issues, feedback: issuesToText(verdict.issues) }
    },
  })
}

// ------------------------------------------------------------ system prompt

const PROMPTS_DIR = fileURLToPath(new URL('../prompts/', import.meta.url))

function pluginDocBase(spec: PluginSpec): string {
  return spec.doc.replace(/\.md$/, '')
}

function readPluginDoc(spec: PluginSpec, locale: Locale): string {
  const file = path.join(PROMPTS_DIR, 'plugins', `${pluginDocBase(spec)}.${locale}.md`)
  if (!existsSync(file)) throw new Error(`Plugin doc for '${spec.id}' not found at ${file}`)
  return readFileSync(file, 'utf8')
}

/**
 * Reference generated from the spec — an amp's character and which controls
 * it has come from the catalog, not a list repeated in markdown, so the two
 * never disagree. The controls matter: on the fixture-equivalent Gojira, CLN
 * has no Master or Presence/Depth, and is the only one with a Bright switch.
 */
function reference(spec: PluginSpec): string {
  const amps = spec.amps
    .map((a) => {
      const controls = Object.keys(spec.ampParams).filter(
        (k) => spec.ampCC[a]?.[k] !== undefined && !k.startsWith('eq'),
      )
      return `- **${a}** — ${spec.ampDescriptions[a] ?? ''}\n  - controls: ${controls.join(', ')}`
    })
    .join('\n')

  return [
    `### ${spec.name} reference (generated from the catalog)`,
    '',
    'Signal chain:',
    '',
    '```',
    spec.signalChain,
    '```',
    '',
    "Amplifiers (fields outside the chosen amp's control list are ignored):",
    '',
    amps,
    '',
  ].join('\n')
}

/**
 * Read from disk at call time, so a future "reload" affordance re-reads
 * without restarting the app.
 *
 * The prompt is layered: the tone philosophy (locale-specific, applies to
 * any plugin), then each catalog plugin's doc plus its generated reference.
 * *With many plugins this inflates the prompt; the natural cut, for a later
 * task, is injecting only the docs of plausible plugins for a given request.*
 *
 * Legacy adds a final layer here — the user's guitar, read from a
 * `guitarra`/config-store module and rendered into the prompt. That layer is
 * deliberately not ported: no guitar/config-store module exists yet in
 * `packages/core`. A real, scoped omission, not a silent drop — restore it
 * once that module exists.
 */
export function loadSystemPrompt(locale: Locale): string {
  const promptPath = path.join(PROMPTS_DIR, `system-rig.${locale}.md`)
  if (!existsSync(promptPath)) throw new Error(`System prompt not found at ${promptPath}`)
  const base = readFileSync(promptPath, 'utf8')

  const catalog = CATALOG.map(
    (spec) => `## ${spec.name}\n\nWhen to use: ${spec.whenToUse}\n\n${readPluginDoc(spec, locale)}\n\n${reference(spec)}`,
  ).join('\n---\n\n')

  const choice =
    CATALOG.length > 1
      ? "\n\n# Available plugins\n\nEach plugin below has its own tool. **Calling a plugin's tool is choosing it** " +
        '— read each one\'s "When to use" and pick whichever comes closest to the requested tone.\n\n'
      : '\n\n# The plugin\n\n'

  return `${base}${choice}${catalog}\n`
}

export type { Validation } from './providers/resolve.ts'
