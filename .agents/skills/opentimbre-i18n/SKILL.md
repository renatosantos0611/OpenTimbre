---
name: opentimbre-i18n
description: How English and Portuguese strings flow through OpenTimbre — a framework-agnostic message catalog in core, shared by the CLI, the Electron main process, and the Angular renderer, with one locale setting persisted across all three surfaces. Use whenever you write any user-facing text (a message, an error, a button label, a CLI output line, a plugin doc string), add a new string, touch locale detection or the locale setting, or work in `en.json`/`pt.json`. Also use when reviewing a diff for a hardcoded literal string shown to a user. NEVER hardcode user-facing text in a component, CLI output, or main-process message — resolve it through the message catalog.
---

# OpenTimbre — i18n

## Why this isn't Angular's built-in i18n

Angular's `$localize`/build-time i18n only covers the renderer. This app has three surfaces —
window, REPL, probe — and only one of them is Angular. A message catalog that only the renderer
can read means the CLI either duplicates strings or stays untranslated; either way, the "one shared
setting" decision from the design breaks.

So the catalog lives in `core`, framework-agnostic, and every surface — CLI, Electron main, Angular
renderer — calls the same resolver.

## The catalog

```text
packages/core/i18n/
├── en.json
├── pt.json
└── index.ts        exports resolveLocale() and t(key, params?)
```

`t(key, params?)` looks up `key` in the active locale's JSON, falls back to `en.json` on a missing
key (never to the raw key string — a missing translation is a bug to fix, not a display value), and
interpolates `params` into `{placeholders}`.

```ts
t('plugin.notMapped', { amp: 'RUST' })
// en.json: "plugin.notMapped": "the {amp} amp isn't mapped yet — applying to {fallback}"
// pt.json: "plugin.notMapped": "o amp {amp} ainda não tem knobs mapeados — aplicando em {fallback}"
```

## Locale is one setting, not per-surface

Ratified in design: a single locale value lives in the same config store that already holds theme
and window preferences, read by whichever surface starts. First run detects the OS locale as the
**default guess only** — it is never silently re-detected on every launch, or the user's override
in Settings would get clobbered the next time they open the app on a machine with a different OS
language.

```text
resolveLocale():
  1. explicit user setting in config-store, if present  → use it
  2. OS locale (Electron: app.getLocale(); CLI: Intl.DateTimeFormat().resolvedOptions().locale)
  3. neither resolves to 'en' or 'pt'                    → 'en'
```

Step 1 is the only one that persists. Steps 2–3 run once, at first launch, to seed the setting —
they do not run on every startup.

## Where a string is allowed to live outside the catalog

Nowhere, with one narrow exception: a value that is never shown to a user (an internal log line
gated behind a debug flag, a code comment). If a human reads it on screen — a button, an error
dialog, a REPL line, a plugin card, a CLI `--help` output — it is a catalog key.

The plugin docs in `prompts/` (the tone knowledge injected into the AI system prompt) are content,
not UI chrome, and follow their own split: `prompts/plugins/<id>.en.md` /
`prompts/plugins/<id>.pt.md`. The system prompt loader picks the file matching the active locale.
This is a second, deliberately separate mechanism from the JSON catalog — prompt documents are
long-form domain writing, not short interpolated strings, and forcing them through `t()` would make
them unreadable to edit.

## Angular renderer

Wrap `t()` in a small injectable (`I18nService`) that exposes it as a function reading a `signal`
for the active locale, so a locale change re-renders without a page reload:

```ts
readonly locale = signal(resolveLocale())
t(key: string, params?: Record<string, string>) {
  return translate(this.locale(), key, params)
}
```

Call it from templates as `{{ i18n.t('settings.title') }}`. Do not reach for Angular's
`$localize` alongside this — one locale mechanism per app, or the two will drift.

## Adding a string

```text
1. Add the key to en.json AND pt.json in the same commit — one without the other is a review flag.
2. Use a dotted namespace matching the feature (`settings.apiKey.hint`, `plugin.ampFallback`).
3. Never concatenate translated fragments to build a sentence — word order differs between
   English and Portuguese. Interpolate a whole templated string instead.
4. If the string needs a plural form, decide the pluralization rule explicitly per locale
   (English: singular/plural; Portuguese: same two-way split, but do not assume every future
   locale added shares that shape) — do not bolt on a plural suffix by string concatenation.
```

## Review checklist

1. Is there a literal user-facing string anywhere outside `t(...)` or the `prompts/*.{en,pt}.md`
   split?
2. Does every new key exist in both `en.json` and `pt.json`?
3. Does the CLI, the main process, and the renderer all resolve locale through the same
   `resolveLocale()` — not three separate implementations?
4. Does anything re-detect the OS locale after the user has set an explicit override?

## Related

`opentimbre-angular-ui` (the `I18nService` signal wrapper), `opentimbre-code-style` (this skill is
where the language question that skill left `<pending ratification>` gets its answer — both locale
files exist; there is no longer a single "the" language to ratify).
