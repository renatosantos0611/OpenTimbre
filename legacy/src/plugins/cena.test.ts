/**
 * Comportamento da tradução de cena em CCs.
 *
 * Estes testes usam um `PluginSpec` de mentira, não um do catálogo. É
 * deliberado: aqui se está verificando a **regra** (knob de pedal desligado vai
 * para o repouso, amp sem o controle não recebe o CC), e amarrar isso aos
 * números reais do Gojira faria a suíte quebrar toda vez que uma sondagem de
 * Fase 0 corrigisse um CC. Os números reais são conferidos em `catalogo.test.ts`.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { planScene } from './cena.js'
import {
  getAmpStrategy,
  knobToMidi,
  toggleToMidi,
  type FixedParamSpec,
  type ParamSpec,
  type PluginSpec,
} from './types.js'

// ------------------------------------------------------------------ fixture

const FALSO: PluginSpec = {
  id: 'falso',
  nome: 'Plugin de Teste',
  quando: 'nunca — é fixture',
  cadeia: 'OD → AMP → RVB',
  doc: 'inexistente.md',

  amps: ['A', 'B'],
  ampDesc: { A: 'amp a', B: 'amp b' },
  ampSelect: { cc: 20, valores: { A: 0, B: 127 } },
  ampCore: ['gain'],
  ampParams: {
    gain: { type: 'knob', required: true, desc: 'ganho' },
    // Só o amp A tem: serve para provar que o CC ausente não é enviado.
    bright: { type: 'toggle', required: false, desc: 'brilho' },
    eqOn: { type: 'toggle', required: false, desc: 'eq' },
    eq1: { type: 'knob', required: false, off: 5, desc: 'banda; 5 = flat' },
  } satisfies Record<string, ParamSpec>,
  ampCC: {
    A: { gain: 21, bright: 22, eqOn: 23, eq1: 24 },
    B: { gain: 31, eqOn: 33, eq1: 34 },
  },
  params: {
    odOn: { cc: 40, type: 'toggle', required: true, desc: 'od ligado' },
    odDrive: { cc: 41, type: 'knob', required: false, desc: 'drive' },
    modo: {
      cc: 42,
      type: 'select',
      required: false,
      options: { SECO: 0, MOLHADO: 127 },
      desc: 'modo',
    },
  } satisfies Record<string, FixedParamSpec>,
  grupos: { odOn: ['odDrive'], eqOn: ['eq1'] },
  sempreLigado: { secaoA: 110, secaoB: 111 },

  app: {
    candidatos: ['C:\\falso.exe'],
    processo: 'falso.exe',
    settings: 'falso',
    pastaMidi: 'MIDI',
    mapeamento: 'falso.xml',
  },
}

const manual = getAmpStrategy(FALSO, 'manual')

/** As mensagens viram um mapa CC → valor, que é como se lê um plano. */
function porCC(plano: { mensagens: readonly { cc: number; valor: number }[] }) {
  return new Map(plano.mensagens.map((m) => [m.cc, m.valor]))
}

// ------------------------------------------------------------------ escalas

describe('escalas', () => {
  test('o knob vai de 0–10 para 0–127 nas pontas', () => {
    assert.equal(knobToMidi(0), 0)
    assert.equal(knobToMidi(10), 127)
  })

  test('o knob clampa fora da faixa em vez de estourar', () => {
    assert.equal(knobToMidi(-3), 0)
    assert.equal(knobToMidi(99), 127)
  })

  test('o toggle é 0 ou 127, nunca um meio-termo', () => {
    assert.equal(toggleToMidi(true), 127)
    assert.equal(toggleToMidi(false), 0)
  })
})

// -------------------------------------------------------------------- cena

describe('planScene', () => {
  const cenaBase = { gain: 5, odOn: false }

  test('liga todas as seções antes de qualquer parâmetro', () => {
    const plano = planScene(FALSO, cenaBase, 'A', manual)
    const primeiros = plano.mensagens.slice(0, 2)
    assert.deepEqual(primeiros, [
      { cc: 110, valor: 127 },
      { cc: 111, valor: 127 },
    ])
  })

  test('manda os CCs do amp escolhido', () => {
    const ccs = porCC(planScene(FALSO, cenaBase, 'A', manual))
    assert.equal(ccs.get(21), knobToMidi(5), 'gain do amp A')

    const ccsB = porCC(planScene(FALSO, cenaBase, 'B', manual))
    assert.equal(ccsB.get(31), knobToMidi(5), 'gain do amp B')
    assert.equal(ccsB.get(21), undefined, 'o CC do outro amp não pode vazar')
  })

  test('não manda o controle que o amp não tem', () => {
    const ccs = porCC(planScene(FALSO, { ...cenaBase, bright: true }, 'B', manual))
    assert.equal(ccs.get(22), undefined, 'o amp B não tem bright — nada a enviar')
  })

  test('toggle omitido vira desligado, nunca silêncio', () => {
    // Cena sem `odOn`: a app precisa mandar 0, senão o pedal do preset continua ligado.
    const ccs = porCC(planScene(FALSO, { gain: 5 }, 'A', manual))
    assert.equal(ccs.get(40), 0)
  })

  test('knob de pedal desligado vai para o valor de repouso', () => {
    const ccs = porCC(planScene(FALSO, { gain: 5, eqOn: false }, 'A', manual))
    assert.equal(ccs.get(24), knobToMidi(5), 'banda de EQ em repouso é 5 (flat), não 0')
  })

  test('knob de pedal ligado usa o valor da cena', () => {
    const cena = { gain: 5, odOn: true, odDrive: 8 }
    assert.equal(porCC(planScene(FALSO, cena, 'A', manual)).get(41), knobToMidi(8))
  })

  test('knob sem valor e sem repouso não é enviado', () => {
    // `odDrive` só entra em repouso porque `odOn` é false; com ele true e o
    // knob ausente, não há valor a inventar.
    const ccs = porCC(planScene(FALSO, { gain: 5, odOn: true }, 'A', manual))
    assert.equal(ccs.get(41), undefined)
  })

  test('select resolve pelo nome e ignora nome inventado', () => {
    const bom = porCC(planScene(FALSO, { ...cenaBase, modo: 'MOLHADO' }, 'A', manual))
    assert.equal(bom.get(42), 127)

    const ruim = porCC(planScene(FALSO, { ...cenaBase, modo: 'INEXISTENTE' }, 'A', manual))
    assert.equal(ruim.get(42), undefined, 'nome fora das opções não vira CC')
  })
})

// -------------------------------------------------------- estratégias de amp

describe('estratégia de amp', () => {
  const cena = { gain: 5, odOn: false }

  test('manual não manda MIDI e devolve a instrução', () => {
    const plano = planScene(FALSO, cena, 'B', getAmpStrategy(FALSO, 'manual'))
    assert.match(plano.ampInstruction ?? '', /selecione o amp B/)
    assert.equal(porCC(plano).get(20), undefined)
  })

  test('continuous manda o valor do seletor e não instrui nada', () => {
    const plano = planScene(FALSO, cena, 'B', getAmpStrategy(FALSO, 'continuous'))
    assert.equal(plano.ampInstruction, null)
    assert.equal(porCC(plano).get(20), 127)
  })

  test('increment pulsa uma vez por posição de distância', () => {
    const plano = planScene(FALSO, cena, 'B', getAmpStrategy(FALSO, 'increment'))
    const pulsos = plano.mensagens.filter((m) => m.cc === 20)
    assert.deepEqual(pulsos, [
      { cc: 20, valor: 127 },
      { cc: 20, valor: 0 },
    ])
  })

  test('estratégia desconhecida falha na hora, não no meio de um take', () => {
    assert.throws(() => getAmpStrategy(FALSO, 'teleporte'), /manual \| continuous \| increment/)
  })
})

// ------------------------------------------------------------- amp mapeado

describe('amp sem knobs mapeados', () => {
  const SEM_B: PluginSpec = { ...FALSO, ampCC: { A: FALSO.ampCC.A!, B: {} } }

  test('cai no amp que existe e avisa, em vez de mexer no amp errado', () => {
    const plano = planScene(SEM_B, { gain: 5, odOn: false }, 'B', manual)
    assert.equal(plano.amp, 'A')
    assert.match(plano.warning ?? '', /ainda não tem knobs mapeados/)
    assert.equal(porCC(plano).get(21), knobToMidi(5), 'os knobs foram para o amp A')
  })
})
