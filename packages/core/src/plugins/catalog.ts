/**
 * The plugin registry. Every Neural DSP plugin OpenTimbre knows about is one
 * entry here — the schema builder, the MIDI planner, and the launcher all
 * walk this array rather than importing a specific plugin's descriptor, per
 * `opentimbre-plugin-spec`.
 *
 * Gojira is the first entry ported from legacy. Soldano and Tim Henson are
 * later tasks — one descriptor and one line here each, without touching
 * anything else.
 */
import { gojiraSpec } from './gojira.ts'
import type { PluginSpec } from './types.ts'

export const CATALOG: PluginSpec[] = [gojiraSpec]
