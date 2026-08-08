/**
 * Browser-safe runtime message catalog shared by core, CLI, Electron main,
 * and the Angular renderer. Catalog data stays private behind this small API.
 */
import en from './en.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }

export type Locale = 'en' | 'pt'
export type Catalog = Record<string, string>
export type CatalogPair = { en: Catalog; pt: Catalog }
export type LocaleKey = keyof typeof en
export type I18n<Keys extends string = LocaleKey> = {
  readonly t: (key: Keys, params?: Record<string, string>) => string
  readonly locale: () => Locale
  readonly setLocale: (locale: Locale) => void
  readonly keys: () => { en: string[]; pt: string[] }
}

const defaultCatalogs: CatalogPair = { en, pt }

export function createI18n<Keys extends string = LocaleKey>(
  initialLocale: Locale = 'en',
  catalogs: CatalogPair = defaultCatalogs,
): I18n<Keys> {
  let activeLocale = initialLocale

  return {
    t(key, params) {
      const template = catalogs[activeLocale][key] ?? catalogs.en[key]
      if (template === undefined) {
        throw new Error(`Missing i18n key in both catalogs: '${key}'`)
      }
      return interpolate(template, params)
    },
    locale: () => activeLocale,
    setLocale: (locale) => {
      activeLocale = locale
    },
    keys: () => ({
      en: Object.keys(catalogs.en).sort(),
      pt: Object.keys(catalogs.pt).sort(),
    }),
  }
}

function interpolate(template: string, params?: Record<string, string>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match,
  )
}
