/**
 * Neural DSP Soldano SLO-100 X — the plugin descriptor.
 *
 * Everything that describes the plugin — the CC map, ranges, amps, which
 * parameters are required, which knobs belong to which section — lives here.
 * The zod schema, the doc injected into the system prompt, and the MIDI send
 * are all derived from this file, per `opentimbre-plugin-spec`.
 *
 * Transcribed from two legacy sources, cross-checked line by line:
 * - `legacy/src/plugins/soldano.ts` — the working `PluginSpec`-shaped object
 *   the old app actually sent MIDI from. Present on disk in this repo's
 *   `legacy/` working tree.
 * - `legacy/prompts/plugins/soldano.md` — the Portuguese tone knowledge base
 *   ported to bilingual EN/PT docs.
 *
 * Both sources agree on every CC, range, option value, and amp selector
 * transcribed below — zero discrepancies between them.
 *
 * Two porting decisions, since legacy's field/type names are Portuguese and
 * this file's shape (`PluginSpec` in `types.ts`) is English:
 * - Structural field names translate (`nome` → `name`, `quandO` → `whenToUse`,
 *   `ampDesc` → `ampDescriptions`, `valores` → `values`, `grupos` → `groups`,
 *   `sempreLigado` → `alwaysOn`, `candidatos` → `candidates.win32`, ...)
 * - The amp keys (`NORMAL`/`OVERDRIVE`) and the abstract parameter names
 *   (`gain`, `level`, `bass`, `mid`, `treble`, ...) are already English
 *   identifiers in legacy — they're the plugin's own GUI labels and the
 *   AI-facing schema names, not Portuguese, so they carry over unchanged.
 *   Only the `desc` prose (Portuguese in legacy) is translated to English.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.ts'

// ---------------------------------------------------------------- amplificador

const AMPS = ['NORMAL', 'OVERDRIVE'] as const

const AMP_DESCRIPTIONS: Record<string, string> = {
  NORMAL:
    'Normal channel of the SLO-100 — Clean or Crunch (alternated by the mode ' +
    'switch), low to medium gain, highly versatile for classic rock and hard ' +
    'rock; the only channel with the Bright switch',
  OVERDRIVE:
    'Overdrive channel of the SLO-100 — the high-gain channel that defined ' +
    'hard rock and 90s metal (Mark Tremonti, Dream Theater, Steve Vai), with ' +
    'natural tube sustain and compression',
}

/**
 * Only the 2 controls that do NOT share across channels. bass/mid/treble/
 * presence/depth live in PARAMS because they apply to both simultaneously —
 * switching channels doesn't change the tonestack, only the preamp and Master.
 */
const AMP_PARAMS = {
  gain: { type: 'knob', required: true, desc: 'preamp gain of this channel' },
  level: { type: 'knob', required: true, desc: 'Master: power-stage volume of this channel' },
  bright: {
    type: 'toggle',
    required: false,
    desc: 'Bright switch — only the Normal channel has it; adds brightness (disabled on Overdrive)',
  },
  mode: {
    type: 'toggle',
    required: false,
    desc: 'Normal channel mode switch — true = Crunch (more gain/body), false = Clean (disabled on Overdrive)',
  },
} as const satisfies Record<string, ParamSpec>

/** Mapped-criterion: gain and level only, because they're the exclusive ones. */
const AMP_CORE = ['gain', 'level'] as const

const AMP_CC: Record<string, Record<string, number>> = {
  NORMAL: { gain: 21, level: 22, bright: 23, mode: 24 },
  OVERDRIVE: { gain: 25, level: 26 },
}

// ------------------------------------------------------------------ parâmetros

/**
 * Fixed CC — includes the tonestack and power amp (shared by both channels),
 * the 4 pre pedals, the cabinet (2 mics + room reverb), and the 2 post pedals.
 * Order: signal chain, same as Gojira.
 */
const PARAMS = {
  gateOn: { cc: 1, type: 'toggle', required: false, desc: 'noise gate on' },
  gateThreshold: {
    cc: 2,
    type: 'knob',
    required: false,
    desc: 'noise gate: attenuates signal below threshold — raise at high gain to quiet hiss',
  },
  transpose: {
    cc: 3,
    type: 'knob',
    required: false,
    off: 5,
    desc: 'transpose pitch in semitones: 5 = no transpose (0 st), 0 = -12 st, 10 = +12 st — for alternate tunings without restopping the guitar',
  },
  doublerOn: {
    cc: 4,
    type: 'toggle',
    required: false,
    desc: 'doubles the signal to simulate a wider stereo image (disabled in stereo mode)',
  },
  doublerSpread: {
    cc: 5,
    type: 'knob',
    required: false,
    desc: 'detuning between the two sides of the doubler — higher = wider stereo',
  },

  // ---- COMP (Soldano Compressor)
  compOn: { cc: 40, type: 'toggle', required: true, desc: 'compressor on' },
  compAmount: { cc: 41, type: 'knob', required: false, desc: 'compression amount' },
  compLevel: {
    cc: 42,
    type: 'knob',
    required: false,
    desc: 'compressor output level — compensate for volume loss due to compression',
  },
  compAttack: {
    cc: 43,
    type: 'toggle',
    required: false,
    desc: 'compressor attack — true = Fast, false = Slow',
  },

  // ---- OD1 (Soldano Overdrive-1)
  od1On: { cc: 44, type: 'toggle', required: true, desc: 'overdrive 1 on' },
  od1Drive: { cc: 45, type: 'knob', required: false, desc: 'overdrive 1 drive (low = boost)' },
  od1Tone: { cc: 46, type: 'knob', required: false, desc: 'overdrive 1 tone (treble)' },
  od1Level: { cc: 47, type: 'knob', required: false, desc: 'overdrive 1 level (high = boost)' },

  // ---- OD2 (Soldano Overdrive-2)
  od2On: { cc: 48, type: 'toggle', required: true, desc: 'overdrive 2 on' },
  od2Drive: { cc: 49, type: 'knob', required: false, desc: 'overdrive 2 drive (low = boost)' },
  od2Peak: {
    cc: 50,
    type: 'toggle',
    required: false,
    desc: 'upper-mid boost of overdrive 2 (HiPeak) — enhances presence and cut in the mix',
  },
  od2Tone: { cc: 51, type: 'knob', required: false, desc: 'overdrive 2 tone (treble)' },
  od2Level: { cc: 52, type: 'knob', required: false, desc: 'overdrive 2 level (high = boost)' },

  // ---- CHR (Soldano Chorus)
  chorusOn: { cc: 53, type: 'toggle', required: true, desc: 'chorus on' },
  chorusMix: { cc: 54, type: 'knob', required: false, desc: 'chorus mix' },
  chorusRate: { cc: 55, type: 'knob', required: false, desc: 'chorus speed (0.10–2.5 Hz)' },
  chorusDepth: { cc: 56, type: 'knob', required: false, desc: 'chorus depth' },
  chorusDelay: {
    cc: 57,
    type: 'knob',
    required: false,
    desc: 'delay base between dry and wet signal of chorus (1–10 ms)',
  },

  // ---- Tonestack and power amp (shared by both channels)
  bass: { cc: 27, type: 'knob', required: true, desc: 'tonestack bass — applies to both channels' },
  mid: {
    cc: 28,
    type: 'knob',
    required: true,
    desc: 'tonestack mid — decides whether the guitar sits in or disappears from the mix — applies to both channels',
  },
  treble: {
    cc: 29,
    type: 'knob',
    required: true,
    desc: 'tonestack treble — applies to both channels',
  },
  presence: {
    cc: 30,
    type: 'knob',
    required: false,
    desc: 'power-stage treble — applies to both channels',
  },
  depth: {
    cc: 31,
    type: 'knob',
    required: false,
    desc: 'power-stage bass — applies to both channels; exaggerating blurs high gain',
  },

  // ---- CAB (2 mics + room reverb built into the cabinet model)
  micLOn: { cc: 60, type: 'toggle', required: true, desc: 'left microphone (mic 1) on' },
  micLPosition: {
    cc: 61,
    type: 'knob',
    required: false,
    desc: 'left mic position: 0 = center of cone (aggressive), 10 = edge (dark, round)',
  },
  micLDistance: {
    cc: 62,
    type: 'knob',
    required: false,
    desc: 'left mic distance from grille: close = more bass and attack, far = more air',
  },
  micLLevel: { cc: 63, type: 'knob', required: false, desc: 'left mic level' },
  micLPan: { cc: 64, type: 'knob', required: false, desc: 'left mic pan (0 = L, 5 = center, 10 = R)' },
  micLPhase: {
    cc: 65,
    type: 'toggle',
    required: false,
    desc: 'invert left mic phase — only for alignment with the other mic; getting it wrong leaves thin sound',
  },
  micLRoomOn: {
    cc: 66,
    type: 'toggle',
    required: false,
    desc: 'left mic send to cabinet room reverb on',
  },
  micLRoomSend: {
    cc: 67,
    type: 'knob',
    required: false,
    desc: 'amount of left mic signal sent to room reverb',
  },

  micROn: {
    cc: 68,
    type: 'toggle',
    required: false,
    desc: 'right microphone (mic 2) on — blending two mics thickens and widens the sound',
  },
  micRPosition: { cc: 69, type: 'knob', required: false, desc: 'right mic position' },
  micRDistance: { cc: 70, type: 'knob', required: false, desc: 'right mic distance' },
  micRLevel: { cc: 71, type: 'knob', required: false, desc: 'right mic level' },
  micRPan: { cc: 72, type: 'knob', required: false, desc: 'right mic pan (0 = L, 5 = center, 10 = R)' },
  micRPhase: {
    cc: 73,
    type: 'toggle',
    required: false,
    desc: 'invert right mic phase — only for alignment with the other mic; getting it wrong leaves thin sound',
  },
  micRRoomOn: {
    cc: 74,
    type: 'toggle',
    required: false,
    desc: 'right mic send to cabinet room reverb on',
  },
  micRRoomSend: {
    cc: 75,
    type: 'knob',
    required: false,
    desc: 'amount of right mic signal sent to room reverb',
  },

  // ---- EQ (9-band + HPF/LPF)
  eqOn: {
    cc: 80,
    type: 'toggle',
    required: false,
    desc: '9-band graphic EQ on — the same POWER switch as the EQ section',
  },
  eq1: { cc: 81, type: 'knob', required: false, off: 5, desc: 'EQ band 1 — 65 Hz; 5 = flat' },
  eq2: { cc: 82, type: 'knob', required: false, off: 5, desc: 'EQ band 2 — 125 Hz; 5 = flat' },
  eq3: { cc: 83, type: 'knob', required: false, off: 5, desc: 'EQ band 3 — 250 Hz; 5 = flat' },
  eq4: { cc: 84, type: 'knob', required: false, off: 5, desc: 'EQ band 4 — 500 Hz; 5 = flat' },
  eq5: { cc: 85, type: 'knob', required: false, off: 5, desc: 'EQ band 5 — 1 kHz; 5 = flat' },
  eq6: { cc: 86, type: 'knob', required: false, off: 5, desc: 'EQ band 6 — 2 kHz; 5 = flat' },
  eq7: { cc: 87, type: 'knob', required: false, off: 5, desc: 'EQ band 7 — 4 kHz; 5 = flat' },
  eq8: { cc: 88, type: 'knob', required: false, off: 5, desc: 'EQ band 8 — 8 kHz; 5 = flat' },
  eq9: { cc: 89, type: 'knob', required: false, off: 5, desc: 'EQ band 9 — 16 kHz; 5 = flat' },
  eqHpf: {
    cc: 90,
    type: 'knob',
    required: false,
    desc: 'EQ high-pass cutoff — raise to remove bass',
  },
  eqLpf: {
    cc: 91,
    type: 'knob',
    required: false,
    desc: 'EQ low-pass cutoff — lower to remove treble',
  },

  // ---- DLY (Soldano Delay)
  dlyOn: { cc: 92, type: 'toggle', required: true, desc: 'delay on' },
  dlyMix: { cc: 93, type: 'knob', required: false, desc: 'delay mix' },
  dlyTime: {
    cc: 94,
    type: 'knob',
    required: false,
    desc: 'delay time (16–1500 ms when free, subdivision when synced)',
  },
  dlyFeedback: { cc: 95, type: 'knob', required: false, desc: 'delay repeats' },
  dlyTone: { cc: 96, type: 'knob', required: false, desc: 'tone of the repeats (low = dark)' },
  dlySyncMode: {
    cc: 97,
    type: 'select',
    required: false,
    options: { FREE: 0, DAW: 64, TAP: 127 },
    desc:
      'FREE follows dlyTime in ms; DAW syncs to host tempo; TAP follows the last manually tapped tempo ' +
      '(not controllable via MIDI)',
  },
  dlyPingPong: { cc: 98, type: 'toggle', required: false, desc: 'repeats alternating L/R' },

  // ---- RVB (Soldano Reverb)
  rvbOn: { cc: 99, type: 'toggle', required: true, desc: 'reverb on' },
  rvbMix: { cc: 100, type: 'knob', required: false, desc: 'reverb mix (rock usually sits 1–3)' },
  rvbDecay: { cc: 101, type: 'knob', required: false, desc: 'reverb tail length (0.5–8 s)' },
  rvbTone: { cc: 102, type: 'knob', required: false, desc: 'tone of the reverb tail' },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs it governs. `compAttack`, `od2Peak`, `bright`, `mode`,
 * `micLPhase`/`micRPhase` are excluded on purpose: they are character switches,
 * not "effect off" dependencies — the same treatment Gojira gives to `wowMode`.
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
 * Confirmed in the plugin's "Parameter/Preset" dropdown: there is a toggle
 * "Active X Section" for Pre FX, Amp, Cab, and Post FX — pure section bypass,
 * no creative use (nobody wants to bypass the entire cabinet). The EQ has its
 * own "Active EQ Section", but that is the POWER switch for the section —
 * creative, so it stays in `eqOn` (CC 80), controlled by the AI, not here.
 */
const ALWAYS_ON: Record<string, number> = {
  preFxSectionOn: 110,
  ampSectionOn: 111,
  cabSectionOn: 112,
  postFxSectionOn: 113,
}

// -------------------------------------------------------------------- o spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const soldanoSpec: PluginSpec = {
  id: 'soldano',
  name: 'Soldano SLO-100 X',
  whenToUse:
    'classic rock and high-gain hard rock in the style of the real SLO-100 ' +
    '(Mark Tremonti, Dream Theater, Steve Vai) — a single amp with two channels ' +
    '(Normal and Overdrive) rather than three separate models; choose when the ' +
    'request calls for the hot overdrive and sustain of the SLO-100 instead of ' +
    'Gojira\'s more modern metal sound',
  signalChain:
    'COMP → OD1 → OD2 → CHR → AMP (NORMAL | OVERDRIVE, shared tonestack and power amp) → ' +
    'EQ (9-band + HPF/LPF) → CAB (2 mics + room reverb) → DLY → RVB',
  doc: 'soldano.md',

  amps: AMPS,
  ampDescriptions: AMP_DESCRIPTIONS,
  ampSelect: { cc: 20, values: { NORMAL: 0, OVERDRIVE: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  groups: PEDAL_GROUPS,
  alwaysOn: ALWAYS_ON,

  app: {
    candidates: {
      win32: [path.join(PROGRAM_FILES, 'Neural DSP', 'Soldano SLO-100 X', 'Soldano SLO-100 X.exe')],
      // No macOS path confirmed yet -- deliberately absent, not invented.
    },
    process: 'Soldano SLO-100 X.exe',
    settings: path.join('Neural DSP', 'Soldano SLO-100 X'),
    midiFolder: 'MIDI',
    mapping: 'soldano-neural-ai.xml',
  },
}
