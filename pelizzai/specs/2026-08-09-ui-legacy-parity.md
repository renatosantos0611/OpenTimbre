# UI legacy parity — Specification

**Status:** approved on 2026-08-09
**Task:** `ui-legacy-parity` · lane `exploratory` · branch `spec/ui-legacy-parity`
**Reference implementation:** `legacy/desktop/renderer/{index.html,app.ts,styles.css}` and
`legacy/src/janela.ts`

---

## 1. Problem

The Angular rebuild in `packages/desktop` diverged from the legacy Electron app the user actually
uses. Three symptoms were reported: screens feel frozen and panes do not switch, Settings appears
to have no AI API-key input, and the window competes with whatever app has focus.

Reproduction on `spec/ui-legacy-parity` at base `c687657` established the facts below. They are
observations, not assumptions.

### 1.1 The app does not start

`npm run desktop` builds main, preload, and renderer successfully, then dies before a window is
created:

```
file:///.../packages/desktop/dist/main/main.js:34616
import { BrowserWindow, session } from "electron";
         ^^^^^^^^^^^^^
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
```

`build:main` emits ESM (`esbuild --format=esm --external:electron`) and `packages/desktop/package.json`
declares `"type": "module"`, so Node loads the bundle as ESM and cannot resolve named exports from
Electron's CommonJS `electron` module. Electron 43.3.0 is the installed version.

This is the root of "screens are frozen": there is no running renderer to freeze. The pane-switching
logic itself is sound — `app-shell.spec.ts` proves it, and the renderer suite is green
(53 tests, 6 files).

### 1.2 First launch has no locale

`DEFAULTS` in `packages/desktop/src/main/storage/desktop-store.ts` has no `locale` key, and `get()`
returns `''` when a key has neither a stored value nor a default. `getLocale()` therefore hands
`'' as Locale` to the app state, and the catalog falls back to English while the legacy app is
Portuguese.

### 1.3 Window behavior default is inverted

| Setting | legacy (`legacy/src/janela.ts`) | rebuild (`desktop-store.ts`) |
| --- | --- | --- |
| always on top | `sempreNoTopo: true` | `always_on_top: true` ✔ |
| dim when unfocused | `escurecerSemFoco: true` | `dim_on_unfocus: false` ✘ |
| unfocused opacity | `0.72` | `0.72` ✔ |

The dimming mechanism is fully implemented (`app-shell.ts` `dimmed` computed + `[data-dimmed]`).
Only the default is inverted, so the window stays fully opaque on top of the plugin.

### 1.4 The chrome is a different app

The rebuild renders a brand + pin title bar and a three-button text tab strip. The legacy renders a
hamburger-only title bar, a status bar carrying the MIDI state and three icon actions, and
secondary panes with their own back-and-title header. The AI key inputs do exist
(`packages/desktop/src/app/shell/panes/ai-settings.ts`), but inside a flat Settings pane that looks
nothing like the legacy grouped sections.

---

## 2. Ratified decisions

| # | Decision | Ratified |
| --- | --- | --- |
| D1 | **Full parity** with the legacy chrome: hamburger menu, status-bar icon actions, About screen, empty-state suggestion chips, composer model picker and Manual/Auto mode. The text tab strip is removed. | discovery interview, 2026-08-09 |
| D2 | The boot crash is **Task 1 of this plan**, same branch and same PR — not a separate quick fix. | discovery interview, 2026-08-09 |
| D3 | The model picker lists **real models fetched from the providers** (new IPC capability), not a static catalog. | discovery interview, 2026-08-09 |
| D4 | First launch follows the **OS language** (pt-BR → `pt`, otherwise `en`); the en/pt selector stays and the choice persists. | discovery interview, 2026-08-09 |

Derived mechanically from D1, not a separate decision: `dim_on_unfocus` defaults to `true`, matching
`escurecerSemFoco` in the legacy.

---

## 3. Target surface

The legacy is the design. This inventory fixes what "parity" means so execution never has to guess.

### 3.1 Title bar

One hamburger button only (`aria-label` "Menu da aplicação", `aria-expanded`). No app name, no
version, no pin — the legacy comment at `index.html:85-88` states the identity lives in the taskbar
icon and the About dialog. The bar stays the window drag region.

Clicking it opens a floating menu with two items: **Configurações** (gear icon) and **Sobre** (info
icon). The menu closes on outside click; the opening click must stop propagation so it does not
close itself.

### 3.2 Status bar

Left: a MIDI status dot plus label (`stat-midi` / `dot-midi` / `txt-midi`) and an optional amp pill
(`stat-amp`, hidden when empty). Right, after a spacer: three icon buttons — **Conversas anteriores**
(history), **Nova conversa** (plus), **Configurações** (gear).

### 3.3 Panes

`chat` is the primary pane. `historico`, `config`, and `sobre` are secondary panes; each opens with a
`sec-topo` header carrying a back button (`aria-label` "Voltar para a conversa") and an `h2` title.
Panes stay mounted so chat draft and scroll survive a switch — the current behavior in
`app-shell.ts` is kept; only the navigation affordance changes.

### 3.4 Chat empty state

Icon (faders), `h1` "Monte seu timbre", paragraph "Descreva o som que você quer e o OpenTimbre
calcula os parâmetros do plugin.", then a row of suggestion chips. The plugin bar above the stream is
already implemented and stays.

### 3.5 Composer

Two rows inside `composer-inner`:

1. `textarea`, placeholder `Descreva o timbre, ou peça um ajuste — "menos grave no riff"`.
2. An actions row: model button (left, `margin-right: auto`), mode button, send button.

Below, a hint line: `Enter envia · Shift+Enter quebra linha` plus a destination hint on the right.

**Model button** — label + chevron, opens a panel **upward, anchored left**, containing a search
field ("Buscar modelo") and the list. With both provider keys valid the list mixes both catalogs and
groups by cost tier. OpenAI ids are prettified (`gpt-5.6-sol` → `GPT-5.6 Sol`); Anthropic ids are
already display names and pass through unchanged.

**Mode button** — icon + label + chevron, opens a panel upward with two options, each showing a bold
name and an explanatory line:

- **Manual** — "Você escolhe quando aplicar, clicando no cartão de cada timbre."
- **Auto** — "Aplica sozinho quando a IA responde com um timbre só. Duas ou mais sugestões continuam manuais."

This is a surface over the existing `autoApply` setting. No new domain capability.

### 3.6 Settings

Four groups, in this order, each an `h3` with an optional explanatory `sub` paragraph:

1. **Sua guitarra** — model text field, pickups select, strings select (6/7/8), tuning text field, a
   Save button and a note line.
2. **Inteligência artificial** — provider select (Automático / Anthropic — Claude / OpenAI — GPT),
   then the key rows, then a note line.
3. **Aparência** — segmented Sistema / Claro / Escuro.
4. **Janela** — "Sempre por cima" and "Escurecer sem foco" checkboxes, each with an explanatory line.

Key rows keep the current `KeyInfo` contract — a hint and flags, never a plaintext key — and render
per provider with the legacy badges: **SEM CHAVE** when no key exists, **DO .ENV** when the key comes
from the environment, and the last-characters hint when stored by the app.

### 3.7 About

Icon, `h1` "OpenTimbre *para Windows*", the version line, and the tagline "Timbres de guitarra em
linguagem natural, aplicados por MIDI CC nos plugins da Neural DSP."

---

## 4. Constraints

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

## 5. Out of scope

- macOS build and packaging.
- Any change to scene planning, MIDI CC translation, or the plugin catalog.
- Conversation persistence and history semantics beyond rendering the existing list in the new pane.
- Redesign of anything the legacy does not have.

## 6. Acceptance

1. `npm run desktop` opens a window on Windows; no unhandled error in the main process.
2. The chrome matches §3.1–§3.3: hamburger menu with two items, status bar with three icon actions,
   no text tab strip, secondary panes with back-and-title headers.
3. About, empty state with chips, composer actions row with a working model picker and Manual/Auto
   menu, and the four Settings groups all render as specified.
4. A fresh profile on a pt-BR Windows opens in Portuguese; on any other OS language, in English. The
   selector still switches and the choice survives a restart.
5. A fresh profile starts with the window always on top **and** dimming to 0.72 opacity when another
   window takes focus.
6. Settings shows a key row per provider with the correct badge, and saving a key clears the input
   without ever displaying the key.
7. `npm run check` is green, and the packaged smoke test passes.
