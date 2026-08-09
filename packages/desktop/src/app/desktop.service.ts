/**
 * The renderer's single bridge to the desktop process. This is the only module
 * that reads `window.api` (see `opentimbre-electron-ipc`); every component
 * reads the readonly signals or calls these methods, and never touches the
 * bridge directly (see `opentimbre-angular-ui`).
 *
 * Push channels (`onChatStatus`, `onThemeChanged`, `onPluginChanged`,
 * `onUpdaterStatus`) are converted into signals here; each subscription is
 * unsubscribed on destroy.
 * Locale is forwarded to `I18nService` so catalog rendering follows the state
 * the main process owns.
 */
import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core'
import type {
  AppliedScene,
  AppState,
  ChatStatus,
  DesktopApi,
  Guitar,
  KeyInfo,
  MessageWithCards,
  ModelInfo,
  OpenConversation,
  PluginState,
  ProviderId,
  ProviderPreference,
  ResolvedTheme,
  Summary,
  Theme,
  UpdaterStatus,
} from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'
import { I18nService } from './i18n.service'

/** The `ai` slice of `AppState`, named so the service surface reads cleanly. */
type AiState = {
  provider: string
  label: string
  model: string
  available: { provider: string; providerLabel: string; id: string }[]
}

/** Injectable handle to the preload bridge; defaults to `window.api`. */
export const DESKTOP_API = new InjectionToken<DesktopApi>('DesktopApi', {
  factory: () => window.api,
})

@Injectable({ providedIn: 'root' })
export class DesktopService {
  private readonly api = inject(DESKTOP_API)
  private readonly i18n = inject(I18nService)
  private readonly destroyRef = inject(DestroyRef)

  // -- state signals --------------------------------------------------------

  /** True once `getState()` resolved; the shell shows loading until then. */
  readonly ready = signal(false)
  /** Set when `getState()` failed, so the shell can show a degraded state. */
  readonly loadError = signal<string | null>(null)

  readonly version = signal('')
  readonly locale = signal<Locale>('en')
  readonly themeChosen = signal<Theme>('system')
  readonly resolvedTheme = signal<ResolvedTheme>('dark')
  readonly midi = signal<{ port: string | null; error: string | null }>({ port: null, error: null })
  readonly ai = signal<AiState | null>(null)
  readonly aiError = signal<string | null>(null)
  readonly guitar = signal<Guitar | null>(null)
  readonly alwaysOnTop = signal(false)
  readonly dimOnUnfocus = signal(false)
  readonly autoApply = signal(false)
  readonly keys = signal<KeyInfo[]>([])
  readonly keysError = signal<string | null>(null)
  readonly providerPreference = signal<ProviderPreference>('auto')
  readonly forcedProvider = signal<string | null>(null)
  readonly pluginIds = signal<string[]>([])
  /** Models available from every provider with a key, for the composer picker. */
  readonly models = signal<ModelInfo[]>([])
  /** Set when `ai:listModels` failed, so the picker can show a degraded state. */
  readonly modelsError = signal<string | null>(null)

  readonly chatStatus = signal<ChatStatus>(null)
  readonly conversations = signal<Summary[]>([])
  readonly currentConversation = signal<OpenConversation | null>(null)
  readonly pluginStates = signal<Record<string, PluginState>>({})

  /** The last `updater:status` push; `null` until main announces something. */
  readonly updaterStatus = signal<UpdaterStatus | null>(null)
  /** Renderer-only dismissal: hides the banner until the window reloads. */
  readonly updaterDismissed = signal(false)

  /** The visible transcript of the open conversation, kept in the service. */
  readonly transcript = signal<MessageWithCards[]>([])
  /** True while a provider call is in flight, so the composer stops duplicate sends. */
  readonly busy = signal(false)
  /** The composer draft, shared so the chat empty-state chips can fill it. */
  readonly draft = signal('')

  /** Loads AppState and subscribes to push channels. Call once at startup. */
  load(): void {
    const result = this.api.getState()
    void result.then((state) => {
      if ('error' in state) {
        this.loadError.set(state.error)
        this.ready.set(true)
        return
      }
      this.applyState(state)
      this.ready.set(true)
    })

    this.destroyRef.onDestroy(this.api.onChatStatus((status) => this.chatStatus.set(status)))
    this.destroyRef.onDestroy(this.api.onThemeChanged((theme) => this.resolvedTheme.set(theme)))
    this.destroyRef.onDestroy(
      this.api.onPluginChanged((state) => this.pluginStates.set({ ...this.pluginStates(), [state.id]: state })),
    )
    this.destroyRef.onDestroy(this.api.onUpdaterStatus((status) => this.updaterStatus.set(status)))
  }

  private applyState(state: AppState): void {
    this.version.set(state.version)
    this.locale.set(state.locale)
    this.i18n.setLocale(state.locale)
    this.themeChosen.set(state.theme.chosen)
    this.resolvedTheme.set(state.theme.resolved)
    this.midi.set(state.midi)
    this.ai.set(state.ai)
    this.aiError.set(state.aiError)
    this.guitar.set(state.guitar)
    this.alwaysOnTop.set(state.alwaysOnTop)
    this.dimOnUnfocus.set(state.dimOnUnfocus)
    this.autoApply.set(state.autoApply)
    this.keys.set(state.keys)
    this.keysError.set(state.keysError)
    this.providerPreference.set(state.providerPreference)
    this.forcedProvider.set(state.forcedProvider)
    this.pluginIds.set(state.pluginIds)
  }

  // -- request/response actions ---------------------------------------------

  async sendChat(text: string): Promise<void> {
    if (this.busy()) return
    this.busy.set(true)
    this.transcript.update((msgs) => [...msgs, { role: 'user', text }])
    try {
      const result = await this.api.sendChat(text)
      if ('error' in result) {
        this.transcript.update((msgs) => [...msgs, { role: 'error', text: result.error }])
        return
      }
      this.transcript.update((msgs) => [
        ...msgs,
        result.rig ? { role: 'ai', text: result.text, rig: result.rig, cards: result.cards ?? undefined } : { role: 'ai', text: result.text },
      ])
    } finally {
      this.busy.set(false)
    }
  }

  async newChat(): Promise<void> {
    await this.api.newChat()
    this.transcript.set([])
    this.currentConversation.set(null)
  }

  async applyRig(scene: string): Promise<AppliedScene | undefined> {
    const result = await this.api.applyRig(scene)
    return 'error' in result ? undefined : result
  }

  async setTheme(theme: Theme): Promise<void> {
    this.applyResult(await this.api.setTheme(theme))
  }

  async setLocale(locale: Locale): Promise<void> {
    this.applyResult(await this.api.setLocale(locale))
  }

  async setDimOnUnfocus(value: boolean): Promise<void> {
    this.dimOnUnfocus.set(value)
    await this.api.setDimOnUnfocus(value)
  }

  async toggleAlwaysOnTop(): Promise<void> {
    this.alwaysOnTop.set(!this.alwaysOnTop())
    await this.api.toggleAlwaysOnTop()
  }

  async setAutoApply(value: boolean): Promise<void> {
    this.autoApply.set(value)
    await this.api.setAutoApply(value)
  }

  async listConversations(): Promise<void> {
    const result = await this.api.listConversations()
    if (!('error' in result)) this.conversations.set(result)
  }

  async openConversation(id: string): Promise<void> {
    const result = await this.api.openConversation(id)
    if ('error' in result) return
    this.currentConversation.set(result)
    this.transcript.set(result.messages)
  }

  async deleteConversation(id: string): Promise<void> {
    const result = await this.api.deleteConversation(id)
    if ('error' in result) return
    this.conversations.set(result)
    if (this.currentConversation()?.id === id) {
      this.currentConversation.set(null)
      this.transcript.set([])
    }
  }

  async getPluginState(id: string): Promise<void> {
    const result = await this.api.getPluginState(id)
    if ('error' in result) return
    this.pluginStates.set({ ...this.pluginStates(), [result.id]: result })
  }

  async openPlugin(id: string): Promise<void> {
    const result = await this.api.openPlugin(id)
    if (!('error' in result)) this.pluginStates.set({ ...this.pluginStates(), [result.id]: result })
  }

  async installMapping(id: string): Promise<void> {
    const result = await this.api.installMapping(id)
    if (!('error' in result)) this.pluginStates.set({ ...this.pluginStates(), [result.id]: result })
  }

  /** Confirms the update download; errors surface via the `updater:status` push. */
  async downloadUpdate(): Promise<void> {
    await this.api.downloadUpdate()
  }

  async installUpdate(): Promise<void> {
    await this.api.installUpdate()
  }

  /** Hides the banner for this session only; the next startup re-notifies. */
  dismissUpdate(): void {
    this.updaterDismissed.set(true)
  }

  async setGuitar(guitar: Guitar): Promise<void> {
    this.applyResult(await this.api.setGuitar(guitar))
  }

  async setModel(provider: string, id: string): Promise<void> {
    this.applyResult(await this.api.setModel(provider as ProviderId, id))
  }

  /** Loads every provider's models into the `models` signal; a failure degrades gracefully. */
  async listModels(): Promise<void> {
    const result = await this.api.listModels()
    if ('error' in result) {
      this.modelsError.set(result.error)
      this.models.set([])
      return
    }
    this.modelsError.set(null)
    this.models.set(result)
  }

  async saveKey(provider: string, key: string): Promise<void> {
    const result = await this.api.saveKey(provider as ProviderId, key)
    if ('error' in result) {
      this.keysError.set(result.error)
      return
    }
    this.keysError.set(null)
    this.applyState(result)
  }

  async removeKey(provider: string): Promise<void> {
    const result = await this.api.removeKey(provider as ProviderId)
    if ('error' in result) {
      this.keysError.set(result.error)
      return
    }
    this.keysError.set(null)
    this.applyState(result)
  }

  async setProviderPreference(preference: ProviderPreference): Promise<void> {
    this.applyResult(await this.api.setProviderPreference(preference))
  }

  private applyResult(result: AppState | { error: string }): void {
    if (!('error' in result)) this.applyState(result)
  }
}