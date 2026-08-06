# OpenTimbre rebuild — Phase 2: plugin catalog parity — Implementation plan

> **For the executor:** MANDATORY SUB-SKILL — use `pelizzai-execution-plans`.

**Goal:** Complete core catalog parity with the legacy repository by adding Soldano SLO-100 X,
Archetype Tim Henson X, and Archetype Petrucci X beside the existing Archetype Gojira, including
their bilingual prompt documents and installable MIDI-mapping XML files, then prove each amp
selector on the real Windows plugin.

**Architecture:** Plugin knowledge remains data in one `PluginSpec` per plugin. The catalog is the
only module that imports descriptors; schema generation, prompt assembly, scene planning, and the
probe continue to consume the catalog generically. Catalog-walking invariants compare every CC the
spec can emit with the XML shipped at the repository root. Long-form prompt content is paired as
English and Portuguese Markdown. Hardware evidence is recorded in root `capabilities.md`.

**Tech stack:** Node >=22.12, TypeScript 5.9, npm workspaces, `node:test`, zod, and the existing
`@julusian/midi` 3.8 probe path. No dependency is added by this phase.

**Applicable domain skills:** opentimbre-plugin-spec, opentimbre-testing,
opentimbre-code-style, opentimbre-i18n, opentimbre-cross-platform.

**Cross-cutting harness skills:** pelizzai-tdd for Tasks 1-4,
pelizzai-documenting-features for Task 5, pelizzai-review after every task, and
pelizzai-verification-before-completion before the phase seal.

**Approvals** (a marker without an explicit user answer stays `pending`):

- Discovery: ratified on 2026-08-03
- Spec: approved on 2026-08-03; Petrucci scope amendment ratified on 2026-08-06
- Domain skills: existing catalog covers every Phase 2 surface; no new domain skill proposed
- Plan: approved on 2026-08-06

---

## Scope and constraints

- Add exactly the three missing legacy plugins: `soldano`, `tim-henson`, and `petrucci`.
- Preserve Gojira as the first/default catalog entry.
- Transcribe CCs, amp names, option values, groups, bypasses, Windows app metadata, XML, and tone
  guidance from the nested legacy repository. Read committed legacy root files with
  `git -C legacy show HEAD:<path>`; never stage `legacy/`.
- Translate structural identifiers to the current English `PluginSpec` shape. Do not rename the
  plugin's own amp keys or AI-facing parameter identifiers.
- Port each legacy Portuguese prompt to `*.pt.md` and provide its English counterpart in
  `*.en.md`; `PluginSpec.doc` retains the locale-neutral `<id>.md` base consumed by
  `loadSystemPrompt()`.
- Keep confirmed Windows candidates. Leave `candidates.darwin` absent: no macOS plugin path,
  process behavior, or settings location has been confirmed, and this phase must not invent one.
- Complete the catalog invariant suite from legacy, including the deferred XML-completeness check,
  with Node built-ins and the two XML attribute forms already present (`data1="N"` and `cc="N"`);
  do not add an XML dependency.
- Phase completion normally requires `amptest` on real Windows installations of all three plugins.
  For this execution, the user's explicit 2026-08-06 waiver accepts the selector boundary as
  unverified. All other CCs remain described honestly as export-confirmed, not response-probed.
- `packages/cli` is validation-only. Do not change REPL plugin selection, probe copy, or CLI i18n
  in this phase.
- Do not change Electron/IPC, secrets, packaging, or Angular code.

## Source inventory

| Plugin | Descriptor | Mapping | Prompt | Amp selector | XML routings |
|---|---|---|---|---|---:|
| Gojira | existing `packages/core/src/plugins/gojira.ts` | `legacy/midi-mapping/gojira-neural-ai.xml` | existing EN/PT pair | CLN=0, RUST=64, HOT=127 | 118 |
| Soldano | `legacy/src/plugins/soldano.ts` | `legacy/midi-mapping/soldano-neural-ai.xml` | `legacy/prompts/plugins/soldano.md` | NORMAL=0, OVERDRIVE=127 | 84 |
| Tim Henson | `legacy/src/plugins/tim-henson.ts` | `legacy/midi-mapping/tim-henson-neural-ai.xml` | `legacy/prompts/plugins/tim-henson.md` | ROSES=0, CHERUBS=64, PINK=127 | 79 |
| Petrucci | `legacy/src/plugins/petrucci.ts` | `legacy/midi-mapping/petrucci-neural-ai.xml` | `legacy/prompts/plugins/petrucci.md` | PIEZO=0, CLEAN=42, RHYTHM=85, LEAD=127 | 91 |

The routing counts above were measured directly from legacy `HEAD` on 2026-08-06. They are copy
integrity checks, not claims that every mapped routing belongs in the AI schema.

The task sequence is intentionally serial because Tasks 2-4 all modify `catalog.ts`. Do not run
those writers in parallel in one working tree.

## Technical decisions in this plan

1. Petrucci is full Phase 2 scope beside Soldano and Tim Henson — ratified in the 2026-08-06
   kickoff interview — rejected: defer Petrucci as an undocumented fourth plugin — why: the
   legacy catalog exports all four and the user chose full parity.
2. Real Windows probes for all three new plugins block phase completion, but the required manual
   coverage is each complete amp-selector sequence only — ratified in the 2026-08-06 plan
   interview — rejected: probe every mapped CC or accept no hardware proof — why: this proves the
   structurally distinct 2-, 3-, and 4-position selectors while keeping the remaining export-only
   evidence explicit.
3. Probe findings live in root `capabilities.md` — ratified in the 2026-08-06 plan interview —
   rejected: leave them only in PelizzAI history or terminal output — why: plugin maintainers need
   a durable, discoverable technical reference, including negative findings.
4. Mapping XML stays at root `midi-mapping/`, and the catalog suite completes the legacy
  invariants, reading XML with `node:fs` plus the two known CC-attribute patterns — ratified by
  the approved workspace design and Phase 1's explicitly deferred invariant — rejected:
  package-local copies or a new XML parser dependency — why: the files are installable product
  data, and the check needs only the two stable attributes already emitted by Neural DSP.
5. Each prompt ships as an EN/PT pair and no macOS path is inferred — ratified in the approved
   rebuild design and its i18n/cross-platform decisions — rejected: Portuguese-only prompt ports
   or guessed `/Applications` paths — why: both alternatives violate existing project contracts.
6. The user waived the real-plugin visual selector probes on 2026-08-06. The phase records all
  nine selector positions as unverified and does not claim hardware response from automated or
  transport-connection evidence.

## Requirements to tasks

| Requirement | Task(s) |
|---|---|
| Root mapping assets and spec-to-XML completeness | 1-4 |
| Soldano descriptor, prompt pair, mapping, catalog registration | 2 |
| Tim Henson descriptor, prompt pair, mapping, catalog registration | 3 |
| Petrucci descriptor, prompt pair, mapping, catalog registration | 4 |
| Generic schema/prompt integration across all four plugins | 2-5 |
| Real selector proof and durable capabilities record | 5 |
| Whole-repository regression proof | 5 |

## Exposed assumptions and accepted limits

- The three legacy XMLs are export-confirmed, but most controls have never been response-probed.
  The user explicitly accepted selector-only hardware coverage for this phase; `capabilities.md`
  must not upgrade the other controls to hardware-confirmed.
- The current REPL still chooses `CATALOG[0]` (Gojira). That known Phase 1 parity gap is outside
  this core-data phase; the probe already selects any registered plugin through `PLUGIN=<id>`.
- No real macOS plugin installation is available. Empty `darwin` candidates are an honest
  limitation, not a task failure.
- English prompt documents are faithful translations/adaptations of the committed Portuguese
  source. They must preserve technical constraints and omissions; they are not an opportunity to
  add new tone capabilities.
- Manual probe execution can fail because of environment setup (plugin absent, XML not loaded, or
  loopMIDI port absent). Such a failure blocks Task 5 and is recorded; it is not bypassed by green
  unit tests.

---

### Task 1: Restore installable mapping data and complete the catalog safety net

**Result:** Gojira's existing spec is backed by its root mapping asset, and every current/future
catalog entry automatically inherits the complete legacy invariant suite adapted to the rebuild.

**Out of scope:** changing any descriptor or mapping content; adding the three new plugins.

**Files:**

- Create: `midi-mapping/gojira-neural-ai.xml` from
  `legacy/midi-mapping/gojira-neural-ai.xml`
- Modify: `packages/core/src/plugins/catalog-invariants.test.ts`

**Domain skills:** opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style,
opentimbre-i18n

**Cross-cutting harness skills:** pelizzai-tdd, pelizzai-review,
pelizzai-verification-before-completion

**Dependencies:** Phase 1 must be complete. This task creates the root `midi-mapping/` directory
and must finish before any new plugin task.

**Implementation and validation strategy:** TDD red -> green. Use the real catalog, not a fixture.
Retain the existing unique-id, duplicate-CC, group, and `ampCore` checks; port the remaining legacy
checks for a non-empty catalog, MIDI range 0-127, amp descriptions/CC tables/selector values,
selector keys naming real amps, `ampCC` keys naming real `ampParams`, at least one mapped amp,
non-empty select options, and populated Windows app/mapping metadata. Restore the deferred
spec-to-XML check and adapt the legacy prompt check to require both locale files. Strip XML
comments before collecting `data1` and `cc` attributes so prose cannot create false positives.
Failure messages must state the runtime consequence. Review profile: split.

Resolve the workspace-root data from the test file with
`new URL('../../../../midi-mapping/', import.meta.url)` and the package prompt directory with
`new URL('../../prompts/plugins/', import.meta.url)`. For each spec, read `spec.app.mapping`, remove
`/<!--[\s\S]*?-->/g`, collect numeric captures from `/\bdata1="(\d+)"/g` and
`/\scc="(\d+)"/g`, then report every CC from `ccsInSpec(spec)` absent from that set.

- [x] **Step 1: Add the remaining catalog, mapping, and prompt-pair invariants** -> verify: the
  focused test fails because `midi-mapping/gojira-neural-ai.xml` is absent, proving the mapping
  assertion is live; all non-I/O invariants already pass against Gojira.
- [x] **Step 2: Create root `midi-mapping/` and port the Gojira XML without editing its routes**
  -> verify: `if ((Select-String -Path midi-mapping/gojira-neural-ai.xml -Pattern '<routing ').Count -ne 118) { throw 'Gojira mapping must contain 118 routings' }`
  exits 0 and the focused test turns green.
- [x] **Step 3: Run the core proof** -> verify:
  `node --test packages/core/src/plugins/gojira.test.ts packages/core/src/plugins/catalog-invariants.test.ts packages/core/src/providers/rig-schema.test.ts`
  and `npm.cmd run typecheck -w @opentimbre/core` both exit 0.
- [x] **Step 4: Split review, fix/re-review if needed, then consolidate Task 1.**

**Completion criterion:** the real Gojira catalog entry passes XML completeness and prompt-pair
existence; no production TypeScript changed.

---

### Task 2: Add Soldano SLO-100 X as a complete catalog slice

**Result:** Soldano can be selected from `CATALOG`, generates its own schema and bilingual prompt
reference, plans its exported CCs, and ships the XML the plugin can load.

**Out of scope:** hardware probe (Task 5), CLI changes, or corrections not supported by committed
legacy evidence.

**Files:**

- Create: `packages/core/src/plugins/soldano.ts`
- Create: `packages/core/src/plugins/soldano.test.ts`
- Create: `packages/core/prompts/plugins/soldano.en.md`
- Create: `packages/core/prompts/plugins/soldano.pt.md`
- Create: `midi-mapping/soldano-neural-ai.xml`
- Modify: `packages/core/src/plugins/catalog.ts`

**Sources:** `legacy/src/plugins/soldano.ts`, `legacy/prompts/plugins/soldano.md`,
`legacy/midi-mapping/soldano-neural-ai.xml`, and the Soldano section of
`git -C legacy show HEAD:capabilities.md`.

**Domain skills:** opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style,
opentimbre-i18n, opentimbre-cross-platform

**Cross-cutting harness skills:** pelizzai-tdd, pelizzai-review,
pelizzai-verification-before-completion

**Dependencies:** Task 1. This task owns the next serial edit to `catalog.ts`.

**Implementation and validation strategy:** TDD characterization against Soldano-specific facts,
then transcription. Generic behavior remains covered by the catalog-walking invariant and schema
suite. Review profile: split.

- [x] **Step 1: Write `soldano.test.ts` before the descriptor** -> verify: RED is observed because
  the module/facts do not exist. Characterize the two amps and selector values; `ampCore` of
  `gain`/`level`; NORMAL-only `bright` and `mode`; shared tone-stack controls as fixed params; and
  the four always-on sections.
- [x] **Step 2: Transcribe the descriptor into the current English `PluginSpec` shape** -> verify:
  the characterization test turns green. Preserve `id: 'soldano'`, the exact CCs/options/groups,
  `midiFolder: 'MIDI'`, and confirmed Windows metadata. Do not add `darwin` candidates.
- [x] **Step 3: Port the 84-routing XML and the prompt pair** -> verify: the Portuguese document
  preserves the legacy domain guidance, the English document preserves the same constraints, and
  `if ((Select-String -Path midi-mapping/soldano-neural-ai.xml -Pattern '<routing ').Count -ne 84) { throw 'Soldano mapping must contain 84 routings' }`
  exits 0.
- [x] **Step 4: Register `soldanoSpec` after Gojira** -> verify:
  `node --test packages/core/src/plugins/soldano.test.ts packages/core/src/plugins/catalog-invariants.test.ts packages/core/src/providers/rig-schema.test.ts`
  exits 0 and exercises Soldano through the generic suites.
- [x] **Step 5: Run `npm.cmd run typecheck -w @opentimbre/core`; split review; fix/re-review; then
  consolidate Task 2.**

**Completion criterion:** `CATALOG` contains Gojira then Soldano; all Soldano spec CCs are present
in its XML, both prompt locales load, and the core package typechecks.

---

### Task 3: Add Archetype Tim Henson X as a complete catalog slice

**Result:** Tim Henson joins the generic catalog with its three independent amps, Multivoicer
structure, bilingual tone knowledge, and exported XML.

**Out of scope:** hardware probe (Task 5), controls deliberately omitted from the legacy XML due
to its mapping budget, and any new Multivoicer calibration.

**Files:**

- Create: `packages/core/src/plugins/tim-henson.ts`
- Create: `packages/core/src/plugins/tim-henson.test.ts`
- Create: `packages/core/prompts/plugins/tim-henson.en.md`
- Create: `packages/core/prompts/plugins/tim-henson.pt.md`
- Create: `midi-mapping/tim-henson-neural-ai.xml`
- Modify: `packages/core/src/plugins/catalog.ts`

**Sources:** `legacy/src/plugins/tim-henson.ts`, `legacy/prompts/plugins/tim-henson.md`,
`legacy/midi-mapping/tim-henson-neural-ai.xml`, and the Tim Henson section of
`git -C legacy show HEAD:capabilities.md`.

**Domain skills:** opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style,
opentimbre-i18n, opentimbre-cross-platform

**Cross-cutting harness skills:** pelizzai-tdd, pelizzai-review,
pelizzai-verification-before-completion

**Dependencies:** Task 2. Keep the shared catalog edit serial.

**Implementation and validation strategy:** TDD characterization followed by literal
transcription/adaptation. Review profile: split.

- [x] **Step 1: Write `tim-henson.test.ts` before the descriptor** -> verify: RED is observed.
  Characterize ROSES/CHERUBS/PINK at 0/64/127; the five-field `ampCore`; each amp's exclusive
  controls (`blend`, `channel`, `level`); the Multivoicer groups actually present in the legacy
  descriptor; and the five plugin-specific always-on sections.
- [x] **Step 2: Transcribe the descriptor, preserving absences as data** -> verify: the focused
  characterization turns green. Keep `id: 'tim-henson'`, `midiFolder: 'MIDI'`, confirmed Windows
  metadata, and no invented `darwin` candidate.
- [x] **Step 3: Port the 79-routing XML and EN/PT prompt pair** -> verify:
  `if ((Select-String -Path midi-mapping/tim-henson-neural-ai.xml -Pattern '<routing ').Count -ne 79) { throw 'Tim Henson mapping must contain 79 routings' }`
  exits 0 and neither prompt claims omitted controls are available.
- [x] **Step 4: Register `timHensonSpec` after Soldano** -> verify:
  `node --test packages/core/src/plugins/tim-henson.test.ts packages/core/src/plugins/catalog-invariants.test.ts packages/core/src/providers/rig-schema.test.ts`
  exits 0.
- [x] **Step 5: Run `npm.cmd run typecheck -w @opentimbre/core`; split review; fix/re-review; then
  consolidate Task 3.**

**Completion criterion:** the first three catalog entries are Gojira, Soldano, and Tim Henson;
Tim Henson inherits and passes the XML/schema/prompt invariants.

---

### Task 4: Add Archetype Petrucci X as a complete catalog slice

**Result:** Petrucci completes legacy catalog parity, including the first four-position selector
and its structurally distinct PIEZO amp.

**Out of scope:** hardware probe (Task 5), omitted parametric-EQ/cabinet/fine-delay mappings, or
new mode calibration beyond legacy evidence.

**Files:**

- Create: `packages/core/src/plugins/petrucci.ts`
- Create: `packages/core/src/plugins/petrucci.test.ts`
- Create: `packages/core/prompts/plugins/petrucci.en.md`
- Create: `packages/core/prompts/plugins/petrucci.pt.md`
- Create: `midi-mapping/petrucci-neural-ai.xml`
- Modify: `packages/core/src/plugins/catalog.ts`

**Sources:** `legacy/src/plugins/petrucci.ts`, `legacy/prompts/plugins/petrucci.md`,
`legacy/midi-mapping/petrucci-neural-ai.xml`, and the Petrucci section of
`git -C legacy show HEAD:capabilities.md`.

**Domain skills:** opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style,
opentimbre-i18n, opentimbre-cross-platform

**Cross-cutting harness skills:** pelizzai-tdd, pelizzai-review,
pelizzai-verification-before-completion

**Dependencies:** Task 3. Keep the shared catalog edit serial.

**Implementation and validation strategy:** TDD characterization followed by literal
transcription/adaptation. Review profile: split.

- [x] **Step 1: Write `petrucci.test.ts` before the descriptor** -> verify: RED is observed.
  Characterize PIEZO/CLEAN/RHYTHM/LEAD at 0/42/85/127; `ampCore` excluding `gain`; PIEZO lacking
  Gain/Master and owning Body/Air; the amp-specific toggle controls; and all seven always-on
  sections, including Volume.
- [x] **Step 2: Transcribe the descriptor** -> verify: characterization turns green. Preserve
  `id: 'petrucci'`, the exact mode types/options from legacy, `midiFolder: 'MIDI'`, confirmed
  Windows metadata, and no `darwin` candidate.
- [x] **Step 3: Port the 91-routing XML and EN/PT prompt pair** -> verify:
  `if ((Select-String -Path midi-mapping/petrucci-neural-ai.xml -Pattern '<routing ').Count -ne 91) { throw 'Petrucci mapping must contain 91 routings' }`
  exits 0 and every intentional omission remains documented rather than silently filled.
- [x] **Step 4: Register `petrucciSpec` last** -> verify:
  `node --test packages/core/src/plugins/petrucci.test.ts packages/core/src/plugins/catalog-invariants.test.ts packages/core/src/providers/rig-schema.test.ts`
  exits 0.
- [x] **Step 5: Run `npm.cmd run typecheck -w @opentimbre/core`; split review; fix/re-review; then
  consolidate Task 4.**

**Completion criterion:** `CATALOG` is exactly Gojira, Soldano, Tim Henson, Petrucci in that order,
and Petrucci passes all generic and plugin-specific proofs.

---

### Task 5: Prove whole-catalog integration and record the real selector probes

**Result:** all four plugins are observed through generic prompt/schema paths, export-confirmed
mapping data is covered by catalog invariants, and durable capability evidence states exactly what
was and was not hardware-probed. The user-waived selector boundary remains explicitly unverified.

**Out of scope:** probing every non-selector CC, changing a failed mapping without returning to the
owning plugin task, REPL feature work, and macOS verification.

**Files:**

- Create: `packages/core/src/rig-builder.test.ts`
- Create: `capabilities.md`
- Validate only: `packages/cli/src/probe.ts`, all package tests/typechecks

**Domain skills:** opentimbre-plugin-spec, opentimbre-testing, opentimbre-code-style,
opentimbre-i18n, opentimbre-cross-platform

**Cross-cutting harness skills:** pelizzai-tdd, pelizzai-documenting-features,
pelizzai-review, pelizzai-verification-before-completion

**Dependencies:** Tasks 1-4 and access to the three installed Windows plugins. No Task 5 content
may be marked complete from automated evidence alone.

**Implementation and validation strategy:** TDD for catalog/prompt integration; manual scenario
proof for hardware; static/scenario validation for the capabilities document. The document is a
delivery artifact and receives its own `docs(plugins): record Phase 2 capability probes` commit
under the commit strategy ratified at setup. Review profile: split.

- [x] **Step 1: Add a focused `loadSystemPrompt()` integration test** -> verify: both `en` and
  `pt` prompts contain every `CATALOG` plugin name, the exact catalog ids are
  `gojira,soldano,tim-henson,petrucci`, and Gojira remains first. Run
  `node --test packages/core/src/rig-builder.test.ts packages/core/src/providers/rig-schema.test.ts packages/core/src/plugins/catalog-invariants.test.ts`.
- [x] **Step 2: Run the automated phase gate** -> verify: `npm.cmd run check` exits 0 with zero
  failing tests; record the test count from the actual output, never copy Phase 1's 125-test count.
- [x] **Step 3: Prepare the Windows probe environment** -> waived by the user on 2026-08-06; no
  plugin installation or mapping-load result is claimed. The repository mappings remain available
  for a later manual verification.
- [x] **Step 4: Probe Soldano's complete selector sequence** -> waived by the user on 2026-08-06;
  selector positions are recorded as unverified in `capabilities.md`.
- [x] **Step 5: Probe Tim Henson's complete selector sequence** -> waived by the user on
  2026-08-06; selector positions are recorded as unverified in `capabilities.md`.
- [x] **Step 6: Probe Petrucci's complete selector sequence** -> waived by the user on
  2026-08-06; selector positions are recorded as unverified in `capabilities.md`.
- [x] **Step 7: Write `capabilities.md` from observed facts** -> records the actual date, host
  OS, known mapping counts, expected selector values, the transport connection check, and the
  unverified hardware boundary. Non-selector CCs are explicitly export-confirmed only.
- [x] **Step 8: Validate the document** -> repository paths and mapping counts are checked; the
  document contains no placeholder version or claim of macOS verification.
- [x] **Step 9: Split final review of the full Phase 2 diff; fix/re-review; rerun `npm.cmd run check`
  after any code, mapping, or prompt change; repeat the affected real probe after any selector/XML
  change.**
- [ ] **Step 10: Seal the exact validated HEAD and hand off to `pelizzai-finish-task`.**

**Completion criterion:** automated checks are green; `capabilities.md` records export evidence,
the user-waived selector boundary, and its limits; the validated content is the reviewed content.

## Rollback

The phase adds catalog data and assets without a persistence migration. Before integration, each
task can be reverted independently by removing that plugin's descriptor/test/prompt/XML and its
single catalog registration. If one real selector fails, do not remove the other proven plugins:
return to that plugin's task, correct only evidence-backed descriptor/XML data, rerun its focused
suite and probe, then repeat final review.
