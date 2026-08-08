/**
 * Provedor Anthropic.
 *
 * O que sobrou aqui depois que o protocolo foi para `tool-use.ts`: falar com a
 * Messages API e montar o histórico do jeito que ela exige. As duas coisas
 * particulares desta API estão em `criarSessao`:
 *
 * - O `system` viaja **fora** das mensagens, então retomar uma conversa antiga
 *   já usa o prompt atual — inclusive uma guitarra trocada no meio do caminho.
 * - Depois de um `tool_use` a API exige um `tool_result` com o mesmo id; não dá
 *   para responder com texto solto. Em vez de gastar uma chamada só para
 *   fechá-lo, ele fica pendurado e viaja junto da próxima mensagem do usuário.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as ia from '../ia.js'
import * as trace from '../trace.js'
import { criarOperacoes, type Sessao, type SessaoDeChat, type ToolDef } from './operacoes.js'
import type { Provider, Validation } from './types.js'

const KEY_ENV = 'ANTHROPIC_API_KEY'
const DEFAULT_MODEL = 'claude-opus-5'
const MAX_SAIDA = 16000

let client: Anthropic | null = null
let clientKey = ''
function getClient(): Anthropic {
  // Recria se a chave mudou — senão um `provider` depois de corrigir o .env
  // revalidaria a chave antiga.
  const key = process.env[KEY_ENV] ?? ''
  if (!client || clientKey !== key) {
    client = new Anthropic()
    clientKey = key
  }
  return client
}

function model(): string {
  return ia.modeloEscolhido('anthropic') ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL
}

function hasKey(): boolean {
  return Boolean(process.env[KEY_ENV]?.trim())
}

async function listarModelos(): Promise<string[]> {
  const page = await getClient().models.list({ limit: 100 })
  return page.data.map((m) => m.id)
}

async function validate(): Promise<Validation> {
  if (!hasKey()) {
    return { ok: false, reason: 'sem-chave', detail: `${KEY_ENV} não definida` }
  }
  try {
    // models.list é gratuito e não consome token — só prova que a chave vale.
    const page = await getClient().models.list({ limit: 20 })
    const ids = page.data.map((m) => m.id)
    const wanted = model()
    const known = ids.includes(wanted)
    return {
      ok: true,
      detail: known
        ? `chave válida, modelo '${wanted}' disponível`
        : `chave válida (modelo '${wanted}' não veio na primeira página — pode existir mesmo assim)`,
    }
  } catch (err) {
    return classify(err)
  }
}

function classify(err: unknown): Validation {
  if (err instanceof Anthropic.AuthenticationError) {
    return { ok: false, reason: 'chave-invalida', detail: `${KEY_ENV} rejeitada (401)` }
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { ok: false, reason: 'sem-acesso', detail: `${KEY_ENV} sem permissão (403)` }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { ok: false, reason: 'erro', detail: 'sem conexão com api.anthropic.com' }
  }
  return { ok: false, reason: 'erro', detail: err instanceof Error ? err.message : String(err) }
}

// -------------------------------------------------------------------- sessão

function paraTool(t: ToolDef): Anthropic.Tool {
  return {
    name: t.nome,
    description: t.descricao,
    input_schema: t.schema as Anthropic.Tool.InputSchema,
  }
}

/** Por TIPO de bloco, nunca por posição: com thinking ligado o primeiro bloco não é o tool_use. */
function acharToolUse(content: Anthropic.ContentBlock[]): Anthropic.ToolUseBlock | null {
  return content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use') ?? null
}

function textoDe(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

type Salvo = { messages?: unknown; pendente?: unknown }

function criarSessao(system: string, historico?: unknown): SessaoDeChat {
  const salvo = historico as Salvo | undefined
  const messages: Anthropic.MessageParam[] = Array.isArray(salvo?.messages)
    ? (salvo.messages as Anthropic.MessageParam[])
    : []
  let pendente = (salvo?.pendente as Anthropic.ToolResultBlockParam | null) ?? null

  const sessao: Sessao = {
    label: 'Anthropic',
    system,
    model,

    pedir(texto) {
      const conteudo: Anthropic.ContentBlockParam[] = []
      if (pendente) {
        conteudo.push(pendente)
        pendente = null
      }
      conteudo.push({ type: 'text', text: texto })
      messages.push({ role: 'user', content: conteudo })
    },

    async responder(tools, forcar) {
      const response = await getClient().messages.create({
        model: model(),
        max_tokens: MAX_SAIDA,
        system,
        tools: tools.map(paraTool),
        ...(forcar ? { tool_choice: { type: 'tool' as const, name: forcar } } : {}),
        messages,
      })

      messages.push({ role: 'assistant', content: response.content })
      const bloco = acharToolUse(response.content)

      return {
        texto: textoDe(response.content),
        chamada: bloco ? { id: bloco.id, nome: bloco.name, argumentos: bloco.input } : null,
        bruto: response,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        } satisfies trace.Usage,
        stopReason: response.stop_reason,
      }
    },

    corrigir(chamada, feedback) {
      messages.push({
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: chamada.id, is_error: true, content: feedback },
        ],
      })
    },

    confirmar(chamada, texto) {
      pendente = { type: 'tool_result', tool_use_id: chamada.id, content: texto }
    },

    marcar: () => messages.length,
    desfazer(marca) {
      messages.length = marca
    },
    historico: () => messages,
  }

  return {
    ...sessao,
    retomou: messages.length > 0,
    exportar: () => ({ messages, pendente }),
  }
}

export const anthropicProvider: Provider = {
  id: 'anthropic',
  label: 'Anthropic',
  keyEnv: KEY_ENV,
  model,
  hasKey,
  validate,
  listarModelos,
  ...criarOperacoes(criarSessao),
}
