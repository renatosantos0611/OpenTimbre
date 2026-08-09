# Task state — PelizzAI

> Cursor of the active task. Lives in `pelizzai/data/state.md`.
> Doctrine — who writes each field, the Delivery lifecycle (`delivered` → `done`), reconciliation,
> and history hygiene — lives in `pelizzai-execution-plans` → SKILL.md §State and resumption.
> No active task = `slug: <none>`. `phase: blocked` = stuck, awaiting a human decision.

## Active task

- slug: ui-legacy-parity
- track: feature
- lane: exploratory
- phase: planned
- branch: spec/ui-legacy-parity
- base-ref: refs/remotes/origin/main
- base-sha: c687657c129f99c8b449ba205469b027470b2faa
- validated-head: <none>
- delivery-head: <none>
- delivery-status: local — planning branch published at base
- confirm: <none>
- kickoff: ratified 2026-08-09
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

- scope: planning only — restore legacy visual/navigational parity in the Angular renderer,
  unblock screen switching, expose the AI key inputs in Settings, settle the unfocus behavior.
  No product code in this task.
- done: reproduction (app does not boot — ESM/electron named import), discovery closed with 5
  ratified decisions, spec written, plan written with 10 vertical tasks
- next: post-plan gate ratified 2026-08-09 (branch / inline / granular / split, kickoff ratified);
  starting Task 1
- T1 ✅ 2026-08-09 — ESM boot fix: single re-export `electron.ts`, value imports repointed; 64 main tests, typecheck, live boot green (0 SyntaxError)
- T2 ✅ 2026-08-09 — fresh profile: `dim_on_unfocus` default true, `locale` default en + OS-resolved fallback via `resolveLocale`/`hasStored`; 67 main tests
- open gaps: none blocking; residuals listed in the plan under `## Exposed material gaps`

## History

- 2026-08-03 — state initialized (pelizzai-router / pelizzai-starting-branch / pelizzai-audit)
- 2026-08-03 bootstrap-harness — delivered — harness + 8 domain skills, local → data/history/2026-08-03-bootstrap-harness.md
- 2026-08-06 rebuild-phase1-foundation — done — local delivery accepted; 125 tests passed → data/history/2026-08-05-rebuild-phase1-foundation.md
- 2026-08-06 rebuild-phase2-plugins — done 2026-08-06 — PR #1 merged into origin/main at 0e1f593 → data/history/2026-08-06-rebuild-phase2-plugins.md
- 2026-08-08 phase3-desktop — done 2026-08-08 — PR #2 merged into origin/main at 49e0dea → data/history/2026-08-08-phase3-desktop.md
- 2026-08-08 phase4-packaging — done 2026-08-09 — observed: origin/main contains validated-head 1ebccaf (PR #5 at eb8242c); follow-up PR #6 merged at c687657 → data/history/2026-08-08-phase4-packaging.md
- 2026-08-09 ui-legacy-parity — discovery — planning branch spec/ui-legacy-parity opened at c687657

_Last updated: 2026-08-09_
