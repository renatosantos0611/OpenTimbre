# OpenTimbre Phase 4 packaging — Implementation plan

> **For the executor:** MANDATORY SUB-SKILL — use `pelizzai-execution-plans`.

**Goal:** Ship OpenTimbre as an installable Windows app (NSIS per-user + portable) with user-confirmed auto-update via GitHub Releases, built and published by GitHub Actions, with proof over the packaged runtime.

**Architecture:** `electron-builder` consumes the existing handwritten build output (`packages/desktop/dist/{main,preload,renderer}`); a new main-process update module wraps `electron-updater` behind a runtime seam (real vs inert) and streams typed status events to the renderer, where a status-bar banner drives the confirm → download → restart flow. A GitHub Actions tag workflow runs the full proof chain and publishes. The missing `app://` renderer serving contract is added first, because nothing packaged can work without it.

**Tech stack:** Electron 43, electron-builder + electron-updater (current v26 line — verify against official docs at Task 2; Context7 unavailable in this environment), Zod 3, Angular 22 (standalone/zoneless/signal-first), Playwright (`_electron`), GitHub Actions (`windows-latest`).

**Applicable domain skills:** opentimbre-code-style, opentimbre-core-boundary, opentimbre-electron-ipc, opentimbre-angular-ui, opentimbre-i18n, opentimbre-cross-platform, opentimbre-testing.

**Global Constraints (copied VERBATIM from the spec):**

- "appId `com.opentimbre.desktop`; product name OpenTimbre; version from `packages/desktop/package.json`."
- "Auto-update applies to the NSIS installation only; the portable build and unpackaged development runs receive no updates."
- "Download starts only after the renderer sends an explicit confirm message; restart-and-install starts only after an explicit install message. There is no silent installation."
- "every inbound payload is Zod-validated in main; sender validation applies as it does to all existing handlers."
- "No channel returns secret material and no update payload enters logs."
- "The update surface is a banner in the status bar area ... it never covers or rearranges the chrome."
- "All labels resolve through the i18n catalog (`en`, `pt`)."
- "No network at startup: check fails silently; app functions normally; no error UI for an unavailable feed."
- "First installer release: no migration. ... The appId and per-user install mode are fixed by this spec and must not change later."
- Out of scope: "macOS/Linux builds; code signing; MSI/enterprise deployment; beta/prerelease channels; rich release-notes rendering in the app; periodic background update checks; delta-update tuning; auto-launch at OS startup."

**Approvals** (one line each; a marker without an explicit user answer stays `pending`):

- Discovery: ratified on 2026-08-08 (10 decisions via `pelizzai-interview-me`)
- Spec: `pelizzai/specs/2026-08-08-phase4-packaging.md` approved on 2026-08-08
- Domain skills: existing catalog covers the work; `electron-builder` domain skill candidate proposed at closeout — 2026-08-08
- Plan: approved on 2026-08-08

## Exposed material gaps

- Renderer never loads in real Electron: no `protocol.handle` backs the `app://opentimbre` scheme (window.ts:43 loads it; Phase 3 e2e exercised Chromium over HTTP with a fake bridge, so the gap was invisible). Resolved by Task 1 — inside the ratified Phase 4 scope ("packaging must preserve that contract"; packaged-runtime validation is this phase's).
- electron-builder/electron-updater APIs cannot be checked against Context7 here → investigation substep at Task 2 start: re-verify current official docs for the installed version; any API divergence from this plan goes to the user via `pelizzai-interview-me` before implementation.
- Native `@julusian/midi` inside asar → asarUnpack of `**/*.node`; the packaged smoke (Task 5) is the proof. If CI's prebuild verification fails and node-gyp rebuild is triggered, `windows-latest` ships MSVC build tools (fallback recorded, no decision needed).
- A real two-version update round-trip cannot be automated before two releases exist → covered by the manual checklist (Task 6), per ratified decision D7 (e2e proves packaged launch; checklist proves the round-trip).

## Technical decisions in this plan

1. Packaging tool `electron-builder` — ratified: design approval 2026-08-08 — rejected: electron-forge — why: electron-builder consumes the existing handwritten build output and owns first-class NSIS/auto-update; Forge would impose its own bundler pipeline on the Angular/ng pipeline.
2. Windows-only targets NSIS + portable — ratified: interview 2026-08-08 (decisions 1 and 4) — rejected: +macOS, +MSI — why: product lives on Windows (loopMIDI, plugin hosts); macOS infra deferred; MSI adds scope without demand.
3. Auto-update `electron-updater` + GitHub Releases, check only at app start — ratified: interview 2026-08-08 (decisions 2 and S4) — rejected: no auto-update, periodic checks — why: lowest-infra feed (repo already on GitHub); user chose startup-only.
4. No code signing — ratified: interview 2026-08-08 (decision 3) — rejected: OV/EV certificates — why: cost before traction; SmartScreen warnings accepted and documented.
5. appId `com.opentimbre.desktop` — ratified: interview 2026-08-08 (S1) — rejected: `com.opentimbre.app` — why: specific to the desktop product; hard to reverse (anchors update chain).
6. NSIS per-user install, `oneClick: false`, directory choice allowed — ratified: interview 2026-08-08 (S2) — rejected: per-machine, installer-time choice — why: no UAC friction for the target user; updates never need elevation.
7. First public version `0.1.0` — ratified: interview 2026-08-08 (S3) — rejected: 1.0.0, 0.0.1 — why: functional surface, pre-release maturity.
8. Update UX with explicit confirmation, banner in status-bar area, dismiss per session — ratified: interview 2026-08-08 (decision 6) + spec — rejected: silent install — why: user chose confirmation; spec fixes placement.
9. Publishing GitHub Actions on `v*` tags with workflow `GITHUB_TOKEN` — ratified: interview 2026-08-08 (decision 5) — rejected: manual local upload — why: reproducible releases without custom secrets.
10. Packaged-runtime proof = Playwright smoke on the portable exe in CI + manual checklist — ratified: interview 2026-08-08 (decision 7) — rejected: manual only / unit only — why: automates what Phase 3 deferred; checklist covers installer UX.
11. Manual SemVer bump + hand-written `CHANGELOG.md`; release = tag push — ratified: interview 2026-08-08 (S5) — rejected: changelog tooling — why: no new dependency for a solo-cadence product.
12. Task 3 (not Task 4) adds the three mechanical stub members to `fake-desktop-api.ts` — origin: plan amendment 2026-08-08 (task-boundary defect; the DesktopApi addition otherwise breaks renderer typecheck under Task 3's green-tree proof duty) — rejected: ship T3 typecheck-red / weaken the contract to optional members — why: keeps every ratified contract intact and hands Task 4 a green base.

---

## Task 1: Renderer actually loads in Electron (`app://` protocol handler)

**Out of scope:** any packaging config; IPC behavior; renderer code. Do not change `APP_ORIGIN` or the window hardening.

**Files:**

- Create: `packages/desktop/src/main/renderer-protocol.ts`, `packages/desktop/src/main/renderer-protocol.test.ts`
- Modify: `packages/desktop/src/main/main.ts` (register the handler inside `app.whenReady`, before `openWindow()`)

**Domain skills to apply:** opentimbre-electron-ipc, opentimbre-cross-platform, opentimbre-testing, opentimbre-code-style

**Cross-cutting harness skills to apply:** pelizzai-oswap (path traversal is untrusted input — review lens)

**Interfaces:**

- Produces: `resolveRendererAsset(pathname: string): { file: string; contentType: string } | null` — pure, unit-tested; `null` for paths escaping the renderer root or unknown extensions
- Produces: `registerRendererProtocol(rendererDir: string): void` — wraps `protocol.handle('app', ...)`; dev and packaged share it
- Consumes: existing `protocol.registerSchemesAsPrivileged` block in `main.ts` (keep as-is)

Resolver invariants: `app://opentimbre/` and `app://opentimbre/index.html` → `index.html`; every request path is normalized and must stay inside `rendererDir` (reject `..`, absolute, backslash tricks); unknown file → `null` → 404 response. Content types at least: html, js, css, json, svg, png, ico, woff, woff2, ttf. File URL must encode spaces (portable/install paths contain spaces).

Base directory resolution (both modes): `fileURLToPath(new URL('../renderer', import.meta.url))` from `dist/main/main.js` — dev resolves to `packages/desktop/dist/renderer`; packaged resolves inside the asar (asar-aware `fs` is transparent). Do not branch on `app.isPackaged` for the path.

**Implementation and validation strategy:**

- Predominant effect: behavior
- Implementation: TDD red→green on `resolveRendererAsset` (pure seam), then wiring in `main.ts`
- Oracle: resolver tests green (traversal, default index, mime map, 404); later Task 5 proves the packaged runtime
- Command(s): `npm run test:main -w @opentimbre/desktop`
- Expected evidence: new tests pass; full `npm run check` green
- Rollback: revert the two files; the app returns to its current (broken-at-runtime) state
- Review profile: split — security-adjacent (path handling), foundational for everything after

- [ ] **Step 1: RED** → verify: tests fail for the right reason (module missing)

Write `renderer-protocol.test.ts` cases: `/` and `/index.html` → index; nested asset path resolves inside base; `/%2e%2e/..` style escapes → `null`; unknown extension → `null`; mime for `.js/.css/.woff2` correct.

- [ ] **Step 2: Implement resolver + registration** → verify: tests green

`protocol.handle('app', handler)` maps the request URL through the resolver and returns `net.fetch(pathToFileURL(file))` (or an explicit `Response` with the chosen content type); `null` → `new Response('not found', { status: 404 })`. Register before `openWindow()`.

- [ ] **Step 3: Proof** → verify: `npm run check` exit 0; `npm run lint` exit 0

Run: `npm run check && npm run lint`
Expected: all workspaces green.

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` contains only this task's scope

## Task 2: electron-builder packaging — NSIS per-user + portable, version 0.1.0

**Out of scope:** publishing configuration beyond the `publish` block; CI; code signing; any app behavior.

**Files:**

- Modify: `packages/desktop/package.json` (version → `0.1.0`; add `electron-builder` devDependency; `repository` field; scripts `dist`, `dist:win`; `"build"` config block; `"directories": { "output": "release" }`)
- Modify: `.gitignore` (add `release/`)
- Validate: local `npm run typecheck`; Task 5 CI produces the real artifacts

**Domain skills to apply:** opentimbre-code-style, opentimbre-cross-platform

**Cross-cutting harness skills to apply:** pelizzai-oswap (supply chain: new dependency justification bar — electron-builder buys NSIS toolchain + update metadata that the platform does not provide)

**Interfaces:**

- Consumes: `packages/desktop/dist/{main,preload,renderer}` produced by `npm run build -w @opentimbre/desktop` (Task 1 keeps main entry `dist/main/main.js`)
- Produces: `packages/desktop/release/OpenTimbre-0.1.0.exe` (NSIS), `packages/desktop/release/OpenTimbre-0.1.0-portable.exe`, `latest.yml` + `.blockmap`

Configuration contract (the fragile part — keep exact):

```json
"build": {
  "appId": "com.opentimbre.desktop",
  "productName": "OpenTimbre",
  "files": ["dist/**/*", "package.json"],
  "asarUnpack": ["**/*.node"],
  "directories": { "output": "release" },
  "win": { "target": [{ "target": "nsis", "arch": ["x64"] }, { "target": "portable", "arch": ["x64"] }] },
  "nsis": { "oneClick": false, "perMachine": false, "allowToChangeInstallationDirectory": true },
  "publish": { "provider": "github", "owner": "renatosantos0611", "repo": "OpenTimbre" }
}
```

Notes: output dir is `release/` (the default `dist/` collides with the Angular output). Workspace deps (`@opentimbre/core`, `platform-node`, `contracts`, `i18n`, provider SDKs, zod) are hoisted at the repo root — electron-builder bundles them from there; if hoisting surprises appear, fix within the `build` config (`files`/`extraMetadata`), not by restructuring the monorepo.

Investigation substep (before implementing): confirm current electron-builder version line and the exact config keys above against the official docs (Context7 unavailable — state the source consulted). If a key differs from this plan, apply the doc-current equivalent; if behavior differs materially, stop and escalate via `pelizzai-interview-me`.

**Implementation and validation strategy:**

- Predominant effect: config/migration
- Implementation: validate — config is only fully provable on a Windows CI runner; local Linux proof is typecheck + config sanity + dependency install health (`npm ls electron-builder`)
- Oracle: Task 5 workflow builds the artifacts; this task's local evidence is a clean install and green check/lint
- Command(s): `npm run check && npm run lint`
- Expected evidence: exit 0; `release/` ignored by git
- Rollback: revert package.json/.gitignore
- Review profile: split — supply-chain + public artifact surface

- [ ] **Step 1: Docs check** → verify: one-line note in the PR/task report citing the consulted electron-builder docs page/URL and version

- [ ] **Step 2: Apply config + version bump** → verify: `npm install` succeeds; `npm ls electron-builder` resolves

- [ ] **Step 3: Proof** → verify: `npm run check && npm run lint` exit 0

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` contains only this task's scope

## Task 3: Update contracts + main-process updater (seam, IPC, wiring)

**Out of scope:** renderer UI; publishing; the portable build's internals (it merely receives the inert runtime). Do not touch chat/rig/plugin modules.

**Files:**

- Modify: `contracts/src/ipc.ts` (types only)
- Create: `packages/desktop/src/main/updater/updater.ts`, `packages/desktop/src/main/updater/updater.test.ts`
- Modify: `packages/desktop/src/main/ipc/handlers.ts` (register `updater:download`, `updater:install` following the existing trusted-sender + `Result<T>` pattern), `packages/desktop/src/main/main.ts` (composition root wiring)
- Modify: `packages/desktop/src/app/testing/fake-desktop-api.ts` (three mechanical stub members ONLY — execution amendment 2026-08-08: the DesktopApi addition otherwise breaks renderer typecheck before Task 4; stubs carry no behavior)
- Modify: `packages/desktop/package.json` (dependency `electron-updater`)

**Domain skills to apply:** opentimbre-electron-ipc, opentimbre-core-boundary (updater lives in desktop main; core stays Electron-free), opentimbre-testing, opentimbre-code-style

**Cross-cutting harness skills to apply:** pelizzai-oswap (IPC attack surface; no secrets in payloads/logs)

**Interfaces:**

- Produces (contracts, type-only):

```ts
export type UpdaterStatus =
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

// in IpcChannels: 'updater:download': { payload: void; result: Result<void> }
//                'updater:install':  { payload: void; result: Result<void> }
// in IpcEvents:  'updater:status': UpdaterStatus
// in DesktopApi: downloadUpdate(): Promise<Result<void>>
//                installUpdate(): Promise<Result<void>>
//                onUpdaterStatus(cb: (status: UpdaterStatus) => void): () => void
```

- Produces (main): `UpdaterRuntime = { checkForUpdates(): void; downloadUpdate(): Promise<void>; quitAndInstall(): void; onStatus(cb: (s: UpdaterStatus) => void): () => void }`; `createUpdater(deps: { runtime: UpdaterRuntime; send: (channel: string, payload: unknown) => void })` → `{ download(): Promise<void>; install(): void }`; `createElectronUpdaterRuntime(): UpdaterRuntime` (thin wrapper over `electron-updater` `autoUpdater`, mapping its events to `UpdaterStatus`: update-available→available(info.version), download-progress→downloading(percent), update-downloaded→ready, error→error(message), update-not-available→nothing sent); `inertUpdaterRuntime(): UpdaterRuntime`
- Runtime selection in `main.ts`: `app.isPackaged && !('PORTABLE_EXECUTABLE_DIR' in process.env)` → electron runtime, then `checkForUpdates()` after the window opens; otherwise inert. No updater code runs in dev.
- Consumes: existing `send(channel, payload)` in `main.ts`; existing handler registration pattern (trusted sender check; void payloads need no Zod schema — mirrors `app:state`/`chat:new`)

Errors from `download()`/`install()` surface as `Result<void>` `{ error }` AND as `updater:status` error events; an unavailable update feed never throws into the app lifecycle (check failures are swallowed into silence per spec).

**Implementation and validation strategy:**

- Predominant effect: behavior
- Implementation: TDD red→green — `createUpdater` tested with a fake `UpdaterRuntime` (status forwarding, download gating, install delegation, error containment); the electron wrapper itself stays thin (no network in tests, per `opentimbre-testing`)
- Oracle: new tests green; contracts typecheck downstream workspaces
- Command(s): `npm run test:main -w @opentimbre/desktop && npm run check && npm run lint`
- Expected evidence: exit 0 across all
- Rollback: revert module + contracts diff; renderer unaffected until Task 4
- Review profile: split — new IPC surface + privileged actions (quitAndInstall)

- [ ] **Step 1: RED on contracts + createUpdater** → verify: failing tests name the missing module/types

- [ ] **Step 2: Implement contracts, seam, fake-driven tests, handler registration, main.ts wiring** → verify: tests green

- [ ] **Step 3: Proof** → verify: `npm run check && npm run lint` exit 0

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` contains only this task's scope

## Task 4: Renderer update banner (confirm → progress → restart)

**Out of scope:** settings pane entries ("check for updates" stays out — startup-only per ratified S4); restyling the shell; any change to chat/history/panes.

**Files:**

- Modify: `packages/desktop/src/preload/preload.cts` (expose the three new members per `DesktopApi`)
- Modify: `packages/desktop/src/app/desktop.service.ts` (readonly `updaterStatus` signal; `downloadUpdate()`/`installUpdate()`/`dismissUpdate()` actions; subscription registered in `init()` with teardown like the other push channels)
- Modify: `packages/desktop/src/app/shell/status-bar.ts` (update row: states available/downloading/ready/error; confirm, restart, retry, dismiss actions)
- Modify: `packages/desktop/src/app/testing/fake-desktop-api.ts` (push-status test helper; the three stub members arrive with Task 3's execution amendment)
- Create/modify: renderer tests covering the four states + dismiss + actions
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json` (keys below)

**Domain skills to apply:** opentimbre-angular-ui, opentimbre-i18n, opentimbre-code-style, opentimbre-testing

**Cross-cutting harness skills to apply:** pelizzai-frontend (states, viewport 420×700 and min 360×520, accessibility: focusable actions, readable contrast in both themes)

**Interfaces:**

- Consumes: `DesktopApi.downloadUpdate/installUpdate/onUpdaterStatus` (Task 3)
- Produces: `DesktopService.updaterStatus: Signal<UpdaterStatus | null>`; `dismissUpdate()` hides the banner for the session (client-side only; next startup re-notifies)

i18n keys (en/pt parity required — the existing catalog-parity test enforces it):

```
shell.update.available   → "Version {version} is available" / "Versão {version} disponível"
shell.update.download    → "Update" / "Atualizar"
shell.update.downloading → "Downloading update… {percent}%" / "Baixando atualização… {percent}%"
shell.update.ready       → "Restart to update" / "Reinicie para atualizar"
shell.update.restart     → "Restart" / "Reiniciar"
shell.update.error       → "Update failed" / "Falha na atualização"
shell.update.retry       → "Retry" / "Tentar novamente"
shell.update.dismiss     → "Dismiss" / "Dispensar"
```

Visual contract: one extra row inside the existing status bar (same 34px chrome rhythm, `--surface-chrome`), right-aligned action button in accent color; downloading shows percent in `--text-dim`; ready state uses accent; error uses `--danger` dot + retry. Never overlays content; at 360×520 the row still fits with ellipsis.

**Implementation and validation strategy:**

- Predominant effect: visual UI + behavior
- Implementation: pelizzai-frontend + component tests with the fake `DesktopApi` driving each state; then visual QA
- Oracle: renderer tests green for all four states + dismiss; visual check at default and minimum sizes, light/dark
- Command(s): `npm run test:renderer -w @opentimbre/desktop && npm run test:e2e -w @opentimbre/desktop && npm run check && npm run lint`
- Expected evidence: exit 0; e2e shell still green
- Rollback: revert renderer/preload/i18n diff
- Review profile: split — user-facing surface

- [ ] **Step 1: RED on service + component states** → verify: failing tests enumerate the four states and actions

- [ ] **Step 2: Implement preload members, service, banner, i18n keys** → verify: tests green

- [ ] **Step 3: Visual QA** → verify: launch `npm run desktop`; with the fake/dev inert status, inspect both themes and both window sizes (screenshot evidence in review); confirm chrome untouched

Run: `npm run build -w @opentimbre/desktop` then manual/fake-driven inspection
Expected: banner states render per contract; no layout shift of existing rows

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` contains only this task's scope

## Task 5: GitHub Actions release workflow + packaged-runtime e2e

**Out of scope:** other CI triggers (PR checks stay as future work unless trivial); signing; release-please style automation.

**Files:**

- Create: `.github/workflows/release.yml`
- Create: `packages/desktop/playwright.packaged.config.ts`, `packages/desktop/e2e-packaged/packaged.spec.ts`
- Modify: `packages/desktop/package.json` (script `"test:packaged": "playwright test -c playwright.packaged.config.ts"`)

**Domain skills to apply:** opentimbre-cross-platform, opentimbre-testing, opentimbre-code-style

**Cross-cutting harness skills to apply:** pelizzai-oswap (workflow permissions: least privilege, `contents: write` only for the release job; GITHUB_TOKEN scoped)

**Interfaces:**

- Consumes: Task 1 protocol handler (packaged app must paint), Task 2 `dist:win` path (`packages/desktop/release/`), existing harness scripts
- Produces: tag-triggered pipeline; smoke spec proving the packaged app boots

Workflow contract (`release.yml`, on `push: tags: ['v*']`, `runs-on: windows-latest`):

```
permissions: contents: write
steps:
 1. checkout + setup-node (node 22, npm cache)
 2. npm ci
 3. npm run lint && npm run typecheck && npm run test
 4. npm run build -w @opentimbre/desktop
 5. npx playwright install chromium && npm run test:e2e -w @opentimbre/desktop
 6. npx electron-builder --win --publish never     (from packages/desktop)
 7. npm run test:packaged -w @opentimbre/desktop   (launches the portable exe)
 8. env GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} → npx electron-builder --win --publish always
```

Step 8 re-runs the build+publish; acceptable duplication for a release job. If a single-pass alternative exists without re-packaging (prebuilt publish), the executor may use it — cite the docs consulted.

Execution amendment 2026-08-08: build precedes the renderer e2e (steps 4–5 swapped) — a fresh-checkout e2e serves `dist/renderer/browser`, which only exists after the Angular build; the original order was unverifiable.

Packaged smoke spec contract: `_electron.launch({ executablePath: <path to the portable exe under packages/desktop/release> })`; assert first window resolves, the document reaches a stable painted shell (e.g. the app name / status bar text from the i18n catalog is visible), then `app.close()`. No MIDI, no provider keys, no network calls beyond the update check (which must stay silent when the feed is unreachable). Glob the executable path instead of hardcoding the version (`OpenTimbre-*-portable.exe` → note portable artifact naming may be `OpenTimbre Portable <ver>.exe`; resolve via glob and assert exactly one match).

**Implementation and validation strategy:**

- Predominant effect: config/IaC + behavior (smoke spec)
- Implementation: validate — workflow proven by a real dry run: push a throwaway tag (`v0.1.0-ci-test` or similar) from the ratified destination flow ONLY after coordinator approval; locally the smoke spec is written against the glob contract
- Oracle: throwaway tag run goes green through step 7 (publish step may legitimately fail without release context on a fake tag — record observed behavior); the real `v0.1.0` run publishes artifacts + `latest.yml`
- Command(s): local — `npm run check && npm run lint` (spec typechecks); remote — Actions run evidence
- Expected evidence: workflow logs showing steps 1–7 green; release assets list afterwards
- Rollback: revert workflow + spec; delete the throwaway tag locally and remotely
- Review profile: split — public artifact pipeline + token surface

- [ ] **Step 1: Write workflow + packaged spec** → verify: spec typechecks; `npm run check` green

- [ ] **Step 2: Dry run on a throwaway tag (requires coordinator/user go-ahead — external effect)** → verify: Actions evidence pasted: steps 1–7 green, publish behavior recorded

- [ ] **Step 3: Ready for review → consolidate** → verify: `git status` contains only this task's scope

## Task 6: Release documentation — CHANGELOG, packaging README, manual checklist

**Out of scope:** user-facing marketing docs; docs beyond packaging/release.

**Files:**

- Create: `CHANGELOG.md` (root; `0.1.0` entry summarizing the desktop surface + packaging)
- Create: `docs/release-checklist.md`
- Modify: `packages/desktop/README.md` (build/install/release sections: `npm run build`, `dist:win`, release flow = bump version → changelog → tag `vX.Y.Z` → Actions publishes; first-run install steps including SmartScreen "More info → Run anyway")

**Domain skills to apply:** opentimbre-code-style, opentimbre-i18n (release-notes wording EN/PT if user-facing strings are documented)

**Cross-cutting harness skills to apply:** pelizzai-documenting-features (new stable surface: installer + release pipeline)

**Manual checklist content (contract):** fresh-install flow on a clean Windows profile (SmartScreen prompt, per-user install without UAC, optional directory choice, shortcut/launch), packaged app smoke (opens, chat pane renders), plugin host start on the packaged runtime, uninstall cleans the app (user data retention is acceptable and expected — state this explicitly), update round-trip between two published versions (publish X, install X, publish X+1, observe banner → confirm → restart → new version), rollback note (publish newer tag; downgrades unsupported).

**Implementation and validation strategy:**

- Predominant effect: documentation
- Implementation: static/scenario — markdown lint via repo eslint where applicable, link/path checks against real files, command snippets copied from the ratified pipeline
- Oracle: every command in the docs exists in the repo; checklist covers the ratified D7 manual surface
- Command(s): `npm run lint`; manual link/path inspection
- Expected evidence: exit 0; no dangling references
- Rollback: revert docs diff
- Review profile: split — publication surface; lightweight lens

- [ ] **Step 1: Draft CHANGELOG + checklist + README sections** → verify: commands/paths match repo reality

- [ ] **Step 2: Proof** → verify: `npm run lint` exit 0; reviewer walks the checklist commands against the repo

- [ ] **Step 3: Ready for review → consolidate** → verify: `git status` contains only this task's scope

---

## Requirement → task map

| Spec acceptance criterion | Task(s) |
| --- | --- |
| Clean-checkout command produces NSIS + portable | T2, proven by T5 |
| Per-user install without admin; app runs the full surface | T1, T2, T5 (smoke), T6 (checklist) |
| Tag workflow: checks → build → packaged e2e → publish (`latest.yml`) | T5 |
| Startup update notification; confirm → download → restart; recoverable errors | T3 (main/contracts), T4 (UI) |
| Packaged-runtime proof automated in CI + manual checklist | T5, T6 |
| All new strings via i18n en/pt | T4 (parity test enforces) |
| SemVer/changelog/tag release process | T2 (version), T6 |

## Stress result (focal pass, exploratory lane)

- Missing app:// handler found and absorbed as Task 1 (see Exposed material gaps).
- Unsigned update chain: accepted (ratified decision 3); documented in T6.
- Portable build excludes auto-update by construction (env detection in T3); e2e uses portable while update flow ships via NSIS — smoke proves boot, checklist proves the NSIS/update round-trip; acceptable split recorded in T5/T6.
- electron-builder in npm-workspaces monorepo: flagged in T2 notes with a contained remediation rule (fix in the `build` config, never restructure).
- Version display: `main.ts` already reports `app.getVersion()`; after T2's bump the status bar `shell.status.version` becomes true — no extra work.
- Renderer e2e (Chromium/fake bridge) stays in CI untouched; it does not and cannot prove the packaged boot — that is T5's new spec.
