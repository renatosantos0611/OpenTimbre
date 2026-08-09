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
- kickoff: ratified 2026-08-09; quick-fix (native title bar/menu) resumed and ratified 2026-08-09
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
- known gap (found while validating the quick-fix, NOT caused by it — reproduced identically with
  the fix's files stashed out): `npm run desktop` crashes before any window opens —
  `TypeError: Cannot read properties of undefined (reading 'registerSchemesAsPrivileged')` at
  `packages/desktop/src/main/main.ts`'s top-level `protocol.registerSchemesAsPrivileged(...)`,
  called right after the `electron.ts` re-export import. A deferred call (`await` one
  `setImmediate` tick before the call) did NOT fix it — reverted, not committed. Root cause
  unconfirmed; leading hypothesis is that Electron's ESM `import electron from 'electron'` under
  this bundling setup does not resolve to the native API binding the way `require('electron')`
  does in CJS main processes (see `opentimbre-electron-ipc` and Task 1 of the parity plan, which
  introduced `electron.ts`). Blocks visual verification of ANY renderer change on this branch,
  including this quick-fix's title bar; the code was validated by typecheck + tests + Electron
  documentation only, not by a rendered window.

## History

- 2026-08-03 — state initialized (pelizzai-router / pelizzai-starting-branch / pelizzai-audit)
- 2026-08-03 bootstrap-harness — delivered — harness + 8 domain skills, local → data/history/2026-08-03-bootstrap-harness.md
- 2026-08-06 rebuild-phase1-foundation — done — local delivery accepted; 125 tests passed → data/history/2026-08-05-rebuild-phase1-foundation.md
- 2026-08-06 rebuild-phase2-plugins — done 2026-08-06 — PR #1 merged into origin/main at 0e1f593 → data/history/2026-08-06-rebuild-phase2-plugins.md
- 2026-08-08 phase3-desktop — done 2026-08-08 — PR #2 merged into origin/main at 49e0dea → data/history/2026-08-08-phase3-desktop.md
- 2026-08-08 phase4-packaging — done 2026-08-09 — observed: origin/main contains validated-head 1ebccaf (PR #5 at eb8242c); follow-up PR #6 merged at c687657 → data/history/2026-08-08-phase4-packaging.md
- 2026-08-09 ui-legacy-parity — delivered — legacy UI parity, 10 tasks, split review → data/history/2026-08-09-ui-legacy-parity.md

_Last updated: 2026-08-09_