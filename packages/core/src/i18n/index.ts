/**
 * OpenTimbre's message catalog resolver — the one place every surface (CLI,
 * Electron main, Angular renderer) reads user-facing strings from, per
 * `opentimbre-i18n`. Framework-agnostic: no Electron, no Angular, so the CLI
 * and the renderer share one implementation instead of drifting.
 *
 * `en.json`/`pt.json` are read from disk with `node:fs` rather than a
 * TypeScript JSON module import — that would need `resolveJsonModule` turned
 * on project-wide, a config change outside this task's scope for a
 * two-package-file feature.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { LocaleKey } from '@opentimbre/contracts'

export type Locale = 'en' | 'pt'

const here = fileURLToPath(new URL('.', import.meta.url))
const catalogs: Record<Locale, Partial<Record<LocaleKey, string>>> = {
  en: loadCatalog('en.json'),
  pt: loadCatalog('pt.json'),
}

function loadCatalog(file: string): Partial<Record<LocaleKey, string>> {
  return JSON.parse(readFileSync(new URL(file, `file://${here}`), 'utf8')) as Partial<
    Record<LocaleKey, string>
  >
}

// Module-level active locale. `t()`'s contract signature carries no locale
// argument (later tasks depend on that exact shape), so something has to
// hold "which locale is active" between resolveLocale() running once at
// startup and every later t() call — this is that state.
let activeLocale: Locale = 'en'

export function setLocale(locale: Locale): void {
  activeLocale = locale
}

export function t(key: LocaleKey, params?: Record<string, string>): string {
  const template = catalogs[activeLocale][key] ?? catalogs.en[key]
  // A key absent from BOTH catalogs is a bug in the catalog, not a display
  // value — per opentimbre-i18n, fallback never degrades to the raw key.
  if (template === undefined) {
    throw new Error(`Missing i18n key in both catalogs: '${key}'`)
  }
  return interpolate(template, params)
}

function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match,
  )
}

/**
 * Runs once at startup per `opentimbre-i18n`: an explicit stored setting
 * always wins; otherwise the OS locale seeds the guess; anything neither
 * 'en' nor 'pt' falls back to English. Callers persist the result themselves
 * — this function never writes the setting, only decides it.
 */
export function resolveLocale(stored: string | null, osLocale: string): Locale {
  if (stored === 'en' || stored === 'pt') return stored
  const language = osLocale.split('-')[0]?.toLowerCase()
  if (language === 'en' || language === 'pt') return language
  return 'en'
}
