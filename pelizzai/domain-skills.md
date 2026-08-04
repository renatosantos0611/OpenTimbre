# PelizzAI — Domain skill catalog

> Living reference of this project's domain skills: what each one does and when to use it.
> Created and updated by the `pelizzai-writing-skills` skill. This file's existence signals
> that the harness bootstrap has been completed in this project.
>
> Written to `.claude/skills/` (canonical) and mirrored to `.agents/skills/`.
> Dates and grounding per skill: `pelizzai/data/review-domain-skills.md`.

## opentimbre-core-boundary

- **What it does:** keeps the domain core free of Electron, Angular, and host assumptions; host
  capabilities enter through narrow ports injected at startup.
- **When to use:** adding a core module; needing safeStorage / app paths / dialog / shell; deciding
  whether code belongs in core, main, or renderer.
- **Stack / area:** architecture, all layers
- **Files / areas covered:** the core/domain layer and its boundary with main and renderer
- **Grounded in:** legacy `src/chaves.ts` (the `Cofre` port) and the legacy `padroes.md` doctrine

## opentimbre-electron-ipc

- **What it does:** defines the main ↔ renderer contract — contextBridge surface, typed channels,
  validation of sender and payload in main, navigation and window-open lockdown.
- **When to use:** adding or changing an IPC channel; editing the preload; creating a
  BrowserWindow; wiring an Angular service to `window.api`.
- **Stack / area:** Electron 43
- **Files / areas covered:** preload, main IPC handlers, window creation, renderer bridge services
- **Grounded in:** electronjs.org/docs/latest/tutorial/security (20 recommendations; defaults for
  contextIsolation / sandbox / nodeIntegration) + legacy `desktop/preload.cts`

## opentimbre-plugin-spec

- **What it does:** keeps all amp/plugin knowledge as data in a `PluginSpec` descriptor — no CC
  number in code, no conditional on a plugin id, scales converted in one place.
- **When to use:** adding or editing a Neural DSP plugin; touching a CC number; changing scene →
  CC translation; building a plugin's AI tool schema.
- **Stack / area:** domain (MIDI / plugin catalog)
- **Files / areas covered:** plugin descriptors, catalog, scene planner, schema builder
- **Grounded in:** legacy `src/plugins/types.ts`, `capabilities.md`, and `padroes.md` §5

## opentimbre-cross-platform

- **What it does:** resolves every Windows/macOS divergence behind a platform module — virtual MIDI
  port creation, plugin discovery paths, process detection, settings folders.
- **When to use:** touching MIDI port opening; detecting or launching a plugin app; building a
  settings path; writing onboarding; planning the macOS build.
- **Stack / area:** platform layer, `@julusian/midi` 3.8
- **Files / areas covered:** the platform module and every caller tempted to check `process.platform`
- **Grounded in:** github.com/julusian/node-midi README (`openVirtualPort` on macOS/Linux, not
  Windows) + RtMidi platform notes + legacy Windows-only implementation

## opentimbre-secrets

- **What it does:** governs API keys — encrypted at rest via the OS keychain, hints only across
  IPC, never logged, environment precedence reversible.
- **When to use:** storing or reading a key; adding a provider; building the settings screen;
  writing logging or tracing; handling `.env`.
- **Stack / area:** security, `node:sqlite`, Electron `safeStorage`
- **Files / areas covered:** the key store and every path that could serialize a credential
- **Grounded in:** legacy `src/chaves.ts` (design rationale preserved verbatim in its header) +
  Electron safeStorage behavior (DPAPI on Windows, Keychain on macOS)

## opentimbre-angular-ui

- **What it does:** renderer conventions — signal-first state, zoneless change detection,
  standalone components, and a service layer that owns the bridge; no domain rules in the UI.
- **When to use:** creating or editing an Angular component, service, template, or style; wiring
  UI state; choosing between a signal and an observable.
- **Stack / area:** Angular 22.1.0
- **Files / areas covered:** the whole renderer
- **Grounded in:** npm registry (`@angular/core@22.1.0`) + Angular 22 release coverage for the v22
  defaults (zoneless, OnPush, Signal Forms, selectorless, Vitest). **Limitation:** the official
  release post was behind a redirect at bootstrap; defaults were corroborated across secondary
  sources. Re-verify against angular.dev before relying on a specific signature.

## opentimbre-testing

- **What it does:** proves behavior without hardware — catalog-walking invariant tests, fixture
  behavior tests, rules separated from I/O, failure messages that state the consequence.
- **When to use:** writing or changing a test; adding a plugin or provider the suite should cover;
  finding a rule that seems untestable.
- **Stack / area:** testing, all layers
- **Files / areas covered:** the whole suite, plus the design decisions that make it possible
- **Grounded in:** legacy `padroes.md` §6–§7 and the legacy test suite

## opentimbre-code-style

- **What it does:** the house style — deep modules, file-owner header comments, comments that
  explain why, kebab-case filenames, a justification bar for new dependencies.
- **When to use:** creating a file; naming a module; writing a comment; designing a signature;
  considering a package; reviewing readability.
- **Stack / area:** all
- **Files / areas covered:** every file
- **Grounded in:** legacy `padroes.md` (Ousterhout, applied)
- **Resolved 2026-08-03:** the language question is answered by `opentimbre-i18n` (bilingual UI,
  English-only code/comments) — no longer pending.

## opentimbre-i18n

- **What it does:** governs how English/Portuguese strings flow through a framework-agnostic
  message catalog in `core`, shared by the CLI, main process, and Angular renderer, with one
  locale setting persisted across all three surfaces.
- **When to use:** writing any user-facing text; adding a string; touching locale detection or
  the locale setting; working in `en.json`/`pt.json`.
- **Stack / area:** i18n, all layers
- **Files / areas covered:** `packages/core/i18n/`, every user-facing string in every surface,
  the `prompts/*.en.md`/`*.pt.md` split
- **Grounded in:** internal convention (design decision: full i18n, ratified 2026-08-03), Angular
  22 standalone/signal patterns already grounded in `opentimbre-angular-ui`

## Deferred (proposed, not created)

- **`opentimbre-packaging`** — installers and native-module packaging for Windows and macOS.
  Deferred a second time on 2026-08-03: drafted and grounded in electron-builder docs once the
  tool was chosen, but declined at the confirmation gate (only `opentimbre-i18n` was approved).
  Propose again when packaging work actually starts.
