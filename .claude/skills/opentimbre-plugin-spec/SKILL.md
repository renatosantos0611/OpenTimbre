---
name: opentimbre-plugin-spec
description: Governs how amp/plugin knowledge enters OpenTimbre — every CC number, amp name, parameter range, and app path lives in a PluginSpec descriptor, never in code. Use whenever you add or edit a Neural DSP plugin (Gojira, Soldano, Tim Henson, or a new one), touch a MIDI CC number, change how a scene becomes CC messages, build the AI tool schema or system prompt for a plugin, or find yourself writing a conditional on a plugin id. Also use when a probe session discovers new parameter mappings. NEVER hardcode a CC number and NEVER branch on a plugin name outside the catalog.
---

# OpenTimbre — a plugin is data, not code

## The rule

**No CC number, amp name, or parameter range exists outside a `PluginSpec`.** The zod schema, the
MIDI send, and the plugin reference injected into the system prompt are all *derived* from the spec.
No module imports a specific plugin — only the catalog does.

The payoff, stated by the legacy doctrine: adding an Archetype is filling in a descriptor and one
line in the catalog, and touching nothing else.

The tell that something went wrong: **an `if` with a plugin's name inside it.** That means knowledge
that belongs in the descriptor leaked into a module.

## The descriptor

`PluginSpec` carries everything three consumers need — the schema builder, the MIDI planner, and
the launcher. Keep the shape:

```text
id, nome, quando, cadeia, doc      identity + how the model chooses this plugin
amps, ampDesc                      the amp list and one line each
ampSelect { cc, valores }          which CC selects the amp, and the value per amp
ampCore                            the controls that define an amp as "mapped"
ampParams + ampCC                  parameters whose CC depends on the active amp
params                             fixed-CC parameters (pedals, cab, delay, reverb)
grupos                             toggle → the knobs it governs
sempreLigado                       section bypasses, always sent at 127 before the scene
app { candidatos, processo, settings, pastaMidi, mapeamento }
```

Two details that look like accidents and are not:

- **`ampCC` absence means "this amp lacks this control."** The CLN amp genuinely has no Presence or
  Depth. Absence is data, not a gap to fill with a default.
- **`pastaMidi` differs per plugin** — Gojira uses `MIDI Mappings`, Soldano uses `MIDI`. Never
  derive that folder from a pattern.

## Scales

The model works in **0–10**; the plugin speaks **0–127**. One conversion point:

```ts
knobToMidi(v) = clamp(round(v * 12.7), 0, 127)
toggleToMidi(on) = on ? 127 : 0
```

Never send a raw 0–127 value from a model response, and never introduce a second conversion
formula. EQ bands use `off: 5` (flat), not 0 — sending 0 would be −12 dB across the board.

## Make errors impossible instead of handling them

Before writing a `try`, ask whether the situation can stop being an error:

- A toggle the model omitted resolves to `false` and is sent as 0. There is no such thing as a
  scene with an undefined effect — and this also protects against a preset that arrived with the
  effect already on.
- An amp with no mapped knobs does not throw: `resolveAmp` falls back to the first amp that *is*
  mapped and returns a warning for the UI. Switching the amp and then moving another amp's knobs is
  inaudible and confusing — worse than a fallback.
- A missing MIDI port does not stop the window from opening. An unreadable config does not stop the
  app from booting. The guitarist keeps seeing the screen.

What genuinely cannot become a non-error must **fail early and name the way out**: list the ports
found, list the accepted strategy values, list the known plugins.

## Amp-selector strategies

The selector is not uniform across plugins, so it is a strategy chosen by configuration, not an
assumption:

| Strategy | Behavior |
| --- | --- |
| `continuous` | one CC value per amp position (Gojira: CLN=0, RUST=64, HOT=127 — centers of their ranges) |
| `increment` | each pulse advances one position; keeps internal state and needs `reset()` if the user turns the knob by hand |
| `manual` | returns a text instruction; the human selects the amp |

Default is `manual` — the safe answer until a probe session proves otherwise.

## Decision and plumbing live in different files

The module that decides *which CC gets which value* returns a list. A different module writes that
list to the port. This is what makes scene translation testable with no loopMIDI, no plugin open,
and no Windows.

If the only way to test a rule is with hardware, a network, or an API key, the rule is in the wrong
place.

## Adding a plugin

```text
1. Probe the plugin (a probe run, plugin open) to learn its real CC map.
2. Record the findings in the capabilities document — including what is NOT controllable.
3. Write the descriptor. No code changes outside it.
4. Register one line in the catalog.
5. Add the MIDI-mapping XML the app installs into the plugin's settings folder.
6. Run the catalog invariant tests — the new plugin inherits the whole suite for free.
```

## Related

`opentimbre-testing` (catalog-walking invariants vs fixture behavior tests),
`opentimbre-cross-platform` (the `app` block's paths and process names differ per OS),
`opentimbre-core-boundary` (the spec and the planner are core; the port write is not).
