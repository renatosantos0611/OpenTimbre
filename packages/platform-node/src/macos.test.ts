/**
 * Characterization tests for `macos.ts`, against a faked `@julusian/midi`
 * `Output` (specifically its `openVirtualPort` method) and a faked `pgrep`
 * call — per `opentimbre-testing`, the real native binding and the real
 * process listing are what get faked here, never the rule. Covers: creating
 * the configured virtual port and sending through it, failing honestly (not
 * throwing) when virtual-port creation itself fails, `pgrep`-style output
 * interpretation (PIDs present vs. empty), and the
 * `~/Library/Application Support`-based settings path.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, test } from 'node:test'
import type { AppInfo } from '@opentimbre/core/src/plugins/types.ts'
import {
  createMacosPlatformInfo,
  createMacosTransport,
  isExitCode,
  macosTransport,
  type MidiOutputLike,
} from './macos.ts'

// ------------------------------------------------------------------ fixtures

/**
 * Records every `openVirtualPort`/`sendMessage` call instead of touching a
 * real MIDI port. `failWith`, when given, makes `openVirtualPort` throw —
 * the fake's way of modeling RtMidi failing to create the port.
 */
function fakeOutput(
  failWith?: Error,
): MidiOutputLike & { sent: number[][]; openedWith: string[] } {
  const sent: number[][] = []
  const openedWith: string[] = []
  return {
    sent,
    openedWith,
    openVirtualPort: (name) => {
      openedWith.push(name)
      if (failWith) throw failWith
    },
    closePort: () => {},
    sendMessage: (message) => {
      sent.push(message)
    },
  }
}

const FIXTURE_APP_INFO: AppInfo = {
  candidates: ['/Applications/Fixture.app'],
  process: 'Fixture',
  settings: 'Fixture',
  midiFolder: 'MIDI',
  mapping: 'fixture.xml',
}

// -------------------------------------------------------------- MIDI transport

describe('createMacosTransport().connect()', () => {
  test('creates a virtual port with the configured name and returns a working send()', async () => {
    const output = fakeOutput()
    const transport = createMacosTransport(() => output, 'VoiceRig')

    const result = await transport.connect()

    assert.ok('send' in result, 'expected a send function, got an error result')
    assert.deepEqual(output.openedWith, ['VoiceRig'])
  })

  test('send() writes a 3-byte Control Change message: [0xB0, cc, value]', async () => {
    const output = fakeOutput()
    const transport = createMacosTransport(() => output, 'VoiceRig')

    const result = await transport.connect()
    assert.ok('send' in result)
    result.send(21, 100)

    assert.deepEqual(output.sent, [[0xb0, 21, 100]])
  })

  test('returns a named error, not a throw, when virtual-port creation fails', async () => {
    const output = fakeOutput(new Error('CoreMIDI: permission denied'))
    const transport = createMacosTransport(() => output, 'VoiceRig')

    const result = await transport.connect()

    assert.ok('error' in result, 'expected an error result, got a send function')
    assert.match((result as { error: string }).error, /VoiceRig/)
    assert.match((result as { error: string }).error, /permission denied/)
  })

  test('defaults to VOICERIG_PORT-or-VoiceRig without an explicit portName', async () => {
    const output = fakeOutput()
    const transport = createMacosTransport(() => output) // no portName argument

    const result = await transport.connect()

    assert.ok('send' in result, 'the default name should have been used to open the port')
    assert.deepEqual(output.openedWith, ['VoiceRig'])
  })

  test('importing this module never loads the real @julusian/midi native binding', () => {
    // Same regression this guards against as windows.test.ts: a static
    // import of '@julusian/midi' or '@julusian/midi/lazy' at the top of this
    // file would load the real native addon the instant the module is
    // imported -- including here, in this test file.
    const require = createRequire(import.meta.url)
    const loaded = Object.keys(require.cache).some((path) => path.includes('@julusian'))
    assert.equal(loaded, false, '@julusian/midi should not appear in require.cache')

    assert.equal(typeof macosTransport.connect, 'function')
    const loadedAfterReference = Object.keys(require.cache).some((path) =>
      path.includes('@julusian'),
    )
    assert.equal(
      loadedAfterReference,
      false,
      'referencing macosTransport.connect should not load the native binding either -- only calling connect() would',
    )
  })
})

// -------------------------------------------------------------- platform info

// The default listProcesses (listProcessesViaPgrep) shells out to the real
// pgrep, so the isRunning tests above inject a replacement that bypasses it
// entirely -- they never exercise the exit-code-1-means-not-found
// translation pgrep's own real behavior requires. isExitCode is the whole of
// that translation's logic; test it directly instead.
describe('isExitCode()', () => {
  test('true for an error object carrying the matching exit code', () => {
    assert.equal(isExitCode({ code: 1 }, 1), true)
  })

  test('false for an error object carrying a different exit code', () => {
    assert.equal(isExitCode({ code: 2 }, 1), false)
  })

  test('false for a value with no code property at all', () => {
    assert.equal(isExitCode(new Error('pgrep: command not found'), 1), false)
  })

  test('false for a non-object value (never throws on unexpected shapes)', () => {
    assert.equal(isExitCode('not an error object', 1), false)
    assert.equal(isExitCode(null, 1), false)
    assert.equal(isExitCode(undefined, 1), false)
  })
})

describe('createMacosPlatformInfo().isRunning()', () => {
  test('reports true when the faked pgrep output has at least one PID', async () => {
    const platformInfo = createMacosPlatformInfo(async () => '1234\n')

    assert.equal(await platformInfo.isRunning('Fixture'), true)
  })

  test('reports false when the faked pgrep output is empty (pgrep found no match)', async () => {
    const platformInfo = createMacosPlatformInfo(async () => '')

    assert.equal(await platformInfo.isRunning('Fixture'), false)
  })

  test('reports false, not a throw, when listing processes fails', async () => {
    const platformInfo = createMacosPlatformInfo(async () => {
      throw new Error('pgrep: command not found')
    })

    assert.equal(await platformInfo.isRunning('Fixture'), false)
  })
})

describe('createMacosPlatformInfo().settingsDir()', () => {
  test('builds a path under ~/Library/Application Support using the AppInfo settings folder name', () => {
    // A fixed value injected as a fake, not a machine-specific literal — this
    // must pass on any machine running the suite, including this Windows dev
    // box, and must always read as a macOS (forward-slash) path regardless
    // of the host OS actually running the test.
    const platformInfo = createMacosPlatformInfo(undefined, () => '/Users/fixture')

    assert.equal(
      platformInfo.settingsDir(FIXTURE_APP_INFO),
      '/Users/fixture/Library/Application Support/Fixture',
    )
  })
})
