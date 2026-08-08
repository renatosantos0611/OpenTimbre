/**
 * Catálogo de plugins que a app sabe controlar.
 *
 * A IA escolhe entre eles chamando a tool correspondente, e
 * acrescentar um novo é preencher um `PluginSpec` e registrá-lo aqui — o
 * schema, o system prompt e o envio MIDI se ajustam sozinhos.
 *
 * O que **não** se ajusta sozinho é o mapa de CC: cada plugin precisa da sua
 * passada de Fase 0 (`npm run probe`) para descobrir a que CC cada knob responde.
 */

import { gojira } from './gojira.js'
import { petrucci } from './petrucci.js'
import { soldano } from './soldano.js'
import { timHenson } from './tim-henson.js'
import type { PluginSpec } from './types.js'

export * from './cena.js'
export * from './types.js'

export const CATALOGO: readonly PluginSpec[] = [gojira, soldano, timHenson, petrucci]

export function porId(id: string): PluginSpec | undefined {
  return CATALOGO.find((p) => p.id === id)
}

/** O plugin usado quando não há escolha explícita — o REPL e o probe operam nele. */
export function padrao(): PluginSpec {
  const primeiro = CATALOGO[0]
  if (!primeiro) throw new Error('Catálogo de plugins vazio.')
  return primeiro
}

/**
 * Como `porId`, mas explode em vez de devolver `undefined`. Para os caminhos em
 * que o id veio de uma rig salva: um id desconhecido ali significa arquivo de
 * outra versão da app, e seguir com o plugin errado mandaria CCs sem sentido.
 */
export function exigir(id: string): PluginSpec {
  const spec = porId(id)
  if (!spec) {
    throw new Error(
      `Plugin '${id}' não está no catálogo. Conhecidos: ${CATALOGO.map((p) => p.id).join(', ')}`,
    )
  }
  return spec
}
