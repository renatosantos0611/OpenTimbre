/**
 * Catalog invariants — run once for **every** registered plugin.
 *
 * No test here names a specific plugin: they all walk `CATALOG`. That's the
 * point, per `opentimbre-testing` — a new Archetype registered in
 * `catalog.ts` inherits this whole suite without anyone writing a test for
 * it.
 *
 * Ported from legacy's `catalogo.test.ts`. Each check below maps to a real
 * incident that already happened in the legacy codebase:
 * - two parameters sharing a CC, where the second silently overwrote the
 *   first
 * - a toggle group naming a knob that had been renamed and no longer
 *   existed as a parameter
 * - `ampCore` naming a knob that had been renamed — the same failure as the
 *   groups check above, but for the list that decides whether an amp counts
 *   as "mapped" at all: a stale entry here makes `resolveAmp` treat a fully
 *   configured amp as permanently unmapped, silently, forever
 * - two plugins registered under the same `id` — the second would shadow the
 *   first in any lookup keyed by id, and nobody would notice until the wrong
 *   plugin's tone came out
 * - a mapping XML missing a spec CC — the app sends, the plugin ignores
 *   it, scenes sound wrong with no error
 * - a prompt locale gone missing — `loadSystemPrompt()` crashes on import
 *
 * `CATALOG` currently has only Gojira. The per-plugin `describe` block
 * exercises every invariant against it; adding Soldano, Tim Henson, or
 * Petrucci will automatically run this full suite through the catalog walker.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, test } from 'node:test'
import { CATALOG } from './catalog.ts'
import type { PluginSpec } from './types.ts'

/** Every CC the spec can send, mapped to the name(s) of the field(s) using it. */
function ccsInSpec(spec: PluginSpec): Map<number, string[]> {
  const map = new Map<number, string[]>()
  const note = (cc: number, who: string) => {
    const current = map.get(cc) ?? []
    current.push(who)
    map.set(cc, current)
  }

  note(spec.ampSelect.cc, 'ampSelect')
  for (const [amp, ccs] of Object.entries(spec.ampCC)) {
    for (const [name, cc] of Object.entries(ccs)) note(cc, `${amp}.${name}`)
  }
  for (const [name, p] of Object.entries(spec.params)) note(p.cc, name)
  for (const [name, cc] of Object.entries(spec.alwaysOn)) note(cc, name)
  return map
}

/** CCs declared in the plugin's MIDI-mapping XML, on either attribute form. */
function ccsFromXml(spec: PluginSpec): Set<number> {
  const xmlBase = new URL('../../../../midi-mapping/', import.meta.url)
  const raw = fs.readFileSync(new URL(spec.app.mapping, xmlBase), 'utf8')

  // Strip comments so prose mentioning CC numbers does not create false positives.
  const xml = raw.replace(/<!--[\s\S]*?-->/g, '')

  const ccs = new Set<number>()
  for (const m of xml.matchAll(/\bdata1="(\d+)"/g)) ccs.add(Number(m[1]))
  for (const m of xml.matchAll(/\scc="(\d+)"/g)) ccs.add(Number(m[1]))
  return ccs
}

for (const spec of CATALOG) {
  describe(spec.id, () => {
    test('no CC is used by two parameters', () => {
      const doubled = [...ccsInSpec(spec).entries()].filter(([, who]) => who.length > 1)
      assert.deepEqual(
        doubled.map(([cc, who]) => `CC ${cc}: ${who.join(' and ')}`),
        [],
        'two parameters on the same CC — the second silently overwrites the first',
      )
    })

    test('groups link real toggles to real knobs', () => {
      const params = { ...spec.ampParams, ...spec.params }
      for (const [toggle, knobs] of Object.entries(spec.groups)) {
        const owner = params[toggle]
        assert.ok(owner, `group '${toggle}' is not a parameter — the group is dead weight`)
        assert.equal(
          owner.type,
          'toggle',
          `group '${toggle}' must be a toggle, is '${owner.type}' — it can't gate anything`,
        )
        for (const knob of knobs) {
          assert.ok(
            params[knob],
            `'${toggle}' governs '${knob}', which is not a parameter — it was renamed or removed`,
          )
        }
      }
    })

    test('ampCore lists real amp parameters', () => {
      // Spec-level, not per-amp: ampParams is one map shared by every amp, so
      // a stale ampCore entry is stale everywhere at once. Checking it only
      // where some amp's ampCC happens to still have a CC for that name would
      // miss the exact failure this test exists for — a knob renamed
      // consistently across every amp's ampCC, leaving ampCore pointing at
      // nothing anywhere, which makes every amp register as unmapped forever.
      for (const knob of spec.ampCore) {
        assert.ok(
          spec.ampParams[knob],
          `ampCore names '${knob}', which is not an amp parameter — it was renamed or removed, ` +
            `and every amp will be treated as unmapped forever until this is fixed`,
        )
      }
    })

    test('every CC is in valid MIDI range 0–127', () => {
      for (const cc of ccsInSpec(spec).keys()) {
        assert.ok(
          Number.isInteger(cc) && cc >= 0 && cc <= 127,
          `CC ${cc} outside 0–127 — sendCC() throws at runtime`,
        )
      }
    })

    test('every spec CC exists in the mapping file', () => {
      const xmlCcs = ccsFromXml(spec)
      const absent = [...ccsInSpec(spec).entries()]
        .filter(([cc]) => !xmlCcs.has(cc))
        .map(([cc, who]) => `CC ${cc} (${who.join(', ')})`)

      assert.deepEqual(
        absent,
        [],
        `${spec.app.mapping} omits these CCs — the app sends and the plugin ignores them`,
      )
    })

    test('amps have description, CC table, and selector value', () => {
      for (const amp of spec.amps) {
        assert.ok(spec.ampDescriptions[amp], `${amp} lacks a description — the system prompt falls short`)
        assert.ok(spec.ampCC[amp], `${amp} lacks a CC table — nothing gets sent for this amp`)
        assert.ok(
          spec.ampSelect.values[amp] !== undefined,
          `${amp} lacks a selector value — continuous switching cannot reach it`,
        )
      }
    })

    test('selector keys name real amps', () => {
      for (const key of Object.keys(spec.ampSelect.values)) {
        assert.ok(
          spec.amps.includes(key),
          `'${key}' is in the selector but not in amps — it will never actually switch`,
        )
      }
    })

    test('ampCC keys name real ampParams', () => {
      for (const [amp, ccs] of Object.entries(spec.ampCC)) {
        for (const name of Object.keys(ccs)) {
          assert.ok(
            name in spec.ampParams,
            `${amp}.${name} has a CC but is not an ampParam — it will never be sent`,
          )
        }
      }
    })

    test('at least one amp is mapped', () => {
      const mapped = spec.amps.filter((amp) => {
        const ccs = spec.ampCC[amp] ?? {}
        return spec.ampCore.every((k) => ccs[k] !== undefined)
      })
      assert.ok(mapped.length > 0, 'no amp fulfills ampCore — every scene would show "no mapped knobs"')
    })

    test('every select param has non-empty options', () => {
      const all = { ...spec.ampParams, ...spec.params }
      for (const [name, p] of Object.entries(all)) {
        if (p.type !== 'select') continue
        assert.ok(
          p.options && Object.keys(p.options).length > 0,
          `select '${name}' has no options — zod would build an empty enum`,
        )
      }
    })

    test('Windows app and mapping metadata are populated', () => {
      assert.ok(
        spec.app.candidates.win32 && spec.app.candidates.win32.length > 0,
        'no Windows candidates — localisation() never finds the app',
      )
      assert.ok(
        spec.app.process.endsWith('.exe'),
        'process must end with .exe',
      )
      assert.ok(
        spec.app.mapping.endsWith('.xml'),
        'mapping must end with .xml',
      )
    })

    test('prompt pair exists (en.md and pt.md)', () => {
      const base = spec.doc.replace(/\.md$/, '')
      const promptsDir = new URL('../../prompts/plugins/', import.meta.url)

      assert.ok(
        fs.existsSync(new URL(`${base}.en.md`, promptsDir)),
        `prompts/plugins/${base}.en.md is missing — loadSystemPrompt() fails for English`,
      )
      assert.ok(
        fs.existsSync(new URL(`${base}.pt.md`, promptsDir)),
        `prompts/plugins/${base}.pt.md is missing — loadSystemPrompt() fails for Portuguese`,
      )
    })
  })
}

test('every plugin id in the catalog is unique', () => {
  const seen = new Map<string, number>()
  for (const spec of CATALOG) seen.set(spec.id, (seen.get(spec.id) ?? 0) + 1)
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1)
  assert.deepEqual(
    duplicates.map(([id, count]) => `'${id}' registered ${count} times`),
    [],
    'two plugins share an id — the second shadows the first in any id lookup',
  )
})

