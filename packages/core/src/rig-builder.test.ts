/**
 * Rig builder / system-prompt integration — end-to-end checks that the
 * full catalog walks correctly through schema, prompts, and tool naming.
 *
 * These don't exercise MIDI hardware; they prove that registering a new
 * plugin into `CATALOG` automatically makes it discoverable by the tools
 * that walk the array (schema generator, prompt injector, tool router).
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CATALOG } from './plugins/catalog.ts'
import { loadSystemPrompt } from './rig-builder.ts'
import { rigJsonSchema, toolName } from './providers/rig-schema.ts'

describe('full catalog walks', () => {
  test('catalog contains exactly four plugins in order', () => {
    const ids = CATALOG.map((spec) => spec.id)
    assert.deepEqual(ids, ['gojira', 'soldano', 'tim-henson', 'petrucci'])
  })

  test('Gojira is always the first entry (default selection)', () => {
    assert.equal(CATALOG[0].id, 'gojira')
  })

  test('every catalog entry produces a valid JSON Schema', () => {
    for (const spec of CATALOG) {
      const json = rigJsonSchema(spec)
      const properties = json.properties as Record<string, unknown> | undefined
      assert.ok(json.type === 'object', `${spec.id} rig schema must be an object`)
      assert.ok(properties?.scenes, `${spec.id} rig schema must have a scenes field`)
    }
  })

  test('all four prompt pairs load through the system prompt builder', () => {
    for (const locale of ['en', 'pt'] as const) {
      const prompt = loadSystemPrompt(locale)
      for (const spec of CATALOG) {
        assert.ok(
          prompt.includes(`## ${spec.name}`),
          `${locale}: loadSystemPrompt() must include ${spec.name} from the catalog`,
        )
      }
    }
  })

  test('each catalog entry produces a unique apply_rig tool name', () => {
    const names = CATALOG.map(toolName)
    const seen = new Set<string>()
    for (const name of names) {
      assert.ok(!seen.has(name), `duplicate tool name: ${name}`)
      seen.add(name)
    }
  })
})