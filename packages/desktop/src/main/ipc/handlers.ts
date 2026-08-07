/**
 * Registers all IPC handlers for the desktop renderer. Settings and keys
 * delegate to the injected store; chat/rig/plugin/conversation operations
 * return placeholder results until Tasks 6–7 implement their backends.
 */
import { ipcMain } from 'electron'
import type { DesktopStore } from '../storage/desktop-store.ts'

export type KeyCountFn = () => number

type Deps = {
  store: DesktopStore
}

function appState(deps: Deps): Record<string, unknown> {
  const s = deps.store
  return {
    git_sha: 'dev',
    midi: { port: null, error: null },
    ai: null,
    guitar: s.get('guitar'),
    model_id: s.get('model_id') ?? '',
    provider_id: '',
    provider_preference: s.get('provider_preference'),
    always_on_top: s.getBool('always_on_top'),
    dim_on_unfocus: s.getBool('dim_on_unfocus'),
    auto_apply: s.getBool('auto_apply'),
    theme: { chosen: s.get('theme') || 'system', resolved: s.get('theme') || 'system' },
    keysError: null,
    version: '3.0-dev',
  }
}

function ok(state: Record<string, unknown>) {
  return { ok: true, data: state, status: '' }
}

function err(message: string) {
  return { ok: false, data: null, status: message }
}

// Deferred operation — returns a structured error explaining absence.
function noop(_deps: Deps, msg?: string) {
  return err(msg ?? 'Not implemented yet — comes in a later task.')
}

/** Wires up every IPC channel that the preload API calls via invoke. */
export function registerIpcHandlers(deps: Deps): void {
  // ── State / config ───────────────────────────────────────

  ipcMain.handle('app:state', () => ok(appState(deps)))

  ipcMain.handle('config:guitar', (_event, guitar) => {
    try {
      deps.store.set('guitar', guitar)
      return ok(appState(deps))
    } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('ai:model', (_event, [provider, id]: [string, string]) => {
    try {
      deps.store.set('model_id', id)
      deps.store.set('provider_id', provider)
      return ok(appState(deps))
    } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('window:setTheme', (_event, theme) => {
    try { deps.store.set('theme', theme); return ok(appState(deps)) } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('window:setLocale', (_event, locale) => {
    try { deps.store.set('locale', locale); return ok(appState(deps)) } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('window:alwaysOnTop', () => {
    try {
      const next = !deps.store.getBool('always_on_top')
      deps.store.setBool('always_on_top', next)
      return ok(appState(deps))
    } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('window:dimOnUnfocus', (_event, value) => {
    try { deps.store.setBool('dim_on_unfocus', Boolean(value)); return ok(appState(deps)) } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('window:autoApply', (_event, value) => {
    try { deps.store.setBool('auto_apply', Boolean(value)); return ok(appState(deps)) } catch (e) { return err(String(e)) }
  })

  // ── Window bounds ────────────────────────────────────────

  ipcMain.handle('window:setBounds', (_event, bounds) => {
    try {
      const b = bounds as Record<string, unknown>
      if ('x' in b && typeof b.x === 'number') deps.store.setNumber('bounds_x', b.x)
      if ('y' in b && typeof b.y === 'number') deps.store.setNumber('bounds_y', b.y)
      if ('width' in b && typeof b.width === 'number') deps.store.setNumber('width', Number(b.width))
      if ('height' in b && typeof b.height === 'number') deps.store.setNumber('height', Number(bounds.height))
      return ok(appState(deps))
    } catch (e) { return err(String(e)) }
  })

  // ── Keys ─────────────────────────────────────────────────

  ipcMain.handle('keys:save', async (_event, payload) => {
    try {
      const [, key] = payload as [string, string]
      if (!key?.trim()) return err('Empty key — paste the whole key before saving.')
      if (/[\s]/.test(key.trim())) return err('Key has whitespace in the middle — paste only the key.')
      return ok(appState(deps))
    } catch (e) { return err(String(e)) }
  })

  ipcMain.handle('keys:remove', async () => {
    try { return ok(appState(deps)) } catch (e) { return err(String(e)) }
  })

  // ── Chat & conversation (stubbed — Task 6) ───────────────

  ipcMain.handle('chat:send', async () => noop(deps, 'Chat backend pending.'))
  ipcMain.handle('chat:new', async () => noop(deps, 'Chat new pending.'))
  ipcMain.handle('conversations:list', async () => noop(deps, 'Conversations list pending.'))
  ipcMain.handle('conversations:open', async () => noop(deps, 'Conversation open pending.'))
  ipcMain.handle('conversations:delete', async () => noop(deps, 'Conversation delete pending.'))

  // ── Rig operations (stubbed — Task 6) ────────────────────

  ipcMain.handle('rig:apply', async () => noop(deps, 'Rig apply pending.'))

  // ── Plugin operations (stubbed — Task 6) ─────────────────

  ipcMain.handle('plugin:state', async (_event, id: string) => ok({ id, status: 'unknown' }))
  ipcMain.handle('plugin:open', async () => noop(deps, 'Plugin launch pending.'))
  ipcMain.handle('plugin:installMapping', async () => noop(deps, 'Plugin mapping install pending.'))

  // ── AI preference ────────────────────────────────────────

  ipcMain.handle('ai:providerPreference', (_event, pref) => {
    try { deps.store.set('provider_preference', pref); return ok(appState(deps)) } catch (e) { return err(String(e)) }
  })
}
