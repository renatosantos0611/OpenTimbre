/**
 * Registers all IPC handlers for the desktop renderer. Every handler returns
 * the contract's camelCase `Result<T>` — an `AppState` on success or a
 * localized `{ error }` — never the legacy `{ok,data,status}` envelope (see
 * `opentimbre-electron-ipc`).
 *
 * Settings and keys delegate to the injected store and the core key-store;
 * plugin and rig operations delegate to the injected PluginManager and
 * SceneApplier; chat/conversation operations delegate to the injected
 * ChatController.
 */
import { ipcMain } from '../electron.ts'
import type { IpcMainInvokeEvent } from 'electron'
import { list as listKeys, remove as removeKey, save as saveKey } from '@opentimbre/core/src/secrets/key-store.ts'
import { assertTrustedSender } from '../security.ts'
import { APP_ORIGIN } from '../window.ts'
import type { DesktopStore } from '../storage/desktop-store.ts'
import type { PluginManager } from '../plugins/plugin-manager.ts'
import type { SceneApplier } from '../rig/scene-applier.ts'
import type { ChatController } from '../chat/chat-controller.ts'
import type { Updater } from '../updater/updater.ts'
import { buildAppState, type AiState } from './app-state.ts'
import { validatePayload } from './validation.ts'

type Deps = {
  store: DesktopStore
  plugins: PluginManager
  applier: SceneApplier
  chat: ChatController
  updater: Updater
  send: (channel: string, payload: unknown) => void
  getAi: () => AiState | null
  getGuitar: () => import('@opentimbre/contracts').Guitar
  getLocale: () => import('@opentimbre/i18n').Locale
  systemDark: boolean
  setAlwaysOnTop: (onTop: boolean) => void
  version: string
}

function appState(deps: Deps): import('@opentimbre/contracts').AppState {
  return buildAppState({
    store: deps.store,
    listKeys,
    getGuitar: deps.getGuitar,
    getLocale: deps.getLocale,
    ai: deps.getAi(),
    systemDark: deps.systemDark,
    version: deps.version,
  })
}

const failure = (message: string): { error: string } => ({ error: message })

/**
 * Every handler checks the sender before doing work. A request from outside
 * the app origin never reaches a side effect (see `opentimbre-electron-ipc`).
 */
function trusted(event: IpcMainInvokeEvent): void {
  assertTrustedSender({ url: event.senderFrame?.url ?? '' }, APP_ORIGIN)
}
export function registerIpcHandlers(deps: Deps): void {
  // ── State / config ───────────────────────────────────────

  ipcMain.handle('app:state', (event) => {
    try {
      trusted(event)
      return appState(deps)
    } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('config:guitar', (event, guitar) => {
    try {
      trusted(event)
      deps.store.set('guitar', JSON.stringify(validatePayload('config:guitar', guitar)))
      return appState(deps)
    } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('ai:model', (event, payload) => {
    try {
      trusted(event)
      const [provider, id] = validatePayload('ai:model', payload) as [string, string]
      deps.store.set('model_id', id)
      deps.store.set('provider_id', provider)
      return appState(deps)
    } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('window:setTheme', (event, theme) => {
    try { trusted(event); deps.store.set('theme', validatePayload('window:setTheme', theme) as string); return appState(deps) } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('window:setLocale', (event, locale) => {
    try { trusted(event); deps.store.set('locale', validatePayload('window:setLocale', locale) as string); return appState(deps) } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('window:alwaysOnTop', (event) => {
    try {
      trusted(event)
      const next = !deps.store.getBool('always_on_top')
      deps.store.setBool('always_on_top', next)
      deps.setAlwaysOnTop(next)
      return next
    } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('window:dimOnUnfocus', (event, value) => {
    try { trusted(event); const v = validatePayload('window:dimOnUnfocus', value) as boolean; deps.store.setBool('dim_on_unfocus', v); return v } catch (e) { return failure(String(e)) }
  })

  ipcMain.handle('window:autoApply', (event, value) => {
    try { trusted(event); const v = validatePayload('window:autoApply', value) as boolean; deps.store.setBool('auto_apply', v); return v } catch (e) { return failure(String(e)) }
  })

  // ── Keys ─────────────────────────────────────────────────
  // Plaintext keys cross IPC exactly once, renderer→main, in `keys:save`.
  // The key-store encrypts immediately (safeStorage) and returns only KeyInfo;
  // no plaintext ever travels main→renderer or enters logs (opentimbre-secrets).

  ipcMain.handle('keys:save', (event, payload) => {
    try {
      trusted(event)
      const [provider, key] = validatePayload('keys:save', payload) as [string, string]
      saveKey(provider as Parameters<typeof saveKey>[0], key)
      return appState(deps)
    } catch (e) {
      return failure(e instanceof Error ? e.message : String(e))
    }
  })

  ipcMain.handle('keys:remove', (event, provider) => {
    try {
      trusted(event)
      removeKey(validatePayload('keys:remove', provider) as Parameters<typeof removeKey>[0])
      return appState(deps)
    } catch (e) { return failure(String(e)) }
  })

  // ── Chat & conversation ───────────────────────────────────

  ipcMain.handle('chat:send', async (event, payload) => {
    try {
      trusted(event)
      return await deps.chat.send(validatePayload('chat:send', payload) as string)
    } catch (e) { return failure(String(e)) }
  })
  ipcMain.handle('chat:new', async (event) => {
    try {
      trusted(event)
      return await deps.chat.newChat()
    } catch (e) { return failure(String(e)) }
  })
  ipcMain.handle('conversations:list', async (event) => {
    try {
      trusted(event)
      return await deps.chat.list()
    } catch (e) { return failure(String(e)) }
  })
  ipcMain.handle('conversations:open', async (event, payload) => {
    try {
      trusted(event)
      return await deps.chat.open(validatePayload('conversations:open', payload) as string)
    } catch (e) { return failure(String(e)) }
  })
  ipcMain.handle('conversations:delete', async (event, payload) => {
    try {
      trusted(event)
      return await deps.chat.delete(validatePayload('conversations:delete', payload) as string)
    } catch (e) { return failure(String(e)) }
  })

  // ── Rig operations ────────────────────────────────────────

  ipcMain.handle('rig:apply', async (event, scene) => {
    try {
      trusted(event)
      return deps.applier.apply(validatePayload('rig:apply', scene) as string)
    } catch (e) { return failure(String(e)) }
  })

  // ── Plugin operations ─────────────────────────────────────

  ipcMain.handle('plugin:state', async (event, id) => {
    try {
      trusted(event)
      return deps.plugins.getState(validatePayload('plugin:state', id) as string)
    } catch (e) { return failure(String(e)) }
  })
  ipcMain.handle('plugin:open', async (event, id) => {
    try {
      trusted(event)
      return deps.plugins.open(validatePayload('plugin:open', id) as string)
    } catch (e) { return failure(String(e)) }
  })
  ipcMain.handle('plugin:installMapping', async (event, id) => {
    try {
      trusted(event)
      return deps.plugins.installMapping(validatePayload('plugin:installMapping', id) as string)
    } catch (e) { return failure(String(e)) }
  })

  // Push the changed plugin state to the renderer whenever the poller sees it move.
  deps.plugins.onChanged((state) => deps.send('plugin:changed', state))

  // ── AI preference ────────────────────────────────────────

  ipcMain.handle('ai:providerPreference', (event, pref) => {
    try { trusted(event); deps.store.set('provider_preference', validatePayload('ai:providerPreference', pref) as string); return appState(deps) } catch (e) { return failure(String(e)) }
  })

  // ── Updater ──────────────────────────────────────────────
  // Void payloads — no Zod schema, mirrors `app:state`. The confirm/install
  // decisions belong to the renderer; main only executes them for trusted
  // senders and streams progress back as `updater:status` events.

  ipcMain.handle('updater:download', async (event) => {
    try {
      trusted(event)
      await deps.updater.download()
      return {}
    } catch (e) { return failure(e instanceof Error ? e.message : String(e)) }
  })
  ipcMain.handle('updater:install', async (event) => {
    try {
      trusted(event)
      deps.updater.install()
      return {}
    } catch (e) { return failure(e instanceof Error ? e.message : String(e)) }
  })
}