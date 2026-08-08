/**
 * Neural DSP Archetype: Tim Henson X.
 *
 * Estruturalmente é como o Gojira e não como o Soldano: **três amps
 * independentes**, cada um com o seu tonestack e o seu EQ gráfico — nada é
 * compartilhado entre eles. Por isso `AMP_CORE` volta a ter 5 chaves e o
 * tonestack vive em `AMP_PARAMS`, não em `PARAMS`.
 *
 * Nomes internos do plugin (o `target=""` do XML) não são os rótulos da GUI,
 * exatamente como no Gojira:
 *   acoustic = ROSES   · rhythm = CHERUBS · lead = PINK
 *
 * Todos os CCs abaixo espelham `midi-mapping/tim-henson-neural-ai.xml` e foram
 * **confirmados por export real** feito na janela MIDI Mappings do plugin — não
 * são palpite. O que ainda não foi confirmado é o comportamento deles: a Fase 0
 * (`PLUGIN=tim-henson npm run probe`) é que diz se cada um responde e como.
 *
 * Duas ausências deliberadas, ambas por causa do limite de ~100 mapeamentos que
 * o plugin aceita:
 *
 * - **As 30 bandas de EQ gráfico** (9 bandas + HPF/LPF por amp) ficaram fora do
 *   XML: sozinhas comeriam um terço do orçamento, e as bandas não trazem a
 *   frequência no nome, então a IA não teria como raciocinar sobre elas. Só o
 *   toggle de cada amp foi mapeado — o que sobra dele é o papel de **desligar**
 *   o EQ que veio do preset, para ele não poluir a cena aplicada. Como não há
 *   knobs de banda, `eqOn` não aparece em `AMP_GROUPS`.
 * - **A seção de cabinete inteira** (mics, posição, distância, pan, fase, room):
 *   é microfonação de estúdio, que a spec já coloca fora de escopo.
 *
 * O **Multivoicer** está quase todo no schema: dos 12 CCs mapeados, só os três
 * seletores discretos (`Root`, `Mode`, `Interval`) ficaram de fora, por falta
 * de calibração. Ver o comentário do bloco em `PARAMS`.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.js'

// ---------------------------------------------------------------- amplificador

const AMPS = ['ROSES', 'CHERUBS', 'PINK'] as const

const AMP_DESC: Record<string, string> = {
  ROSES:
    'limpo do plugin (interno: `acoustic`) — o território dos dedilhados, arpejos e do som ' +
    'quase acústico; é o único com o controle Blend',
  CHERUBS:
    'crunch articulado (interno: `rhythm`) — ganho baixo a médio com o ataque preservado, para ' +
    'riff que precisa de definição nota a nota; tem um seletor de canal próprio',
  PINK:
    'alto ganho (interno: `lead`) — o amp dos leads compressados e cantados e dos riffs pesados; ' +
    'é o único com Master separado do Level',
}

// ------------------------------------------------------- parâmetros por amp

/**
 * Os três amps não compartilham nada: o `gain` do ROSES e o do PINK são
 * parâmetros distintos no plugin. O nome aqui é abstrato — é o que a IA vê — e
 * o CC concreto sai de `AMP_CC`.
 */
const AMP_PARAMS = {
  gain: { type: 'knob', required: true, desc: 'ganho do preamp' },
  bass: { type: 'knob', required: true, desc: 'graves do amp' },
  mid: {
    type: 'knob',
    required: true,
    desc: 'médios do amp — decide se a guitarra aparece ou some na mix',
  },
  treble: { type: 'knob', required: true, desc: 'agudos do amp' },
  presence: {
    type: 'knob',
    required: false,
    desc: 'realça médio-agudo e a definição do ataque — os três amps têm',
  },
  output: {
    type: 'knob',
    required: true,
    desc: 'Level: trim de saída — equilibra o volume entre cenas sem mexer no timbre',
  },
  level: {
    type: 'knob',
    required: false,
    desc: 'Master: volume do estágio de potência — abrir muda o caráter, não só o volume (só o PINK tem)',
  },
  /**
   * Obrigatório apesar de só o ROSES ter (mesmo tratamento que o Gojira dá ao
   * `level`, que o CLN não tem): é o único controle cujo efeito ainda não foi
   * sondado, então deixar a IA omiti-lo faria a cena herdar o valor do preset
   * — justamente no knob sobre o qual não se sabe nada.
   */
  blend: {
    type: 'knob',
    required: true,
    desc: 'Blend — só o ROSES tem: mistura os dois caminhos de sinal do amp e muda bastante o caráter do limpo; 5 é o ponto de partida (ignorado nos outros amps)',
  },
  channel: {
    type: 'toggle',
    required: false,
    desc: 'seletor de canal do CHERUBS — true = o canal de mais ganho e corpo, false = o mais limpo (só o CHERUBS tem)',
  },

  /**
   * Sem as bandas, este toggle só serve para uma coisa: garantir que o EQ
   * gráfico do preset carregado não continue colorindo a cena. Ele resolve para
   * `false` quando a IA o omite, que é o comportamento desejado.
   */
  eqOn: {
    type: 'toggle',
    required: false,
    desc: 'EQ gráfico do amp ligado — as bandas não são controláveis por aqui, então mantenha false',
  },
} as const satisfies Record<string, ParamSpec>

/** Os 5 controles que todos os três amps têm — o critério de "amp mapeado". */
const AMP_CORE = ['gain', 'bass', 'mid', 'treble', 'output'] as const

/**
 * CC de cada parâmetro, por amplificador. Parâmetro ausente = o amp não tem
 * esse controle no plugin: só o ROSES tem `blend`, só o CHERUBS tem `channel`,
 * só o PINK tem `level` (Master).
 */
const AMP_CC: Record<string, Record<string, number>> = {
  ROSES: { gain: 21, bass: 22, mid: 23, treble: 24, presence: 25, blend: 26, output: 27, eqOn: 42 },
  CHERUBS: {
    gain: 28,
    channel: 29,
    bass: 30,
    mid: 31,
    treble: 32,
    presence: 33,
    output: 34,
    eqOn: 43,
  },
  PINK: { gain: 35, bass: 36, mid: 37, treble: 38, presence: 39, level: 40, output: 41, eqOn: 44 },
}

// ------------------------------------------------------------------ parâmetros

/**
 * CC fixo, na ordem da cadeia de sinal. O tonestack não está aqui (é por amp,
 * fica em `AMP_CC`) — o que sobra são as utilidades globais, os três pedais de
 * pré, os três de pós e o toggle do Multivoicer.
 */
const PARAMS = {
  gateOn: { cc: 46, type: 'toggle', required: false, desc: 'noise gate ligado' },
  gateThreshold: {
    cc: 47,
    type: 'knob',
    required: false,
    desc: 'noise gate: atenua o sinal abaixo do threshold — suba em ganho alto para calar o chiado',
  },
  doublerOn: {
    cc: 48,
    type: 'toggle',
    required: false,
    desc: 'duplica o sinal para simular uma imagem estéreo mais larga',
  },
  doublerSpread: {
    cc: 49,
    type: 'knob',
    required: false,
    desc: 'defasagem entre os dois lados do doubler — quanto mais alto, mais largo o estéreo',
  },

  // ---- BOOST (primeiro da cadeia de pré)
  boostOn: { cc: 50, type: 'toggle', required: true, desc: 'boost ligado' },
  boostGain: {
    cc: 51,
    type: 'knob',
    required: false,
    desc: 'ganho do boost — baixo aperta o grave e empurra o amp sem sujar',
  },
  boostLevel: { cc: 52, type: 'knob', required: false, desc: 'nível de saída do boost (alto = boost)' },
  boostBass: {
    cc: 53,
    type: 'knob',
    required: false,
    desc: 'graves do boost — baixar limpa o grave antes do amp, que é o uso clássico',
  },
  boostTreble: { cc: 54, type: 'knob', required: false, desc: 'agudos do boost' },

  // ---- COMP
  compOn: { cc: 55, type: 'toggle', required: true, desc: 'compressor ligado' },
  compAmount: { cc: 56, type: 'knob', required: false, desc: 'quantidade de compressão' },
  compLevel: {
    cc: 57,
    type: 'knob',
    required: false,
    desc: 'volume de saída do compressor — compense aqui a perda de volume da compressão',
  },
  compAttack: {
    cc: 58,
    type: 'toggle',
    required: false,
    desc: 'ataque do compressor — true = Fast (esmaga o ataque), false = Slow (deixa a palhetada passar)',
  },

  // ---- OD
  odOn: { cc: 60, type: 'toggle', required: true, desc: 'overdrive ligado' },
  odDrive: { cc: 61, type: 'knob', required: false, desc: 'drive do overdrive (baixo = boost)' },
  odTone: { cc: 62, type: 'knob', required: false, desc: 'tone do overdrive (agudos)' },
  odLevel: { cc: 63, type: 'knob', required: false, desc: 'nível do overdrive (alto = boost)' },

  /**
   * ---- MULTIVOICER (harmonizador polifônico, CC 80–91)
   *
   * A feature-assinatura do plugin. A primeira versão deste arquivo deixou o
   * bloco inteiro fora do schema, o que estava errado: a maioria dos CCs é de
   * toggle e knob contínuo, que não dependem de sondagem nenhuma — toggle é
   * 0/127 e knob é 0–127, como em qualquer outro parâmetro. Só os **seletores
   * de altura** dependem de calibração: `Root` (81), `Mode` (82) e o `Interval`
   * de cada voz (85, 88, 93, 96), onde não se sabe qual valor MIDI cai em qual
   * nota, modo ou grau.
   *
   * Então o corte é esse: a app controla tudo, menos a altura das vozes. A IA
   * liga o bloco, escolhe quais das **quatro** vozes tocam, equilibra o nível
   * de cada uma e abre o estéreo; só o intervalo continua saindo do preset e
   * precisa ser conferido à mão até a Fase 0 (`sweep 93`) fechar a calibração.
   *
   * Os CC 98–101 (`Semitones` das quatro vozes) estão no XML mas fora daqui de
   * propósito: existem para responder, com `sweep`, se quem manda no intervalo
   * em modo cromático é o `Interval` ou o `Semitones` — ver capabilities.md.
   *
   * `multivoicerOn` resolve para `false` quando a IA o omite, o que também
   * protege contra um preset que já viesse com o harmonizador ligado — a app
   * não lê o estado do plugin, então sem isso ele contaminaria todas as cenas.
   */
  multivoicerOn: {
    cc: 80,
    type: 'toggle',
    required: false,
    desc: 'harmonizador Multivoicer ligado — ligue quando o pedido pedir harmonia (terças, quintas, oitavas) ou a textura de várias guitarras do Polyphia',
  },
  multivoicerQuantize: {
    cc: 83,
    type: 'toggle',
    required: false,
    desc: 'quantiza as vozes na escala definida por Root/Mode — como esses dois não são ajustáveis por aqui, mantenha false: assim o intervalo é cromático e vale em qualquer tonalidade',
  },
  multivoicerVoice1On: { cc: 84, type: 'toggle', required: false, desc: 'voz 1 do Multivoicer ligada' },
  multivoicerVoice1Level: {
    cc: 86,
    type: 'knob',
    required: false,
    desc: 'nível da voz 1 — abaixo do sinal seco (3–6) a harmonia engrossa sem competir com a melodia',
  },
  multivoicerVoice2On: { cc: 87, type: 'toggle', required: false, desc: 'voz 2 do Multivoicer ligada' },
  multivoicerVoice2Level: {
    cc: 89,
    type: 'knob',
    required: false,
    desc: 'nível da voz 2 — costuma ficar abaixo da voz 1',
  },
  multivoicerVoice3On: { cc: 92, type: 'toggle', required: false, desc: 'voz 3 do Multivoicer ligada' },
  multivoicerVoice3Level: {
    cc: 94,
    type: 'knob',
    required: false,
    desc: 'nível da voz 3 — com 3 ou 4 vozes o conjunto vira acorde, então mantenha cada voz mais baixa que a anterior',
  },
  multivoicerVoice4On: { cc: 95, type: 'toggle', required: false, desc: 'voz 4 do Multivoicer ligada' },
  multivoicerVoice4Level: {
    cc: 97,
    type: 'knob',
    required: false,
    desc: 'nível da voz 4 — a mais baixa do conjunto; acima de 5 o acorde engole a melodia',
  },
  multivoicerWidth: {
    cc: 90,
    type: 'knob',
    required: false,
    desc: 'abertura estéreo entre as vozes: 0 = tudo no centro, 10 = vozes bem separadas nos lados',
  },
  multivoicerOutput: {
    cc: 91,
    type: 'knob',
    required: false,
    desc: 'volume geral do bloco Multivoicer — use para dosar a harmonia inteira contra o sinal seco',
  },

  // ---- CHR
  chorusOn: { cc: 65, type: 'toggle', required: true, desc: 'chorus ligado' },
  chorusMix: { cc: 66, type: 'knob', required: false, desc: 'mix do chorus' },

  // ---- DLY
  dlyOn: { cc: 70, type: 'toggle', required: true, desc: 'delay ligado' },
  dlyMix: { cc: 71, type: 'knob', required: false, desc: 'mix do delay' },
  dlyTime: { cc: 72, type: 'knob', required: false, desc: 'tempo do delay' },
  dlyFeedback: { cc: 73, type: 'knob', required: false, desc: 'repetições do delay' },

  // ---- RVB
  rvbOn: { cc: 75, type: 'toggle', required: true, desc: 'reverb ligado' },
  rvbMix: { cc: 76, type: 'knob', required: false, desc: 'mix do reverb (rock costuma ficar 1–3)' },
  rvbDecay: { cc: 77, type: 'knob', required: false, desc: 'duração da cauda do reverb' },
  rvbShimmer: {
    cc: 78,
    type: 'knob',
    required: false,
    desc: 'shimmer: acrescenta uma oitava acima na cauda do reverb — etéreo em doses pequenas, sintético acima de 4',
  },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs que ele governa. `compAttack` e `channel` ficam de fora de
 * propósito: são switches de caráter, não dependências de "efeito desligado" —
 * o mesmo tratamento que o Gojira dá a `wowMode` e o Soldano a `bright`/`mode`.
 */
const PEDAL_GROUPS = {
  gateOn: ['gateThreshold'],
  doublerOn: ['doublerSpread'],
  boostOn: ['boostGain', 'boostLevel', 'boostBass', 'boostTreble'],
  compOn: ['compAmount', 'compLevel'],
  odOn: ['odDrive', 'odTone', 'odLevel'],
  multivoicerOn: ['multivoicerWidth', 'multivoicerOutput'],
  multivoicerVoice1On: ['multivoicerVoice1Level'],
  multivoicerVoice2On: ['multivoicerVoice2Level'],
  multivoicerVoice3On: ['multivoicerVoice3Level'],
  multivoicerVoice4On: ['multivoicerVoice4Level'],
  chorusOn: ['chorusMix'],
  dlyOn: ['dlyMix', 'dlyTime', 'dlyFeedback'],
  rvbOn: ['rvbMix', 'rvbDecay', 'rvbShimmer'],
} as const

/**
 * Bypass de seção, forçados em 127 antes de cada cena. Diferente do que o
 * Soldano fez supor, o Henson **não** compartilha os nomes internos do Gojira
 * (`pedalsActiveID`/`fxActive`): aqui são `preFXActive`/`postFXActive` — ver o
 * cabeçalho do XML.
 *
 * `eqSectionOn` é o bypass da seção EQ inteira e entra aqui; o switch criativo
 * do EQ é o `eqOn` por amp (CC 42/43/44), que a IA controla.
 */
const ALWAYS_ON_CC: Record<string, number> = {
  preFxSectionOn: 110,
  ampSectionOn: 111,
  cabSectionOn: 112,
  eqSectionOn: 113,
  postFxSectionOn: 114,
}

// -------------------------------------------------------------------- o spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const timHenson: PluginSpec = {
  id: 'tim-henson',
  nome: 'Archetype Tim Henson X',
  quando:
    'instrumental moderno e progressivo no território do Polyphia — limpos elaborados com ' +
    'dedilhado e tapping, crunch articulado nota a nota, leads compressados e cantados, muito ' +
    'delay e reverb; escolha quando o pedido pede clareza, dinâmica e som quase acústico em vez ' +
    'do peso do Gojira ou do overdrive vintage do Soldano',
  cadeia:
    'GATE → BOOST → COMP → OD → AMP (ROSES | CHERUBS | PINK) → CAB → MULTIVOICER → EQ gráfico → ' +
    'CHR → DLY → RVB',
  doc: 'tim-henson.md',

  amps: AMPS,
  ampDesc: AMP_DESC,
  ampSelect: { cc: 20, valores: { ROSES: 0, CHERUBS: 64, PINK: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  grupos: PEDAL_GROUPS,
  sempreLigado: ALWAYS_ON_CC,

  app: {
    candidatos: [
      path.join(
        PROGRAM_FILES,
        'Neural DSP',
        'Archetype Tim Henson X',
        'Archetype Tim Henson X.exe',
      ),
    ],
    processo: 'Archetype Tim Henson X.exe',
    settings: path.join('Neural DSP', 'Archetype Tim Henson X'),
    pastaMidi: 'MIDI',
    mapeamento: 'tim-henson-neural-ai.xml',
  },
}
