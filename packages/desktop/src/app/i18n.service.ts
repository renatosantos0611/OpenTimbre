/**
 * Owns the renderer's locale and exposes the message catalog as a signal-backed
 * `t()` so a locale change re-renders without a page reload. Wraps
 * `@opentimbre/i18n`'s `createI18n`; that package is the single source of
 * truth shared by the CLI, the main process, and this renderer
 * (see `opentimbre-i18n`).
 *
 * The catalog instance's internal locale is kept in step with the public
 * signal; `t()` reads the signal first so Angular tracks the dependency and
 * re-runs templates that call it when the locale changes.
 */
import { Injectable, signal } from '@angular/core'
import type { Locale } from '@opentimbre/i18n'
import { createI18n } from '@opentimbre/i18n'
import type { LocaleKey } from '@opentimbre/contracts'

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly i18n = createI18n<LocaleKey>('en')

  /** The active locale, initially 'en' until the shell load applies AppState. */
  readonly locale = signal<Locale>(this.i18n.locale())

  /** Resolves a catalog key for the active locale, re-rendering on change. */
  t(key: LocaleKey, params?: Record<string, string>): string {
    this.locale()
    return this.i18n.t(key, params)
  }

  /** Switches the catalog and the public signal together. */
  setLocale(locale: Locale): void {
    this.i18n.setLocale(locale)
    this.locale.set(locale)
  }
}