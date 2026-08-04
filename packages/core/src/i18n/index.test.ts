/**
 * Behavior tests for the i18n resolver: t()'s catalog/fallback/interpolation
 * contract and resolveLocale()'s precedence (explicit > OS > English).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveLocale, setLocale, t } from './index.ts'

test('t() returns the en.json value for a known key', () => {
  setLocale('en')
  assert.equal(t('error.generic'), 'Something went wrong.')
})

test('t() falls back to en.json when the key is missing from pt.json', () => {
  // 'plugin.notMapped' is deliberately absent from pt.json (see pt.json) so
  // this test proves the fallback rather than accidentally passing because
  // the key exists in both files.
  setLocale('pt')
  assert.equal(t('plugin.notMapped', { amp: 'RUST', fallback: 'CLN' }), "the RUST amp isn't mapped yet — applying to CLN")
  setLocale('en')
})

test('t() interpolates {param} placeholders', () => {
  setLocale('en')
  // Different substitution values than the fallback test above, so this
  // exercises interpolation independently rather than duplicating it.
  assert.equal(
    t('plugin.notMapped', { amp: 'HOT', fallback: 'RUST' }),
    "the HOT amp isn't mapped yet — applying to RUST",
  )
})

test("resolveLocale(null, 'pt-BR') -> 'pt'", () => {
  assert.equal(resolveLocale(null, 'pt-BR'), 'pt')
})

test("resolveLocale('en', 'pt-BR') -> 'en' (explicit setting wins over OS locale)", () => {
  assert.equal(resolveLocale('en', 'pt-BR'), 'en')
})

test("resolveLocale(null, 'fr-FR') -> 'en' (unresolvable OS locale falls back to English)", () => {
  assert.equal(resolveLocale(null, 'fr-FR'), 'en')
})

test('t() throws, never returns the raw key, when a key is missing from both catalogs', () => {
  setLocale('en')
  // @ts-expect-error deliberately invalid key to exercise the both-missing path
  assert.throws(() => t('does.not.exist'), /Missing i18n key/)
})
