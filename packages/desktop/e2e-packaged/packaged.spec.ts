import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron, expect, test, type ElectronApplication } from '@playwright/test'

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

/** Caps a promise so diagnostics and teardown can never hang the unwind. */
function raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms).unref()),
  ])
}

/**
 * Failure-only diagnostics: how far the boot got (launch, windows, painted
 * title, captured renderer output). Must never throw or mask the failure.
 */
async function diagnose(app: ElectronApplication | null, captured: string[]): Promise<void> {
  try {
    if (!app) {
      console.log('[packaged-smoke] app did not launch')
      return
    }
    const windows = app.windows()
    console.log(`[packaged-smoke] app launched; open windows: ${windows.length}`)
    const window = windows[0]
    if (window) {
      const title = await raceTimeout(window.evaluate(() => document.title), 2000, '<title unavailable>')
      console.log(`[packaged-smoke] document.title: ${title}`)
    }
    if (captured.length > 0) {
      console.log(`[packaged-smoke] captured renderer output: ${captured.join(' | ')}`)
    }
  } catch {
    // diagnostics must never mask the original failure
  }
}

test('packaged portable app boots and paints the shell', async () => {
  const captured: string[] = []
  let app: ElectronApplication | null = null
  try {
    const executablePath = findPortableExe()
    // CI Windows sessions have no reliable GPU, and a GPU-init hang was the
    // observed failure mode; --disable-gpu avoids it and --no-sandbox is the
    // standard CI-Electron companion. The oracle (the shell paints) is
    // unchanged; local runs keep a clean, arg-free launch.
    const args = process.env.CI ? ['--disable-gpu', '--no-sandbox'] : []
    app = await _electron.launch({ executablePath, args, timeout: 120_000 })
    const window = await app.firstWindow()
    window.on('console', (message) => {
      if (captured.length < 5) captured.push(`console[${message.type()}] ${message.text()}`)
    })
    window.on('pageerror', (error) => {
      if (captured.length < 5) captured.push(`pageerror ${error.message}`)
    })
    // "OpenTimbre" is locale-independent in the i18n catalog (identical in
    // en and pt), and "Chat" is too — stable proof the real renderer painted
    // without depending on locale, MIDI state, or provider configuration.
    await expect(window.locator('ot-titlebar')).toContainText('OpenTimbre')
    await expect(window.locator('ot-app-shell')).toBeVisible()
    await expect(window.getByRole('tab', { name: 'Chat' })).toBeVisible()
  } catch (error) {
    await diagnose(app, captured)
    throw error
  } finally {
    if (app) {
      await raceTimeout(app.close(), 10_000, undefined)
    }
  }
})
