/**
 * Owns the chat workflow and its persistence, in the main process.
 *
 * The heavy lifting — the provider protocol, tool use, catalog selection, and
 * history resumption — is `RigChat` in core; this module is the host-side
 * wrapper that turns a stream of `send` calls into a persisted conversation,
 * per `opentimbre-core-boundary` (main calls into core, never the reverse).
 *
 * The first `send` lazily creates a provider session and a conversation; every
 * following turn in the same conversation is an adjustment. Each successful or
 * error turn is persisted in one transaction via the repository, so a crash
 * never leaves a half-written turn. A storage failure is swallowed on purpose:
 * the in-memory conversation stays usable and the turn still returns (the
 * message is the feature, not the disk). Deleting the open conversation clears
 * the active chat and the loaded rig.
 *
 * Provider choice is injected as a factory so tests hand in a fake and `main.ts`
 * supplies the real clients — the controller never builds a provider or reads a
 * key. Status phases surface as `chat:status` push events through the injected
 * `send`, which never sees a raw `event`/sender.
 */
import { createRigChat, type RigChat, type RigChatProvider, type RigChatSnapshot } from '@opentimbre/core/src/chat/rig-chat.ts'
import { TurnError, type TurnFailureKind } from '@opentimbre/core/src/providers/tool-use.ts'
import type { AppliedScene, ChatStatus, Guitar, MessageWithCards, OpenConversation, ProviderId, Result, Rig, SentTurn, Summary } from '@opentimbre/contracts'
import { createI18n, type Locale, type LocaleKey } from '@opentimbre/i18n'
import type { SceneApplier } from '../rig/scene-applier.ts'
import type { ConversationRepository } from './conversation-repository.ts'

export type ChatClock = () => string
export type ChatIdGen = () => string

export type ChatControllerOptions = {
  repo: ConversationRepository
  /** Provider set, read lazily so main can defer wiring until a key exists. */
  getProviders: () => readonly RigChatProvider[]
  getGuitar: () => Guitar
  getLocale: () => Locale
  /** When true and the model returns a single-scene rig, apply it at once. */
  autoApply?: () => boolean
  applier: SceneApplier
  send: (channel: string, payload: unknown) => void
  clock?: ChatClock
  idGen?: ChatIdGen
}

export type ChatController = {
  send(text: string): Promise<Result<SentTurn>>
  newChat(): Promise<Result<void>>
  list(): Promise<Result<Summary[]>>
  open(id: string): Promise<Result<OpenConversation>>
  delete(id: string): Promise<Result<Summary[]>>
}

/** The conversation title is the first request, so it fits one list row. */
const TITLE_MAX = 60

/**
 * Maps a provider failure kind to the catalog key the guitarist sees. The
 * `Record` is exhaustive over `TurnFailureKind`, so a new kind is a compile
 * error until it gets a message; a non-`TurnError` failure falls back to
 * `chat.error.send`. The raw API text never reaches the UI — only these
 * friendly, localized lines.
 */
const FAILURE_KEY: Record<TurnFailureKind, LocaleKey> = {
  auth: 'chat.error.auth',
  'no-access': 'chat.error.noAccess',
  'model-unavailable': 'chat.error.modelUnavailable',
  connection: 'chat.error.connection',
  rate: 'chat.error.rate',
  truncated: 'chat.error.truncated',
  blocked: 'chat.error.blocked',
  validation: 'chat.error.validation',
  other: 'chat.error.send',
}

type Active = {
  id: string
  title: string
  messages: MessageWithCards[]
  chat: RigChat
}

const isoNow = () => new Date().toISOString()
const randomId = () => crypto.randomUUID()

function lastPlugin(messages: MessageWithCards[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].rig) return messages[i].rig!.plugin
  }
  return null
}

function lastRig(messages: MessageWithCards[]): Rig | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const messageRig = messages[i].rig
    if (messageRig) return messageRig
  }
  return null
}

export function createChatController(options: ChatControllerOptions): ChatController {
  const { repo, getProviders, getGuitar, getLocale, applier, send } = options
  const clock = options.clock ?? isoNow
  const idGen = options.idGen ?? randomId

  let active: Active | null = null

  const tr = (key: LocaleKey, params?: Record<string, string>) =>
    createI18n(getLocale()).t(key, params)

  const emit = (status: ChatStatus): void => send('chat:status', status)

  /** Writes the active conversation; a storage failure must not kill the turn. */
  function persist(a: Active, snapshot: RigChatSnapshot): void {
    try {
      repo.save({
        id: a.id,
        title: a.title,
        plugin: lastPlugin(a.messages),
        provider: snapshot.provider,
        model: snapshot.model,
        history: snapshot.history,
        updatedAt: clock(),
        messages: a.messages,
      })
    } catch {
      // Disk failed — the in-memory conversation stays usable; the turn returns.
    }
  }

  async function sendTurn(text: string): Promise<Result<SentTurn>> {
    const providers = getProviders()
    if (providers.length === 0) return { error: tr('chat.error.noProvider') }

    if (!active) {
      active = {
        id: idGen(),
        title: text.slice(0, TITLE_MAX),
        messages: [],
        chat: createRigChat({ providers, locale: getLocale(), guitar: getGuitar(), onPhase: emit }),
      }
    }
    const a = active

    try {
      const turn = await a.chat.send(text)
      emit(null)
      a.messages.push({ role: 'user', text })
      a.messages.push(
        turn.rig
          ? { role: 'ai', text: turn.text, rig: turn.rig, cards: turn.cards ?? undefined }
          : { role: 'ai', text: turn.text },
      )
      persist(a, a.chat.export())

      // `active` may have moved on to a different conversation while this
      // await was in flight (the guitarist switched conversations without
      // waiting) — the shared applier and its "loaded rig" must stay with
      // whichever conversation is actually open now, not this finished one.
      let autoApplied: AppliedScene | null = null
      if (active === a) {
        applier.setRig(turn.rig)
        // Auto-apply: when enabled and the model returned exactly one scene, the
        // guitarist asked for that tone alone, so load it without a button click.
        if (turn.rig && options.autoApply?.() && Object.keys(turn.rig.scenes).length === 1) {
          const result = await applier.apply(Object.keys(turn.rig.scenes)[0]!)
          if (!('error' in result)) autoApplied = result
        }
      }
      return { ...turn, conversationId: a.id, autoApplied }
    } catch (err) {
      // A `TurnError` already carries a provider-key fragment risk in its
      // message, so log only its kind; the SDK error stayed attached as its
      // `cause`. Anything else is unexpected and worth the full stack.
      console.error('[chat] send failed:', err instanceof TurnError ? err.kind : err)
      emit(null)
      const key = err instanceof TurnError ? FAILURE_KEY[err.kind] : 'chat.error.send'
      const message = tr(key)
      a.messages.push({ role: 'error', text: message })
      persist(a, a.chat.export())
      return { error: message }
    }
  }

  return {
    async send(text) {
      try {
        return await sendTurn(text)
      } catch (err) {
        console.error('[chat] unexpected send failure:', err)
        return { error: tr('error.generic') }
      }
    },

    async newChat() {
      active = null
      applier.setRig(null)
      return undefined
    },

    async list() {
      try {
        return repo.list()
      } catch {
        return { error: tr('error.generic') }
      }
    },

    async open(id) {
      try {
        const record = repo.get(id)
        if (!record) return { error: tr('conversation.error.notFound') }
        const providers = getProviders()
        if (providers.length === 0) return { error: tr('chat.error.noProvider') }

        const chat = createRigChat({
          providers,
          locale: getLocale(),
          guitar: getGuitar(),
          resume: { provider: record.provider as ProviderId, model: record.model, history: record.history },
          onPhase: emit,
        })
        active = { id: record.id, title: record.title, messages: record.messages, chat }
        applier.setRig(lastRig(record.messages))
        return {
          id: record.id,
          title: record.title,
          messages: record.messages,
          plugin: record.plugin,
          memoryLost: chat.memoryLost,
        }
      } catch {
        return { error: tr('error.generic') }
      }
    },

    async delete(id) {
      try {
        repo.remove(id)
        if (active && active.id === id) {
          active = null
          applier.setRig(null)
        }
        return repo.list()
      } catch {
        return { error: tr('error.generic') }
      }
    },
  }
}