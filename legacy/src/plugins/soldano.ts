/**
 * Neural DSP Soldano SLO-100 X.
 *
 * Diferente do Gojira, aqui não há três amplificadores independentes: é **um**
 * amp (o SLO-100 real tem dois canais, Normal e Overdrive) que compartilha o
 * tonestack (bass/mid/treble) e o estágio de potência (presence/depth) entre
 * os dois canais — só o ganho do preamp e o Master são exclusivos de cada um.
 * Por isso `AMP_CORE` aqui tem só 2 chaves (`gain`, `level`), e bass/mid/treble/
 * presence/depth entram em `PARAMS` (CC fixo), não em `AMP_PARAMS`.
 *
 * O canal Normal também tem dois controles que o Overdrive não tem — Bright e
 * o switch Clean/Crunch — modelados do mesmo jeito que o Gojira faz com
 * `bright`/`presence`/`resonance` no CLN: presentes em `AMP_CC.NORMAL`,
 * ausentes de `AMP_CC.OVERDRIVE`.
 *
 * A estrutura abaixo (quais parâmetros existem, como se agrupam, os nomes dos
 * amps) foi confirmada lendo o dropdown "Parameter/Preset" da janela MIDI
 * Mappings do próprio plugin — não é mais palpite de extração de binário. O
 * que **ainda não está confirmado** é o `parameter=""` exato que cada CC do
 * `midi-mapping/soldano-neural-ai.xml` deve usar: a primeira tentativa de
 * importar esse XML falhou (tudo caiu em CC 0), então por ora o mapeamento é
 * feito manualmente na janela MIDI Mappings do plugin, escolhendo cada nome
 * confirmado desta lista — ver capabilities.md para a tabela CC ↔ nome.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.js'

// ---------------------------------------------------------------- amplificador

const AMPS = ['NORMAL', 'OVERDRIVE'] as const

const AMP_DESC: Record<string, string> = {
  NORMAL:
    'canal Normal do SLO-100 — Clean ou Crunch (alternados pelo switch de modo), ganho baixo a ' +
    'médio, o mais maleável para rock clássico e hard rock; só ele tem o switch Bright',
  OVERDRIVE:
    'canal Overdrive do SLO-100 — o canal de alto ganho que definiu o hard rock e o metal dos ' +
    'anos 90 (Mark Tremonti, Dream Theater, Steve Vai), com sustain e compressão naturais do tubo',
}

/**
 * Só os 2 controles que **não** são compartilhados entre os canais. Bass/mid/
 * treble/presence/depth ficam em `PARAMS` porque valem para os dois ao mesmo
 * tempo — trocar de canal não muda o tonestack, só o preamp e o Master.
 */
const AMP_PARAMS = {
  gain: { type: 'knob', required: true, desc: 'ganho do preamp deste canal' },
  level: { type: 'knob', required: true, desc: 'Master: volume do estágio de potência deste canal' },
  bright: {
    type: 'toggle',
    required: false,
    desc: 'switch Bright — só o canal Normal tem; acrescenta agudos (desabilitado no Overdrive)',
  },
  mode: {
    type: 'toggle',
    required: false,
    desc:
      'switch de modo do canal Normal — true = Crunch (mais ganho e corpo), false = Clean ' +
      '(desabilitado no Overdrive)',
  },
} as const satisfies Record<string, ParamSpec>

/** Critério de "amp mapeado": só gain e level, porque são os únicos exclusivos. */
const AMP_CORE = ['gain', 'level'] as const

const AMP_CC: Record<string, Record<string, number>> = {
  NORMAL: { gain: 21, level: 22, bright: 23, mode: 24 },
  OVERDRIVE: { gain: 25, level: 26 },
}

// ------------------------------------------------------------------ parâmetros

/**
 * CC fixo — inclui o tonestack e o power amp (compartilhados pelos 2 canais),
 * os 4 pedais de pré, o cabinete (2 mics + room reverb) e os 2 pedais de pós.
 * Ordem: cadeia de sinal, como no Gojira.
 */
const PARAMS = {
  gateOn: { cc: 1, type: 'toggle', required: false, desc: 'noise gate ligado' },
  gateThreshold: {
    cc: 2,
    type: 'knob',
    required: false,
    desc: 'noise gate: atenua o sinal abaixo do threshold — suba em ganho alto para calar o chiado',
  },
  transpose: {
    cc: 3,
    type: 'knob',
    required: false,
    off: 5,
    desc:
      'transpõe o pitch em semitons: 5 = sem transposição (0 st), 0 = -12 st, 10 = +12 st — para ' +
      'afinações alternativas sem destocar a guitarra',
  },
  doublerOn: {
    cc: 4,
    type: 'toggle',
    required: false,
    desc: 'duplica o sinal para simular uma imagem estéreo mais larga (desabilitado em modo estéreo)',
  },
  doublerSpread: {
    cc: 5,
    type: 'knob',
    required: false,
    desc: 'defasagem entre os dois lados do doubler — quanto mais alto, mais largo o estéreo',
  },

  // ---- COMP (Soldano Compressor)
  compOn: { cc: 40, type: 'toggle', required: true, desc: 'compressor ligado' },
  compAmount: { cc: 41, type: 'knob', required: false, desc: 'quantidade de compressão' },
  compLevel: {
    cc: 42,
    type: 'knob',
    required: false,
    desc: 'volume de saída do compressor — compense aqui a perda de volume da compressão',
  },
  compAttack: {
    cc: 43,
    type: 'toggle',
    required: false,
    desc: 'ataque do compressor — true = Fast, false = Slow',
  },

  // ---- OD1 (Soldano Overdrive-1)
  od1On: { cc: 44, type: 'toggle', required: true, desc: 'overdrive 1 ligado' },
  od1Drive: { cc: 45, type: 'knob', required: false, desc: 'drive do overdrive 1 (baixo = boost)' },
  od1Tone: { cc: 46, type: 'knob', required: false, desc: 'tone do overdrive 1 (agudos)' },
  od1Level: { cc: 47, type: 'knob', required: false, desc: 'nível do overdrive 1 (alto = boost)' },

  // ---- OD2 (Soldano Overdrive-2)
  od2On: { cc: 48, type: 'toggle', required: true, desc: 'overdrive 2 ligado' },
  od2Drive: { cc: 49, type: 'knob', required: false, desc: 'drive do overdrive 2 (baixo = boost)' },
  od2Peak: {
    cc: 50,
    type: 'toggle',
    required: false,
    desc: 'boost de médio-agudo do overdrive 2 (HiPeak) — realça presença e corte na mix',
  },
  od2Tone: { cc: 51, type: 'knob', required: false, desc: 'tone do overdrive 2 (agudos)' },
  od2Level: { cc: 52, type: 'knob', required: false, desc: 'nível do overdrive 2 (alto = boost)' },

  // ---- CHR (Soldano Chorus)
  chorusOn: { cc: 53, type: 'toggle', required: true, desc: 'chorus ligado' },
  chorusMix: { cc: 54, type: 'knob', required: false, desc: 'mix do chorus' },
  chorusRate: { cc: 55, type: 'knob', required: false, desc: 'velocidade do chorus (0.10–2.5 Hz)' },
  chorusDepth: { cc: 56, type: 'knob', required: false, desc: 'profundidade do chorus' },
  chorusDelay: {
    cc: 57,
    type: 'knob',
    required: false,
    desc: 'delay base entre o sinal seco e o molhado do chorus (1–10 ms)',
  },

  // ---- Tonestack e power amp (compartilhados pelos 2 canais)
  bass: { cc: 27, type: 'knob', required: true, desc: 'graves do tonestack — vale para os 2 canais' },
  mid: {
    cc: 28,
    type: 'knob',
    required: true,
    desc: 'médios do tonestack — decide se a guitarra aparece ou some na mix; vale para os 2 canais',
  },
  treble: {
    cc: 29,
    type: 'knob',
    required: true,
    desc: 'agudos do tonestack — vale para os 2 canais',
  },
  presence: {
    cc: 30,
    type: 'knob',
    required: false,
    desc: 'agudos do estágio de potência — vale para os 2 canais',
  },
  depth: {
    cc: 31,
    type: 'knob',
    required: false,
    desc: 'graves do estágio de potência — vale para os 2 canais; exagerar borra o ganho alto',
  },

  // ---- CAB (2 microfones + room reverb própria do cabinete)
  micLOn: { cc: 60, type: 'toggle', required: true, desc: 'microfone esquerdo (mic 1) ligado' },
  micLPosition: {
    cc: 61,
    type: 'knob',
    required: false,
    desc: 'posição do mic esquerdo: 0 = centro do cone (agressivo), 10 = borda (escuro, redondo)',
  },
  micLDistance: {
    cc: 62,
    type: 'knob',
    required: false,
    desc: 'distância do mic esquerdo do grill: perto = mais grave e ataque, longe = mais ar',
  },
  micLLevel: { cc: 63, type: 'knob', required: false, desc: 'nível do mic esquerdo' },
  micLPan: { cc: 64, type: 'knob', required: false, desc: 'pan do mic esquerdo (0 = L, 5 = centro, 10 = R)' },
  micLPhase: {
    cc: 65,
    type: 'toggle',
    required: false,
    desc: 'inverte a fase do mic esquerdo — só para alinhar com o outro mic; errar deixa o som fino',
  },
  micLRoomOn: {
    cc: 66,
    type: 'toggle',
    required: false,
    desc: 'send do mic esquerdo para a room reverb do cabinete ligado',
  },
  micLRoomSend: {
    cc: 67,
    type: 'knob',
    required: false,
    desc: 'quantidade de sinal do mic esquerdo enviada para a room reverb',
  },

  micROn: {
    cc: 68,
    type: 'toggle',
    required: false,
    desc: 'microfone direito (mic 2) ligado — misturar dois mics engrossa e amplia o som',
  },
  micRPosition: { cc: 69, type: 'knob', required: false, desc: 'posição do mic direito' },
  micRDistance: { cc: 70, type: 'knob', required: false, desc: 'distância do mic direito' },
  micRLevel: { cc: 71, type: 'knob', required: false, desc: 'nível do mic direito' },
  micRPan: { cc: 72, type: 'knob', required: false, desc: 'pan do mic direito (0 = L, 5 = centro, 10 = R)' },
  micRPhase: {
    cc: 73,
    type: 'toggle',
    required: false,
    desc: 'inverte a fase do mic direito — só para alinhar com o outro mic; errar deixa o som fino',
  },
  micRRoomOn: {
    cc: 74,
    type: 'toggle',
    required: false,
    desc: 'send do mic direito para a room reverb do cabinete ligado',
  },
  micRRoomSend: {
    cc: 75,
    type: 'knob',
    required: false,
    desc: 'quantidade de sinal do mic direito enviada para a room reverb',
  },

  // ---- EQ (9 bandas + HPF/LPF)
  eqOn: {
    cc: 80,
    type: 'toggle',
    required: false,
    desc: 'EQ gráfico de 9 bandas ligado — mesmo switch POWER da seção EQ',
  },
  eq1: { cc: 81, type: 'knob', required: false, off: 5, desc: 'EQ banda 1 — 65 Hz; 5 = flat' },
  eq2: { cc: 82, type: 'knob', required: false, off: 5, desc: 'EQ banda 2 — 125 Hz; 5 = flat' },
  eq3: { cc: 83, type: 'knob', required: false, off: 5, desc: 'EQ banda 3 — 250 Hz; 5 = flat' },
  eq4: { cc: 84, type: 'knob', required: false, off: 5, desc: 'EQ banda 4 — 500 Hz; 5 = flat' },
  eq5: { cc: 85, type: 'knob', required: false, off: 5, desc: 'EQ banda 5 — 1 kHz; 5 = flat' },
  eq6: { cc: 86, type: 'knob', required: false, off: 5, desc: 'EQ banda 6 — 2 kHz; 5 = flat' },
  eq7: { cc: 87, type: 'knob', required: false, off: 5, desc: 'EQ banda 7 — 4 kHz; 5 = flat' },
  eq8: { cc: 88, type: 'knob', required: false, off: 5, desc: 'EQ banda 8 — 8 kHz; 5 = flat' },
  eq9: { cc: 89, type: 'knob', required: false, off: 5, desc: 'EQ banda 9 — 16 kHz; 5 = flat' },
  eqHpf: {
    cc: 90,
    type: 'knob',
    required: false,
    desc: 'cutoff do high-pass do EQ — suba para tirar grave',
  },
  eqLpf: {
    cc: 91,
    type: 'knob',
    required: false,
    desc: 'cutoff do low-pass do EQ — baixe para tirar agudo',
  },

  // ---- DLY (Soldano Delay)
  dlyOn: { cc: 92, type: 'toggle', required: true, desc: 'delay ligado' },
  dlyMix: { cc: 93, type: 'knob', required: false, desc: 'mix do delay' },
  dlyTime: {
    cc: 94,
    type: 'knob',
    required: false,
    desc: 'tempo do delay (16–1500 ms quando livre, subdivisão quando sincronizado)',
  },
  dlyFeedback: { cc: 95, type: 'knob', required: false, desc: 'repetições do delay' },
  dlyTone: { cc: 96, type: 'knob', required: false, desc: 'tone das repetições (baixo = escuras)' },
  dlySyncMode: {
    cc: 97,
    type: 'select',
    required: false,
    options: { FREE: 0, DAW: 64, TAP: 127 },
    desc:
      'FREE segue dlyTime em ms; DAW sincroniza com o tempo do host; TAP segue o último tempo ' +
      'batido manualmente no plugin (não controlável por aqui)',
  },
  dlyPingPong: { cc: 98, type: 'toggle', required: false, desc: 'repetições alternando entre L/R' },

  // ---- RVB (Soldano Reverb)
  rvbOn: { cc: 99, type: 'toggle', required: true, desc: 'reverb ligado' },
  rvbMix: { cc: 100, type: 'knob', required: false, desc: 'mix do reverb (rock costuma ficar 1–3)' },
  rvbDecay: { cc: 101, type: 'knob', required: false, desc: 'duração da cauda do reverb (0.5–8 s)' },
  rvbTone: { cc: 102, type: 'knob', required: false, desc: 'tone da cauda do reverb' },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs que ele governa. `compAttack`, `od2Peak`, `bright`, `mode`,
 * `micLPhase`/`micRPhase` ficam de fora de propósito: são switches de caráter,
 * não dependências de "efeito desligado" — o mesmo tratamento que o Gojira dá
 * a `wowMode`.
 */
const PEDAL_GROUPS = {
  compOn: ['compAmount', 'compLevel'],
  od1On: ['od1Drive', 'od1Tone', 'od1Level'],
  od2On: ['od2Drive', 'od2Tone', 'od2Level'],
  chorusOn: ['chorusRate', 'chorusDepth', 'chorusDelay', 'chorusMix'],
  micLOn: ['micLPosition', 'micLDistance', 'micLLevel', 'micLPan'],
  micLRoomOn: ['micLRoomSend'],
  micROn: ['micRPosition', 'micRDistance', 'micRLevel', 'micRPan'],
  micRRoomOn: ['micRRoomSend'],
  eqOn: ['eq1', 'eq2', 'eq3', 'eq4', 'eq5', 'eq6', 'eq7', 'eq8', 'eq9'],
  dlyOn: ['dlyMix', 'dlyTime', 'dlyFeedback', 'dlyTone'],
  rvbOn: ['rvbMix', 'rvbDecay', 'rvbTone'],
} as const

/**
 * Confirmado no dropdown "Parameter/Preset" do plugin: existe um toggle
 * "Active X Section" para Pre FX, Amp, Cab e Post FX — bypass de seção puro,
 * sem uso criativo (ninguém quer bypassar o cabinete inteiro). A EQ tem o seu
 * próprio "Active EQ Section", mas esse é o switch POWER da seção — criativo,
 * então fica em `eqOn` (CC 80), controlado pela IA, e não aqui.
 *
 * CC ainda não escolhido (110–113): a app não roda MIDI Learn sozinha, então
 * o `parameter=""` exato de cada um só entra no XML depois de mapeado à mão
 * no plugin — ver capabilities.md.
 */
const ALWAYS_ON_CC: Record<string, number> = {
  preFxSectionOn: 110,
  ampSectionOn: 111,
  cabSectionOn: 112,
  postFxSectionOn: 113,
}

// -------------------------------------------------------------------- o spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const soldano: PluginSpec = {
  id: 'soldano',
  nome: 'Soldano SLO-100 X',
  quando:
    'rock clássico e hard rock de alto ganho no estilo do SLO-100 real (Mark Tremonti, Dream ' +
    'Theater, Steve Vai) — um único amp com dois canais (Normal e Overdrive) em vez de três ' +
    'modelos separados; escolha quando o pedido pede o overdrive quente e o sustain do SLO-100 ' +
    'em vez do metal mais moderno do Gojira',
  cadeia:
    'COMP → OD1 → OD2 → CHR → AMP (NORMAL | OVERDRIVE, tonestack e power amp compartilhados) → ' +
    'EQ (9 bandas + HPF/LPF) → CAB (2 mics + room reverb) → DLY → RVB',
  doc: 'soldano.md',

  amps: AMPS,
  ampDesc: AMP_DESC,
  ampSelect: { cc: 20, valores: { NORMAL: 0, OVERDRIVE: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  grupos: PEDAL_GROUPS,
  sempreLigado: ALWAYS_ON_CC,

  app: {
    candidatos: [
      path.join(PROGRAM_FILES, 'Neural DSP', 'Soldano SLO-100 X', 'Soldano SLO-100 X.exe'),
    ],
    processo: 'Soldano SLO-100 X.exe',
    settings: path.join('Neural DSP', 'Soldano SLO-100 X'),
    pastaMidi: 'MIDI',
    mapeamento: 'soldano-neural-ai.xml',
  },
}
