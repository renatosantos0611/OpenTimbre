/**
 * As três operações da app, escritas uma vez só.
 *
 * `buildRig`, `ajustarCena` e `createChat` não têm nada de Anthropic nem de
 * OpenAI: elas montam a tool, dizem o que pedir e sabem validar a resposta. O
 * que muda entre provedores — como falar com a API, como o histórico é montado
 * — entra por `criarSessao`, e o protocolo (duas tentativas, trace, devolver os
 * `issues` ao modelo) mora em `tool-use.ts`.
 *
 * Um provedor novo é, literalmente, um `criarSessao` mais os quatro métodos de
 * chave e modelo. Não se escreve operação nenhuma de novo.
 */

import type { Cena, PluginSpec } from '../plugins/index.js'
import {
  AJUSTE_TOOL_NAME,
  ajusteJsonSchema,
  ajusteSchema,
  cenaSchema,
  rigJsonSchema,
  rigModeloSchema,
  toolName,
  type Rig,
} from '../schema.js'
import { executar, type Chamada, type Sessao, type ToolDef, type Veredito } from './tool-use.js'
import {
  AJUSTE_TOOL_DESC,
  issuesToText,
  mergeIssuesToText,
  pluginDaTool,
  toolsDoCatalogo,
  type Ajuste,
  type ChatSession,
  type Provider,
  type Turno,
} from './types.js'

export type { Chamada, Resposta, Sessao, ToolDef } from './tool-use.js'

/** Uma sessão que também sabe se ressuscitou de um histórico e como se gravar. */
export type SessaoDeChat = Sessao & {
  readonly retomou: boolean
  exportar(): unknown
}

export type CriarSessao = (system: string, historico?: unknown) => SessaoDeChat

/** As operações que um provedor ganha de graça ao fornecer `criarSessao`. */
type Operacoes = Pick<Provider, 'buildRig' | 'ajustarCena' | 'createChat'>

// ------------------------------------------------------------------ validação

function validarRig(plugin: PluginSpec, chamada: Chamada): Veredito<Rig> {
  const parsed = rigModeloSchema(plugin).safeParse(chamada.argumentos)
  if (parsed.success) {
    return { ok: true, valor: { ...(parsed.data as Omit<Rig, 'plugin'>), plugin: plugin.id } }
  }
  return { ok: false, issues: parsed.error.issues, feedback: issuesToText(parsed.error.issues) }
}

/**
 * Duas validações, e a segunda é a que costuma pegar: o patch pode ser
 * impecável sozinho e ainda assim produzir uma cena inválida ao ser fundido com
 * a atual — ligar um pedal sem mandar os knobs dele, por exemplo.
 */
function validarAjuste(plugin: PluginSpec, cenaAtual: Cena, chamada: Chamada): Veredito<Ajuste> {
  const parsed = ajusteSchema(plugin).safeParse(chamada.argumentos)
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues, feedback: issuesToText(parsed.error.issues) }
  }

  const patch = parsed.data as { resumo: string; mudancas: Record<string, unknown> }
  const fundida = cenaSchema(plugin).safeParse({ ...cenaAtual, ...patch.mudancas })
  if (!fundida.success) {
    return {
      ok: false,
      issues: fundida.error.issues,
      feedback: mergeIssuesToText(fundida.error.issues),
    }
  }

  return { ok: true, valor: { resumo: patch.resumo, cena: fundida.data as Cena } }
}

// ------------------------------------------------------------------ operações

export function criarOperacoes(criarSessao: CriarSessao): Operacoes {
  function buildRig(plugin: PluginSpec, pedido: string, systemPrompt: string): Promise<Rig> {
    const tool: ToolDef = {
      nome: toolName(plugin),
      descricao: `Monta uma rig no ${plugin.nome}. Knobs vão de 0.0 a 10.0.`,
      schema: rigJsonSchema(plugin),
    }

    return executar<Rig>({
      sessao: criarSessao(systemPrompt),
      operacao: 'rig',
      pedido: `Monta uma rig para tocar: ${pedido}`,
      tools: [tool],
      forcar: tool.nome,
      validar: (chamada) => validarRig(plugin, chamada),
    })
  }

  function ajustarCena(
    plugin: PluginSpec,
    cenaAtual: Cena,
    amp: string,
    instrucao: string,
    systemPrompt: string,
  ): Promise<Ajuste> {
    const tool: ToolDef = {
      nome: AJUSTE_TOOL_NAME,
      descricao: AJUSTE_TOOL_DESC,
      schema: ajusteJsonSchema(plugin),
    }

    return executar<Ajuste>({
      sessao: criarSessao(systemPrompt),
      operacao: 'ajuste',
      pedido:
        `Amp ativo: ${amp}\nCena atual (JSON): ${JSON.stringify(cenaAtual)}\n\n` +
        `Instrução do usuário: ${instrucao}\n\n` +
        'Ajuste a cena conforme a instrução. Retorne só os campos que mudam.',
      tools: [tool],
      forcar: AJUSTE_TOOL_NAME,
      validar: (chamada) => validarAjuste(plugin, cenaAtual, chamada),
    })
  }

  /**
   * A diferença de contrato da conversa: `forcar` é `null`. Num chat o modelo
   * precisa poder devolver uma pergunta ("do álbum ou do ao vivo?") ou recusar
   * um pedido fora de escopo. O que continua valendo é o que importa — quando
   * vem rig, ela vem por tool use e passa pelo zod; em nenhum momento se
   * parseia JSON de texto livre.
   */
  function createChat(systemPrompt: string, historico?: unknown): ChatSession {
    const sessao = criarSessao(systemPrompt, historico)

    // Uma tool por plugin do catálogo: qual delas o modelo chamar É a escolha
    // dele de qual plugin serve ao tom pedido.
    const tools: ToolDef[] = toolsDoCatalogo().map((t) => ({
      nome: t.nome,
      descricao: t.descricao,
      schema: t.schema,
    }))

    return {
      retomou: sessao.retomou,
      exportar: () => sessao.exportar(),
      enviar: (pedido: string) =>
        executar<Turno>({
          sessao,
          operacao: 'chat',
          pedido,
          tools,
          forcar: null,
          semChamada: (texto) => ({ texto, rig: null }),
          validar: (chamada, texto) => {
            const plugin = pluginDaTool(chamada.nome)
            if (!plugin) throw new Error(`Tool desconhecida: '${chamada.nome}'.`)

            const veredito = validarRig(plugin, chamada)
            return veredito.ok ? { ok: true, valor: { texto, rig: veredito.valor } } : veredito
          },
        }),
    }
  }

  return { buildRig, ajustarCena, createChat }
}
