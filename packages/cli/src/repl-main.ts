/**
 * The REPL's real body — everything that runs once Node's version is
 * confirmed compatible. Ported from legacy's `repl.ts`, wired against
 * Tasks 3-9's core modules instead of legacy's own.
 *
 * Split out of `repl.ts` on purpose: this file statically imports
 * `key-store.ts`, which imports `node:sqlite` (Node >=22.5 only). ES module
 * linking resolves every static import before ANY top-level code in the
 * importing file runs — so if `repl.ts` imported this module directly, an
 * old-enough Node would throw a raw `ERR_UNKNOWN_BUILTIN_MODULE` while still
 * *linking* the module graph, before the version gate's own crafted error
 * message ever got a chance to run. `repl.ts` stays import-light (no
 * `node:sqlite`-touching dependency, directly or transitively) and only
 * `import()`s this file — a genuine dynamic import, evaluated after the gate
 * passes, not hoisted with the rest of the graph — once it has confirmed the
 * running Node can actually support what this file needs.
 *
 * Deliberately narrower than legacy, per this task's Interfaces (rig-builder,
 * key-store, plan-scene, the platform transport — nothing else):
 * - **No rig cache / library** (legacy's `library.ts`, disk-backed). Every
 *   `rig <request>` calls the AI; there is no `rigs` command, no
 *   fuzzy-cache-match, no `regerar`. Persisting rigs to disk needs a module
 *   this phase doesn't define — noted here as an intentional omission, not a
 *   silent drop.
 * - **No conversation history** (legacy has none either at this layer, but
 *   flagging per the task brief: any multi-turn chat/session persistence is
 *   out of this task's scope).
 * - **No `scope`/out-of-scope guardrail** (legacy's `scope.ts`) and **no
 *   `trace`** (legacy's `trace.ts`, which needed `chalk` and wrote to
 *   `logs/`) — neither module exists in `packages/core` yet; porting them was
 *   not in this task's file list.
 * - **No live `provider` command.** `rig-builder.ts` intentionally does not
 *   export `resolveProvider`/`chosenProvider` (only `buildRig`/`adjustScene`,
 *   which call it internally) — see that file's own header on why the client
 *   stays injected and private to the module. Reimplementing provider
 *   resolution here would duplicate rig-builder's own logic outside the
 *   module that owns it. `keys` (this file) shows what key-store knows
 *   (saved / from environment / none, hint, protected) without a live network
 *   call; the first `rig` command is what actually proves a key works.
 * - **No colored output.** Legacy used `chalk` throughout both `repl.ts` and
 *   `probe.ts` for readability (status color, error color, highlighted
 *   values). `chalk` isn't a dependency of this package and adding one for
 *   terminal color alone isn't justified per `opentimbre-code-style` §6 — a
 *   real ask, not just an omission that fell out of the `trace.ts` note
 *   above, so calling it out on its own.
 *
 * i18n note: every string that already has a catalog key (`chat.status.*`,
 * `keys.source.*`, `plugin.notMapped`, `error.generic`) goes through `t()`,
 * and locale is resolved for real via `resolveLocale()`/`setLocale()`. This
 * task's boundary is `packages/cli/src/` and `packages/cli/package.json`
 * only, which does not extend to adding the REPL's own command-surface
 * strings as new keys in `packages/core/src/i18n/*.json` /
 * `contracts/src/i18n.ts` — those stay English literals here, flagged as a
 * scoped gap for a follow-up task to close by extending the catalog.
 */
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { KeyInfo, LocaleKey, ProviderId, Rig } from '@opentimbre/contracts'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import { getAmpStrategy, resolveAmp } from '@opentimbre/core/src/plugins/types.ts'
import type { Send } from '@opentimbre/core/src/ports/midi-transport.ts'
import { resolveLocale, setLocale, t } from '@opentimbre/core/src/i18n/index.ts'
import {
  configure as configureRigBuilder,
  buildRig,
  adjustScene,
  loadSystemPrompt,
} from '@opentimbre/core/src/rig-builder.ts'
import { rigJsonSchema, toolName } from '@opentimbre/core/src/providers/rig-schema.ts'
import {
  configure as configureKeys,
  list as listKeys,
  save as saveKey,
  remove as removeKey,
} from '@opentimbre/core/src/secrets/key-store.ts'
import { planScene } from '@opentimbre/core/src/scenes/plan-scene.ts'
import { selectPlatform } from './platform-select.ts'

// -------------------------------------------------------------------- locale

const locale = resolveLocale(null, Intl.DateTimeFormat().resolvedOptions().locale)
setLocale(locale)

// -------------------------------------------------------------------- plugin

// The REPL operates on one plugin at a time — the first in the catalog.
// `buildRig` forces the model to call ONE plugin's tool per call (its
// signature takes a specific `PluginSpec`, not the whole catalog), so
// letting the AI choose among plugins is not wired at this layer yet.
const plugin = CATALOG[0]
if (!plugin) {
  console.error('The plugin catalog is empty — nothing to build a rig for.')
  process.exit(1)
}
const strategy = getAmpStrategy(plugin)

// -------------------------------------------------------------------- secrets

// No vault (no Electron `safeStorage` here) and no on-disk file — per
// `key-store.ts`'s own doc, wiring a persistent path is the later Electron
// phase; the CLI's saved keys live for the process's lifetime only, in
// `:memory:` SQLite. This call exists to make the injection point visible at
// startup, per `opentimbre-core-boundary` ("injection happens once, at
// startup"), even though it only restates the module's own defaults.
configureKeys({ vault: null })

const KEY_SOURCE_LABEL: Record<KeyInfo['source'], LocaleKey> = {
  app: 'keys.source.app',
  environment: 'keys.source.environment',
  none: 'keys.source.none',
}

/**
 * Builds the real provider clients from whatever's in `process.env` right
 * now (key-store's `save`/`remove` already sync it via
 * `applyToEnvironment()`), and hands them to `rig-builder.configure()` — the
 * CLI is the host that injects them, exactly like `key-store`'s vault. A
 * missing/invalid key makes the SDK constructor throw; caught here so the
 * REPL still boots with that provider simply absent as a candidate (mirrors
 * `opentimbre-core-boundary`'s "absence is a supported state, not a crash").
 */
function wireProviders(): void {
  let anthropicClient: Anthropic | null = null
  try {
    anthropicClient = new Anthropic()
  } catch {
    anthropicClient = null
  }

  let openaiClient: OpenAI | null = null
  try {
    openaiClient = new OpenAI()
  } catch {
    openaiClient = null
  }

  configureRigBuilder({ anthropicClient, openaiClient })
}

wireProviders()

// -------------------------------------------------------------------- state

let systemPrompt = loadSystemPrompt(locale)
let rig: Rig | null = null
let currentScene = ''
let send: Send

const HELP = `
Commands
  rig <request>          builds and applies a rig from a free-form request
  scene <name>            switches to a scene already in the loaded rig
  adjust <instruction>    adjusts the current scene ("more low end")
  show                     prints the loaded rig
  keys                    lists API key status per provider
  keys save <id>           saves a key (anthropic | openai) -- prompts, input hidden on a TTY
  keys remove <id>        removes a saved key
  reload                  reloads the system prompt from disk
  prompt                  prints the assembled system prompt (no API call)
  schema                  prints the tool's JSON Schema (no API call)
  help                    this text
  quit                    exit
`

// ------------------------------------------------------------------- output

function showRig(current: Rig, active: string): void {
  console.log(`\n${current.song} — ${current.artist}   ${plugin.name}   amp ${current.amp}`)
  console.log(`  ${current.note}\n`)

  for (const [name, scene] of Object.entries(current.scenes)) {
    const marker = name === active ? '*' : ' '
    console.log(`  ${marker} ${name}: ${scene.title} — ${scene.summary}`)
  }

  const activeScene = current.scenes[active]
  if (activeScene) {
    console.log(`\n  params (${active}):`)
    for (const [key, value] of Object.entries(activeScene.params)) {
      console.log(`    ${key} = ${String(value)}`)
    }
  }
  console.log()
}

// ------------------------------------------------------------------ actions

function applyScene(name: string): void {
  if (!rig) throw new Error('No rig loaded. Use `rig <request>` first.')

  const scene = rig.scenes[name]
  if (!scene) {
    throw new Error(`Scene '${name}' doesn't exist. Available: ${Object.keys(rig.scenes).join(', ')}`)
  }

  const resolved = resolveAmp(plugin, rig.amp)
  const instruction = strategy.apply(rig.amp, send)

  const started = performance.now()
  const messages = planScene(plugin, scene.params, rig.amp)
  for (const { cc, value } of messages) send(cc, value)
  const ms = performance.now() - started

  currentScene = name
  console.log(`Scene '${name}' applied — amp ${rig.amp}, ${messages.length} CCs in ${ms.toFixed(1)}ms`)
  console.log(`  ${scene.summary}`)

  if (resolved.warning) {
    console.log(
      resolved.amp !== rig.amp
        ? `  ! ${t('plugin.notMapped', { amp: rig.amp, fallback: resolved.amp })}`
        : `  ! ${resolved.warning}`,
    )
  }
  if (instruction) console.log(`  ! ${instruction}`)
}

async function cmdRig(request: string): Promise<void> {
  if (!request) throw new Error('Usage: rig <request>')

  console.log(t('chat.status.querying'))
  const built = await buildRig(plugin, request, systemPrompt)

  // State only changes once the call fully succeeds — a failed buildRig
  // leaves the previous rig loaded and coherent.
  rig = built
  currentScene = ''

  showRig(rig, 'base')
  applyScene('base')
}

async function cmdAdjust(instruction: string): Promise<void> {
  if (!instruction) throw new Error('Usage: adjust <instruction>')
  if (!rig) throw new Error('No rig loaded. Use `rig <request>` first.')
  if (!currentScene) throw new Error('No scene applied yet. Use `scene <name>`.')

  const base = rig.scenes[currentScene]
  if (!base) throw new Error(`Scene '${currentScene}' no longer exists in the loaded rig.`)

  console.log(t('chat.status.querying'))
  const { summary, scene } = await adjustScene(plugin, base.params, rig.amp, instruction, systemPrompt)
  // Only the params change — title/summary/explanation/guitar keep describing the same scene.
  rig.scenes[currentScene] = { ...base, params: scene }

  const started = performance.now()
  const messages = planScene(plugin, scene, rig.amp)
  for (const { cc, value } of messages) send(cc, value)
  const ms = performance.now() - started

  console.log(`Scene '${currentScene}' adjusted — amp ${rig.amp}, ${messages.length} CCs in ${ms.toFixed(1)}ms`)
  console.log(`  ${summary}`)
}

function knownProviderIds(): ProviderId[] {
  return listKeys().map((k) => k.provider)
}

function cmdKeysList(): void {
  for (const info of listKeys()) {
    const mark = info.protected ? '' : ' (unprotected)'
    const hint = info.hint ? ` ${info.hint}` : ''
    console.log(`  ${info.label.padEnd(10)} ${t(KEY_SOURCE_LABEL[info.source])}${hint}${mark}`)
  }
}

/**
 * Reads a line with input NOT echoed to the terminal (each keystroke shows
 * `*` instead), so an API key typed here never appears in the terminal's
 * scrollback or Up-arrow history the way a normal `rl.question()` answer
 * would. Requires a real TTY: masking a terminal is what this function is
 * for, and the risk it defends against (terminal echo, shell scrollback)
 * is inherently a TTY phenomenon in the first place -- piped/non-interactive
 * input has no terminal to leak into, so `cmdKeysSave` never calls this
 * function at all in that case (see its own comment). No non-TTY fallback
 * lives here on purpose: an earlier attempt routed the non-TTY case through
 * a second `rl.question()` call on the same interface, which reproducibly
 * hung on this Node/environment combination -- calling `question()` twice
 * in sequence on one `readline/promises` interface with piped stdin did not
 * reliably read the second line. Not worth working around for a path that
 * was never the security-relevant one.
 */
async function promptMasked(rl: readline.Interface, query: string): Promise<string> {
  output.write(query)
  // The outer rl instance keeps its own listeners on `input` even while
  // idle between rl.question() calls -- pausing it stops it from also
  // consuming/interpreting the very keystrokes this function is reading
  // manually in raw mode. Resumed in every exit path below (Enter, Ctrl+C,
  // and implicitly never on process.exit, which needs no cleanup).
  rl.pause()
  return new Promise((resolve) => {
    let value = ''
    input.setRawMode(true)
    input.resume()
    input.setEncoding('utf8')

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          input.setRawMode(false)
          input.pause()
          input.removeListener('data', onData)
          output.write('\n')
          rl.resume()
          resolve(value)
          return
        }
        if (char === '\u0003') {
          // Ctrl+C during a masked prompt: leave the terminal usable, then exit.
          input.setRawMode(false)
          output.write('\n')
          process.exit(130)
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1)
            output.write('\b \b')
          }
          continue
        }
        value += char
        output.write('*')
      }
    }
    input.on('data', onData)
  })
}

/**
 * `inlineKey` exists only for a non-TTY invocation (a piped/scripted
 * session, e.g. this file's own manual smoke tests) -- there, `stdin`
 * isn't a terminal, so the masking `promptMasked()` exists to defend
 * against doesn't apply, and passing the key as a normal argument is both
 * simpler and avoids a real readline hang (see promptMasked's comment). On
 * a real TTY, `inlineKey` is ignored on purpose: an interactive session
 * always gets the masked prompt, never an argument that would land in
 * shell history.
 */
async function cmdKeysSave(
  rl: readline.Interface,
  providerArg: string | undefined,
  inlineKey: string | undefined,
): Promise<void> {
  const known = knownProviderIds()
  const provider = providerArg as ProviderId | undefined
  if (!provider || !known.includes(provider)) {
    throw new Error(`Usage: keys save <${known.join('|')}>`)
  }

  const key = input.isTTY ? await promptMasked(rl, `${provider} key: `) : inlineKey
  if (!key) throw new Error(`Usage: keys save ${provider} <key> (no TTY -- pass the key inline)`)

  saveKey(provider, key)
  wireProviders()
  const info = listKeys().find((k) => k.provider === provider)
  console.log(`Key saved for ${info?.label ?? provider}${info?.hint ? ` (${info.hint})` : ''}.`)
}

function cmdKeysRemove(providerArg: string | undefined): void {
  const known = knownProviderIds()
  const provider = providerArg as ProviderId | undefined
  if (!provider || !known.includes(provider)) {
    throw new Error(`Usage: keys remove <${known.join('|')}>`)
  }

  removeKey(provider)
  wireProviders()
  console.log(`Key removed for ${provider}.`)
}

// ----------------------------------------------------------------- commands

async function handle(rl: readline.Interface, line: string): Promise<boolean> {
  const trimmed = line.trim()
  const space = trimmed.indexOf(' ')
  const cmd = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase()
  const rest = space === -1 ? '' : trimmed.slice(space + 1).trim()
  const args = rest.split(/\s+/).filter(Boolean)

  switch (cmd) {
    case '':
      return true

    case 'rig':
      await cmdRig(rest)
      return true

    case 'scene':
      if (!rest) throw new Error('Usage: scene <name>')
      applyScene(rest)
      return true

    case 'adjust':
      await cmdAdjust(rest)
      return true

    case 'show':
      if (!rig) throw new Error('No rig loaded.')
      showRig(rig, currentScene)
      return true

    case 'keys':
      if (args[0] === 'save') await cmdKeysSave(rl, args[1], args[2])
      else if (args[0] === 'remove') cmdKeysRemove(args[1])
      else cmdKeysList()
      return true

    case 'reload':
      systemPrompt = loadSystemPrompt(locale)
      console.log('System prompt reloaded from disk.')
      return true

    case 'prompt':
      console.log(`\n--- system prompt (${systemPrompt.length} chars) ---`)
      console.log(systemPrompt)
      console.log('--- end ---\n')
      return true

    case 'schema': {
      const schema = rigJsonSchema(plugin)
      console.log(`\n--- input schema for tool '${toolName(plugin)}' ---`)
      console.log(JSON.stringify(schema, null, 2))
      console.log('--- end ---\n')
      return true
    }

    case 'help':
      console.log(HELP)
      return true

    case 'quit':
    case 'exit':
      return false

    default:
      console.log(`Unknown command: '${cmd}'. Type \`help\`.`)
      return true
  }
}

// ----------------------------------------------------------------------- main

async function main(): Promise<void> {
  const platform = selectPlatform()
  const connection = await platform.transport.connect()
  if ('error' in connection) {
    console.error(connection.error)
    process.exit(1)
  }
  send = connection.send

  console.log('MIDI connected.')
  console.log(`Plugin: ${plugin.name}`)
  console.log(`Amp strategy: ${strategy.name}`)

  const running = await platform.platformInfo.isRunning(plugin.app.process)
  console.log(`Plugin process: ${running ? 'running' : 'not detected'}`)

  const keyStatus = listKeys()
    .map((k) => `${k.env}=${k.source !== 'none' ? 'present' : 'absent'}`)
    .join('  ')
  console.log(`AI keys: ${keyStatus}`)
  console.log(HELP)

  const rl = readline.createInterface({ input, output })
  rl.on('close', () => {
    process.exit(0)
  })

  process.on('SIGINT', () => {
    rl.close()
  })

  for (;;) {
    const line = await rl.question('rig> ')
    try {
      if (!(await handle(rl, line))) break
    } catch (err) {
      console.log(err instanceof Error && err.message ? err.message : t('error.generic'))
    }
  }

  rl.close()
}

main().catch((err) => {
  console.error(err instanceof Error && err.message ? err.message : t('error.generic'))
  process.exit(1)
})
