import { DatabaseSync } from 'node:sqlite'

export const DEFAULTS: Record<string, string | number | boolean> = {
  guitar: 'stratocaster',
  model_id: '',
  provider_preference: 'auto',
  always_on_top: true,
  dim_on_unfocus: false,
  auto_apply: false,
  width: 420,
  height: 700,
}

type Row = { key: string; value: string | null }

export class DesktopStore {
  private db: DatabaseSync
  private file: string

  constructor(filePath: string) {
    this.file = filePath
    this.db = new DatabaseSync(filePath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      ) STRICT
    `)
    this.db.exec('PRAGMA user_version = 1')
  }

  /** Returns the schema migration version applied at startup. */
  migrationVersion(): number {
    const row = this.db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined
    return row?.user_version ?? 0
  }

  /** Reads a stored setting or returns the system default. */
  get(key: string): string {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined
    const val = row?.value ?? ''
    if (val !== '') return val
    const d = DEFAULTS[key]
    if (d !== undefined) return String(d)
    return ''
  }

  /** Reads a numeric setting or returns the default. */
  getNumber(key: string): number {
    const raw = this.get(key)
    if (!raw) return DEFAULTS[key] as number ?? 0
    return Number(raw)
  }

  /** Reads a boolean setting or returns the default. */
  getBool(key: string): boolean {
    const raw = this.get(key)
    if (raw === 'true') return true
    if (raw === 'false') return false
    // Not explicitly set — fall through to default
    return Boolean(DEFAULTS[key] ?? false)
  }

  /** Persists a string setting. */
  set(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  }

  /** Persists a numeric setting. */
  setNumber(key: string, value: number): void {
    this.set(key, String(value))
  }

  /** Persists a boolean setting. */
  setBool(key: string, value: boolean): void {
    this.set(key, value ? 'true' : 'false')
  }

  /** Exports all settings as a plain object merged with system defaults. */
  toJson(): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    // Start with all defaults
    for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
      result[key] = defaultVal
    }

    // Overwrite with persisted values
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Row[]
    for (const r of rows) {
      const k = r.key
      const defaultVal = DEFAULTS[k]
      if (defaultVal !== undefined) {
        result[k] =
          typeof defaultVal === 'boolean' ? (r.value === 'true' ? true : r.value === 'false' ? false : defaultVal) :
          typeof defaultVal === 'number' ? (r.value !== null && r.value !== '' ? Number(r.value) : defaultVal) :
          r.value ?? defaultVal
      } else {
        result[k] = r.value ?? ''
      }
    }
    return result
  }
  /** Closes the database connection. Call before replacing the store. */
  close(): void {
    this.db.close()
  }
}

let instance: DesktopStore | null = null

/** Creates and caches the singleton store for a given database path. */
export function initStore(path: string): DesktopStore {
  instance?.close()
  instance = new DesktopStore(path)
  return instance
}

/** Returns the initialized store. Used by handlers that expect setup first. */
export function getStore(): DesktopStore {
  if (!instance) throw new Error('DesktopStore not initialized — call initStore before accessing handlers')
  return instance
}
