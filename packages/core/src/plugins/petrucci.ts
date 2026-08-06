/**
 * Neural DSP Archetype: Petrucci X — the plugin descriptor.
 *
 * Everything that describes the plugin — the CC map, ranges, amps, which
 * parameters are required, which knobs belong to which section — lives here.
 * The zod schema, the doc injected into the system prompt, and the MIDI send
 * are all derived from this file, per `opentimbre-plugin-spec`.
 *
 * Transcribed from two legacy sources, cross-checked line by line:
 * - `legacy/src/plugins/petrucci.ts` — the working PluginSpec-shaped object
 *   the old app actually sent MIDI from. Present on disk in this repo's
 *   `legacy/` working tree.
 * - `legacy/prompts/plugins/petrucci.md` — the Portuguese tone knowledge base
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
 * - The amp keys (`PIEZO`/`CLEAN`/`RHYTHM`/`LEAD`) and the abstract parameter
 *   names (`gain`, `bass`, `mid`, `treble`, ...) are already English identifiers
 *   in legacy — they're the plugin's own GUI labels and the AI-facing schema
 *   names, not Portuguese, so they carry over unchanged. Only the `desc` prose
 *   (Portuguese in legacy) is translated to English.
 */

import path from 'node:path'
import type { FixedParamSpec, ParamSpec, PluginSpec } from './types.ts'

// ---------------------------------------------------------------- amplificador

const AMPS = ['PIEZO', 'CLEAN', 'RHYTHM', 'LEAD'] as const

const AMP_DESCRIPTIONS: Record<string, string> = {
  PIEZO:
    'piezo pickup preamp of the Music Man Majesty (internal: `piezo*`) — near-acoustic sound, ' +
    'no gain stage at all; the only one without Gain or Master, and the only one with Body and Air',
  CLEAN:
    'high-headroom clean (internal: `clean*`) — crystalline and sparkly when Bright is engaged; ' +
    'the foundation for prog arpeggios and clean tones with chorus and delay',
  RHYTHM:
    'crunch to high-gain, tight (internal: `rhythm*`) — the riff channel: Tight cleans bass before ' +
    'the preamp, Bite adds attack, Mid Boost pushes mids forward',
  LEAD:
    'singing high-gain (internal: `lead*`) — the solo channel, with compression and long sustain ' +
    'for legato; Soar boosts mids to make solo notes float above the band',
}

/**
 * Four independent amps — none share anything. Each has its own tonestack.
 * Unlike Gojira or Tim Henson, PIEZO is NOT an amplifier: it's a piezo pickup
 * preamp with no gain stage. This is why `AMP_CORE` excludes `gain` and `level`.
 */
const AMP_PARAMS = {
  gain: {
    type: 'knob',
    required: true,
    desc: 'preamp gain (PIEZO does not have one, ignored there)',
  },
  bass: { type: 'knob', required: true, desc: 'amp bass' },
  mid: {
    type: 'knob',
    required: true,
    desc: 'amp mids — decides whether the guitar sits in or disappears from the mix',
  },
  treble: { type: 'knob', required: true, desc: 'amp treble' },
  presence: {
    type: 'knob',
    required: true,
    desc: 'boosts upper-mids and attack definition — all four amps have this',
  },
  level: {
    type: 'knob',
    required: true,
    desc: 'Master: power-stage volume — opening it changes character, not just volume (PIEZO does not have this, ignored there)',
  },
  output: {
    type: 'knob',
    required: true,
    desc: 'Output: output trim — balances volume between scenes without touching the tone',
  },

  /** Only PIEZO. Required because it defines the amp's character — omitting would leave scene inheriting preset value where control matters most. */
  body: {
    type: 'knob',
    required: true,
    desc: 'Body — only PIEZO has it: simulated acoustic body resonance; below 4 becomes thin and brittle (ignored on other amps)',
  },
  air: {
    type: 'toggle',
    required: false,
    desc: 'Air — only PIEZO has it: ultra-high-treble boost, steel-string sparkle (ignored on other amps)',
  },

  /** Only RHYTHM. Required because it defines the riff channel character. */
  tight: {
    type: 'knob',
    required: true,
    desc: 'Tight — only RHYTHM has it: cuts bass BEFORE the preamp, tightening palm mute without retuning; 5–7 on heavy riffs (ignored on other amps)',
  },
  bite: {
    type: 'toggle',
    required: false,
    desc: 'Bite — only RHYTHM has it: attack boost, makes pick attack appear in fast riffs',
  },
  midBoost: {
    type: 'toggle',
    required: false,
    desc: 'Mid Boost — only RHYTHM has it: pushes mids forward; pulls riff out of hiding but interferes when mix already has keyboards',
  },
  bright: {
    type: 'toggle',
    required: false,
    desc: 'Bright switch — only CLEAN has it; adds brightness and sparkle to clean tone',
  },
  soar: {
    type: 'toggle',
    required: false,
    desc: 'Soar — only LEAD has it: mid-boost that makes solo notes float above the band; gives Petrucci\'s liquid legato',
  },

  /** Without mapped bands, this toggle only prevents a preset EQ from coloring the scene. PIEZO has no EQ. */
  eqOn: {
    type: 'toggle',
    required: false,
    desc: 'parametric EQ on — bands are not controllable via MIDI, so keeping false prevents a preset EQ from coloring the scene',
  },
} as const satisfies Record<string, ParamSpec>

/** 5 controls all four amps share. `gain` and `level` excluded — PIEZO has neither (it's a piezo preamp, not an amplifier). */
const AMP_CORE = ['bass', 'mid', 'treble', 'presence', 'output'] as const

/** CC of each parameter, per amp. Absent = that control doesn't exist on that amp. */
const AMP_CC: Record<string, Record<string, number>> = {
  PIEZO: { body: 21, air: 22, bass: 23, mid: 24, treble: 25, presence: 26, output: 27 },
  CLEAN: { gain: 28, bright: 29, bass: 30, mid: 31, treble: 32, presence: 33, level: 34, output: 35, eqOn: 54 },
  RHYTHM: { gain: 36, bite: 37, tight: 38, bass: 39, mid: 40, midBoost: 41, treble: 42, presence: 43, level: 44, output: 45, eqOn: 55 },
  LEAD: { gain: 46, bass: 47, mid: 48, soar: 49, treble: 50, presence: 51, level: 52, output: 53, eqOn: 56 },
}

// ------------------------------------------------------------------ parâmetros

/**
 * Fixed CC — global utilities, 5 pre pedals, Volume section, 3 post pedals.
 * Order: signal chain. Tonestack is NOT here (per-amp, lives in AMP_CC).
 */
const PARAMS = {
  gateOn: { cc: 1, type: 'toggle', required: false, desc: 'noise gate on' },
  gateThreshold: {
    cc: 2,
    type: 'knob',
    required: false,
    desc: 'noise gate: attenuates signal below threshold — raise at high gain to quiet hiss',
  },

  /** Required unlike Soldano: the app can't read plugin state, and a preset transpose would leave ALL scenes in wrong key. */
  transpose: {
    cc: 3,
    type: 'knob',
    required: true,
    off: 5,
    desc: 'transpose pitch in semitones: 5 = standard tuning (0 st), 0 = -12 st, 10 = +12 st. Use 5 unless request cites alternate tuning',
  },
  doublerOn: {
    cc: 4,
    type: 'toggle',
    required: false,
    desc: 'doubles the signal to simulate a wider stereo image',
  },
  doublerSpread: {
    cc: 5,
    type: 'knob',
    required: false,
    desc: 'detuning between the two sides of the doubler — higher = wider stereo',
  },

  // ---- WAH (first in chain)
  wahOn: { cc: 57, type: 'toggle', required: true, desc: 'wah on' },
  wahPosition: {
    cc: 58,
    type: 'knob',
    required: false,
    desc: 'wah pedal position (0 = heel/bass, 10 = toe/treble). With no expression pedal the wah becomes a fixed filter — 6–8 is the "cocked wah" for solo',
  },

  // ---- COMP (no Attack parameter, different from Soldano and Tim Henson)
  compOn: { cc: 59, type: 'toggle', required: true, desc: 'compressor on' },
  compAmount: { cc: 60, type: 'knob', required: false, desc: 'compression amount' },
  compLevel: {
    cc: 61,
    type: 'knob',
    required: false,
    desc: 'compressor output level — compensate for volume loss due to compression',
  },

  // ---- OD
  odOn: { cc: 66, type: 'toggle', required: true, desc: 'overdrive on' },
  odDrive: { cc: 67, type: 'knob', required: false, desc: 'overdrive drive (low = boost)' },
  odTone: { cc: 68, type: 'knob', required: false, desc: 'overdrive tone (treble)' },
  odLevel: { cc: 69, type: 'knob', required: false, desc: 'overdrive level (high = boost)' },

  // ---- PHSR
  phaserOn: { cc: 70, type: 'toggle', required: true, desc: 'phaser on' },
  phaserRate: { cc: 71, type: 'knob', required: false, desc: 'phaser speed' },
  phaserMode: {
    cc: 72,
    type: 'toggle',
    required: false,
    desc: 'phaser mode selector — which is which hasn\'t been probed yet; false is the default plugin mode',
  },

  // ---- CHR (pre-amp chorus)
  chorusOn: { cc: 73, type: 'toggle', required: true, desc: 'pre-amp chorus on' },
  chorusRate: { cc: 74, type: 'knob', required: false, desc: 'pre-amp chorus speed' },
  chorusDepth: { cc: 75, type: 'knob', required: false, desc: 'pre-amp chorus depth' },
  chorusLevel: { cc: 76, type: 'knob', required: false, desc: 'pre-amp chorus level' },
  chorusMode: {
    cc: 77,
    type: 'toggle',
    required: false,
    desc: 'pre-amp chorus mode selector — which is which hasn\'t been probed yet; false is the default plugin mode',
  },

  // ---- FLG
  flangerOn: { cc: 78, type: 'toggle', required: true, desc: 'flanger on' },
  flangerRate: { cc: 79, type: 'knob', required: false, desc: 'flanger speed' },
  flangerDepth: { cc: 80, type: 'knob', required: false, desc: 'flanger depth' },
  flangerRange: {
    cc: 81,
    type: 'knob',
    required: false,
    desc: 'frequency sweep range of the flanger',
  },
  flangerFeedback: {
    cc: 82,
    type: 'knob',
    required: false,
    desc: 'flanger feedback — above 7 becomes jet engine',
  },

  // ---- VOLUME (own section between EQ and post-effects)
  volumeGain: {
    cc: 83,
    type: 'knob',
    required: true,
    desc: 'Volume section guitar volume — keep at 10 unless request calls for "lowered guitar volume" sound',
  },
  volumeMidPoint: {
    cc: 84,
    type: 'knob',
    required: true,
    desc: 'Volume curve midpoint — 1.5 is the plugin default; only adjust if volume responds strangely',
  },

  // ---- CHR2 (post-amp chorus)
  chorus2On: { cc: 85, type: 'toggle', required: true, desc: 'post-amp chorus on' },
  chorus2Mix: { cc: 86, type: 'knob', required: false, desc: 'post-amp chorus mix' },
  chorus2Rate: { cc: 87, type: 'knob', required: false, desc: 'post-amp chorus speed' },
  chorus2Depth: { cc: 88, type: 'knob', required: false, desc: 'post-amp chorus depth' },
  chorus2Mode: {
    cc: 89,
    type: 'toggle',
    required: false,
    desc: 'post-amp chorus mode selector — which is which hasn\'t been probed yet; false is the default plugin mode',
  },

  // ---- DLY (dual: L and R with independent times)
  dlyOn: { cc: 90, type: 'toggle', required: true, desc: 'delay on' },
  dlyMix: { cc: 91, type: 'knob', required: false, desc: 'delay mix' },
  dlyTimeL: { cc: 92, type: 'knob', required: false, desc: 'left side delay time' },
  dlyTimeR: {
    cc: 93,
    type: 'knob',
    required: false,
    desc: 'right side delay time — different from left spreads repeats across stereo; same as left keeps everything centered',
  },
  dlyFeedback: { cc: 94, type: 'knob', required: false, desc: 'delay repeats' },
  dlyMode: {
    cc: 95,
    type: 'toggle',
    required: false,
    desc: 'delay mode selector — which is which hasn\'t been probed yet; false is the default plugin mode',
  },
  dlyTape: {
    cc: 96,
    type: 'knob',
    required: false,
    desc: 'tape saturation and wow/flutter on repeats — adds analog character and darkens the tail',
  },
  dlyModulation: {
    cc: 97,
    type: 'knob',
    required: false,
    desc: 'modulation on repeats — small doses prevent repeats from sounding cloned',
  },

  // ---- RVB
  rvbOn: { cc: 98, type: 'toggle', required: true, desc: 'reverb on' },
  rvbMix: { cc: 99, type: 'knob', required: false, desc: 'reverb mix (rock usually sits 1–3)' },
  rvbDecay: { cc: 100, type: 'knob', required: false, desc: 'reverb tail length' },
  rvbPreDelay: {
    cc: 101,
    type: 'knob',
    required: false,
    desc: 'delay before tail starts — raising keeps note attack dry and clean even with lots of reverb',
  },
  rvbShimmer: {
    cc: 102,
    type: 'toggle',
    required: false,
    desc: 'Shimmer: overlays a tail an octave above — ethereal, use sparingly',
  },
} as const satisfies Record<string, FixedParamSpec>

/**
 * Toggle → knobs it governs. All four `*Mode` excluded on purpose: they are
 * character switches, not "effect off" dependencies — same treatment Gojira
 * gives to `wowMode` and Soldano gives to `bright`/`mode`.
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
 * Section bypasses, forced to 127 before every scene. There are **seven** here
 * vs five on Tim Henson: Petrucci separates Wah+Comp from other pre-effects
 * and has its own dedicated Volume section. Missing any would leave part of the
 * chain bypassed with no way for the app to detect it.
 */
const ALWAYS_ON: Record<string, number> = {
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

export const petrucciSpec: PluginSpec = {
  id: 'petrucci',
  name: 'Archetype Petrucci X',
  whenToUse:
    'prog metal and progressive rock in Dream Theater territory — heavy but articulate riffs ' +
    'in broken time signatures, singing legato leads, crystalline clean tones with chorus and ' +
    'delay, and the PIEZO, an acoustic sound no other catalog plugin offers. Against Soldano ' +
    '(which is the SLO-100 of 1992 albums) choose Petrucci for modern tight high-gain and ' +
    'any song alternating electric and acoustic; against Gojira, choose it when weight comes ' +
    'accompanied by melody rather than pure weight',
  signalChain:
    'GATE → WAH → COMP → OD → PHSR → CHR → FLG → AMP (PIEZO | CLEAN | RHYTHM | LEAD) → CAB → ' +
    'parametric EQ → VOLUME → CHR2 → DLY → RVB',
  doc: 'petrucci.md',

  amps: AMPS,
  ampDescriptions: AMP_DESCRIPTIONS,
  /** Four positions, not three — values are the unverified JUCE `AudioParameterChoice` hypothesis. */
  ampSelect: { cc: 20, values: { PIEZO: 0, CLEAN: 42, RHYTHM: 85, LEAD: 127 } },
  ampCore: AMP_CORE,
  ampParams: AMP_PARAMS,
  ampCC: AMP_CC,
  params: PARAMS,
  groups: PEDAL_GROUPS,
  alwaysOn: ALWAYS_ON,

  app: {
    candidates: {
      win32: [path.join(PROGRAM_FILES, 'Neural DSP', 'Archetype Petrucci X', 'Archetype Petrucci X.exe')],
      // No macOS path confirmed yet -- deliberately absent, not invented.
    },
    process: 'Archetype Petrucci X.exe',
    settings: path.join('Neural DSP', 'Archetype Petrucci X'),
    midiFolder: 'MIDI',
    mapping: 'petrucci-neural-ai.xml',
  },
}
