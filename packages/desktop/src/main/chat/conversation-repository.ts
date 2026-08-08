/**
 * Persists conversations as normalized messages plus the opaque, versioned
 * provider history that `RigChat` needs to resume. The conversation row keeps
 * the provider/model pair so opening a conversation can decide whether the
 * saved history is compatible — if it isn't, the controller reports
 * `memoryLost` but still shows the readable messages.
 *
 * The provider history is stored as one JSON blob (`unknown`) and is never
 * inspected here: per `opentimbre-secrets`, it must not carry a plaintext API
 * key, and the repository treats it as opaque so nothing with a key can slip
 * into a log or a trace by walking its fields.
 *
 * `save` replaces the whole conversation state in one transaction, so a turn
 * is persisted atomically — a crash mid-write leaves the previous complete
 * turn, never a half one. The same connection is shared with `DesktopStore`
 * (via `store.connection`), so the conversation tables ride the same
 * `PRAGMA user_version` migration as the settings schema.
 */
import { DatabaseSync } from 'node:sqlite'
import type { MessageWithCards, Summary } from '@opentimbre/contracts'

export type ConversationRecord = {
  id: string
  title: string
  /** The last rig's plugin, or `null` if the conversation never produced one. */
  plugin: string | null
  provider: string
  model: string
  /** Opaque provider-native history, serialized as JSON. */
  history: unknown
  updatedAt: string
  messages: MessageWithCards[]
}

export type ConversationRepository = {
  save(record: ConversationRecord): void
  get(id: string): ConversationRecord | null
  list(): Summary[]
  remove(id: string): boolean
}

const SCHEMA_VERSION = 2

function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return
  db.exec('BEGIN')
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        plugin     TEXT,
        provider   TEXT NOT NULL,
        model      TEXT NOT NULL,
        history    TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        seq             INTEGER NOT NULL,
        role            TEXT NOT NULL,
        text            TEXT NOT NULL,
        rig             TEXT,
        cards           TEXT,
        PRIMARY KEY (conversation_id, seq)
      ) STRICT
    `)
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

type ConversationRow = {
  id: string
  title: string
  plugin: string | null
  provider: string
  model: string
  history: string
  updated_at: string
}

type MessageRow = { seq: number; role: string; text: string; rig: string | null; cards: string | null }

function parseMessage(row: MessageRow): MessageWithCards {
  const message: MessageWithCards = { role: row.role as MessageWithCards['role'], text: row.text }
  if (row.rig) message.rig = JSON.parse(row.rig)
  if (row.cards) message.cards = JSON.parse(row.cards)
  return message
}

export function createConversationRepository(db: DatabaseSync): ConversationRepository {
  migrate(db)

  return {
    save(record) {
      db.exec('BEGIN')
      try {
        db.prepare(
          `INSERT INTO conversations (id, title, plugin, provider, model, history, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title, plugin = excluded.plugin, provider = excluded.provider,
             model = excluded.model, history = excluded.history, updated_at = excluded.updated_at`,
        ).run(
          record.id, record.title, record.plugin, record.provider, record.model,
          JSON.stringify(record.history), record.updatedAt,
        )
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(record.id)
        const insert = db.prepare(
          'INSERT INTO messages (conversation_id, seq, role, text, rig, cards) VALUES (?, ?, ?, ?, ?, ?)',
        )
        record.messages.forEach((message, seq) => {
          insert.run(
            record.id, seq, message.role, message.text,
            message.rig ? JSON.stringify(message.rig) : null,
            message.cards ? JSON.stringify(message.cards) : null,
          )
        })
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },

    get(id) {
      const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConversationRow | undefined
      if (!row) return null
      const messages = db
        .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq')
        .all(id) as unknown as MessageRow[]
      return {
        id: row.id,
        title: row.title,
        plugin: row.plugin,
        provider: row.provider,
        model: row.model,
        history: JSON.parse(row.history),
        updatedAt: row.updated_at,
        messages: messages.map(parseMessage),
      }
    },

    list() {
      const rows = db
        .prepare(
          `SELECT c.id, c.title, c.updated_at AS updatedAt, COUNT(m.seq) AS turns
           FROM conversations c
           LEFT JOIN messages m ON m.conversation_id = c.id
           GROUP BY c.id
           ORDER BY c.updated_at DESC`,
        )
        .all() as unknown as Summary[]
      return rows
    },

    remove(id) {
      const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
      return result.changes > 0
    },
  }
}