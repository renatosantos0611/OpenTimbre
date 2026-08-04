/**
 * Owns the AI-provider API-key secret: nobody else reads or writes the store,
 * and the key in the clear only ever leaves this module into `process.env`,
 * where the provider SDKs look for it. Ported from legacy's `chaves.ts`; see
 * `opentimbre-secrets` for the rules this module exists to satisfy.
 *
 * **Why SQLite, not a JSON file.** Other config files are inspectable on
 * purpose — a guitarist opens them in a text editor and understands. An API
 * key is the opposite: it should not be readable, nor survive a half-written
 * file (an interrupted write leaves a truncated key whose failure only
 * surfaces on the next API call). A SQLite transaction removes both failure
 * modes, and the row is a natural place for what a key carries with it: when
 * it changed, whether it is encrypted, which hint to show.
 *
 * **Why encryption comes from outside.** Only the host can encrypt (Electron
 * `safeStorage`), and the core cannot import Electron — so the host injects a
 * `Vault` via `configure()`. Without one (the CLI, the tests), the key is
 * stored in plaintext and the row is marked unprotected, so the UI can warn
 * instead of claiming the key is secure.
 *
 * Deviations from legacy, both local judgment calls within this task's scope:
 * - No default on-disk path. Legacy resolves one lazily via its `config-store`
 *   module (not ported yet); wiring a real desktop path is the later Electron
 *   phase mentioned in the plan. Absent an explicit `configure({ file })`,
 *   this module defaults to `:memory:` — safe by construction, since nothing
 *   is ever written to disk by accident.
 * - `configure()` always resets the connection and the captured environment
 *   snapshot when `file` is passed, even if it equals the current one; legacy
 *   only resets on an actual change (an optimization against reopening the
 *   same production file). Reusing a live in-memory connection across
 *   `configure({ file: ':memory:' })` calls would leak state between tests,
 *   which is exactly what the plan asks this module to avoid.
 * - `knownProviders()`/`Provider` don't exist yet in the new core (a later
 *   task ports the provider modules), so this file carries its own minimal
 *   `id`/`label`/`env` catalog rather than importing one.
 */
import { DatabaseSync } from 'node:sqlite'
import type { KeyInfo, ProviderId } from '@opentimbre/contracts'
import type { Vault } from '../ports/vault.ts'

const KNOWN_PROVIDERS: { id: ProviderId; label: string; env: string }[] = [
  { id: 'anthropic', label: 'Anthropic', env: 'ANTHROPIC_API_KEY' },
  { id: 'openai', label: 'OpenAI', env: 'OPENAI_API_KEY' },
]

const TABLE = `
  CREATE TABLE IF NOT EXISTS keys (
    provider      TEXT PRIMARY KEY,
    secret        BLOB    NOT NULL,
    protected     INTEGER NOT NULL,
    hint          TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  ) STRICT
`

type Row = {
  provider: string
  secret: Uint8Array
  protected: number
  hint: string
  updated_at: string
}

let db: DatabaseSync | null = null
let file: string | null = null
let vault: Vault | null = null

/**
 * The `.env` as it stood before any app key entered the picture. This is what
 * makes `remove()` possible: without this snapshot, deleting the stored row
 * would leave in `process.env` whatever the app key had overwritten, and the
 * app would keep using the old key with nobody able to explain why.
 */
let originalEnv: Record<string, string | undefined> | null = null

/**
 * Called once by the host at startup: the db file (tests use `:memory:`) and
 * the vault. Passing only one of the two leaves the other as it was.
 */
export function configure(opts: { file?: string; vault?: Vault | null }): void {
  if (opts.file !== undefined) {
    db?.close()
    db = null
    file = opts.file
    originalEnv = null
  }
  if (opts.vault !== undefined) vault = opts.vault
}

function connection(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(file ?? ':memory:')
    db.exec(TABLE)
  }
  return db
}

/** Captures the original environment the first time anyone needs it. */
function captureEnvironment(): Record<string, string | undefined> {
  originalEnv ??= Object.fromEntries(KNOWN_PROVIDERS.map((p) => [p.env, process.env[p.env]]))
  return originalEnv
}

function rows(): Map<ProviderId, Row> {
  const all = connection().prepare('SELECT * FROM keys').all() as unknown as Row[]
  return new Map(all.map((r) => [r.provider as ProviderId, r]))
}

function revealRow(row: Row): string | null {
  if (!row.protected) return Buffer.from(row.secret).toString('utf8')
  if (!vault) return null
  try {
    return vault.reveal(row.secret)
  } catch {
    // Encrypted under a different OS account, or a database copied from
    // another machine. Not an application error — a lost key.
    return null
  }
}

/**
 * The first six characters identify the provider and account; the last four
 * are what the guitarist checks against the provider's dashboard. The middle
 * never leaves this module.
 */
function hintOf(key: string): string {
  return key.length <= 12 ? '•'.repeat(key.length) : `${key.slice(0, 6)}…${key.slice(-4)}`
}

export function list(): KeyInfo[] {
  const saved = rows()
  const original = captureEnvironment()

  return KNOWN_PROVIDERS.map((p) => {
    const row = saved.get(p.id)
    const readable = row ? revealRow(row) !== null : true
    const fromEnv = Boolean(original[p.env]?.trim())

    return {
      provider: p.id,
      label: p.label,
      env: p.env,
      source: row && readable ? 'app' : fromEnv ? 'environment' : 'none',
      hint: row?.hint ?? null,
      updatedAt: row?.updated_at ?? null,
      protected: Boolean(row?.protected),
      readable,
    }
  })
}

export function save(provider: ProviderId, key: string): void {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Empty key — paste the whole key before saving.')
  // Whitespace in the middle is almost always a half-pasted key, or one
  // pasted together with its `ANTHROPIC_API_KEY=` prefix. Rejecting here
  // saves a round trip to the provider.
  if (/\s/.test(trimmed)) throw new Error('Key has whitespace in the middle — paste only the key.')

  const isProtected = vault ? 1 : 0
  const secret = vault ? vault.protect(trimmed) : Buffer.from(trimmed, 'utf8')

  connection()
    .prepare(
      `INSERT INTO keys (provider, secret, protected, hint, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET
         secret = excluded.secret,
         protected = excluded.protected,
         hint = excluded.hint,
         updated_at = excluded.updated_at`,
    )
    .run(provider, secret, isProtected, hintOf(trimmed), new Date().toISOString())

  applyToEnvironment()
}

export function remove(provider: ProviderId): void {
  connection().prepare('DELETE FROM keys WHERE provider = ?').run(provider)
  applyToEnvironment()
}

/**
 * Puts the saved keys into `process.env`, where the provider SDKs look for
 * them.
 *
 * The app key **precedes** the `.env` one: whoever typed a key into the
 * window expects that key to win. Where no key is saved (or it doesn't open),
 * the original environment value returns — including its absence.
 */
export function applyToEnvironment(): void {
  const original = captureEnvironment()
  const saved = rows()

  for (const p of KNOWN_PROVIDERS) {
    const row = saved.get(p.id)
    const key = row ? revealRow(row) : null

    if (key) {
      process.env[p.env] = key
    } else if (original[p.env] === undefined) {
      delete process.env[p.env]
    } else {
      process.env[p.env] = original[p.env]
    }
  }
}
