---
name: opentimbre-code-style
description: The OpenTimbre house style — deep modules with small interfaces, file-owner header comments, comments that explain why, kebab-case filenames, and a justification bar for every new dependency. Use whenever you create a file, name a module or function, write a comment, design a function signature, consider adding a package, or review a diff for readability. Also use when a module's interface is growing, when you are about to write a comment that restates the next line, or when a change would make a caller learn something it did not need to know before. NEVER add a dependency without stating what it buys that the platform does not.
---

# OpenTimbre — house style

The reference is *A Philosophy of Software Design* (Ousterhout), applied rather than summarized.

The quick test for whether a change is in the project's spirit: **will the next person need to know
fewer things than today, or more?**

## 1. Deep modules: small interface, a lot hidden

A module's value is what it **saves** its callers. A large interface over a thin body costs more to
learn than it saves.

The legacy example: the tool-use protocol exposes six methods, none of which knows what a rig is.
Hidden inside are the two attempts, the trace, zod issue formatting, and the history rollback.
Before that module existed, each provider reimplemented the protocol — and that is exactly how the
rollback ended up implemented in the conversation path and missing from the other two.

**In practice:** write the caller's code first. If a call takes more than three or four parameters
and the caller must understand what each does internally, the split is wrong.

## 2. Complexity goes down, not up

Between the module suffering and the caller suffering, the module suffers. It is written once and
used many times.

The MIDI transport opens ports by index because that is how the underlying library works, and scans
names to find the right port. None of that appears outside: the rest of the app sees `connect()`.

**In practice:** ugly inside a module is acceptable; ugly leaking to five callers is not.

## 3. Make errors hard, do not handle them

Before writing a `try`, ask whether the situation can simply stop being an error. See
`opentimbre-plugin-spec` for the worked examples (omitted toggles, unmapped amps, absent MIDI
port). What genuinely cannot become a non-error must fail **early and name the way out** — list the
ports found, the accepted values, the known plugins.

## 4. Comments say what the code cannot

The code already says *what*. A comment exists for what is lost: why this choice and not the
obvious one, what was tried and failed, which external constraint forced it.

```ts
// Good — information absent from the code:
// `strict: false` because the zod-derived schema has optional fields, and the
// provider's strict mode requires every field to be required.

// Bad — restates the next line:
// convert the knob to MIDI
const value = knobToMidi(v)
```

**Every file opens with a block saying what it owns.** When a decision is revised, the comment
records the previous version and why it changed — that is what stops the next person from
"fixing" it back.

**In practice:** if the comment can be deduced by reading the following line, delete it. If it
records a bug that actually happened, it is worth more than the code.

## 5. Naming and files

- **Files in kebab-case**, always, including `.md`: `rig-builder.ts`, `tool-use.ts`,
  `system-rig.md`. Single exception: `CLAUDE.md`.
- Inside code, standard TypeScript: `camelCase` for variables and functions, `PascalCase` for types
  and schemas.
- Test files sit next to the file they test.
- Established technical terms stay in English, and a technical operation keeps its English pair:
  `sendCC` / `openPort`, `planScene` / `applyScene`.

### Language of comments and user-facing text

**Ratified: the app ships both English and Portuguese**, via the message catalog described in
`opentimbre-i18n` — there is no longer a single "the" UI language. That skill governs every
user-facing string.

This section governs what `opentimbre-i18n` does not: **code comments and identifiers stay in
English**, project-wide, regardless of which locale a string displays in. The legacy's Portuguese
domain vocabulary in code (`cena`, `catalogo`, `sempreLigado`) does not carry over to identifiers —
it lives on as the *content* of `pt.json` keys, not as variable or function names. Naming rule §5
above (kebab-case files, camelCase/PascalCase code) already assumes English; this just makes it
explicit now that the UI itself is bilingual.

## 6. A new dependency must justify itself

Check whether the platform already solves it. The packages that exist are there for reasons that
are not taste:

- the MIDI binding ships prebuilt binaries — alternatives require a native toolchain on the user's
  machine
- the OpenAI integration uses the Responses API because reasoning models refuse function tools on
  chat completions

**In practice:** before installing, state in one line what the package buys that the platform does
not. If you cannot, you do not need it.

## Related

`opentimbre-core-boundary`, `opentimbre-plugin-spec`, `opentimbre-testing` — the structural rules
this style serves.
