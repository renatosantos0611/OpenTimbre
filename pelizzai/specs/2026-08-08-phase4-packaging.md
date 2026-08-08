# OpenTimbre Phase 4 packaging — design

**Status:** approved on 2026-08-08

## Goal

Deliver OpenTimbre as an installable Windows application with user-confirmed automatic updates,
built and published by GitHub Actions to GitHub Releases. The phase closes the distribution gap
that Phase 3 explicitly deferred: "Packaging and packaged-runtime validation are deferred to
Phase 4; Phase 4 owns distribution."

The user is a Windows guitarist who installs once, without administrator rights, and receives
updates without reinstalling manually.

## Acceptance criteria

- From a clean checkout, a single documented command produces the NSIS installer and the portable
  exe for the desktop app (`OpenTimbre-<version>-*.exe`).
- The NSIS installer installs per-user without elevation and the installed app starts, loads the
  `app://` renderer, and runs the existing chat/rig/settings flows.
- Tagging `vX.Y.Z` runs the GitHub Actions workflow: full workspace checks (typecheck, tests,
  lint), packaged build, Playwright e2e smoke against the packaged exe, and publication of the
  artifacts plus `latest.yml` to a GitHub Release.
- When a newer release exists, the app notifies on startup with version and a confirm action;
  after confirmation it downloads with visible progress and applies on restart. Failures surface a
  recoverable error state.
- The packaged-runtime proof (e2e against the packaged exe) passes in CI, and a manual release
  checklist covers installer UX (SmartScreen, shortcuts, uninstall, update round-trip).
- Every new user-facing string is resolved through the `@opentimbre/i18n` catalog in `en` and `pt`.

## Context and constraints

- Electron 43, Angular 22 renderer, monorepo npm workspaces; desktop builds are a handwritten
  pipeline (`build:main` / `build:preload` / `build:renderer`) emitting
  `packages/desktop/dist/{main,preload,renderer}`. The renderer loads from the custom
  `app://opentimbre` scheme; packaging must preserve that contract.
- `@julusian/midi` is a native N-API dependency shipping prebuilds; it packages without rebuild.
- The project is developed Windows-first (loopMIDI, plugin hosts, Windows paths). macOS and Linux
  were explicitly deferred out of Phase 4 during discovery.
- No code signing in this phase: the installer and updates are unsigned; Windows SmartScreen
  warnings are accepted until a signing phase is funded. electron-updater operates correctly
  unsigned.
- No Context7 access in this environment; electron-builder/electron-updater API details are to be
  confirmed against current official documentation at planning/execution time.

## Design and contracts

### Packaging — electron-builder

`electron-builder` lives in `packages/desktop` and reads the package's built `dist/` output; it
does not run the Angular or TypeScript builds itself (the existing build scripts remain the
single build path). Configuration targets:

- appId `com.opentimbre.desktop`; product name OpenTimbre; version from
  `packages/desktop/package.json`.
- NSIS target: assisted installer, per-user install without elevation (no UAC), directory choice
  allowed. Portable exe target for quick trials. Artifacts are named with the app name and version.
- asar archive on; native prebuilt bindings included; auto-update metadata (`latest.yml` plus the
  NSIS blockmap) generated alongside the artifacts.
- Auto-update applies to the NSIS installation only; the portable build and unpackaged development
  runs receive no updates.

### Update service — main process

A single update module in the Electron main process owns `electron-updater`:

- Checks for updates only at app start, only when `app.isPackaged` and the run is an NSIS install.
- Status flows to the renderer as typed events: available (with version), downloading (with
  progress), ready, error, and not-available. No update status crosses IPC without validation.
- Download starts only after the renderer sends an explicit confirm message; restart-and-install
  starts only after an explicit install message. There is no silent installation.
- Dev runs and the portable build expose an inert updater (no checks, no events) through the same
  seam, keeping renderer code path-independent.

### IPC contract

New typed channels follow the existing pattern: preload exposes them on the handwritten typed
`DesktopApi`; every inbound payload is Zod-validated in main; sender validation applies as it does
to all existing handlers. Channels: update status events (main → renderer), request download,
request restart-and-install. No channel returns secret material and no update payload enters logs.

### Renderer — update banner

The update surface is a banner in the status bar area, consistent with the stable vertical
hierarchy (title bar, status, plugin bar, central pane, composer): it never covers or rearranges
the chrome. States:

- available — version + confirm action; dismissible for the session.
- downloading — progress indication.
- ready — restart-to-update action.
- error — message + retry.

State arrives as read-only signals through `DesktopService`; the component renders state and emits
intent only, per the renderer architecture. All labels resolve through the i18n catalog (`en`,
`pt`).

### CI and publishing

One GitHub Actions workflow triggered by `v*` tags, running on `windows-latest`:

1. Checkout, setup-node (repository Node line), `npm ci`.
2. Full workspace proof: lint, typecheck, tests.
3. Desktop build and electron-builder packaging (publish disabled for this step's outputs until
   the smoke passes).
4. Playwright e2e smoke against the packaged exe (portable build).
5. Publish artifacts and `latest.yml` to the GitHub Release using the workflow's `GITHUB_TOKEN`.

Release cadence: manual version bump in `packages/desktop/package.json` (SemVer; first release
`0.1.0`), `CHANGELOG.md` maintained by hand, tag `vX.Y.Z` triggers the release.

### Packaged-runtime validation

Two complementary proofs:

- Automated: Playwright smoke launching the packaged exe (reusing the existing e2e harness), run in
  CI before publishing.
- Manual: a release checklist kept in the repo covering first install (SmartScreen flow),
  shortcuts/launch, plugin host operation on the packaged runtime, uninstall, and an update
  round-trip between two real versions.

## States, failures, and security

- No network at startup: check fails silently; app functions normally; no error UI for an unavailable
  feed.
- Download failure: error state with retry; existing session is never interrupted by the updater.
- Incompatible/corrupt feed (`latest.yml` malformed): contained as an error state; never crashes
  the main process.
- Unsigned binary chain: accepted risk recorded in ratified decisions; documented in the release
  checklist (SmartScreen "Run anyway" step).
- Update metadata arrives over HTTPS from GitHub; no update secrets exist in the renderer or logs.
- The CI workflow needs no custom secrets (GITHUB_TOKEN is workflow-scoped).

## Compatibility, migration, and rollback

First installer release: no migration. Rolling back a release means publishing a newer tag, since
downgrades are not supported. The appId and per-user install mode are fixed by this spec and must
not change later (they anchor the update chain).

## Testing & Validation Decisions

- Update module logic is separated from `electron-updater` I/O behind a seam so CI can drive
  status transitions with a fake updater (fixture-based, per `opentimbre-testing`); no test needs a
  real release feed, hardware, or API key.
- IPC handlers are validated with the existing Zod/handler test pattern.
- Renderer banner states are covered by component tests with a fake `DesktopApi`; e2e covers the
  packaged shell launch (existing harness extended).
- Packaging itself is proven by the CI workflow producing artifacts and the e2e smoke consuming
  them; the manual checklist covers what automation cannot (installer UX, SmartScreen, round-trip).

## Out of scope

macOS/Linux builds; code signing; MSI/enterprise deployment; beta/prerelease channels; rich
release-notes rendering in the app; periodic background update checks; delta-update tuning;
auto-launch at OS startup.

## Hard-to-reverse decisions

- appId `com.opentimbre.desktop`: anchors install location, registry identity, and the update
  chain; changing it later breaks updates for installed users.
- Per-user NSIS install mode: switching to per-machine later strands existing installations and
  their update chain.
- First public version `0.1.0`: version history and update ordering start here.

## Ratified decisions and limitations

All ratified via `pelizzai-interview-me` on 2026-08-08 (discovery + design stress):

- Platforms: Windows only this phase.
- Auto-update: `electron-updater` + GitHub Releases, check only at app start.
- Code signing: none for now; SmartScreen warnings accepted.
- Artifacts: NSIS installer + portable exe.
- Publishing: GitHub Actions on `vX.Y.Z` tags with `GITHUB_TOKEN`.
- Update UX: user confirms download and restart; banner in status-bar area; dismissible per session.
- appId `com.opentimbre.desktop`; per-user install; first version `0.1.0`; manual CHANGELOG.
- Validation: e2e against packaged exe in CI + manual release checklist.

Limitation: Context7 unavailable in this environment; electron-builder/electron-updater APIs are to
be re-verified against current official documentation during planning/execution.
