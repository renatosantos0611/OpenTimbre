# UI legacy parity — Implementation plan

> **For the executor:** MANDATORY SUB-SKILL — use `pelizzai-execution-plans`.

**Goal:** make the Angular rebuild boot on Windows and match the legacy app's chrome, screens, and
window behavior, with the AI API keys reachable in a legacy-shaped Settings screen.

**Architecture:** the legacy renderer is the design reference, not a starting point to copy — the
rebuild keeps its layering (core stays platform-free, main owns the capabilities, the renderer reads
signals from `DesktopService` and never touches `window.api`). Work moves outward in one direction:
first the main process boots and its defaults are right, then the shell chrome is replaced, then each
screen reaches parity. One new domain capability is introduced — listing provider models — and it
lives in main behind a typed IPC channel.

**Tech stack:** Electron 43.3.0, Angular 22 (standalone, zoneless, signals), TypeScript, esbuild for
main/preload, `node:sqlite` for settings, Vitest (renderer), `node --test` (main), Playwright (e2e).

**Applicable domain skills:** `opentimbre-angular-ui`, `opentimbre-electron-ipc`,
`opentimbre-secrets`, `opentimbre-i18n`, `opentimbre-code-style`, `opentimbre-testing`,
`opentimbre-cross-platform`

**Global Constraints (copied VERBATIM from the spec):**

- No user-facing literal in a component, main-process message, or CLI line. Every string in §3 is a
  catalog entry in `packages/i18n/src/en.json` and `pt.json`; the `pt` value is the legacy wording
  verbatim (`opentimbre-i18n`).
- The renderer never touches `window.api` directly; components read signals and call
  `DesktopService` (`opentimbre-angular-ui`).
- A plaintext API key never crosses IPC toward the renderer and is never logged, including in the
  new model-listing capability (`opentimbre-secrets`).
- Every new IPC channel is typed in `contracts/src/ipc.ts`, exposed through the preload
  contextBridge, and validated in main before use (`opentimbre-electron-ipc`).
- No test may require MIDI hardware, a running plugin, or a real API key (`opentimbre-testing`).
- Windows-specific paths and tools stay out of shared code (`opentimbre-cross-platform`).

**Approvals** (one line each; a marker without an explicit user answer stays `pending`):

- Discovery: ratified on 2026-08-09
- Spec: `pelizzai/specs/2026-08-09-ui-legacy-parity.md` approved on 2026-08-09
- Domain skills: existing catalog set — `opentimbre-angular-ui`, `opentimbre-electron-ipc`, `opentimbre-secrets`, `opentimbre-i18n`, `opentimbre-code-style`, `opentimbre-testing`, `opentimbre-cross-platform` — ratified on 2026-08-09
- Plan: draft

---

## Exposed material gaps

- Named ESM imports from the `electron` module fail under Electron 43 while the official ESM guide
  documents no such limitation → resolved in Task 1 by the ratified default-import form, with a
  main-process boot test that fails on the current bundle and passes after.
- The legacy fetches provider model catalogs at runtime, and neither provider returns pricing — the
  legacy derives a cost tier from the model id (`nivelCusto`) → accepted: Task 7 ports that
  derivation from `legacy/desktop/renderer/app.ts` rather than inventing a new taxonomy.
- Model listing needs an API key and a network call, so it can fail or hang while the composer is
  waiting → resolved in Task 7: the channel returns a `Result`, the renderer falls back to the stored
  `model_id` label, and a provider with no key contributes no entries instead of erroring.
- The e2e suites in `packages/desktop/e2e/` drive the current tab strip and will break when it is
  removed → resolved: each task that changes navigation updates its own spec, and Task 10 proves the
  whole suite green.
- The legacy About screen loads `icon/opentimbre-icon.png`; whether an equivalent asset exists in the
  rebuild is unverified → Task 4 step 1 checks, and falls back to the existing Lucide icon set if it
  does not, which changes no acceptance criterion.
- Fresh-profile acceptance (criteria 4 and 5) cannot be observed on a machine that already has a
  settings database → every affected task states the profile-reset command explicitly.

## Technical decisions in this plan

```text
1. Full parity with the legacy chrome; the text tab strip is removed — ratified: discovery interview 2026-08-09 — rejected: keep the tab strip and only restyle — why: the user's reference screenshots are the legacy chrome, and a partial match would leave the same screens visibly different.
2. The boot crash is Task 1 of this plan, not a separate quick fix — ratified: discovery interview 2026-08-09 — rejected: standalone fix/ branch merged first — why: the user chose a single delivery, and no UI task is verifiable before the app boots.
3. The model picker lists models fetched from the providers at runtime — ratified: discovery interview 2026-08-09 — rejected: a static catalog versioned in the repo — why: functional parity with the legacy, which mixes both catalogs live.
4. First launch follows the OS language (pt-BR → pt, otherwise en); the en/pt selector stays — ratified: discovery interview 2026-08-09 — rejected: hard default to pt, or dropping the en catalog — why: preserves the i18n catalog the project already ships while giving the legacy's Portuguese on the user's machine.
5. The main process stays ESM; `electron` is consumed via a default import and destructured — ratified: plan interview 2026-08-09 — rejected: emitting the main bundle as CommonJS — why: minimal change that preserves `import.meta.url` in `window.ts`, which the CJS route would force us to replace.
6. `dim_on_unfocus` defaults to `true` — ratified: spec §2 as a mechanical consequence of decision 1 — rejected: leaving the opt-in default — why: the legacy default is `escurecerSemFoco: true`, and the mechanism is already implemented.
```

---

### Task 1: the app boots on Windows

**Out of scope:** any renderer file, any visual change, the `--format=esm` build flag, and the
`package.json` `main` field.

**Files:**

- Modify: `packages/desktop/src/main/main.ts`
- Modify: `packages/desktop/src/main/window.ts:2`
- Modify: every other `packages/desktop/src/main/**/*.ts` whose `import { … } from 'electron'` is a named import — discover with the grep in step 1
- Create: `packages/desktop/src/main/electron.ts` (single re-export point)
- Validate: `packages/desktop/src/main/electron.test.ts`

**Domain skills to apply:** `opentimbre-electron-ipc`, `opentimbre-code-style`

**Cross-cutting harness skills to apply:** `pelizzai-debugging`

**Interfaces:**

- Produces: `packages/desktop/src/main/electron.ts` re-exporting the Electron values the main process
  uses (`app`, `BrowserWindow`, `session`, `ipcMain`, `safeStorage`, `shell`, `dialog`, `nativeTheme`,
  `powerMonitor` — whichever the grep finds) — consumed by every main-process module.

**Implementation and validation strategy:**

- Predominant effect: behavior (the process starts or it does not)
- Implementation: TDD red→green — the boot failure is the RED
- Oracle: the packaged main bundle imports without a `SyntaxError`, and a window is created
- Command(s): `npm run desktop` and `cd packages/desktop && npm run test:main`
- Expected evidence: RED reproduces `SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'`; GREEN opens a 420x700 window and the main suite passes
- Rollback: revert the commit; the failure mode is total and immediately visible
- Review profile: split — the main process boundary is a security surface (`window.ts` carries the
  navigation lockdown and the sandbox flags)

- [ ] **Step 1: reproduce and inventory** → verify: the SyntaxError above appears, and you have the full list of named-import sites

```bash
npm run desktop                                    # observe the SyntaxError, then stop
grep -rn "from 'electron'" packages/desktop/src/main packages/desktop/src/preload
```

The preload is CommonJS (`preload.cts`, built with `--format=cjs`) and must NOT change.

- [ ] **Step 2: add the single re-export point** → verify: `packages/desktop/src/main/electron.ts` exports exactly the names the grep found, and nothing else

```ts
// Electron ships `electron` as CommonJS. Under the ESM main-process loader a named
// import fails to resolve, so the whole process imports the default export and
// destructures here, once, instead of at every call site.
import electron from 'electron'

export const { app, BrowserWindow, ipcMain, session, safeStorage, shell } = electron
export type { BrowserWindow as BrowserWindowType, Rectangle } from 'electron'
```

Type-only imports (`import type { Rectangle } from 'electron'`) are erased at compile time and are
already safe — leave them pointing at `'electron'`.

- [ ] **Step 3: repoint the value imports** → verify: `grep -rn "^import {.*} from 'electron'" packages/desktop/src/main` returns only `import type` lines and `electron.ts` itself

- [ ] **Step 4: prove it boots** → verify: a window appears and the process stays alive

Run: `npm run desktop`
Expected: no `SyntaxError`; the 420x700 window renders the shell.

Run: `cd packages/desktop && npm run test:main`
Expected: exit code 0.

- [ ] **Step 5: Ready for review → consolidate** — do not commit mid-task. → verify: `git status` contains only main-process files

---

### Task 2: a fresh profile starts in the right language, on top, and dimming

**Out of scope:** the Settings UI, the locale selector's markup, and any string catalog entry.

**Files:**

- Modify: `packages/desktop/src/main/storage/desktop-store.ts:3-12` (add the `locale` default)
- Modify: `packages/desktop/src/main/main.ts:156,174` (`getLocale`)
- Validate: `packages/desktop/src/main/storage/desktop-store.test.ts`

**Domain skills to apply:** `opentimbre-i18n`, `opentimbre-cross-platform`

**Cross-cutting harness skills to apply:** none

**Interfaces:**

- Consumes: `app.getLocale(): string` from Electron — origin: `packages/desktop/src/main/electron.ts` (Task 1)
- Produces: `getLocale(): Locale` always returning `'en'` or `'pt'`, never `''` — consumer: `app-state.ts:50`

**Implementation and validation strategy:**

- Predominant effect: behavior
- Implementation: TDD red→green on the store and the locale resolution
- Oracle: with an empty settings database, `getLocale()` returns `pt` for an OS locale starting with
  `pt` and `en` otherwise; `getBool('dim_on_unfocus')` returns `true`
- Command(s): `cd packages/desktop && npm run test:main`
- Expected evidence: a RED asserting `'pt'` against today's `''`, then GREEN
- Rollback: revert; settings already stored by a user are untouched because `get()` prefers the
  stored value over the default
- Review profile: split — a wrong default ships silently to every new install

- [ ] **Step 1: RED on the store default** → verify: the new test fails with `''`

Assert that a store over a fresh temp file returns `'pt'` for `locale` when the injected OS locale is
`pt-BR`, `'en'` for `en-US`, and `true` for `dim_on_unfocus`.

- [ ] **Step 2: add the defaults** → verify: `DEFAULTS` gains `locale` and flips `dim_on_unfocus`

`dim_on_unfocus: true`. The OS locale is **not** a constant — it comes from `app.getLocale()`, so
resolution lives in `getLocale()`, not in `DEFAULTS`; keep `DEFAULTS.locale` as the last-resort
`'en'` and let `getLocale()` consult the OS only when the store has no stored value.

- [ ] **Step 3: resolve the OS locale** → verify: the mapping is `startsWith('pt') → 'pt'`, everything else `'en'`

Do not add a third locale; `Locale` is `'en' | 'pt'` in `packages/i18n`.

- [ ] **Step 4: prove it end to end** → verify: a reset profile opens in Portuguese and dims

Run: `cd packages/desktop && npm run test:main`
Expected: exit code 0.

Reset the profile and relaunch — the settings database lives under the Electron `userData` path;
delete it, then `npm run desktop`. Expected: the UI is in Portuguese and the window drops to 0.72
opacity when you click another window.

- [ ] **Step 5: Ready for review → consolidate** → verify: `git status` contains only main-process files

---

### Task 3: the legacy chrome replaces the tab strip

**Out of scope:** the content of the History, Settings, and About panes; the composer; the empty
state. This task changes only how you get between panes.

**Files:**

- Modify: `packages/desktop/src/app/pane.ts` (add `'about'`)
- Modify: `packages/desktop/src/app/shell/titlebar.ts` (becomes hamburger-only + menu)
- Modify: `packages/desktop/src/app/shell/status-bar.ts` (add the three icon actions)
- Modify: `packages/desktop/src/app/shell/app-shell.ts:41-53,94-121` (remove `.pane-tabs`)
- Create: `packages/desktop/src/app/shell/pane-header.ts` (back button + title, shared by the secondary panes)
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json`
- Modify: `packages/desktop/src/app/shell/app-shell.spec.ts:27-65`
- Modify: `packages/desktop/e2e/shell.spec.ts`
- Validate: `packages/desktop/src/app/shell/app-shell.spec.ts`

**Domain skills to apply:** `opentimbre-angular-ui`, `opentimbre-i18n`, `opentimbre-code-style`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`

**Interfaces:**

- Produces: `PaneHeader` with inputs `title: string` and an output `back` — consumed by the History,
  Settings, and About panes (Tasks 4 and 9)
- Produces: `Pane = 'chat' | 'history' | 'settings' | 'about'`

**Implementation and validation strategy:**

- Predominant effect: visual UI
- Implementation: `pelizzai-frontend` + visual QA, with the existing pane-switching tests rewritten
  against the new affordances
- Oracle: every pane is reachable from the chat pane and returns to it; panes stay mounted
- Command(s): `cd packages/desktop && npm run test:renderer` and `npm run desktop`
- Expected evidence: the shell renders a hamburger-only title bar, a status bar with three icon
  buttons, and no `.pane-tabs` node; the chat draft survives a round trip to Settings and back
- Rollback: not applicable — the change is additive to the pane signal and revertible as a whole
- Review profile: split — this is the task the user will judge the delivery by

- [ ] **Step 1: baseline** → verify: `npm run test:renderer` is green before you touch anything (53 tests)

- [ ] **Step 2: extend the pane model** → verify: `Pane` includes `'about'` and `PANES` still drives nothing but iteration where it is still used

- [ ] **Step 3: rebuild the title bar** → verify: it renders one button and an anchored menu

The menu is `hidden` until opened, `aria-expanded` tracks state, the opening click calls
`stopPropagation()`, and a document click closes it. Keep `-webkit-app-region: drag` on the bar and
`no-drag` on the button, or the window stops being draggable.

- [ ] **Step 4: add the status-bar actions** → verify: history, new-conversation, and settings icons sit right of a spacer

The new-conversation action reuses whatever `DesktopService` method the composer's existing `new`
button calls — do not introduce a second path.

- [ ] **Step 5: remove the tab strip and add the shared pane header** → verify: no `.pane-tabs` in the DOM and each secondary pane has a back button

- [ ] **Step 6: catalog every new string** → verify: `en.json` and `pt.json` have the same key set

Portuguese values come verbatim from the legacy: `Configurações`, `Sobre`, `Menu da aplicação`,
`Conversas anteriores`, `Nova conversa`, `Voltar para a conversa`, `Conversas`.

- [ ] **Step 7: prove it** → verify: tests green and the app matches the reference

Run: `cd packages/desktop && npm run test:renderer`
Expected: exit code 0 with the rewritten pane tests passing.

Run: `npm run desktop`
Expected: hamburger → Configurações opens Settings; the back arrow returns to chat; a draft typed in
the composer is still there afterwards.

- [ ] **Step 8: Ready for review → consolidate** → verify: `git status` contains only renderer and i18n files

---

### Task 4: the About screen

**Out of scope:** the update banner and any version-checking behavior.

**Files:**

- Create: `packages/desktop/src/app/shell/panes/about-pane.ts`
- Modify: `packages/desktop/src/app/shell/app-shell.ts` (mount the pane)
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json`
- Validate: `packages/desktop/src/app/shell/panes/about-pane.spec.ts`

**Domain skills to apply:** `opentimbre-angular-ui`, `opentimbre-i18n`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`

**Interfaces:**

- Consumes: `DesktopService.version(): string` — origin: `packages/desktop/src/app/desktop.service.ts`
- Consumes: `PaneHeader` — origin: Task 3

**Implementation and validation strategy:**

- Predominant effect: visual UI
- Implementation: `pelizzai-frontend` + a component test on the rendered content
- Oracle: icon, name with the italic platform suffix, version line, tagline
- Command(s): `cd packages/desktop && npm run test:renderer`
- Expected evidence: the pane renders the version from `DesktopService` and the tagline from the catalog
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: check for an app icon asset** → verify: you know whether a PNG equivalent to `legacy/desktop/icon/opentimbre-icon.png` exists in `packages/desktop`

If none exists, use the Lucide icon already bundled via `@lucide/angular` rather than adding an
asset; the acceptance criterion does not name the artwork.

- [ ] **Step 2: build the pane** → verify: it renders header + icon + name + version + tagline

Reference: `legacy/desktop/renderer/index.html:374-390`.

- [ ] **Step 3: catalog the strings** → verify: `pt` matches the legacy verbatim

`OpenTimbre para Windows`, `Versão {version}`, and `Timbres de guitarra em linguagem natural,
aplicados por MIDI CC nos plugins da Neural DSP.`

- [ ] **Step 4: prove it** → verify: test green and the menu route works

Run: `cd packages/desktop && npm run test:renderer`
Expected: exit code 0.

- [ ] **Step 5: Ready for review → consolidate** → verify: `git status` contains only the new pane and i18n

---

### Task 5: the chat empty state

**Out of scope:** the message stream rendering, the plugin bar, and what a chip actually sends beyond
filling the composer draft.

**Files:**

- Modify: `packages/desktop/src/app/shell/panes/chat-pane.ts`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json`
- Validate: `packages/desktop/src/app/shell/panes/chat-pane.spec.ts` (create if absent)

**Domain skills to apply:** `opentimbre-angular-ui`, `opentimbre-i18n`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`

**Interfaces:**

- Produces: a chip click sets the composer draft through `DesktopService` — consumer:
  `packages/desktop/src/app/shell/composer.ts`

**Implementation and validation strategy:**

- Predominant effect: visual UI
- Implementation: `pelizzai-frontend` + component test
- Oracle: with no messages, the invite block renders with icon, heading, paragraph, and chips; with
  messages, it disappears
- Command(s): `cd packages/desktop && npm run test:renderer`
- Expected evidence: both states asserted in the spec
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: read the reference** → verify: you have the chip source

`legacy/desktop/renderer/index.html:148-153` for the markup and
`legacy/desktop/renderer/app.ts:1214-1219` for how the chips are built.

- [ ] **Step 2: render the invite block** → verify: it shows only when the transcript is empty

- [ ] **Step 3: wire the chips** → verify: clicking a chip fills the composer draft and does not send

- [ ] **Step 4: catalog the strings** → verify: heading `Monte seu timbre`, paragraph `Descreva o som que você quer e o OpenTimbre calcula os parâmetros do plugin.`, and the chip labels

- [ ] **Step 5: prove it** → verify: `cd packages/desktop && npm run test:renderer` exits 0

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` is limited to the chat pane and i18n

---

### Task 6: the composer actions row and Manual/Auto mode

**Out of scope:** the model picker (Tasks 7 and 8) — leave a placeholder slot on the left of the
actions row for it.

**Files:**

- Modify: `packages/desktop/src/app/shell/composer.ts`
- Create: `packages/desktop/src/app/shell/mode-menu.ts`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json`
- Modify: `packages/desktop/e2e/settings.spec.ts` (the `autoApply` toggle now has a second surface)
- Validate: `packages/desktop/src/app/shell/composer.spec.ts` (create if absent)

**Domain skills to apply:** `opentimbre-angular-ui`, `opentimbre-i18n`, `opentimbre-code-style`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`

**Interfaces:**

- Consumes: `DesktopService.autoApply()` and `DesktopService.setAutoApply(value: boolean)` — origin:
  `packages/desktop/src/app/desktop.service.ts`

**Implementation and validation strategy:**

- Predominant effect: visual UI over an existing setting
- Implementation: `pelizzai-frontend` + component test
- Oracle: the mode button reflects `autoApply`, the menu sets it, and the Settings checkbox and the
  composer button stay in step because both read the same signal
- Command(s): `cd packages/desktop && npm run test:renderer`
- Expected evidence: toggling in the menu flips the Settings checkbox in the same session
- Rollback: not applicable
- Review profile: split — `autoApply` sends real MIDI, so a mislabeled state has a physical effect

- [ ] **Step 1: restructure the composer** → verify: textarea on top, actions row below, hint line under both

Reference: `legacy/desktop/renderer/index.html:156-258`. The model slot takes `margin-right: auto`;
the container stays `justify-content: flex-end` so the mode menu anchors correctly.

- [ ] **Step 2: build the mode menu** → verify: two options, each with a bold name and an explanatory line, opening upward

The composer sits at the bottom of a 700px window — upward is the only direction with room.

- [ ] **Step 3: bind it to `autoApply`** → verify: the button label reads `Manual` when false and `Auto` when true

Do not introduce a second source of truth; the signal in `DesktopService` is the state.

- [ ] **Step 4: catalog the strings** → verify: the two option descriptions match the legacy verbatim

`Você escolhe quando aplicar, clicando no cartão de cada timbre.` and `Aplica sozinho quando a IA
responde com um timbre só. Duas ou mais sugestões continuam manuais.` Plus the hint line
`Enter envia · Shift+Enter quebra linha`.

- [ ] **Step 5: prove it** → verify: `cd packages/desktop && npm run test:renderer` exits 0 and the Settings checkbox mirrors the menu

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` is limited to composer, mode menu, i18n, and the e2e spec

---

### Task 7: main can list the available models

**Out of scope:** any renderer file. This task ends at a typed IPC channel with tests.

**Files:**

- Modify: `contracts/src/ipc.ts` (add the channel, its payload, and `ModelInfo`)
- Modify: `packages/desktop/src/preload/preload.cts`
- Modify: `packages/desktop/src/main/ipc/handlers.ts`
- Modify: `packages/desktop/src/main/ipc/validation.ts`
- Create: `packages/desktop/src/main/ai/model-catalog.ts`
- Validate: `packages/desktop/src/main/ai/model-catalog.test.ts`

**Domain skills to apply:** `opentimbre-electron-ipc`, `opentimbre-secrets`, `opentimbre-testing`, `opentimbre-code-style`

**Cross-cutting harness skills to apply:** `pelizzai-oswap`

**Interfaces:**

- Produces: `'ai:listModels': { payload: void; result: Result<ModelInfo[]> }` where
  `ModelInfo = { provider: 'anthropic' | 'openai'; id: string; label: string; tier: 'low' | 'mid' | 'high' }`
  — consumer: Task 8
- Consumes: the existing key vault — origin: `packages/desktop/src/main/storage/vault.ts`

**Implementation and validation strategy:**

- Predominant effect: behavior with a sensitive surface
- Implementation: TDD red→green with the HTTP layer injected, so no test needs a real key
- Oracle: a provider with a key contributes its models; a provider without one contributes nothing
  and does not fail the call; a provider that errors degrades to a partial list plus an error string
- Command(s): `cd packages/desktop && npm run test:main`
- Expected evidence: a fixture-driven test proving the merge, the tier derivation, the label
  prettifier, and that no key value appears in any returned object or logged line
- Rollback: revert; the channel is additive and nothing else consumes it yet
- Review profile: split — a credential is read here; `pelizzai-oswap` runs before final validation

- [ ] **Step 1: port the tier and label rules** → verify: `gpt-5.6-sol` renders `GPT-5.6 Sol` and an Anthropic id passes through unchanged

Reference: `legacy/desktop/renderer/app.ts:905-935` (`rotuloModelo`) and the `nivelCusto` derivation
near it. Neither provider returns pricing — the tier is derived from the id. Port the legacy rules
rather than inventing a taxonomy.

- [ ] **Step 2: RED on the catalog** → verify: tests fail against an empty module

Inject the fetch function. Cases: both keys, one key, no key, one provider throwing, and a malformed
response body.

- [ ] **Step 3: implement** → verify: GREEN, and the result never carries a key

The key is read inside main and used only as a request header. It is never returned, never attached
to an error, and never logged — assert this in a test that stringifies the whole result and greps for
the fixture key.

- [ ] **Step 4: wire the channel** → verify: typed in contracts, exposed in preload, sender-validated in main

Follow the shape of the existing handlers in `handlers.ts:106`; the channel takes no payload, so
validation is limited to the sender check.

- [ ] **Step 5: prove it** → verify: `cd packages/desktop && npm run test:main` exits 0 and `npm run typecheck` passes at the repo root

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` contains no renderer file

---

### Task 8: the model picker in the composer

**Out of scope:** how the list is produced (Task 7) and the Settings model field, which stays as the
manual override.

**Files:**

- Create: `packages/desktop/src/app/shell/model-menu.ts`
- Modify: `packages/desktop/src/app/shell/composer.ts` (fill the slot from Task 6)
- Modify: `packages/desktop/src/app/desktop.service.ts` (expose the models signal and the loader)
- Modify: `packages/desktop/src/app/testing/fake-desktop-api.ts`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json`
- Validate: `packages/desktop/src/app/shell/model-menu.spec.ts`

**Domain skills to apply:** `opentimbre-angular-ui`, `opentimbre-i18n`, `opentimbre-secrets`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`

**Interfaces:**

- Consumes: `DesktopService.listModels(): Promise<void>` populating a `models` signal — origin: this task
- Consumes: `ModelInfo[]` — origin: Task 7

**Implementation and validation strategy:**

- Predominant effect: visual UI over a new capability
- Implementation: `pelizzai-frontend` + component test with the fake API
- Oracle: the button shows the active model's label; the panel opens upward anchored left, filters as
  you type, and groups by tier; an empty list shows the stored `model_id` and an explanatory line
- Command(s): `cd packages/desktop && npm run test:renderer`
- Expected evidence: filter, grouping, empty state, and error state all asserted
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: extend the fake API** → verify: `createFakeDesktopApi()` can return a fixture list, an empty list, and an error

- [ ] **Step 2: build the panel** → verify: search field on top, grouped list below, opening upward and anchored left

`left: 0`, not right — the button is pushed left by `margin-right: auto`. Reference:
`legacy/desktop/renderer/index.html:185-205`.

- [ ] **Step 3: handle the degraded states** → verify: no key, empty list, and provider error each render an explanatory line instead of an empty panel

- [ ] **Step 4: persist the choice** → verify: selecting a model writes it through the existing model setting and the label survives a restart

- [ ] **Step 5: prove it** → verify: `cd packages/desktop && npm run test:renderer` exits 0

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` is limited to renderer files and i18n

---

### Task 9: Settings reaches legacy parity

**Out of scope:** the key storage contract itself — `KeyInfo`, the vault, and the IPC channels stay
exactly as they are. This task changes presentation and grouping only.

**Files:**

- Modify: `packages/desktop/src/app/shell/panes/settings-pane.ts`
- Modify: `packages/desktop/src/app/shell/panes/ai-settings.ts`
- Modify: `packages/desktop/src/app/shell/panes/guitar-form.ts`
- Modify: `packages/i18n/src/en.json`, `packages/i18n/src/pt.json`
- Modify: `packages/desktop/e2e/settings.spec.ts`
- Validate: `packages/desktop/e2e/settings.spec.ts`

**Domain skills to apply:** `opentimbre-angular-ui`, `opentimbre-secrets`, `opentimbre-i18n`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`, `pelizzai-oswap`

**Interfaces:**

- Consumes: `PaneHeader` — origin: Task 3
- Consumes: the existing `KeyInfo` signals on `DesktopService` — origin: unchanged

**Implementation and validation strategy:**

- Predominant effect: visual UI over a sensitive surface
- Implementation: `pelizzai-frontend` + the existing e2e settings spec extended
- Oracle: four groups in the legacy order; a key row per provider with the correct badge; saving
  clears the input and never renders the key
- Command(s): `cd packages/desktop && npm run test:renderer && npm run test:e2e`
- Expected evidence: a spec asserting the three badge states and that the input is empty after save
- Rollback: not applicable
- Review profile: split — `pelizzai-oswap` runs on this diff before final validation

- [ ] **Step 1: regroup the pane** → verify: Sua guitarra → Inteligência artificial → Aparência → Janela, each with its heading and explanatory line

Reference: `legacy/desktop/renderer/index.html:272-371`.

- [ ] **Step 2: move the window toggles into the Janela group** → verify: each checkbox has a bold label and an explanatory line

`Sempre por cima` / `A janela fica acima do plugin em vez de sumir atrás dele.` and
`Escurecer sem foco` / `Fica translúcida enquanto você toca, e volta ao clicar nela.`

- [ ] **Step 3: rebuild the key rows** → verify: the three badge states render correctly

`SEM CHAVE` when no key exists, `DO .ENV` when `source === 'environment'`, and the last-characters
hint when `source === 'app'`. The input stays `type="password"` — the legacy comment at
`index.html:314-319` explains why: the window lives on top of everything, often with someone else
watching the screen.

- [ ] **Step 4: catalog the strings** → verify: `pt` matches the legacy verbatim, including the provider option labels

`Automático — o primeiro com chave válida`, `Anthropic — Claude`, `OpenAI — GPT`, and the AI section
note `As chaves ficam só neste computador, cifradas pela conta do Windows. Elas nunca voltam para a
tela — depois de salvas, só a dica das pontas.`

- [ ] **Step 5: prove it** → verify: renderer and e2e suites green

Run: `cd packages/desktop && npm run test:renderer && npm run test:e2e`
Expected: exit code 0 on both.

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` is limited to the settings panes, i18n, and the e2e spec

---

### Task 10: the whole app is green, packaged and unpackaged

**Out of scope:** any new behavior. Only fixes needed to make the existing proofs pass belong here.

**Files:**

- Modify: `packages/desktop/e2e/*.spec.ts` as needed
- Modify: `packages/desktop/e2e-packaged/packaged.spec.ts` as needed
- Validate: the full suite

**Domain skills to apply:** `opentimbre-testing`, `opentimbre-cross-platform`

**Cross-cutting harness skills to apply:** `pelizzai-frontend`

**Interfaces:** none

**Implementation and validation strategy:**

- Predominant effect: behavior (regression)
- Implementation: characterization — the suites must go green without changing what they assert about
  behavior, only about the new affordances
- Oracle: `npm run check` at the repo root, plus the packaged smoke
- Command(s): `npm run check`, then `cd packages/desktop && npm run dist:win && npm run test:packaged`
- Expected evidence: exit code 0 everywhere; the packaged app opens a window
- Rollback: not applicable
- Review profile: split

- [ ] **Step 1: full suite** → verify: `npm run check` exits 0 at the repo root

- [ ] **Step 2: e2e** → verify: `cd packages/desktop && npm run test:e2e` exits 0

- [ ] **Step 3: packaged smoke** → verify: the packaged app boots — this is the proof that Task 1's ESM fix survives packaging

Run: `cd packages/desktop && npm run dist:win && npm run test:packaged`
Expected: exit code 0.

- [ ] **Step 4: fresh-profile acceptance** → verify: spec §6 criteria 4 and 5

Delete the settings database under the Electron `userData` path, launch, and confirm Portuguese on a
pt-BR system, always-on-top, and dimming on unfocus.

- [ ] **Step 5: visual QA against the reference** → verify: each screen in spec §3 matches

Compare against `legacy/desktop/renderer/index.html` and the user's reference screenshots, in both
themes and at the 360px minimum width.

- [ ] **Step 6: Ready for review → consolidate** → verify: `git status` is clean apart from this task's fixes

---

## Requirement → task map

| Spec requirement | Task |
| --- | --- |
| §1.1 app does not start | 1 |
| §1.2 first launch has no locale (acceptance 4) | 2 |
| §1.3 window behavior default (acceptance 5) | 2 |
| §3.1 title bar and menu (acceptance 2) | 3 |
| §3.2 status bar (acceptance 2) | 3 |
| §3.3 panes and navigation (acceptance 2) | 3 |
| §3.7 About (acceptance 3) | 4 |
| §3.4 chat empty state (acceptance 3) | 5 |
| §3.5 composer rows, mode menu, hint (acceptance 3) | 6 |
| §3.5 model listing capability | 7 |
| §3.5 model picker panel (acceptance 3) | 8 |
| §3.6 Settings groups and key rows (acceptance 3, 6) | 9 |
| §6 acceptance 1 and 7 | 1, 10 |

## Dependencies

```text
1 → 2 → 3 → 4, 5, 6, 9
              6 → 8
              7 → 8
3, 4, 5, 6, 8, 9 → 10
```

Tasks 4, 5, 6, 7, and 9 touch disjoint files once Task 3 lands, so they are the only real
parallelization candidates. Tasks 4, 5, 6, and 9 all edit `en.json`/`pt.json`, which makes them
conflict-prone in a shared working tree — sequence them unless the setup gate chooses otherwise.

## Setup recommendations (the gate decides, not this plan)

```text
isolation: branch — the plan branch spec/ui-legacy-parity already carries the artifacts
execution-mode: inline — the i18n catalogs are a shared write surface across most tasks
commit-strategy: granular — ten tasks with distinct, individually revertible outcomes
review-profile: split on every task — UI the user judges by eye, plus a credential surface in 7 and 9
```
