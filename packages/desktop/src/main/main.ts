/** Electron entry point - wires store, IPC handlers, plugin host, and security lockdown. */
import { app, BrowserWindow, protocol, safeStorage, nativeTheme } from './electron.ts'
import type { BrowserWindowType } from './electron.ts'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { Guitar, AvailableModel, ProviderId } from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'
import type { RigChatProvider } from '@opentimbre/core/src/chat/rig-chat.ts'
import { listModels } from '@opentimbre/core/src/chat/rig-chat.ts'
import { openaiProvider } from '@opentimbre/core/src/providers/openai.ts'
import { anthropicProvider } from '@opentimbre/core/src/providers/anthropic.ts'
import { configure as configureKeys } from '@opentimbre/core/src/secrets/key-store.ts'
import { createMainWindow } from './window.ts'
import { registerRendererProtocol } from './renderer-protocol.ts'
import { initStore, getStore, resolveLocale } from './storage/desktop-store.ts'
import { createSafeStorageVault } from './storage/vault.ts'
import { registerIpcHandlers } from './ipc/handlers.ts'
import { createPluginManager } from './plugins/plugin-manager.ts'
import { createSceneApplier } from './rig/scene-applier.ts'
import { createChatController } from './chat/chat-controller.ts'
import { createConversationRepository } from './chat/conversation-repository.ts'
import { createUpdater, createElectronUpdaterRuntime, inertUpdaterRuntime } from './updater/updater.ts'
import { listAvailableModels } from './ai/model-catalog.ts'
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
 */
function wireProviders(): RigChatProvider[] {
  const providers: RigChatProvider[] = []
  try {
    providers.push(openaiProvider(new OpenAI()))
  } catch {
    /* no OpenAI key — not a candidate */
  }
  try {
    providers.push(anthropicProvider(new Anthropic()))
  } catch {
    /* no Anthropic key — not a candidate */
  }
  return providers
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
  const dataDir = resolveDataDir()
  // The data directory must exist before SQLite can create the database file —
  // a fresh machine has no %APPDATA%\OpenTimbre.
  await mkdir(dataDir, { recursive: true })
  initStore(path.join(dataDir, 'settings.db'))
  configureKeys({
    file: path.join(dataDir, 'settings.db'),
    vault: safeStorage.isEncryptionAvailable() ? createSafeStorageVault() : null,
  })

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
    getProviders: wireProviders,
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
    systemDark: nativeTheme.shouldUseDarkColors,
    version: app.getVersion() || '3.0-dev',
    listModels: () => listAvailableModels(wireProviders()),
    getAi: () => {
      const modelId = store.get('model_id')
      const providerId = (store.get('provider_id') as ProviderId) || 'openai'
      if (!modelId) return null
      return {
        provider: providerId,
        label: '',
        model: modelId,
        available: modelCache,
      }
    },
  })

  // Warm the model cache in the background; failures leave it empty.
  void listModels(wireProviders()).then((models) => modelCache.push(...models)).catch(() => undefined)

  // When the OS theme changes and the window follows `system`, push the new
  // resolved theme so the renderer repaints without a reload.
  nativeTheme.on('updated', () => {
    if (store.get('theme') === 'system') send('window:themeChanged', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })

  // Angular's application builder emits the browsable bundle under
  // dist/renderer/browser/, next to dist/main — the same layout in dev and
  // inside the packaged asar, which fs reads transparently.
  const rendererDir = fileURLToPath(new URL('../renderer/browser', import.meta.url))
  registerRendererProtocol(rendererDir)

  function openWindow(): void {
    win = createMainWindow({
      alwaysOnTop: store.getBool('always_on_top'),
      bounds: {
        x: store.getNumber('bounds_x'),
        y: store.getNumber('bounds_y'),
        width: store.getNumber('width'),
        height: store.getNumber('height'),
      },
      onBoundsChanged(b) {
        store.setNumber('bounds_x', b.x)
        store.setNumber('bounds_y', b.y)
        store.setNumber('width', b.width)
        store.setNumber('height', b.height)
      },
    })
    plugins.start()
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
