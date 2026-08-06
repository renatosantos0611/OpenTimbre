/**
 * Windows implementation of `MidiTransport` and `PlatformInfo`.
 *
 * `@julusian/midi` (RtMidi) has no `openVirtualPort` on Windows — the app
 * cannot create its own port there (see `opentimbre-cross-platform`), so
 * `connect()` scans existing ports by index for one whose name contains the
 * configured loopMIDI port name. Windows also has no "is this process
 * running?" API without a native dependency, so `isRunning` shells out to
 * `tasklist`. Both are exactly the ugliness `opentimbre-code-style` says
 * belongs inside a module, not leaked to callers: the rest of the app only
 * ever sees `connect()` and `isRunning()`.
 *
 * Ported from legacy's `midi-out.ts` (port-by-index + name scan, the 3-byte
 * CC message) and `plugins/lancador.ts` (the `tasklist /FO CSV` parsing,
 * chosen there specifically because the default table format truncates the
 * process name at 25 characters — see `processInList`'s comment).
 *
 * Both dependencies that would otherwise make this untestable —
 * `@julusian/midi`'s `Output` and the `tasklist` call — are injectable
 * through `createWindowsTransport`/`createWindowsPlatformInfo`, per
 * `opentimbre-testing`: fake the MIDI port and the process check, never the
 * rule. `windowsTransport`/`windowsPlatformInfo` are those factories called
 * with the real dependencies, and are the only exports most callers need.
 *
 * `@julusian/midi` is never imported at the top of this file, not even via
 * `/lazy` — that was tried and found not to work: `/lazy`'s own modules
 * `require('./native.js')` at THEIR top level, which attempts to load the
 * prebuilt native binding immediately, on import, regardless of `/lazy`'s
 * deferred `verifyLibraryLoaded()`. A static import of either entry point
 * loads the real native addon the instant this module (or its test file) is
 * imported — including under `node --test`, defeating the whole point of
 * faking it. `loadRealOutput()` below uses `createRequire` so the actual
 * `require('@julusian/midi/lazy')` call only runs inside
 * `createOutput`'s default implementation — i.e. only when the real
 * (non-faked) transport is actually used, never merely by importing this
 * file.
 */
import { execFile } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import type { AppInfo } from '@opentimbre/core/src/plugins/types.ts'
import type { MidiTransport, Send } from '@opentimbre/core/src/ports/midi-transport.ts'
import type { PlatformInfo } from '@opentimbre/core/src/ports/platform-info.ts'

const execFileAsync = promisify(execFile)

/** Control Change on channel 1 — matches legacy's `CC_STATUS`. */
const CC_STATUS = 0xb0

const DEFAULT_PORT = process.env['VOICERIG_PORT'] ?? 'VoiceRig'

// -------------------------------------------------------------- MIDI transport

/** The slice of `@julusian/midi`'s `Output` this module actually calls. */
export type MidiOutputLike = {
  getPortCount(): number
  getPortName(index: number): string
  openPort(index: number): void
  sendMessage(message: number[]): void
  closePort(): void
}

/**
 * Loads the real `@julusian/midi` binding and constructs an `Output`, only
 * when actually called — see the file header for why this can't be a static
 * import. `createRequire` runs a genuine, synchronous CommonJS `require()`,
 * so the native addon loads here and nowhere else.
 */
function loadRealOutput(): MidiOutputLike {
  const require = createRequire(import.meta.url)
  const { Output } = require('@julusian/midi/lazy') as { Output: new () => MidiOutputLike }
  return new Output()
}

/**
 * `createOutput` and `portFragment` are the injection points tests use to
 * supply a fake port list and target name without touching the native
 * binding. Defaults are the real ones: a fresh `Output` and the
 * `VOICERIG_PORT`-or-`'VoiceRig'` fragment legacy used.
 */
export function createWindowsTransport(
  createOutput: () => MidiOutputLike = loadRealOutput,
  portFragment = DEFAULT_PORT,
): MidiTransport {
  return {
    async connect() {
      const candidate = createOutput()
      const names = Array.from({ length: candidate.getPortCount() }, (_, i) =>
        candidate.getPortName(i),
      )
      const index = names.findIndex((n) => n.toLowerCase().includes(portFragment.toLowerCase()))

      if (index === -1) {
        candidate.closePort()
        // Listing the ports found saves a lot of diagnosis time — same reasoning as legacy.
        return {
          error:
            `Port '${portFragment}' not found. Create it in loopMIDI.\n` +
            `Visible output ports: ${names.length ? names.map((n) => `'${n}'`).join(', ') : '(none)'}`,
        }
      }

      candidate.openPort(index)
      const send: Send = (cc, value) => {
        candidate.sendMessage([CC_STATUS, cc, value])
      }
      return { send }
    },
  }
}

export const windowsTransport: MidiTransport = createWindowsTransport()

// -------------------------------------------------------------- platform info

export type ListProcesses = (processName: string) => Promise<string>

const listProcessesViaTasklist: ListProcesses = async (processName) => {
  const { stdout } = await execFileAsync('tasklist', [
    '/FI',
    `IMAGENAME eq ${processName}`,
    '/FO',
    'CSV',
    '/NH',
  ])
  return stdout
}

/**
 * Parses `tasklist /FO CSV` output and reports whether `processName` is in
 * it, comparing the exact quoted name rather than `stdout.includes(...)`.
 *
 * The CSV format isn't a style preference — it fixes a bug. The default
 * table format truncates the Image Name column at 25 characters with no
 * warning, so any plugin whose process name is longer than that (legacy hit
 * this with Tim Henson's) would always read as "not running" even while
 * open. `/FO CSV` prints the name whole, quoted, letting this compare
 * exactly instead of by substring.
 */
function processInList(stdout: string, processName: string): boolean {
  const target = processName.toLowerCase()
  for (const line of stdout.split(/\r?\n/)) {
    // A miss makes tasklist print an unquoted "INFO: No tasks..." line,
    // which the regex below simply won't match.
    const name = /^"([^"]*)"/.exec(line)?.[1]
    if (name !== undefined && name.toLowerCase() === target) return true
  }
  return false
}

/**
 * `listProcesses` is the injection point tests use to supply canned
 * `tasklist`-style output instead of shelling out for real.
 */
export function createWindowsPlatformInfo(
  listProcesses: ListProcesses = listProcessesViaTasklist,
): PlatformInfo {
  return {
    async isRunning(processName) {
      try {
        return processInList(await listProcesses(processName), processName)
      } catch {
        // No tasklist (or a machine that doesn't have it) makes "running"
        // unknowable — assuming "closed" is the cheaper wrong answer: at
        // worst the user clicks open and nothing changes.
        return false
      }
    },
    settingsDir(appInfo: AppInfo) {
      return path.join(process.env['APPDATA'] ?? '', appInfo.settings)
    },
  }
}

export const windowsPlatformInfo: PlatformInfo = createWindowsPlatformInfo()
