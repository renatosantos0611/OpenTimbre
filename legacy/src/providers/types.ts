/** Contrato comum entre os provedores de IA. */

import { CATALOGO, type Cena, type PluginSpec } from '../plugins/index.js'
import { rigJsonSchema, toolName, type Rig } from '../schema.js'

export type ProviderId = 'anthropic' | 'openai'

export type Validation =
  | { ok: true; detail: string }
  | { ok: false; reason: 'sem-chave' | 'chave-invalida' | 'sem-acesso' | 'erro'; detail: string }

export type Ajuste = { resumo: string; cena: Cena }

/**
 * Um turno de conversa. `rig` vem preenchida quando o modelo chamou uma tool
 * neste turno; quando ele só respondeu em texto (uma pergunta de volta, uma
 * recusa), vem `null` e a UI mostra apenas a prosa.
 */
export type Turno = { texto: string; rig: Rig | null }

/**
 * Conversa com histórico. Cada provedor guarda o próprio array de mensagens no
 * formato nativo dele — é o que mantém `if (provider === ...)` fora do resto da
 * app, ao custo de duas implementações parecidas aqui dentro.
 */
export type ChatSession = {
  /**
   * `true` quando o histórico oferecido a `createChat` foi de fato adotado.
   * `false` significa que a sessão começou limpa — o formato não servia (outro
   * provedor, ou uma versão anterior do próprio) e o modelo não lembra de nada.
   */
  readonly retomou: boolean
  enviar(pedido: string): Promise<Turno>
  /**
   * Histórico nativo, para gravar em disco e devolver a `createChat` depois.
   * Opaco de propósito: só o provedor que gerou sabe ler.
   */
  exportar(): unknown
}

export type Provider = {
  readonly id: ProviderId
  readonly label: string
  /** Nome da env var que guarda a chave — usado nas mensagens de erro. */
  readonly keyEnv: string
  /** Modelo configurado (env var ou default). */
  model(): string
  hasKey(): boolean
  /** Bate na API de listagem de modelos: barata, não gasta token, e revela chave inválida. */
  validate(): Promise<Validation>
  /** Modelos da conta que servem para gerar rig, para o seletor da janela. */
  listarModelos(): Promise<string[]>
  buildRig(plugin: PluginSpec, pedido: string, systemPrompt: string): Promise<Rig>
  /** Ajusta a cena carregada por instrução livre — retorna a cena já mesclada e validada. */
  ajustarCena(
    plugin: PluginSpec,
    cenaAtual: Cena,
    amp: string,
    instrucao: string,
    systemPrompt: string,
  ): Promise<Ajuste>
  /** Abre uma conversa com histórico. O system prompt é fixo pela vida da sessão. */
  createChat(systemPrompt: string, historico?: unknown): ChatSession
}

// ------------------------------------------------------- tools do catálogo

export type ToolDoPlugin = {
  plugin: PluginSpec
  nome: string
  descricao: string
  schema: Record<string, unknown>
}

/**
 * Uma tool por plugin do catálogo. **É assim que a IA escolhe o plugin**: ela
 * chama a tool daquele que serve ao tom pedido, e a app deduz a escolha do nome
 * da tool chamada — sem etapa extra e sem uma chamada a mais.
 */
export function toolsDoCatalogo(): ToolDoPlugin[] {
  return CATALOGO.map((plugin) => ({
    plugin,
    nome: toolName(plugin),
    descricao:
      `Monta e entrega uma rig no ${plugin.nome}. Use quando: ${plugin.quando}. ` +
      'Knobs vão de 0.0 a 10.0.',
    schema: rigJsonSchema(plugin),
  }))
}

/** Acha de qual plugin é a tool que o modelo chamou. */
export function pluginDaTool(nome: string): PluginSpec | undefined {
  return toolsDoCatalogo().find((t) => t.nome === nome)?.plugin
}

// --------------------------------------------------------------- mensagens

/** Formata os erros do zod para mandar de volta ao modelo na retentativa. */
export function issuesToText(issues: { path: PropertyKey[]; message: string }[]): string {
  return (
    'A rig não passou na validação. Corrija exatamente estes pontos e chame a tool de novo:\n' +
    issues.map((i) => `- ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n')
  )
}

export function issuesToError(issues: { path: PropertyKey[]; message: string }[]): Error {
  const detail = issues.map((i) => `  ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n')
  return new Error(`A resposta do modelo falhou na validação duas vezes:\n${detail}`)
}

export const AJUSTE_TOOL_DESC =
  'Ajusta a cena atualmente carregada conforme uma instrução livre. Retorne só os ' +
  'campos que mudam — nunca repita o que já está bom.'

/* A confirmação devolvida ao modelo depois de uma tool bem-sucedida mora em
 * `tool-use.ts`, junto do resto do protocolo: quem a manda é o executor, não
 * quem escreve a operação. */

/** Formata os erros da fusão (patch + cena atual) para a retentativa. */
export function mergeIssuesToText(issues: { path: PropertyKey[]; message: string }[]): string {
  return (
    'O patch, aplicado sobre a cena atual, ficou inválido. Corrija exatamente estes ' +
    `pontos e chame a tool de novo:\n${issues.map((i) => `- ${i.path.join('.') || '(raiz)'}: ${i.message}`).join('\n')}`
  )
}
