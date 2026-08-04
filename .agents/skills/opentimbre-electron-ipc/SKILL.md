---
name: opentimbre-electron-ipc
description: Defines how the OpenTimbre main process and the Angular renderer talk — contextBridge surface, typed channel contract, and validation of every inbound payload. Use whenever you add or change an IPC channel, edit the preload, create a BrowserWindow, expose a new capability to the UI, handle a renderer-initiated action, or wire an Angular service to `window.api`. Also use when reviewing anything that touches `ipcMain`, `ipcRenderer`, `contextBridge`, `webPreferences`, navigation, or window-open behavior. NEVER expose raw `ipcRenderer` to the page and NEVER trust a renderer payload without validating it in main.
---

# OpenTimbre — main ↔ renderer contract

Grounded in the Electron security tutorial (electronjs.org/docs/latest/tutorial/security) for
Electron 43.

## The two rules that carry the weight

**1. The page sees a hand-written API, never `ipcRenderer`.** The preload builds one plain object
whose methods are exactly the channels that exist, and exposes it with `contextBridge`. Legacy did
this and said why: *"Nada de `ipcRenderer` cru vaza para a página — o renderer só enxerga os métodos
abaixo, que são exatamente os canais que existem."* Exposing `ipcRenderer` (or `ipcRenderer.on`
bound generically) hands the page the ability to call and listen on every channel in the app,
including ones you add later without thinking about them.

**2. Main validates every payload.** The renderer is untrusted input. Anything crossing IPC is
parsed and validated in the main process before it reaches a domain call. A channel that accepts
`(id: string)` must reject an `id` that is not in the catalog — the type annotation is erased at
runtime and proves nothing.

## Defaults you must not weaken

Electron already ships the safe defaults. Your job is to not turn them off:

| Setting | Required value | Default since |
| --- | --- | --- |
| `contextIsolation` | `true` | Electron 12 |
| `sandbox` | `true` | Electron 20 |
| `nodeIntegration` | `false` | Electron 5 |
| `webSecurity` | `true` | always |

If a task seems to need one of these flipped, the design is wrong — the capability belongs in main
behind a channel, not in the page. Say so rather than flipping the flag.

## Shape of a channel

Add a channel in three places, in this order, and nowhere else:

```text
1. the shared channel-contract type  — name, argument types, return type
2. main: ipcMain.handle(name, ...)   — validate sender, validate payload, then call the core
3. preload: one method on the api    — the only thing the page can reach
```

The Angular side then wraps `window.api` in an injectable service (see `opentimbre-angular-ui`);
components never touch `window.api` directly.

Naming follows the legacy convention `dominio:acao` — `chat:enviar`, `plugin:abrir`,
`conversas:listar`. Keep the pattern: it makes the surface readable as a list.

### Validating in main

```ts
ipcMain.handle('plugin:abrir', (event, id: unknown) => {
  assertSender(event)                    // recommendation 17: validate the sender
  const pluginId = PluginId.parse(id)    // zod — reject before the domain sees it
  return abrirPlugin(pluginId)
})
```

`assertSender` compares the frame's parsed URL against the window's known origin. Do not compare
URL strings with `startsWith` — parse them.

## Push channels

For main → renderer notifications (`chat:status`, `plugin:mudou`, `janela:tema-mudou`), the preload
exposes a **registration function** that wraps the callback:

```ts
onStatus: (cb: (s: StatusChat) => void) => {
  ipcRenderer.on('chat:status', (_event, s: StatusChat) => cb(s))
}
```

Note it drops the `event` argument. Passing the raw event to the page leaks `sender` and reopens
the surface you closed. Provide an unsubscribe path for anything a component registers, or the
Angular component leaks the listener on destroy.

## Navigation and new windows

The window must refuse to navigate away from the app and refuse to open child windows:

- `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))`
- a `will-navigate` handler that `preventDefault()`s anything outside the app origin
- external links go through an explicit, allowlisted `shell.openExternal` call — never straight
  from a renderer-supplied string

This matters more here than in a typical app: the renderer displays **model-generated content**. A
link or redirect in an LLM response is untrusted content by definition.

## Content Security Policy

Ship a CSP that forbids remote script and inline script. The Angular build produces hashed bundles
loaded from a custom protocol; nothing in this app needs a CDN.

## Startup data that cannot wait for IPC

Legacy passes the resolved theme through `additionalArguments` (`--tema=...`) instead of an
`invoke`, because the renderer needs it on its first executed line and an async round-trip lets the
window flash the wrong theme. Use the same technique for genuinely first-paint-critical values, and
only for those — it is a startup channel, not a general one.

## Review checklist

1. Does the page reach anything other than the hand-written api object?
2. Is every new channel validated in main, sender and payload?
3. Did a `webPreferences` flag get weakened?
4. Can a component unsubscribe from every push channel it registered?
5. Does any renderer-supplied string reach `shell.openExternal`, `fs`, or a child process?

## Related

`opentimbre-core-boundary` (main calls the core; the core never calls back), `opentimbre-secrets`
(what must never cross the bridge), `opentimbre-angular-ui` (wrapping `window.api` in a service).
