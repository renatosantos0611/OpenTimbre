# Task state — PelizzAI

> Cursor of the active task. Lives in `pelizzai/data/state.md`.
> Doctrine — who writes each field, the Delivery lifecycle (`delivered` → `done`), reconciliation,
> and history hygiene — lives in `pelizzai-execution-plans` → SKILL.md §State and resumption.
> No active task = `slug: <none>`. `phase: blocked` = stuck, awaiting a human decision.

## Active task

- slug: phase3-desktop
- track: feature
- lane: standard
- phase: executing
- branch: feat/phase3-desktop
- base-ref: refs/remotes/origin/main
- base-sha: 0e1f59378fa49aa4b457781ab3555c9934e35b28
- validated-head: <none>
- delivery-head: <none>
- confirm: <pending>
- kickoff: ratified 2026-08-06
- isolation: branch
- worktree-path: <none>
- execution-mode: subagents
- commit-strategy: granular
- review-profile: split
- effect: write-local
- risk: high
- overlays: pelizzai-frontend, pelizzai-oswap, pelizzai-documenting-features
- audience: technical
- spec: pelizzai/specs/2026-08-06-phase3-desktop.md
- plan: pelizzai/plans/2026-08-06-phase3-desktop.md
- project: c:/Users/dingo/github/opentimbre

## Progress

- scope: new desktop package + IPC contracts + core i18n + root config + PelizzAI artifacts; CLI, MIDI, packaging, installers, and auto-update excluded
- decision: preserve the legacy hierarchy and workflow through an evolved faithful visual direction
- decision: Electron main owns platform capabilities; preload exposes a handwritten typed API; Angular services alone access the bridge
- decision: packaging, installers, and auto-update are deferred to Phase 4
- decision: plaintext keys cross IPC only once through keys:save and never return or enter observability
- decision: settings, encrypted key records, and conversations persist in versioned SQLite via Electron's node:sqlite
- decision: shared runtime catalogs move to @opentimbre/i18n; contracts remains type-only
- decision: Angular uses the official application/unit-test builders; platform-node exposes a deep PluginHost
- decision: AI selects the plugin through one catalog tool per PluginSpec in a persistent core chat session
- Task 1 ✅ 2026-08-06 — shared browser-safe i18n, catalog parity, locale IPC contract, and DesktopApi; full workspace tests/typechecks pass
- Task 2 ✅ 2026-08-06 — catalog-driven RigChat, provider-native history resume, model listing, and adapter fixtures; core tests/typecheck pass
- Task 3 ✅ 2026-08-06 — injected cross-platform PluginHost, launch/mapping lifecycle, Windows/macOS factories, and real catalog boundary checks; 29 tests pass
- Task 4 ✅ 2026-08-07 — secure 420x700 shell (min 360x520), typed DesktopApi, Zod payload validation, sender/nav/permission lockdown, ESLint coverage for .cts; 6 tests pass, build clean, zero lint warnings
- Task 5 ✅ 2026-08-07 — SQLite settings store with versioned migrations, IPC handler registry (settings/config/keys stubs + deferred chat/rig/plugin/conversation), main.ts integration; 13 tests pass, build+lint clean
- Task 6 ✅ 2026-08-08 — PluginManager (catalog resolve, status polling emits only changed state, window-lifetime start/stop) + SceneApplier (rig apply, planScene CCs, unmapped-amp/manual warnings, contained MIDI failures); 12 new tests pass 25/25, typecheck+lint clean, split review approved
- Task 7 ✅ 2026-08-08 — ChatController + ConversationRepository (one-transaction per turn, opaque provider history, memoryLost on incompatible history, delete-open clears rig) + real chat/conversation IPC handlers + status events + onPhase core hook; 15 new main tests (40/40) + 2 core tests (214/214), check+lint clean, split review approved (spec fix: chat:send .max(4000) per interview)
- Task 8 ✅ 2026-08-08 — signal-first zoneless standalone renderer shell: DesktopService (single bridge, DESKTOP_API token, push signals + teardown), I18nService, AppShell with three mounted panes (chat/history/settings) + TitleBar/StatusBar/PluginBar/Composer, role-based light/dark tokens on :root[data-theme], dimmed state, Lucide icons, fake DesktopApi, Playwright e2e; 18 renderer tests + build + e2e shell (420x700/360x520) pass, check+lint clean, split review approved (spec fix: locale labels → i18n catalog)
- Task 9 ✅ 2026-08-08 — chat/history UI: DesktopService transcript + busy + applyRig (try/finally, newChat clears, open/delete keep transcript), Composer new-chat button + duplicate-send guard, ChatPane user/ai/error rows + memoryLost banner, RigCard (derived scenes, apply confirms on success), HistoryPane list/open + accessible alertdialog delete; 13 i18n keys in both catalogs; 30 renderer tests + build + 7 e2e + check + lint clean, 1 spec-review round (4 fixes) re-approved
- next: execute Task 10 with TDD, split review, visual proof, and a granular commit
- pending: Task 10
- bugfix ✅ 2026-08-08 (kickoff ratified) — pre-existing gates: windows.ts settingsDir now uses path.win32.join (portable, mirrors macos.ts); core rig-schema.ts minimal type-escape for zodToJsonSchema TS2589 (zod 3 vs zod 4 peer)

## History

- 2026-08-03 — state initialized (pelizzai-router / pelizzai-starting-branch / pelizzai-audit)
- 2026-08-03 bootstrap-harness — delivered — harness + 8 domain skills, local → data/history/2026-08-03-bootstrap-harness.md
- 2026-08-06 rebuild-phase1-foundation — done — local delivery accepted; 125 tests passed → data/history/2026-08-05-rebuild-phase1-foundation.md
- 2026-08-06 rebuild-phase2-plugins — done 2026-08-06 — PR #1 merged into origin/main at 0e1f593 → data/history/2026-08-06-rebuild-phase2-plugins.md

_Last updated: 2026-08-08_
