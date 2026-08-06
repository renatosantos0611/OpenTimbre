/**
 * Neural DSP Archetype: Gojira — the plugin descriptor.
 *
 * Everything that describes the plugin — the CC map, ranges, amps, which
 * parameters are required, which knobs belong to which pedal — lives here.
 * The zod schema, the doc injected into the system prompt, and the MIDI send
 * are all derived from this file, per `opentimbre-plugin-spec`.
 *
 * Transcribed from two legacy sources, cross-checked line by line — every CC
 * number below is a copied fact, not an invented one:
 * - `legacy/src/plugins/gojira.ts` — the working `PluginSpec`-shaped object
 *   the old app actually sent MIDI from. Present on disk in this repo's
 *   `legacy/` working tree.
 * - `legacy/capabilities.md` (Gojira section — the "Fase 0" probe journal) —
 *   the CC-per-amp table, the amp-selector ranges, and the "Achado" notes on
 *   what CLN lacks, what `reverbMode` really is, and the two-mic cabinet.
 *   Deleted-but-uncommitted in `legacy/`'s working tree (same as
 *   `package.json`/`README.md`/`tsconfig.json`) — read via
 *   `git -C legacy show HEAD:capabilities.md`, not off disk directly. Both
 *   sources agree on every CC, range, and option value transcribed below —
 *   111 CCs cross-checked, zero discrepancies.
 *
 * The CCs mirror `midi-mapping/gojira-neural-ai.xml` (118 parameters); not
 * all of them are exposed to the AI here — the ones capabilities.md lists as
 * unconfirmed (`cabType`, `delaySyncNote`, ...) stay out of the schema, same
 * as legacy.
 *
 * Two porting decisions, since legacy's field/type names are Portuguese and
 * this file's shape (`PluginSpec` in `types.ts`) is English:
 * - Structural field names translate (`nome` -> `name`, `grupos` -> `groups`,
 *   `sempreLigado` -> `alwaysOn`, ...) — that shape is shared by every
 *   plugin, so it has to match `types.ts`.
 * - The amp keys (`CLN`/`RUST`/`HOT`) and the abstract parameter names
 *   (`gain`, `bass`, `eq1`, ...) are already English identifiers in legacy —
 *   they're the plugin's own GUI abbreviations and the AI-facing schema
 *   names, not Portuguese, so they carry over unchanged. Only the `desc`
 *   prose (Portuguese in legacy) is translated to English, to match
 *   `opentimbre-code-style`'s rule that code content stays in English
 *   project-wide; the plugin doc (`gojira.md`, ported separately) is where
 *   locale-specific tone guidance will live.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.ts'

// -------------------------------------------------------------------- amps

const AMPS = ['CLN', 'RUST', 'HOT'] as const

const AMP_DESCRIPTIONS: Record<string, string> = {
  CLN: 'vintage clean (Fender Twin Reverb), high headroom, breaks up nicely if you open the gain',
  RUST: 'crunch to high gain (EVH 5150 III Blue channel), huge gain range, the most versatile',
  HOT: 'extreme gain (EVH 5150 III Red channel), modern metal, very compressed',
}

// ------------------------------------------------------------- amp params

/**
 * The three amps do NOT share controls: CLN's gain and RUST's gain are
 * distinct parameters in the plugin, under different internal names. Each
 * amp also has its own 9-band graphic EQ. So the parameter gets an abstract
 * name here — what the AI sees — and the concrete CC comes from `AMP_CC`.
 *
 * Plugin-internal names (per capabilities.md): CLN = `clean*`, RUST =
 * `rhythm*`, HOT = `lead*`.
 */
const AMP_PARAMS = {
  gain: { type: 'knob', required: true, desc: 'preamp gain' },
  bass: { type: 'knob', required: true, desc: 'amp bass' },
  mid: {
    type: 'knob',
    required: true,
    desc: 'amp mids — decides whether the guitar sits in or disappears from the mix',
  },
  treble: { type: 'knob', required: true, desc: 'amp treble' },
  level: {
    type: 'knob',
    required: true,
    desc: "Master: power-stage volume — opening it up changes the character, not just the volume (CLN doesn't have this; ignored on that amp)",
  },
  output: {
    type: 'knob',
    required: true,
    desc: 'Level: output trim — balances volume between scenes without touching the tone',
  },
  presence: {
    type: 'knob',
    required: false,
    desc: 'boosts upper mids and attack definition — only RUST and HOT have this',
  },
  resonance: {
    type: 'knob',
    required: false,
    desc: 'Depth: reinforces low-mids and bass in the power stage; can get muddy at high gain — only RUST and HOT have this',
  },
  bright: {
    type: 'toggle',
    required: false,
    desc: 'Bright switch — only CLN has this; adds brightness and sparkle to the clean tone',
  },

  // 9-band graphic EQ, one per amp. 5 = flat (0 dB).
  eqOn: { type: 'toggle', required: false, desc: 'graphic EQ on' },
  eq1: { type: 'knob', required: false, off: 5, desc: 'EQ band 1 (the lowest); 5 = flat' },
  eq2: { type: 'knob', required: false, off: 5, desc: 'EQ band 2; 5 = flat' },
  eq3: { type: 'knob', required: false, off: 5, desc: 'EQ band 3; 5 = flat' },
  eq4: { type: 'knob', required: false, off: 5, desc: 'EQ band 4; 5 = flat' },
  eq5: { type: 'knob', required: false, off: 5, desc: 'EQ band 5 (mid); 5 = flat' },
  eq6: { type: 'knob', required: false, off: 5, desc: 'EQ band 6; 5 = flat' },
  eq7: { type: 'knob', required: false, off: 5, desc: 'EQ band 7; 5 = flat' },
  eq8: { type: 'knob', required: false, off: 5, desc: 'EQ band 8; 5 = flat' },
  eq9: { type: 'knob', required: false, off: 5, desc: 'EQ band 9 (the highest); 5 = flat' },
} as const satisfies Record<string, ParamSpec>

/**
 * The 5 controls every Gojira amp has. This is the "amp is mapped" criterion
 * — `level` stays out because CLN doesn't expose a Master.
 */
const AMP_CORE = ['gain', 'bass', 'mid', 'treble', 'output'] as const

/** Amp toggle -> knobs it governs. Same role as `PEDAL_GROUPS`. */
const AMP_GROUPS = {
  eqOn: ['eq1', 'eq2', 'eq3', 'eq4', 'eq5', 'eq6', 'eq7', 'eq8', 'eq9'],
} as const

/**
 * Each parameter's CC, per amp. A parameter absent from an amp's table means
 * that amp doesn't have the control in the plugin (CLN has no Master,
 * Presence, or Depth; RUST and HOT have no Bright).
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

// ------------------------------------------------------------------ params

/**
 * CC map for the fixed-CC parameters — the amp ones live in `AMP_CC`,
 * because their CC depends on which amp is active. The order here is the
 * order used for `show` and for sending a scene: pedals in signal-chain
 * order.
 */
const PARAMS = {
  gate: {
    cc: 3,
    type: 'knob',
    required: false,
    desc: 'noise gate: attenuates the signal below the threshold — raise it at high gain to quiet the hiss',
  },

  // ---- WOW (FATSO pitch shifter) — first in the chain
  wowOn: { cc: 16, type: 'toggle', required: true, desc: 'WOW pitch shifter on' },
  wowMode: {
    cc: 17,
    type: 'select',
    required: false,
    options: { FATSO: 0, BLADE1: 64, BLADE2: 127 },
    desc: 'WOW mode: FATSO adds a layer an octave below; BLADE1/BLADE2 are dive-bomb effects (mix is ignored in those)',
  },
  wowPosition: {
    cc: 18,
    type: 'knob',
    required: false,
    desc: 'position of the WOW expression pedal (0 = heel, 10 = toe)',
  },
  wowMix: { cc: 19, type: 'knob', required: false, desc: 'WOW mix (FATSO mode only)' },

  // ---- OCT (OC-2-style octaver)
  octOn: { cc: 35, type: 'toggle', required: true, desc: 'octaver on' },
  octOct1: { cc: 29, type: 'knob', required: false, desc: 'level of the octave below' },
  octOct2: { cc: 36, type: 'knob', required: false, desc: 'level of two octaves below' },
  octDirect: { cc: 37, type: 'knob', required: false, desc: 'level of the dry signal in the octaver' },

  // ---- OD (SD-1-style overdrive)
  odOn: { cc: 40, type: 'toggle', required: true, desc: 'overdrive on' },
  odDrive: { cc: 41, type: 'knob', required: false, desc: 'overdrive drive (low = boost)' },
  odTone: { cc: 42, type: 'knob', required: false, desc: 'overdrive tone' },
  odLevel: { cc: 43, type: 'knob', required: false, desc: 'overdrive level (high = boost)' },

  // ---- DRT (ProCo Rat-style distortion)
  drtOn: { cc: 44, type: 'toggle', required: true, desc: 'distortion on' },
  drtGain: { cc: 45, type: 'knob', required: false, desc: 'distortion gain' },
  drtTone: {
    cc: 46,
    type: 'knob',
    required: false,
    desc: 'distortion filter — an inverted high cut: higher = brighter',
  },
  drtLevel: { cc: 47, type: 'knob', required: false, desc: 'distortion volume' },

  // ---- PHSR (Phase 90-style phaser)
  phsrOn: { cc: 30, type: 'toggle', required: true, desc: 'phaser on' },
  phsrRate: { cc: 31, type: 'knob', required: false, desc: 'phaser speed' },

  // ---- CHR (chorus)
  chrOn: { cc: 32, type: 'toggle', required: true, desc: 'chorus on' },
  chrRate: { cc: 38, type: 'knob', required: false, desc: 'chorus speed' },
  chrDepth: { cc: 33, type: 'knob', required: false, desc: 'chorus depth' },
  chrFeedback: { cc: 39, type: 'knob', required: false, desc: 'chorus feedback' },
  chrMix: { cc: 34, type: 'knob', required: false, desc: 'chorus mix' },

  // ---- CAB (two microphones on the selected amp's cabinet)
  cab1Mic: {
    cc: 76,
    type: 'select',
    required: false,
    // Order of the plugin's IR pack; values at the center of each of the 6 ranges.
    options: { DYN57: 0, DYN421: 25, COND414: 51, COND184: 76, RIB160: 102, RIB121: 127 },
    desc: 'mic 1: DYN57 aggressive and upper-mid forward, DYN421 fuller-bodied, COND414/COND184 open and detailed, RIB160/RIB121 dark and smooth',
  },
  cab1Position: {
    cc: 77,
    type: 'knob',
    required: false,
    desc: 'mic 1 position: 0 = center of the cone (bright, aggressive), 10 = edge (dark, round)',
  },
  cab1Distance: {
    cc: 78,
    type: 'knob',
    required: false,
    desc: 'mic 1 distance from the grille: close = more bass and attack, far = more air',
  },
  cab1Level: { cc: 79, type: 'knob', required: false, desc: 'mic 1 level' },
  cab1Pan: { cc: 80, type: 'knob', required: false, desc: 'mic 1 pan (0 = L, 5 = center, 10 = R)' },

  cab2On: {
    cc: 82,
    type: 'toggle',
    required: false,
    desc: 'second mic on — blending two mics thickens and widens the sound',
  },
  cab2Mic: {
    cc: 83,
    type: 'select',
    required: false,
    options: { DYN57: 0, DYN421: 25, COND414: 51, COND184: 76, RIB160: 102, RIB121: 127 },
    desc: 'mic 2 — pair it with a different character than mic 1',
  },
  cab2Position: { cc: 84, type: 'knob', required: false, desc: 'mic 2 position' },
  cab2Distance: { cc: 85, type: 'knob', required: false, desc: 'mic 2 distance' },
  cab2Level: { cc: 86, type: 'knob', required: false, desc: 'mic 2 level' },
  cab2Pan: { cc: 87, type: 'knob', required: false, desc: 'mic 2 pan (0 = L, 5 = center, 10 = R)' },

  // ---- DLY (delay)
  dlyOn: { cc: 50, type: 'toggle', required: true, desc: 'delay on' },
  dlyMix: { cc: 51, type: 'knob', required: false, desc: 'delay mix' },
  dlyTime: {
    cc: 52,
    type: 'knob',
    required: false,
    desc: 'delay time in BPM (0 = the slowest, 10 = the fastest)',
  },
  dlyFeedback: { cc: 53, type: 'knob', required: false, desc: 'delay repeats' },
  dlyTone: {
    cc: 48,
    type: 'knob',
    required: false,
    desc: 'tone of the repeats (low = dark repeats)',
  },
  dlySat: {
    cc: 57,
    type: 'knob',
    required: false,
    desc: 'tape saturation on the repeats — gives an analog character',
  },
  dlySync: {
    cc: 49,
    type: 'toggle',
    required: false,
    desc: 'syncs the delay to the host tempo (ignores dlyTime)',
  },
  dlyPingPong: { cc: 55, type: 'toggle', required: false, desc: 'repeats alternating L/R' },
  dlyMod: { cc: 56, type: 'toggle', required: false, desc: 'modulation on the repeats' },

  // ---- RVB (reverb)
  rvbOn: { cc: 60, type: 'toggle', required: true, desc: 'reverb on' },
  rvbMix: { cc: 61, type: 'knob', required: false, desc: 'reverb mix (rock usually sits at 1-3)' },
  rvbDecay: { cc: 62, type: 'knob', required: false, desc: 'reverb tail length' },
  rvbLowCut: {
    cc: 59,
    type: 'knob',
    required: false,
    desc: "reverb high-pass — raise it to clear the mud from the tail's low end",
  },
  rvbHighCut: {
    cc: 63,
    type: 'knob',
    required: false,
    desc: 'reverb low-pass — lower it for a darker, more discreet tail',
  },
  rvbShimmer: {
    cc: 64,
    type: 'toggle',
    required: false,
    desc: 'Shimmer: layers a reverb tail an octave above — ethereal, use sparingly. Not a mode selector, despite the plugin calling the underlying control `reverbMode`.',
  },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle -> knobs it governs. Serves two purposes: validation requires the
 * knobs when the effect is on, and the MIDI send puts an off effect's knobs
 * to their rest value (`off`, default 0) with no risk of silencing something
 * that should be sounding.
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
 * Section bypass switches from the plugin's top bar. The app ALWAYS sends
 * all of them on before a scene: a bypassed section would swallow the whole
 * scene in silence, and the app has no way to read the plugin's state to
 * discover that.
 *
 * `cabAmpLinked` belongs here for the same reason: with it on, the cabinet
 * follows the selected amp, which is the default behavior and what the AI
 * assumes.
 */
const ALWAYS_ON: Record<string, number> = {
  pitchActive: 4,
  pedalsActive: 5,
  ampsActive: 6,
  eqActive: 7,
  cabActive: 8,
  fxActive: 9,
  cabAmpLinked: 74,
  cab1Active: 75,
}

// --------------------------------------------------------------- the spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const gojiraSpec: PluginSpec = {
  id: 'gojira',
  name: 'Archetype Gojira',
  whenToUse:
    'modern metal, djent, thrash, and hard rock, but also covers vintage cleans and crunch — ' +
    'RUST spans classic crunch to high gain, so this is the default choice when no other plugin fits better',
  signalChain:
    'WOW (pitch) → OCT (octaver) → OD → DRT → PHSR → CHR → AMP (CLN | RUST | HOT) → graphic EQ → CAB → DLY → RVB',
  doc: 'gojira.md',

  amps: AMPS,
  ampDescriptions: AMP_DESCRIPTIONS,
  ampSelect: { cc: 20, values: { CLN: 0, RUST: 64, HOT: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  groups: { ...PEDAL_GROUPS, ...AMP_GROUPS },
  alwaysOn: ALWAYS_ON,

  app: {
    candidates: {
      win32: [path.join(PROGRAM_FILES, 'Neural DSP', 'Archetype Gojira', 'Archetype Gojira.exe')],
      // No macOS path confirmed yet -- deliberately absent, not invented.
      // See opentimbre-cross-platform and AppInfo.candidates' own doc.
    },
    process: 'Archetype Gojira.exe',
    settings: path.join('Neural DSP', 'Archetype Gojira'),
    midiFolder: 'MIDI Mappings',
    mapping: 'gojira-neural-ai.xml',
  },
}
