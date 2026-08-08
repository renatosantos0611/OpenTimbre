/** Electron entry point - wires store, IPC handlers, plugin host, and security lockdown. */
import { app, BrowserWindow, protocol } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import type { Guitar } from '@opentimbre/contracts'
import type { Locale } from '@opentimbre/i18n'
import type { RigChatProvider } from '@opentimbre/core/src/chat/rig-chat.ts'
import { createMainWindow } from './window.ts'
import { initStore, getStore } from './storage/desktop-store.ts'
import { registerIpcHandlers } from './ipc/handlers.ts'
import { createPluginManager } from './plugins/plugin-manager.ts'
import { createSceneApplier } from './rig/scene-applier.ts'
import { createChatController } from './chat/chat-controller.ts'
import { createConversationRepository } from './chat/conversation-repository.ts'
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
 * The provider set, read lazily so a key saved later applies without a restart.
 * Real provider clients need an API key from the key store, which isn't wired
 * into this composition root yet (this task's `keys:save` is a stub and
 * `main.ts` never calls the key store's `configure`), so no provider is
 * configured here; the chat backend returns a localized "no provider" error
 * until that wiring lands. Tests inject a fake provider through this seam.
 */
function getProviders(): readonly RigChatProvider[] {
  return []
}

/** The full guitar object the AI prompt needs; the store only persists a preset
 *  id, so a default is used until that guitar wiring lands. */
const DEFAULT_GUITAR: Guitar = { model: 'Default guitar', pickups: 'humbucker', tuning: 'E standard', strings: 6 }

function getGuitar(): Guitar {
  return DEFAULT_GUITAR
}

app.whenReady().then(() => {
  const dataDir = resolveDataDir()
  initStore(path.join(dataDir, 'settings.db'))

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

  const store = getStore()
  const chat = createChatController({
    repo: createConversationRepository(store.connection),
    getProviders,
    getGuitar,
    getLocale: () => store.get('locale') as Locale,
    applier,
    send,
  })

  registerIpcHandlers({ store, plugins, applier, chat, send })

  function openWindow(): void {
    const window = createMainWindow()
    plugins.start()
    window.on('closed', () => plugins.stop())
  }

  openWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
