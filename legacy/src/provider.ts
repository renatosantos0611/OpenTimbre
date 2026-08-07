/**
 * Escolhe o provedor de IA testando qual chave é **válida de verdade**.
 *
 * Presença da env var não basta: uma chave revogada, colada pela metade ou
 * copiada do `.env.example` está "presente" e falha só na hora de gerar a rig.
 * Então cada candidato é verificado contra o endpoint de listagem de modelos —
 * chamada gratuita, sem consumo de token — antes de ser eleito.
 *
 * Ordem de preferência: `AI_PROVIDER` (se definida), senão o provedor escolhido
 * em Configurações, senão Anthropic e depois OpenAI. A verificação roda uma vez
 * e o resultado fica em cache; `provider` no REPL força uma nova rodada.
 */

import * as ia from './ia.js'
import { anthropicProvider } from './providers/anthropic.js'
import { openaiProvider } from './providers/openai.js'
import type { Provider, ProviderId, Validation } from './providers/types.js'

export type { Provider, ProviderId } from './providers/types.js'

const ALL: Provider[] = [anthropicProvider, openaiProvider]

export type ProviderCheck = {
  provider: Provider
  validation: Validation
}

export type Resolution = {
  chosen: Provider
  checks: ProviderCheck[]
}

let cached: Resolution | null = null

function candidates(): Provider[] {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase()

  if (!forced) {
    // A escolha feita na janela **ordena**, não força: com as duas chaves
    // salvas, quem prefere GPT recebe GPT; com só uma delas válida, a app
    // continua funcionando em vez de errar por causa de uma preferência.
    const preferido = ia.provedorPreferido()
    if (!preferido) return ALL
    return [...ALL].sort((a, b) => Number(b.id === preferido) - Number(a.id === preferido))
  }

  const match = ALL.find((p) => p.id === forced)
  if (!match) {
    throw new Error(
      `AI_PROVIDER='${forced}' é desconhecido. Use: ${ALL.map((p) => p.id).join(' | ')}.`,
    )
  }
  // Forçado significa forçado: se a chave dele não valer, é erro — não caímos
  // silenciosamente no outro provedor.
  return [match]
}

/** Testa os candidatos em ordem e devolve o primeiro válido. */
export async function resolveProvider(force = false): Promise<Resolution> {
  if (cached && !force) return cached

  const list = candidates()
  const checks: ProviderCheck[] = []

  for (const provider of list) {
    const validation = await provider.validate()
    checks.push({ provider, validation })
    if (validation.ok) {
      cached = { chosen: provider, checks }
      return cached
    }
  }

  const detail = checks.map((c) => `  ${c.provider.label}: ${c.validation.detail}`).join('\n')
  const forced = list.length < ALL.length
  const header = forced
    ? `AI_PROVIDER='${list[0]!.id}' foi forçado, mas a chave dele não vale.`
    : 'Nenhuma chave de IA válida.'
  const hint = forced
    ? `Corrija ${list[0]!.keyEnv} no .env, ou remova AI_PROVIDER para tentar os dois provedores.`
    : `Defina ${ALL.map((p) => p.keyEnv).join(' ou ')} no .env (veja .env.example).`

  throw new Error(`${header}\n${detail}\n\n${hint}`)
}

/** Snapshot para o comando `provider` — não dispara verificação. */
export function knownProviders(): { provider: Provider; keyPresent: boolean }[] {
  return ALL.map((provider) => ({ provider, keyPresent: provider.hasKey() }))
}

/**
 * Testa **todos** os provedores, sem parar no primeiro válido — diferente de
 * `resolveProvider`, que só precisa de um. É o que permite ao seletor de
 * modelo da janela mostrar os dois catálogos juntos quando as duas chaves
 * valem, em vez de só a do provedor que está atendendo.
 */
export async function checkAll(): Promise<ProviderCheck[]> {
  return Promise.all(ALL.map(async (provider) => ({ provider, validation: await provider.validate() })))
}
