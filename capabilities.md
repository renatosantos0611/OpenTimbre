# Phase 2 capabilities

This document records what Phase 2 proves from repository data and what remains unverified.
The user explicitly waived the real-plugin visual probes for this phase on 2026-08-06. No
selector result below is presented as hardware evidence.

## Environment

| Item | Result |
|---|---|
| Host OS | Windows |
| Date | 2026-08-06 |
| MIDI transport | Startup connection check succeeded; no plugin mapping or response was observed |
| MIDI port name | Not collected in this execution |
| Plugin versions | Not collected in this execution |
| macOS verification | Not performed |

## Export-confirmed mappings

The catalog invariant suite confirms that every CC emitted by each spec is present in the
corresponding root mapping XML. Routing counts are copied from the shipped files:

| Plugin | Mapping | Routings | Amp selector CC |
|---|---|---:|---:|
| Archetype Gojira | `midi-mapping/gojira-neural-ai.xml` | 118 | 20 |
| Soldano SLO-100 X | `midi-mapping/soldano-neural-ai.xml` | 84 | 20 |
| Archetype Tim Henson X | `midi-mapping/tim-henson-neural-ai.xml` | 79 | 20 |
| Archetype Petrucci X | `midi-mapping/petrucci-neural-ai.xml` | 91 | 20 |

These are export and catalog-integrity results, not claims that the plugin responded to every
mapping. Non-selector CCs were not response-probed in Phase 2.

## Amp selectors

The values below are the expected values encoded in each `PluginSpec`. The observed result is
intentionally recorded as not collected because the visual probe was waived. This preserves the
uncertainty instead of upgrading the descriptor hypothesis to hardware evidence.

### Soldano SLO-100 X

| CC 20 value | Expected amp | Observed amp | Result |
|---:|---|---|---|
| 0 | NORMAL | Not collected | Unverified |
| 127 | OVERDRIVE | Not collected | Unverified |

### Archetype Tim Henson X

| CC 20 value | Expected amp | Observed amp | Result |
|---:|---|---|---|
| 0 | ROSES | Not collected | Unverified |
| 64 | CHERUBS | Not collected | Unverified |
| 127 | PINK | Not collected | Unverified |

### Archetype Petrucci X

| CC 20 value | Expected amp | Observed amp | Result |
|---:|---|---|---|
| 0 | PIEZO | Not collected | Unverified |
| 42 | CLEAN | Not collected | Unverified |
| 85 | RHYTHM | Not collected | Unverified |
| 127 | LEAD | Not collected | Unverified |

## Scope boundary

- The automated workspace gate passed with 202 tests and zero failures on 2026-08-06.
- Prompt, schema, catalog, MIDI-range, and XML-completeness checks passed for all four catalog
  entries.
- The nine selector positions above remain unverified on real plugin installations.
- No conclusion is made about controls omitted from the AI schema or about macOS behavior.
