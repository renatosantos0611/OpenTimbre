# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## [0.1.1] - 2026-08-09

Fixes the app so it boots on Windows, and restores the legacy app's chrome
and screens in the Angular rebuild.

### Fixed

- The main process no longer crashes on boot under Electron 43's ESM loader:
  `electron` is consumed via a single default-import re-export
  (`packages/desktop/src/main/electron.ts`) instead of named imports, which
  the ESM loader could not resolve.

### Added

- Legacy chrome: the text tab strip is replaced by a hamburger app menu
  (Settings, About) and three status-bar actions (history, new conversation,
  settings); secondary panes get a shared heading with a back button.
- About screen, chat empty-state invite with suggestion chips, composer
  actions row with a Manual/Auto application-mode menu, and a searchable
  model picker grouped by cost tier (via the new `ai:listModels` channel).
- Settings regrouped into the legacy's four sections (Your guitar, AI,
  Appearance, Window) with key-row badges.

### Changed

- `@opentimbre/desktop` version set to `0.1.1`.

## [0.1.0] - 2026-08-08

First installer release. The desktop app now ships as an installable Windows
application with user-confirmed updates.

### Added

- Windows distribution built with electron-builder from `packages/desktop`
  (appId `com.opentimbre.desktop`): a per-user NSIS installer that needs no
  elevation and allows a directory choice, plus a portable exe.
- Tag-triggered GitHub Actions release pipeline
  (`.github/workflows/release.yml`): lint, typecheck, and tests, desktop
  build, renderer e2e, packaging, a Playwright smoke against the packaged
  portable exe, then publication of the artifacts and `latest.yml` to the
  tag's GitHub Release using the workflow's `GITHUB_TOKEN`.
- User-confirmed in-app updates via electron-updater over GitHub Releases:
  check at app start only; a status-bar banner shows the new version, and the
  download and the restart-to-install each require explicit confirmation.
  No silent installation. Updates apply to the NSIS installation only — the
  portable build and development runs receive no update checks.
- Renderer served over the custom `app://opentimbre` scheme in both dev and
  packaged runs, with path-traversal defenses.
- Desktop surface distributed in this release: rig conversation backed by
  Anthropic/OpenAI, plugin control for the four Neural DSP plugins with MIDI
  mappings (loopMIDI on Windows), settings with API keys encrypted via the OS
  keychain, English and Portuguese UI.

### Changed

- The desktop app runs as an installed Windows app, not only from source;
  `npm run desktop` remains the development entry point.
- `@opentimbre/desktop` version set to `0.1.0` — the starting point of the
  version history and the update chain.
