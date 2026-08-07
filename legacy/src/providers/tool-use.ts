/**
 * O protocolo de tool use, um só para os dois provedores.
 *
 * As três operações da app — montar rig, ajustar cena e conversar — sempre
 * fizeram a mesma dança: manda o turno, acha a chamada de tool **por tipo e não
 * por posição**, valida com zod, e se o zod reclamar devolve os `issues` ao
 * modelo uma única vez, no formato que aquela API exige. Isso estava escrito
 * seis vezes (três operações × dois provedores), e cada correção precisava ser
 * feita seis vezes — foi assim que o rollback de histórico nasceu só na
 * conversa e faltou nas outras duas.
 *
 * Aqui a dança mora uma vez. O que sobra para o provedor é o que de fato é
 * dele: como falar com a API e como o histórico daquela API é montado. Essa é a
 * `Sessao` abaixo — quatro métodos, nenhum deles sabendo o que é uma rig.
 *
 * Consequência de projeto que vale citar: `executar` é testável com uma sessão
 * de mentira, sem rede e sem chave. `tool-use.test.ts` faz exatamente isso.
 */

import * as trace from '../trace.js'
import { issuesToError } from './types.js'

/** Duas idas no máximo: uma retentativa é remendo, duas é o modelo não sabendo. */
const MAX_TENTATIVAS = 2

export type Issue = { path: PropertyKey[]; message: string }

/** Uma chamada de tool já normalizada, venha ela da Anthropic ou da OpenAI. */
export type Chamada = {
  readonly id: string
  readonly nome: string
  /** Já parseado — a OpenAI entrega string JSON, e isso se resolve no adaptador. */
  readonly argumentos: unknown
}

export type Resposta = {
  readonly texto: string
  /** `null` quando o modelo respondeu só em prosa. */
  readonly chamada: Chamada | null
  /** A resposta crua da API, só para o trace. */
  readonly bruto: unknown
  readonly usage: trace.Usage
  readonly stopReason: string | null
}

export type ToolDef = {
  readonly nome: string
  readonly descricao: string
  readonly schema: Record<string, unknown>
}

/**
 * O que um provedor precisa saber fazer. Note o que **não** está aqui:
 * tentativas, validação, mensagem de erro, trace. Nada disso é decisão de quem
 * fala com a API.
 */
export type Sessao = {
  readonly label: string
  /** Fixo pela vida da sessão — as duas APIs mandam o system fora do histórico. */
  readonly system: string
  model(): string
  /** Acrescenta o turno do usuário ao histórico, no formato nativo da API. */
  pedir(texto: string): void
  /** Manda o histórico e devolve a resposta já anexada a ele. */
  responder(tools: readonly ToolDef[], forcar: string | null): Promise<Resposta>
  /** Devolve ao modelo o erro de validação — cada API exige uma forma própria. */
  corrigir(chamada: Chamada, feedback: string): void
  /** Fecha uma chamada bem-sucedida, para o próximo turno não começar devendo. */
  confirmar(chamada: Chamada, texto: string): void
  marcar(): number
  desfazer(marca: number): void
  /** Histórico cru, para o trace mostrar o que foi enviado. */
  historico(): unknown
}

/**
 * O que `executar` faz com a chamada do modelo. O `feedback` vem de quem valida
 * porque a mensagem certa depende da operação: um patch que ficou inválido
 * depois de fundido com a cena atual precisa dizer isso, não "a rig não passou".
 */
export type Veredito<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly issues: Issue[]; readonly feedback: string }

export type Execucao<T> = {
  readonly sessao: Sessao
  readonly operacao: trace.Operation
  readonly pedido: string
  readonly tools: readonly ToolDef[]
  /** Nome da tool obrigatória, ou `null` para deixar o modelo escolher. */
  readonly forcar: string | null
  /** O texto vem junto porque num chat a prosa e a tool chegam no mesmo turno. */
  readonly validar: (chamada: Chamada, texto: string) => Veredito<T>
  /**
   * Só a conversa passa isto. Num chat o modelo precisa poder devolver uma
   * pergunta ou recusar um pedido fora de escopo; nas outras operações, não
   * chamar a tool é erro.
   */
  readonly semChamada?: (texto: string) => T
}

/** O bloco `tool` do trace: uma tool mostra a si mesma, várias mostram a escolha. */
function descreverTools(tools: readonly ToolDef[]): trace.CallInfo['tool'] {
  const unica = tools.length === 1 ? tools[0] : undefined
  if (unica) return { name: unica.nome, description: unica.descricao, schema: unica.schema }
  return {
    name: tools.map((t) => t.nome).join(' | '),
    description: `${tools.length} plugin(s) disponíveis`,
    schema: tools[0]?.schema ?? {},
  }
}

/**
 * Roda um turno completo: pede, valida e, se preciso, corrige uma vez.
 *
 * Se qualquer coisa falhar, o histórico volta exatamente para onde estava. Um
 * turno pela metade — pergunta sem resposta, chamada de tool sem retorno —
 * envenena todos os turnos seguintes, e numa conversa longa isso só aparece
 * muito depois, como um erro incompreensível da API.
 */
export async function executar<T>(exec: Execucao<T>): Promise<T> {
  const { sessao, operacao, pedido, tools, forcar, validar, semChamada } = exec

  const marca = sessao.marcar()
  sessao.pedir(pedido)

  try {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      const call = trace.begin({
        provider: sessao.label,
        model: sessao.model(),
        operation: operacao,
        attempt: tentativa,
        system: sessao.system,
        messages: sessao.historico(),
        tool: descreverTools(tools),
      })

      const resposta = await sessao.responder(tools, forcar)
      call.response(resposta.bruto, { usage: resposta.usage, stopReason: resposta.stopReason })

      if (!resposta.chamada) {
        if (semChamada) return semChamada(resposta.texto)
        throw new Error(
          `O modelo não chamou a tool '${forcar ?? descreverTools(tools).name}' ` +
            `(stop=${resposta.stopReason ?? 'n/d'}).`,
        )
      }

      call.output(resposta.chamada.argumentos)
      const veredito = validar(resposta.chamada, resposta.texto)
      call.validation(veredito.ok, veredito.ok ? undefined : veredito.issues)

      if (veredito.ok) {
        sessao.confirmar(resposta.chamada, CONFIRMACAO)
        return veredito.valor
      }

      if (tentativa === MAX_TENTATIVAS) throw issuesToError(veredito.issues)

      call.retry(veredito.feedback)
      sessao.corrigir(resposta.chamada, veredito.feedback)
    }

    // Inalcançável: a última tentativa ou retorna ou joga.
    throw new Error(`Falha inesperada na operação '${operacao}'.`)
  } catch (err) {
    sessao.desfazer(marca)
    throw err
  }
}

/**
 * Devolvido ao modelo depois de uma chamada bem-sucedida. A app não tem como
 * ler o plugin, então a confirmação é só de entrega: os timbres foram
 * mostrados, mas quem decide aplicar é o guitarrista, clicando.
 */
export const CONFIRMACAO =
  'Timbres exibidos ao guitarrista. Ele aplica clicando no título de um deles. ' +
  'Se ele pedir mudanças, chame a tool de novo com o conjunto completo de cenas atualizado.'
