# Task state — PelizzAI

> Cursor of the active task. Lives in `pelizzai/data/state.md`.
> Doctrine — who writes each field, the Delivery lifecycle (`delivered` → `done`), reconciliation,
> and history hygiene — lives in `pelizzai-execution-plans` → SKILL.md §State and resumption.
> No active task = `slug: <none>`. `phase: blocked` = stuck, awaiting a human decision.

## Active task

- slug: ui-legacy-parity
- track: feature
- lane: exploratory
- phase: delivered
- branch: spec/ui-legacy-parity
- base-ref: refs/remotes/origin/main
- base-sha: c687657c129f99c8b449ba205469b027470b2faa
- validated-head: a4d03b99fb3e4cf708e4dce21bc88cb90dd3e31c
- delivery-head: <none>
- delivery-status: <will be recorded after the destination>
- confirm: base-ref contains validated-head (PR/branch integrated)
- kickoff: ratified 2026-08-09; quick-fix (native title bar/menu) resumed and ratified 2026-08-09; quick-fix (history nav + plugin-bar scoping) resumed and ratified 2026-08-09 on current branch; quick-fix (live plugin bar/history refresh/safe conversation switching/auto-apply feedback/model-select width) resumed and ratified 2026-08-09 on current branch — interview-me on scope of "switch conversations while one awaits a response": user chose free navigation without concurrent sending (not full concurrency); quick-fix (live MIDI status wiring + MODEL label parity) resumed and ratified 2026-08-09 on current branch; quick-fix (default window size 678x864) resumed and ratified 2026-08-09 on current branch; bug fix (MIDI eager connect at startup) resumed and ratified 2026-08-09 on current branch; quick-fix (MIDI status display pattern: dot + Connected/Not found) resumed and ratified 2026-08-09 on current branch; quick-fix (composer bottom-bar parity against a legacy reference screenshot) resumed and ratified 2026-08-09 on current branch; quick-fix (composer textarea auto-grow + single bordered box with actions) resumed and ratified 2026-08-09 on current branch
- isolation: branch
- worktree-path: <none>
- execution-mode: inline
- commit-strategy: granular
- review-profile: split
- effect: external
- risk: medium
- overlays: pelizzai-frontend, pelizzai-oswap, opentimbre-angular-ui, opentimbre-electron-ipc, opentimbre-secrets, opentimbre-i18n, opentimbre-testing, opentimbre-code-style
- audience: technical
- spec: pelizzai/specs/2026-08-09-ui-legacy-parity.md
- plan: pelizzai/plans/2026-08-09-ui-legacy-parity.md
- project: C:/Users/dingo/github/opentimbre

## Progress

- 10 plan tasks: done, sealed at a4d03b9 (fbf10b6 = seal commit); awaiting destination decision
- quick-fix (post-delivery): remove native OS title bar text and default File/Edit/View/Window
  menu — `titleBarStyle: 'hidden'` + `titleBarOverlay` (keeps native minimize/maximize/close),
  `Menu.setApplicationMenu(null)` — done; typecheck clean, 75/75 main-process tests green
- quick-fix (post-delivery): history click now switches back to the chat pane after opening a
  conversation; the top plugin bar shows only the plugin the AI suggested for the open
  conversation (`OpenConversation.plugin`) instead of the whole catalog; each history row now
  shows its own suggested plugin — done at 960f8ab; typecheck clean (desktop + contracts), 79/79
  main-process tests, 74/74 renderer tests green
- quick-fix (post-delivery): live plugin bar/history refresh, safe conversation switching, auto-apply
  feedback, model-select width — plugin bar and history rows now update from each response's rig
  instead of only on explicit reopen; history list refreshes after every send; a response for a
  conversation the guitarist has navigated away from is dropped (generation-counter guard) instead
  of corrupting the visible transcript, and the main process only applies a finished send's
  rig/auto-apply if that conversation is still active (`active === a` guard) — true concurrent
  sending stays out of scope by design, ratified via interview-me; Auto mode's silent apply now
  updates the status-bar amp pill; model-picker button given a fixed width — done at b5eeb83;
  typecheck clean (core + contracts + desktop), 81/81 main-process tests, 77/77 renderer tests
- quick-fix (post-delivery): MIDI identification was silently broken — `buildAppState` always
  reported `midi: { port: null, error: null }` regardless of the real connection, so the status
  bar never showed the actual port/error. `app-state.ts`/`handlers.ts` now source `midi` from the
  scene applier's real connection state (`SceneApplier.midiState()`); `DEFAULT_PORT` in
  `windows.ts`/`macos.ts` (checks for a port named `VoiceRig`, overridable via `VOICERIG_PORT`) is
  now documented as a name that may change in a future release. The MODEL badge showed the raw
  model id instead of the name chosen from the model list — added `modelLabel` end-to-end
  (contracts → main `model-catalog` → `desktop.service` → status bar) and removed the now-redundant
  free-text model field on the AI settings pane. Also carried over from this session's uncommitted
  work: main-process window opacity for dim-on-unfocus, saved API keys loaded into `process.env` on
  boot, immediate first plugin poll on start — done at 72d419d; typecheck clean (all workspaces),
  81/81 main-process tests, 77/77 renderer tests, 29/29 platform-node tests, 11/11 CLI tests green
- quick-fix (post-delivery): default window size changed from 420x700 to the requested 678x864 —
  updated both the `BrowserWindow` constructor default in `window.ts` and the persisted-bounds
  `DEFAULTS` in `desktop-store.ts` (a fresh install/reset has no stored bounds yet, so both must
  agree); dropped two now-stale exact-pixel references in unrelated doc comments (`mode-menu.ts`,
  `titlebar.ts`) that named the old default — done at ae7504d; typecheck clean, 81/81 main-process
  tests, 77/77 renderer tests green. Noted but NOT fixed (pre-existing, out of scope): `window.ts`'s
  `BrowserWindow` call never reads `opts.bounds.width`/`height` — only `x`/`y` — so a
  guitarist-resized window snaps back to the default width/height on relaunch even though the size
  is persisted to the store; worth a follow-up if that's unwanted behavior.
- bug fix (post-delivery): MIDI showed "closed" in the status bar even with loopMIDI's VoiceRig
  port already open before launch — confirmed cause: `SceneApplier.apply()` only opened the MIDI
  port lazily on the first scene apply, so `midiState()` stayed `{ port: null, error: null }` until
  a rig was actually applied. Added `SceneApplier.connect()` (same connect-and-cache logic, no rig
  required) and call it once at startup in `main.ts`, mirroring the plugin manager's immediate first
  poll. Known remaining limitation, out of scope: no periodic re-check, so opening loopMIDI only
  after the app has started still won't update the status until a scene is applied or the app
  restarts — flagged to the user as a possible follow-up — done at 3854825; typecheck clean, 83/83
  main-process tests green (2 new)
- open question raised, not yet decided: cross-provider/model conversation resume currently drops
  all memory (`memoryLost: true`, banner shown) by design (`rig-chat.ts`'s `canResume` requires an
  exact provider+model match against `RigChatSnapshot`) — the user wants the AI to keep the
  conversation's context even when reopened under a different provider or model. Investigated:
  `createSession(system, history)` in both `openai.ts` and `anthropic.ts` accepts a plain
  history array and the stored `messages` (role+text, provider-agnostic) could seed a synthetic
  history on incompatible resume instead of starting empty — feasible, but a real design decision
  (fidelity loss on tool-call state, extra tokens resent every incompatible resume, same-model vs
  same-provider granularity, banner wording) that reverses documented intended behavior. Recommendation
  given to the user, awaiting their decision before implementing.
- quick-fix (post-delivery): MIDI status display simplified to one pattern —
  `MIDI <dot> Connected`/`Not found` (pt: `Conectado`/`Não localizado`), dot green (`--success`) when
  connected, red (`--danger`) otherwise. Replaced the old three-way text ("Port open: <name>" /
  "MIDI closed" / raw MIDI error message); the port name and the specific error string no longer
  render in the status bar. Removed `shell.status.midiOpen/midiClosed/midiError` from both locales
  (i18n key-parity test still green), added `midiConnected`/`midiNotFound`. Updated the e2e assertion
  pinned to the old "Port open: Virtual Port" copy — done at 398fccf; typecheck clean, i18n
  key-parity test green, 77/77 renderer tests, e2e `update.spec.ts`/`shell.spec.ts` green except one
  pre-existing, unrelated `2px` vs `3px` focus-outline-width assertion (not touched by this change,
  looks like a display-scaling artifact of this sandbox, not a regression).
- quick-fix (post-delivery): user supplied two reference screenshots of the composer bottom bar
  (model picker bottom-left, Manual/Auto picker + send bottom-right, hint line centered below; the
  Manual/Auto popup with pencil/zap icons and pt-BR descriptions) and asked to match that layout.
  Verified via a throwaway Playwright screenshot (script + PNGs not committed) rendered against the
  real built bundle at 678x864, pt locale — the layout, icons, popup copy, and positioning already
  matched pixel-for-pixel; the one real gap found was `ModelMenu.activeLabel()` showing the raw
  lowercase model id ("gpt-5.6-terra") instead of the formatted label ("GPT-5.6 Terra") whenever the
  model catalog search missed (e.g. before `listModels()` resolves) — it re-derived the label instead
  of using `ai.modelLabel` (added earlier this session for the same top-status-bar parity). Fixed to
  read `ai.modelLabel` directly — done at 0bb8e84; typecheck clean, 77/77 renderer tests green,
  re-screenshotted to confirm the composer button now matches the reference exactly.
- false alarm, resolved: `npm run desktop` appeared to crash before any window opened —
  `TypeError: Cannot read properties of undefined (reading 'registerSchemesAsPrivileged')` — when
  launched from the agent's own sandboxed shell (no display attached). The user confirmed
  `npm run desktop` boots normally on their machine, so this was environment-specific to the
  sandbox, not a defect in the app or in this quick-fix. No code change needed; the earlier
  speculative `setImmediate` deferral attempt was already reverted, not committed.
- quick-fix (post-delivery): user supplied a new reference screenshot showing the composer's
  textarea and its actions row (model picker, Manual/Auto, send) sharing ONE rounded bordered box,
  and asked for the textarea to grow with the typed text. The two were previously separate boxes
  (`.entry` had its own border; `.actions` sat below it, outside that border, inside an unbordered
  `.composer`), and the textarea had no auto-grow (`rows="1"`, fixed `max-height: 96px`, no resize
  JS). Restructured to match the legacy pattern (`legacy/desktop/renderer/styles.css`'s
  `.composer-inner` + `app.ts`'s `ajustarAltura()`): a new `.composer-inner` wrapper carries the
  single border/radius/background and a `focus-within` border-color change, holding both the
  textarea (now borderless/transparent, `padding:0`) and `.actions` (`padding-top` in place of the
  border's old gap); `Composer.resize()` sets `height: auto` then `scrollHeight`px on every input,
  capped by `.entry`'s `max-height: 150px`, and `send()` resets the textarea's value/height via a
  `viewChild` template ref before clearing the draft signal — done at 998069d; typecheck clean,
  83/83 main-process tests, 77/77 renderer tests green; verified with a throwaway Playwright
  screenshot (script + PNGs not committed) against the real built bundle at 678x864, pt locale:
  baseline matches the reference (merged box, model left / Manual+send right, hint below), typing a
  long draft grows the box to two lines while the actions stay pinned inside it, and it collapses
  back to one row after the simulated send.

## History

- 2026-08-03 — state initialized (pelizzai-router / pelizzai-starting-branch / pelizzai-audit)
- 2026-08-03 bootstrap-harness — delivered — harness + 8 domain skills, local → data/history/2026-08-03-bootstrap-harness.md
- 2026-08-06 rebuild-phase1-foundation — done — local delivery accepted; 125 tests passed → data/history/2026-08-05-rebuild-phase1-foundation.md
- 2026-08-06 rebuild-phase2-plugins — done 2026-08-06 — PR #1 merged into origin/main at 0e1f593 → data/history/2026-08-06-rebuild-phase2-plugins.md
- 2026-08-08 phase3-desktop — done 2026-08-08 — PR #2 merged into origin/main at 49e0dea → data/history/2026-08-08-phase3-desktop.md
- 2026-08-08 phase4-packaging — done 2026-08-09 — observed: origin/main contains validated-head 1ebccaf (PR #5 at eb8242c); follow-up PR #6 merged at c687657 → data/history/2026-08-08-phase4-packaging.md
- 2026-08-09 ui-legacy-parity — delivered — legacy UI parity, 10 tasks, split review → data/history/2026-08-09-ui-legacy-parity.md

_Last updated: 2026-08-09_