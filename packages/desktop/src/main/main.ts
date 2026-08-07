/** Electron entry point. Functional IPC handlers arrive in Task 5; this task owns the secure shell. */
import { app, BrowserWindow, net, protocol } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createMainWindow } from './window.ts'

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const requested = new URL(request.url).pathname.replace(/^\/+/, '')
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../renderer/browser')
    return net.fetch(pathToFileURL(path.join(root, requested)).toString())
  })
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
