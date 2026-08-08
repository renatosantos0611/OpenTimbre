/**
 * Provedor OpenAI — na **Responses API**, não em `chat.completions`.
 *
 * Os modelos de raciocínio mais novos (a família `gpt-5.6-*`, por exemplo)
 * recusam function tools naquele endpoint:
 *
 *   "Function tools with reasoning_effort are not supported for gpt-5.6-sol in
 *    /v1/chat/completions. To use function tools, use /v1/responses or set
 *    reasoning_effort to 'none'."
 *
 * Desligar o raciocínio para caber no endpoint antigo seria pagar em qualidade
 * de timbre por uma escolha de encanamento. A Responses API aceita as duas
 * coisas juntas e atende igualmente os modelos anteriores, então é ela.
 *
 * O que é particular desta API e por isso mora aqui: os argumentos da tool
 * chegam como **string JSON** (e o `JSON.parse` precisa de erro tratado), o
 * system prompt viaja em `instructions`, e a saída de um turno volta como
 * entrada do próximo — é assim que a linha de raciocínio se preserva.
 */

import OpenAI from 'openai'
import * as ia from '../ia.js'
import * as trace from '../trace.js'
import { criarOperacoes, type Chamada, type Sessao, type SessaoDeChat, type ToolDef } from './operacoes.js'
import type { Provider, Validation } from './types.js'

const KEY_ENV = 'OPENAI_API_KEY'
const DEFAULT_MODEL = 'gpt-5'

/**
 * Teto de tokens de saída. Nos modelos de raciocínio os tokens de reasoning
 * contam aqui dentro, então o limite precisa ser bem maior que a rig sozinha —
 * apertado demais, a resposta volta `incomplete` no meio da tool.
 */
const MAX_SAIDA = 32000

type Item = OpenAI.Responses.ResponseInputItem
type Saida = OpenAI.Responses.ResponseOutputItem
type ChamadaAPI = OpenAI.Responses.ResponseFunctionToolCall

let client: OpenAI | null = null
let clientKey = ''
function getClient(): OpenAI {
  // Recria se a chave mudou — senão um `provider` depois de corrigir o .env
  // revalidaria a chave antiga.
  const key = process.env[KEY_ENV] ?? ''
  if (!client || clientKey !== key) {
    client = new OpenAI()
    clientKey = key
  }
  return client
}

function model(): string {
  return ia.modeloEscolhido('openai') ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL
}

function hasKey(): boolean {
  return Boolean(process.env[KEY_ENV]?.trim())
}

/**
 * Só os modelos que servem aqui. A conta lista mais de cem, a maioria
 * irrelevante — transcrição, imagem, embedding, áudio. O filtro é por exclusão
 * porque a lista de famílias novas cresce sozinha e uma allowlist envelheceria.
 */
const FORA = /transcribe|tts|audio|realtime|search|image|embedding|moderation|codex|instruct|dall|whisper|sora|omni-moderation/

/**
 * Piso de versão, uma família de cada vez: `gpt-4`, `gpt-4o`, `gpt-3.5-turbo`
 * ficam de fora da família `gpt-*`; `o1` a `o4` ficam de fora da família de
 * raciocínio puro `o*`. Não é só custo — é a geração de tom que a app quer
 * evitar. As duas famílias têm numeração independente, por isso dois pisos.
 */
const VERSAO_MINIMA_GPT = 5
const VERSAO_MINIMA_O = 5

function versaoGpt(id: string): number | null {
  const m = /^gpt-(\d+(?:\.\d+)?)/.exec(id)
  return m ? Number(m[1]) : null
}

function versaoO(id: string): number | null {
  const m = /^o(\d+)/.exec(id)
  return m ? Number(m[1]) : null
}

/**
 * Codinome de lançamento (`sol`, `terra`...) dentro da mesma versão numérica
 * não segue ordem alfabética — é ordem de estreia do modelo, que só a OpenAI
 * sabe. `sol` veio antes de `terra`; a lista cresce a cada lançamento novo.
 */
const ORDEM_CODINOME = ['sol', 'terra']

/** `"gpt-5.6-sol"` → `["gpt-5.6", "sol"]`; sem codinome, o sufixo é `null`. */
function baseECodinome(id: string): [string, string | null] {
  const m = /^(.+)-([a-z]+)$/.exec(id)
  return m ? [m[1]!, m[2]!] : [id, null]
}

async function listarModelos(): Promise<string[]> {
  const page = await getClient().models.list()
  // `gpt-*` antes de `o*`.
  const familia = (id: string) => (id.startsWith('gpt-') ? 0 : 1)

  return page.data
    .map((m) => m.id)
    .filter((id) => /^(gpt-|o[0-9])/.test(id) && !FORA.test(id))
    .filter((id) => {
      const vGpt = versaoGpt(id)
      if (vGpt !== null) return vGpt >= VERSAO_MINIMA_GPT
      return (versaoO(id) ?? 0) >= VERSAO_MINIMA_O
    })
    .sort((a, b) => {
      const f = familia(a) - familia(b)
      if (f !== 0) return f

      const [baseA, codA] = baseECodinome(a)
      const [baseB, codB] = baseECodinome(b)
      // Bases diferentes: mais novo primeiro, como antes — só dentro da MESMA
      // base é que o codinome decide (senão "gpt-5" e "gpt-4-sol" empatariam
      // pelo codinome e ignorariam a versão).
      if (baseA !== baseB) return baseB.localeCompare(baseA, 'en', { numeric: true })

      const posA = codA ? ORDEM_CODINOME.indexOf(codA) : -1
      const posB = codB ? ORDEM_CODINOME.indexOf(codB) : -1
      return (posA === -1 ? Number.POSITIVE_INFINITY : posA) - (posB === -1 ? Number.POSITIVE_INFINITY : posB)
    })
}

async function validate(): Promise<Validation> {
  if (!hasKey()) {
    return { ok: false, reason: 'sem-chave', detail: `${KEY_ENV} não definida` }
  }
  try {
    // models.list é gratuito e não consome token — prova a chave e ainda
    // permite conferir se o modelo configurado existe nesta conta.
    const page = await getClient().models.list()
    const ids = page.data.map((m) => m.id)
    const wanted = model()
    if (!ids.includes(wanted)) {
      return {
        ok: false,
        reason: 'sem-acesso',
        detail: `chave válida, mas o modelo '${wanted}' não está disponível nesta conta. Ajuste OPENAI_MODEL.`,
      }
    }
    return { ok: true, detail: `chave válida, modelo '${wanted}' disponível` }
  } catch (err) {
    return classify(err)
  }
}

function classify(err: unknown): Validation {
  if (err instanceof OpenAI.AuthenticationError) {
    return { ok: false, reason: 'chave-invalida', detail: `${KEY_ENV} rejeitada (401)` }
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return { ok: false, reason: 'sem-acesso', detail: `${KEY_ENV} sem permissão (403)` }
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return { ok: false, reason: 'erro', detail: 'sem conexão com api.openai.com' }
  }
  return { ok: false, reason: 'erro', detail: err instanceof Error ? err.message : String(err) }
}

// -------------------------------------------------------------------- sessão

function paraTool(t: ToolDef) {
  // `strict: false` porque o schema vindo do zod tem campos opcionais, e o modo
  // estrito da OpenAI exige que todo campo seja obrigatório.
  return {
    type: 'function' as const,
    name: t.nome,
    description: t.descricao,
    parameters: t.schema,
    strict: false,
  }
}

/** Por tipo, não por posição — antes da chamada vêm os blocos de raciocínio. */
function acharChamada(output: Saida[]): ChamadaAPI | null {
  for (const item of output) {
    if (item.type === 'function_call') return item
  }
  return null
}

function parseArgs(call: ChamadaAPI): unknown {
  try {
    return JSON.parse(call.arguments)
  } catch {
    throw new Error(
      `Os argumentos da function não são JSON válido:\n${call.arguments.slice(0, 500)}`,
    )
  }
}

/** Resposta a uma chamada de tool. Precisa do mesmo `call_id`. */
function retorno(chamada: Chamada, texto: string): Item {
  return { type: 'function_call_output', call_id: chamada.id, output: texto }
}

/**
 * Devolve a saída de um turno como entrada do próximo — é assim que a Responses
 * API preserva a linha de raciocínio entre as chamadas.
 *
 * O cast existe porque o union de **saída** do SDK carrega uma variante extra
 * cujo `role` é mais largo que o aceito na entrada. Para os itens que este
 * código de fato produz — `reasoning`, `message` e `function_call` — a
 * conversão é exata, e é o próprio contrato da API: o que sai volta.
 */
function comoEntrada(output: Saida[]): Item[] {
  return output as unknown as Item[]
}

/** Marca o formato do histórico exportado — ver `criarSessao`. */
const FORMATO = 'responses-v1'

/**
 * Reescreve o histórico para poder ser lido por **outro** modelo.
 *
 * Não basta remover os blocos de raciocínio: a API recusa uma `function_call`
 * órfã do `reasoning` que a acompanha ("was provided without its required
 * 'reasoning' item"). Então a chamada inteira vira uma mensagem de texto do
 * assistente, carregando os mesmos argumentos.
 *
 * O modelo novo continua sabendo qual timbre foi entregue e com quais valores
 * — só não herda o raciocínio que levou até ele, que é justamente a parte
 * intransferível.
 */
function semRaciocinio(itens: Item[]): Item[] {
  const saida: Item[] = []

  for (const item of itens) {
    const tipo = (item as { type?: string }).type

    if (tipo === 'reasoning') continue
    // O retorno da tool era só uma confirmação nossa; sem a chamada, não diz nada.
    if (tipo === 'function_call_output') continue

    if (tipo === 'function_call') {
      const call = item as ChamadaAPI
      saida.push({
        role: 'assistant',
        content: `Timbres entregues via ${call.name}: ${call.arguments}`,
      })
      continue
    }

    saida.push(item)
  }

  return saida
}

type Salvo = { formato?: string; modelo?: string; input?: unknown; pendente?: unknown }

function criarSessao(system: string, historico?: unknown): SessaoDeChat {
  // Conversas gravadas antes da migração para a Responses API têm mensagens no
  // formato do `chat.completions`, que este endpoint não entende. O marcador
  // separa as duas: sem ele, a conversa reabre limpa em vez de estourar.
  const salvo = historico as Salvo | undefined
  const compativel = salvo?.formato === FORMATO && Array.isArray(salvo.input)

  // Blocos de raciocínio pertencem ao modelo que os gerou e a API os rejeita
  // vindos de outro. Ao trocar de modelo o histórico é reescrito em texto puro
  // — ver `semRaciocinio` — para a conversa não perder a memória só porque o
  // guitarrista mexeu no seletor.
  const trocouModelo = compativel && salvo?.modelo !== undefined && salvo.modelo !== model()
  const herdado = compativel ? (salvo!.input as Item[]) : []

  const input: Item[] = trocouModelo ? semRaciocinio(herdado) : herdado
  let pendente = compativel && !trocouModelo && salvo?.pendente ? (salvo.pendente as Item) : null

  const sessao: Sessao = {
    label: 'OpenAI',
    system,
    model,

    pedir(texto) {
      if (pendente) {
        input.push(pendente)
        pendente = null
      }
      input.push({ role: 'user', content: texto })
    },

    async responder(tools, forcar) {
      const r = await getClient().responses.create({
        model: model(),
        instructions: system,
        input,
        tools: tools.map(paraTool),
        tool_choice: forcar ? { type: 'function', name: forcar } : 'auto',
        max_output_tokens: MAX_SAIDA,
      })

      input.push(...comoEntrada(r.output))
      const call = acharChamada(r.output)

      return {
        texto: r.output_text.trim(),
        chamada: call
          ? { id: call.call_id, nome: call.name, argumentos: parseArgs(call) }
          : null,
        bruto: r,
        usage: { input: r.usage?.input_tokens, output: r.usage?.output_tokens } satisfies trace.Usage,
        // `incomplete` aqui costuma ser teto de token estourado no meio da tool.
        stopReason: r.status ?? null,
      }
    },

    corrigir(chamada, feedback) {
      input.push(retorno(chamada, feedback))
    },

    confirmar(chamada, texto) {
      pendente = retorno(chamada, texto)
    },

    marcar: () => input.length,
    desfazer(marca) {
      input.length = marca
    },
    historico: () => input,
  }

  return {
    ...sessao,
    retomou: compativel && input.length > 0,
    exportar: () => ({ formato: FORMATO, modelo: model(), input, pendente }),
  }
}

export const openaiProvider: Provider = {
  id: 'openai',
  label: 'OpenAI',
  keyEnv: KEY_ENV,
  model,
  hasKey,
  validate,
  listarModelos,
  ...criarOperacoes(criarSessao),
}
