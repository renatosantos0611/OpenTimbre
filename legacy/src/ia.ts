/**
 * As escolhas de IA feitas na janela: qual provedor atende e qual modelo de
 * cada um.
 *
 * Precedem as env vars: quem troca o modelo pelo seletor, ou cola uma chave em
 * Configurações, não deveria ter que editar o `.env` e reiniciar. Sem escolha
 * gravada, o comportamento é o de antes — `OPENAI_MODEL` / `ANTHROPIC_MODEL`, e
 * depois o default do provedor.
 *
 * (Este arquivo se chamava `modelo.ts` enquanto o modelo era a única escolha.
 * Passou a se chamar `ia.ts` quando o provedor virou escolha também, junto com
 * as chaves em `chaves.ts` — e porque é `config/ia.json` que ele grava.)
 */

import { z } from 'zod'
import * as store from './config-store.js'
import type { ProviderId } from './providers/types.js'

const IaSchema = z
  .object({
    modelos: z.record(z.string(), z.string()),
    /** Ausente = ordem padrão do `provider.ts`. */
    provedor: z.string().optional(),
  })
  .strict()

type Ia = z.infer<typeof IaSchema>

const PADRAO: Ia = { modelos: {} }

function ler(): Ia {
  return store.read('ia', IaSchema, PADRAO)
}

function gravar(ia: Ia): void {
  store.write('ia', IaSchema.parse(ia))
}

export function modeloEscolhido(provedor: string): string | undefined {
  return ler().modelos[provedor]
}

export function escolherModelo(provedor: string, modelo: string): void {
  const atual = ler()
  gravar({ ...atual, modelos: { ...atual.modelos, [provedor]: modelo } })
}

/**
 * Provedor preferido, ou `undefined` para a ordem padrão.
 *
 * Diferente de `AI_PROVIDER`, isto **ordena** em vez de forçar: se a chave do
 * preferido não valer, o outro ainda atende. A env var continua sendo a forma
 * de dizer "este e mais nenhum", porque quem a define está automatizando algo e
 * prefere erro a substituição silenciosa.
 */
export function provedorPreferido(): string | undefined {
  return ler().provedor
}

export function preferirProvedor(id: ProviderId | null): void {
  const { provedor: _antigo, ...resto } = ler()
  gravar(id ? { ...resto, provedor: id } : resto)
}
