/**
 * O tema da janela.
 *
 * Por muito tempo houve só o escuro, e a justificativa estava escrita no topo do
 * `styles.css`: a janela mora encostada num plugin de áudio, e plugin de áudio é
 * escuro em qualquer configuração de SO. O que essa regra esquecia é que a
 * janela também é lida de dia, longe do plugin — escrevendo o pedido, olhando o
 * histórico — e aí o escuro deixa de ser vantagem.
 *
 * Então são três opções, e `sistema` é uma delas porque quem já escolheu claro
 * no Windows não deveria ter que escolher de novo aqui.
 *
 * Este módulo é também o dono das **cores do cromo nativo**. Elas não podem sair
 * do CSS: quem pinta o fundo da janela antes da primeira renderização e os
 * botões de minimizar/fechar é o Electron, e ele não lê folha de estilo.
 */

import { z } from 'zod'
import * as store from './config-store.js'

export const TemaSchema = z.enum(['sistema', 'claro', 'escuro'])
export type Tema = z.infer<typeof TemaSchema>

/** O tema que a tela de fato usa — `sistema` já resolvido para um dos dois. */
export type TemaResolvido = 'claro' | 'escuro'

/**
 * Escuro, não `sistema`: a app nasceu escura e mudar o default faria a janela
 * de quem já a usa trocar de cor sozinha numa atualização.
 */
export const PADRAO: Tema = 'escuro'

const ArquivoSchema = z.object({ tema: TemaSchema }).strict()

export function load(): Tema {
  return store.read('tema', ArquivoSchema, { tema: PADRAO }).tema
}

export function save(tema: Tema): string {
  return store.write('tema', ArquivoSchema.parse({ tema }))
}

/**
 * Fundo da janela e cor dos botões nativos da barra de título, por tema.
 *
 * Espelham `--shell` e `--dim` do `styles.css` — os dois únicos tokens que
 * precisam existir dos dois lados. Se a paleta mudar lá, muda aqui: sem isto a
 * barra de título fica escura numa janela clara, que é o defeito mais visível
 * que um tema mal aplicado produz.
 */
export const CROMO: Record<TemaResolvido, { fundo: string; simbolo: string }> = {
  escuro: { fundo: '#121214', simbolo: '#a4a1ae' },
  claro: { fundo: '#f6f4f0', simbolo: '#56545e' },
}
