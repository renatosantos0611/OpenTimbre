/**
 * Assembles the renderer's `AppState` in the main process. The IPC handlers
 * stay thin and return exactly the contract's camelCase shape — the legacy
 * `{ok,data,status}` envelope is gone (see `opentimbre-electron-ipc`).
 *
 * Settings come from the store, key rows from the core key-store (KeyInfo
 * only — hints and flags, never a plaintext key), and the catalog plugin ids
 * from `CATALOG` so the renderer never imports core. The `ai` slice (provider,
 * model, available models) is passed in by the caller, which owns the async
 * model-list fetch and caches it; this function stays synchronous.
 */
import type { AppState, AvailableModel, Guitar, KeyInfo, ProviderId, ProviderPreference, ResolvedTheme, Theme } from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import type { DesktopStore } from '../storage/desktop-store.ts'

const PROVIDER_LABELS: Record<ProviderId, string> = { openai: 'OpenAI', anthropic: 'Anthropic' }

/** Resolves `system` to the OS theme so the screen paints what the OS shows. */
export function resolveTheme(chosen: Theme, systemDark = false): ResolvedTheme {
  if (chosen === 'system') return systemDark ? 'dark' : 'light'
  return chosen
}

export type AiState = {
  provider: ProviderId
  label: string
  model: string
  modelLabel: string
  available: AvailableModel[]
}

export type AppStateDeps = {
  store: DesktopStore
  listKeys: () => KeyInfo[]
  getGuitar: () => Guitar
  getLocale: () => Locale
  ai: AiState | null
  midi: { port: string | null; error: string | null }
  systemDark: boolean
  version: string
}

export function buildAppState(deps: AppStateDeps): AppState {
  const { store } = deps
  const chosen = (store.get('theme') as Theme) || 'system'
  const ai = deps.ai
    ? { ...deps.ai, label: PROVIDER_LABELS[deps.ai.provider] ?? deps.ai.label }
    : null

  return {
    locale: deps.getLocale(),
    midi: deps.midi,
    ai,
    aiError: null,
    guitar: deps.getGuitar(),
    alwaysOnTop: store.getBool('always_on_top'),
    dimOnUnfocus: store.getBool('dim_on_unfocus'),
    autoApply: store.getBool('auto_apply'),
    theme: { chosen, resolved: resolveTheme(chosen, deps.systemDark) },
    keys: deps.listKeys(),
    keysError: null,
    providerPreference: (store.get('provider_preference') as ProviderPreference) || 'auto',
    forcedProvider: process.env['AI_PROVIDER'] ?? null,
    keysStorePath: store.get('keys_path'),
    pluginIds: CATALOG.map((c) => c.id),
    version: deps.version,
  }
}