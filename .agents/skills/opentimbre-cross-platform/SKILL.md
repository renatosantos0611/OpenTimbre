---
name: opentimbre-cross-platform
description: Handles every Windows-vs-macOS difference in OpenTimbre — virtual MIDI port creation, plugin discovery paths, running-process detection, and settings folders. Use whenever you touch MIDI port opening, detect whether a plugin app is installed or running, launch an external app, build a filesystem path for plugin settings or MIDI mappings, write onboarding or setup instructions, or plan the macOS build. Also use when a task assumes loopMIDI, `%APPDATA%`, `tasklist`, or a `C:\Program Files` path. NEVER hardcode a Windows path or a Windows-only tool in shared code.
---

# OpenTimbre — Windows and macOS are not the same machine

The legacy app was Windows-only by construction. Everything below is a real divergence that must be
resolved behind a platform port, not with an inline `process.platform` check scattered across
modules.

## The big one: virtual MIDI ports

RtMidi — which `@julusian/midi` wraps — supports `openVirtualPort()` on **macOS and Linux, but not
on Windows**. The Windows MultiMedia API has no concept of an app-created virtual port.

| | Windows | macOS |
| --- | --- | --- |
| Can the app create its own port? | **No** | **Yes** (`openVirtualPort`) |
| What the user must install | loopMIDI, with a port named for the app | nothing |
| What the user must configure | create the port, then enable it as a MIDI input in the plugin | enable the app's port as a MIDI input in the plugin |

This is not a packaging detail — it changes onboarding, the setup UI, the error states, and the
"is the rig connected?" check. On macOS the app should create and own its port; falling back to
"go install a loopback driver" there is a worse product for no reason.

Design consequence: the MIDI transport exposes one operation (`connect()`), and the platform
implementation decides between *create a virtual port* and *find an existing port by name*. Callers
never learn which happened.

## Everything else, by axis

| Concern | Windows | macOS |
| --- | --- | --- |
| App install location | `C:\Program Files\...` | `/Applications/...` |
| Per-user settings root | `%APPDATA%` | `~/Library/Application Support` |
| Is the process running? | `tasklist` | `pgrep` / `ps` |
| Launching the plugin | executable path | `open -a` or the `.app` bundle path |
| Path separators | never build with `\` literals — always `node:path` | same |

The descriptor's `app` block (`candidatos`, `processo`, `settings`, `pastaMidi`, `mapeamento`) is
per-plugin data — see `opentimbre-plugin-spec`. It becomes **per-plugin, per-platform** data. Do not
try to derive the macOS path from the Windows one; they are independent facts that must be
confirmed on a real machine.

**Do not invent macOS paths.** Any macOS plugin path, process name, or settings folder written from
inference is a bug waiting for a Mac user. Mark it as unverified and confirm it by probing on
macOS, exactly as the legacy confirmed the Windows CC map by probing.

## Where the branching lives

One platform module resolves the differences and exports intent-shaped functions:

```text
platform/
├── index.ts          picks the implementation once, at startup
├── windows.ts        tasklist, %APPDATA%, named loopMIDI port
└── macos.ts          pgrep, ~/Library/Application Support, virtual port
```

Domain modules call `isPluginRunning(spec)` and `settingsDir(spec)`. They never read
`process.platform`. A `process.platform` check inside a domain rule is the same failure as a
hardcoded CC number: knowledge in the wrong layer.

Keep the ugliness inside the platform module. The legacy doctrine states it plainly: ugly inside a
module is acceptable; ugly leaking to five callers is not.

## Unsupported platforms fail honestly

When a capability genuinely does not exist on the running platform, say which platform, which
capability, and what the user can do — do not silently no-op and do not crash the window. The app
must still open with the MIDI transport disconnected; the guitarist keeps seeing the screen.

## Setup documentation is platform-split

Onboarding text, README prerequisites, and in-app setup screens are written per platform. A single
merged list that mentions loopMIDI to a Mac user is a support burden, not a shortcut.

## Related

`opentimbre-plugin-spec` (the `app` block that this skill splits per OS),
`opentimbre-core-boundary` (the platform module is a host concern, injected into the core),
`opentimbre-testing` (platform code is faked in tests; the rules it serves stay hardware-free).
