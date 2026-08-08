/**
 * Traço das conversas com a IA — visão de desenvolvedor.
 *
 * Mostra exatamente o que sai e o que volta: system prompt, mensagens, schema
 * da tool, resposta bruta, tokens, latência e o resultado da validação. É
 * compartilhado pelos dois provedores; o que muda entre eles (nome dos campos
 * de uso, formato da resposta) é normalizado por quem chama, não aqui.
 *
 * Modos (`AI_TRACE` no .env ou `trace <modo>` no REPL):
 *   off   nada (default)
 *   on    prompts, mensagens, objeto retornado, tokens, validação
 *   full  o mesmo + o JSON Schema inteiro da tool e a resposta crua da API
 *
 * Independente do modo, com o trace ligado cada evento também vai para
 * `logs/ai-trace.jsonl` — o terminal rola, o arquivo não.
 */

import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

export const TRACE_MODES = ['off', 'on', 'full'] as const
export type TraceMode = (typeof TRACE_MODES)[number]

export const LOG_FILE = path.resolve(process.cwd(), 'logs', 'ai-trace.jsonl')

function parseMode(value: string | undefined): TraceMode | null {
  const v = (value ?? '').trim().toLowerCase()
  return (TRACE_MODES as readonly string[]).includes(v) ? (v as TraceMode) : null
}

let mode: TraceMode = parseMode(process.env.AI_TRACE) ?? 'off'

export function getTraceMode(): TraceMode {
  return mode
}

export function setTraceMode(value: string): TraceMode {
  const next = parseMode(value)
  if (!next) {
    throw new Error(`Modo de trace inválido: '${value}'. Use ${TRACE_MODES.join(' | ')}.`)
  }
  mode = next
  return mode
}

// ------------------------------------------------------------------ formatação

const bar = chalk.magenta('│ ')

function block(title: string, lines: string[]): void {
  console.log(chalk.magenta(`┌─ ${title}`))
  for (const line of lines) {
    for (const l of line.split('\n')) console.log(bar + l)
  }
  console.log(chalk.magenta('└─'))
}

function json(value: unknown): string {
  return chalk.dim(JSON.stringify(value, null, 2))
}

function size(text: string): string {
  return `${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB`
}

const num = (n: number) => n.toLocaleString('pt-BR')

// --------------------------------------------------------------------- log

let logWarned = false

function append(record: Record<string, unknown>): void {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.appendFileSync(LOG_FILE, `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`)
  } catch (err) {
    // Log é conveniência: se o disco recusar, o terminal continua servindo.
    if (!logWarned) {
      logWarned = true
      console.log(chalk.yellow(`  ! não deu para gravar ${LOG_FILE}: ${String(err)}`))
    }
  }
}

// -------------------------------------------------------------------- API

export type Operation = 'rig' | 'ajuste' | 'chat'

export type Usage = { input?: number; output?: number }

// ------------------------------------------------------------- assinantes

/**
 * Fases de uma chamada, para quem quiser mostrar progresso. A janela desktop
 * usa isto para a pílula de status ("Consultando a IA…", "Corrigindo…").
 *
 * Independente do `AI_TRACE`: o trace é uma ferramenta de desenvolvedor e vive
 * desligado, mas o guitarrista precisa ver que alguma coisa está acontecendo.
 */
export type TraceEvent = {
  kind: 'request' | 'response' | 'output' | 'validation' | 'retry'
  operation: Operation
  attempt: number
  ok?: boolean
}

export type Listener = (e: TraceEvent) => void

const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit(e: TraceEvent): void {
  for (const fn of listeners) {
    try {
      fn(e)
    } catch {
      // Um assinante quebrado não pode derrubar a chamada de IA em andamento.
    }
  }
}

export type CallInfo = {
  provider: string
  model: string
  operation: Operation
  /** 1 na primeira ida, 2 na retentativa depois de um erro de validação. */
  attempt: number
  system: string
  /** Mensagens exatamente como vão no corpo da requisição. */
  messages: unknown
  tool: { name: string; description: string; schema: Record<string, unknown> }
}

export type TraceCall = {
  /** Resposta crua da API, logo que chega — antes de extrair o bloco de tool. */
  response(raw: unknown, meta?: { usage?: Usage; stopReason?: string | null }): void
  /** O objeto que o modelo devolveu na tool, já extraído mas ainda não validado. */
  output(input: unknown): void
  validation(ok: boolean, issues?: { path: PropertyKey[]; message: string }[]): void
  /** Texto do tool_result mandado de volta ao modelo na retentativa. */
  retry(text: string): void
}

let seq = 0

/** Notifica os assinantes de uma fase desta chamada. */
function notifier(info: CallInfo) {
  return (kind: TraceEvent['kind'], ok?: boolean) =>
    emit({ kind, operation: info.operation, attempt: info.attempt, ok })
}

/** Com o trace desligado só os assinantes são avisados — nada vai para o terminal. */
function quiet(info: CallInfo): TraceCall {
  const at = notifier(info)
  at('request')
  return {
    response() {
      at('response')
    },
    output() {
      at('output')
    },
    validation(ok) {
      at('validation', ok)
    },
    retry() {
      at('retry')
    },
  }
}

/**
 * Abre o traço de uma chamada. Imprime a requisição **antes** do await, para o
 * que foi enviado aparecer mesmo se a API travar ou devolver erro.
 */
export function begin(info: CallInfo): TraceCall {
  if (mode === 'off') return quiet(info)

  const at = notifier(info)
  const id = `${Date.now().toString(36)}-${++seq}`
  const started = performance.now()
  const schemaText = JSON.stringify(info.tool.schema)

  append({ id, kind: 'request', ...info })
  at('request')

  const head =
    `IA → ${info.provider} / ${info.model}   ` +
    chalk.dim(`(${info.operation}, tentativa ${info.attempt})`)

  const lines = [
    chalk.bold(`system prompt (${size(info.system)})`),
    chalk.dim(info.system),
    '',
    chalk.bold('mensagens'),
    json(info.messages),
    '',
    chalk.bold(`tool: ${info.tool.name}`) + chalk.dim(`  — schema ${size(schemaText)}`),
    chalk.dim(info.tool.description),
  ]
  if (mode === 'full') lines.push(json(info.tool.schema))

  block(head, lines)

  return {
    response(raw, meta) {
      const ms = performance.now() - started
      append({ id, kind: 'response', ms, raw, usage: meta?.usage, stopReason: meta?.stopReason })
      at('response')

      const tokens = meta?.usage
        ? `tokens ${num(meta.usage.input ?? 0)} in / ${num(meta.usage.output ?? 0)} out`
        : 'tokens n/d'
      const parts = [`${(ms / 1000).toFixed(2)}s`, `stop=${meta?.stopReason ?? 'n/d'}`, tokens]

      const lines = [chalk.dim(parts.join('  ·  '))]
      if (mode === 'full') lines.push(chalk.bold('resposta crua'), json(raw))
      block(`IA ← ${info.provider}`, lines)
    },

    output(input) {
      append({ id, kind: 'output', input })
      at('output')
      block(`tool ${info.tool.name} ← modelo`, [json(input)])
    },

    validation(ok, issues) {
      append({ id, kind: 'validation', ok, issues })
      at('validation', ok)
      if (ok) {
        console.log(chalk.green('  ✓ validação zod: OK'))
        return
      }
      console.log(chalk.red('  ✗ validação zod falhou:'))
      for (const i of issues ?? []) {
        console.log(chalk.red(`      ${i.path.join('.') || '(raiz)'}: ${i.message}`))
      }
    },

    retry(text) {
      append({ id, kind: 'retry', text })
      at('retry')
      block(chalk.yellow('retentativa → devolvendo ao modelo'), [chalk.dim(text)])
    },
  }
}
