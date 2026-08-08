/**
 * A small in-memory `DesktopApi` for renderer tests and the browser e2e.
 * Components hold no domain rules and never touch `window.api`
 * (see `opentimbre-angular-ui`), so the fake is a plain object with signals:
 * it records calls and lets a test fire a push event. No Electron is faked.
 */
import type {
  AppState,
  ChatStatus,
  DesktopApi,
  Guitar,
  PluginState,
  ProviderId,
  ProviderPreference,
  ResolvedTheme,
  Turn,
  UpdaterStatus,
} from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'

export const DEFAULT_GUITAR: Guitar = {
  model: 'Default guitar',
  pickups: 'humbucker',
  tuning: 'E standard',
  strings: 6,
}

export function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    locale: 'en',
    midi: { port: 'Virtual Port', error: null },
    ai: { provider: 'openai', label: 'OpenAI', model: 'gpt-4o', available: [] },
    aiError: null,
    guitar: DEFAULT_GUITAR,
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
    version: '0.0.0',
    ...overrides,
  }
}

export type FakeDesktopApi = DesktopApi & {
  /** Fires the `chat:status` push, as the real main process would. */
  pushChatStatus(status: ChatStatus): void
  /** Fires the `window:themeChanged` push. */
  pushThemeChanged(theme: ResolvedTheme): void
  /** Fires the `plugin:changed` push. */
  pushPluginChanged(state: PluginState): void
  /** Fires the `updater:status` push. */
  pushUpdaterStatus(status: UpdaterStatus): void
  calls: {
    getState: number
    sendChat: string[]
    applyRig: string[]
    deleteConversation: string[]
    setTheme: string[]
    setLocale: string[]
    setGuitar: Guitar[]
    setModel: [string, string][]
    saveKey: [string, string][]
    removeKey: string[]
    setProviderPreference: string[]
    getPluginState: string[]
    downloadUpdate: number
    installUpdate: number
  }
}

export function createFakeDesktopApi(state: AppState = makeAppState()): FakeDesktopApi {
  const chatStatusListeners = new Set<(s: ChatStatus) => void>()
  const themeListeners = new Set<(t: ResolvedTheme) => void>()
  const pluginListeners = new Set<(s: PluginState) => void>()
  const updaterListeners = new Set<(s: UpdaterStatus) => void>()
  let current = state

  const fake: FakeDesktopApi = {
    calls: { getState: 0, sendChat: [], applyRig: [], deleteConversation: [], setTheme: [], setLocale: [], setGuitar: [], setModel: [], saveKey: [], removeKey: [], setProviderPreference: [], getPluginState: [], downloadUpdate: 0, installUpdate: 0 },

    getState: async () => {
      fake.calls.getState += 1
      return current
    },

    sendChat: async (text: string) => {
      fake.calls.sendChat.push(text)
      const turn: Turn = { text, rig: null, cards: null }
      return turn
    },

    newChat: async () => undefined,
    applyRig: async (scene: string) => {
      fake.calls.applyRig.push(scene)
      return { scene, amp: 'Rust', ccsSent: 3, ms: 12, warnings: [] }
    },
    setGuitar: async (guitar: Guitar) => {
      fake.calls.setGuitar.push(guitar)
      return state
    },
    setModel: async (provider: string, id: string) => {
      fake.calls.setModel.push([provider, id])
      return state
    },

    getPluginState: async (id: string) => {
      fake.calls.getPluginState.push(id)
      return {
        id,
        name: 'Gojira',
        installed: false,
        path: null,
        running: false,
        mappingStatus: 'missing',
      }
    },
    openPlugin: async () => plugins(),
    installMapping: async () => plugins(),

    toggleAlwaysOnTop: async () => true,
    setDimOnUnfocus: async () => true,
    setAutoApply: async () => true,

    downloadUpdate: async () => {
      fake.calls.downloadUpdate += 1
    },
    installUpdate: async () => {
      fake.calls.installUpdate += 1
    },

    setTheme: async (theme: 'system' | 'light' | 'dark') => {
      fake.calls.setTheme.push(theme)
      current = makeAppState({ ...current, theme: { chosen: theme, resolved: theme === 'system' ? 'dark' : theme } })
      return current
    },

    setLocale: async (locale: Locale) => {
      fake.calls.setLocale.push(locale)
      current = makeAppState({ ...current, locale })
      return current
    },

    saveKey: async (provider: string, key: string) => {
      fake.calls.saveKey.push([provider, key])
      return state
    },
    removeKey: async (provider: string) => {
      fake.calls.removeKey.push(provider)
      return state
    },
    setProviderPreference: async (preference: string) => {
      fake.calls.setProviderPreference.push(preference)
      return state
    },

    listConversations: async () => [],
    openConversation: async () => ({ id: 'c1', title: 'Tone hunt', messages: [], plugin: null, memoryLost: false }),
    deleteConversation: async (id: string) => {
      fake.calls.deleteConversation.push(id)
      return []
    },

    onChatStatus: (cb) => {
      chatStatusListeners.add(cb)
      return () => chatStatusListeners.delete(cb)
    },
    onThemeChanged: (cb) => {
      themeListeners.add(cb)
      return () => themeListeners.delete(cb)
    },
    onPluginChanged: (cb) => {
      pluginListeners.add(cb)
      return () => pluginListeners.delete(cb)
    },
    onUpdaterStatus: (cb) => {
      updaterListeners.add(cb)
      return () => updaterListeners.delete(cb)
    },

    pushChatStatus: (status) => chatStatusListeners.forEach((cb) => cb(status)),
    pushThemeChanged: (theme) => themeListeners.forEach((cb) => cb(theme)),
    pushPluginChanged: (p) => pluginListeners.forEach((cb) => cb(p)),
    pushUpdaterStatus: (status) => updaterListeners.forEach((cb) => cb(status)),
  }

  function plugins(): PluginState {
    return { id: 'gojira', name: 'Gojira', installed: false, path: null, running: false, mappingStatus: 'missing' }
  }

  return fake
}

export type { ProviderId, ProviderPreference }