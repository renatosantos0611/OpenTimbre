# OpenTimbre Phase 3 desktop — design

**Status:** approved on 2026-08-06; planning amendments approved on 2026-08-06

## Goal

Deliver the desktop surface of OpenTimbre: a secure Electron 43 host with an Angular 22 renderer
that preserves the legacy window's workflow while completing the typed IPC, bilingual UI,
encrypted key management, conversation persistence, and plugin controls already defined by the
rebuild architecture.

## Scope

- Add `packages/desktop` with Electron main, sandboxed preload, and standalone zoneless Angular
  renderer.
- Extract a browser-safe `@opentimbre/i18n` package so core, CLI, and renderer share one catalog
  and resolver without a renderer runtime dependency on core.
- Deliver the window shell, chat and rig application, plugin status/actions, conversation history,
  guitar and AI settings, key management, theme/locale/window preferences, and all empty, loading,
  error, and degraded states required by those flows.
- Extend `contracts` where the existing Phase 1 shape is incomplete, especially locale state and
  mutation. Reconcile duplicated contract/domain types without introducing renderer runtime imports.
- Extend the English and Portuguese catalogs for every user-visible string.
- Persist settings, encrypted key records, and conversations in SQLite under Electron's application
  data directory.

CLI, MIDI transport redesign, new plugins/providers, installers, code signing, auto-update, and
other packaging work are outside this phase. Phase 4 owns distribution.

## Experience contract

The window defaults to 420×700, remains resizable down to 360×520, persists its bounds, and may
stay above normal windows at Electron's `floating` level. The hidden native title bar retains the
platform window controls. When enabled, blur sets opacity to 0.72 and focus restores full opacity.

The stable vertical hierarchy is title bar, operational status, plugin bar, central pane, and
composer. The transcript is the primary and only chat scroll surface. History and settings replace
the central pane; they do not cover or rearrange the stable chrome. Returning to chat preserves its
content, draft, and scroll position.

The visual direction is an evolved faithful version of the legacy UI. Near-black charcoal surfaces
use restrained borders and elevation, without nested cards. The legacy violet is limited to actions,
selection, focus, and an applied rig; green and red remain semantic. Barlow owns compact headings,
labels, and numeric status; Source Sans 3 owns conversation and forms. Font assets are bundled and
the UI makes no network request for them. Motion is short and functional: pane changes, message
entry, and apply confirmation. Lucide icons include accessible names, tooltips, and visible focus.

Theme supports `system`, `light`, and `dark` with role-equivalent tokens. Both themes and the dimmed
state must retain readable contrast at the default and minimum window sizes.

## Renderer architecture

Angular components are standalone, `OnPush`, zoneless, and signal-first. Components render state
and emit user intent; they never call `window.api`, contain IPC plumbing, or own domain rules.
Renderer services wrap the preload API and own writable signals. Templates consume readonly state.
Observable interop is limited to APIs that are genuinely stream-shaped.

The first paint resolves the persisted/system theme in main and supplies it before visible content
is shown, preventing a light/dark flash. The renderer i18n service consumes `@opentimbre/i18n` and
reacts to the persisted `en`/`pt` locale. No user-facing literal lives in a component or template.

Chat remains usable when MIDI, plugin discovery, history storage, or key storage fails. A request's
`querying`, `validating`, and `correcting` phases appear inline without blocking the composer.
Failures become localized chat or panel states rather than rejected promises that destabilize the
window.

The AI chooses the plugin by receiving one rig tool per catalog entry in the same provider call.
The chosen tool determines `Rig.plugin`; the desktop does not add a manual plugin prerequisite or a
second model-selection call.

## Electron and IPC architecture

Main owns window lifecycle, SQLite, `safeStorage`, provider sessions, filesystem/process access,
MIDI, plugin operations, and every call into `core` or `platform-node`. Preload exposes one
handwritten, typed API through `contextBridge`; raw `ipcRenderer`, Electron objects, and event
objects never reach the page.

`BrowserWindow` uses `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and
`webSecurity: true`. Main denies new windows, guards navigation, and grants no permission by
default. Every request handler validates both the sender frame/origin and its payload before doing
work. Payload schemas are exhaustive, reject unknown structure where applicable, and cap free-text
lengths. All SQL values use bound parameters.

The existing `IpcChannels` and `IpcEvents` remain the source of truth. Phase 3 adds a typed locale
field to `AppState` and a locale mutation channel. It may adjust mirrored domain shapes only to
match the implemented core contract. Each preload event registration returns an unsubscribe
function and drops Electron's event argument.

## Persistence

Use the `node:sqlite` module bundled with Electron's Node 24 runtime; no third-party SQLite package
is added. One main-process database contains versioned schemas for settings, conversations, and key
records. Migrations run transactionally before handlers are registered. Tests use `:memory:` and do
not depend on an Electron runtime, hardware, network, or a real key.

Settings persist locale, theme, guitar, provider/model preference, window bounds, always-on-top,
dim-on-unfocus, and auto-apply. Conversations persist their display messages, rigs/cards, provider
identity, opaque provider history, title, plugin, and timestamps. Corrupt or incompatible provider
history sets `memoryLost` while preserving readable messages.

Key rows store provider, hint metadata, timestamp, and only the `safeStorage` ciphertext as a BLOB.
An unreadable ciphertext remains visible as an unreadable status and never prevents environment
keys or the rest of the application from working.

## Secret contract

Plaintext API keys may cross IPC exactly once in `keys:save`, renderer to main. Main validates the
provider and key shape, performs the provider's free validation request, encrypts immediately with
`safeStorage`, and returns only `KeyInfo`. Plaintext keys never travel main to renderer, enter a push
event, persist unencrypted, or appear in logs, traces, errors, snapshots, tests, or diagnostics.
Key-bearing request objects are never passed to generic logging or tracing utilities.

## Acceptance criteria

- `npm run desktop` opens the functional 420×700 window on Windows without requiring MIDI hardware,
  a running plugin, network access, or an API key.
- Chat, scene application, plugin status/actions, history, guitar/AI/key settings, window preferences,
  theme, and locale work through the typed preload API and expose their degraded states.
- English and Portuguese cover every visible string; switching locale persists and updates the open
  window without restart.
- Window bounds, settings, conversations, and encrypted key records survive restart through the
  versioned SQLite store.
- No renderer source imports Electron, Node builtins, `core`, or `platform-node`; no component reads
  `window.api` directly; `core` remains free of Electron and Angular dependencies.
- Invalid senders and payloads are rejected before side effects. Navigation, popup, and permission
  tests prove the deny-by-default policy.
- Secret tests prove ciphertext-at-rest, hint-only responses, unreadable-key degradation, and the
  absence of plaintext in captured logs/traces.
- Main-process `node:test`, renderer Vitest, workspace typecheck/test, and lint pass with zero
  failures.
- Playwright screenshots at 420×700 and 360×520 verify chat, history, settings, light/dark, dimmed,
  empty, busy, error, and long-content states with no clipping or incoherent overlap.

## Technical grounding

Electron 43.0.0 embeds Node 24.17.0. Node's official documentation provides `node:sqlite`
`DatabaseSync` and prepared statements from Node 22.5 onward, so SQLite requires no additional
native addon or Electron ABI rebuild. Context7 library resolution succeeded for Angular and
Electron, but documentation retrieval was unavailable because the configured Context7 API key was
invalid; official Electron release/security documentation and Node API documentation are the
fallback sources for this spec.

## Ratified decisions

1. Scope is the complete Phase 3 desktop surface; packaging remains Phase 4.
2. The visual direction is an evolved faithful legacy hierarchy.
3. History and settings replace the central transcript pane while open.
4. The violet legacy palette is preserved with a narrower semantic role.
5. Typography is Barlow plus Source Sans 3, bundled locally.
6. API keys use one-way save IPC and never return to the renderer in plaintext.
7. Persistence uses SQLite rather than the legacy JSON-per-domain format.
8. Shared runtime catalogs/resolution live in `@opentimbre/i18n`; `contracts` remains type-only.
9. Angular uses the official CLI application builder and unit-test builder.
10. Cross-platform plugin operations use a deep `PluginHost` module in `platform-node`.
11. The AI chooses the plugin through one catalog tool per `PluginSpec` in a persistent core chat session.

## Known limitations

- macOS behavior remains unverified without macOS hardware.
- Packaging and packaged-runtime validation are deferred to Phase 4; Phase 3 validates the
  development runtime and browser-renderable Angular surface.
- Provider key validation requires network access when the user explicitly saves a key; the rest of
  the app does not.