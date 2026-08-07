/** Electron entry point - wires store, IPC handlers, and security lockdown. */
import { app, BrowserWindow, protocol } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { createMainWindow } from './window.ts'
import { initStore, getStore } from './storage/desktop-store.ts'
import { registerIpcHandlers } from './ipc/handlers.ts'

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

app.whenReady().then(() => {
  const dataDir = resolveDataDir()
  initStore(path.join(dataDir, 'settings.db'))

  registerIpcHandlers({ store: getStore() })

  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
