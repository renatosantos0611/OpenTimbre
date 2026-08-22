/**
 * The contract of a Neural DSP plugin.
 *
 * The app started on top of the Archetype Gojira, with its CC map spread
 * across global constants. Here that knowledge becomes **data**: every
 * plugin is a `PluginSpec`, and the schema, the MIDI send, and the system
 * prompt are all derived from the spec instead of importing a specific
 * plugin module. See `opentimbre-plugin-spec` for the rule this file exists
 * to enforce: no CC number, amp name, or parameter range lives outside a
 * `PluginSpec`.
 *
 * What lives in this file is what holds for any plugin — the scales, the
 * amp-switching strategies, the types. What belongs to one plugin (Gojira,
 * Soldano, ...) belongs in that plugin's own descriptor, populated into
 * `catalog.ts` by a later task; that file stays an empty array here.
 *
 * Ported from legacy's `plugins/types.ts`. Portuguese domain identifiers
 * become English ones per `opentimbre-code-style` (`Cena` -> `Scene`,
 * `sempreLigado` -> `alwaysOn`, `grupos` -> `groups`, ...) — the doctrine and
 * the math are unchanged.
 */

// ------------------------------------------------------------- parameters

export type ParamType = 'knob' | 'toggle' | 'select'

export type ParamSpec = {
  readonly type: ParamType
  /** If true, the scene must supply the value — there is never a silent default. */
  readonly required: boolean
  readonly desc: string
  /**
   * Value (on the 0-10 scale) sent when the toggle governing this knob is
   * off. Defaults to 0. EQ bands use 5, which is flat — sending 0 would be
   * -12 dB across the whole band.
   */
  readonly off?: number
  /** `select` only: the name the AI uses -> the 0-127 MIDI value. */
  readonly options?: Readonly<Record<string, number>>
}

/** A `ParamSpec` with a fixed CC — used by parameters that don't depend on the amp. */
export type FixedParamSpec = ParamSpec & { readonly cc: number }

/**
 * A scene is the plugin's parameter values.
 *
 * The type is deliberately loose. It used to be derived via mapped types
 * from Gojira's literals, which gave field-by-field autocomplete — but that
 * only works with **one** plugin known at compile time. The real guarantee
 * has always been zod, which validates each field's name, type, and range
 * at runtime from the spec; what's lost here is editing convenience, not
 * safety.
 */
export type ParamValue = number | boolean | string
export type Scene = Record<string, ParamValue>

// ------------------------------------------------------------------ scales

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The AI works in 0-10; the plugin speaks 0-127. */
export function knobToMidi(v: number): number {
  return clamp(Math.round(v * 12.7), 0, 127)
}

export function toggleToMidi(on: boolean): number {
  return on ? 127 : 0
}

// --------------------------------------------------------------- the plugin

/** What the launcher needs to open the app and manage its MIDI mapping. */
export type AppInfo = {
  /**
   * Likely executable paths, in the order they should be tried — genuinely
   * different data per OS (a Windows path is simply wrong on macOS, not
   * just unused there), so this is keyed by platform rather than a single
   * flat list. Per `opentimbre-cross-platform`, this file never reads
   * `process.platform` itself to pick one — a platform module (or, later, a
   * launcher) does that; the data for both lives here regardless of which
   * OS actually loads this descriptor. An empty/absent entry for a platform
   * means no path has been confirmed there yet — never invent one.
   */
  readonly candidates: Readonly<{ win32?: readonly string[]; darwin?: readonly string[] }>
  /** Process name, to tell whether it's already open — Windows uses this
   * verbatim; macOS's process-detection convention may differ. */
  readonly process: string
  /** Subfolder under the platform's settings root (%APPDATA% on Windows,
   * ~/Library/Application Support on macOS) where the plugin keeps settings
   * and mappings — see `PlatformInfo.settingsDir()`. */
  readonly settings: string
  /**
   * Subfolder of `settings` where the plugin keeps its MIDI Mapping files.
   * Not universal: Gojira uses `MIDI Mappings`, Soldano uses just `MIDI`.
   */
  readonly midiFolder: string
  /** File under `midi-mapping/` that the app installs into that folder. */
  readonly mapping: string
}

export type PluginSpec = {
  readonly id: string
  readonly name: string
  /** One sentence for the AI to decide when this plugin is the right choice. */
  readonly whenToUse: string
  /** Signal chain, for the system-prompt doc. */
  readonly signalChain: string
  /** File under `prompts/plugins/` carrying this plugin's tone knowledge. */
  readonly doc: string

  readonly amps: readonly string[]
  readonly ampDescriptions: Readonly<Record<string, string>>
  /** The amp selector: which CC it's on, and the value that picks each amp. */
  readonly ampSelect: { readonly cc: number; readonly values: Readonly<Record<string, number>> }
  /**
   * How this plugin's amp selector is driven — declared as data per plugin,
   * so applying a scene never depends on outside configuration. `manual`
   * stays the choice for a selector nobody has verified yet; declaring it is
   * a conscious act, which is exactly why the old ambient default (env var,
   * silently dropped during the port) regressed every amp switch. For the
   * archetypes whose selectors are still flagged unprobed in their mapping
   * files, keeping `continuous` here is the shipped decision — the Phase 0
   * probe ritual on hardware is what confirms or revises it per plugin.
   */
  readonly ampStrategy: AmpStrategyName
  /** The controls that define an amp as "mapped" — see `resolveAmp`. */
  readonly ampCore: readonly string[]
  /** Parameters whose CC depends on which amp is active. */
  readonly ampParams: Readonly<Record<string, ParamSpec>>
  /** Each amp parameter's CC, per amp. Absent = that amp doesn't have the control. */
  readonly ampCC: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Fixed-CC parameters (pedals, cab, delay, reverb). */
  readonly params: Readonly<Record<string, FixedParamSpec>>
  /** Toggle -> the knobs it governs, pedals and amp EQ together. */
  readonly groups: Readonly<Record<string, readonly string[]>>
  /** Section bypasses: always sent at 127 before the scene. */
  readonly alwaysOn: Readonly<Record<string, number>>

  readonly app: AppInfo
}

// ------------------------------------------------------------- mapped amps

function isAmpMapped(spec: PluginSpec, amp: string): boolean {
  const ccs = spec.ampCC[amp] ?? {}
  return spec.ampCore.every((k) => ccs[k] !== undefined)
}

function mappedAmps(spec: PluginSpec): string[] {
  return spec.amps.filter((a) => isAmpMapped(spec, a))
}

/**
 * If the requested amp has no mapped knobs, falls back to the first one that
 * does — otherwise the app would switch the amp and then move another amp's
 * knobs, which is inaudible and confusing. Returns the warning for the UI to
 * show.
 */
export function resolveAmp(
  spec: PluginSpec,
  target: string,
): { amp: string; warning: string | null } {
  if (isAmpMapped(spec, target)) return { amp: target, warning: null }

  const fallback = mappedAmps(spec)[0]
  if (!fallback) {
    return { amp: target, warning: 'no amp has mapped knobs — only the selector was sent' }
  }
  return {
    amp: fallback,
    warning: `amp ${target} has no mapped knobs yet in the plugin — applying to ${fallback} instead`,
  }
}

// ---------------------------------------------------------- amp strategies

export type Send = (cc: number, value: number) => void

export type AmpStrategyName = 'manual' | 'continuous' | 'increment'

export type AmpStrategy = {
  readonly name: string
  /** Returns null if applied via MIDI, or a text instruction if it needs a manual action. */
  apply(target: string, send: Send): string | null
  /** Resyncs internal state (only `increment` keeps any). */
  reset(current?: string): void
}

/** Continuous 0-127 CC mapped onto the selector's positions. */
function continuous(spec: PluginSpec): AmpStrategy {
  return {
    name: 'continuous',
    apply(target, send) {
      const value = spec.ampSelect.values[target]
      if (value === undefined) return `amp '${target}' doesn't exist in ${spec.name}`
      send(spec.ampSelect.cc, value)
      return null
    },
    reset() {},
  }
}

/**
 * Selector that only advances one position per pulse. Keeps the current
 * position in memory — if someone moves it by hand in the plugin, the state
 * desyncs and `reset()` is needed to resync it.
 */
function increment(spec: PluginSpec): AmpStrategy {
  let current = spec.amps[0] ?? ''
  return {
    name: 'increment',
    apply(target, send) {
      const n = spec.amps.length
      const steps = (spec.amps.indexOf(target) - spec.amps.indexOf(current) + n) % n
      for (let i = 0; i < steps; i++) {
        send(spec.ampSelect.cc, 127)
        send(spec.ampSelect.cc, 0)
      }
      current = target
      return null
    },
    reset(c) {
      current = c ?? spec.amps[0] ?? ''
    },
  }
}

const manual: AmpStrategy = {
  name: 'manual',
  apply(target) {
    return `select the ${target} amp on the plugin`
  },
  reset() {},
}

/**
 * Builds the strategy that actually switches the amp. An explicit `name`
 * (tests, probes) wins; otherwise the plugin's OWN declared `ampStrategy` —
 * catalog data, proven per plugin. Per `opentimbre-plugin-spec`, plugin
 * knowledge is data in the catalog, not ambient configuration: legacy read
 * `AMP_STRATEGY`/`GOJIRA_AMP_STRATEGY` env vars, and silently dropping that
 * during the port made every amp switch fall back to `manual` — the plugin
 * never changed amp, and the amp's knob CCs landed on the wrong amp page.
 */
export function getAmpStrategy(spec: PluginSpec, name?: AmpStrategyName): AmpStrategy {
  const chosen = name ?? spec.ampStrategy
  switch (chosen) {
    case 'continuous':
      return continuous(spec)
    case 'increment':
      return increment(spec)
    case 'manual':
      return manual
    default:
      throw new Error(`Unknown amp strategy: '${chosen}'. Use manual | continuous | increment.`)
  }
}
