/**
 * The tool-use protocol, one copy shared by every provider.
 *
 * The app's provider-facing operations always do the same dance: send the
 * turn, find the tool call **by type, never by position**, validate it, and
 * if validation complains, hand the issues back to the model exactly once, in
 * whatever shape that API demands. Ported from legacy's `providers/tool-use.ts`
 * — that file's own header explains why the dance had to move here: it used
 * to be written once per provider per operation, and that duplication is
 * exactly how a history-rollback fix landed in one call site and not the
 * other two (`padroes.md` §1, read via `git show` since the file is
 * deleted-but-uncommitted in `legacy/`'s working tree).
 *
 * What's left for a provider (`anthropic.ts`, `openai.ts`) is only what's
 * actually theirs: how to talk to that API, and how that API's own history
 * format works — the `Session` type below. Four methods, none of which knows
 * what a rig is.
 *
 * Consequence worth citing: `execute` is testable with a fake `Session`, no
 * network and no key. `tool-use.test.ts` does exactly that.
 */

/** Two attempts at most: one retry is a patch, two is the model not knowing. */
const MAX_ATTEMPTS = 2

/** The call phase, for a host that wants to surface a status pill. */
export type Phase = 'querying' | 'validating' | 'correcting'

export type Issue = { readonly path: PropertyKey[]; readonly message: string }

/**
 * Why a turn failed, coarse enough for the host to pick a localized message
 * without parsing SDK internals. The providers raise these; `execute` lets
 * them propagate after rolling the history back. The `message` is for logs —
 * the guitarist only ever sees the host's localization of `kind`.
 */
export type TurnFailureKind =
  | 'auth'
  | 'no-access'
  | 'model-unavailable'
  | 'connection'
  | 'rate'
  | 'truncated'
  | 'blocked'
  | 'validation'
  | 'other'

export class TurnError extends Error {
  readonly kind: TurnFailureKind

  constructor(kind: TurnFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'TurnError'
    this.kind = kind
  }
}

/** A tool call already normalized, whether it came from Anthropic or OpenAI. */
export type Call = {
  readonly id: string
  readonly name: string
  /** Already parsed — OpenAI hands back a JSON string; that's resolved in the adapter. */
  readonly args: unknown
}

export type Usage = { readonly input: number | undefined; readonly output: number | undefined }

export type Response = {
  readonly text: string
  /** `null` when the model answered in prose only. */
  readonly call: Call | null
  /** The raw API response, for a caller that wants to trace it. */
  readonly raw: unknown
  readonly usage: Usage
  readonly stopReason: string | null
}

export type ToolDef = {
  readonly name: string
  readonly description: string
  readonly schema: Record<string, unknown>
}

/**
 * What a provider needs to know how to do. Note what is deliberately **not**
 * here: attempts, validation, error messages. None of that is a decision
 * about how to talk to an API.
 */
export type Session = {
  readonly label: string
  /** Fixed for the session's life — both APIs send `system` outside the history. */
  model(): string
  /** Appends the user's turn to the history, in that API's native shape. */
  ask(text: string): void
  /** Sends the history and returns the response, already appended to it. */
  respond(tools: readonly ToolDef[], force: string | null): Promise<Response>
  /** Hands the validation error back to the model — each API needs its own shape. */
  correct(call: Call, feedback: string): void
  /** Closes a successful call, so the next turn doesn't start owing a reply. */
  confirm(call: Call, text: string): void
  mark(): number
  rollback(mark: number): void
  /** Raw history, for a caller that wants to see exactly what was sent. */
  history(): unknown
}

/**
 * What `execute` does with the model's call. `feedback` comes from the
 * caller because the right message depends on the operation — a patch that
 * turned invalid only after merging with the current scene needs to say
 * that, not "the rig didn't validate".
 */
export type Verdict<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: Issue[]; readonly feedback: string }

/**
 * Optional hook for a caller that wants developer-facing visibility into a
 * call (legacy's `trace.ts`, which needed `chalk` and wrote to `logs/` — out
 * of this task's scope; a no-op default keeps `execute`'s shape intact so a
 * later task can wire a real one in without touching this protocol again).
 */
export type Trace = {
  response(raw: unknown, meta: { usage: Usage; stopReason: string | null }): void
  output(args: unknown): void
  validation(ok: boolean, issues?: Issue[]): void
  retry(feedback: string): void
}

const NOOP_TRACE: Trace = {
  response() {},
  output() {},
  validation() {},
  retry() {},
}

export type Execution<T> = {
  readonly session: Session
  readonly request: string
  readonly tools: readonly ToolDef[]
  /** Name of the tool the model must call, or `null` to let it choose. */
  readonly force: string | null
  /** Text travels alongside because a chat turn can carry prose and a call together. */
  readonly validate: (call: Call, text: string) => Verdict<T>
  /**
   * Only a chat passes this. In a chat the model must be able to return a
   * question or decline a request outside scope; for every other operation,
   * not calling the tool is an error.
   */
  readonly onNoCall?: (text: string) => T
  readonly trace?: Trace
  /** Called as the call advances, so a host can show a status pill. */
  readonly onPhase?: (phase: Phase) => void
}

/** Formats the issues to hand back to the model on the retry. */
export function issuesToText(issues: readonly Issue[]): string {
  return (
    'The rig failed validation. Fix exactly these points and call the tool again:\n' +
    issues.map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
  )
}

export function issuesToError(issues: readonly Issue[]): TurnError {
  const detail = issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
  return new TurnError('validation', `The model's response failed validation twice:\n${detail}`)
}

/**
 * Returned to the model after a successful call. The app can't read the
 * plugin's state back, so the confirmation is only about delivery: the
 * tones were shown, but applying them is the guitarist's click.
 */
export const CONFIRMATION =
  'Tones shown to the guitarist. They apply one by clicking its title. ' +
  'If they ask for changes, call the tool again with the whole updated set of scenes.'

/**
 * Runs one full turn: ask, validate, and correct once if needed.
 *
 * If anything fails, the history returns exactly to where it stood before
 * this call. A half-finished turn — a question with no answer, a tool call
 * with no result — poisons every turn that follows it, and in a long
 * conversation that only shows up much later, as an API error nobody can
 * read.
 */
export async function execute<T>(exec: Execution<T>): Promise<T> {
  const { session, request, tools, force, validate, onNoCall } = exec
  const trace = exec.trace ?? NOOP_TRACE
  const onPhase = exec.onPhase

  const mark = session.mark()
  session.ask(request)

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      onPhase?.('querying')
      const response = await session.respond(tools, force)
      trace.response(response.raw, { usage: response.usage, stopReason: response.stopReason })

      if (!response.call) {
        if (onNoCall) return onNoCall(response.text)
        const toolName = force ?? tools.map((t) => t.name).join(' | ')
        throw new Error(
          `The model didn't call the tool '${toolName}' (stop=${response.stopReason ?? 'n/a'}).`,
        )
      }

      onPhase?.('validating')
      trace.output(response.call.args)
      const verdict = validate(response.call, response.text)
      trace.validation(verdict.ok, verdict.ok ? undefined : verdict.issues)

      if (verdict.ok) {
        session.confirm(response.call, CONFIRMATION)
        return verdict.value
      }

      if (attempt === MAX_ATTEMPTS) throw issuesToError(verdict.issues)

      trace.retry(verdict.feedback)
      onPhase?.('correcting')
      session.correct(response.call, verdict.feedback)
    }

    // Unreachable: the last attempt always returns or throws.
    throw new Error('Unexpected failure in tool-use execution.')
  } catch (err) {
    session.rollback(mark)
    throw err
  }
}
