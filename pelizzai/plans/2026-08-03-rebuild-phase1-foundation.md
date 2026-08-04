# OpenTimbre rebuild — Phase 1: foundation — Implementation plan

> **For the executor:** MANDATORY SUB-SKILL — use `pelizzai-execution-plans`.

**Goal:** Stand up the npm-workspaces monorepo and prove the whole architecture end-to-end
through one real plugin (Gojira) and one surface (the CLI REPL) on both platform
implementations — before spending detailed planning effort on Electron, Angular, or packaging,
whose shape may shift once this foundation is real code instead of a spec.

**Architecture:** `packages/core` (domain, zero Electron/Angular deps, enforced by both the
package graph and an ESLint rule) exposes ports (`Vault`, `MidiTransport`, `PlatformInfo`) that
`packages/platform-node` implements per OS and `packages/cli` wires together for a Node-only
entry point. `contracts/` holds the type-only IPC/i18n shapes that Phase 3 (Electron/Angular) will
consume — created now so later phases don't redefine them.

**Tech stack:** Node ≥22.12, TypeScript, npm workspaces, `node:test`, `node:sqlite`, zod,
`@julusian/midi` 3.8.0, `@anthropic-ai/sdk`, `openai`, ESLint (flat config) + Prettier.

**Applicable domain skills:** opentimbre-core-boundary, opentimbre-plugin-spec,
opentimbre-cross-platform, opentimbre-secrets, opentimbre-testing, opentimbre-code-style,
opentimbre-i18n. (opentimbre-electron-ipc, opentimbre-angular-ui apply from Phase 3 onward, not
this plan.)

**Global Constraints (copied VERBATIM from the spec):**

- The domain core (`packages/core`) has zero dependency on `electron` or `@angular/*` — enforced
  by the package graph, not just convention.
- No CC number, amp name, or parameter range exists outside a `PluginSpec` descriptor.
- No API key ever appears in an IPC payload, a log line, or a trace in plaintext.
- `npm run check` must pass with zero failures before any task is considered done.
- Fresh start: no migration from legacy's data stores.

**Approvals** (one line each; a marker without an explicit user answer stays `pending`):

- Discovery: ratified on 2026-08-03 (`pelizzai-interview-me`, 9 gaps)
- Spec: `pelizzai/specs/2026-08-03-rebuild-design.md` approved on 2026-08-03
- Domain skills: opentimbre-i18n ratified on 2026-08-03; opentimbre-packaging declined (deferred
  to the Phase 4 plan)
- Plan: approved on 2026-08-03

---

## Roadmap beyond this plan

This document plans **Phase 1 only**. Later phases are named here so the scope is visible, but are
deliberately **not** decomposed into tasks yet — writing detailed, zero-context tasks for UI and
packaging work before Phase 1's real code exists would invent certainty this plan doesn't have.
Each phase gets its own plan, written after the previous phase validates:

- **Phase 2 — remaining plugins:** Soldano SLO-100 X, Archetype Tim Henson X descriptors. Mechanical
  once Phase 1 proves the catalog mechanism — each new descriptor inherits the invariant suite for
  free, per `opentimbre-plugin-spec`.
- **Phase 3 — desktop:** Electron main/preload, Angular renderer (window shell, chat, plugin status
  bar, settings), full IPC wiring.
- **Phase 4 — ship:** electron-builder packaging (NSIS + DMG), `opentimbre-packaging` domain skill
  (re-proposed here), auto-update wiring once a GitHub remote exists, README/setup docs, and the
  macOS hardware-verification task (blocked until hardware is available — tracked, not silently
  dropped).

## Exposed material gaps

```text
- Legacy's exact CC map for Gojira (118 parameters) must be transcribed from
  legacy/midi-mapping/gojira-neural-ai.xml and legacy/capabilities.md, not re-derived or
  approximated → resolution: Task 6's implementer reads both files directly; the plan does not
  duplicate 118 CC values inline.
- The exact node:sqlite/zod/provider-SDK call shapes for the key-store and tool-use protocol are
  in legacy source the plan does not reproduce in full (to avoid duplicating code in the plan,
  a listed defect) → resolution: Tasks 4 and 7 point the implementer at exact legacy paths
  (readable via `git show HEAD:<path>` inside legacy/) as the behavioral reference.
- macOS platform-node code (Task 9) can only be unit-tested against a faked transport/process
  layer in this plan — real-hardware behavior is unverified → accepted by the user in discovery
  (2026-08-03) and re-stated here; hardware verification is explicitly Phase 4, not silently
  assumed done by Task 9's green tests.
- Task 7's `anthropic.ts`/`openai.ts` SDK adapters have no dedicated test file (unlike
  `tool-use.ts`, `resolve.ts`, `rig-schema.ts`, all in the same task) → flagged by the quality-lens
  review (2026-08-04). Verified this matches legacy's own testing boundary exactly — legacy has no
  `providers/anthropic.test.ts`/`openai.test.ts` either, only `tool-use.test.ts` at the protocol
  level. Accepted as parity, not a regression, since the ratified scope is "same features, better
  built," not new coverage legacy itself never had. Revisit if `findToolUse`/`parseArgs`/`classify`
  prove fragile in practice.
- Task 4's key-store `configure()` resets its captured-environment snapshot on every call, not
  only on an actual file change → safe today (no host calls it twice), but if Phase 3's Electron
  main ever calls `configure()` more than once after an app key was already applied to
  `process.env` (idempotent re-init, settings reload, hot-reload), the next capture would snapshot
  the already-overwritten value as "original," and a later `remove()` would restore the wrong
  value. Flagged by Task 4's quality-lens review (2026-08-04) → resolution deferred to whichever
  task first wires a real host caller (Phase 3): either enforce "call `configure({file})` exactly
  once" as a hard contract, or change the reset to fire only on an actual file-value change.
```

## Technical decisions in this plan

```text
1. ESLint (flat config) + Prettier added as lint/format tooling, with a `no-restricted-imports`
   rule banning `electron` and `@angular/*` inside packages/core — ratified: design (the original
   request's "use good practices," "more professional and organized" framing) — rejected: no
   linting, matching legacy exactly — why: legacy had zero lint tooling and that gap is part of
   what "more professional" was asked to fix; the core-boundary rule is a zero-cost built-in
   ESLint rule, not a new dependency, so it needs no separate justification under
   opentimbre-code-style §9.
2. Phase 1 scope limited to core/platform-node/cli (no Electron/Angular/packaging tasks in this
   plan) — ratified: plan (this document) — rejected: a single ~19-task plan covering the full
   rebuild — why: `pelizzai-writing-plans` explicitly flags "a giant plan covering subsystems that
   should be separate tasks/projects" as an anti-pattern; Phase 1 carries the architecture's
   highest uncertainty (core boundary, i18n, plugin-spec mechanism) and should be proven before
   later phases are planned in zero-context detail.
3. Phase 1's plugin catalog contains only Gojira, not all three legacy plugins — ratified: plan
   (this document) — rejected: porting all three descriptors now — why: the catalog-invariant test
   harness (Task 5) is specifically designed so a new plugin "inherits the whole suite for free"
   (opentimbre-plugin-spec); proving that mechanism once is sufficient evidence before mechanically
   repeating it in Phase 2.
```

---

### Task 1: Workspace scaffold

**Out of scope:** any package's actual source logic (Tasks 2+); Angular/Electron packages (Phase 3).

**Files:**

- Create: `package.json` (root, `"workspaces": ["packages/core", "packages/platform-node", "packages/cli", "contracts"]`; Angular/Electron workspace entries added in Phase 3, not here; scripts: `"typecheck": "npm run typecheck --workspaces --if-present"`, `"test": "npm run test --workspaces --if-present"`, `"check": "npm run typecheck && npm run test"`)
- Create: `packages/core/package.json`, `packages/platform-node/package.json`, `packages/cli/package.json`, `contracts/package.json`
- Create: `tsconfig.base.json` (root — `strict: true`, `module: "nodenext"`, `target: "es2023"`)
- Create: `packages/core/tsconfig.json`, `packages/platform-node/tsconfig.json`, `packages/cli/tsconfig.json`, `contracts/tsconfig.json` (each `extends: "../../tsconfig.base.json"`, or `"../tsconfig.base.json"` for `contracts/`)
- Create: `eslint.config.js` (root, flat config; `@typescript-eslint`; a `no-restricted-imports` override scoped to `packages/core/**` banning `electron` and `@angular/*`)
- Create: `.prettierrc.json`
- Modify: `.gitignore` (root — add `node_modules/`, `dist/`, `*.tsbuildinfo`, `.env`)

**Domain skills to apply:** opentimbre-core-boundary, opentimbre-code-style

**Cross-cutting harness skills to apply:** none

**Interfaces:** none — this task produces no runtime code.

**Implementation and validation strategy:**

- Predominant effect: config/scaffold
- Implementation: validate (no behavior to TDD; a scaffold either resolves or it doesn't)
- Oracle: `npm install` succeeds and workspaces resolve; the ESLint rule fires on a deliberate violation
- Command(s): `npm install`, `npm ls --workspaces`, `npx eslint packages/core --no-eslintrc -c eslint.config.js` (after step 3's temporary violation)
- Expected evidence: `npm install` exit 0; `npm ls --workspaces` lists all 4 packages; the ESLint smoke-test in step 3 reports the violation, then passes once removed
- Rollback: not applicable (no prior state to preserve)
- Review profile: split — foundational config other tasks depend on

- [ ] **Step 1: Create the workspace root and package manifests** → verify: `npm install` exits 0 with no errors

Each package's `package.json` needs at minimum `name` (`@opentimbre/core`, `@opentimbre/platform-node`, `@opentimbre/cli`, `@opentimbre/contracts`), `type: "module"`, `private: true`, and the scripts `"typecheck": "tsc --noEmit"` and `"test": "node --test \"src/**/*.test.ts\""` (the `contracts` package needs `typecheck` only — it has no runtime code to test) — these are what the root's `--workspaces --if-present` aggregation in Step 1's root `package.json` actually invokes, and what every later task's `npm run test -w @opentimbre/<pkg>` command depends on. `packages/core/package.json` must NOT list `electron` or any `@angular/*` package in any dependency field — this is the fact Step 3 proves mechanically.

- [ ] **Step 2: Add TypeScript project references** → verify: `npx tsc --build --dry` from root reports the 4 packages in dependency order with no errors

- [ ] **Step 3: Add ESLint core-boundary rule and prove it fires** → verify: the deliberate violation is caught, then the rule passes clean

Add to `eslint.config.js`:

```js
{
  files: ['packages/core/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: ['electron', 'electron/*', '@angular/*'],
    }],
  },
}
```

Temporarily add `import { app } from 'electron'` to a scratch file under `packages/core/src/`, run
`npx eslint packages/core`, confirm it reports the violation, then delete the scratch file and
confirm `npx eslint packages/core` passes with zero files present (empty `src/` is fine at this
step — Task 3 adds real content).

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` shows only workspace/config files, no `packages/*/src/`

---

### Task 2: `contracts` package — IPC and i18n types

**Out of scope:** any runtime logic; actual channel handlers (Phase 3).

**Files:**

- Create: `contracts/src/ipc.ts`
- Create: `contracts/src/i18n.ts`
- Create: `contracts/src/index.ts` (re-exports)
- Validate: `contracts/src/ipc.test.ts` is NOT needed — this package is types-only; validation is `tsc` clean

**Domain skills to apply:** opentimbre-electron-ipc (contract shape reference, even though Phase 3 implements the handlers), opentimbre-i18n, opentimbre-code-style

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Produces: `IpcChannels` type map (channel name → `{ payload: T, result: R }`) — consumed by Phase 3's main/preload/renderer
- Produces: `LocaleKey` type (union of valid i18n message keys, or `string` if a compile-time union proves impractical — implementer's call, not a material decision) — consumed by Task 3's `t()` and Phase 3's renderer

**Implementation and validation strategy:**

- Predominant effect: config/types
- Implementation: validate
- Oracle: `tsc --noEmit` clean; no runtime import anywhere in `contracts/src/`
- Command(s): `npm run typecheck -w contracts`
- Expected evidence: exit 0, zero diagnostics
- Rollback: not applicable
- Review profile: split — shape here constrains Phase 3

- [ ] **Step 1: Define the IPC channel type map, mirroring legacy's contract shape** → verify: `tsc --noEmit -p contracts` passes

Read `legacy/desktop/ipc.ts` (`git show HEAD:desktop/ipc.ts` inside `legacy/`) as the reference for
which channels and shapes existed (`Estado`, `EstadoPlugin`, `Turno`, `Aberta`, `Aplicado`, and the
full channel list from `legacy/desktop/preload.cts`). Translate identifiers to English per
`opentimbre-code-style` (e.g. `Estado` → `AppState`, `EstadoPlugin` → `PluginState`). Keep the
`domain:action` channel naming convention (`chat:send`, `plugin:open`), translated from legacy's
Portuguese channel names (`chat:enviar` → `chat:send`).

- [ ] **Step 2: Define the i18n key type** → verify: `tsc --noEmit -p contracts` passes

- [ ] **Step 3: Ready for review → consolidate** → verify: `git status` shows only `contracts/`

---

### Task 3: `core` package — ports and i18n resolver

**Out of scope:** key-store logic (Task 4), plugin specs (Task 5+).

**Files:**

- Create: `packages/core/src/ports/vault.ts`
- Create: `packages/core/src/ports/midi-transport.ts`
- Create: `packages/core/src/ports/platform-info.ts`
- Create: `packages/core/src/i18n/index.ts`
- Create: `packages/core/src/i18n/en.json`
- Create: `packages/core/src/i18n/pt.json`
- Create: `packages/core/src/i18n/index.test.ts`

**Domain skills to apply:** opentimbre-core-boundary, opentimbre-i18n, opentimbre-testing

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Produces: `Vault { protect(plain: string): Uint8Array; reveal(sealed: Uint8Array): string }` — consumed by Task 4, implemented in Phase 3's Electron main via `safeStorage`
- Produces: `MidiTransport { connect(): Promise<{send: Send} | {error: string}> }` — consumed by Task 10, implemented by Tasks 8–9
- Produces: `PlatformInfo { isRunning(processName: string): Promise<boolean>; settingsDir(appInfo): string }` — consumed by Task 10, implemented by Tasks 8–9
- Produces: `t(key: LocaleKey, params?: Record<string, string>): string`, `resolveLocale(stored: string | null, osLocale: string): 'en' | 'pt'` — consumed by every later task that emits user-facing text
- Consumes: `LocaleKey` from `@opentimbre/contracts` (Task 2)

**Implementation and validation strategy:**

- Predominant effect: behavior
- Implementation: TDD red→green on `t()` fallback and `resolveLocale()` precedence
- Oracle: `node:test`
- Command(s): `node --test packages/core/src/i18n/index.test.ts` (or the workspace-wide `npm run test -w @opentimbre/core` once `package.json`'s `test` script is wired to `node --test "src/**/*.test.ts"`)
- Expected evidence: all cases pass, 0 failures
- Rollback: not applicable
- Review profile: split — every later task depends on this contract being right

- [ ] **Step 1: Write the ports as type-only interfaces** → verify: `tsc --noEmit -w @opentimbre/core` passes with empty implementations elsewhere (ports have no runtime body)

- [ ] **Step 2: RED — write `index.test.ts` for `t()` and `resolveLocale()` before implementing** → verify: tests fail (functions don't exist yet)

Cases to cover: `t()` returns the `en.json` value for a known key; `t()` falls back to `en.json`
when the key is missing from `pt.json`; `t()` interpolates `{param}` placeholders;
`resolveLocale(null, 'pt-BR')` → `'pt'`; `resolveLocale('en', 'pt-BR')` → `'en'` (explicit wins);
`resolveLocale(null, 'fr-FR')` → `'en'` (unresolvable OS locale falls back to English).

- [ ] **Step 3: GREEN — implement `t()` and `resolveLocale()`, seed `en.json`/`pt.json` with the keys the tests use** → verify: `node --test` passes, 0 failures

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` shows only `packages/core/src/ports/` and `packages/core/src/i18n/`

---

### Task 4: `core` package — key-store (secrets)

**Out of scope:** wiring the real `safeStorage` vault (Phase 3); CLI-side prompts for entering a key (Task 10).

**Files:**

- Create: `packages/core/src/secrets/key-store.ts`
- Create: `packages/core/src/secrets/key-store.test.ts`

**Domain skills to apply:** opentimbre-secrets, opentimbre-core-boundary, opentimbre-testing

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Consumes: `Vault` port from Task 3
- Produces: `configure(opts: {file?: string; vault?: Vault | null}): void`, `save(provider: ProviderId, key: string): void`, `list(): KeyInfo[]`, `remove(provider: ProviderId): void`, `applyToEnvironment(): void` — consumed by Task 7 (provider resolution) and Task 10 (CLI settings)

**Implementation and validation strategy:**

- Predominant effect: behavior (ported from a known-good legacy implementation)
- Implementation: characterization — port `legacy/src/chaves.ts` behavior, prove it with tests that encode the same invariants legacy already validated informally, then treat the ported code as the new baseline
- Oracle: `node:test`, with `:memory:` `node:sqlite` and a fake `Vault`
- Command(s): `node --test packages/core/src/secrets/key-store.test.ts`
- Expected evidence: 0 failures; explicitly covers empty-key rejection, whitespace-in-key rejection, app-key-precedes-env, removal restores original env (including absence), unprotected-row marking when no vault is configured
- Rollback: not applicable
- Review profile: split — a security-sensitive surface (`opentimbre-oswap` does not apply here — no untrusted external input, no auth, no SQL injection surface since the schema is fixed and parameterized; note this explicitly in the task's review rather than silently omitting the overlay)

- [ ] **Step 1: Read the legacy reference in full** → verify: you can name each invariant before writing a line of new code

`git show HEAD:src/chaves.ts` inside `legacy/`. The file's own header comments document the design
rationale (why SQLite not JSON, why the vault is injected, why encryption doesn't live in `core`).
Port the *behavior*; translate identifiers to English (`guardar`→`save`, `remover`→`remove`,
`listar`→`list`, `Chave`→`KeyInfo`, `provedor`→`provider`).

- [ ] **Step 2: Write characterization tests encoding legacy's invariants** → verify: tests fail against an empty `key-store.ts` (RED, in the sense of "not yet implemented")

- [ ] **Step 3: Implement, porting legacy's logic** → verify: `node --test` passes, 0 failures

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` shows only `packages/core/src/secrets/`

---

### Task 5: `core` package — plugin spec type, scales, amp strategies

**Out of scope:** any specific plugin's data (Task 6); scene planning (Task 7).

**Files:**

- Create: `packages/core/src/plugins/types.ts`
- Create: `packages/core/src/plugins/types.test.ts`
- Create: `packages/core/src/plugins/catalog.ts` (empty `CATALOG: PluginSpec[] = []` for now — Task 6 populates it)
- Create: `packages/core/src/plugins/catalog-invariants.test.ts` (walks `CATALOG`, per `opentimbre-testing`)

**Domain skills to apply:** opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Produces: `PluginSpec`, `ParamSpec`, `FixedParamSpec`, `Scene` (renamed from `Cena`), `knobToMidi(v: number): number`, `toggleToMidi(on: boolean): number`, `resolveAmp(spec, target): {amp, warning}`, `getAmpStrategy(spec, name?): AmpStrategy` — consumed by Task 6 (data), Task 7 (scene planning)

**Implementation and validation strategy:**

- Predominant effect: behavior (port)
- Implementation: characterization — port `legacy/src/plugins/types.ts` exactly (the math and the fallback logic are load-bearing; do not "improve" them without a reason)
- Oracle: `node:test`
- Command(s): `node --test packages/core/src/plugins/types.test.ts packages/core/src/plugins/catalog-invariants.test.ts`
- Expected evidence: 0 failures. The catalog-invariants suite passes trivially now (empty catalog) — its real value starts at Task 6.
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: Read the legacy reference** → verify: you can explain why `off: 5` exists for EQ bands before writing code

`git show HEAD:src/plugins/types.ts` inside `legacy/`. Also skim
`legacy/src/plugins/catalogo.test.ts`, `cena.test.ts`, `exibicao.test.ts`, `lancador.test.ts` (via
`git show HEAD:src/plugins/<file>`) for the exact invariants legacy already protects — each one
maps to a real incident per `opentimbre-testing`; port the invariant, not just the type.

- [ ] **Step 2: Write characterization tests for `knobToMidi`, `toggleToMidi`, `resolveAmp`, and each `AmpStrategy`** → verify: fail against empty implementations

- [ ] **Step 3: Implement, translating identifiers to English** (`Cena`→`Scene`, `resolveAmp` stays, `getAmpStrategy` stays, `continua`→`continuous`, `incremento`→`increment`) → verify: `node --test` passes

- [ ] **Step 4: Write the catalog-invariant tests that will matter once Task 6 populates `CATALOG`** (CC-collision check, group→knob-reference check, install-mapping-completeness check — read legacy's `catalogo.test.ts` for the exact three) → verify: they pass against the currently-empty catalog (vacuously)

- [ ] **Step 5: Ready for review → consolidate** → verify: `git status` shows only `packages/core/src/plugins/`

---

### Task 6: `core` package — Gojira plugin descriptor

**Out of scope:** Soldano, Tim Henson (Phase 2).

**Files:**

- Create: `packages/core/src/plugins/gojira.ts`
- Create: `packages/core/src/plugins/gojira.test.ts` (behavior tests specific to Gojira's documented quirks)
- Modify: `packages/core/src/plugins/catalog.ts` (`CATALOG = [gojiraSpec]`)

**Domain skills to apply:** opentimbre-plugin-spec, opentimbre-testing

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Produces: `gojiraSpec: PluginSpec` — consumed by `CATALOG`, Task 7, Task 10

**Implementation and validation strategy:**

- Predominant effect: data transcription (not logic — treat CC values as facts, not decisions)
- Implementation: characterization — transcribe, verify against two independent sources
- Oracle: `node:test`; cross-check against `legacy/capabilities.md`
- Command(s): `node --test packages/core/src/plugins/gojira.test.ts packages/core/src/plugins/catalog-invariants.test.ts`
- Expected evidence: 0 failures; catalog-invariant suite now runs against real data (no longer vacuous) and must still pass
- Rollback: not applicable
- Review profile: split — transcription errors here are silent CC bugs, worth a careful second look

- [ ] **Step 1: Transcribe the descriptor from two legacy sources, cross-checked** → verify: every `ampCC` entry in your new file matches a documented value in `legacy/capabilities.md`

Primary source: `git show HEAD:src/plugins/gojira.ts` inside `legacy/` (the full 118-parameter
mapping already encoded as a `PluginSpec`). Cross-check against `legacy/capabilities.md`'s
"Achado" sections (amp selector CC 20 with ranges 0–31/32–95/96–127, the per-amp control-name
table, the EQ/mic/pedal specifics). Do not invent or "clean up" a value that differs between the
two — if they disagree, stop and flag it rather than guessing which is right (this would be a
material gap; it is not expected to occur since capabilities.md documents what gojira.ts encodes,
but the check exists because CC transcription errors are exactly the failure class
`opentimbre-plugin-spec`'s invariant tests exist to catch).

- [ ] **Step 2: Write behavior tests for Gojira-specific quirks** (CLN has no Presence/Depth and is the only amp with Bright; `reverbMode` is the Shimmer switch, not a mode selector; the WOW pedal is FATSO with 3 sub-modes) → verify: tests pass against your transcription

- [ ] **Step 3: Wire into `CATALOG` and confirm the invariant suite is no longer vacuous** → verify: `catalog-invariants.test.ts` exercises real CC numbers and passes

- [ ] **Step 4: Ready for review → consolidate** → verify: `git status` shows only the two new files + `catalog.ts`

---

### Task 7: `core` package — scene planning and provider protocol

**Out of scope:** Angular/Electron consumption of these functions (Phase 3); live API calls in tests (never — per `opentimbre-testing`).

**Files:**

- Create: `packages/core/src/scenes/plan-scene.ts`
- Create: `packages/core/src/scenes/plan-scene.test.ts`
- Create: `packages/core/src/providers/tool-use.ts`
- Create: `packages/core/src/providers/anthropic.ts`
- Create: `packages/core/src/providers/openai.ts`
- Create: `packages/core/src/providers/resolve.ts` (ported from `legacy/src/provider.ts`)
- Create: `packages/core/src/providers/tool-use.test.ts`
- Create: `packages/core/src/rig-builder.ts`
- Create: `packages/core/prompts/system-rig.en.md`, `packages/core/prompts/system-rig.pt.md` (ported from `legacy/prompts/system-rig.md`, split per `opentimbre-i18n`)
- Create: `packages/core/prompts/plugins/gojira.en.md`, `packages/core/prompts/plugins/gojira.pt.md` (ported from `legacy/prompts/plugins/<gojira-doc>`)

**Domain skills to apply:** opentimbre-plugin-spec, opentimbre-secrets, opentimbre-core-boundary, opentimbre-testing, opentimbre-i18n

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Consumes: `PluginSpec`, `Scene`, `resolveAmp` (Task 5), `gojiraSpec` (Task 6), key-store's `list`/`applyToEnvironment` (Task 4)
- Produces: `planScene(spec, scene, amp): {cc: number, value: number}[]` (pure, no I/O — per `opentimbre-code-style` §6, decision/plumbing separation), `buildRig(plugin, request, systemPrompt): Promise<Rig>`, `adjustScene(...)`, `loadSystemPrompt(locale): string` — consumed by Task 10

**Implementation and validation strategy:**

- Predominant effect: behavior (port)
- Implementation: TDD red→green on `planScene` (pure, easy to test properly); characterization on the provider protocol port (ported from known-good legacy code)
- Oracle: `node:test` with a fixture `PluginSpec` for `planScene`, and **recorded/fake provider responses** for the tool-use protocol — never a live API call
- Command(s): `node --test packages/core/src/scenes/plan-scene.test.ts packages/core/src/providers/tool-use.test.ts`
- Expected evidence: 0 failures
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: RED — write `plan-scene.test.ts` against a fixture spec (not Gojira)** → verify: fails, `planScene` doesn't exist yet

Per `opentimbre-plugin-spec`: invariant tests use the real catalog; behavior tests use a fixture —
this is a behavior test, so build a small fake `PluginSpec` in the test file rather than importing
`gojiraSpec`.

- [ ] **Step 2: GREEN — implement `planScene` as a pure function returning a CC list** → verify: `node --test plan-scene.test.ts` passes

- [ ] **Step 3: Read and port the provider protocol** → verify: you can name what the six methods hide before implementing

`git show HEAD:src/providers/tool-use.ts`, `anthropic.ts`, `openai.ts`, `operacoes.ts`,
`types.ts`, and `provider.ts` inside `legacy/`. The header of `padroes.md` §1 already documents why
this module is deep (two attempts, trace, zod issue formatting, history rollback) — preserve that
shape. Note legacy's own justification for OpenAI's Responses API (`padroes.md` §9): reasoning
models refuse function tools on `chat.completions` — carry this forward, don't "simplify" it away.

- [ ] **Step 4: Write characterization tests for `tool-use.ts` using recorded/fake responses** → verify: fails against empty implementation

- [ ] **Step 5: Implement the provider protocol port and `resolve.ts`'s first-valid-key-wins logic** → verify: `node --test tool-use.test.ts` passes

- [ ] **Step 6: Port `rig-builder.ts` and the bilingual prompt files** → verify: `loadSystemPrompt('en')` and `loadSystemPrompt('pt')` both return non-empty strings containing the Gojira reference block

- [ ] **Step 7: Ready for review → consolidate** → verify: `git status` shows only `packages/core/src/scenes/`, `packages/core/src/providers/`, `packages/core/src/rig-builder.ts`, `packages/core/prompts/`

---

### Task 8: `platform-node` package — Windows implementation

**Out of scope:** macOS (Task 9).

**Files:**

- Create: `packages/platform-node/src/windows.ts`
- Create: `packages/platform-node/src/windows.test.ts`

**Domain skills to apply:** opentimbre-cross-platform, opentimbre-core-boundary, opentimbre-testing

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Consumes: `MidiTransport`, `PlatformInfo` ports (Task 3)
- Produces: `windowsTransport: MidiTransport`, `windowsPlatformInfo: PlatformInfo` — consumed by Task 10

**Implementation and validation strategy:**

- Predominant effect: behavior (port, OS-specific)
- Implementation: characterization on a faked `@julusian/midi` and a faked process-listing call — port `legacy/src/midi-out.ts` and `legacy/src/plugins/lancador.ts`'s Windows-specific logic
- Oracle: `node:test` with fakes; **manual proof** (not automated): run on real Windows with loopMIDI's `VoiceRig` port and Gojira open, confirm `connect()` finds it
- Command(s): `node --test packages/platform-node/src/windows.test.ts`
- Expected evidence: automated 0 failures; manual proof recorded as a checklist item, not skipped silently
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: Read the legacy reference** → verify: you know why the port is opened by index, not name, before writing code

`git show HEAD:src/midi-out.ts` and `src/plugins/lancador.ts` inside `legacy/` — the port-by-index
open + name-scan pattern, and the `tasklist`-based process check.

- [ ] **Step 2: Write characterization tests against a faked `@julusian/midi` and a faked `child_process.exec`** → verify: fail against empty implementation

- [ ] **Step 3: Implement `windowsTransport` and `windowsPlatformInfo`** → verify: `node --test` passes

- [ ] **Step 4: Manual proof on real Windows hardware** → verify: `connect()` finds a `VoiceRig` loopMIDI port; `isRunning('Archetype Gojira.exe')` (or the real process name) correctly reports Gojira's open/closed state

- [ ] **Step 5: Ready for review → consolidate** → verify: `git status` shows only `packages/platform-node/src/windows.*`

---

### Task 9: `platform-node` package — macOS implementation (UNVERIFIED)

**Out of scope:** any claim of hardware verification — this task's Definition of Done is
TypeScript-logic-sound, not hardware-proven. Real verification is Phase 4, blocked on hardware
access.

**Files:**

- Create: `packages/platform-node/src/macos.ts`
- Create: `packages/platform-node/src/macos.test.ts`

**Domain skills to apply:** opentimbre-cross-platform, opentimbre-testing

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Consumes: `MidiTransport`, `PlatformInfo` ports (Task 3)
- Produces: `macosTransport: MidiTransport`, `macosPlatformInfo: PlatformInfo` — consumed by Task 10

**Implementation and validation strategy:**

- Predominant effect: behavior (new, not a port — legacy has no macOS code)
- Implementation: characterization against a faked `@julusian/midi` (`openVirtualPort`) and a faked `pgrep` call — no legacy reference exists for this file
- Oracle: `node:test` with fakes ONLY — no manual hardware step in this task
- Command(s): `node --test packages/platform-node/src/macos.test.ts`
- Expected evidence: 0 failures against fakes; the task's completion criterion explicitly excludes hardware proof
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: Confirm the mechanism against grounded evidence, not assumption** → verify: cite the source for each claim before writing code

Per `opentimbre-cross-platform`: `openVirtualPort()` is available on macOS via `@julusian/midi`
(RtMidi); the app should create and own its port rather than requiring a loopback driver. Plugin
install paths and process-detection commands (`pgrep`) are written from Electron/Node platform
documentation, not observed — mark each one with a comment noting it is unverified.

- [ ] **Step 2: Write characterization tests against fakes** → verify: fail against empty implementation

- [ ] **Step 3: Implement `macosTransport` (via `openVirtualPort`) and `macosPlatformInfo` (via `pgrep`, `~/Library/Application Support`)** → verify: `node --test` passes against fakes

- [ ] **Step 4: Ready for review → consolidate, with the unverified status stated explicitly in the PR/task notes** → verify: `git status` shows only `packages/platform-node/src/macos.*`; the task's completion note names macOS-unverified as an open item, not a resolved one

---

### Task 10: `cli` package — REPL and probe entry points

**Out of scope:** any Electron/Angular code (Phase 3).

**Files:**

- Create: `packages/cli/src/node-version-check.ts`
- Create: `packages/cli/src/node-version-check.test.ts`
- Create: `packages/cli/src/repl.ts`
- Create: `packages/cli/src/probe.ts`
- Create: `packages/cli/src/platform-select.ts` (picks `windowsTransport`/`macosTransport` etc. by `process.platform`)
- Modify: `packages/cli/package.json` (add `"dev": "node --env-file-if-exists=.env src/repl.ts"`, `"probe": "node --env-file-if-exists=.env src/probe.ts"` scripts)

**Domain skills to apply:** opentimbre-core-boundary, opentimbre-secrets, opentimbre-cross-platform, opentimbre-testing

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Consumes: everything from Tasks 3–9 (`core`'s ports/plugins/providers, `platform-node`'s per-OS implementations)
- Produces: none (this is the outermost entry point)

**Implementation and validation strategy:**

- Predominant effect: behavior + integration
- Implementation: TDD red→green on the Node-version gate (pure, injectable); the REPL/probe themselves are integration code proven by manual run, not unit tests (per `opentimbre-testing`: "if the only way to test a rule is with hardware, a network, or an API key, the rule is glued to the wrong place" — REPL/probe ARE that hardware/network boundary by design, so they stay thin and manually proven, while everything they call is already unit-tested)
- Oracle: `node --test` for the version gate; **manual proof**: run the REPL end-to-end
- Command(s): `node --test packages/cli/src/node-version-check.test.ts`; manual: `npm run dev -w @opentimbre/cli`
- Expected evidence: version-gate tests 0 failures; manual REPL run produces a Gojira scene from a real text prompt (requires a real Anthropic or OpenAI key in `.env`) and, separately, degrades gracefully (app doesn't crash) with no MIDI port available
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: RED — write the Node-version-gate test** → verify: fails against empty implementation

`node-version-check.ts` exports a pure function taking a version string (so the test injects
`'22.10.0'` and `'22.12.0'` without depending on the actual running Node), returning
`{ ok: boolean, message?: string }`. Ratified decision #10 (spec): fails early with a message
naming the required version — no silent degradation.

- [ ] **Step 2: GREEN — implement the gate; call it at the top of both `repl.ts` and `probe.ts`, exiting with the message on failure** → verify: `node --test` passes

- [ ] **Step 3: Implement `platform-select.ts`** → verify: `tsc --noEmit` passes; returns `windowsTransport`/`windowsPlatformInfo` on `process.platform === 'win32'`, the macOS equivalents on `'darwin'`, and a clear "unsupported platform" error otherwise (per `opentimbre-cross-platform`: fail honestly, don't silently no-op)

- [ ] **Step 4: Port `repl.ts` and `probe.ts` from legacy**, wiring `core`'s `buildRig`/`adjustScene`/key-store and `platform-node`'s transport → verify: `tsc --noEmit -w @opentimbre/cli` passes

Read `git show HEAD:src/repl.ts` and `src/probe.ts` inside `legacy/` for the command surface
(one-shot commands, MIDI diagnostics for `probe`).

- [ ] **Step 5: Manual proof — run the REPL end-to-end** → verify: a real text prompt ("I want a One by Metallica tone") produces a Gojira `Rig`/scene via a real provider call, and the app doesn't crash when no MIDI port is available

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` shows only `packages/cli/src/` and its `package.json`

---

## Phase 1 completion criterion

`npm run check` (root script: typecheck + `node:test` across `core`/`platform-node`/`cli`) passes
with zero failures, AND Task 10's Step 5 manual proof has been run and recorded. macOS remains
explicitly unverified — that is expected, not a blocker, per the ratified discovery decision.

## Plan quality gates

```text
- Every task names exact legacy source paths as the behavioral reference instead of duplicating
  their code in this document.
- Every task has a concrete proof command and expected evidence.
- No task claims macOS hardware verification; Task 9 explicitly excludes it from its own
  completion criterion.
- CC data (Task 6) is transcribed and cross-checked against two independent legacy sources, never
  invented.
- No TBD/TODO/"handle edge cases"/"same as Task N" anywhere above.
```

## Forwarding to execution

Plan materialized, stress-tested. → forward to the sequential post-plan setup gate of
`pelizzai-execution-plans` for isolation/mode/commit-strategy/review-profile ratification before
Task 1.
