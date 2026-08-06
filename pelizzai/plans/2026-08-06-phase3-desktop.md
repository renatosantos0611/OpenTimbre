# OpenTimbre Phase 3 desktop — implementation plan

**Lane:** standard
**Spec:** `pelizzai/specs/2026-08-06-phase3-desktop.md`
**Review profile:** split for every task
**Applicable domain skills:** `opentimbre-angular-ui`, `opentimbre-code-style`,
`opentimbre-core-boundary`, `opentimbre-cross-platform`, `opentimbre-electron-ipc`,
`opentimbre-i18n`, `opentimbre-plugin-spec`, `opentimbre-secrets`, `opentimbre-testing`

## Approvals

- Discovery: approved on 2026-08-06
- Spec: approved on 2026-08-06
- Domain skills: existing OpenTimbre catalog applies; no uncovered stack
- Plan: approved on 2026-08-06

## Goal and boundaries

Deliver the approved Electron 43 + Angular 22 desktop surface on Windows, preserving the legacy
workflow and completing secure typed IPC, SQLite persistence, catalog-driven chat, plugin control,
full English/Portuguese UI, and visual/accessibility proof. macOS code remains honest but unverified.

Do not add packaging, installers, auto-update, signing, new providers/plugins, legacy data migration,
or MIDI/plugin-spec changes. `legacy/` is read-only evidence and stays untracked.

## Technical decisions in this plan

1. Shared runtime i18n moves to `@opentimbre/i18n` — ratified in the plan interview on 2026-08-06 — rejected renderer→core imports and duplicated catalogs — keeps one browser-safe source of truth.
2. Renderer uses Angular CLI's `@angular/build:application` and `@angular/build:unit-test` — ratified in the plan interview on 2026-08-06 — rejected direct Vite configuration — follows Angular 22's supported build and Vitest path.
3. Plugin OS behavior uses a deep `PluginHost` module in `platform-node` — ratified in the plan interview on 2026-08-06 — rejected widening `PlatformInfo` and Electron-main OS branches — hides candidates, processes, paths, launch, and mapping installation.
4. Catalog chat is a persistent core session with one tool per `PluginSpec` — ratified in the plan interview on 2026-08-06 — rejected manual plugin selection and a two-call selector — preserves legacy AI choice and provider-native history.
5. SQLite uses Electron's bundled `node:sqlite` in one app database — ratified in the approved spec — rejected JSON stores and a third-party native addon — gives transactions without another ABI-sensitive dependency.
6. Plaintext keys use only the one-way `keys:save` request — ratified in the approved spec — rejected environment-only configuration — preserves Settings while preventing plaintext return, persistence, logging, and tracing.
7. Desktop is one npm workspace: `tsc` builds main/preload and Angular CLI builds renderer — ratified by the approved workspace architecture; the default Angular builder is grounded in current official Angular 22 documentation.
8. Dependencies must buy missing platform capability: Angular/Electron provide the app runtimes; Lucide provides consistent accessible icons; Fontsource bundles the ratified fonts offline; Playwright provides the required real-browser visual proof; no UI kit or SQLite addon is added.

## Deep modules and test seams

- `@opentimbre/i18n`: `createI18n(initialLocale)` returns locale mutation and typed translation; catalogs and fallback stay hidden.
- Core `RigChat`: `send(text)`, `export()`, and provider/plugin metadata hide tool-use retries, catalog tools, and provider-native history.
- Platform `PluginHost`: `inspect(spec)`, `launch(spec)`, `installMapping(spec, source)` hides every OS-specific fact.
- Main `DesktopStore`: settings and conversation operations hide SQL, migrations, serialization, and transactions.
- Main `registerDesktopIpc(deps)`: one registration interface hides schemas, sender checks, failure conversion, and event projection.
- Renderer `DesktopService`: readonly signals and intent methods hide `window.api`; components and tests cross the same service seam.

## Task 1 — Shared i18n and complete wire contract

**Status:** complete 2026-08-06 — package tests, workspace typechecks, and full workspace tests pass.

**Result:** CLI/core behavior stays green while the browser-safe package owns both catalogs; the
wire contract includes locale and a handwritten `DesktopApi` with unsubscribe-returning events.

**Out of scope:** Electron handlers and UI components.

**Files/interfaces:**
- Create `packages/i18n/package.json`, `tsconfig.json`, `src/index.ts`, `src/index.test.ts`, `src/en.json`, `src/pt.json`.
- Update root `package.json`, lockfile, `contracts/src/ipc.ts`, `contracts/src/i18n.ts`, and contract exports.
- Update `packages/core/src/i18n/index.ts` and tests into a compatibility re-export or direct consumers of `@opentimbre/i18n`.
- Update core/CLI imports without changing visible behavior.
- Add `Locale`, `AppState.locale`, `window:setLocale`, and `DesktopApi` to contracts. `DesktopApi` exposes named methods, never generic `invoke`/`on`.

**Skills/overlays:** `opentimbre-i18n`, `opentimbre-code-style`, `opentimbre-core-boundary`,
`opentimbre-testing`; `pelizzai-tdd`.

**Strategy:** TDD. RED package tests for English fallback, interpolation, locale mutation, and exact
catalog key parity; GREEN move catalogs/resolver and adapt consumers. Contract changes use
typecheck/static validation, not fabricated runtime RED.

**Proof:**
- `npm.cmd run test -w @opentimbre/i18n`
- `npm.cmd run typecheck --workspaces --if-present`
- `npm.cmd run check`

**Completion:** one catalog pair exists, renderer-safe imports resolve, existing CLI/core tests stay
green, and no runtime file enters `contracts`. Roll back by reverting this task as one unit.

## Task 2 — Catalog chat and provider model contract

**Result:** a core session lets the AI choose among all catalog plugins, returns a valid `Turn`,
exports resumable provider-native history, and reports available models without network in tests.

**Out of scope:** Electron, storage, and UI.

**Files/interfaces:**
- Create `packages/core/src/chat/rig-chat.ts` and colocated tests/fixtures.
- Extend provider session adapters only where needed to import/export validated native history.
- Add a small provider model-list interface in core; reuse SDK response types rather than duplicate them.
- Preserve `buildRig(plugin, ...)` and `adjustScene(...)` for CLI and focused callers.

`createRigChat({ providers, locale, guitar, resume? })` returns a `RigChat` with `send(text)`,
`export()`, `provider`, and `model`. Each send exposes one rig tool per `CATALOG` entry; the selected
tool determines the validated `Rig.plugin`. Invalid resume data starts a fresh native history and
reports `memoryLost`, while normalized display messages remain outside this module.

**Skills/overlays:** `opentimbre-plugin-spec`, `opentimbre-i18n`, `opentimbre-secrets`,
`opentimbre-testing`, `opentimbre-code-style`; `pelizzai-tdd`.

**Strategy:** TDD tracer bullets: Gojira tool selection, another catalog tool selection, adjustment
of the current scene, export/resume for each provider, incompatible history degradation, and model
listing with fake clients. Never call a live provider.

**Proof:**
- `npm.cmd run test -w @opentimbre/core`
- `npm.cmd run typecheck -w @opentimbre/core`

**Completion:** tests prove tool choice drives `rig.plugin` across the catalog and resume failure is
non-destructive. Roll back without changing existing `buildRig` behavior.

## Task 3 — Cross-platform PluginHost

**Result:** Windows can inspect, launch, and install mapping files for any catalog plugin through one
intent-shaped interface; macOS returns explicit unsupported/not-confirmed failures where descriptors
have no verified candidates.

**Out of scope:** Electron IPC and changing plugin descriptor facts.

**Files/interfaces:**
- Create `packages/platform-node/src/plugin-host.ts` for shared types and selection.
- Add Windows/macOS adapters and colocated tests; reuse existing process/settings helpers.
- Update package exports/import sites as needed.

`PluginHost.inspect(spec)` returns installed path, running state, and mapping status;
`launch(spec)` tries only descriptor candidates; `installMapping(spec, source)` creates the verified
settings subfolder and copies the catalog mapping. No caller reads `process.platform`, `%APPDATA%`,
`/Applications`, `tasklist`, or `pgrep`.

**Skills/overlays:** `opentimbre-cross-platform`, `opentimbre-plugin-spec`,
`opentimbre-core-boundary`, `opentimbre-testing`; `pelizzai-tdd`.

**Strategy:** TDD with injected filesystem/process-launch runners. Walk the real catalog in invariant
tests; no installed plugin or hardware required.

**Proof:**
- `npm.cmd run test -w @opentimbre/platform-node`
- `npm.cmd run typecheck -w @opentimbre/platform-node`

**Completion:** no OS branch leaks into shared/domain code and unverified macOS facts are not invented.

## Task 4 — Secure desktop host and typed bridge

**Result:** `npm run desktop` opens the secure resizable 420×700 shell (minimum 360×520), restores
native title controls, and exposes only the typed `DesktopApi`; invalid senders, navigation, popups,
permissions, and malformed payloads fail before side effects.

**Out of scope:** functional chat/settings/plugin handlers and final visuals.

**Files/interfaces:**
- Create `packages/desktop` manifests, `angular.json`, main/preload/renderer tsconfigs, Angular entry
  files, `src/main/main.ts`, `src/main/window.ts`, `src/main/security.ts`, `src/main/ipc/*`,
  `src/preload/preload.cts`, and `scripts/dev.mjs`.
- Update root scripts/workspaces, lockfile, ESLint coverage, and add `lint`.
- Add only justified dependencies listed in Technical decision 8, pinned to compatible Angular 22
  and Electron 43 ranges verified from npm before install.

The dev script builds/watches main, starts Angular's dev server, waits for its URL, then starts
Electron with an explicit renderer URL. Production-mode development loads built renderer files;
packaging config is absent. `BrowserWindow` enforces the security flags in the spec and remains
hidden until the theme bootstrap and `ready-to-show` complete.

**Skills/overlays:** `opentimbre-electron-ipc`, `opentimbre-angular-ui`,
`opentimbre-code-style`, `opentimbre-testing`; `pelizzai-tdd`, `pelizzai-oswap`,
`pelizzai-frontend`.

**Strategy:** validate configuration plus TDD for pure sender/payload guards and injected IPC
registration. Renderer starts with a fake empty state. Run Electron smoke after automated checks.

**Proof:**
- `npm.cmd run test:main -w @opentimbre/desktop`
- `npm.cmd run build -w @opentimbre/desktop`
- `npm.cmd run lint`
- `npm.cmd run desktop` and observe successful open/close with no renderer error

**Completion:** no raw Electron API crosses preload, every event subscription unsubscribes, and the
window opens without hardware/network/key. Roll back by removing the workspace and root entries.

## Task 5 — SQLite settings, AppState, and protected keys

**Result:** `app:state` and every settings/key command work through validated IPC and survive a
restart; saved keys are validated first, encrypted immediately, and represented only by `KeyInfo`.

**Out of scope:** chat, conversations, plugin commands, and settings UI.

**Files/interfaces:**
- Create `src/main/storage/desktop-store.ts`, migrations, settings repository, and tests.
- Create Electron `safeStorage` vault adapter and provider-key validator.
- Add app-state assembly and handlers for guitar, model/provider preference, theme, locale,
  always-on-top, dim-on-unfocus, auto-apply, key save/remove, and window bounds.
- Configure core key-store against the same database file after migrations.

Use bound statements and transactional `PRAGMA user_version` migrations. Tests use `:memory:`.
`keys:save` builds a temporary provider client from the submitted key, performs the provider's
free model-list validation, then saves; a failed/network validation leaves the prior row unchanged.
No key-bearing object reaches generic logs/traces/errors.

**Skills/overlays:** `opentimbre-secrets`, `opentimbre-electron-ipc`, `opentimbre-i18n`,
`opentimbre-testing`; `pelizzai-tdd`, `pelizzai-oswap`.

**Strategy:** TDD per setting, migration, reopen, ciphertext, unreadable vault, invalid key, network
failure, and hint-only IPC. Add a test logger/trace sink that proves the plaintext sentinel absent.

**Proof:**
- `npm.cmd run test:main -w @opentimbre/desktop`
- `npm.cmd run check`

**Completion:** fresh/reopened DBs produce the same AppState; secret sentinel appears nowhere outside
the save call/vault fake. Migration tests copy the pre-migration fixture before each run; rollback is
restore fixture/revert task, never destructive downgrade SQL.

## Task 6 — Plugin status, launch, mapping, and scene application

**Result:** plugin channels expose catalog-derived state/actions and a loaded rig scene produces the
planned MIDI CC sequence; missing MIDI or unverified platform capability returns a localized failure
without closing the app.

**Out of scope:** real plugin/hardware verification and UI.

**Files/interfaces:**
- Create `src/main/plugins/plugin-manager.ts`, `src/main/rig/scene-applier.ts`, and tests.
- Register plugin state/open/install-mapping and rig-apply handlers/events.
- Select the existing platform MIDI transport and the Task 3 `PluginHost` once at startup.

Plugin IDs resolve through `CATALOG`; paths, names, mappings, amp fallback, and CCs are never copied
into main. Status polling stops with the window and emits only changed state.

**Skills/overlays:** `opentimbre-plugin-spec`, `opentimbre-cross-platform`,
`opentimbre-electron-ipc`, `opentimbre-testing`; `pelizzai-tdd`, `pelizzai-oswap`.

**Strategy:** TDD with fake PluginHost, clock, and MIDI send function. Catalog-walk status tests and
fixture scene tests cover success, missing mapping, unmapped amp warning, and disconnected MIDI.

**Proof:**
- `npm.cmd run test:main -w @opentimbre/desktop`
- `npm.cmd run test -w @opentimbre/platform-node`

**Completion:** all four plugins flow through one manager and tests require no app/hardware.

## Task 7 — Chat and conversation persistence

**Result:** chat/new/history channels provide the complete legacy workflow: first send lazily creates
a provider session and conversation, AI chooses a plugin, turns persist transactionally, opening a
compatible conversation resumes, and incompatible history sets `memoryLost` while preserving text.

**Out of scope:** renderer components.

**Files/interfaces:**
- Create `src/main/chat/chat-controller.ts`, conversation repository/schema mapping, and tests.
- Register chat send/new and conversation list/open/delete handlers plus chat-status events.
- Reuse Task 2 `RigChat`; do not reproduce provider protocol in main.

Persist normalized messages/rig/cards and opaque versioned provider history in one transaction per
successful/error turn. A storage failure leaves the in-memory conversation usable. Deleting the open
conversation clears active chat/rig state. Free-text schemas enforce the plan's documented caps.

**Skills/overlays:** `opentimbre-electron-ipc`, `opentimbre-plugin-spec`,
`opentimbre-secrets`, `opentimbre-i18n`, `opentimbre-testing`; `pelizzai-tdd`,
`pelizzai-oswap`.

**Strategy:** TDD tracer bullets through the public controller/handler seam: first turn, adjustment,
provider status phases, restart/open/resume, incompatible history, delete active, provider failure,
and storage failure. Fake provider/clock/store; no live network.

**Proof:**
- `npm.cmd run test:main -w @opentimbre/desktop`
- `npm.cmd run test -w @opentimbre/core`
- `npm.cmd run check`

**Completion:** a restart fixture reproduces transcript/rig/plugin and the two resume outcomes.

## Task 8 — Angular shell, bridge service, i18n, and visual tokens

**Result:** the renderer paints the approved stable shell in light/dark/system themes, loads AppState
through one service, switches chat/history/settings panes without losing chat state, and renders all
copy from `@opentimbre/i18n`.

**Out of scope:** complete forms, chat cards, and plugin actions.

**Files/interfaces:**
- Create standalone OnPush shell/title/status/plugin/composer/pane components under
  `src/renderer/app/`, plus `desktop.service.ts` and `i18n.service.ts`.
- Create global role-based CSS tokens, bundled Barlow/Source Sans 3 imports, Lucide icon registry,
  fake `DesktopApi` fixture, and component/service tests.
- No Angular router or UI kit: three local panes are shell state, not navigable pages.

`DesktopService` alone reads `window.api`, owns writable signals, exposes readonly signals, and
cleans up every event subscription. Angular 22 is zoneless by default; do not add Zone.js or
`provideZoneChangeDetection`. Form state used by templates is reflected through signals.

**Skills/overlays:** `opentimbre-angular-ui`, `opentimbre-i18n`,
`opentimbre-electron-ipc`, `opentimbre-code-style`; `pelizzai-tdd`, `pelizzai-frontend`.

**Strategy:** TDD for service/state/pane preservation and locale/theme reactions; visual validation
for typography, hierarchy, minimum viewport, focus, dim state, and contrast.

**Proof:**
- `npm.cmd run test:renderer -w @opentimbre/desktop`
- `npm.cmd run build:renderer -w @opentimbre/desktop`
- `npm.cmd run test:e2e -w @opentimbre/desktop -- --grep "shell"`

**Completion:** screenshots at 420×700 and 360×520 show no overlap/clipping in both themes and dimmed
state; no template/component contains a hardcoded visible literal.

## Task 9 — Chat, rig cards, and history UI

**Result:** the guitarist can send/adjust requests, see status/errors, inspect scene cards, apply a
scene, start a new chat, and list/open/delete conversations with memory-loss feedback.

**Out of scope:** settings forms and packaging.

**Files/interfaces:**
- Add chat transcript/message/rig-card/composer/history components and colocated tests/styles.
- Extend `DesktopService` only with intent methods and state needed by these workflows.
- Extend both catalogs in the same slice as each visible state.

Composer remains available during degraded MIDI/history states but prevents duplicate sends while a
provider call is active. Long generated content wraps without changing fixed chrome dimensions.
Delete uses an accessible confirmation owned by the renderer, not a native blocking dialog.

**Skills/overlays:** `opentimbre-angular-ui`, `opentimbre-i18n`,
`opentimbre-plugin-spec`, `opentimbre-testing`; `pelizzai-tdd`, `pelizzai-frontend`.

**Strategy:** TDD for send/status/result/error/apply/new/open/delete and draft/scroll preservation;
Playwright visual/accessibility scenarios for empty, busy, error, long content, rig, history, and
memory-lost states.

**Proof:**
- `npm.cmd run test:renderer -w @opentimbre/desktop`
- `npm.cmd run test:e2e -w @opentimbre/desktop -- --grep "chat|history"`

**Completion:** all chat/history acceptance states pass at both viewports with keyboard-only use.

## Task 10 — Settings/plugin UI, hardening, documentation, and final proof

**Result:** all settings and plugin actions are usable, bilingual, persistent, accessible, and
secure; the complete desktop launches and passes the approved automated and visual gates.

**Out of scope:** installers, auto-update, signing, and claiming macOS verification.

**Files/interfaces:**
- Add guitar, AI/model/provider, keys, window/theme/locale, and plugin action components/tests/styles.
- Complete catalogs, desktop README/run documentation, and root scripts.
- Add/complete Playwright scenarios and security test fixtures; no production test hooks.

Key inputs clear immediately after submission and never rehydrate from state. Forced `AI_PROVIDER`
disables preference controls with a localized explanation. Unreadable key rows, missing mappings,
unconfirmed macOS launch, disconnected MIDI, storage errors, and network validation failures remain
actionable without blanking the window.

**Skills/overlays:** all plan domain skills; `pelizzai-tdd`, `pelizzai-frontend`,
`pelizzai-oswap`, `pelizzai-documenting-features`, `pelizzai-verification-before-completion`.

**Strategy:** TDD for form submissions/errors/persistence and plugin actions; visual/browser proof
for every spec state; OWASP review for IPC, SQL, secrets, navigation, dependencies, logging, and
exception handling; split blind-spec and quality/evidence review before the final seal.

**Proof:**
- `npm.cmd run lint`
- `npm.cmd run check`
- `npm.cmd run build -w @opentimbre/desktop`
- `npm.cmd run test:e2e -w @opentimbre/desktop`
- `npm.cmd audit --omit=dev`
- `git diff --check`
- `npm.cmd run desktop` and exercise launch, pane switching, locale/theme, degraded startup, and close/reopen persistence

**Completion:** all commands exit zero; screenshot review covers the spec matrix; no Critical/High
OWASP finding remains; docs name Windows prerequisites and macOS limitations honestly. Any mutation
after proof invalidates the candidate and reruns the affected checks.

## Requirement-to-task map

| Requirement | Tasks |
|---|---|
| Secure Electron host, typed/validated IPC, denied navigation/popups/permissions | 4, 10 |
| Shared full English/Portuguese UI and live persisted locale | 1, 5, 8–10 |
| SQLite settings, conversations, encrypted keys, migrations | 5, 7, 10 |
| AI chooses one of four catalog plugins; chat/adjust/resume | 2, 7, 9 |
| Plugin status/open/mapping and MIDI scene application | 3, 6, 9–10 |
| Signal-first standalone zoneless Angular; services own bridge | 4, 8–10 |
| Faithful evolved 420×700 UI, 360×520 minimum, themes/dim/accessibility | 4, 8–10 |
| No hardware/network/real-key test dependency | 2–7, 10 |
| Packaging deferred and macOS unverified | all tasks, final docs in 10 |

Every task maps to at least one approved requirement. Dependencies are sequential because Tasks 1–4
establish contracts/seams consumed by later slices; implementation may dispatch read-only research
in parallel, but writers remain serialized unless the post-plan gate chooses a worktree and paths are
disjoint.

## Plan stress result

- Resolved: browser-safe catalog ownership → `@opentimbre/i18n`.
- Resolved: supported Angular build/test path → official application/unit-test builders.
- Resolved: OS-specific plugin behavior → deep `PluginHost` in platform-node.
- Resolved: undefined chat plugin chooser → AI selects through catalog tools in core.
- Corrected evidence: all ten bilingual prompt files already exist; core key-store already uses
  `node:sqlite`; no prompt or second key database task is needed.
- Accepted limitation: plugin launch/mapping can be Windows-verified only; absent macOS candidates
  return explicit failure and remain documented.
- No unresolved product, architecture, data, security, cost, or acceptance decision remains.

## Setup recommendations for the post-plan gate

- Isolation: keep the existing `feat/phase3-desktop` branch; a worktree adds little while execution
  is sequential.
- Execution mode: subagents, one writer per task, because main/core/platform/UI slices benefit from
  focused contexts; coordinator integrates serially.
- Commit strategy: granular, one reviewed commit per task.
- Review: split, mandatory for high-risk IPC/secrets/SQL/frontend surfaces.