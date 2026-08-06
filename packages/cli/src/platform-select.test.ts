/**
 * Characterization tests for `platform-select.ts`. Pure and injectable, so
 * no fake needed beyond the `platform` string argument itself.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { macosPlatformInfo, macosTransport } from '@opentimbre/platform-node/src/macos.ts'
import { windowsPlatformInfo, windowsTransport } from '@opentimbre/platform-node/src/windows.ts'
import { selectPlatform } from './platform-select.ts'

test("selects the Windows transport/platformInfo pair for 'win32'", () => {
  const bundle = selectPlatform('win32')

  assert.equal(bundle.transport, windowsTransport)
  assert.equal(bundle.platformInfo, windowsPlatformInfo)
})

test("selects the macOS transport/platformInfo pair for 'darwin'", () => {
  const bundle = selectPlatform('darwin')

  assert.equal(bundle.transport, macosTransport)
  assert.equal(bundle.platformInfo, macosPlatformInfo)
})

test('fails honestly, naming the platform, rather than silently defaulting', () => {
  assert.throws(() => selectPlatform('linux'), /Unsupported platform 'linux'/)
})

test('defaults to the real process.platform when no argument is given', () => {
  // Proves the default argument is genuinely `process.platform`, not a
  // hardcoded OS -- by calling selectPlatform() both ways and requiring
  // identical results, on whatever platform this test suite actually runs
  // on (win32/darwin here; anywhere else both calls throw identically,
  // which the assertion below still confirms).
  const resultOf = (call: () => ReturnType<typeof selectPlatform>) => {
    try {
      const bundle = call()
      return { transport: bundle.transport, platformInfo: bundle.platformInfo }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }

  assert.deepEqual(resultOf(() => selectPlatform()), resultOf(() => selectPlatform(process.platform)))
})
