/**
 * The plugin registry. Every Neural DSP plugin OpenTimbre knows about is one
 * entry here — the schema builder, the MIDI planner, and the launcher all
 * walk this array rather than importing a specific plugin's descriptor, per
 * `opentimbre-plugin-spec`.
 *
 * Gojira is the first entry ported from legacy. Soldano SLO-100 X joins in
 * Task 2; Tim Henson X in Task 3; Petrucci X completes the phase in Task 4 —
 * one descriptor and one line each, without touching anything else.
 */
import { gojiraSpec } from './gojira.ts'
import { soldanoSpec } from './soldano.ts'
import { timHensonSpec } from './tim-henson.ts'
import { petrucciSpec } from './petrucci.ts'
import type { PluginSpec } from './types.ts'

export const CATALOG: PluginSpec[] = [gojiraSpec, soldanoSpec, timHensonSpec, petrucciSpec]
