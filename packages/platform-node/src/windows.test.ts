/**
 * Characterization tests for `windows.ts`, against a faked `@julusian/midi`
 * `Output` and a faked `tasklist` call — per `opentimbre-testing`, the real
 * native binding and the real process listing are what get faked here, never
 * the rule. Covers: finding the configured loopMIDI port by name fragment,
 * failing honestly (not throwing) when no port matches, the exact 3-byte CC
 * message a found port receives, `tasklist` CSV parsing for both a running
 * and a not-running process, and the %APPDATA%-based settings path.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { afterEach, describe, test } from 'node:test'
import type { AppInfo } from '@opentimbre/core/src/plugins/types.ts'
import {
  createWindowsPlatformInfo,
  createWindowsTransport,
  windowsTransport,
  type MidiOutputLike,
} from './windows.ts'

// ------------------------------------------------------------------ fixtures

/** Records every `sendMessage` call instead of touching a real MIDI port. */
function fakeOutput(portNames: string[]): MidiOutputLike & { sent: number[][] } {
  const sent: number[][] = []
  return {
    sent,
    getPortCount: () => portNames.length,
    getPortName: (i) => portNames[i]!,
    openPort: () => {},
    closePort: () => {},
    sendMessage: (message) => {
      sent.push(message)
    },
  }
}

const FIXTURE_APP_INFO: AppInfo = {
  candidates: { win32: ['C:\\Program Files\\Fixture\\Fixture.exe'] },
  process: 'Fixture.exe',
  settings: 'Fixture',
  midiFolder: 'MIDI Mappings',
  mapping: 'fixture.xml',
}

// -------------------------------------------------------------- MIDI transport

describe('createWindowsTransport().connect()', () => {
  test('finds a port whose name contains the configured target', async () => {
    const output = fakeOutput(['Microsoft GS Wavetable Synth', 'loopMIDI Port (VoiceRig)'])
    const transport = createWindowsTransport(() => output, 'VoiceRig')

    const result = await transport.connect()

    assert.ok('send' in result, 'expected a send function, got an error result')
  })

  test('returns a named error, not a throw, when no port matches', async () => {
    const output = fakeOutput(['Microsoft GS Wavetable Synth'])
    const transport = createWindowsTransport(() => output, 'VoiceRig')

    const result = await transport.connect()

    assert.ok('error' in result, 'expected an error result, got a send function')
    assert.match((result as { error: string }).error, /VoiceRig/)
    assert.match(
      (result as { error: string }).error,
      /Microsoft GS Wavetable Synth/,
      'the error should list the ports actually found, to save diagnosis time',
    )
  })

  test('the matched port name is case-insensitive, matching legacy', async () => {
    const output = fakeOutput(['LOOPMIDI PORT (VOICERIG)'])
    const transport = createWindowsTransport(() => output, 'VoiceRig')

    const result = await transport.connect()

    assert.ok('send' in result)
  })

  test('send() writes a 3-byte Control Change message: [0xB0, cc, value]', async () => {
    const output = fakeOutput(['loopMIDI Port (VoiceRig)'])
    const transport = createWindowsTransport(() => output, 'VoiceRig')

    const result = await transport.connect()
    assert.ok('send' in result)
    result.send(21, 100)

    assert.deepEqual(output.sent, [[0xb0, 21, 100]])
  })

  test('defaults to VOICERIG_PORT-or-VoiceRig without an explicit portFragment', async () => {
    const output = fakeOutput(['loopMIDI Port (VoiceRig)'])
    const transport = createWindowsTransport(() => output) // no portFragment argument

    const result = await transport.connect()

    assert.ok('send' in result, 'the default fragment should have matched the VoiceRig port')
  })

  test('importing this module never loads the real @julusian/midi native binding', () => {
    // The regression this guards: a prior version statically imported
    // '@julusian/midi/lazy' at the top of windows.ts, which loads the real
    // native addon the instant the module is imported -- including here, in
    // this test file -- regardless of /lazy's deferred verifyLibraryLoaded().
    // Every test above already imported windows.ts and exercised
    // windowsTransport's factory shape with fakes; if the fix holds, none of
    // that should have pulled the real binding into the process.
    const require = createRequire(import.meta.url)
    const loaded = Object.keys(require.cache).some((path) => path.includes('@julusian'))
    assert.equal(loaded, false, '@julusian/midi should not appear in require.cache')

    // windowsTransport itself (the real-dependency export, not a test fake)
    // must exist and be usable without having forced a load merely by being
    // referenced -- confirms the fix isn't just "don't import windowsTransport".
    assert.equal(typeof windowsTransport.connect, 'function')
    const loadedAfterReference = Object.keys(require.cache).some((path) =>
      path.includes('@julusian'),
    )
    assert.equal(
      loadedAfterReference,
      false,
      'referencing windowsTransport.connect should not load the native binding either -- only calling connect() would',
    )
  })
})

// -------------------------------------------------------------- platform info

describe('createWindowsPlatformInfo().isRunning()', () => {
  test('reports true when the exact quoted process name is in the tasklist CSV output', async () => {
    const platformInfo = createWindowsPlatformInfo(async () =>
      Buffer.from('"Fixture.exe","1234","Console","1","50,000 K"\r\n').toString(),
    )

    assert.equal(await platformInfo.isRunning('Fixture.exe'), true)
  })

  test('reports false when the process is not in the tasklist output', async () => {
    const platformInfo = createWindowsPlatformInfo(async () =>
      Buffer.from('INFO: No tasks are running which match the specified criteria.\r\n').toString(),
    )

    assert.equal(await platformInfo.isRunning('Fixture.exe'), false)
  })

  test('does not truncate-match a process name longer than 25 characters', async () => {
    // The bug this format exists to avoid: the old table output truncated
    // the Image Name column at 25 characters, so a substring check on a
    // longer name would have falsely matched a *different*, shorter process.
    const longName = 'Archetype Tim Henson X.exe'
    const platformInfo = createWindowsPlatformInfo(async () =>
      Buffer.from(`"${longName.slice(0, 25)}","1234","Console","1","50,000 K"\r\n`).toString(),
    )

    assert.equal(await platformInfo.isRunning(longName), false)
  })

  test('reports false, not a throw, when listing processes fails', async () => {
    const platformInfo = createWindowsPlatformInfo(async () => {
      throw new Error('tasklist is not recognized (not on Windows, or PATH is broken)')
    })

    assert.equal(await platformInfo.isRunning('Fixture.exe'), false)
  })
})

describe('createWindowsPlatformInfo().settingsDir()', () => {
  const ORIGINAL_APPDATA = process.env['APPDATA']

  afterEach(() => {
    if (ORIGINAL_APPDATA === undefined) delete process.env['APPDATA']
    else process.env['APPDATA'] = ORIGINAL_APPDATA
  })

  test('builds a path under %APPDATA% using the AppInfo settings folder name', () => {
    // A fixed value injected via the environment, not a machine-specific
    // literal — this must pass on any machine running the suite.
    process.env['APPDATA'] = 'C:\\Users\\fixture\\AppData\\Roaming'
    const platformInfo = createWindowsPlatformInfo()

    assert.equal(
      platformInfo.settingsDir(FIXTURE_APP_INFO),
      'C:\\Users\\fixture\\AppData\\Roaming\\Fixture',
    )
  })
})
