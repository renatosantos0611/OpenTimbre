# PelizzAI — Domain-skill maintenance ledger

> Keeps the rhythm of domain-skill review from depending on human memory.
> Read by `pelizzai-writing-skills` (cadence) and by `pelizzai-audit` (bootstrap).
> Seeded at bootstrap with the bootstrap date — the bootstrap IS the first review.

- **last-review:** 2026-08-03
- **last-full-scan:** 2026-08-03

## Domain skills

| Skill | Created | Last updated | Last commit/ref reviewed | Axis of last change | Origin |
| ----- | ------- | ------------ | ------------------------ | ------------------- | ------ |
| opentimbre-core-boundary | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan (legacy) |
| opentimbre-electron-ipc | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan + official docs |
| opentimbre-plugin-spec | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan (legacy) |
| opentimbre-cross-platform | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan + official docs |
| opentimbre-secrets | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan (legacy) |
| opentimbre-angular-ui | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | official docs + registry |
| opentimbre-testing | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan (legacy) |
| opentimbre-code-style | 2026-08-03 | 2026-08-03 | 82d6085 | bootstrap | repo-scan (legacy) |

## Known gaps

- **`opentimbre-packaging` not created.** Proposed at bootstrap, deferred by the user: it presumes
  a packaging tool (electron-builder vs Electron Forge) not yet chosen. Re-propose at the
  design→plan edge, grounded for the chosen tool.
- **`opentimbre-code-style` carries `<pending ratification>`** on the language of comments and
  user-facing text. Resolve during discovery; update the skill and this ledger together.
- **Context7 was unavailable at bootstrap.** Stack skills (`opentimbre-electron-ipc`,
  `opentimbre-cross-platform`, `opentimbre-angular-ui`) were grounded in current official
  documentation and the npm registry instead. `opentimbre-angular-ui` is the weakest of the three:
  Angular 22 postdates the model's knowledge cutoff and the official release post was behind a
  redirect, so its defaults come from corroborated secondary sources. Re-ground it against
  angular.dev (or Context7, once installed) before the first Angular task.
- **Trigger tests not run.** The authoring flow calls for a fresh-context probe per skill; that
  requires spawning subagents, which was not authorized in this session. The descriptions were
  written against the near-miss guidance but have not been empirically validated.

## Log

- 2026-08-03 — ledger initialized by `pelizzai-writing-skills` at bootstrap (orchestration:
  `pelizzai-audit`; baseline = bootstrap date). Eight domain skills created from the `legacy/`
  repo-scan and current official documentation; one deferred.
