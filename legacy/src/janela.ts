/**
 * Estado da janela flutuante, guardado entre sessões.
 *
 * Ela é uma extensão do plugin: o guitarrista encosta ela na lateral do Gojira
 * uma vez e espera encontrá-la lá na próxima abertura. Sem persistir, o
 * Electron reabriria centralizada toda vez, por cima do plugin.
 */

import { z } from 'zod'
import * as store from './config-store.js'

export const LARGURA_PADRAO = 420
export const ALTURA_PADRAO = 700
export const LARGURA_MIN = 360
export const ALTURA_MIN = 520

/** Opacidade quando outra janela está em foco. */
export const OPACIDADE_SEM_FOCO = 0.72

export const JanelaSchema = z
  .object({
    largura: z.number().int().min(LARGURA_MIN),
    altura: z.number().int().min(ALTURA_MIN),
    /** Ausentes na primeira abertura: aí o Electron decide onde centralizar. */
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    sempreNoTopo: z.boolean(),
    escurecerSemFoco: z.boolean(),
    /**
     * Aplica sozinha a cena quando a IA responde com uma sugestão só (a rig
     * tem uma única cena) — o guitarrista não precisa clicar no cartão. Rig
     * com mais de uma cena (base + solo, por exemplo) nunca aplica sozinha:
     * aplicar a errada por engano é pior do que pedir um clique a mais.
     *
     * `.default(false)`, não `z.boolean()` cru: um `config/janela.json` salvo
     * antes deste campo existir não o traz, e com `.strict()` isso faria o
     * parse falhar por inteiro — resetando também largura, altura e posição
     * da janela de quem já a tinha encostado no lugar certo. O default deixa
     * o arquivo antigo continuar válido, só preenchendo o que falta.
     *
     * Default `false`: aplicar manda MIDI de verdade, e a app não deveria
     * assumir esse efeito colateral sem o guitarrista ligar por conta própria.
     */
    autoAplicar: z.boolean().default(false),
  })
  .strict()

export type Janela = z.infer<typeof JanelaSchema>

export const PADRAO: Janela = {
  largura: LARGURA_PADRAO,
  altura: ALTURA_PADRAO,
  sempreNoTopo: true,
  escurecerSemFoco: true,
  autoAplicar: false,
}

export function load(): Janela {
  return store.read('janela', JanelaSchema, PADRAO)
}

export function save(j: Janela): string {
  return store.write('janela', JanelaSchema.parse(j))
}
