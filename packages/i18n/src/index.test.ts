import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createI18n } from './index.ts'

const catalogs = {
  en: {
    greeting: 'Hello, {name}!',
    onlyEnglish: 'English fallback',
  },
  pt: {
    greeting: 'Ola, {name}!',
  },
} as const

test('createI18n translates and interpolates in the selected locale', () => {
  const i18n = createI18n<'greeting' | 'onlyEnglish'>('pt', catalogs)

  assert.equal(i18n.t('greeting', { name: 'Ana' }), 'Ola, Ana!')
})

test('createI18n falls back to English when the selected catalog lacks a key', () => {
  const i18n = createI18n<'greeting' | 'onlyEnglish'>('pt', catalogs)

  assert.equal(i18n.t('onlyEnglish'), 'English fallback')
})

test('createI18n mutates locale without exposing the catalogs', () => {
  const i18n = createI18n<'greeting' | 'onlyEnglish'>('en', catalogs)

  i18n.setLocale('pt')

  assert.equal(i18n.locale(), 'pt')
  assert.equal(i18n.t('greeting', { name: 'Joao' }), 'Ola, Joao!')
  assert.equal('catalogs' in i18n, false)
})

test('English and Portuguese catalogs have exactly the same keys', () => {
  const i18n = createI18n('en')
  const keys = i18n.keys()

  assert.deepEqual(keys.en, keys.pt)
  assert.ok(keys.en.length > 0)
})
