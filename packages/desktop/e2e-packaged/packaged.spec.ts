import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron, expect, test } from '@playwright/test'

/**
 * Packaged-runtime smoke: launches the portable exe produced by
 * electron-builder and proves the real app boots and paints — real main
 * process, real preload bridge, real renderer over app://, none of the e2e
 * stubs. No MIDI hardware, no API keys, no network expectations: the
 * portable build runs the inert updater, so an unreachable update feed must
 * stay silent and the app must boot offline anyway. Only runnable where the
 * Windows artifacts exist — `.github/workflows/release.yml` step 7.
 */

const RELEASE_DIR = fileURLToPath(new URL('../release/', import.meta.url))

/**
 * Locates the portable exe among the electron-builder artifacts. The NSIS
 * target emits "OpenTimbre Setup <ver>.exe"; the portable target emits the
 * product name without "Setup". The portable is therefore the single *.exe
 * whose name does not contain "Setup" — and any other shape (a missing
 * release dir, no exes, or zero/several non-Setup matches) fails the test
 * loudly instead of guessing.
 */
function findPortableExe(): string {
  if (!existsSync(RELEASE_DIR)) {
    throw new Error(`release directory missing — run electron-builder first: ${RELEASE_DIR}`)
  }
  const exes = readdirSync(RELEASE_DIR).filter((file) => file.endsWith('.exe'))
  if (exes.length === 0) {
    throw new Error(`no .exe artifacts found in ${RELEASE_DIR}`)
  }
  const portable = exes.filter((file) => !file.includes('Setup'))
  if (portable.length !== 1) {
    throw new Error(
      `expected exactly one portable exe (no "Setup" in the name), found ${portable.length} in [${exes.join(', ')}]`,
    )
  }
  return join(RELEASE_DIR, portable[0])
}

test('packaged portable app boots and paints the shell', async () => {
  const executablePath = findPortableExe()
  const app = await _electron.launch({ executablePath, timeout: 60_000 })
  try {
    const window = await app.firstWindow()
    // "OpenTimbre" is locale-independent in the i18n catalog (identical in
    // en and pt), and "Chat" is too — stable proof the real renderer painted
    // without depending on locale, MIDI state, or provider configuration.
    await expect(window.locator('ot-titlebar')).toContainText('OpenTimbre')
    await expect(window.locator('ot-app-shell')).toBeVisible()
    await expect(window.getByRole('tab', { name: 'Chat' })).toBeVisible()
  } finally {
    await app.close()
  }
})
