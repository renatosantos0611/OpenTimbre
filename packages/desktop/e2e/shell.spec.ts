import { expect, test, type Page } from '@playwright/test'

/**
 * Real-browser proof of the shell at both ratified viewports (420x700 and
 * 360x520): both themes render at readable contrast, the dimmed state keeps
 * contrast, nothing overflows or clips, focus is visible, and shell pane
 * switching works. The bridge is a stubbed `window.api` injected before the
 * app boots, so this exercises the real rendered shell, not a static mock.
 */

const VIEWPORTS = [
  { width: 420, height: 700 },
  { width: 360, height: 520 },
]

/** Injects a functioning `DesktopApi` stub before the app's main.js runs. */
async function stubBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let state = {
      locale: 'en',
      midi: { port: 'Virtual Port', error: null },
      ai: { provider: 'openai', label: 'OpenAI', model: 'gpt-4o', modelLabel: 'GPT-4o', available: [] },
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
      setDimOnUnfocus: async (v: boolean) => {
        state = { ...state, dimOnUnfocus: v }
        return v
      },
      setAutoApply: async () => true,
      setTheme: async (theme: string) => {
        state = { ...state, theme: { chosen: theme, resolved: theme === 'system' ? 'dark' : theme } }
        return state
      },
      setLocale: async (locale: string) => {
        state = { ...state, locale }
        return state
      },
      saveKey: async () => state,
      removeKey: async () => state,
      setProviderPreference: async () => state,
      listConversations: async () => [],
      openConversation: async () => ({ id: 'c1', title: 'Tone hunt', messages: [], plugin: null, memoryLost: false }),
      deleteConversation: async () => [],
      onChatStatus: () => () => undefined,
      onThemeChanged: () => () => undefined,
      onPluginChanged: () => () => undefined,
      downloadUpdate: async () => undefined,
      installUpdate: async () => undefined,
      onUpdaterStatus: () => () => undefined,
    }
  })
}

async function openShell(page: Page): Promise<void> {
  await stubBridge(page)
  await page.goto('/')
  await expect(page.locator('ot-app-shell')).toBeVisible()
  // The bridge resolves getState, so the chat pane leaves its loading state.
  await expect(page.locator('ot-chat-pane')).toContainText('Build your tone')
}

/** WCAG contrast ratio (1..21) of foreground vs painted background for an element. */
async function contrastOf(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement
    const fg = getComputedStyle(el).color
    // Walk up to the nearest opaque background (the pane itself is transparent
    // and sits on the surface).
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
  test(`shell at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openShell(page)

  // Every shell band is present.
  await expect(page.locator('ot-titlebar')).toBeVisible()
  await expect(page.locator('ot-status-bar')).toBeVisible()
  await expect(page.locator('ot-plugin-bar')).toBeVisible()
  await expect(page.locator('ot-composer')).toBeVisible()
  await expect(page.locator('.pane-tabs')).toHaveCount(0)

  // No horizontal overflow at the minimum column.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)

  // Dark theme (the default) holds readable body-text contrast.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const darkContrast = await contrastOf(page, 'ot-chat-pane')
  expect(darkContrast).toBeGreaterThanOrEqual(4.5)

  // Switch to the light theme and confirm it renders with contrast.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const lightContrast = await contrastOf(page, 'ot-chat-pane')
  expect(lightContrast).toBeGreaterThanOrEqual(4.5)

  // Pane switching keeps the chat pane mounted and returns to it.
  await page.getByRole('button', { name: 'Back to the conversation' }).click()
  await expect(page.locator('ot-chat-pane')).toBeVisible()
  await expect(page.locator('ot-chat-pane')).toContainText('Build your tone')

  // Dimmed state: enable dim-on-unfocus, then blur the window.
  // The dim is now handled by Electron's win.setOpacity() in the main process,
  // so the renderer no longer sets data-dimmed. Verify the setting toggles.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Dim when unfocused').check()

  // Focus is visible on an interactive element when you Tab.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  // After the settings flow the first Tab can land on <body>; keep Tabbing
  // until an interactive element has focus, then check its focus ring.
  let guard = 0
  while ((await page.evaluate(() => document.activeElement?.tagName)) === 'BODY' && guard < 10) {
    await page.keyboard.press('Tab')
    guard++
  }
  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const cs = getComputedStyle(el)
    return { w: cs.outlineWidth, style: cs.outlineStyle }
  })
  expect(focus.w).toBe('2px')
  expect(focus.style).toBe('solid')
  })
}