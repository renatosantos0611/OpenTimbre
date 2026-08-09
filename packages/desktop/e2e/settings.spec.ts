import { expect, test, type Page } from '@playwright/test'

/**
 * Real-browser proof of the settings and plugin surfaces: the guitar form
 * saves, the AI provider/model controls disable under a forced provider,
 * saving an API key clears the input and shows a hint, and the plugin bar
 * renders each catalog plugin with open/mapping actions. The bridge is a
 * stubbed `window.api`, so this exercises the real rendered shell.
 */

async function stubBridge(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let state = {
      locale: 'en',
      midi: { port: 'Virtual Port', error: null },
      ai: { provider: 'openai', label: 'OpenAI', model: 'gpt-4o', available: [] },
      aiError: null,
      guitar: { model: 'Default guitar', pickups: 'humbucker', tuning: 'E standard', strings: 6 },
      alwaysOnTop: true,
      dimOnUnfocus: false,
      autoApply: false,
      theme: { chosen: 'dark', resolved: 'dark' },
      keys: [
        { provider: 'openai', label: 'OpenAI', env: 'OPENAI_API_KEY', source: 'app', hint: 'sk-…f3a', updatedAt: 'now', protected: true, readable: true },
      ],
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
      setGuitar: async (guitar: unknown) => {
        state = { ...state, guitar }
        return state
      },
      setModel: async (provider: string, id: string) => {
        state = { ...state, ai: { ...(state.ai as object), model: id } }
        return state
      },
      getPluginState: async (id: string) => ({ id, name: id, installed: true, path: '/x', running: false, mappingStatus: 'ok' }),
      openPlugin: async (id: string) => ({ id, name: id, installed: true, path: '/x', running: true, mappingStatus: 'ok' }),
      installMapping: async (id: string) => ({ id, name: id, installed: true, path: '/x', running: false, mappingStatus: 'ok' }),
      toggleAlwaysOnTop: async () => true,
      setDimOnUnfocus: async (v: boolean) => {
        state = { ...state, dimOnUnfocus: v }
        return v
      },
      setAutoApply: async (v: boolean) => {
        state = { ...state, autoApply: v }
        return v
      },
      setTheme: async (theme: string) => {
        state = { ...state, theme: { chosen: theme, resolved: theme === 'system' ? 'dark' : theme } }
        return state
      },
      setLocale: async (locale: string) => {
        state = { ...state, locale }
        return state
      },
      saveKey: async (provider: string, key: string) => {
        if (key === 'boom') return { error: 'Key has whitespace in the middle — paste only the key.' }
        state = {
          ...state,
          keys: [{ provider: 'openai', label: 'OpenAI', env: 'OPENAI_API_KEY', source: 'app', hint: 'sk-…f3a', updatedAt: 'now', protected: true, readable: true }],
        }
        return state
      },
      removeKey: async () => {
        state = { ...state, keys: [] }
        return state
      },
      setProviderPreference: async (pref: string) => {
        state = { ...state, providerPreference: pref }
        return state
      },
      listConversations: async () => [],
      openConversation: async () => ({ id: 'c1', title: 'Tone hunt', messages: [], plugin: null, memoryLost: false }),
      deleteConversation: async () => [],
      onChatStatus: () => () => undefined,
      onThemeChanged: () => () => undefined,
      onPluginChanged: (cb: (s: unknown) => void) => {
        for (const id of ['gojira', 'soldano', 'tim-henson', 'petrucci']) {
          cb({ id, name: id, installed: true, path: '/x', running: false, mappingStatus: 'ok' })
        }
        return () => undefined
      },
      downloadUpdate: async () => undefined,
      installUpdate: async () => undefined,
      onUpdaterStatus: () => () => undefined,
    }
  })
}

async function openSettings(page: Page): Promise<void> {
  await stubBridge(page)
  await page.goto('/')
  await expect(page.locator('ot-app-shell')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.locator('ot-settings-pane')).toBeVisible()
}

test('settings: guitar saves and plugin bar renders at 420x700', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 700 })
  await openSettings(page)

  // Guitar form reflects the persisted guitar and saves a change.
  await expect(page.locator('ot-guitar-form input').first()).toHaveValue('Default guitar')
  await page.locator('ot-guitar-form input').first().fill('Tele')
  await page.locator('ot-guitar-form .save').click()
  await expect(page.locator('ot-guitar-form .save')).toContainText('Saved')

  // Key row shows a hint, never a plaintext key.
  await expect(page.locator('ot-ai-settings')).toContainText('sk-…f3a')
  await expect(page.locator('ot-ai-settings')).not.toContainText('sk-secret')

  // Saving a key clears the input.
  const keyInput = page.locator('ot-ai-settings input[type="password"]').first()
  await keyInput.fill('sk-newkey')
  await page.locator('ot-ai-settings button.save').first().click()
  await expect(keyInput).toHaveValue('')

  // No horizontal overflow.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('settings: forced provider disables AI controls', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 520 })
  await stubBridge(page)
  await page.addInitScript(() => {
    // Force a provider so the AI preference controls are disabled.
    const orig = window.api
    const origGet = orig.getState
    orig.getState = async () => {
      const s = await origGet()
      return { ...s, forcedProvider: 'openai' }
    }
  })
  await page.goto('/')
  await expect(page.locator('ot-app-shell')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.locator('ot-ai-settings .seg-btn').first()).toBeDisabled()
  await expect(page.locator('ot-ai-settings')).toContainText('AI_PROVIDER')
})

test('plugin bar renders all catalog plugins with actions', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 700 })
  await stubBridge(page)
  await page.goto('/')
  await expect(page.locator('ot-app-shell')).toBeVisible()
  await expect(page.locator('ot-plugin-bar .plugin')).toHaveCount(4)
  await expect(page.locator('ot-plugin-bar')).toContainText('gojira')

  // The Manual/Auto mode in the composer and the Settings checkbox share one
  // state: choosing Auto in the composer flips the Settings checkbox.
  await expect(page.locator('ot-mode-menu .mode-btn')).toContainText('Manual')
  await page.locator('ot-mode-menu .mode-btn').click()
  await page.locator('ot-mode-menu .option').nth(1).click()
  await expect(page.locator('ot-mode-menu .mode-btn')).toContainText('Auto')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByLabel('Apply rig automatically')).toBeChecked()
})