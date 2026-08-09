/**
 * The request/response and push-event contract between the Electron main
 * process and the Angular renderer.
 *
 * Type-only: erased at compile time, so main, preload, and renderer can share
 * one definition of the wire shape without the renderer pulling in anything
 * that only runs in Node (`@opentimbre/core`, which main calls into and the
 * renderer never does). Phase 3 wires the actual `ipcMain.handle` /
 * `contextBridge` calls against `IpcChannels` and `IpcEvents` — this file
 * only fixes the shape everyone agrees on, per `opentimbre-electron-ipc`.
 *
 * Ported from legacy's `desktop/ipc.ts` and `desktop/preload.cts`. Identifiers
 * are translated to English per `opentimbre-code-style`; the `domain:action`
 * channel-naming convention is kept, channel names translated the same way
 * (`chat:enviar` -> `chat:send`).
 *
 * The domain shapes below (`Guitar`, `Rig`, `AppState`, ...) are local to this
 * package on purpose: `@opentimbre/core` doesn't exist yet at this point in
 * the plan (Task 3+), and even once it does, this package must stay free of
 * runtime imports (see the module doc's oracle: `tsc --noEmit` clean, no
 * runtime import anywhere in `contracts/src/`). They mirror core's eventual
 * types closely enough to be useful now; reconciling the two is a Phase 3
 * concern, not this one.
 */

// ------------------------------------------------------------- domain shapes

import type { Locale } from '@opentimbre/i18n'

export type ProviderId = 'anthropic' | 'openai'

/** `auto` means no explicit choice saved — `provider.ts`'s default order applies. */
export type ProviderPreference = 'auto' | ProviderId

export type Theme = 'system' | 'light' | 'dark'
/** `system` already resolved to one of the two — what the screen actually paints. */
export type ResolvedTheme = 'light' | 'dark'

export type Guitar = {
  model: string
  pickups: 'single' | 'humbucker' | 'HSS' | 'HSH' | 'P90' | 'other'
  tuning: string
  strings: number
}
export type GuitarUsage = {
  pickupPosition: string
  volume: number
  tone: number
  technique: string
}

/** A scene's plugin parameters: knob values, toggles, and select choices. */
export type Scene = Record<string, number | boolean | string>

export type DetailedScene = {
  title: string
  summary: string
  explanation: string
  guitar: GuitarUsage
  params: Scene
}

export type Rig = {
  plugin: string
  song: string
  artist: string
  amp: string
  note: string
  scenes: Record<string, DetailedScene>
}

export type DisplayedValue = { readonly label: string; readonly value: string }
export type DisplayedPedal = { readonly name: string; readonly detail: string }
export type SceneCard = {
  readonly values: readonly DisplayedValue[]
  readonly pedals: readonly DisplayedPedal[]
}
/** One card per scene, keyed the same as `Rig.scenes`. */
export type Cards = Record<string, SceneCard>

export type Turn = { text: string; rig: Rig | null; cards: Cards | null }

/**
 * What `chat:send` actually returns: a `Turn` plus the persistence-layer facts
 * the renderer needs but core's `RigChat` doesn't know about — which
 * conversation this landed in, and the scene Auto mode already applied (if
 * any), so the UI can confirm it without a manual click.
 */
export type SentTurn = Turn & { conversationId: string; autoApplied: AppliedScene | null }

export type Role = 'user' | 'ai' | 'error'
export type Message = { role: Role; text: string; rig?: Rig }
export type MessageWithCards = Message & { cards?: Cards }

export type OpenConversation = {
  id: string
  title: string
  messages: MessageWithCards[]
  /** Plugin of the conversation's last rig, or `null` if it never produced one. */
  plugin: string | null
  /** `true` when the saved history couldn't be reused (other provider, older format). */
  memoryLost: boolean
}

export type Summary = {
  id: string
  title: string
  updatedAt: string
  turns: number
  /** Plugin of the conversation's last rig, or `null` if it never produced one. */
  plugin: string | null
}

export type AppliedScene = {
  scene: string
  amp: string
  ccsSent: number
  ms: number
  /** Unmapped-amp warning and `manual`-strategy instructions. */
  warnings: string[]
}

export type PluginState = {
  id: string
  name: string
  installed: boolean
  path: string | null
  running: boolean
  mappingStatus: 'ok' | 'outdated' | 'missing'
}

/** What the Settings screen shows about a key — never the key itself. */
export type KeyInfo = {
  provider: ProviderId
  label: string
  /** Equivalent env var, for whoever prefers to keep using `.env`. */
  env: string
  source: 'app' | 'environment' | 'none'
  /** `sk-ant-...9f3a` — enough to recognize, not enough to use. */
  hint: string | null
  updatedAt: string | null
  /** `true` when the row is encrypted with this OS account's vault. */
  protected: boolean
  /** `false` when a row exists but can't be opened (copied DB, different account). */
  readable: boolean
}

/**
 * A model available from *any* provider with a valid key, not just the active
 * one. `releasedAt` is a Unix-ms timestamp — 0 when the provider's API didn't
 * report one — used to sort the newest models first.
 */
export type AvailableModel = { provider: ProviderId; providerLabel: string; id: string; releasedAt: number }

/** Coarse cost bucket derived from the model id — neither provider returns pricing. */
export type ModelTier = 'low' | 'mid' | 'high'

/** One entry in the model picker, with a display label and a cost tier. */
export type ModelInfo = { provider: ProviderId; id: string; label: string; tier: ModelTier }

export type AppState = {
  locale: Locale
  midi: { port: string | null; error: string | null }
  ai: { provider: ProviderId; label: string; model: string; modelLabel: string; available: AvailableModel[] } | null
  aiError: string | null
  guitar: Guitar
  alwaysOnTop: boolean
  dimOnUnfocus: boolean
  /** Applies alone when the AI responds with a single-scene suggestion. */
  autoApply: boolean
  theme: { chosen: Theme; resolved: ResolvedTheme }
  /** One entry per catalog provider, always — including ones with no key saved. */
  keys: KeyInfo[]
  /** Unreadable key store. The screen warns and continues; `.env` still works. */
  keysError: string | null
  providerPreference: ProviderPreference
  /** `AI_PROVIDER` from the environment, when present it overrides the window's preference. */
  forcedProvider: string | null
  /** Placeholder hint for the settings screen; the key path is never shown. */
  keysStorePath: string
  /** Catalog plugin ids in registry order, for the plugin bar to render. */
  pluginIds: string[]
  version: string
}

/**
 * No handler rejects: a network or validation error becomes a red message in
 * chat, not a broken promise that would bring the window down.
 */
export type Failure = { error: string }
export type Result<T> = T | Failure

/** Call phase, for the status pill. `null` clears the pill. */
export type ChatStatus = 'querying' | 'validating' | 'correcting' | null

/**
 * One update lifecycle state at a time, pushed main -> renderer as
 * `updater:status`. `error` carries a short displayable message only —
 * never paths, stack traces, or credentials.
 */
export type UpdaterStatus =
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

// --------------------------------------------------------------- channel map

/**
 * Request/response channels. `payload` is what the renderer passes to
 * `invoke`; multi-argument channels use a labeled tuple so Phase 3's preload
 * methods keep readable parameter names.
 */
export type IpcChannels = {
  'app:state': { payload: void; result: Result<AppState> }
  'chat:send': { payload: string; result: Result<SentTurn> }
  'chat:new': { payload: void; result: Result<void> }
  'rig:apply': { payload: string; result: Result<AppliedScene> }
  'config:guitar': { payload: Guitar; result: Result<AppState> }
  'ai:model': { payload: [provider: ProviderId, id: string]; result: Result<AppState> }
  'ai:listModels': { payload: void; result: Result<ModelInfo[]> }
  'plugin:state': { payload: string; result: Result<PluginState> }
  'plugin:open': { payload: string; result: Result<PluginState> }
  'plugin:installMapping': { payload: string; result: Result<PluginState> }
  'window:alwaysOnTop': { payload: void; result: Result<boolean> }
  'window:dimOnUnfocus': { payload: boolean; result: Result<boolean> }
  'window:autoApply': { payload: boolean; result: Result<boolean> }
  'window:setTheme': { payload: Theme; result: Result<AppState> }
  'window:setLocale': { payload: Locale; result: Result<AppState> }
  /** The plaintext key goes up once and never comes back — the screen only ever gets the hint. */
  'keys:save': { payload: [provider: ProviderId, key: string]; result: Result<AppState> }
  'keys:remove': { payload: ProviderId; result: Result<AppState> }
  'ai:providerPreference': { payload: ProviderPreference; result: Result<AppState> }
  'conversations:list': { payload: void; result: Result<Summary[]> }
  'conversations:open': { payload: string; result: Result<OpenConversation> }
  'conversations:delete': { payload: string; result: Result<Summary[]> }
  /** Void payloads — no Zod schema, mirrors `app:state`. */
  'updater:download': { payload: void; result: Result<void> }
  'updater:install': { payload: void; result: Result<void> }
}

/**
 * Main -> renderer notifications. Push channels aren't request/response, so
 * they get their own map: event name -> the payload the renderer's callback
 * receives. Per `opentimbre-electron-ipc`, the preload wraps each in a
 * registration function (`onX(cb)`) rather than exposing `ipcRenderer.on`
 * directly — that wiring is Phase 3's job; this only fixes the payload shape.
 */
export type IpcEvents = {
  'chat:status': ChatStatus
  'window:themeChanged': ResolvedTheme
  'plugin:changed': PluginState
  'updater:status': UpdaterStatus
}

export type DesktopApi = {
  getState(): Promise<Result<AppState>>
  sendChat(text: string): Promise<Result<SentTurn>>
  newChat(): Promise<Result<void>>
  applyRig(scene: string): Promise<Result<AppliedScene>>
  setGuitar(guitar: Guitar): Promise<Result<AppState>>
  setModel(provider: ProviderId, id: string): Promise<Result<AppState>>
  listModels(): Promise<Result<ModelInfo[]>>
  getPluginState(id: string): Promise<Result<PluginState>>
  openPlugin(id: string): Promise<Result<PluginState>>
  installMapping(id: string): Promise<Result<PluginState>>
  toggleAlwaysOnTop(): Promise<Result<boolean>>
  setDimOnUnfocus(value: boolean): Promise<Result<boolean>>
  setAutoApply(value: boolean): Promise<Result<boolean>>
  setTheme(theme: Theme): Promise<Result<AppState>>
  setLocale(locale: Locale): Promise<Result<AppState>>
  saveKey(provider: ProviderId, key: string): Promise<Result<AppState>>
  removeKey(provider: ProviderId): Promise<Result<AppState>>
  setProviderPreference(preference: ProviderPreference): Promise<Result<AppState>>
  listConversations(): Promise<Result<Summary[]>>
  openConversation(id: string): Promise<Result<OpenConversation>>
  deleteConversation(id: string): Promise<Result<Summary[]>>
  onChatStatus(callback: (status: ChatStatus) => void): () => void
  onThemeChanged(callback: (theme: ResolvedTheme) => void): () => void
  onPluginChanged(callback: (state: PluginState) => void): () => void
  downloadUpdate(): Promise<Result<void>>
  installUpdate(): Promise<Result<void>>
  onUpdaterStatus(callback: (status: UpdaterStatus) => void): () => void
}
