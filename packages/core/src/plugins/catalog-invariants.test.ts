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
 *
 * Legacy also checked a third invariant: that the MIDI-mapping XML the app
 * installs into the plugin actually declares every CC the spec can send.
 * Not ported here — it needs to read `midi-mapping/*.xml` off disk, and
 * neither plugin data nor those XML files exist yet (both are later tasks;
 * `CATALOG` is intentionally empty in this one). Deferred rather than faked
 * against a placeholder file.
 *
 * `CATALOG` is empty in this task, so the per-plugin `describe` block below
 * never instantiates and none of these assertions run yet — a later task's
 * plugin registrations are what actually exercise them.
 */
import assert from 'node:assert/strict'
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
