# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## [0.1.3] - 2026-08-30

Fixes amp switching, which regressed in 0.1.2: applying a scene sent the
intended knob CCs but left the plugin on the wrong amp — the amp-change CC
was skipped because the strategy fell back to `manual` (no MIDI), so every
apply silently kept whatever amp was showing.

### Changed

- `@opentimbre/desktop` version set to `0.1.3`.

### Fixed

- Amp switching is driven by a strategy declared per plugin in the catalog
  (`ampStrategy: manual | continuous | increment`), so applying a scene
  sends the amp-selector CC before the planned knob CCs; the four shipping
  archetypes (Gojira, Soldano, Tim Henson, Petrucci) declare `continuous`.
- The legacy `AMP_STRATEGY`/`GOJIRA_AMP_STRATEGY` environment overrides
  still take precedence, so existing setups keep working as before.
- Unmapped amps fall back to the first mapped amp and send the selector CC
  for the resolved amp, with a visible warning.
- Chat feedback polish: the pane auto-scrolls to the newest message and
  animates the assistant's in-progress state.

## [0.1.2] - 2026-08-22

Fixes the two chat defects reported after 0.1.1: turns failing with a
misleading connection/key message, and responses truncated mid-tool killing
the turn without building the message.

### Changed

- `@opentimbre/desktop` version set to `0.1.2`.

### Fixed

- A failed chat turn now names its real cause — rejected key, no access on
  the account, model unavailable for the key, request rate limit, no
  connection, response cut off, or invalid rig — instead of always showing
  the generic "check your connection and API key" line.
- Responses cut off at the model's output cap (OpenAI `status: incomplete`,
  Anthropic `stop_reason: max_tokens`) no longer die as a garbled tool call
  or an empty message; they surface a dedicated message. OpenAI's
  content-filter cutoff gets its own message, and Anthropic's output ceiling
  rises from 16k to 32k tokens.

### Security

- Resolved the high-severity `nanoid` advisory via `npm audit fix`; the
  affected copy is dev tooling only (transitive through `@angular/build`),
  never bundled into the shipped product.

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
