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

## Scope

Packaging, installers, code signing, and auto-update are **not** part of this
phase (they are Phase 4). The app runs from source.