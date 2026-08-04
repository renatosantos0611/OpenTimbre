# OpenTimbre rebuild — design

**Status:** approved on 2026-08-03

## Goal

Rebuild OpenTimbre — an AI-assisted rig builder that turns a natural-language tone description
into Neural DSP plugin parameters sent over MIDI CC — on Angular + Electron + Node, replacing the
`legacy/` implementation (vanilla-TS renderer, Windows-only). User/consumer: the guitarist who
runs the app locally, on Windows or macOS, to shape a tone by describing it in conversation.

## Acceptance criteria

- All three legacy surfaces exist and work: the floating always-on-top chat window, the terminal
  REPL, and the MIDI probe tool.
- All three legacy plugins are supported: Archetype Gojira, Soldano SLO-100 X, Archetype Tim
  Henson X — same catalog-as-data mechanism, same amp-fallback and scene-application behavior.
- A distributable installer exists for Windows (NSIS) and for macOS (DMG); the macOS build is
  produced but its platform-specific behavior is explicitly unverified until tested on real
  hardware (see Ratified decisions).
- The app runs and reads correctly with the OS-detected locale on first launch, and the user can
  override it in Settings; the override persists across the window, the REPL, and the probe tool.
- No API key ever appears in an IPC payload, a log line, or a trace in plaintext.
- The domain core (`packages/core`) has zero dependency on `electron` or `@angular/*` — enforced
  by the package graph, not just convention.
- `npm run check` (typecheck + `core`/`cli`/`desktop-main` tests) and the Angular `vitest` suite
  both pass with zero failures before any task is considered done.

## Context and constraints

Legacy (`legacy/`, a separate git repo, read via `git show HEAD:<path>` since its working tree has
deleted-but-uncommitted root files) is the behavioral reference, not the code to port line-by-line.
It already embodies a deliberate architecture — deep modules, plugin-as-data, decision/plumbing
separation, catalog-walking invariant tests — captured as the eight `opentimbre-*` domain skills
created at bootstrap, plus `opentimbre-i18n` added during this design.

Constraints carried from discovery (`pelizzai-interview-me`, full transcript in this task's
conversation, decisions restated under *Ratified decisions* below):

- Full i18n (English + Portuguese) from day one, not a later pass.
- macOS has no verification hardware available during this build.
- electron-builder is the packaging tool.
- Scope is parity with legacy, not new capability — "better" means engineering quality.
- No data migration from legacy's stores.
- Auto-update via `electron-updater` against GitHub Releases.
- No code-signing certificates for v1.

External grounding: Electron 43.2.0 (npm registry + electronjs.org security tutorial), Angular
22.1.0 (npm registry; release-note corroboration — flagged low-confidence in the domain-skill
ledger since it postdates the assistant's training and the primary release post was unreachable),
`@julusian/midi` 3.8.0 and RtMidi platform notes (openVirtualPort: macOS/Linux only, not Windows),
electron-builder 26.15.3 (electron.build/docs/configuration). Context7 was unavailable this
session; all of the above is recorded as such in `pelizzai/data/review-domain-skills.md`.

## Design and contracts

### Workspace layout (npm workspaces)

```
opentimbre/
├── package.json                     workspace root
├── packages/
│   ├── core/                        domain: PluginSpec catalog, scene planning, provider
│   │                                 tool-use protocol, key-store logic (vault injected),
│   │                                 i18n message catalog (en.json/pt.json)
│   │                                 deps: zod, provider SDKs — NEVER electron, NEVER @angular/*
│   ├── platform-node/                windows.ts / macos.ts: MIDI transport (connect()),
│   │                                 process detection, settings paths — per opentimbre-cross-platform
│   ├── cli/                         repl + probe entry points, Node-only, no Electron
│   └── desktop/
│       ├── main/                     Electron main: window lifecycle, validated IPC handlers,
│       │                             safeStorage vault, wires platform-node — the only packaged entry point
│       ├── preload/                  contextBridge surface (.cts), no raw ipcRenderer exposure
│       └── renderer/                 Angular 22 app: standalone, zoneless, signal-first, Vitest
├── contracts/                        shared IPC channel types + i18n key types (type-only,
│                                     erased at compile time, imported by main/preload/renderer)
├── midi-mapping/                     plugin CC-map XML, kept as plugin data
├── prompts/                          plugin tone docs, split *.en.md / *.pt.md; system prompt template
└── build/                            electron-builder config (NSIS + DMG targets)
```

The package boundary is the enforcement mechanism for `opentimbre-core-boundary`:
`packages/core/package.json` never lists `electron` or `@angular/*` as a dependency, so importing
either is a resolution failure at install/build time, not a convention someone can forget.

### Package responsibilities

| Package | Owns | Depends on |
|---|---|---|
| `core` | `PluginSpec` catalog, scene planning, provider tool-use protocol, key-store logic (vault port injected), i18n resolver | zod, provider SDKs |
| `platform-node` | MIDI transport, process detection, settings paths, per-OS `app` block resolution | `core`'s ports, Node builtins |
| `cli` | REPL, probe — thin entry points wiring `core` + `platform-node` | `core`, `platform-node` |
| `desktop/main` | window lifecycle, validated IPC handlers, `safeStorage` vault, wires `platform-node` | `core`, `platform-node`, `electron` |
| `desktop/preload` | `contextBridge` surface only | `contracts` (types only) |
| `desktop/renderer` | Angular UI, signal services wrapping `window.api` | `contracts` (types only) |
| `contracts` | IPC channel types, i18n key types — no runtime logic | nothing |

### IPC contract

One type-only file in `contracts/`, deleted at compile time, agreed by main/preload/renderer —
same shape as legacy's `desktop/ipc.ts`. Channel naming keeps `dominio:acao` → `domain:action`
(e.g. `chat:send`, `plugin:open`). Every `ipcMain.handle` validates sender (frame URL, parsed —
never string-compared) and payload (zod) before calling into `core`. Push channels
(`chat:status`, `plugin:changed`, `window:themeChanged`) drop the raw `event` object before
reaching the page, per `opentimbre-electron-ipc`.

### i18n

`core` owns `t(key, params?)` resolving against `en.json`/`pt.json`, falling back to English on a
missing key. Locale is one setting in the existing config store (same place as theme/window
prefs), detected from the OS as a first-run default only, then persisted and shared by all three
surfaces (`resolveLocale()` — see `opentimbre-i18n`). Plugin tone docs use a separate, parallel
`*.en.md`/`*.pt.md` split rather than the JSON catalog, since they are long-form domain writing.

### Testing

`node:test` for `core`/`cli`/`desktop/main` — zero extra dependency, matches legacy and
`opentimbre-code-style` §9. Vitest for `desktop/renderer` — the Angular 22 default. Catalog-walking
invariant tests in `core` run against the real `PluginSpec[]`; behavior tests use a fixture spec.

### Packaging

electron-builder, one config, two targets: `nsis` (Windows) and `dmg` (macOS). Native-module
(`@julusian/midi`) rebuild delegated to electron-builder's own handling — never a manual
`npm rebuild`, which targets the wrong Node ABI. `asarUnpack` coverage for the native binary is
verified after any change to that config, not assumed. `electron-updater` configured against a
GitHub Releases `publish` provider — left incomplete (no invented `owner`/`repo`) until a real
remote exists; wiring the actual repo is a `pelizzai-finish-task` destination decision, not a
design one.

## States, failures, and security

- **Missing/invalid API key:** validated via a free provider call before use; first valid key
  wins; UI shows hint-only, never the key (`opentimbre-secrets`).
- **Unmapped amp:** falls back to the first mapped amp, UI shows a warning — never throws
  (`opentimbre-plugin-spec`, preserved from legacy).
- **Missing MIDI port / unreadable config:** app still opens; the guitarist keeps seeing the
  screen (preserved from legacy's error-hardening doctrine).
- **CLI on Node <22.12:** fails early at startup with an explicit message naming the required
  version — no silent vault degradation (ratified during design stress; legacy's own unfixed gap).
- **Renderer displays model-generated content:** navigation and new-window creation are locked
  down (`setWindowOpenHandler` deny-by-default, `will-navigate` guarded) since an LLM response is
  untrusted content by definition (`opentimbre-electron-ipc`).
- **Unsigned builds:** Windows shows SmartScreen on first install *and every auto-update install*;
  macOS Gatekeeper blocks until the user overrides once; macOS silent auto-update is unreliable.
  All three are accepted, documented consequences, not defects to chase (`opentimbre-packaging`
  guidance, even though that skill itself was not created — captured here and enforced by review).

## Compatibility, migration, and rollback

None. Fresh start, ratified: no import path from legacy's SQLite key store, conversation history,
or rig presets. No settings-schema versioning for the app's own future updates in v1 — noted as a
reasonable later addition, not a blocker now.

## Testing & Validation Decisions

Proof by effect per `pelizzai-verification-before-completion`: `npm run check` (typecheck +
`node:test` across `core`/`cli`/`desktop/main`) for logic; Vitest run for the renderer; a running
`npm run desktop` launch + `pelizzai-frontend` visual pass for any window/UI change; a probe run
with the plugin open for any CC/plugin-spec change (Windows-verified always; macOS only when
hardware becomes available). Catalog invariant tests are the regression net for "did adding/editing
a plugin break another plugin."

## Out of scope

New AI providers or plugins beyond legacy's three. Data migration from legacy. Code signing /
notarization. macOS hardware verification (tracked as an open task, not silently assumed done).
Settings-schema versioning. Any UI redesign beyond what Angular + i18n naturally require — this is
a port with better engineering, not a visual reinvention (ratified: "same features, better built").

## Hard-to-reverse decisions

1. **npm workspaces monorepo layout.** Changing it later means moving files across package
   boundaries, not editing config. No ADR — the trade-off is standard and the ratification is
   recorded here and in this task's interview transcript.
2. **Locale files as the source of domain vocabulary.** Once `en.json`/`pt.json` ship, renaming a
   domain term is a translation-file edit, not a codebase search-and-replace. Same treatment.

Neither passes the *surprising-without-context* leg of the ADR triple test strongly enough to
warrant a separate document — both are explained in full above and in the domain skills they
ground (`opentimbre-i18n`, `opentimbre-core-boundary`).

## Ratified decisions and limitations

Discovery (9 gaps) + design stress (2 gaps) = 11 decisions, all closed by the user directly, none
inferred:

1. Surface scope — all three (window/REPL/probe) — from the original brief
2. Plugin catalog scope — all three plugins — from the original brief
3. App language — full i18n (English + Portuguese), not translation-later
4. macOS verifiability — built to spec, explicitly unverified, accepted
5. Packaging tool — electron-builder
6. Scope of "better" — engineering quality, not new features
7. Data migration — fresh start, none
8. Distribution — auto-update via GitHub Releases
9. Code signing — none for v1, SmartScreen/Gatekeeper friction accepted
10. CLI Node version — hard ≥22.12 requirement, fail early
11. Locale behavior — one shared setting, OS-detected default, user-overridable

Limitations carried forward, not gaps:

- macOS `platform-node` behavior (paths, process names, virtual-port wiring) is unverified until
  tested on real hardware — tracked as an explicit plan task, not closed by inference.
- GitHub repo visibility/creation for the auto-update feed is undecided — a destination-time
  decision, not a design one.
- `opentimbre-packaging` domain skill was drafted, grounded, and declined at its confirmation
  gate on 2026-08-03 (only `opentimbre-i18n` was ratified that round) — re-propose when packaging
  work actually starts, per `pelizzai/data/review-domain-skills.md`.
