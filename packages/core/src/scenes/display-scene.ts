/**
 * Translates a scene into the card the window shows — the pure decision half
 * of the rig-card UI, kept in core so the renderer never imports a
 * `PluginSpec` and the choice of *which* values represent the scene is
 * testable without a window (see `opentimbre-plugin-spec`).
 *
 * The principle is "parameter is data, not prose": a knob value never lives
 * buried in a paragraph. Two non-repeating regions — the always-visible
 * faceplate of the knobs that define the sound, and the pedal blocks (inside
 * the collapsible part) describing what each *on* effect is doing in words,
 * so the faceplate's numbers aren't echoed below.
 *
 * Ported from legacy's `plugins/exibicao.ts`; identifiers translated to
 * English per `opentimbre-code-style`.
 */
import type { SceneCard } from '@opentimbre/contracts'
import type { PluginSpec, Scene } from '../plugins/types.ts'

/** How many values fit the faceplate before it becomes soup. */
const MAX_VALUES = 6

/** How many knobs a pedal block describes; the rest becomes ellipsis. */
const MAX_KNOBS_PER_PEDAL = 4

/** `dlyMix` → `DLY MIX` — the faceplate is all caps. */
export function label(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase()
}

/** Knob 0–10 becomes a word — "drive baixo · level alto" says what it does. */
function degree(v: number): string {
  if (v <= 1) return 'minimal'
  if (v <= 3.5) return 'low'
  if (v <= 6.5) return 'medium'
  if (v <= 9) return 'high'
  return 'max'
}

/** `od1On` → `od1`; anything else passes whole. */
function stem(toggle: string): string {
  return toggle.endsWith('On') ? toggle.slice(0, -2) : toggle
}

/** The knob name under a toggle, with the shared prefix trimmed as noise. */
function short(knob: string, prefix: string): string {
  const rest = knob.startsWith(prefix) ? knob.slice(prefix.length) : ''
  if (rest.length > 0 && !/^\d+$/.test(rest)) {
    return (rest[0]!.toLowerCase() + rest.slice(1)).replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  }
  return knob.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

/** `4.5` stays `4.5`, `6` stays `6` — no trailing zero nobody reads. */
function number(v: number): string {
  return String(Math.round(v * 10) / 10)
}

/**
 * The faceplate: the *required* knobs. `required: true` already means "the
 * scene can't omit this value" — exactly the controls that define the sound.
 * Amp params come first (the amp is in charge), then the fixed-CC params.
 */
function valuesOf(spec: PluginSpec, scene: Scene, amp: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const ampCcs = spec.ampCC[amp] ?? {}

  for (const [name, p] of Object.entries(spec.ampParams)) {
    if (ampCcs[name] === undefined || !p.required || p.type !== 'knob') continue
    const v = scene[name]
    if (typeof v === 'number') out.push({ label: label(name), value: number(v) })
  }
  for (const [name, p] of Object.entries(spec.params)) {
    if (!p.required || p.type !== 'knob') continue
    const v = scene[name]
    if (typeof v === 'number') out.push({ label: label(name), value: number(v) })
  }

  return out.slice(0, MAX_VALUES)
}

/**
 * One block per effect that is **on**, in signal-chain order (`groups`).
 * An off effect becomes no block: the scene sends its knobs to rest, so
 * there's nothing to say about it.
 */
function pedalsOf(spec: PluginSpec, scene: Scene): { name: string; detail: string }[] {
  const out: { name: string; detail: string }[] = []

  for (const [toggle, knobs] of Object.entries(spec.groups)) {
    if (scene[toggle] !== true) continue

    const prefix = stem(toggle)
    const parts: string[] = []
    for (const knob of knobs) {
      const v = scene[knob]
      if (typeof v === 'number') parts.push(`${short(knob, prefix)} ${degree(v)}`)
    }
    if (parts.length > MAX_KNOBS_PER_PEDAL) parts.splice(MAX_KNOBS_PER_PEDAL, Infinity, '…')

    out.push({ name: label(prefix), detail: parts.join(' · ') })
  }

  return out
}

export function displayScene(spec: PluginSpec, scene: Scene, amp: string): SceneCard {
  return { values: valuesOf(spec, scene, amp), pedals: pedalsOf(spec, scene) }
}