/**
 * Core compatibility facade for the shared browser-safe catalog. Startup
 * locale resolution remains here because it reads process inputs; catalog
 * storage and translation live in `@opentimbre/i18n`.
 */
import { createI18n } from '@opentimbre/i18n'
import type { Locale, LocaleKey } from '@opentimbre/i18n'

export type { Locale, LocaleKey } from '@opentimbre/i18n'

const shared = createI18n()

export function setLocale(locale: Locale): void {
  shared.setLocale(locale)
}

export function t(key: LocaleKey, params?: Record<string, string>): string {
  return shared.t(key, params)
}

/** Runs once at startup: stored locale wins, then the OS locale, then English. */
export function resolveLocale(stored: string | null, osLocale: string): Locale {
  if (stored === 'en' || stored === 'pt') return stored
  const language = osLocale.split('-')[0]?.toLowerCase()
  return language === 'en' || language === 'pt' ? language : 'en'
}
