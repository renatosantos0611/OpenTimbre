// Electron ships `electron` as CommonJS. Under the ESM main-process loader a named
// import fails to resolve, so the whole process imports the default export and
// destructures here, once, instead of at every call site.
import electron from 'electron'

export const { app, BrowserWindow, ipcMain, Menu, protocol, safeStorage, session, nativeTheme } = electron
// `BrowserWindow` is a value here (the destructured constructor), so callers
// that use it as a type pick up this alias instead of importing the value.
export type { BrowserWindow as BrowserWindowType, Rectangle } from 'electron'