/**
 * Neural DSP Archetype: Gojira.
 *
 * Tudo que descreve o plugin — mapa de CC, faixas, amps, quais parâmetros são
 * obrigatórios, quais knobs pertencem a qual pedal — mora aqui. O schema zod, a
 * doc injetada no system prompt e o envio MIDI são todos derivados deste
 * arquivo. Se a Fase 0 mostrar que um CC está errado, muda-se só aqui.
 *
 * Os CCs espelham `midi-mapping/gojira-neural-ai.xml`, que mapeia os 118
 * parâmetros do plugin. Nem todos são expostos à IA: seletores discretos que
 * ainda não foram confirmados na Fase 0 (cabType, delaySyncNote) ficam de fora
 * do schema mas continuam acessíveis pelo comando `set` do probe.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.js'

// ---------------------------------------------------------------- amplificador

const AMPS = ['CLN', 'RUST', 'HOT'] as const

const AMP_DESC: Record<string, string> = {
  CLN: 'limpo vintage (Fender Twin Reverb), headroom alto, satura bem se abrir o gain',
  RUST: 'crunch a alto ganho (EVH 5150 III Blue), faixa de ganho enorme, o mais versátil',
  HOT: 'ganho extremo (EVH 5150 III Red), metal moderno, muito comprimido',
}

// ------------------------------------------------------- parâmetros por amp

/**
 * Os três amps NÃO compartilham controles: o ganho do CLN e o do RUST são
 * parâmetros distintos no plugin, com nomes diferentes. Cada amp tem também o
 * seu próprio EQ gráfico de 9 bandas. Então o parâmetro tem um nome abstrato
 * aqui — que é o que a IA vê — e o CC concreto sai da tabela `AMP_CC`.
 *
 * Nomes internos do plugin: CLN = `clean*`, RUST = `rhythm*`, HOT = `lead*`.
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
  level: {
    type: 'knob',
    required: true,
    desc: 'Master: volume do estágio de potência — abrir muda o caráter, não só o volume (o CLN não tem, é ignorado nele)',
  },
  output: {
    type: 'knob',
    required: true,
    desc: 'Level: trim de saída — equilibra o volume entre cenas sem mexer no timbre',
  },
  presence: {
    type: 'knob',
    required: false,
    desc: 'realça médio-agudo e a definição do ataque — só RUST e HOT têm',
  },
  resonance: {
    type: 'knob',
    required: false,
    desc: 'Depth: reforça médio-grave e grave do estágio de potência; em ganho alto pode borrar — só RUST e HOT têm',
  },
  bright: {
    type: 'toggle',
    required: false,
    desc: 'switch Bright — só o CLN tem; acrescenta brilho e sparkle ao limpo',
  },

  // EQ gráfico de 9 bandas, um por amp. 5 = flat (0 dB).
  eqOn: { type: 'toggle', required: false, desc: 'EQ gráfico ligado' },
  eq1: { type: 'knob', required: false, off: 5, desc: 'EQ banda 1 (a mais grave); 5 = flat' },
  eq2: { type: 'knob', required: false, off: 5, desc: 'EQ banda 2; 5 = flat' },
  eq3: { type: 'knob', required: false, off: 5, desc: 'EQ banda 3; 5 = flat' },
  eq4: { type: 'knob', required: false, off: 5, desc: 'EQ banda 4; 5 = flat' },
  eq5: { type: 'knob', required: false, off: 5, desc: 'EQ banda 5 (médio); 5 = flat' },
  eq6: { type: 'knob', required: false, off: 5, desc: 'EQ banda 6; 5 = flat' },
  eq7: { type: 'knob', required: false, off: 5, desc: 'EQ banda 7; 5 = flat' },
  eq8: { type: 'knob', required: false, off: 5, desc: 'EQ banda 8; 5 = flat' },
  eq9: { type: 'knob', required: false, off: 5, desc: 'EQ banda 9 (a mais aguda); 5 = flat' },
} as const satisfies Record<string, ParamSpec>

/**
 * Os 5 controles que todo amp do Gojira tem. É este o critério de "amp
 * mapeado" — `level` fica de fora porque o CLN não expõe um Master.
 */
const AMP_CORE = ['gain', 'bass', 'mid', 'treble', 'output'] as const

/** Toggle do amp → knobs que ele governa. Mesmo papel de `PEDAL_GROUPS`. */
const AMP_GROUPS = {
  eqOn: ['eq1', 'eq2', 'eq3', 'eq4', 'eq5', 'eq6', 'eq7', 'eq8', 'eq9'],
} as const

/**
 * CC de cada parâmetro, por amplificador. Parâmetro ausente = o amp não tem
 * esse controle no plugin (CLN não tem Master/Presence/Depth; RUST e HOT não
 * têm Bright).
 */
const AMP_CC: Record<string, Record<string, number>> = {
  CLN: {
    gain: 10,
    bass: 11,
    mid: 12,
    treble: 13,
    output: 15,
    bright: 14,
    eqOn: 89,
    eq1: 90,
    eq2: 91,
    eq3: 92,
    eq4: 93,
    eq5: 94,
    eq6: 95,
    eq7: 96,
    eq8: 97,
    eq9: 98,
  },
  RUST: {
    gain: 21,
    bass: 22,
    mid: 23,
    treble: 24,
    level: 25,
    output: 26,
    presence: 27,
    resonance: 28,
    eqOn: 99,
    eq1: 100,
    eq2: 101,
    eq3: 102,
    eq4: 103,
    eq5: 104,
    eq6: 105,
    eq7: 106,
    eq8: 107,
    eq9: 108,
  },
  HOT: {
    gain: 65,
    bass: 66,
    mid: 67,
    treble: 68,
    level: 69,
    output: 70,
    presence: 71,
    resonance: 72,
    eqOn: 109,
    eq1: 110,
    eq2: 111,
    eq3: 112,
    eq4: 113,
    eq5: 114,
    eq6: 115,
    eq7: 116,
    eq8: 117,
    eq9: 118,
  },
}

// ------------------------------------------------------------------ parâmetros

/**
 * Mapa de CC dos parâmetros com CC fixo — os do amp ficam em `AMP_CC`, porque
 * o CC deles depende de qual amplificador está ativo. A ordem aqui é a ordem
 * usada no `show` e no envio da cena: os pedais na ordem da cadeia de sinal.
 */
const PARAMS = {
  gate: {
    cc: 3,
    type: 'knob',
    required: false,
    desc: 'noise gate: atenua o sinal abaixo do threshold — suba em ganho alto para calar o chiado',
  },

  // ---- WOW (pitch shifter FATSO) — primeiro da cadeia
  wowOn: { cc: 16, type: 'toggle', required: true, desc: 'pitch shifter WOW ligado' },
  wowMode: {
    cc: 17,
    type: 'select',
    required: false,
    options: { FATSO: 0, BLADE1: 64, BLADE2: 127 },
    desc: 'modo do WOW: FATSO acrescenta uma camada uma oitava abaixo; BLADE1/BLADE2 são divebomb (nesses o mix é ignorado)',
  },
  wowPosition: {
    cc: 18,
    type: 'knob',
    required: false,
    desc: 'posição do pedal de expressão do WOW (0 = talão, 10 = ponta)',
  },
  wowMix: { cc: 19, type: 'knob', required: false, desc: 'mix do WOW (só no modo FATSO)' },

  // ---- OCT (octaver OC-2)
  octOn: { cc: 35, type: 'toggle', required: true, desc: 'octaver ligado' },
  octOct1: { cc: 29, type: 'knob', required: false, desc: 'nível da oitava abaixo' },
  octOct2: { cc: 36, type: 'knob', required: false, desc: 'nível de duas oitavas abaixo' },
  octDirect: { cc: 37, type: 'knob', required: false, desc: 'nível do sinal direto no octaver' },

  // ---- OD (overdrive SD-1)
  odOn: { cc: 40, type: 'toggle', required: true, desc: 'overdrive ligado' },
  odDrive: { cc: 41, type: 'knob', required: false, desc: 'drive do overdrive (baixo = boost)' },
  odTone: { cc: 42, type: 'knob', required: false, desc: 'tone do overdrive' },
  odLevel: { cc: 43, type: 'knob', required: false, desc: 'nível do overdrive (alto = boost)' },

  // ---- DRT (distorção ProCo Rat)
  drtOn: { cc: 44, type: 'toggle', required: true, desc: 'distorção ligada' },
  drtGain: { cc: 45, type: 'knob', required: false, desc: 'ganho da distorção' },
  drtTone: {
    cc: 46,
    type: 'knob',
    required: false,
    desc: 'filtro da distorção — é um high cut invertido: mais alto = mais agudo',
  },
  drtLevel: { cc: 47, type: 'knob', required: false, desc: 'volume da distorção' },

  // ---- PHSR (Phase 90)
  phsrOn: { cc: 30, type: 'toggle', required: true, desc: 'phaser ligado' },
  phsrRate: { cc: 31, type: 'knob', required: false, desc: 'velocidade do phaser' },

  // ---- CHR (chorus)
  chrOn: { cc: 32, type: 'toggle', required: true, desc: 'chorus ligado' },
  chrRate: { cc: 38, type: 'knob', required: false, desc: 'velocidade do chorus' },
  chrDepth: { cc: 33, type: 'knob', required: false, desc: 'profundidade do chorus' },
  chrFeedback: { cc: 39, type: 'knob', required: false, desc: 'realimentação do chorus' },
  chrMix: { cc: 34, type: 'knob', required: false, desc: 'mix do chorus' },

  // ---- CAB (dois microfones sobre o cabinete do amp selecionado)
  cab1Mic: {
    cc: 76,
    type: 'select',
    required: false,
    // Ordem do IR pack do plugin; valores no centro de cada uma das 6 faixas.
    options: { DYN57: 0, DYN421: 25, COND414: 51, COND184: 76, RIB160: 102, RIB121: 127 },
    desc: 'microfone 1: DYN57 agressivo e médio-agudo, DYN421 encorpado, COND414/COND184 abertos e detalhados, RIB160/RIB121 escuros e suaves',
  },
  cab1Position: {
    cc: 77,
    type: 'knob',
    required: false,
    desc: 'posição do mic 1: 0 = centro do cone (agudo, agressivo), 10 = borda (escuro, redondo)',
  },
  cab1Distance: {
    cc: 78,
    type: 'knob',
    required: false,
    desc: 'distância do mic 1 do grill: perto = mais grave e ataque, longe = mais ar',
  },
  cab1Level: { cc: 79, type: 'knob', required: false, desc: 'nível do mic 1' },
  cab1Pan: { cc: 80, type: 'knob', required: false, desc: 'pan do mic 1 (0 = L, 5 = centro, 10 = R)' },

  cab2On: {
    cc: 82,
    type: 'toggle',
    required: false,
    desc: 'segundo microfone ligado — misturar dois mics engrossa e amplia o som',
  },
  cab2Mic: {
    cc: 83,
    type: 'select',
    required: false,
    options: { DYN57: 0, DYN421: 25, COND414: 51, COND184: 76, RIB160: 102, RIB121: 127 },
    desc: 'microfone 2 — combine com um de caráter diferente do mic 1',
  },
  cab2Position: { cc: 84, type: 'knob', required: false, desc: 'posição do mic 2' },
  cab2Distance: { cc: 85, type: 'knob', required: false, desc: 'distância do mic 2' },
  cab2Level: { cc: 86, type: 'knob', required: false, desc: 'nível do mic 2' },
  cab2Pan: { cc: 87, type: 'knob', required: false, desc: 'pan do mic 2 (0 = L, 5 = centro, 10 = R)' },

  // ---- DLY (delay)
  dlyOn: { cc: 50, type: 'toggle', required: true, desc: 'delay ligado' },
  dlyMix: { cc: 51, type: 'knob', required: false, desc: 'mix do delay' },
  dlyTime: {
    cc: 52,
    type: 'knob',
    required: false,
    desc: 'tempo do delay em BPM (0 = o mais lento, 10 = o mais rápido)',
  },
  dlyFeedback: { cc: 53, type: 'knob', required: false, desc: 'repetições do delay' },
  dlyTone: {
    cc: 48,
    type: 'knob',
    required: false,
    desc: 'tone das repetições (baixo = repetições escuras)',
  },
  dlySat: {
    cc: 57,
    type: 'knob',
    required: false,
    desc: 'saturação de fita nas repetições — dá um caráter analógico',
  },
  dlySync: {
    cc: 49,
    type: 'toggle',
    required: false,
    desc: 'sincroniza o delay com o tempo do host (ignora dlyTime)',
  },
  dlyPingPong: { cc: 55, type: 'toggle', required: false, desc: 'repetições alternando L/R' },
  dlyMod: { cc: 56, type: 'toggle', required: false, desc: 'modulação nas repetições' },

  // ---- RVB (reverb)
  rvbOn: { cc: 60, type: 'toggle', required: true, desc: 'reverb ligado' },
  rvbMix: { cc: 61, type: 'knob', required: false, desc: 'mix do reverb (rock costuma ficar 1–3)' },
  rvbDecay: { cc: 62, type: 'knob', required: false, desc: 'duração da cauda do reverb' },
  rvbLowCut: {
    cc: 59,
    type: 'knob',
    required: false,
    desc: 'high pass do reverb — suba para tirar o barro do grave da cauda',
  },
  rvbHighCut: {
    cc: 63,
    type: 'knob',
    required: false,
    desc: 'low pass do reverb — baixe para uma cauda mais escura e discreta',
  },
  rvbShimmer: {
    cc: 64,
    type: 'toggle',
    required: false,
    desc: 'Shimmer: sobrepõe uma cauda de reverb uma oitava acima — etéreo, use com parcimônia',
  },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs que ele governa. Serve para dois propósitos: a validação
 * exige os knobs quando o efeito está ligado, e o envio MIDI manda os knobs de
 * efeitos desligados para o valor de repouso (`off`, default 0) sem risco de
 * silenciar algo que deveria estar soando.
 */
const PEDAL_GROUPS = {
  wowOn: ['wowPosition', 'wowMix'],
  octOn: ['octOct1', 'octOct2', 'octDirect'],
  odOn: ['odDrive', 'odTone', 'odLevel'],
  drtOn: ['drtGain', 'drtTone', 'drtLevel'],
  phsrOn: ['phsrRate'],
  chrOn: ['chrRate', 'chrDepth', 'chrFeedback', 'chrMix'],
  cab2On: ['cab2Position', 'cab2Distance', 'cab2Level', 'cab2Pan'],
  dlyOn: ['dlyMix', 'dlyTime', 'dlyFeedback', 'dlyTone', 'dlySat'],
  rvbOn: ['rvbMix', 'rvbDecay', 'rvbLowCut', 'rvbHighCut'],
} as const

/**
 * Bypass de seção da barra superior do plugin. A app **sempre** manda todos
 * ligados antes da cena: uma seção bypassada engoliria a cena inteira em
 * silêncio, e a app não consegue ler o estado do plugin para descobrir isso.
 *
 * `cabAmpLinked` entra aqui pelo mesmo motivo: com ele ligado o cabinete segue
 * o amp selecionado, que é o comportamento padrão e o que a IA assume.
 */
const ALWAYS_ON_CC: Record<string, number> = {
  pitchActive: 4,
  pedalsActive: 5,
  ampsActive: 6,
  eqActive: 7,
  cabActive: 8,
  fxActive: 9,
  cabAmpLinked: 74,
  cab1Active: 75,
}

// -------------------------------------------------------------------- o spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const gojira: PluginSpec = {
  id: 'gojira',
  nome: 'Archetype Gojira',
  quando:
    'metal moderno, djent, thrash e hard rock, mas cobre também limpos vintage e crunch — ' +
    'o RUST vai de crunch clássico a alto ganho, então é a escolha padrão quando nenhum outro plugin se encaixa melhor',
  cadeia:
    'WOW (pitch) → OCT (octaver) → OD → DRT → PHSR → CHR → AMP (CLN | RUST | HOT) → EQ gráfico → CAB → DLY → RVB',
  doc: 'gojira.md',

  amps: AMPS,
  ampDesc: AMP_DESC,
  ampSelect: { cc: 20, valores: { CLN: 0, RUST: 64, HOT: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  grupos: { ...PEDAL_GROUPS, ...AMP_GROUPS },
  sempreLigado: ALWAYS_ON_CC,

  app: {
    candidatos: [path.join(PROGRAM_FILES, 'Neural DSP', 'Archetype Gojira', 'Archetype Gojira.exe')],
    processo: 'Archetype Gojira.exe',
    settings: path.join('Neural DSP', 'Archetype Gojira'),
    pastaMidi: 'MIDI Mappings',
    mapeamento: 'gojira-neural-ai.xml',
  },
}
