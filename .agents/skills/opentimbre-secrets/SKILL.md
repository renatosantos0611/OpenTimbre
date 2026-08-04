---
name: opentimbre-secrets
description: Governs API keys and any other secret in OpenTimbre — encrypted at rest via the OS keychain, never sent to the renderer, never logged, never in a trace. Use whenever you touch API-key storage or retrieval, add an AI provider, build a settings screen that shows key state, send anything over IPC that could carry a credential, write logging or tracing, handle `.env` files, or decide which provider the app uses. Also use when reviewing a diff that mentions safeStorage, keychain, DPAPI, `process.env`, or a provider SDK client. NEVER let a plaintext key cross IPC and NEVER log a key or a request that embeds one.
---

# OpenTimbre — secrets

## The three hard rules

1. **A plaintext key never crosses IPC.** The renderer receives a *hint* (`sk-ant-…9f3a`) and
   status flags. It never receives, and never needs, the key itself.
2. **A plaintext key never reaches a log, a trace, or an error message.** Provider SDKs put keys in
   request headers; a trace that dumps a request dumps the key.
3. **One module owns the secret.** Nobody else reads or writes the store. The key in the clear
   leaves that module only into `process.env`, where the SDKs look for it.

## At rest

Storage is SQLite (`node:sqlite`, `STRICT` table), not JSON. The legacy stated the reasoning and it
still holds:

- Other config files are inspectable on purpose — a guitarist opens them in a text editor and
  understands. An API key is the opposite.
- An interrupted `writeFileSync` leaves a truncated key, and the failure only surfaces on the next
  API call. A SQLite transaction removes that failure mode.
- The row is a natural place for what a key carries with it: when it changed, whether it is
  encrypted, which hint to display.

Encryption comes from Electron `safeStorage` — **DPAPI on Windows, Keychain on macOS** — injected
into the core as a vault port (see `opentimbre-core-boundary`). The core cannot import Electron, so
the host hands it two functions.

### Absence of the vault is a marked state, not a lie

Without a vault (the CLI, the tests), the key is stored in plaintext and the row is **marked
unprotected**. The settings screen then warns instead of claiming the key is secure. Never let the
UI report "encrypted" for a row that is not.

### A key can be unreadable

A database copied from another machine, or encrypted under a different OS account, will not
decrypt. That is not an application error — it is a lost key. Report it as `legivel: false` and ask
for the key again, rather than letting the app fail later, mid-tone-generation, with an
authentication error the user cannot interpret.

## Precedence and reversibility

The key entered in the app **wins** over the environment variable: someone who typed a key in the
window expects that key to be used.

Removal must actually remove. Capture the original environment **once**, before any app key is
applied; without that snapshot, deleting the stored row leaves the overwritten value in
`process.env` and the app keeps using the old key with nobody able to explain why. Restoring means
restoring absence too — `delete process.env[name]` when the original was undefined.

## Validation before the network

Reject obviously-broken input at the boundary, with a message that names the fix:

- empty → "paste the whole key before saving"
- whitespace inside → almost always a half-pasted key, or a key pasted together with its
  `ANTHROPIC_API_KEY=` prefix

Both checks cost nothing and save a round trip plus a confusing provider error.

## Choosing a provider

Do not assume a filled environment variable means a working key. Validate with a free call (the
provider's model-listing endpoint) and use the first that passes — a variable holding a revoked key
must not win. Let an explicit preference override the auto-detection.

## The hint

Show enough to recognize, never enough to use: first six characters (they identify provider and
account) and last four (what the user checks against the provider's dashboard). The middle never
leaves the owning module.

## Review checklist

1. Does any IPC payload, in either direction, carry a key?
2. Does any log, trace, or error path serialize a request, a header set, or a config object that
   could contain one?
3. Is the vault injected, or did a core module import Electron to get it?
4. Does the UI distinguish protected / unprotected / unreadable, honestly?
5. Does removing a key restore the pre-app environment, including absence?
6. Are `.env` files ignored by git, with only an example file versioned and never a real key?

## Related

`opentimbre-core-boundary` (the vault port), `opentimbre-electron-ipc` (what may cross the bridge),
`opentimbre-cross-platform` (DPAPI vs Keychain behind one port).
