/** Electron entry point - wires store, IPC handlers, plugin host, and security lockdown. */
import { app, BrowserWindow, Menu, protocol, safeStorage, nativeTheme } from './electron.ts'
import type { BrowserWindowType } from './electron.ts'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { Guitar, AvailableModel, ProviderId, ResolvedTheme, Theme } from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'
import type { RigChatProvider } from '@opentimbre/core/src/chat/rig-chat.ts'
import { listModels } from '@opentimbre/core/src/chat/rig-chat.ts'
import { openaiProvider } from '@opentimbre/core/src/providers/openai.ts'
import { anthropicProvider } from '@opentimbre/core/src/providers/anthropic.ts'
import { configure as configureKeys, applyToEnvironment } from '@opentimbre/core/src/secrets/key-store.ts'
import { createMainWindow, type TitleBarOverlayColors } from './window.ts'
import { registerRendererProtocol } from './renderer-protocol.ts'
import { initStore, getStore, resolveLocale, type DesktopStore } from './storage/desktop-store.ts'
import { createSafeStorageVault } from './storage/vault.ts'
import { registerIpcHandlers } from './ipc/handlers.ts'
import { resolveTheme } from './ipc/app-state.ts'
import { createPluginManager } from './plugins/plugin-manager.ts'
import { createSceneApplier } from './rig/scene-applier.ts'
import { createChatController } from './chat/chat-controller.ts'
import { createConversationRepository } from './chat/conversation-repository.ts'
import { createUpdater, createElectronUpdaterRuntime, inertUpdaterRuntime } from './updater/updater.ts'
import { listAvailableModels, modelLabel } from './ai/model-catalog.ts'
import type { PluginFileSystem } from '@opentimbre/platform-node/src/plugin-host.ts'
import { createWindowsPluginHost, createMacosPluginHost } from '@opentimbre/platform-node/src/plugin-host.ts'
import { windowsTransport, windowsPlatformInfo } from '@opentimbre/platform-node/src/windows.ts'
import { macosTransport, macosPlatformInfo } from '@opentimbre/platform-node/src/macos.ts'

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

/** Resolves Electron App.getPath('userData') directory on each platform. */
function resolveDataDir(): string {
  const name = 'OpenTimbre'
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', name)
  if (process.platform === 'win32') return path.join(process.env.APPDATA ?? '', name)
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
    name,
  )
}

/** The real `PluginFileSystem`: node:fs over the live disk. */
const pluginFileSystem: PluginFileSystem = {
  exists: async (file) => {
    try {
      await access(file)
      return true
    } catch {
      return false
    }
  },
  read: (file) => readFile(file, 'utf8'),
  mkdir: async (dir) => {
    await mkdir(dir, { recursive: true })
  },
  copy: (source, target) => copyFile(source, target),
}

/** Launches a plugin executable detached from the app, so it outlives the shell. */
function launchProcess(executable: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { detached: true, stdio: 'ignore' })
    child.on('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/**
 * The provider set, read lazily so a key saved later applies without a
 * restart. Real provider clients are built `new OpenAI()` / `new Anthropic()`,
 * which read the key from `process.env` — the core key-store's
 * `applyToEnvironment()` keeps that in step with what's saved. A missing key
 * makes the SDK constructor throw; caught here so the app still boots with
 * that provider simply absent as a candidate (absence is a supported state).
 *
 * `model_id`/`provider_id` are what the composer's model picker writes
 * (`ai:model`, handlers.ts) — without threading them here, every session
 * silently used the provider's hardcoded default model instead of whatever
 * the guitarist picked, which fails outright for an account without access
 * to that default.
 */
function wireProviders(store: DesktopStore): RigChatProvider[] {
  const activeProvider = store.get('provider_id')
  const activeModel = store.get('model_id')
  const providers: RigChatProvider[] = []
  try {
    providers.push(openaiProvider(new OpenAI(), activeProvider === 'openai' ? activeModel : undefined))
  } catch {
    /* no OpenAI key — not a candidate */
  }
  try {
    providers.push(anthropicProvider(new Anthropic(), activeProvider === 'anthropic' ? activeModel : undefined))
  } catch {
    /* no Anthropic key — not a candidate */
  }
  return providers
}

/** Ported from `styles.css` design tokens (`--surface-chrome` / `--text-dim`) so the native
 *  minimize/maximize/close row matches the in-content chrome instead of a default white bar. */
const TITLE_BAR_OVERLAY: Record<ResolvedTheme, TitleBarOverlayColors> = {
  dark: { color: '#171719', symbolColor: '#a4a1ae' },
  light: { color: '#efede8', symbolColor: '#56545e' },
}

/** The full guitar object the AI prompt needs; read from the persisted store. */
const DEFAULT_GUITAR: Guitar = { model: 'Default guitar', pickups: 'humbucker', tuning: 'E standard', strings: 6 }

function getGuitar(): Guitar {
  const raw = getStore().get('guitar')
  if (!raw) return DEFAULT_GUITAR
  try {
    return JSON.parse(raw) as Guitar
  } catch {
    return DEFAULT_GUITAR
  }
}

app.whenReady().then(async () => {
  // Suppresses the default File/Edit/View/Window menu (Windows/Linux also drop
  // the menu bar itself); called before any window exists so it never flashes.
  Menu.setApplicationMenu(null)

  const dataDir = resolveDataDir()
  // The data directory must exist before SQLite can create the database file —
  // a fresh machine has no %APPDATA%\OpenTimbre.
  await mkdir(dataDir, { recursive: true })
  initStore(path.join(dataDir, 'settings.db'))
  configureKeys({
    file: path.join(dataDir, 'settings.db'),
    vault: safeStorage.isEncryptionAvailable() ? createSafeStorageVault() : null,
  })
  // Load saved API keys into process.env so provider SDK constructors find
  // them — without this, keys persist in SQLite but never reach the providers
  // until the user re-saves one (mirrors legacy `abrirCofre` → `aplicarNoAmbiente`).
  try {
    applyToEnvironment()
  } catch (err) {
    console.error('Could not load saved API keys:', err)
  }

  // The OS branch is confined to this composition root — the shared modules
  // never read `process.platform` (see `opentimbre-cross-platform`). Windows
  // finds a loopMIDI port; everything else (macOS, and POSIX dev shells)
  // creates an owned virtual port, which RtMidi supports everywhere but
  // Windows.
  const transport = process.platform === 'win32' ? windowsTransport : macosTransport
  const platformInfo = process.platform === 'win32' ? windowsPlatformInfo : macosPlatformInfo
  const createHost = process.platform === 'win32' ? createWindowsPluginHost : createMacosPluginHost

  const host = createHost(platformInfo, pluginFileSystem, launchProcess)
  const plugins = createPluginManager({
    host,
    mappingDir: path.resolve(process.cwd(), 'midi-mapping'),
  })
  const applier = createSceneApplier({ transport })
  void applier.connect() // eager attempt so the status bar shows the real MIDI state at boot, not just after a scene apply

  const send = (channel: string, payload: unknown) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload)
  }

  // Only a packaged NSIS install can self-update: dev runs and the portable
  // exe get the inert runtime, so no update code ever runs in them. The
  // runtime choice stays in this composition root, like the other
  // platform branches (see `opentimbre-cross-platform`).
  const updaterRuntime =
    app.isPackaged && !('PORTABLE_EXECUTABLE_DIR' in process.env) ? createElectronUpdaterRuntime() : inertUpdaterRuntime()
  const updater = createUpdater({ runtime: updaterRuntime, send })

  const store = getStore()
  const getLocale = (): Locale =>
    store.hasStored('locale') ? (store.get('locale') as Locale) : resolveLocale(app.getLocale())
  const chat = createChatController({
    repo: createConversationRepository(store.connection),
    getProviders: () => wireProviders(store),
    getGuitar,
    getLocale,
    autoApply: () => store.getBool('auto_apply'),
    applier,
    send,
  })

  const modelCache: AvailableModel[] = []
  let win: BrowserWindowType | null = null
  const setAlwaysOnTop = (onTop: boolean): void => {
    win?.setAlwaysOnTop(onTop)
  }
  /** Opacity for the whole OS window when dim-on-unfocus is active. */
  const DIM_OPACITY = 0.6
  const setOpacity = (): void => {
    const dim = store.getBool('dim_on_unfocus')
    const focused = win?.isFocused() ?? true
    win?.setOpacity(dim && !focused ? DIM_OPACITY : 1)
  }
  const setDimOnUnfocus = (on: boolean): void => {
    store.setBool('dim_on_unfocus', on)
    setOpacity()
  }
  registerIpcHandlers({
    store,
    plugins,
    applier,
    chat,
    updater,
    send,
    getLocale,
    getGuitar,
    setAlwaysOnTop,
    setDimOnUnfocus,
    setTitleBarOverlay: (theme: Theme) => {
      win?.setTitleBarOverlay(TITLE_BAR_OVERLAY[resolveTheme(theme, nativeTheme.shouldUseDarkColors)])
    },
    systemDark: nativeTheme.shouldUseDarkColors,
    version: app.getVersion() || '3.0-dev',
    listModels: () => listAvailableModels(wireProviders(store)),
    getAi: () => {
      const modelId = store.get('model_id')
      const providerId = (store.get('provider_id') as ProviderId) || 'openai'
      if (!modelId) return null
      return {
        provider: providerId,
        label: '',
        model: modelId,
        // provider+id are already known — no need to find the model in
        // `modelCache` first (that lookup used to miss and silently fall
        // back to the raw id whenever the background warm-up hadn't
        // resolved yet, which raced independently of the picker's own
        // `listModels()` call).
        modelLabel: modelLabel(providerId, modelId),
        available: modelCache,
      }
    },
  })

  // Warm the model cache in the background; failures leave it empty.
  void listModels(wireProviders(store)).then((models) => modelCache.push(...models)).catch(() => undefined)

  // When the OS theme changes and the window follows `system`, push the new
  // resolved theme so the renderer repaints without a reload.
  nativeTheme.on('updated', () => {
    if (store.get('theme') === 'system') {
      const resolved: ResolvedTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      send('window:themeChanged', resolved)
      win?.setTitleBarOverlay(TITLE_BAR_OVERLAY[resolved])
    }
  })

  // Angular's application builder emits the browsable bundle under
  // dist/renderer/browser/, next to dist/main — the same layout in dev and
  // inside the packaged asar, which fs reads transparently.
  const rendererDir = fileURLToPath(new URL('../renderer/browser', import.meta.url))
  registerRendererProtocol(rendererDir)

  function openWindow(): void {
    const chosenTheme = (store.get('theme') as Theme) || 'system'
    win = createMainWindow({
      alwaysOnTop: store.getBool('always_on_top'),
      bounds: {
        x: store.getNumber('bounds_x'),
        y: store.getNumber('bounds_y'),
        width: store.getNumber('width'),
        height: store.getNumber('height'),
      },
      overlay: TITLE_BAR_OVERLAY[resolveTheme(chosenTheme, nativeTheme.shouldUseDarkColors)],
      onBoundsChanged(b) {
        store.setNumber('bounds_x', b.x)
        store.setNumber('bounds_y', b.y)
        store.setNumber('width', b.width)
        store.setNumber('height', b.height)
      },
    })
    plugins.start()
    win.on('focus', () => setOpacity())
    win.on('blur', () => setOpacity())
    win.on('closed', () => {
      win = null
      plugins.stop()
    })
  }

  openWindow()
  // Startup-only feed check (ratified): after the window is open so an
  // available update can reach the banner immediately; failures stay silent.
  updaterRuntime.checkForUpdates()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
