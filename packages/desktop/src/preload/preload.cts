import { contextBridge, ipcRenderer } from 'electron'
import type { ChatStatus, DesktopApi, PluginState, ResolvedTheme, UpdaterStatus } from '@opentimbre/contracts'

const api: DesktopApi = {
  getState: () => ipcRenderer.invoke('app:state'),
  sendChat: (text) => ipcRenderer.invoke('chat:send', text),
  newChat: () => ipcRenderer.invoke('chat:new'),
  applyRig: (scene) => ipcRenderer.invoke('rig:apply', scene),
  setGuitar: (guitar) => ipcRenderer.invoke('config:guitar', guitar),
  setModel: (provider, id) => ipcRenderer.invoke('ai:model', [provider, id]),
  listModels: () => ipcRenderer.invoke('ai:listModels'),
  getPluginState: (id) => ipcRenderer.invoke('plugin:state', id),
  openPlugin: (id) => ipcRenderer.invoke('plugin:open', id),
  installMapping: (id) => ipcRenderer.invoke('plugin:installMapping', id),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window:alwaysOnTop'),
  setDimOnUnfocus: (value) => ipcRenderer.invoke('window:dimOnUnfocus', value),
  setAutoApply: (value) => ipcRenderer.invoke('window:autoApply', value),
  setTheme: (theme) => ipcRenderer.invoke('window:setTheme', theme),
  setLocale: (locale) => ipcRenderer.invoke('window:setLocale', locale),
  saveKey: (provider, key) => ipcRenderer.invoke('keys:save', [provider, key]),
  removeKey: (provider) => ipcRenderer.invoke('keys:remove', provider),
  setProviderPreference: (preference) => ipcRenderer.invoke('ai:providerPreference', preference),
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  openConversation: (id) => ipcRenderer.invoke('conversations:open', id),
  deleteConversation: (id) => ipcRenderer.invoke('conversations:delete', id),
  onChatStatus: (callback: (status: ChatStatus) => void) => subscribe('chat:status', callback),
  onThemeChanged: (callback: (theme: ResolvedTheme) => void) => subscribe('window:themeChanged', callback),
  onPluginChanged: (callback: (state: PluginState) => void) => subscribe('plugin:changed', callback),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => subscribe('updater:status', callback),
}

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('api', api)
