/**
 * Pure MIDI diagnostic entry point (`npm run probe`). No AI, no keys — it
 * only opens the platform's MIDI transport and sends raw CCs, so a probe
 * session can discover what a plugin actually accepts. Ported from legacy's
 * `probe.ts`.
 *
 * Dropped from legacy on purpose: the `ports` command. Legacy's own
 * `midi-out.ts` wrapped the native `Output` object directly and could
 * enumerate ports on demand. `platform-node`'s `MidiTransport` port
 * deliberately hides that — per `opentimbre-core-boundary`/
 * `opentimbre-cross-platform`, "the rest of the app only ever sees
 * connect()" — so there is no operation left to expose as a standalone
 * `ports` command. On Windows, the visible ports still surface as part of a
 * failed `connect()`'s own error message (see `windows.ts`); on macOS there
 * is no equivalent to enumerate, since the app creates its own port.
 *
 * Kept from legacy: `learn`/`sweep`/`set`/`amptest`/`map`. The pulsing and
 * sweeping loops now live here (not in `platform-node`) because they are
 * probe-specific behavior, not a fact about the transport.
 *
 * Dropped, also on purpose: colored output. Legacy used `chalk` throughout
 * for readability; it isn't a dependency here and adding one for terminal
 * color alone isn't justified per `opentimbre-code-style` §6.
 *
 * i18n note: `opentimbre-i18n` asks every user-facing string to resolve
 * through the shared catalog (`en.json`/`pt.json`). This task's own
 * boundary is `packages/cli/src/` and `packages/cli/package.json` only — it
 * does not authorize editing `packages/core/src/i18n/*.json` or
 * `contracts/src/i18n.ts` to add the many probe-specific keys this file
 * would need. `resolveLocale()`/`setLocale()` are wired for real, and every
 * string that already has a catalog key uses `t()`; the probe's own
 * command-surface text (this file's copy) stays in English literals,
 * flagged here as a scoped, intentional gap for a follow-up task to close by
 * extending the catalog.
 */
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import type { PluginSpec } from '@opentimbre/core/src/plugins/types.ts'
import type { Send } from '@opentimbre/core/src/ports/midi-transport.ts'
import { checkNodeVersion } from './node-version-check.ts'
import { selectPlatform } from './platform-select.ts'

const versionCheck = checkNodeVersion(process.version)
if (!versionCheck.ok) {
  console.error(versionCheck.message)
  process.exit(1)
}

// -------------------------------------------------------------------- plugin

/**
 * The probe operates on one plugin at a time. Without `PLUGIN`, it falls
 * back to the first catalog entry (today Gojira, already confirmed);
 * `PLUGIN=soldano npm run probe` points the probe at a plugin not yet
 * confirmed — same convention as legacy.
 */
function pluginById(id: string): PluginSpec {
  const found = CATALOG.find((p) => p.id === id)
  if (!found) {
    throw new Error(`Unknown plugin '${id}'. Known: ${CATALOG.map((p) => p.id).join(', ')}`)
  }
  return found
}

const requestedId = process.env['PLUGIN']
const plugin = requestedId ? pluginById(requestedId) : CATALOG[0]

if (!plugin) {
  console.error('The plugin catalog is empty — nothing to probe.')
  process.exit(1)
}

const AMP_PARAM_NAMES = Object.keys(plugin.ampParams)

const HELP = `
Commands
  learn <cc>          pulses the CC (127/0 every 500ms) for MIDI Learn to capture
  stop                 interrupts learn mode
  sweep <cc>           sweeps the CC from 0 to 127, slowly
  set <cc> <value>     sends one value (0-127)
  amptest              sends the amp-selector CC at each amp's value (${plugin.amps.length} amps), 2s apart
  map                  prints the reference CC map
  help                 this text
  quit                 exit
`

// -------------------------------------------------------------------- MIDI

/** Assigned once `connect()` succeeds, in `main()`, before the command loop starts. */
let send: Send

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let learnTimer: ReturnType<typeof setInterval> | null = null

function startLearn(cc: number): void {
  stopLearn()
  let on = false
  learnTimer = setInterval(() => {
    send(cc, on ? 0 : 127)
    on = !on
  }, 500)
}

function stopLearn(): void {
  if (learnTimer) {
    clearInterval(learnTimer)
    learnTimer = null
  }
}

async function sweep(cc: number): Promise<void> {
  for (let value = 0; value <= 127; value += 1) {
    send(cc, value)
    await sleep(15)
  }
}

// ----------------------------------------------------------------- commands

function parseCC(arg: string | undefined): number {
  const cc = Number(arg)
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) {
    throw new Error(`Invalid CC: '${arg ?? ''}' (expected an integer 0-127)`)
  }
  return cc
}

function printMap(): void {
  console.log(`\n  ${plugin.name}`)
  console.log('  CC   parameter        type')
  console.log(
    `  ${String(plugin.ampSelect.cc).padEnd(4)} ${'ampSelect'.padEnd(16)} selector, ${plugin.amps.length} positions`,
  )

  for (const amp of plugin.amps) {
    const ccs = plugin.ampCC[amp] ?? {}
    const entries = AMP_PARAM_NAMES.filter((k) => ccs[k] !== undefined)
    if (entries.length === 0) {
      console.log(`  --   amp ${amp}: not mapped`)
      continue
    }
    for (const name of entries) {
      const label = `${amp}.${name}`.padEnd(16)
      console.log(`  ${String(ccs[name]).padEnd(4)} ${label} ${plugin.ampParams[name]!.type}`)
    }
  }

  for (const [name, spec] of Object.entries(plugin.params)) {
    console.log(`  ${String(spec.cc).padEnd(4)} ${name.padEnd(16)} ${spec.type}`)
  }
  console.log()
}

async function amptest(): Promise<void> {
  // MIDI is one-way — the app never reads anything back. The user reads the
  // result by looking at the plugin, hence the explicit prompt.
  console.log('Look at the PLUGIN, not this terminal. Confirm the amp shown matches what is expected.')
  console.log(`If nothing changes, CC ${plugin.ampSelect.cc} isn't mapped in MIDI Mappings yet.\n`)

  for (const [amp, value] of Object.entries(plugin.ampSelect.values)) {
    console.log(`  CC ${plugin.ampSelect.cc} = ${String(value).padStart(3)}  -> expected: ${amp}`)
    send(plugin.ampSelect.cc, value)
    await sleep(2000)
  }

  console.log('\namptest complete. Record the result in capabilities.md.')
}

async function handle(line: string): Promise<boolean> {
  const [cmd = '', ...args] = line.trim().split(/\s+/)

  switch (cmd.toLowerCase()) {
    case '':
      return true

    case 'learn': {
      const cc = parseCC(args[0])
      startLearn(cc)
      console.log(`Pulsing CC ${cc}. Do the MIDI Learn on the plugin, then type \`stop\`.`)
      return true
    }

    case 'stop':
      stopLearn()
      console.log('Learn interrupted.')
      return true

    case 'sweep': {
      const cc = parseCC(args[0])
      console.log(`Sweeping CC ${cc} from 0 to 127...`)
      await sweep(cc)
      console.log('Sweep complete.')
      return true
    }

    case 'set': {
      const cc = parseCC(args[0])
      const value = Number(args[1])
      if (!Number.isInteger(value) || value < 0 || value > 127) {
        throw new Error(`Invalid value: '${args[1] ?? ''}' (expected an integer 0-127)`)
      }
      send(cc, value)
      console.log(`CC ${cc} = ${value}`)
      return true
    }

    case 'amptest':
      await amptest()
      return true

    case 'map':
      printMap()
      return true

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

async function main(): Promise<void> {
  const platform = selectPlatform()
  const connection = await platform.transport.connect()
  if ('error' in connection) {
    console.error(connection.error)
    process.exit(1)
  }
  send = connection.send

  // `MidiTransport.connect()` deliberately doesn't hand back which port it
  // opened or found (per `opentimbre-core-boundary`: "the rest of the app
  // only ever sees connect()") — so, unlike legacy, there is no port name
  // left to print here, only that the connection succeeded.
  console.log('MIDI connected.')
  console.log(`Plugin: ${plugin.name}`)
  console.log(HELP)

  const rl = readline.createInterface({ input, output })
  rl.on('close', () => {
    stopLearn()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    stopLearn()
    rl.close()
  })

  for (;;) {
    const line = await rl.question('probe> ')
    try {
      if (!(await handle(line))) break
    } catch (err) {
      console.log(err instanceof Error ? err.message : String(err))
    }
  }

  rl.close()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  stopLearn()
  process.exit(1)
})
