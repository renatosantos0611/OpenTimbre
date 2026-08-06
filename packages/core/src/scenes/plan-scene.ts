/**
 * Translates a `Scene` into the list of Control Change messages it implies.
 *
 * This is the only part of the scene path that is **decision** — which CC
 * gets which value, what a knob does when the pedal governing it is off,
 * which amp's CCs actually get planned when the requested one isn't mapped.
 * Everything else is plumbing: opening a port and writing bytes, which lives
 * in a MIDI-transport port consumer, not here. Keeping the two apart is what
 * lets this function be tested with no loopMIDI, no plugin open, and no
 * Windows — see `opentimbre-testing`.
 *
 * Ported from legacy's `plugins/cena.ts` (`planScene`/`ScenePlan`). Two
 * differences from that version, both narrowing scope rather than changing
 * behavior:
 * - The amp-selector send (`AmpStrategy.apply`) is NOT part of this
 *   function's output. Legacy's `planScene` took the strategy and interleaved
 *   its send calls with the scene's own CCs; here the produced signature is
 *   `(spec, scene, amp) -> {cc, value}[]`, so selecting the amp — which may
 *   need MIDI, may need a text instruction (`manual`), and may need internal
 *   state (`increment`) — is a separate concern for whoever applies a scene,
 *   not this pure decision. `resolveAmp`'s outcome (which amp's knobs get
 *   planned) is still fully honored internally; only the outgoing CC for the
 *   selector itself moved out.
 * - `resolveAmp`'s warning is not returned, for the same reason: the given
 *   signature returns only the CC list. Surfacing the warning to the UI is
 *   for the caller that also applies the amp-selector strategy.
 */
import { knobToMidi, resolveAmp, toggleToMidi, type ParamSpec, type PluginSpec, type Scene } from '../plugins/types.ts'

export type CcValue = { readonly cc: number; readonly value: number }

/**
 * MIDI value for one parameter, or `null` when there's nothing to send.
 *
 * - toggle: always resolves — a value the scene omitted becomes `off` (per
 *   `opentimbre-plugin-spec`: there's no such thing as a scene with an
 *   undefined effect).
 * - select: only resolves when the scene named an option that exists.
 * - knob: uses the scene's value; if the effect governing this knob is
 *   resting (off), uses the rest value (`off`, default 0 — 5 for EQ bands,
 *   which is flat) instead of leaving it unset.
 */
function midiValueFor(spec: ParamSpec, raw: unknown, resting: boolean): number | null {
  if (spec.type === 'toggle') return toggleToMidi(raw === true)
  if (spec.type === 'select') {
    const value = typeof raw === 'string' ? spec.options?.[raw] : undefined
    return value ?? null
  }
  if (typeof raw === 'number') return knobToMidi(raw)
  return resting ? knobToMidi(spec.off ?? 0) : null
}

/**
 * Which knobs must rest at their off value: the ones governed by a toggle
 * that isn't on. Schema validation (a later task) guarantees an on effect
 * always brings its knobs, so nothing that should be sounding gets zeroed
 * here.
 */
function restingKnobs(spec: PluginSpec, scene: Record<string, unknown>): Set<string> {
  const resting = new Set<string>()
  for (const [toggle, knobs] of Object.entries(spec.groups)) {
    if (scene[toggle] !== true) for (const knob of knobs) resting.add(knob)
  }
  return resting
}

/**
 * Builds the CC plan for a **whole** scene, never a delta: MIDI is one-way
 * and the app can't read the plugin's current state back, so resending
 * everything is what keeps the two in sync. If the guitarist nudges a knob by
 * hand, the next scene change corrects it.
 */
export function planScene(spec: PluginSpec, scene: Scene, amp: string): CcValue[] {
  const messages: CcValue[] = []

  // A section bypass would swallow the whole scene in silence, and there's no
  // way to read the plugin's state to discover that — so all of them go on
  // before anything else.
  for (const cc of Object.values(spec.alwaysOn)) messages.push({ cc, value: 127 })

  // Switching the amp and then moving another amp's knobs would be inaudible
  // and confusing, so the CCs actually planned belong to the RESOLVED amp,
  // not necessarily the one requested.
  const { amp: resolved } = resolveAmp(spec, amp)

  const fields = scene as Record<string, unknown>
  const resting = restingKnobs(spec, fields)

  const ampCCs = spec.ampCC[resolved] ?? {}
  for (const [name, paramSpec] of Object.entries(spec.ampParams)) {
    const cc = ampCCs[name]
    if (cc === undefined) continue // the resolved amp doesn't have this control
    const value = midiValueFor(paramSpec, fields[name], resting.has(name))
    if (value !== null) messages.push({ cc, value })
  }

  for (const [name, paramSpec] of Object.entries(spec.params)) {
    const value = midiValueFor(paramSpec, fields[name], resting.has(name))
    if (value !== null) messages.push({ cc: paramSpec.cc, value })
  }

  return messages
}
