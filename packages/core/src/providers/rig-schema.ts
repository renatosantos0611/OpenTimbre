/**
 * Turns a `PluginSpec` into the two things the tool-use protocol needs on the
 * AI side of a call: the JSON Schema handed to the model as the tool's input
 * shape, and a validator that checks a returned call's arguments against
 * that same shape, reporting `tool-use.ts`-shaped `Issue[]` on failure.
 *
 * Ported from legacy's `schema.ts`, now WITH `zod` and `zod-to-json-schema`
 * (the coordinator added both to `packages/core/package.json` after this
 * task started — see the module doc history below). One schema per plugin,
 * built from its `PluginSpec` and cached (assembly walks dozens of
 * parameters and the JSON Schema is several KB; none of that changes at
 * runtime, and the path runs every conversation turn).
 *
 * **History**: an earlier pass at this file hand-rolled a JSON-schema
 * validator because `packages/core` didn't yet depend on `zod` and the task
 * that wrote it wasn't authorized to add the dependency. That workaround is
 * gone now that the dependency exists — this file is a straight port of
 * legacy's `zod`-based `schema.ts`, English identifiers per
 * `opentimbre-code-style`.
 *
 * `Rig`/`DetailedScene`/`GuitarUsage` are `@opentimbre/contracts`' shapes,
 * not redefined here. `Adjustment` has no contracts equivalent yet, so it's
 * defined locally, mirroring legacy's `Ajuste`.
 */
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { Rig } from '@opentimbre/contracts'
import type { ParamSpec, PluginSpec, Scene } from '../plugins/types.ts'
import type { Issue } from './tool-use.ts'

/** Legacy imports these from `plugins/index.js`; this port's `plugins/types.ts` doesn't export them (out of this task's scope), so they're local. */
const KNOB_MIN = 0
const KNOB_MAX = 10

export type Verdict<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: Issue[] }

/** `scene` is the FULL scene after merging the model's patch onto the current one — never just the delta. */
export type Adjustment = { readonly summary: string; readonly scene: Scene }

/** This plugin's tool name — how the model picks it, and how the app knows which one it picked. */
export function toolName(plugin: PluginSpec): string {
  return `apply_rig_${plugin.id}`
}

export const ADJUST_TOOL_NAME = 'adjust_scene'

// ------------------------------------------------------------- field-level

/** A spec becomes a zod type: knob = 0-10, toggle = boolean, select = enum. */
function fieldFor(spec: ParamSpec): z.ZodTypeAny {
  if (spec.type === 'toggle') return z.boolean().describe(spec.desc)
  if (spec.type === 'select') {
    const names = Object.keys(spec.options ?? {})
    return z.enum(names as [string, ...string[]]).describe(spec.desc)
  }
  return z.number().min(KNOB_MIN).max(KNOB_MAX).describe(spec.desc)
}

/** Every scene field this plugin defines: the amp's (CC depends on amp) plus the fixed-CC ones. */
function allFields(plugin: PluginSpec): [string, ParamSpec][] {
  return [...Object.entries(plugin.ampParams), ...Object.entries(plugin.params)]
}

function toIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({ path: i.path, message: i.message }))
}

// ------------------------------------------------------------ per-plugin build

type Built = {
  /** Full scene: every field per its own `required`, plus the toggle-group cross-field check below. */
  readonly scene: z.ZodTypeAny
  /** Same fields, all optional, no group check — the raw shape of an `adjust` patch, validated alone. */
  readonly partialScene: z.ZodTypeAny
  readonly rigModel: z.ZodTypeAny
  readonly adjust: z.ZodTypeAny
  readonly rigJson: Record<string, unknown>
  readonly adjustJson: Record<string, unknown>
}

/** Assembling a plugin's schemas is repeated work every turn; nothing here depends on runtime state. */
const cache = new Map<string, Built>()

function build(plugin: PluginSpec): Built {
  const fields = allFields(plugin)

  // Raw form of each field, not yet deciding required/optional — reused by
  // both the full scene and the `adjust` patch's partial shape.
  const rawShape: Record<string, z.ZodTypeAny> = {}
  for (const [name, spec] of fields) rawShape[name] = fieldFor(spec)

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [name, spec] of fields) {
    shape[name] = spec.required ? rawShape[name]! : rawShape[name]!.optional()
  }

  /**
   * `.strict()` rejects keys outside the map — an invented key is a
   * validation issue, never a silently ignored parameter.
   *
   * Annotated `z.ZodTypeAny` (rather than left inferred) so TS widens it
   * immediately: `rigModel` below nests `scene` two levels deep through
   * `detailedScene`, and without this the compiler tries to carry the fully
   * inferred generic shape through every level, which blows past its type
   * instantiation depth limit (TS2589) on a plugin's full parameter set.
   */
  const scene: z.ZodTypeAny = z
    .object(shape)
    .strict()
    .superRefine((values, ctx) => {
      // An effect switched on without the knobs it governs would apply with
      // everything at zero, which sounds like the effect never turned on.
      for (const [toggle, knobs] of Object.entries(plugin.groups)) {
        if ((values as Record<string, unknown>)[toggle] !== true) continue
        for (const knob of knobs) {
          if ((values as Record<string, unknown>)[knob] === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [knob],
              message: `'${knob}' is required when '${toggle}' is true`,
            })
          }
        }
      }
    })

  const partialShape: Record<string, z.ZodTypeAny> = {}
  for (const name of Object.keys(rawShape)) partialShape[name] = rawShape[name]!.optional()
  const partialScene: z.ZodTypeAny = z.object(partialShape).strict()

  const guitarUsage: z.ZodTypeAny = z
    .object({
      pickupPosition: z.string().describe('pickup position: bridge, middle, neck, bridge+middle, middle+neck'),
      volume: z.number().min(0).max(10).describe('guitar volume knob, 0 to 10'),
      tone: z.number().min(0).max(10).describe('guitar tone knob, 0 to 10'),
      technique: z.string().describe('a short phrase: picking, palm muting, pick attack area, finger or pick'),
    })
    .strict()

  /**
   * A scene is what the guitarist reads **plus** what MIDI applies. The
   * parameters stay isolated in `params` on purpose: it's exactly the object
   * that goes to `applyScene`, and mixing text in there would force every
   * caller to filter fields.
   */
  const detailedScene: z.ZodTypeAny = z
    .object({
      title: z
        .string()
        .describe(
          'short name for the passage, 1-3 words, like a patch bank label. E.g. "Riff base", "Solo", ' +
            '"Clean intro". No artist or song name',
        ),
      summary: z
        .string()
        .describe(
          'one line up to ~60 characters saying what this scene sounds like, without repeating the ' +
            'title or citing numbers. E.g. "Amp drive with fuzz up front, tight low end"',
        ),
      explanation: z
        .string()
        .describe(
          'why this amp, this drive level, and these effects bring the tone close to the recording — ' +
            '2 to 4 sentences, for the guitarist to read. Do not repeat the summary',
        ),
      guitar: guitarUsage.describe('adjustments to make on the physical guitar for this scene'),
      params: scene.describe('the plugin parameters for this scene'),
    })
    .strict()

  /** What the AI fills in. `plugin` doesn't enter: it comes from which tool it called. */
  const rigModel: z.ZodTypeAny = z
    .object({
      song: z.string().describe('song name'),
      artist: z.string().describe('artist or band'),
      amp: z.enum(plugin.amps as [string, ...string[]]).describe('amplifier for the whole song'),
      note: z.string().describe('a short phrase: approach, recommended pickup, technique'),
      scenes: z
        .record(z.string(), detailedScene)
        .describe(
          "named scenes; 'base' is required, 'solo'/'intro'/'clean'/'bridge' when it makes sense",
        )
        .refine((c) => 'base' in c, { message: 'must contain a "base" scene' }),
    })
    .strict()

  const adjust: z.ZodTypeAny = z
    .object({
      summary: z.string().describe('short phrase for what changed and why'),
      changes: partialScene.describe('only the fields that must change to satisfy the request — omit the rest'),
    })
    .strict()

  const json = (s: z.ZodTypeAny): Record<string, unknown> => {
    // `zodToJsonSchema`'s return type pattern-matches recursively over the
    // full `ZodTypeAny` union; handed the real (still-generic) schema type,
    // that recursion exceeds TS's instantiation depth limit (TS2589) on a
    // plugin's full parameter set. The `any` here is a compile-time-only
    // escape from that — the runtime call and this function's own return
    // type are unaffected.
    const out = zodToJsonSchema(s as any, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>
    delete out['$schema']
    return out
  }

  return { scene, partialScene, rigModel, adjust, rigJson: json(rigModel), adjustJson: json(adjust) }
}

function schemasFor(plugin: PluginSpec): Built {
  let built = cache.get(plugin.id)
  if (!built) {
    built = build(plugin)
    cache.set(plugin.id, built)
  }
  return built
}

// -------------------------------------------------------------------- rig

export function rigJsonSchema(plugin: PluginSpec): Record<string, unknown> {
  return schemasFor(plugin).rigJson
}

export function validateRig(plugin: PluginSpec, raw: unknown): Verdict<Rig> {
  const result = schemasFor(plugin).rigModel.safeParse(raw)
  if (!result.success) return { ok: false, issues: toIssues(result.error) }
  const value = result.data as Omit<Rig, 'plugin'>
  return { ok: true, value: { ...value, plugin: plugin.id } as Rig }
}

// --------------------------------------------------------------- adjustment

export function adjustJsonSchema(plugin: PluginSpec): Record<string, unknown> {
  return schemasFor(plugin).adjustJson
}

/**
 * Two validations, and the second is the one that usually catches something:
 * the patch can be flawless by itself and still produce an invalid scene once
 * merged with the current one — switching a pedal on without sending its
 * knobs, for instance.
 */
export function validateAdjustment(plugin: PluginSpec, currentScene: Scene, raw: unknown): Verdict<Adjustment> {
  const built = schemasFor(plugin)

  const patch = built.adjust.safeParse(raw)
  if (!patch.success) return { ok: false, issues: toIssues(patch.error) }
  const { summary, changes } = patch.data as { summary: string; changes: Scene }

  const merged = built.scene.safeParse({ ...currentScene, ...changes })
  if (!merged.success) return { ok: false, issues: toIssues(merged.error) }

  return { ok: true, value: { summary, scene: merged.data as Scene } }
}
