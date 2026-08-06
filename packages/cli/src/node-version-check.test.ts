/**
 * Characterization tests for the Node-version gate — pure input/output, no
 * dependency on the Node actually running the suite.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { checkNodeVersion } from './node-version-check.ts'

describe('checkNodeVersion()', () => {
  test('rejects a Node older than the required minor, naming the requirement', () => {
    const result = checkNodeVersion('22.10.0')
    assert.equal(result.ok, false)
    assert.match(result.ok ? '' : result.message, /requires Node >=22\.12/)
    assert.match(result.ok ? '' : result.message, /22\.10\.0/)
  })

  test('accepts exactly the required version', () => {
    assert.deepEqual(checkNodeVersion('22.12.0'), { ok: true })
  })

  test('accepts a later minor on the required major', () => {
    assert.deepEqual(checkNodeVersion('22.13.4'), { ok: true })
  })

  test('accepts a later major regardless of its minor', () => {
    assert.deepEqual(checkNodeVersion('23.0.0'), { ok: true })
  })

  test('rejects an older major even with a high minor', () => {
    const result = checkNodeVersion('21.99.0')
    assert.equal(result.ok, false)
  })

  test('accepts the real process.version shape, leading "v" included', () => {
    assert.deepEqual(checkNodeVersion('v22.12.0'), { ok: true })
  })

  test('fails honestly, with a message, on an unparseable version string', () => {
    const result = checkNodeVersion('not-a-version')
    assert.equal(result.ok, false)
    assert.match(result.ok ? '' : result.message, /Could not parse/)
  })
})
