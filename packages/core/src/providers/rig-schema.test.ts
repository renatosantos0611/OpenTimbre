/**
 * Characterization tests for `rig-schema.ts` — the zod schema derived from a
 * `PluginSpec`, its `zodToJsonSchema` output, and the two validators built on
 * top of it (`validateRig`, `validateAdjustment`).
 *
 * Ported from legacy's `schema.test.ts` (9 tests). That file's own doctrine
 * carries over unchanged: every assertion is computed FROM the spec, never a
 * hardcoded list — a test that said "gojira requires 11 fields" would need
 * editing every time a parameter was born. Only the literal Portuguese
 * assertions and legacy's `cenaSchema`/`parseRig` entry points change, to
 * this port's real API: `rigJsonSchema`, `validateRig`, `validateAdjustment`.
 *
 * This port has no scene-only export — legacy's `cenaSchema(plugin)` isn't
 * ported (out of `rig-schema.ts`'s current surface). The closest public path
 * that runs the full `scene` schema standalone — including the toggle-group
 * `superRefine` — is `validateAdjustment`'s merge step: an empty `changes`
 * patch against a fully-populated `currentScene` merges back to that same
 * `currentScene` and validates it exactly the way legacy's `cenaSchema(...).
 * safeParse(...)` did directly. `adjust()` below is that seam.
 *
 * Walks `CATALOG` (Gojira today) rather than a hand-rolled fixture, per this
 * task's brief — every assertion below reads its expectation off the real
 * `PluginSpec`, so a later plugin registration inherits this whole suite for
 * free, same spirit as `catalog-invariants.test.ts`.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CATALOG } from '../plugins/catalog.ts'
import type { ParamSpec, PluginSpec, Scene } from '../plugins/types.ts'
import { rigJsonSchema, toolName, validateAdjustment } from './rig-schema.ts'

// ------------------------------------------------------------------ fixture

/** The minimal scene that passes: every `required` field, at its most neutral value. */
function minimalScene(spec: PluginSpec): Scene {
  const scene: Record<string, unknown> = {}
  for (const [name, p] of Object.entries({ ...spec.ampParams, ...spec.params })) {
    if (!p.required) continue
    if (p.type === 'toggle') scene[name] = false
    else if (p.type === 'select') scene[name] = Object.keys(p.options ?? {})[0]
    else scene[name] = 5
  }
  return scene as Scene
}

/**
 * Runs `changes` through `validateAdjustment`, merged onto a fresh minimal
 * `currentScene` — the seam described above for exercising the full `scene`
 * schema (field types, bounds, and the toggle-group `superRefine`) standalone.
 */
function adjust(spec: PluginSpec, changes: Record<string, unknown>) {
  return validateAdjustment(spec, minimalScene(spec), { summary: 'test', changes })
}

type JsonSchemaObject = {
  readonly type?: string
  readonly properties?: Record<string, JsonSchemaObject>
  readonly required?: readonly string[]
  readonly enum?: readonly string[]
  readonly minimum?: number
  readonly maximum?: number
  readonly additionalProperties?: JsonSchemaObject | boolean
}

// -------------------------------------------------------------- tool names

/**
 * Anthropic and OpenAI both accept `^[a-zA-Z0-9_-]{1,64}$` as a tool name.
 * The plugin id enters that name, so an id with a dot, accent, or space
 * would break both APIs — and only when a rig is actually built, not at boot.
 */
test("each plugin's tool name is accepted by both APIs", () => {
  for (const spec of CATALOG) {
    const name = toolName(spec)
    assert.match(name, /^[a-zA-Z0-9_-]{1,64}$/, `'${name}' would be rejected by either API`)
  }
})

for (const spec of CATALOG) {
  describe(spec.id, () => {
    const fields: Record<string, ParamSpec> = { ...spec.ampParams, ...spec.params }
    const json = rigJsonSchema(spec) as JsonSchemaObject
    const paramsJson = json.properties!['scenes']!.additionalProperties as JsonSchemaObject
    const paramsSchema = paramsJson.properties!['params']! as JsonSchemaObject

    // -------------------------------------------------------- field shapes

    test('a knob field becomes a number bounded 0-10 in the JSON Schema', () => {
      const [name] = Object.entries(fields).find(([, p]) => p.type === 'knob')!
      const field = paramsSchema.properties![name]!
      assert.equal(field.type, 'number')
      assert.equal(field.minimum, 0)
      assert.equal(field.maximum, 10)
    })

    test('a toggle field becomes a boolean in the JSON Schema', () => {
      const [name] = Object.entries(fields).find(([, p]) => p.type === 'toggle')!
      const field = paramsSchema.properties![name]!
      assert.equal(field.type, 'boolean')
    })

    test("a select field becomes a string enum of the plugin's option names", () => {
      const [name, p] = Object.entries(fields).find(([, p]) => p.type === 'select')!
      const field = paramsSchema.properties![name]!
      assert.equal(field.type, 'string')
      assert.deepEqual(field.enum, Object.keys(p.options ?? {}))
    })

    // -------------------------------------------------- JSON Schema shape

    test('the JSON Schema required list is exactly the required fields in the spec', () => {
      const fromSchema = [...(paramsSchema.required ?? [])].sort()
      const fromSpec = Object.entries(fields)
        .filter(([, p]) => p.required)
        .map(([name]) => name)
        .sort()
      assert.deepEqual(fromSchema, fromSpec)
    })

    test('zodToJsonSchema output is a plain object with no leftover $schema key', () => {
      assert.equal('$schema' in json, false, "the '$schema' key must be stripped before this reaches the API")
      assert.equal(json.type, 'object')
      assert.deepEqual([...(json.required ?? [])].sort(), ['amp', 'artist', 'note', 'scenes', 'song'])
    })

    // ------------------------------------------------------------ validation

    test('a valid, minimal scene passes validation', () => {
      const result = adjust(spec, {})
      assert.ok(result.ok, JSON.stringify(result.ok ? null : result.issues))
    })

    test('a knob field of the wrong type is rejected', () => {
      const [name] = Object.entries(fields).find(([, p]) => p.type === 'knob')!
      assert.equal(adjust(spec, { [name]: 'loud' }).ok, false)
    })

    test('a knob value out of 0-10 is rejected, above and below', () => {
      const [name] = Object.entries(fields).find(([, p]) => p.type === 'knob')!
      assert.equal(adjust(spec, { [name]: 11 }).ok, false)
      assert.equal(adjust(spec, { [name]: -1 }).ok, false)
    })

    test('an invalid enum value on a select field is rejected', () => {
      const [name] = Object.entries(fields).find(([, p]) => p.type === 'select')!
      assert.equal(adjust(spec, { [name]: 'not-a-real-option' }).ok, false)
    })

    // ------------------------------------------------- amp-conditional groups

    test('a toggle set to true whose governed knob is missing fails, naming the knob and the toggle', () => {
      // Needs a group with at least one non-required knob: a required knob is
      // already present via `minimalScene`, so it would never come up
      // "missing" and the group's own check would go unexercised.
      const groupEntry = Object.entries(spec.groups).find(([, knobs]) => knobs.some((k) => !fields[k]?.required))
      assert.ok(groupEntry, 'fixture assumption: no group has an optional knob to test with')
      const [toggle, knobs] = groupEntry!

      const result = adjust(spec, { [toggle]: true })
      assert.equal(result.ok, false, `'${toggle}' = true without its knobs should fail validation`)
      if (result.ok) return

      for (const knob of knobs.filter((k) => !fields[k]?.required)) {
        assert.ok(
          result.issues.some(
            (i) => i.path[0] === knob && i.message.includes(`'${knob}'`) && i.message.includes(`'${toggle}'`),
          ),
          `expected an issue on '${knob}' whose message names '${toggle}' as the reason it's required`,
        )
      }
    })

    test('the same toggle set to false does not require its governed knob', () => {
      const [toggle] = Object.entries(spec.groups)[0]!
      const result = adjust(spec, { [toggle]: false })
      assert.ok(result.ok, JSON.stringify(result.ok ? null : result.issues))
    })
  })
}
