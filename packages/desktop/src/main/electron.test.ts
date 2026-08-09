/**
 * Guards the ESM boot fix: under Electron 43's ESM main-process loader a named
 * import from `electron` (a CommonJS module) fails to resolve, so every value
 * import must go through the single re-export in `electron.ts`. This test can
 * not import the real Electron values under `node --test` (there `electron`
 * resolves to its binary path string), so it guards the structural invariant
 * instead: value imports of `electron` live only in `electron.ts`, and that
 * one module re-exports every Electron value the main process uses. The live
 * boot is proven separately by launching the built bundle under Electron.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const MAIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

function mainFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.ts')) out.push(full)
    }
  }
  walk(MAIN_DIR)
  return out
}

const EXPECTED_NAMES = [
  'app',
  'BrowserWindow',
  'ipcMain',
  'Menu',
  'protocol',
  'safeStorage',
  'session',
  'nativeTheme',
]

test('electron.ts re-exports the Electron values the main process uses', () => {
  const source = readFileSync(path.join(MAIN_DIR, 'electron.ts'), 'utf8')
  for (const name of EXPECTED_NAMES) {
    assert.ok(
      source.includes(name),
      `electron.ts does not re-export ${name} — the ESM loader would fail on its named import`,
    )
  }
  assert.ok(
    /import electron from 'electron'/.test(source),
    'electron.ts must import the default export of electron',
  )
})

test('no other main-process file statically named-imports from electron', () => {
  for (const file of mainFiles()) {
    if (path.basename(file) === 'electron.ts' || path.basename(file) === 'electron.test.ts') continue
    const source = readFileSync(file, 'utf8')
    // The failing construct is a static ESM named import from `electron` —
    // single-line (`import { a } from 'electron'`) or multi-line (`import {\n a \n}`).
    // `createRequire(...).require('electron')` is the ESM-safe lazy pattern
    // (renderer-protocol.ts) and deliberately NOT flagged: it never runs the
    // npm `electron` package's entry under `node --test`, and resolves to the
    // real API inside the main process.
    const namedImports = source
      .replace(/\r?\n/g, ' ')
      .match(/import\s*\{[^}]*\}\s*from\s*'electron'/g)
    assert.deepEqual(
      namedImports ?? [],
      [],
      `static named import(s) of 'electron' in ${path.basename(file)} bypass electron.ts`,
    )
  }
})