/**
 * Traduzir uma cena no que o cartão da janela mostra.
 *
 * O princípio da UI é que **parâmetro é dado, não prosa**: nenhum valor de knob
 * pode viver enterrado num parágrafo. Então o cartão tem duas regiões de dado,
 * e a regra é que elas não se repetem:
 *
 * - a **linha de faceplate**, sempre visível, com os knobs que definem o som;
 * - os **blocos de pedal**, dentro da parte colapsável, com o que cada efeito
 *   ligado está fazendo — em palavra, não em número, justamente para não
 *   repetir o que já está na linha de cima.
 *
 * Isto vive aqui, e não no renderer, por dois motivos. O renderer roda no
 * navegador e não consegue importar um `PluginSpec` (eles importam `node:path`).
 * E, mais importante, escolher *quais* parâmetros representam a cena é decisão,
 * não desenho — do mesmo tipo que `planScene` toma. Sendo função pura, dá para
 * testá-la sem abrir janela nenhuma.
 */

import type { Cena, PluginSpec } from './types.js'

export type ValorExibido = { readonly label: string; readonly valor: string }
export type PedalExibido = { readonly nome: string; readonly detalhe: string }

export type CartaoParams = {
  readonly valores: readonly ValorExibido[]
  readonly pedais: readonly PedalExibido[]
}

/**
 * Quantos valores cabem na linha antes de ela virar sopa. Seis é o que passa
 * numa janela de 420px sem quebrar em duas linhas na maioria das cenas.
 */
const MAX_VALORES = 6

/**
 * Quantos knobs um bloco de pedal descreve. O limite existe por causa do EQ
 * gráfico: `eqOn` governa nove bandas, e listar as nove daria "eq1 médio · eq2
 * médio · …" nove vezes — uma parede que não informa nada. Quatro cobre
 * inteiro qualquer pedal de verdade, e o resto vira reticência.
 */
const MAX_KNOBS_POR_PEDAL = 4

/** `dlyMix` → `DLY MIX`. A linha de faceplate é toda em caixa alta. */
export function rotulo(nome: string): string {
  return nome.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase()
}

/**
 * Knob 0–10 vira palavra. Os blocos de pedal descrevem o efeito em vez de
 * repetir número — "drive baixo · level alto" diz o que a cena faz, enquanto
 * "drive 2 · level 8" só devolve ao guitarrista o que ele já viu na linha de
 * cima e o obriga a interpretar sozinho.
 */
function grau(v: number): string {
  if (v <= 1) return 'mínimo'
  if (v <= 3.5) return 'baixo'
  if (v <= 6.5) return 'médio'
  if (v <= 9) return 'alto'
  return 'máximo'
}

/** `od1On` → `od1`; qualquer outro nome passa inteiro. */
function base(toggle: string): string {
  return toggle.endsWith('On') ? toggle.slice(0, -2) : toggle
}

/**
 * `od1Drive` sob o toggle `od1On` → `drive`. O prefixo já está no nome do bloco,
 * então repeti-lo em cada item seria ruído ("OD1 od1 drive · od1 level").
 */
function curto(knob: string, prefixo: string): string {
  const resto = knob.startsWith(prefixo) ? knob.slice(prefixo.length) : ''
  // `eq1` sob o toggle `eqOn` sobraria como "1", que sozinho não é nome de
  // nada — nesses casos o nome inteiro informa mais do que o pedaço.
  if (resto.length > 0 && !/^\d+$/.test(resto)) {
    return (resto[0]!.toLowerCase() + resto.slice(1)).replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  }
  return knob.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

/** `4.5` → `"4.5"`, `6` → `"6"` — sem zero à direita que ninguém leria. */
function numero(v: number): string {
  return String(Math.round(v * 10) / 10)
}

/**
 * A linha de faceplate: os knobs **obrigatórios**.
 *
 * O critério não é arbitrário — `required: true` já significa, no `PluginSpec`,
 * "a cena não pode deixar de trazer este valor". São exatamente os controles que
 * definem o som, e é por isso que servem de resumo dele. Os do amp vêm primeiro
 * porque é o amp que manda; os de CC fixo (que em plugins como o Soldano
 * carregam o tonestack inteiro) vêm em seguida.
 */
function valoresDe(spec: PluginSpec, cena: Cena, amp: string): ValorExibido[] {
  const out: ValorExibido[] = []
  const ccsDoAmp = spec.ampCC[amp] ?? {}

  for (const [nome, p] of Object.entries(spec.ampParams)) {
    // Parâmetro que este amp não tem nunca é enviado, então mostrá-lo mentiria.
    // O filtro por `required` também é o que mantém as 9 bandas de EQ do Gojira
    // fora da linha: elas são knobs do amp, mas opcionais, e entupiriam o
    // faceplate antes do tonestack aparecer.
    if (ccsDoAmp[nome] === undefined || !p.required || p.type !== 'knob') continue
    const v = cena[nome]
    if (typeof v === 'number') out.push({ label: rotulo(nome), valor: numero(v) })
  }

  for (const [nome, p] of Object.entries(spec.params)) {
    if (!p.required || p.type !== 'knob') continue
    const v = cena[nome]
    if (typeof v === 'number') out.push({ label: rotulo(nome), valor: numero(v) })
  }

  return out.slice(0, MAX_VALORES)
}

/**
 * Um bloco por efeito **ligado**, na ordem da cadeia de sinal (que é a ordem de
 * `grupos`). Efeito desligado não vira bloco: a cena manda os knobs dele para o
 * repouso, então não há o que contar sobre ele.
 */
function pedaisDe(spec: PluginSpec, cena: Cena): PedalExibido[] {
  const out: PedalExibido[] = []

  for (const [toggle, knobs] of Object.entries(spec.grupos)) {
    if (cena[toggle] !== true) continue

    const prefixo = base(toggle)
    const partes: string[] = []
    for (const knob of knobs) {
      const v = cena[knob]
      if (typeof v === 'number') partes.push(`${curto(knob, prefixo)} ${grau(v)}`)
    }
    if (partes.length > MAX_KNOBS_POR_PEDAL) partes.splice(MAX_KNOBS_POR_PEDAL, Infinity, '…')

    out.push({ nome: rotulo(prefixo), detalhe: partes.join(' · ') })
  }

  return out
}

export function exibirCena(spec: PluginSpec, cena: Cena, amp: string): CartaoParams {
  return { valores: valoresDe(spec, cena, amp), pedais: pedaisDe(spec, cena) }
}
