---
name: opentimbre-testing
description: How OpenTimbre proves behavior without hardware — catalog-walking invariant tests, fixture-based behavior tests, and rules separated from I/O so nothing needs loopMIDI, an open plugin, or an API key. Use whenever you write or change a test, add a plugin or provider that the suite should cover, decide what to assert, find a rule that seems untestable, or review a diff that adds logic without tests. Also use when a test needs a real device, a network call, or a live model to pass. NEVER write a test that requires MIDI hardware, a running plugin, or a real API key.
---

# OpenTimbre — testing

## The design rule that makes tests cheap

**Separate the rule from the I/O that executes it.** The module that decides which CC gets which
value returns a list; a different module writes that list to the port. That single split is what
lets scene translation be tested with no loopMIDI, no plugin open, and no operating-system
dependency.

The diagnostic, from the legacy doctrine: *if the only way to test a rule is with hardware, a
network, or an API key, the rule is glued to the wrong place.* Do not reach for a mocking framework
to work around it — move the rule.

## Two kinds of test, two kinds of input

| Kind | Input | Why |
| --- | --- | --- |
| **Invariant** | the **real catalog** | A new plugin inherits the whole suite without anyone writing a test for it. |
| **Behavior** | a **fake `PluginSpec`** | A probe session that corrects a real CC must not break behavior tests. |

Getting this backwards is the common mistake. Behavior tests over the real catalog turn every
hardware discovery into a red suite; invariant tests over a fixture protect nothing.

Invariant tests never name Gojira, Soldano, or Tim Henson — they walk the catalog.

## Every invariant maps to a failure that already happened

Do not invent invariants. Each one exists because the project got burned:

- two parameters on the same CC — the second silently overwrites the first
- a group pointing at a knob that was renamed
- an installed mapping missing CCs the spec already required

A test that protects against nothing real is maintenance with no return. When you add an invariant,
you should be able to name the incident.

## Failure messages state the consequence

Not the expected value — the consequence:

```text
good: "two parameters on the same CC — the second overwrites the first silently"
bad:  "expected 21 to equal 22"
```

The person reading the failure is usually not the person who wrote the test. A consequence tells
them whether it matters; a value comparison makes them go read the code.

## What is faked, and what is not

| Thing | In tests |
| --- | --- |
| MIDI port | a `Send` function that records calls |
| Vault / keychain | absent (`null`) or a trivial in-memory implementation |
| Key store | SQLite `:memory:` |
| Platform module | a fake reporting a chosen OS |
| Model provider | a recorded tool-use exchange, never a live call |
| Plugin process detection | a fake answering installed / running |

Never fake the domain modules themselves. If a test needs to fake a rule to pass, the rule is in
the wrong module.

## Renderer tests

The Angular renderer is tested with Vitest (the v22 default) against **fake services**, never
against a fake Electron. Because components hold no domain rules and never touch `window.api`
directly (see `opentimbre-angular-ui`), the fake is a small object with signals.

## Manual proof that cannot be automated

Some things need a human, a real port, and a real plugin. Name them explicitly as manual steps
rather than pretending an automated test covers them:

- a CC actually moving the intended knob (a probe session, plugin open)
- the MIDI mapping loading in the plugin's own settings UI
- audio actually changing

Record probe findings in the capabilities document, including what turned out **not** to be
controllable — a negative result is the expensive one to rediscover.

## Before closing a task

Run the project's typecheck and test commands (see `pelizzai/profile.md` for the exact commands
once the project has them). A change to the window needs the app launched; a change to a plugin or
a CC needs a probe run with the plugin open.

## Related

`opentimbre-plugin-spec` (why the catalog is the invariant input), `opentimbre-core-boundary` (the
boundary that keeps tests Electron-free), `opentimbre-cross-platform` (platform code is faked).
