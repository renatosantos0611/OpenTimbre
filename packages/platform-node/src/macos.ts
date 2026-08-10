/**
 * macOS implementation of `MidiTransport` and `PlatformInfo`.
 *
 * `@julusian/midi` (RtMidi) exposes `openVirtualPort()` on macOS (confirmed
 * on the installed version: `typeof new Output().openVirtualPort ===
 * 'function'`) — unlike Windows, the app creates and owns its port here
 * instead of scanning for a loopMIDI-style port by name (see
 * `opentimbre-cross-platform`). "Is this process running?" has no
 * dependency-free API either, so `isRunning` shells out to `pgrep`, mirroring
 * `windows.ts`'s `tasklist` shell-out. Both stay inside this module: the rest
 * of the app only ever sees `connect()` and `isRunning()`.
 *
 * There is no legacy macOS code to port from (legacy was Windows-only) — this
 * is new code, written from `@julusian/midi`/RtMidi and macOS platform
 * documentation, not from an observed reference implementation. Two pieces
 * are explicitly UNVERIFIED and marked inline where they're used:
 *   - that `pgrep -x <name>` is the right process-detection call (vs. `ps aux
 *     | grep`, or matching on a truncated/different comm name);
 *   - the settings-directory *shape* (`~/Library/Application Support/<name>`)
 *     is standard macOS convention, but no real Neural DSP plugin's actual
 *     folder name has been observed on a Mac to confirm it lands there.
 * Neither has been run against real hardware. Per `opentimbre-plugin-spec`,
 * no plugin-specific path or process name is invented here — only the
 * generic mechanism, given the same `AppInfo` shape `windows.ts` already
 * consumes.
 *
 * `@julusian/midi` is never imported at the top of this file — see
 * `windows.ts`'s header for why: `/lazy`'s own submodules `require`
 * `./native.js` at their own top level, so any static import (even via
 * `/lazy`) loads the real native addon merely by importing the module,
 * including under `node --test`. `loadRealOutput()` below is copied from
 * `windows.ts` (the `Output` class and its methods are the same
 * `@julusian/midi` API on both platforms) — the real `require()` only runs
 * inside `createOutput`'s default implementation, i.e. only when the real
 * (non-faked) transport is actually used.
 */
import { execFile } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import type { AppInfo } from '@opentimbre/core/src/plugins/types.ts'
import type { MidiTransport, Send } from '@opentimbre/core/src/ports/midi-transport.ts'
import type { PlatformInfo } from '@opentimbre/core/src/ports/platform-info.ts'

const execFileAsync = promisify(execFile)

/** Control Change on channel 1 — matches legacy's `CC_STATUS` (see `windows.ts`). */
const CC_STATUS = 0xb0

/** MIDI port name — may change in a future release. */
const DEFAULT_PORT = process.env['VOICERIG_PORT'] ?? 'VoiceRig'

// -------------------------------------------------------------- MIDI transport

/**
 * The slice of `@julusian/midi`'s `Output` this module actually calls.
 * Deliberately different from `windows.ts`'s `MidiOutputLike`: macOS creates
 * its own port (`openVirtualPort`) instead of scanning existing ones by
 * index, so it has no need for `getPortCount`/`getPortName`/`openPort`.
 */
export type MidiOutputLike = {
  openVirtualPort(name: string): void
  sendMessage(message: number[]): void
  closePort(): void
}

/**
 * Loads the real `@julusian/midi` binding and constructs an `Output`, only
 * when actually called — copied from `windows.ts`, see this file's header
 * for why a static import can't be used instead.
 */
function loadRealOutput(): MidiOutputLike {
  const require = createRequire(import.meta.url)
  const { Output } = require('@julusian/midi/lazy') as { Output: new () => MidiOutputLike }
  return new Output()
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * `createOutput` and `portName` are the injection points tests use to supply
 * a fake port and target name without touching the native binding. Defaults
 * are the real ones: a fresh `Output` and the same `VOICERIG_PORT`-or-
 * `'VoiceRig'` fragment `windows.ts` uses, for a consistent name across both
 * platforms even though the mechanism (create vs. find) differs.
 */
export function createMacosTransport(
  createOutput: () => MidiOutputLike = loadRealOutput,
  portName = DEFAULT_PORT,
): MidiTransport {
  return {
    async connect() {
      const candidate = createOutput()
      try {
        candidate.openVirtualPort(portName)
      } catch (err) {
        // RtMidi can fail to create a virtual port for reasons unrelated to
        // this app (CoreMIDI unavailable, permission issues) — report it
        // instead of crashing, same contract as windows.ts's "no port found".
        return { error: `Could not create virtual MIDI port '${portName}': ${errorMessage(err)}` }
      }

      const send: Send = (cc, value) => {
        candidate.sendMessage([CC_STATUS, cc, value])
      }
      return { send }
    },
  }
}

export const macosTransport: MidiTransport = createMacosTransport()

// -------------------------------------------------------------- platform info

export type ListProcesses = (processName: string) => Promise<string>

/** Exported for a direct unit test — this is the one piece of `listProcessesViaPgrep`'s
 * logic (translating pgrep's "not found" exit code into empty output) that a fake
 * `listProcesses` injection bypasses entirely and would otherwise go untested. */
export function isExitCode(err: unknown, code: number): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === code
}

/**
 * `pgrep -x <name>` prints one PID per line and exits 0 when at least one
 * process's command name matches exactly; it exits 1 with empty stdout when
 * none match. `execFile` treats a non-zero exit as a rejection, so the clean
 * "not running" answer arrives as a thrown error with `.code === 1` — caught
 * here and turned into the same empty string a genuine empty-output run
 * would produce, so `isRunning` only ever has to tell "some output" from "no
 * output" apart, never interpret an exit code itself.
 *
 * UNVERIFIED: pgrep ships with macOS, and `-x` is assumed to match the way
 * Activity Monitor's process name does; neither has been confirmed against a
 * real Neural DSP plugin process on real hardware.
 */
const listProcessesViaPgrep: ListProcesses = async (processName) => {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-x', processName])
    return stdout
  } catch (err) {
    if (isExitCode(err, 1)) return ''
    throw err
  }
}

/**
 * `listProcesses` and `homedir` are the injection points tests use to supply
 * canned `pgrep`-style output and a fixture home directory instead of
 * shelling out / reading the real machine.
 *
 * `path.posix.join` (not the platform-default `node:path` export) is used
 * deliberately: this module's paths are always macOS paths, regardless of
 * which OS actually runs the code computing them (e.g. these tests running
 * on a Windows dev machine) — using the default export would silently emit
 * backslash-joined paths when tested here, proving nothing about the real
 * macOS shape.
 */
export function createMacosPlatformInfo(
  listProcesses: ListProcesses = listProcessesViaPgrep,
  homedir: () => string = os.homedir,
): PlatformInfo {
  return {
    async isRunning(processName) {
      try {
        const stdout = await listProcesses(processName)
        return stdout.trim().length > 0
      } catch {
        // No pgrep (or a genuinely broken call) makes "running" unknowable —
        // assuming "closed" is the cheaper wrong answer, same reasoning as
        // windows.ts.
        return false
      }
    },
    settingsDir(appInfo: AppInfo) {
      return path.posix.join(homedir(), 'Library', 'Application Support', appInfo.settings)
    },
  }
}

export const macosPlatformInfo: PlatformInfo = createMacosPlatformInfo()
