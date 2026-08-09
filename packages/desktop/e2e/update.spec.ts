import { expect, test, type Page } from '@playwright/test'

/**
 * Real-browser proof of the update banner at both ratified viewports: the
 * startup push renders the available row with the new version and a confirm
 * button, confirming walks the fake download path (percent, then ready with a
 * restart action), and the row never overflows the chrome. The stubbed bridge
 * pushes `updater:status` events as the real main process would, so this
 * exercises the real rendered shell.
 */

const VIEWPORTS = [
  { width: 420, height: 700 },
  { width: 360, height: 520 },
]

/** Injectable handle the tests read to observe bridge calls with no UI effect. */
type UpdaterCalls = { download: number; install: number }

/** Injects a functioning `DesktopApi` stub before the app's main.js runs. */
async function stubBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      locale: 'en',
      midi: { port: 'Virtual Port', error: null },
      ai: { provider: 'openai', label: 'OpenAI', model: 'gpt-4o', available: [] },
      aiError: null,
      guitar: { model: 'Default guitar', pickups: 'humbucker', tuning: 'E standard', strings: 6 },
      alwaysOnTop: true,
      dimOnUnfocus: false,
      autoApply: false,
      theme: { chosen: 'dark', resolved: 'dark' },
      keys: [],
      keysError: null,
      providerPreference: 'auto',
      forcedProvider: null,
      keysStorePath: '/tmp/keys.json',
      pluginIds: ['gojira', 'soldano', 'tim-henson', 'petrucci'],
      version: '1.2.3',
    }
    const updaterListeners = new Set<(s: unknown) => void>()
    const pushUpdater = (s: unknown) => updaterListeners.forEach((cb) => cb(s))
    const updaterCalls = { download: 0, install: 0 }
    ;(window as unknown as { __updaterCalls: unknown }).__updaterCalls = updaterCalls
    window.api = {
      getState: async () => state,
      sendChat: async (text: string) => ({ text, rig: null, cards: null }),
      newChat: async () => undefined,
      applyRig: async () => ({ scene: 's', amp: 'a', ccsSent: 0, ms: 0, warnings: [] }),
      setGuitar: async () => state,
      setModel: async () => state,
      listModels: async () => [],
      getPluginState: async () => ({ id: 'gojira', name: 'Gojira', installed: false, path: null, running: false, mappingStatus: 'missing' }),
      openPlugin: async () => ({ id: 'gojira', name: 'Gojira', installed: false, path: null, running: false, mappingStatus: 'missing' }),
      installMapping: async () => ({ id: 'gojira', name: 'Gojira', installed: false, path: null, running: false, mappingStatus: 'missing' }),
      toggleAlwaysOnTop: async () => true,
      setDimOnUnfocus: async () => true,
      setAutoApply: async () => true,
      setTheme: async (theme: string) => ({ ...state, theme: { chosen: theme, resolved: theme === 'system' ? 'dark' : theme } }),
      setLocale: async (locale: string) => ({ ...state, locale }),
      saveKey: async () => state,
      removeKey: async () => state,
      setProviderPreference: async () => state,
      listConversations: async () => [],
      openConversation: async () => ({ id: 'c1', title: 'Tone hunt', messages: [], plugin: null, memoryLost: false }),
      deleteConversation: async () => [],
      onChatStatus: () => () => undefined,
      onThemeChanged: () => () => undefined,
      onPluginChanged: () => () => undefined,
      downloadUpdate: async () => {
        updaterCalls.download += 1
        pushUpdater({ state: 'downloading', percent: 12 })
        // Hold the percent state briefly so the progress row is observable.
        await new Promise((resolve) => setTimeout(resolve, 200))
        pushUpdater({ state: 'downloading', percent: 100 })
        pushUpdater({ state: 'ready' })
      },
      installUpdate: async () => {
        updaterCalls.install += 1
      },
      onUpdaterStatus: (cb: (s: unknown) => void) => {
        updaterListeners.add(cb)
        // The startup announcement, as a packaged main process would push it.
        pushUpdater({ state: 'available', version: '2.0.0' })
        return () => updaterListeners.delete(cb)
      },
    }
  })
}

async function openShell(page: Page): Promise<void> {
  await stubBridge(page)
  await page.goto('/')
  await expect(page.locator('ot-app-shell')).toBeVisible()
}

async function updaterCalls(page: Page): Promise<UpdaterCalls> {
  return page.evaluate(() => (window as unknown as { __updaterCalls: UpdaterCalls }).__updaterCalls)
}

/** WCAG contrast ratio (1..21) of foreground vs painted background for an element. */
async function contrastOf(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement
    const fg = getComputedStyle(el).color
    // Walk up to the nearest opaque background (the row itself is transparent
    // and sits on the chrome surface).
    let node: HTMLElement | null = el
    let bg = 'rgba(0, 0, 0, 0)'
    while (node) {
      const c = getComputedStyle(node).backgroundColor
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
        bg = c
        break
      }
      node = node.parentElement
    }
    const ratio = (a: string, b: string) => {
      const L = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        const f = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4))
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const [l1, l2] = [L(a), L(b)].sort((x, y) => y - x)
      return (l1 + 0.05) / (l2 + 0.05)
    }
    return ratio(fg, bg)
  }, selector)
}

for (const viewport of VIEWPORTS) {
  test(`update banner: available -> confirm -> progress -> ready at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openShell(page)

    // The startup push renders the available row with the new version.
    await expect(page.locator('ot-status-bar .update')).toHaveAttribute('data-state', 'available')
    await expect(page.locator('ot-status-bar .update')).toContainText('Version 2.0.0 is available')
    await expect(page.locator('ot-status-bar .update .confirm')).toContainText('Update')
    await expect(page.locator('ot-status-bar .update .dismiss')).toContainText('Dismiss')

    // No horizontal overflow with the banner in the chrome at this width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)

    // Confirm triggers the fake download path: percent first, then ready.
    await page.locator('ot-status-bar .update .confirm').click()
    await expect(page.locator('ot-status-bar .update')).toHaveAttribute('data-state', 'downloading')
    await expect(page.locator('ot-status-bar .update')).toContainText('Downloading update… 12%')
    await expect(page.locator('ot-status-bar .update')).toHaveAttribute('data-state', 'ready')
    await expect(page.locator('ot-status-bar .update')).toContainText('Restart to update')
    await expect(page.locator('ot-status-bar .update .confirm')).toContainText('Restart')
    expect(await updaterCalls(page)).toEqual({ download: 1, install: 0 })

    // Restart delegates to the bridge's install call.
    await page.locator('ot-status-bar .update .confirm').click()
    expect(await updaterCalls(page)).toEqual({ download: 1, install: 1 })
  })
}

test('update banner: dismiss hides the row for the session', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 700 })
  await openShell(page)
  await expect(page.locator('ot-status-bar .update')).toBeVisible()
  await page.locator('ot-status-bar .update .dismiss').click()
  await expect(page.locator('ot-status-bar .update')).toHaveCount(0)
  // The existing chrome rows are untouched.
  await expect(page.locator('ot-status-bar')).toContainText('Connected')
})

test('update banner: readable contrast in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 700 })
  await openShell(page)
  await expect(page.locator('ot-status-bar .update')).toBeVisible()

  const darkText = await contrastOf(page, 'ot-status-bar .update .value')
  expect(darkText).toBeGreaterThanOrEqual(4.5)
  const darkAction = await contrastOf(page, 'ot-status-bar .update .confirm')
  expect(darkAction).toBeGreaterThanOrEqual(4.5)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const lightText = await contrastOf(page, 'ot-status-bar .update .value')
  expect(lightText).toBeGreaterThanOrEqual(4.5)
  const lightAction = await contrastOf(page, 'ot-status-bar .update .confirm')
  expect(lightAction).toBeGreaterThanOrEqual(4.5)
})
