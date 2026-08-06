/**
 * The one place in the CLI that reads `process.platform` — everything past
 * this module calls `connect()`/`isRunning()`/`settingsDir()` on whichever
 * pair it hands back, per `opentimbre-cross-platform`. `windows.ts` and
 * `macos.ts` already do the real work (loopMIDI lookup vs. an owned virtual
 * port, `tasklist` vs. `pgrep`); this module only chooses between their
 * already-built `MidiTransport`/`PlatformInfo` pairs.
 *
 * An unsupported platform (Linux, etc.) throws, naming the platform, instead
 * of silently defaulting to Windows or macOS behavior — "fail honestly,
 * don't silently no-op" (`opentimbre-cross-platform`).
 */
import type { MidiTransport } from '@opentimbre/core/src/ports/midi-transport.ts'
import type { PlatformInfo } from '@opentimbre/core/src/ports/platform-info.ts'
import { macosPlatformInfo, macosTransport } from '@opentimbre/platform-node/src/macos.ts'
import { windowsPlatformInfo, windowsTransport } from '@opentimbre/platform-node/src/windows.ts'

export type PlatformBundle = {
  readonly transport: MidiTransport
  readonly platformInfo: PlatformInfo
}

/** `platform` defaults to the real `process.platform`; a test can inject another value. */
export function selectPlatform(platform: string = process.platform): PlatformBundle {
  if (platform === 'win32') return { transport: windowsTransport, platformInfo: windowsPlatformInfo }
  if (platform === 'darwin') return { transport: macosTransport, platformInfo: macosPlatformInfo }

  throw new Error(
    `Unsupported platform '${platform}'. OpenTimbre runs on Windows (win32) or macOS (darwin) only.`,
  )
}
