/**
 * Neural DSP Archetype: Petrucci X.
 *
 * O primeiro plugin do catálogo com **quatro** amps, e o primeiro em que um
 * deles não é um amplificador: o PIEZO é o preamp do captador piezo do Music
 * Man Majesty, sem estágio de ganho nenhum. É por causa dele que `AMP_CORE`
 * aqui não pode conter `gain` — o que sobra de comum aos quatro é o tonestack
 * mais presence e output.
 *
 * Nomes internos (o `target=""` do XML) saíram do appModel do próprio plugin,
 * decodificado do `.settings` — o método e a validação dele estão no cabeçalho
 * de `midi-mapping/petrucci-neural-ai.xml`. Duas consequências que valem
 * lembrar aqui, porque contrariam a analogia com os plugins vizinhos:
 *
 * - **`Middle` não é uniforme**: `piezoMiddle` e `rhythmMiddle`, mas `cleanMid`
 *   e `leadMid`. O nome abstrato continua sendo `mid` para os quatro — quem
 *   traduz é o XML.
 * - **Level/Output vem invertido em relação ao Tim Henson.** Lá o trim de saída
 *   se chama `*Output` por dentro e "Level" na GUI; aqui a GUI diz "Output" e o
 *   nome interno é `*Level`. Os nomes abstratos abaixo seguem o resto da app
 *   (`output` = trim, `level` = Master), que é o que a IA já conhece dos outros
 *   plugins; as descrições citam o rótulo da GUI do Petrucci, que é o que o
 *   guitarrista lê na tela.
 *
 * O que ainda **não** está confirmado é comportamento, não nome: a Fase 0
 * (`PLUGIN=petrucci npm run probe`) é que diz se cada CC responde, e sobretudo
 * em que valor MIDI cai cada uma das quatro posições de `ampSelect` — os
 * 0/42/85/127 abaixo são a hipótese do `AudioParameterChoice` do JUCE, não
 * medição.
 *
 * Ausências deliberadas, ambas pelo teto de ~100 mapeamentos:
 *
 * - **O cabinete inteiro** (2 mics × tipo/posição/distância/nível/pan/fase, mais
 *   2 rooms): microfonação de estúdio, que a spec põe fora de escopo.
 * - **As bandas do EQ paramétrico**: 4 Freq + 4 Gain + HPF + LPF por amp, vezes
 *   3 amps, dariam 30 mapeamentos sozinhas. Só os toggles entram, e o papel
 *   deles é o mesmo do Tim Henson — **desligar** o EQ que veio do preset para
 *   ele não colorir a cena. Sem knobs de banda, `eqOn` não entra em `AMP_GROUPS`.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.js'

// ---------------------------------------------------------------- amplificador

const AMPS = ['PIEZO', 'CLEAN', 'RHYTHM', 'LEAD'] as const

const AMP_DESC: Record<string, string> = {
  PIEZO:
    'preamp do captador piezo do Music Man Majesty (interno: `piezo*`) — som quase de violão, ' +
    'sem estágio de ganho nenhum; é o único que não tem Gain nem Master, e o único com Body e Air',
  CLEAN:
    'limpo de headroom alto (interno: `clean*`) — cristalino e com sparkle quando o Bright está ' +
    'ligado; a base dos arpejos e dos limpos com chorus e delay do prog',
  RHYTHM:
    'crunch a alto ganho, apertado (interno: `rhythm*`) — o canal de riff: Tight limpa o grave ' +
    'antes do preamp, Bite acrescenta ataque e Mid Boost joga os médios para a frente',
  LEAD:
    'alto ganho cantado (interno: `lead*`) — o canal de solo, com compressão e sustain longos ' +
    'para legato; Soar é o realce que faz a nota flutuar por cima da banda',
}

// ------------------------------------------------------- parâmetros por amp

/**
 * Os quatro amps não compartilham nada: o `bass` do PIEZO e o do LEAD são
 * parâmetros distintos no plugin. O nome aqui é abstrato — é o que a IA vê — e
 * o CC concreto sai de `AMP_CC`.
 *
 * A regra de `required` segue a do resto do catálogo, com uma consequência que
 * vale explicitar: **toggle sempre resolve** (ausente vira `false`), então
 * `required: false` num toggle continua determinístico. Num knob, não — knob
 * ausente e fora de grupo não é enviado, e o valor do preset sobrevive. Por
 * isso todo knob de amp aqui é obrigatório, inclusive os que só um amp tem
 * (`body`, `tight`): o amp que não os tem simplesmente não recebe nada.
 */
const AMP_PARAMS = {
  gain: {
    type: 'knob',
    required: true,
    desc: 'ganho do preamp (o PIEZO não tem, é ignorado nele)',
  },
  bass: { type: 'knob', required: true, desc: 'graves do amp' },
  mid: {
    type: 'knob',
    required: true,
    desc: 'médios do amp — decide se a guitarra aparece ou some na mix',
  },
  treble: { type: 'knob', required: true, desc: 'agudos do amp' },
  presence: {
    type: 'knob',
    required: true,
    desc: 'realça médio-agudo e a definição do ataque — os quatro amps têm',
  },
  level: {
    type: 'knob',
    required: true,
    desc: 'Master: volume do estágio de potência — abrir muda o caráter, não só o volume (o PIEZO não tem, é ignorado nele)',
  },
  output: {
    type: 'knob',
    required: true,
    desc: 'Output: trim de saída — equilibra o volume entre cenas sem mexer no timbre',
  },

  /**
   * Só o PIEZO tem. Obrigatório pelo mesmo motivo que o `blend` do Tim Henson:
   * é o controle que define o caráter do amp, e deixar a IA omiti-lo faria a
   * cena herdar o valor do preset justamente onde ela mais precisa mandar.
   */
  body: {
    type: 'knob',
    required: true,
    desc: 'Body — só o PIEZO tem: corpo e ressonância do violão simulado; abaixo de 4 fica fino e quebradiço (ignorado nos outros amps)',
  },
  air: {
    type: 'toggle',
    required: false,
    desc: 'Air — só o PIEZO tem: realce de agudo muito alto, o brilho de corda de aço (ignorado nos outros amps)',
  },

  /** Só o RHYTHM tem — mesma justificativa de `body` para o `required`. */
  tight: {
    type: 'knob',
    required: true,
    desc: 'Tight — só o RHYTHM tem: corta grave ANTES do preamp, então aperta o palm mute sem afinar o som; 5–7 em riff pesado (ignorado nos outros amps)',
  },
  bite: {
    type: 'toggle',
    required: false,
    desc: 'Bite — só o RHYTHM tem: realce de ataque, faz a palhetada aparecer em riff rápido',
  },
  midBoost: {
    type: 'toggle',
    required: false,
    desc: 'Mid Boost — só o RHYTHM tem: joga os médios para a frente; tira o riff do escondido, mas atrapalha se a mix já tem teclado',
  },
  bright: {
    type: 'toggle',
    required: false,
    desc: 'switch Bright — só o CLEAN tem: acrescenta brilho e sparkle ao limpo',
  },
  soar: {
    type: 'toggle',
    required: false,
    desc: 'Soar — só o LEAD tem: realce de médios que faz a nota do solo flutuar por cima da banda; é o que dá o legato "líquido"',
  },

  /**
   * Sem as bandas mapeadas, este toggle só serve para uma coisa: garantir que o
   * EQ paramétrico do preset carregado não continue colorindo a cena. Resolve
   * para `false` quando a IA o omite, que é o comportamento desejado. O PIEZO
   * não tem EQ.
   */
  eqOn: {
    type: 'toggle',
    required: false,
    desc: 'EQ paramétrico do amp ligado — as bandas não são controláveis por aqui, então mantenha false',
  },
} as const satisfies Record<string, ParamSpec>

/**
 * Os 5 controles que os quatro amps têm. `gain` e `level` ficam de fora porque
 * o PIEZO não expõe nenhum dos dois — é preamp de piezo, não amplificador.
 */
const AMP_CORE = ['bass', 'mid', 'treble', 'presence', 'output'] as const

/**
 * CC de cada parâmetro, por amplificador. Parâmetro ausente = o amp não tem
 * esse controle no plugin: `body`/`air` só no PIEZO, `bright` só no CLEAN,
 * `tight`/`bite`/`midBoost` só no RHYTHM, `soar` só no LEAD.
 */
const AMP_CC: Record<string, Record<string, number>> = {
  PIEZO: { body: 21, air: 22, bass: 23, mid: 24, treble: 25, presence: 26, output: 27 },
  CLEAN: {
    gain: 28,
    bright: 29,
    bass: 30,
    mid: 31,
    treble: 32,
    presence: 33,
    level: 34,
    output: 35,
    eqOn: 54,
  },
  RHYTHM: {
    gain: 36,
    bite: 37,
    tight: 38,
    bass: 39,
    mid: 40,
    midBoost: 41,
    treble: 42,
    presence: 43,
    level: 44,
    output: 45,
    eqOn: 55,
  },
  LEAD: {
    gain: 46,
    bass: 47,
    mid: 48,
    soar: 49,
    treble: 50,
    presence: 51,
    level: 52,
    output: 53,
    eqOn: 56,
  },
}

// ------------------------------------------------------------------ parâmetros

/**
 * CC fixo, na ordem da cadeia de sinal. O tonestack não está aqui (é por amp,
 * fica em `AMP_CC`) — o que sobra são as utilidades globais, os cinco pedais de
 * pré, a seção Volume e os três de pós.
 */
const PARAMS = {
  gateOn: { cc: 1, type: 'toggle', required: false, desc: 'noise gate ligado' },
  gateThreshold: {
    cc: 2,
    type: 'knob',
    required: false,
    desc: 'noise gate: atenua o sinal abaixo do threshold — suba em ganho alto para calar o chiado',
  },
  /**
   * Obrigatório, ao contrário do Soldano. A app não lê o estado do plugin, e um
   * preset que viesse transposto deixaria **todas** as cenas na tonalidade
   * errada — o tipo de erro que ninguém procura no lugar certo. Exigir o campo
   * custa uma linha à IA e fecha o buraco.
   */
  transpose: {
    cc: 3,
    type: 'knob',
    required: true,
    off: 5,
    desc: 'transpõe o pitch em semitons: 5 = afinação normal (0 st), 0 = -12 st, 10 = +12 st. Use 5 salvo se o pedido citar afinação alternativa',
  },
  doublerOn: {
    cc: 4,
    type: 'toggle',
    required: false,
    desc: 'duplica o sinal para simular uma imagem estéreo mais larga',
  },
  doublerSpread: {
    cc: 5,
    type: 'knob',
    required: false,
    desc: 'defasagem entre os dois lados do doubler — quanto mais alto, mais largo o estéreo',
  },

  // ---- WAH (primeiro da cadeia)
  wahOn: { cc: 57, type: 'toggle', required: true, desc: 'wah ligado' },
  wahPosition: {
    cc: 58,
    type: 'knob',
    required: false,
    desc: 'posição do pedal de wah (0 = talão/grave, 10 = ponta/agudo). Sem pedal de expressão o wah vira um filtro fixo — 6–8 é o "cocked wah" de solo',
  },

  // ---- COMP (sem Attack, diferente do Soldano e do Tim Henson)
  compOn: { cc: 59, type: 'toggle', required: true, desc: 'compressor ligado' },
  compAmount: { cc: 60, type: 'knob', required: false, desc: 'quantidade de compressão' },
  compLevel: {
    cc: 61,
    type: 'knob',
    required: false,
    desc: 'volume de saída do compressor — compense aqui a perda de volume da compressão',
  },

  // ---- OD
  odOn: { cc: 66, type: 'toggle', required: true, desc: 'overdrive ligado' },
  odDrive: { cc: 67, type: 'knob', required: false, desc: 'drive do overdrive (baixo = boost)' },
  odTone: { cc: 68, type: 'knob', required: false, desc: 'tone do overdrive (agudos)' },
  odLevel: { cc: 69, type: 'knob', required: false, desc: 'nível do overdrive (alto = boost)' },

  // ---- PHSR
  phaserOn: { cc: 70, type: 'toggle', required: true, desc: 'phaser ligado' },
  phaserRate: { cc: 71, type: 'knob', required: false, desc: 'velocidade do phaser' },
  phaserMode: {
    cc: 72,
    type: 'toggle',
    required: false,
    desc: 'seletor entre os dois modos do phaser — qual é qual ainda não foi sondado; false é o modo padrão do plugin',
  },

  // ---- CHR (pré-amp)
  chorusOn: { cc: 73, type: 'toggle', required: true, desc: 'chorus de pré ligado' },
  chorusRate: { cc: 74, type: 'knob', required: false, desc: 'velocidade do chorus de pré' },
  chorusDepth: { cc: 75, type: 'knob', required: false, desc: 'profundidade do chorus de pré' },
  chorusLevel: { cc: 76, type: 'knob', required: false, desc: 'nível do chorus de pré' },
  chorusMode: {
    cc: 77,
    type: 'toggle',
    required: false,
    desc: 'seletor entre os dois modos do chorus de pré — qual é qual ainda não foi sondado; false é o modo padrão do plugin',
  },

  // ---- FLG
  flangerOn: { cc: 78, type: 'toggle', required: true, desc: 'flanger ligado' },
  flangerRate: { cc: 79, type: 'knob', required: false, desc: 'velocidade do flanger' },
  flangerDepth: { cc: 80, type: 'knob', required: false, desc: 'profundidade do flanger' },
  flangerRange: {
    cc: 81,
    type: 'knob',
    required: false,
    desc: 'faixa de frequência varrida pelo flanger',
  },
  flangerFeedback: {
    cc: 82,
    type: 'knob',
    required: false,
    desc: 'realimentação do flanger — acima de 7 vira jato de avião',
  },

  // ---- VOLUME (seção própria, entre o EQ e os pós-efeitos)
  /**
   * `volumeGain` é o volume da guitarra emulado. Obrigatório porque um preset
   * com ele fechado silenciaria a cena inteira sem que nada no plano de CC
   * parecesse errado, e a app não tem como ler isso do plugin.
   */
  volumeGain: {
    cc: 83,
    type: 'knob',
    required: true,
    desc: 'volume da seção Volume — mantenha em 10 salvo se o pedido pedir um som "abaixado no volume da guitarra"',
  },
  volumeMidPoint: {
    cc: 84,
    type: 'knob',
    required: true,
    desc: 'ponto médio da curva do controle de volume — 1.5 é o padrão do plugin; mexa só se o volume estiver reagindo de forma estranha',
  },

  // ---- CHR2 (pós-amp)
  chorus2On: { cc: 85, type: 'toggle', required: true, desc: 'chorus de pós ligado' },
  chorus2Mix: { cc: 86, type: 'knob', required: false, desc: 'mix do chorus de pós' },
  chorus2Rate: { cc: 87, type: 'knob', required: false, desc: 'velocidade do chorus de pós' },
  chorus2Depth: { cc: 88, type: 'knob', required: false, desc: 'profundidade do chorus de pós' },
  chorus2Mode: {
    cc: 89,
    type: 'toggle',
    required: false,
    desc: 'seletor entre os dois modos do chorus de pós — qual é qual ainda não foi sondado; false é o modo padrão do plugin',
  },

  // ---- DLY (duplo: L e R com tempos independentes)
  dlyOn: { cc: 90, type: 'toggle', required: true, desc: 'delay ligado' },
  dlyMix: { cc: 91, type: 'knob', required: false, desc: 'mix do delay' },
  dlyTimeL: { cc: 92, type: 'knob', required: false, desc: 'tempo do delay do lado esquerdo' },
  dlyTimeR: {
    cc: 93,
    type: 'knob',
    required: false,
    desc: 'tempo do delay do lado direito — diferente do esquerdo é o que espalha as repetições no estéreo; igual ao esquerdo mantém tudo no centro',
  },
  dlyFeedback: { cc: 94, type: 'knob', required: false, desc: 'repetições do delay' },
  dlyMode: {
    cc: 95,
    type: 'toggle',
    required: false,
    desc: 'seletor entre os dois modos do delay — qual é qual ainda não foi sondado; false é o modo padrão do plugin',
  },
  dlyTape: {
    cc: 96,
    type: 'knob',
    required: false,
    desc: 'saturação e wow/flutter de fita nas repetições — dá caráter analógico e escurece a cauda',
  },
  dlyModulation: {
    cc: 97,
    type: 'knob',
    required: false,
    desc: 'modulação nas repetições — em doses pequenas evita que o delay soe clonado',
  },

  // ---- RVB
  rvbOn: { cc: 98, type: 'toggle', required: true, desc: 'reverb ligado' },
  rvbMix: { cc: 99, type: 'knob', required: false, desc: 'mix do reverb (rock costuma ficar 1–3)' },
  rvbDecay: { cc: 100, type: 'knob', required: false, desc: 'duração da cauda do reverb' },
  rvbPreDelay: {
    cc: 101,
    type: 'knob',
    required: false,
    desc: 'atraso antes da cauda entrar — subir mantém o ataque da nota seco e limpo mesmo com muito reverb',
  },
  rvbShimmer: {
    cc: 102,
    type: 'toggle',
    required: false,
    desc: 'Shimmer: sobrepõe uma cauda uma oitava acima — etéreo, use com parcimônia',
  },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs que ele governa. Os quatro `*Mode` ficam de fora de propósito:
 * são switches de caráter, não dependências de "efeito desligado" — o mesmo
 * tratamento que o Gojira dá a `wowMode` e o Soldano a `bright`/`mode`.
 */
const PEDAL_GROUPS = {
  gateOn: ['gateThreshold'],
  doublerOn: ['doublerSpread'],
  wahOn: ['wahPosition'],
  compOn: ['compAmount', 'compLevel'],
  odOn: ['odDrive', 'odTone', 'odLevel'],
  phaserOn: ['phaserRate'],
  chorusOn: ['chorusRate', 'chorusDepth', 'chorusLevel'],
  flangerOn: ['flangerRate', 'flangerDepth', 'flangerRange', 'flangerFeedback'],
  chorus2On: ['chorus2Mix', 'chorus2Rate', 'chorus2Depth'],
  dlyOn: ['dlyMix', 'dlyTimeL', 'dlyTimeR', 'dlyFeedback', 'dlyTape', 'dlyModulation'],
  rvbOn: ['rvbMix', 'rvbDecay', 'rvbPreDelay'],
} as const

/**
 * Bypass de seção, forçados em 127 antes de cada cena. São **sete** aqui,
 * contra cinco do Tim Henson: o Petrucci separa Wah+Comp dos demais pré-efeitos
 * e tem uma seção Volume própria. Esquecer qualquer um deles deixaria uma parte
 * da cadeia bypassada sem que a app tivesse como perceber.
 */
const ALWAYS_ON_CC: Record<string, number> = {
  wahCompSectionOn: 110,
  preFxSectionOn: 111,
  ampSectionOn: 112,
  cabSectionOn: 113,
  eqSectionOn: 114,
  volumeSectionOn: 115,
  postFxSectionOn: 116,
}

// -------------------------------------------------------------------- o spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const petrucci: PluginSpec = {
  id: 'petrucci',
  nome: 'Archetype Petrucci X',
  quando:
    'prog metal e rock progressivo no território do Dream Theater e do Music Man Majesty — ' +
    'riff pesado mas articulado em compasso quebrado, lead de legato longo e cantado, limpos ' +
    'cristalinos com chorus e delay, e o PIEZO, um som de violão que nenhum outro plugin do ' +
    'catálogo tem. Contra o Soldano (que é o SLO-100 dos discos de 1992) escolha o Petrucci para ' +
    'o alto ganho moderno e apertado e para qualquer música que alterne elétrica e violão; ' +
    'contra o Gojira, escolha-o quando o peso vier acompanhado de melodia em vez de peso puro',
  cadeia:
    'GATE → WAH → COMP → OD → PHSR → CHR → FLG → AMP (PIEZO | CLEAN | RHYTHM | LEAD) → CAB → ' +
    'EQ paramétrico → VOLUME → CHR2 → DLY → RVB',
  doc: 'petrucci.md',

  amps: AMPS,
  ampDesc: AMP_DESC,
  /**
   * Quatro posições, não três — os valores saem da hipótese do
   * `AudioParameterChoice` do JUCE (`round(i × 127 / (N−1))`), que já bateu no
   * seletor de 3 do Gojira e no de 2 do Soldano. Confirmar com `amptest`.
   */
  ampSelect: { cc: 20, valores: { PIEZO: 0, CLEAN: 42, RHYTHM: 85, LEAD: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  grupos: PEDAL_GROUPS,
  sempreLigado: ALWAYS_ON_CC,

  app: {
    candidatos: [
      path.join(PROGRAM_FILES, 'Neural DSP', 'Archetype Petrucci X', 'Archetype Petrucci X.exe'),
    ],
    processo: 'Archetype Petrucci X.exe',
    settings: path.join('Neural DSP', 'Archetype Petrucci X'),
    pastaMidi: 'MIDI',
    mapeamento: 'petrucci-neural-ai.xml',
  },
}
