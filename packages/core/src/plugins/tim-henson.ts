/**
 * Neural DSP Archetype: Tim Henson X — the plugin descriptor.
 *
 * Everything that describes the plugin — the CC map, ranges, amps, which
 * parameters are required, which knobs belong to which section — lives here.
 * The zod schema, the doc injected into the system prompt, and the MIDI send
 * are all derived from this file, per `opentimbre-plugin-spec`.
 *
 * Transcribed from two legacy sources, cross-checked line by line:
 * - `legacy/src/plugins/tim-henson.ts` — the working PluginSpec-shaped object
 *   the old app actually sent MIDI from. Present on disk in this repo's
 *   `legacy/` working tree.
 * - `legacy/prompts/plugins/tim-henson.md` — the Portuguese tone knowledge base
 *   ported to bilingual EN/PT docs.
 *
 * Both sources agree on every CC, range, option value, and amp selector
 * transcribed below — zero discrepancies between them.
 *
 * Two porting decisions, since legacy's field/type names are Portuguese and
 * this file's shape (`PluginSpec` in `types.ts`) is English:
 * - Structural field names translate (`nome` → `name`, `quando` → `whenToUse`,
 *   `ampDesc` → `ampDescriptions`, `valores` → `values`, `grupos` → `groups`,
 *   `sempreLigado` → `alwaysOn`, `candidatos` → `candidates.win32`, ...)
 * - The amp keys (`ROSES`/`CHERUBS`/`PINK`) and the abstract parameter names
 *   (`gain`, `bass`, `mid`, `treble`, ...) are already English identifiers
 *   in legacy — they're the plugin's own GUI labels and the AI-facing schema
 *   names, not Portuguese, so they carry over unchanged. Only the `desc`
 *   prose (Portuguese in legacy) is translated to English.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.ts'

// ---------------------------------------------------------------- amplificador

const AMPS = ['ROSES', 'CHERUBS', 'PINK'] as const

const AMP_DESCRIPTIONS: Record<string, string> = {
  ROSES: 'clean channel (internal: acoustic) — territory for fingerpicking, arpeggios, and near-acoustic tones; the only amp with Blend control',
  CHERUBS: 'articulated crunch (internal: rhythm) — low to medium gain with attack preserved, for riffs that need note-by-note definition; has its own channel selector',
  PINK: 'high gain (internal: lead) — the amp for compressed, singing leads and heavy riffs; the only one with a separate Master (level)',
}

/**
 * Three independent amps — none share anything. Each has its own tonestack
 * and graphic EQ built into the amp block. Unlike Soldano, the tonestack is
 * NOT fixed-CC because each amp controls it independently.
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
  presence: {
    type: 'knob',
    required: false,
    desc: 'boosts upper-mids and attack definition — all three amps have this',
  },
  output: {
    type: 'knob',
    required: true,
    desc: 'Level: output trim — balances volume between scenes without touching the tone',
  },
  level: {
    type: 'knob',
    required: false,
    desc: 'Master: power-stage volume — opening it changes character, not just volume (only PINK has this)',
  },
  blend: {
    type: 'knob',
    required: true,
    desc: 'Blend — only ROSES has it: mixes the amp\'s two signal paths and significantly changes clean tone character; 5 is starting point (ignored on other amps)',
  },
  channel: {
    type: 'toggle',
    required: false,
    desc: 'CHERUBS channel selector — true = higher gain/body channel, false = cleaner channel (only CHERUBS has this)',
  },
  eqOn: {
    type: 'toggle',
    required: false,
    desc: 'amp graphic EQ on — bands are not controllable via MIDI, so keeping false prevents a preset EQ from coloring the scene',
  },
} as const satisfies Record<string, ParamSpec>

/** 5 controls all three amps share — mapped-criterion. */
const AMP_CORE = ['gain', 'bass', 'mid', 'treble', 'output'] as const

const AMP_CC: Record<string, Record<string, number>> = {
  ROSES: { gain: 21, bass: 22, mid: 23, treble: 24, presence: 25, blend: 26, output: 27, eqOn: 42 },
  CHERUBS: { gain: 28, channel: 29, bass: 30, mid: 31, treble: 32, presence: 33, output: 34, eqOn: 43 },
  PINK: { gain: 35, bass: 36, mid: 37, treble: 38, presence: 39, level: 40, output: 41, eqOn: 44 },
}

// ------------------------------------------------------------------ parâmetros

/**
 * Fixed CC — global utilities, 3 pre pedals, 3 post pedals, and Multivoicer toggle.
 * Order: signal chain. Tonestack is NOT here (per-amp, lives in AMP_CC).
 */
const PARAMS = {
  gateOn: { cc: 46, type: 'toggle', required: false, desc: 'noise gate on' },
  gateThreshold: {
    cc: 47,
    type: 'knob',
    required: false,
    desc: 'noise gate: attenuates signal below threshold — raise at high gain to quiet hiss',
  },
  doublerOn: {
    cc: 48,
    type: 'toggle',
    required: false,
    desc: 'doubles the signal to simulate a wider stereo image',
  },
  doublerSpread: {
    cc: 49,
    type: 'knob',
    required: false,
    desc: 'detuning between the two sides of the doubler — higher = wider stereo',
  },

  // ---- BOOST (first in pre pedal chain)
  boostOn: { cc: 50, type: 'toggle', required: true, desc: 'boost on' },
  boostGain: {
    cc: 51,
    type: 'knob',
    required: false,
    desc: 'boost gain — low compresses bass and pushes the amp without dirt',
  },
  boostLevel: { cc: 52, type: 'knob', required: false, desc: 'boost output level (high = boost)' },
  boostBass: {
    cc: 53,
    type: 'knob',
    required: false,
    desc: 'boost bass — lowering cleans up bass before the amp, classic use',
  },
  boostTreble: { cc: 54, type: 'knob', required: false, desc: 'boost treble' },

  // ---- COMP
  compOn: { cc: 55, type: 'toggle', required: true, desc: 'compressor on' },
  compAmount: { cc: 56, type: 'knob', required: false, desc: 'compression amount' },
  compLevel: {
    cc: 57,
    type: 'knob',
    required: false,
    desc: 'compressor output level — compensate for volume loss due to compression',
  },
  compAttack: {
    cc: 58,
    type: 'toggle',
    required: false,
    desc: 'compressor attack — true = Fast (flattens attack), false = Slow (lets pick attack through)',
  },

  // ---- OD
  odOn: { cc: 60, type: 'toggle', required: true, desc: 'overdrive on' },
  odDrive: { cc: 61, type: 'knob', required: false, desc: 'overdrive drive (low = boost)' },
  odTone: { cc: 62, type: 'knob', required: false, desc: 'overdrive tone (treble)' },
  odLevel: { cc: 63, type: 'knob', required: false, desc: 'overdrive level (high = boost)' },

  // ---- MULTIVOICER (polyphonic harmonizer, CC 80–91)
  multivoicerOn: {
    cc: 80,
    type: 'toggle',
    required: false,
    desc: 'Multivoicer polyphonic harmonizer on — enable when the request calls for harmony (thirds, fifths, octaves) or Polyphia-style stacked guitar texture',
  },
  multivoicerQuantize: {
    cc: 83,
    type: 'toggle',
    required: false,
    desc: 'quantizes voices to the Root/Mode scale — keep false since Root/Mode are not adjustable here; this keeps intervals chromatic across any key',
  },
  multivoicerVoice1On: { cc: 84, type: 'toggle', required: false, desc: 'Multivoicer voice 1 on' },
  multivoicerVoice1Level: {
    cc: 86,
    type: 'knob',
    required: false,
    desc: 'voice 1 level — below dry signal (3–6) thickens without competing with melody',
  },
  multivoicerVoice2On: { cc: 87, type: 'toggle', required: false, desc: 'Multivoicer voice 2 on' },
  multivoicerVoice2Level: {
    cc: 89,
    type: 'knob',
    required: false,
    desc: 'voice 2 level — typically kept below voice 1',
  },
  multivoicerVoice3On: { cc: 92, type: 'toggle', required: false, desc: 'Multivoicer voice 3 on' },
  multivoicerVoice3Level: {
    cc: 94,
    type: 'knob',
    required: false,
    desc: 'voice 3 level — with 3 or 4 voices the set becomes chords, so keep each lower than the previous',
  },
  multivoicerVoice4On: { cc: 95, type: 'toggle', required: false, desc: 'Multivoicer voice 4 on' },
  multivoicerVoice4Level: {
    cc: 97,
    type: 'knob',
    required: false,
    desc: 'voice 4 level — lowest of the set; above 5 the chord swallows the melody',
  },
  multivoicerWidth: {
    cc: 90,
    type: 'knob',
    required: false,
    desc: 'stereo spread between voices: 0 = all center, 10 = voices well separated on sides',
  },
  multivoicerOutput: {
    cc: 91,
    type: 'knob',
    required: false,
    desc: 'overall Multivoicer block volume — use to balance the entire harmony against dry signal',
  },

  // ---- CHR
  chorusOn: { cc: 65, type: 'toggle', required: true, desc: 'chorus on' },
  chorusMix: { cc: 66, type: 'knob', required: false, desc: 'chorus mix' },

  // ---- DLY
  dlyOn: { cc: 70, type: 'toggle', required: true, desc: 'delay on' },
  dlyMix: { cc: 71, type: 'knob', required: false, desc: 'delay mix' },
  dlyTime: { cc: 72, type: 'knob', required: false, desc: 'delay time' },
  dlyFeedback: { cc: 73, type: 'knob', required: false, desc: 'delay repeats' },

  // ---- RVB
  rvbOn: { cc: 75, type: 'toggle', required: true, desc: 'reverb on' },
  rvbMix: { cc: 76, type: 'knob', required: false, desc: 'reverb mix (rock usually sits 1–3)' },
  rvbDecay: { cc: 77, type: 'knob', required: false, desc: 'reverb tail length' },
  rvbShimmer: {
    cc: 78,
    type: 'knob',
    required: false,
    desc: 'shimmer: adds an octave above the reverb tail — ethereal in small doses, synthetic above 4',
  },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs it governs. `compAttack` and `channel` excluded on purpose:
 * they are character switches, not "effect off" dependencies — same treatment
 * Gojira gives to `wowMode` and Soldano gives to `bright`/`mode`.
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
 * Section bypasses, forced to 127 before every scene. Unlike Soldano's naming
 * guess, Henson does NOT share Gojira's internal names (`pedalsActiveID`/`fxActive`):
 * here they are `preFXActive`/`postFXActive` — confirmed against XML header.
 *
 * `eqSectionOn` is the full EQ section bypass and belongs here; the creative
 * EQ toggle per amp is `eqOn` (CC 42/43/44), controlled by the AI.
 */
const ALWAYS_ON: Record<string, number> = {
  preFxSectionOn: 110,
  ampSectionOn: 111,
  cabSectionOn: 112,
  eqSectionOn: 113,
  postFxSectionOn: 114,
}

// -------------------------------------------------------------------- o spec

const PROGRAM_FILES = process.env['ProgramFiles'] ?? 'C:\\Program Files'

export const timHensonSpec: PluginSpec = {
  id: 'tim-henson',
  name: 'Archetype Tim Henson X',
  whenToUse:
    'modern instrumental and progressive music in Polyphia territory — clean fingerpicking ' +
    'and tapping, articulate note-defined crunch, compressed singing leads, lots of delay ' +
    'and reverb; choose when the request calls for clarity, dynamics, and near-acoustic sound ' +
    'instead of Gojira\'s weight or Soldano\'s vintage overdrive',
  signalChain:
    'GATE → BOOST → COMP → OD → AMP (ROSES | CHERUBS | PINK) → CAB → MULTIVOICER → ' +
    'graphic EQ → CHR → DLY → RVB',
  doc: 'tim-henson.md',

  amps: AMPS,
  ampDescriptions: AMP_DESCRIPTIONS,
  ampSelect: { cc: 20, values: { ROSES: 0, CHERUBS: 64, PINK: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  groups: PEDAL_GROUPS,
  alwaysOn: ALWAYS_ON,

  app: {
    candidates: {
      win32: [path.join(PROGRAM_FILES, 'Neural DSP', 'Archetype Tim Henson X', 'Archetype Tim Henson X.exe')],
      // No macOS path confirmed yet -- deliberately absent, not invented.
    },
    process: 'Archetype Tim Henson X.exe',
    settings: path.join('Neural DSP', 'Archetype Tim Henson X'),
    midiFolder: 'MIDI',
    mapping: 'tim-henson-neural-ai.xml',
  },
}
