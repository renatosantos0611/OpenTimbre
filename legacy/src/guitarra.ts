/**
 * A guitarra que está na mão do guitarrista.
 *
 * O plugin não faz ideia disso — captador, volume e tone ficam do lado de cá do
 * cabo. Sem essa informação a IA recomendaria "captador de ponte humbucker"
 * para quem tem uma Stratocaster. Vai para o system prompt, não para o MIDI.
 */

import { z } from 'zod'
import * as store from './config-store.js'

export const CAPTADORES = ['single', 'humbucker', 'HSS', 'HSH', 'P90', 'outro'] as const

export const GuitarraSchema = z
  .object({
    modelo: z.string(),
    captadores: z.enum(CAPTADORES),
    afinacao: z.string(),
    cordas: z.number().int().min(6).max(8),
  })
  .strict()

export type Guitarra = z.infer<typeof GuitarraSchema>

/** Vazio de propósito: enquanto o usuário não configurar, a IA fala de forma genérica. */
export const PADRAO: Guitarra = {
  modelo: '',
  captadores: 'humbucker',
  afinacao: 'E padrão',
  cordas: 6,
}

export function load(): Guitarra {
  return store.read('guitarra', GuitarraSchema, PADRAO)
}

export function save(g: Guitarra): string {
  return store.write('guitarra', GuitarraSchema.parse(g))
}

/**
 * Bloco anexado ao system prompt. Devolve string vazia quando não há modelo —
 * inventar uma guitarra padrão seria pior do que não dizer nada, porque a IA
 * passaria a recomendar captadores que talvez não existam no instrumento.
 */
export function toPrompt(g: Guitarra): string {
  if (!g.modelo.trim()) return ''

  return [
    '\n## A guitarra do guitarrista\n',
    `- Modelo: ${g.modelo}`,
    `- Captadores: ${g.captadores}`,
    `- Afinação: ${g.afinacao}`,
    `- Cordas: ${g.cordas}`,
    '',
    'Recomende captador, volume e tone que existam **nesta** guitarra. Se ela não',
    'tiver humbucker, não peça humbucker; se a afinação for mais grave que a da',
    'gravação, leve isso em conta no grave e no gate.',
    '',
  ].join('\n')
}
