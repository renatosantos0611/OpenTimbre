import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron, expect, test, type ElectronApplication } from '@playwright/test'

/**
 * Packaged-runtime smoke: launches the UNPACKED packaged runtime
 * (`release/win-unpacked/OpenTimbre.exe`, emitted by electron-builder next
 * to the artifacts) and proves the real app boots and paints — real main
 * process, real preload bridge, real renderer over app://, none of the e2e
 * stubs.
 *
 * Why unpacked, not the portable exe: the portable/NSIS wrapper layers are
 * electron-builder's own code, and the portable wrapper relaunches the inner
 * exe, which breaks Playwright's CDP attach. The wrappers stay covered by
 * the manual release checklist; this smoke proves OUR packaged runtime —
 * asar contents, the app:// protocol handler, the preload bridge, and the
 * updater wiring — which is identical between win-unpacked and the installed
 * app.
 *
 * No MIDI hardware, no API keys, no network prerequisites. Here the app is
 * packaged without the PORTABLE_EXECUTABLE_DIR marker, so the real updater
 * runs its startup check; an unreachable feed must stay silent and never
 * block the boot. Only runnable where the Windows artifacts exist —
 * `.github/workflows/release.yml` step 8.
 */

const RELEASE_DIR = fileURLToPath(new URL('../release/', import.meta.url))

/**
 * Resolves the unpacked runtime exe. electron-builder always emits
 * `win-unpacked/` next to the artifacts and names the exe after productName
 * ("OpenTimbre"). A missing directory or exe fails the test loudly instead
 * of guessing.
 */
function findUnpackedExe(): string {
  const unpackedDir = join(RELEASE_DIR, 'win-unpacked')
  if (!existsSync(unpackedDir)) {
    throw new Error(`unpacked runtime missing — run electron-builder first: ${unpackedDir}`)
  }
  const exe = join(unpackedDir, 'OpenTimbre.exe')
  if (!existsSync(exe)) {
    throw new Error(`unpacked exe missing (productName should yield OpenTimbre.exe): ${exe}`)
  }
  return exe
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
    const executablePath = findUnpackedExe()
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
    // The window title comes straight from index.html's static <title>, so it
    // proves the app:// protocol served the real renderer regardless of JS
    // execution. The shell and its default (Chat) pane are then checked by
    // selector, not by text, so the oracle stays locale-independent without
    // depending on MIDI state or provider configuration. `ot-titlebar` renders
    // no text and there is no tab strip (legacy parity: a bare drag strip and
    // menu-driven pane switching, see `titlebar.ts`/`app-shell.ts`), so neither
    // is a usable text/role oracle here.
    await expect(window).toHaveTitle('OpenTimbre')
    await expect(window.locator('ot-app-shell')).toBeVisible()
    await expect(window.locator('ot-chat-pane')).toBeVisible()
  } catch (error) {
    await diagnose(app, captured)
    throw error
  } finally {
    if (app) {
      await raceTimeout(app.close(), 10_000, undefined)
    }
  }
})
