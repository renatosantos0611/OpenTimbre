# Task history — ui-legacy-parity

> Intact block migrated from `pelizzai/data/state.md` at the `delivered` seal (2026-08-09).
> `done` is observed at the next opening against `confirm:`.

## Active task

- slug: ui-legacy-parity
- track: feature
- lane: exploratory
- phase: delivered
- branch: spec/ui-legacy-parity
- base-ref: refs/remotes/origin/main
- base-sha: c687657c129f99c8b449ba205469b027470b2faa
- validated-head: a4d03b99fb3e4cf708e4dce21bc88cb90dd3e31c
- delivery-head: <anotado no fechamento>
- delivery-status: pr-open — PR #8 abre a entrega
- confirm: base-ref contains validated-head (PR/branch integrated)
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
- T3 ✅ 2026-08-09 — legacy chrome: hamburger+menu titlebar, status-bar icon actions, tab strip removed, PaneHeader back buttons; 54 renderer + 14 e2e tests, live boot green
- T4 ✅ 2026-08-09 — About pane mounted (menu re-enabled), version + tagline from catalog; 57 renderer + 14 e2e tests
- T5 ✅ 2026-08-09 — chat empty state: invite block with icon/heading/paragraph/chips; chips fill the composer draft (moved to DesktopService); 60 renderer + 14 e2e tests
- T6 ✅ 2026-08-09 — composer restructured (textarea/actions/hint), Manual/Auto mode menu bound to autoApply; 63 renderer + 14 e2e tests
- T7 ✅ 2026-08-09 — `ai:listModels` channel: model-catalog with label/tier rules (tier decision ratified), allSettled degradation, no key leaks; 73 main tests, typecheck
- T8 ✅ 2026-08-09 — model picker in composer: searchable, grouped by tier, degraded states, persists via setModel; 69 renderer + 14 e2e tests
- T9 ✅ 2026-08-09 — Settings parity: four groups (guitar/AI/appearance/window), key-row badges, provider labels, window toggles; autoApply moved to composer only; 70 renderer + 14 e2e tests
- T10 ✅ 2026-08-09 — full `npm run check` exit 0 (all unit suites incl. 70 renderer), e2e 14 pass, lint 0, fresh-profile boot green; no code fix needed. Packaged smoke (`dist:win`+`test:packaged`) is Windows-only — node-gyp can't cross-compile @julusian/midi on Linux; covered by CI release.yml on windows-latest
- open gaps: none blocking; residuals listed in the plan under `## Exposed material gaps`