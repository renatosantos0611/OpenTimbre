---
name: opentimbre-core-boundary
description: Keeps the OpenTimbre domain core free of Electron, Angular, and Node-host assumptions so it stays testable and reusable by the desktop app, the CLI, and the tests. Use whenever you add a module under the core/domain layer, wire a capability that only Electron provides (safeStorage, app paths, dialog, shell, powerMonitor), decide where a new file belongs, feel tempted to write `import ... from 'electron'` outside the main process, or ask "should this live in core or in main?". Also use when a core module suddenly needs a platform capability. NEVER let the core import Electron or Angular — inject the capability instead.
---

# OpenTimbre — core boundary

## The invariant

**The domain core never imports `electron` and never imports Angular.** When the core needs a
capability only the host can provide, the host **injects** it through a narrow port defined by the
core.

This is not architectural taste. The legacy project proved the payoff and the failure mode:

- `src/chaves.ts` owns the API-key secret but cannot encrypt. Encryption lives in Electron's
  `safeStorage`. So the core declares a two-method port, `Cofre { proteger, revelar }`, and the
  main process injects it via `configurar({ cofre })`. Result: the key store is unit-testable with
  `:memory:` SQLite and no Electron, and the CLI can run the same module with `cofre = null`.
- The moment a core module imports `electron`, every test of that module needs an Electron runtime,
  and the CLI entry point stops booting. The failure is silent at write time and total at run time.

## Where code goes

| Question | Answer |
| --- | --- |
| Is it a rule about tone, plugins, scenes, MIDI values, conversations, or providers? | **core** |
| Does it need a window, a menu, a tray, an OS path, a dialog, or the keychain? | **main** |
| Does it render, animate, or bind to a template? | **renderer (Angular)** |
| Does it decide *what* to send and something else *sends* it? | decision → **core**; I/O → the layer that owns the device |

If a core module needs a host capability, do not move the module to `main`. Define the port in the
core, implement it in `main`, and inject it at startup.

## Writing a port

A port is the smallest interface that expresses the need — not a wrapper around the host API.

```ts
// core/ports/vault.ts — the core declares what it needs, in its own words.
export type Vault = {
  protect(plain: string): Uint8Array
  reveal(sealed: Uint8Array): string
}
```

```ts
// main/vault.electron.ts — the host satisfies it.
import { safeStorage } from 'electron'
export const electronVault: Vault = {
  protect: (plain) => safeStorage.encryptString(plain),
  reveal: (sealed) => safeStorage.decryptString(Buffer.from(sealed)),
}
```

Rules that make ports pay off:

- **Two or three methods, never a mirror of the host API.** A port with ten methods has moved the
  host's complexity into the core instead of hiding it.
- **The port is named for the need, not the provider.** `Vault`, not `SafeStorageWrapper`.
- **Absence is a supported state, not a crash.** The legacy stores keys unencrypted and *marks the
  row* `protegida = 0` when there is no vault, so the UI can warn honestly instead of pretending.
  Design every port so the no-host case degrades visibly.

## Injection happens once, at startup

The host wires ports in its bootstrap, before any feature code runs. Feature modules receive
already-configured collaborators; they never reach for a global to find the host.

Do not import the concrete implementation from a core module "just for types" — that creates the
build-time edge you were avoiding. Types come from the port file.

## The check before you commit

Ask, for every file you touched under the core:

1. Does it import `electron`, `@angular/*`, or a renderer-only global? → move the dependency behind
   a port.
2. Can its test run without launching Electron? → if not, the boundary already broke.
3. Does it read `process.platform` to change a rule? → that belongs to the platform layer
   (`opentimbre-cross-platform`), not to a domain rule.

## When this skill does not apply

Main-process code is *supposed* to import Electron — that is its job. This skill governs the core,
and the direction of the dependency, not the existence of Electron in the repository.

## Related

`opentimbre-electron-ipc` (how main and renderer talk), `opentimbre-secrets` (the vault port in
practice), `opentimbre-testing` (why the boundary is what makes tests cheap).
