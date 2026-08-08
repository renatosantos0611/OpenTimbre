/**
 * A conversa entre o guitarrista e a IA.
 *
 * Fachada fina sobre o provedor eleito: quem guarda o histórico é o módulo em
 * `src/providers/`, porque o formato das mensagens é específico de cada API. O
 * que mora aqui é o que vale para os dois — o guardrail de escopo e a decisão
 * de quando ele é aplicado.
 */

import { resolveProvider } from './provider.js'
import type { ChatSession, Turno } from './providers/types.js'
import { checkScope } from './scope.js'

export type { Turno } from './providers/types.js'

export type Sessao = {
  /** Id do provedor que atende esta sessão — grava junto do histórico. */
  readonly provedor: string
  /** `false` quando o histórico oferecido não servia e a sessão começou limpa. */
  readonly retomou: boolean
  enviar(pedido: string): Promise<Turno>
  exportar(): unknown
}

/**
 * `retomar` traz o histórico nativo de uma conversa salva. Ele só é aproveitado
 * se veio do mesmo provedor que está atendendo agora; caso contrário o formato
 * não bate e a sessão começa limpa, sem quebrar nada.
 */
export async function criarSessao(
  systemPrompt: string,
  retomar?: { provedor: string; historico: unknown },
): Promise<Sessao> {
  const { chosen } = await resolveProvider()

  const compativel = retomar && retomar.provedor === chosen.id
  const sessao: ChatSession = chosen.createChat(
    systemPrompt,
    compativel ? retomar.historico : undefined,
  )

  // Uma conversa retomada já passou pelo guardrail no primeiro turno dela.
  let primeira = !sessao.retomou

  async function enviar(pedido: string): Promise<Turno> {
    const texto = pedido.trim()
    if (!texto) throw new Error('Mensagem vazia.')

    // Só a primeira mensagem passa pela heurística de título. Depois disso a
    // conversa já está estabelecida e frases como "mais grave" ou "tira o
    // delay" não têm palavra-chave nenhuma — barrá-las seria pior que o
    // problema que o guardrail resolve.
    const scope = checkScope(texto, primeira ? 'titulo' : 'ajuste')
    if (!scope.inScope) {
      return {
        texto: `Só falo de música, timbre e equipamento de guitarra — ${scope.reason}.`,
        rig: null,
      }
    }

    const turno = await sessao.enviar(texto)
    primeira = false
    return turno
  }

  return {
    provedor: chosen.id,
    retomou: sessao.retomou,
    enviar,
    exportar: () => sessao.exportar(),
  }
}
