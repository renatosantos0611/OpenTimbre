/**
 * The plugin registry. Every Neural DSP plugin OpenTimbre knows about is one
 * entry here — the schema builder, the MIDI planner, and the launcher all
 * walk this array rather than importing a specific plugin's descriptor, per
 * `opentimbre-plugin-spec`.
 *
 * Empty for now: this task defines the `PluginSpec` shape (`types.ts`) but
 * ports no plugin's actual data yet. A later task fills this in — one
 * descriptor and one line here per plugin — without touching anything else.
 */
import type { PluginSpec } from './types.ts'

export const CATALOG: PluginSpec[] = []
