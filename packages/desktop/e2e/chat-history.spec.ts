import { expect, test, type Page } from '@playwright/test'

/**
 * Real-browser proof of the chat and history workflows at both ratified
 * viewports: a turn renders user + AI prose + a rig card, the apply button
 * works, the composer disables during a busy provider call, an error becomes a
 * red row, a resumed conversation shows the memory-loss banner, and delete uses
 * an accessible in-renderer confirmation. The bridge is a stubbed
 * `window.api` injected before the app boots, so this exercises the real shell.
 */

const VIEWPORTS = [
  { width: 420, height: 700 },
  { width: 360, height: 520 },
]

const RIG = {
  plugin: 'gojira',
  song: 'Song',
  artist: 'Artist',
  amp: 'Rust',
  note: 'Two tones',
  scenes: {
    base: {
      title: 'Base',
      summary: 'a riff base',
      explanation: 'low gain, palm-muted',
      guitar: { pickupPosition: 'bridge', volume: 8, tone: 5, technique: 'palm mute' },
      params: {},
    },
    solo: {
      title: 'Solo',
      summary: 'lead',
      explanation: 'boosted mids',
      guitar: { pickupPosition: 'neck', volume: 9, tone: 6, technique: 'legato' },
      params: {},
    },
  },
}

const CARDS = {
  base: { values: [{ label: 'Gain', value: '6' }], pedals: [{ name: 'Boost', detail: '' }] },
  solo: { values: [{ label: 'Gain', value: '8' }], pedals: [] },
}

async function stubBridge(page: Page, opts: { busy?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ({ busy, rig, cards }) => {
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
        sendChat: async (text: string) => {
          if (busy) await new Promise((r) => setTimeout(r, 2000))
          if (text === 'fail') return { error: 'The AI couldn\'t answer.' }
          return { text: 'Try this tone.', rig, cards }
        },
        newChat: async () => undefined,
        applyRig: async () => ({ scene: 'base', amp: 'Rust', ccsSent: 3, ms: 12, warnings: [] }),
        setGuitar: async () => state,
        setModel: async () => state,
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
        listConversations: async () => [
          { id: 'c1', title: 'Tone hunt', updatedAt: 'now', turns: 3 },
          { id: 'c2', title: 'Metal', updatedAt: 'earlier', turns: 1 },
        ],
        openConversation: async (id: string) => ({
          id,
          title: 'Tone hunt',
          messages: [
            { role: 'user', text: 'make it heavy' },
            { role: 'ai', text: 'Try this.', rig, cards },
          ],
          plugin: 'gojira',
          memoryLost: id === 'c2',
        }),
        deleteConversation: async () => [{ id: 'c2', title: 'Metal', updatedAt: 'earlier', turns: 1 }],
        onChatStatus: () => () => undefined,
        onThemeChanged: () => () => undefined,
        onPluginChanged: () => () => undefined,
        downloadUpdate: async () => undefined,
        installUpdate: async () => undefined,
        onUpdaterStatus: () => () => undefined,
      }
    },
    { busy: opts.busy ?? false, rig: RIG, cards: CARDS },
  )
}

async function openShell(page: Page, opts?: { busy?: boolean }): Promise<void> {
  await stubBridge(page, opts)
  await page.goto('/')
  await expect(page.locator('ot-app-shell')).toBeVisible()
}

for (const viewport of VIEWPORTS) {
  test(`chat turn, card, and apply at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openShell(page)

    // Empty state first.
    await expect(page.locator('ot-chat-pane')).toContainText('Describe a tone to begin.')

    // Send a turn: user bubble + AI prose + rig card.
    await page.locator('ot-composer textarea').fill('make it heavy')
    await page.locator('ot-composer .send').click()
    await expect(page.locator('ot-chat-pane')).toContainText('Try this tone.')
    await expect(page.locator('ot-chat-pane')).toContainText('make it heavy')
    await expect(page.locator('ot-rig-card')).toBeVisible()
    await expect(page.locator('ot-rig-card')).toContainText('Base')
    await expect(page.locator('ot-rig-card')).toContainText('Gain')

    // Expand a card body.
    await page.locator('ot-rig-card .expand').first().click()
    await expect(page.locator('ot-chat-pane')).toContainText('low gain, palm-muted')

    // Apply a scene.
    await page.locator('ot-rig-card .apply').first().click()
    await expect(page.locator('ot-rig-card .apply').first()).toContainText('Applied')

    // No horizontal overflow with two cards rendered.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })

  test(`error row, memory-loss, and delete at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openShell(page)

    // An error becomes a red row, not a crash.
    await page.locator('ot-composer textarea').fill('fail')
    await page.locator('ot-composer .send').click()
    await expect(page.locator('ot-chat-pane')).toContainText("The AI couldn't answer.")

    // History: open a conversation with memory loss.
    await page.getByRole('tab', { name: 'History' }).click()
    await expect(page.locator('ot-history-pane')).toContainText('Tone hunt')
    await page.locator('ot-history-pane .row').nth(1).click()
    await expect(page.locator('ot-chat-pane')).toContainText('Try this.')
    await expect(page.locator('ot-chat-pane')).toContainText('history couldn')
    // The chat pane is still mounted under the history tab, so switch back.
    await page.getByRole('tab', { name: 'Chat' }).click()
    await expect(page.locator('ot-chat-pane')).toContainText('Try this.')

    // Delete uses an accessible confirmation.
    await page.getByRole('tab', { name: 'History' }).click()
    await page.locator('ot-history-pane .del').first().click()
    await expect(page.locator('ot-history-pane')).toContainText('Delete this conversation?')
    await page.locator('ot-history-pane .danger').click()
    await expect(page.locator('ot-history-pane')).toContainText('Metal')
    await expect(page.locator('ot-history-pane')).not.toContainText('Tone hunt')
  })
}

test('composer disables while a provider call is busy', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 700 })
  await openShell(page, { busy: true })
  await page.locator('ot-composer textarea').fill('slow response')
  const send = page.locator('ot-composer .send')
  await send.click()
  // While the call is in flight the composer is disabled (no duplicate sends).
  await send.click({ force: true })
  await expect(send).toBeDisabled()
  // The transcript holds exactly one user turn.
  await expect(page.locator('ot-chat-pane .row.user')).toHaveCount(1)
})