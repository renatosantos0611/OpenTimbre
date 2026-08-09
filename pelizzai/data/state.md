# Task state — PelizzAI

> Cursor of the active task. Lives in `pelizzai/data/state.md`.
> Doctrine — who writes each field, the Delivery lifecycle (`delivered` → `done`), reconciliation,
> and history hygiene — lives in `pelizzai-execution-plans` → SKILL.md §State and resumption.
> No active task = `slug: <none>`. `phase: blocked` = stuck, awaiting a human decision.

## Active task

- slug: ui-legacy-parity
- track: feature
- lane: exploratory
- phase: delivered
- branch: spec/ui-legacy-parity
- base-ref: refs/remotes/origin/main
- base-sha: c687657c129f99c8b449ba205469b027470b2faa
- validated-head: a4d03b99fb3e4cf708e4dce21bc88cb90dd3e31c
- delivery-head: <none>
- delivery-status: <will be recorded after the destination>
- confirm: base-ref contains validated-head (PR/branch integrated)
- kickoff: ratified 2026-08-09; quick-fix (native title bar/menu) resumed and ratified 2026-08-09; quick-fix (history nav + plugin-bar scoping) resumed and ratified 2026-08-09 on current branch; quick-fix (live plugin bar/history refresh/safe conversation switching/auto-apply feedback/model-select width) resumed and ratified 2026-08-09 on current branch — interview-me on scope of "switch conversations while one awaits a response": user chose free navigation without concurrent sending (not full concurrency)
- isolation: branch
- worktree-path: <none>
- execution-mode: inline
- commit-strategy: granular
- review-profile: split
- effect: external
- risk: medium
- overlays: pelizzai-frontend, pelizzai-oswap, opentimbre-angular-ui, opentimbre-electron-ipc, opentimbre-secrets, opentimbre-i18n, opentimbre-testing, opentimbre-code-style
- audience: technical
- spec: pelizzai/specs/2026-08-09-ui-legacy-parity.md
- plan: pelizzai/plans/2026-08-09-ui-legacy-parity.md
- project: C:/Users/dingo/github/opentimbre

## Progress

- 10 plan tasks: done, sealed at a4d03b9 (fbf10b6 = seal commit); awaiting destination decision
- quick-fix (post-delivery): remove native OS title bar text and default File/Edit/View/Window
  menu — `titleBarStyle: 'hidden'` + `titleBarOverlay` (keeps native minimize/maximize/close),
  `Menu.setApplicationMenu(null)` — done; typecheck clean, 75/75 main-process tests green
- quick-fix (post-delivery): history click now switches back to the chat pane after opening a
  conversation; the top plugin bar shows only the plugin the AI suggested for the open
  conversation (`OpenConversation.plugin`) instead of the whole catalog; each history row now
  shows its own suggested plugin — done at 960f8ab; typecheck clean (desktop + contracts), 79/79
  main-process tests, 74/74 renderer tests green
- quick-fix (post-delivery): live plugin bar/history refresh, safe conversation switching, auto-apply
  feedback, model-select width — plugin bar and history rows now update from each response's rig
  instead of only on explicit reopen; history list refreshes after every send; a response for a
  conversation the guitarist has navigated away from is dropped (generation-counter guard) instead
  of corrupting the visible transcript, and the main process only applies a finished send's
  rig/auto-apply if that conversation is still active (`active === a` guard) — true concurrent
  sending stays out of scope by design, ratified via interview-me; Auto mode's silent apply now
  updates the status-bar amp pill; model-picker button given a fixed width — done at b5eeb83;
  typecheck clean (core + contracts + desktop), 81/81 main-process tests, 77/77 renderer tests
- false alarm, resolved: `npm run desktop` appeared to crash before any window opened —
  `TypeError: Cannot read properties of undefined (reading 'registerSchemesAsPrivileged')` — when
  launched from the agent's own sandboxed shell (no display attached). The user confirmed
  `npm run desktop` boots normally on their machine, so this was environment-specific to the
  sandbox, not a defect in the app or in this quick-fix. No code change needed; the earlier
  speculative `setImmediate` deferral attempt was already reverted, not committed.

## History

- 2026-08-03 — state initialized (pelizzai-router / pelizzai-starting-branch / pelizzai-audit)
- 2026-08-03 bootstrap-harness — delivered — harness + 8 domain skills, local → data/history/2026-08-03-bootstrap-harness.md
- 2026-08-06 rebuild-phase1-foundation — done — local delivery accepted; 125 tests passed → data/history/2026-08-05-rebuild-phase1-foundation.md
- 2026-08-06 rebuild-phase2-plugins — done 2026-08-06 — PR #1 merged into origin/main at 0e1f593 → data/history/2026-08-06-rebuild-phase2-plugins.md
- 2026-08-08 phase3-desktop — done 2026-08-08 — PR #2 merged into origin/main at 49e0dea → data/history/2026-08-08-phase3-desktop.md
- 2026-08-08 phase4-packaging — done 2026-08-09 — observed: origin/main contains validated-head 1ebccaf (PR #5 at eb8242c); follow-up PR #6 merged at c687657 → data/history/2026-08-08-phase4-packaging.md
- 2026-08-09 ui-legacy-parity — delivered — legacy UI parity, 10 tasks, split review → data/history/2026-08-09-ui-legacy-parity.md

_Last updated: 2026-08-09_