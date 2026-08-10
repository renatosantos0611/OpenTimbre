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
- validated-head: 349929e1016c04b52b174bfa73fd15728880caeb
- delivery-head: <none>
- delivery-status: <will be recorded after the destination>
- confirm: base-ref contains validated-head (PR/branch integrated)
- kickoff: ratified 2026-08-09; quick-fix (native title bar/menu) resumed and ratified 2026-08-09; quick-fix (history nav + plugin-bar scoping) resumed and ratified 2026-08-09 on current branch; quick-fix (live plugin bar/history refresh/safe conversation switching/auto-apply feedback/model-select width) resumed and ratified 2026-08-09 on current branch — interview-me on scope of "switch conversations while one awaits a response": user chose free navigation without concurrent sending (not full concurrency); quick-fix (live MIDI status wiring + MODEL label parity) resumed and ratified 2026-08-09 on current branch; quick-fix (default window size 678x864) resumed and ratified 2026-08-09 on current branch; bug fix (MIDI eager connect at startup) resumed and ratified 2026-08-09 on current branch; quick-fix (MIDI status display pattern: dot + Connected/Not found) resumed and ratified 2026-08-09 on current branch; quick-fix (composer bottom-bar parity against a legacy reference screenshot) resumed and ratified 2026-08-09 on current branch; quick-fix (composer textarea auto-grow + single bordered box with actions) resumed and ratified 2026-08-09 on current branch; quick-fix (composer button-height alignment + 2-line default textarea) resumed and ratified 2026-08-09 on current branch; quick-fix (composer select chevrons pinned to a fixed end position) resumed and ratified 2026-08-09 on current branch; quick-fix (composer AI icon, fixed-size model panel, search autofocus) resumed and ratified 2026-08-09 on current branch — interview-me on which icon represents AI: user chose Brain circuit (LucideBrainCircuit) over Sparkles/Bot/Wand; quick-fix (move AI icon onto the model select, ChatGPT-logo request declined) resumed and ratified 2026-08-09 on current branch — interview-me: OpenAI's logo is absent from simple-icons (looks trademark-pulled) while Anthropic's is present, so a static ChatGPT icon would misrepresent the multi-provider picker; user chose a generic icon for both providers over a per-provider brand icon or a supplied logo file; quick-fix (select label left-align + Claude label formatting) resumed and ratified 2026-08-09 on current branch — interview-me: user confirmed formatting Claude model names to match GPT's polish (e.g. "Claude Opus 5") rather than leaving them as raw ids; bug fix (active-model label raced a cache lookup, showed raw id after selecting) resumed and ratified 2026-08-09 on current branch; quick-fix (model-select width) + bug fix (plugin bar missing after boot-poll race) resumed and ratified 2026-08-10 on current branch
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
- quick-fix (post-delivery): user asked for the model/Manual/send controls to sit at the same
  height, and for the textarea to start at 2 lines instead of 1. `.model-btn`
  (`model-menu.ts`) and `.mode-btn` (`mode-menu.ts`) were `height: 32px` against `.send`'s
  `36px` — bumped both to `36px` so the whole actions row sits flush. `.entry` had no
  `min-height`, so it opened at one line; added `min-height: calc(2 * 14px * 1.4)` (the
  textarea's own font-size/line-height) — the auto-grow from the previous commit still expands
  past it — done at 777ce65; typecheck clean, 83/83 main-process tests, 77/77 renderer tests
  green; verified with a throwaway Playwright screenshot (script + PNG not committed) against the
  real built bundle at 678x864, pt locale: `.send`/`.model-btn`/`.mode-btn` all measured 36px tall
  and the empty `.entry` measured ~39px (two lines).
- quick-fix (post-delivery): user asked for the model select's chevron to sit at a fixed place at
  the end of the button, for the Manual/Auto select to have a fixed size with its chevron fixed
  the same way, and for the two chevrons to look the same. Root cause of the model select: its
  `.model-btn` had a fixed `width: 160px`, but `.label` had no `flex`/`min-width` — for a short
  model name (e.g. "GPT-4o") the label just wrapped its content and the chevron sat immediately
  after the text, leaving a visible gap before the button's real right edge (only long labels
  happened to reach the edge). Root cause of the mode select: `.mode-btn` had no width at all, so
  its content-driven size (and the chevron's position) shifted between "Manual" and "Auto".
  Fixed both the same way: `.label { flex: 1; min-width: 0; overflow: hidden; text-overflow:
  ellipsis; white-space: nowrap }` so the label fills the available space and the chevron
  (`.chev { flex: none }`) always docks flush right; gave `.mode-btn` a fixed `width: 112px` (was
  content-sized) so it no longer resizes between modes — done at 2f8205c; typecheck clean, 83/83
  main-process tests, 77/77 renderer tests green; verified with a throwaway Playwright script
  (not committed) against the real built bundle at 678x864, pt locale, using a short model label
  on purpose: both chevrons measured a 9-11px inset from their button's right edge (padding, not a
  gap) and `.mode-btn`'s right edge/chevron position were pixel-identical between "Manual" and
  "Auto".
- quick-fix (post-delivery): user asked for (1) the model select to be left-aligned — already true
  (`ot-model-menu` is the actions row's first child with `margin-right: auto`, unchanged), (2) an
  AI icon in the input's left corner, (3) the model panel to be a fixed size, and (4) opening the
  model panel to focus the search field so the guitarist doesn't have to click it before typing.
  Icon choice had no legacy reference to copy, so it went through interview-me: user picked Brain
  circuit (`LucideBrainCircuit`) over Sparkles/Bot/Wand. `composer.ts` gained a `.entry-row` flex
  row (icon + textarea) so the icon sits fixed at the top-left regardless of how tall the textarea
  grows; the icon never overlaps typed text since it's a flex sibling, not an absolute overlay.
  `model-menu.ts`'s `.panel` changed from `max-height: 320px` to a fixed `height: 320px` (was
  shrinking to fit fewer filtered results). Autofocus: a `viewChild` ref on the search `<input>` +
  an `effect()` watching `open()` (constructor-created, torn down via `DestroyRef`, mirroring
  `AppShell`'s existing theme effect so the minifier doesn't drop it) — done at 5fe811c; typecheck
  clean, 83/83 main-process tests, 77/77 renderer tests green; verified with a throwaway Playwright
  script (not committed) against the real built bundle at 678x864, pt locale: search input reported
  as `document.activeElement` immediately after opening, and the panel's bounding box (240x320) was
  pixel-identical before and after typing a filter that narrowed 3 models down to 1.
- quick-fix (post-delivery): user said the icon from the previous quick-fix was in the wrong
  place (it should be on the model select, not floating over the free-text input) and asked to
  swap it for the ChatGPT icon. Moved the icon: `composer.ts` reverted to a plain textarea (no
  `.entry-row` wrapper, no icon), and `model-menu.ts`'s `.model-btn` gained the icon as its
  leading child (before `.label`), `flex: none` like the chevron. On the icon swap: checked
  simple-icons' dataset (`data/simple-icons.json`) directly — Anthropic's mark is there, but
  there is no OpenAI/ChatGPT entry at all (title search for "openai"/"gpt"/"chatgpt" only turns up
  "OpenAI Gym", unrelated), consistent with a trademark-driven removal rather than an oversight.
  Since this model picker lists both GPT and Claude models, a fixed ChatGPT icon would misrepresent
  it whenever a Claude model is active — raised this to the user with 3 options (dynamic per-provider
  brand icons / static ChatGPT regardless of provider / generic icon for both) before touching code.
  First interview-me picked "dynamic per-provider"; once the OpenAI-logo gap surfaced, a second
  interview-me (generic-for-both / generic-GPT-plus-real-Anthropic-logo / user-supplied file) landed
  on generic for both — kept the already-chosen Brain circuit glyph rather than introducing a
  one-sided brand icon or fabricating an OpenAI mark from memory — done at ee3cb60; typecheck clean,
  83/83 main-process tests, 77/77 renderer tests green; verified with a throwaway Playwright
  screenshot (not committed) against the real built bundle at 678x864, pt locale: icon now renders
  inside `.model-btn` before the label, textarea has no icon.
- quick-fix (post-delivery): user reported the model name looked centered instead of left-aligned,
  and asked whether GPT version names should be capitalized ("leave everything uppercase, at
  least GPT"). Root cause of the centering: `.model-btn`/`.mode-btn` are `<button>` elements, whose
  UA default is `text-align: center`; `.label` never overrode it (only `.item` in the model list
  had an explicit `text-align: left`), so a short label centered inside its `flex: 1` box instead
  of sitting flush left after the icon — added the explicit override to both selects' `.label`
  (same latent bug in both, fixed for consistency even though only the model select was called
  out). On capitalization: GPT labels were already correct (`GPT-5.6 Terra`, from
  `model-catalog.ts`'s `modelLabel()`); the real gap was Anthropic — that function only formatted
  the `gpt-*` family and passed Claude ids through raw (`claude-opus-5` instead of a display name),
  a stark inconsistency next to GPT's polish. Confirmed via interview-me before touching the
  formatter (it's a real naming-scheme decision, not a mechanical tweak): extended `modelLabel()`
  to capitalize `claude-<family>-<version>`, normalizing a dashed point release (`-4-5`) to dotted
  (`4.5`) — the same shape `modelTier` already parses. TDD: updated `model-catalog.test.ts`'s
  assertions first (confirmed RED — actual `'claude-opus-5'` vs expected `'Claude Opus 5'`), then
  implemented (GREEN) — done at 03542c0; typecheck clean, 83/83 main-process tests (includes the
  updated `model-catalog.test.ts`), 77/77 renderer tests green; verified with a throwaway Playwright
  script (not committed) against the real built bundle at 678x864: label text's left edge now
  matches its box's left edge (was centered with ~17px gap on each side), and an active
  `claude-sonnet-4-5` model renders as "Claude Sonnet 4.5" in the select.
- bug fix (post-delivery): user reported the previous fix "didn't work for GPT" — the model
  panel's list showed "GPT-5.5" correctly, but after selecting it, both the select's own button
  and the top "MODELO" status bar showed the raw "gpt-5.5". First checked whether the status bar
  and the select could actually disagree (they read the identical `ai.modelLabel` field — ruled
  that out) before looking for a real bug. Found it in `main.ts`'s `getAi()`: it computed the
  active label by finding the model in `modelCache` and reading `cached.provider`/`cached.id`
  back out of that match, falling back to the raw id when the lookup missed. `modelCache` is
  populated by two independent, uncoordinated fetches — a background warm-up kicked off at boot,
  and the picker's own `listModels()` IPC call — so selecting a model before either had resolved
  missed the lookup and silently fell back to the raw id; the list panel was unaffected since it
  computes labels fresh via `listAvailableModels()`, never through this cache. Root fix:
  `providerId`/`modelId` are already read from the store two lines above `getAi()`'s cache lookup,
  so the lookup was never actually needed — `modelLabel()` only needs provider+id. Removed it
  entirely instead of trying to keep two caches in sync — done at b285bd0; typecheck clean, 83/83
  main-process tests, 77/77 renderer tests green. `main.ts`'s bootstrap closures aren't covered by
  an existing test file, so verified with a throwaway script (not committed) importing the real
  `modelLabel()`: with an empty `modelCache` (the exact race), the old logic reproduced the bug
  (`'gpt-5.5'`) and the new logic returned `'GPT-5.5'` for the same input, plus `'Claude Sonnet
  4.5'` for the Anthropic case — both independent of cache state.
- quick-fix (post-delivery): user asked to widen the composer's model select so "Claude Sonnet 5"
  reads in full. `.model-btn`'s `max-width: 160px` left thin margin for longer labels at the
  composer's narrow-viewport breakpoint (360px); raised the cap to `200px` (still shrinks below
  that via the existing flex-shrink at 360px) — done at ed70bd9; typecheck clean, 78/78 renderer
  tests green. Verified with a throwaway Playwright spec (not committed) against the real built
  bundle, checking `label.scrollWidth <= label.clientWidth` for "Claude Sonnet 5"/"Claude Sonnet
  4.5" at 678px and 360px — note the same check also passed at the old 160px value, so this widens
  headroom for what the user reported rather than fixing a provably reproducible overflow.
- bug fix (post-delivery): user reported the top plugin bar not appearing after an AI response or
  when opening a conversation from history. Root cause: `PluginBar` only renders a plugin once
  `pluginStates()` has an entry for it, and that map is filled solely by the main process's
  boot-time poll (`plugins.start()` in `main.ts`) pushing `plugin:changed` — a `setInterval`-backed
  poll that fires its first pass immediately when the window is created, racing the renderer's own
  boot (Angular bootstrapping, `DesktopService.load()` subscribing to the push channel). A plugin
  whose push arrives before that subscription is up is never re-sent (the poll only re-emits on a
  state change), so it stays unknown — and therefore invisible in the bar — for the rest of the
  session, regardless of which conversation later suggests it. Confirmed by reading every existing
  plugin-bar test: each one pre-seeds `pluginStates` via `pushPluginChanged` for all catalog ids
  before opening/sending, which masks exactly this race. Fixed by adding a constructor `effect` in
  `PluginBar` (mirroring the existing autofocus/theme effect pattern used elsewhere in the shell)
  that pulls a suggested plugin's state directly through the already-existing `getPluginState()`
  the moment it's missing from `pluginStates` — done at 349929e; typecheck clean, 83/83
  main-process tests, 78/78 renderer tests green (added a regression test that suggests a plugin
  with no prior push at all, asserting the fallback fetch fires and the chip renders).
- bug fix (post-delivery): user pasted a CI failure log — `test:packaged` failing on
  `expect(window.locator('ot-titlebar')).toContainText('OpenTimbre')`. Root cause: `bb6d857`
  ("legacy chrome replaces the tab strip", part of this same UI legacy-parity work) redesigned
  `ot-titlebar` to a bare drag strip with no text and removed the tab strip entirely, matching the
  legacy screenshots — but nobody updated the packaged smoke test's oracle, since `test:packaged`
  only runs against real Windows build artifacts in the release workflow, so this was its first
  run against that design. Confirmed via `git log`/`git show` (titlebar originally rendered
  `i18n.t('shell.appName')`, now renders only an icon button) and a repo-wide grep for `role="tab"`
  (zero matches) that BOTH the `ot-titlebar` text assertion and the next `getByRole('tab', {name:
  'Chat'})` assertion were stale, not just the one that happened to fail first. Replaced both with
  locale-independent, selector-based checks: window title (static in `index.html`, proves the
  `app://` protocol served the real renderer) and `ot-chat-pane` visible (proves the shell painted
  its default pane) — done at 56b14e6. Could not run `test:packaged` itself in this sandbox
  (`electron-builder`'s native-module rebuild needs Python, which isn't installed here — an
  environment limitation, not fixed); verified the renderer-side half of the fix with a throwaway
  Playwright check (not committed) against the real built bundle: title is "OpenTimbre",
  `ot-app-shell`/`ot-chat-pane` visible, `ot-titlebar` has zero text, zero `role="tab"` elements —
  confirming the new oracle holds and the old one really was stale. Flagged to the user: this fix
  is unverified against the real packaged Electron runtime and should be confirmed by the next CI
  run of `test:packaged`.
- bug fix (post-delivery): user shared a screenshot of the native window controls area — the
  divider line under the titlebar visibly stops before reaching the right edge instead of running
  the full width. Root cause: `titleBarStyle: 'hidden'` + `titleBarOverlay` (`window.ts`) composites
  the native minimize/maximize/close buttons as an opaque OS-drawn region on top of the page, sized
  to `ot-titlebar`'s own 40px height — a CSS `border-bottom` at that boundary falls inside the
  overlay's rectangle wherever the caption buttons sit, so the OS paints over it; there is no API to
  give the native overlay a matching border, so the line can only ever render left of the buttons.
  Checked the legacy reference (`legacy/desktop/renderer/styles.css`): grepped for `border-bottom`
  repo-wide in that file — zero matches, neither `.titlebar` nor `.statusbar` ever drew this line, so
  it wasn't something legacy parity required; it was added during the Angular rebuild and only
  became visibly broken once the frameless/overlay window landed (`8bc1b61`). Removed the
  border-bottom from `ot-titlebar` — done at 2ec9ae0; typecheck clean, 78/78 renderer tests green;
  verified with a throwaway Playwright check (not committed) against the real built bundle that
  `ot-titlebar` now computes `borderBottomWidth: 0px`.

## History

- 2026-08-03 — state initialized (pelizzai-router / pelizzai-starting-branch / pelizzai-audit)
- 2026-08-03 bootstrap-harness — delivered — harness + 8 domain skills, local → data/history/2026-08-03-bootstrap-harness.md
- 2026-08-06 rebuild-phase1-foundation — done — local delivery accepted; 125 tests passed → data/history/2026-08-05-rebuild-phase1-foundation.md
- 2026-08-06 rebuild-phase2-plugins — done 2026-08-06 — PR #1 merged into origin/main at 0e1f593 → data/history/2026-08-06-rebuild-phase2-plugins.md
- 2026-08-08 phase3-desktop — done 2026-08-08 — PR #2 merged into origin/main at 49e0dea → data/history/2026-08-08-phase3-desktop.md
- 2026-08-08 phase4-packaging — done 2026-08-09 — observed: origin/main contains validated-head 1ebccaf (PR #5 at eb8242c); follow-up PR #6 merged at c687657 → data/history/2026-08-08-phase4-packaging.md
- 2026-08-09 ui-legacy-parity — delivered — legacy UI parity, 10 tasks, split review → data/history/2026-08-09-ui-legacy-parity.md

_Last updated: 2026-08-09_