# OpenTimbre desktop

The Electron + Angular desktop surface: a secure 420×700 window (minimum
360×520) for the rig conversation, plugin control, and settings.

## Prerequisites

- **Windows** (primary target). The four Neural DSP plugins (Gojira, Soldano,
  Tim Henson, Petrucci) use the plugin vendors' own installers and app paths.
  Plugin launch and MIDI-mapping installation are verified on Windows only.
- **loopMIDI** (or another virtual MIDI port) if you want an actual MIDI output
  to the plugin. The app opens its own virtual port on other platforms and
  degrades gracefully when MIDI is absent.
- **Node 22+ and npm** to build and run from source.
- **An API key** from Anthropic or OpenAI to use chat. Save it in the app's
  Settings → API keys; it is encrypted with the OS keychain (DPAPI on Windows,
  Keychain on macOS) and never shown in plaintext again.

## Run

```sh
npm install
npm run desktop
```

The dev script builds the main/preload processes, starts the Angular dev
server, and launches Electron pointed at the renderer URL.

## Tests

```sh
npm run test:main -w @opentimbre/desktop   # main-process node:test
npm run test:renderer -w @opentimbre/desktop  # Angular Vitest
npm run build:renderer -w @opentimbre/desktop  # build for the e2e
npm run test:e2e -w @opentimbre/desktop     # Playwright browser proof
```

The Playwright e2e needs the renderer built first (the `webServer` serves the
built `dist/renderer/browser`). No test requires MIDI hardware, a running
plugin, a network, or a real API key — the bridge is stubbed.

## macOS

The macOS code path is included but **not verified** in this phase: plugin
candidates, running-process detection, and path resolution for macOS have not
been exercised on real hardware, and plugins whose descriptors have no
verified macOS candidate return an explicit "not confirmed" failure rather
than guessing. Use on Windows for the verified experience.

## Build

```sh
npm run build -w @opentimbre/desktop    # main/preload/renderer into dist/
npm run dist:win -w @opentimbre/desktop # build + electron-builder --win
```

`dist:win` writes the NSIS installer, the portable exe, and the update
metadata (`latest.yml` plus blockmap) into `packages/desktop/release/`
(git-ignored). Windows targets only in this phase.

## Install (Windows)

The builds are unsigned; code signing is not part of this phase.

1. Download the installer from the tag's GitHub Release.
2. Windows SmartScreen warns about an unrecognized app: click **More info**,
   then **Run anyway**.
3. The installer runs per-user without UAC elevation and offers a directory
   choice.
4. Launch OpenTimbre from the created shortcut.

## Updates

The installed app checks for updates at startup only. When a newer release
exists, a status-bar banner shows the version; the user confirms the
download (progress shown) and then confirms the restart that applies it.
There is no silent installation. The portable build and development runs
receive no update checks. See `docs/release-checklist.md` for manual
release validation.

## Release

1. Bump `version` in `packages/desktop/package.json` (SemVer).
2. Add the entry to `CHANGELOG.md` (root).
3. Commit.
4. `git tag vX.Y.Z && git push origin vX.Y.Z`.

The tag runs `.github/workflows/release.yml`: lint, typecheck, tests,
desktop build, renderer e2e, packaging, a Playwright smoke against the
packaged portable exe (`test:packaged`), then publication of the artifacts
and `latest.yml` to the tag's GitHub Release. Downgrades are unsupported;
rolling back means publishing a newer tag.