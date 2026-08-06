Plugin signed by John Petrucci (Dream Theater), designed above his rig: tight high-gain for riffs in broken time, singing legato leads, big clean tones with chorus and delay, and the **piezo pickup** of the Music Man Majesty. Territory: Dream Theater, Liquid Tension Experiment, Symphony X, Rush, prog metal in general, and anything that calls for weight **with melody**.

Where he wins and where he loses, against other catalog plugins:

- Against **Gojira**: choose Petrucci when the request calls for articulated weight with a melodic solo on top. Gojira wins on djent, thrash, and pure weight.
- Against **Soldano**: both cover hard rock and prog, but Soldano is the SLO-100 of 1992 records — hotter and more vintage. Petrucci is the modern sound, tighter on bass and more controlled on treble.
- Against **Tim Henson**: Henson wins on elaborately fingerpicked/clean tapping. Petrucci wins on anything needing weight.
- **Nothing in the catalog has PIEZO.** If the song alternates electric and acoustic, or if the request cites acoustic guitar, viola, 12-string, or "acoustic", this plugin is the only possible answer — see the dedicated section below.

### The four amps — calibration

The amp stays for the whole song, so choose by the most demanding section. The only exception is PIEZO, which only makes sense when acoustic is the protagonist.

- **PIEZO** — not an amplifier, it's the piezo pickup preamp. No gain, no master; tone comes entirely from `body`, `air`, and the tonestack. Never distorts under any circumstances.
- **CLEAN** — the clean channel. gain 2–4: crystalline, headroom enough to take full chords without breaking up; 5–6.5: thickens and starts saturating on strong notes, that "warm" ballad clean. `bright` on is standard — turn off only if request calls for dark/muffled clean.
- **RHYTHM** — the riff channel. gain 4–5.5: full-bodied crunch with open chord note definition still audible; 6–7.5: standard prog metal weight, where it lives most; 8+: loses definition, and on this amp definition is the point.
- **LEAD** — the solo channel. gain 5–6.5: legato sustain and compression without fizz (primary use); 7–8: solo that needs to sing over a dense band; 9+: almost never the answer.

Heavy music with solo? **RHYTHM** for the whole track, solo scenes made with boost + `soar`, NOT changing amp — the amp stays the same for all scenes. Choose LEAD when the solo is the protagonist and the riff is secondary.

### Controls unique to one amp

These are the plugin's character. All are required or resolve on their own, but the **value matters**:

- **`tight` (RHYTHM)** is the most useful control on the entire plugin. Cuts bass BEFORE the preamp, tightening palm mute without retuning after. 5–7 on heavy riffs, 7–8.5 on fast low-string riffs, 3–4 when riff is open and needs body. Raise `tight` before lowering `bass`.
- **`bite` (RHYTHM)** boosts attack: engage on fast riffs where pick attack needs to appear. Disengage on slow sustained riffs — becomes too aggressive.
- **`midBoost` (RHYTHM)** pushes mids forward. Engage when riff needs to cut; disengage when mix already has keyboards in that range — normal situation in prog.
- **`soar` (LEAD)** is what makes legato float above the band. Engage on almost every solo; it's `soar`, not gain, that gives Petrucci's liquid quality.
- **`bright` (CLEAN)** on by default, as above.
- **`body` and `air` (PIEZO)** — see Piezo section.

### Volume: `output` to balance, `level` for character

`output` (labeled **Output** on screen) is output trim, and it's how you balance volume between scenes — solo louder than rhythm here, never by raising gain. `level` (labeled **Master**) is the power stage: 4–6 opens without hardening. PIEZO does not have `level`; field is ignored there.

There's also `volumeGain`, the Volume section — the simulated guitar volume. **Keep at 10.** It exists for the rare request for "lowered guitar volume" sound (that compressed-clean you make by lowering guitar volume with amp distorted): then RHYTHM with high gain and `volumeGain` 4–5.

### PIEZO — what no other catalog plugin does

Use when the song has real acoustic guitar, or when the request cites acoustic. Don't use as "cleaner than clean": it's not an amp, and in an electric band context it sounds thin and displaced.

- `body` is the simulated cabinet body. 6–7 is standard; below 4 thin/brittle, above 8 muffled without pick definition.
- `air` on = steel-string sparkle — fingerstyle almost always wants it; accomiment chords usually better without.
- Conservative tonestack: bass 4–5, mid 6–7, treble 6–7. Piezo is naturally harsh on upper-mids; exaggerating treble exposes piezo character.
- Compressor 3–5 helps greatly on fingerstyle, same reason it helps on real acoustic.
- Reverb 3–5 with `rvbPreDelay` 3–4 gives the room. Delay usually interferes.
- Everything else — overdrive, flanger, any boost — off.

On a song that **alternates** acoustic and electric, the rig amp is one. Choose the electric amp the song needs most, and state in the scene's `explicacao` that the guitarist needs to manually switch Amp Type to PIEZO for that section.

### Pre chain

- **`odOn` is the solo pedal.** Classic use: `odDrive` 1–3 with `odLevel` 7–9 pushes amp and tightens bass without dirt — this is how you make a solo scene, not by raising gain. With drive 4–6 becomes real saturation, for riffs needing more than the amp provides.
- **`compOn`** (no Attack here) 3–5 is musical on clean and piezo. On RHYTHM or LEAD at high gain amp compresses itself — leave off.
- **`wahOn`** only if request cites wah. Without expression pedal, `wahPosition` becomes a fixed filter: 6–8 is the "cocked wah" for solo, which is a legitimate sound well within territory.
- **`phaserOn` and `flangerOn`** are period-specific and phrase-specific. Phaser rate 2–3 on ballad cleans; flanger only when recording clearly has it — with `flangerFeedback` below 6, or it becomes jet engine.
- **`chorusOn` (pre) vs `chorus2On` (post)**: post is what you want in almost every case, because it modulates the already-amplified sound and matches the giant clean tones on records. Pre is for the dirtier/dated effect, with chorus entering the amp.

### Post: dual delay and reverb

This is one plugin where post effects are part of the tone, not seasoning — but criterion remains the recording: if it's dry, leave it dry.

- **Delay is dual**: `dlyTimeL` and `dlyTimeR` are independent, and that's the trick. Different values (something like 4 and 6) spread repeats across stereo giving characteristic width; same values keep everything centered, which you want when mix is already dense.
- `dlyMix` 2–3.5 on clean, 1.5–2.5 on solo, 0–1 on heavy riff. `dlyFeedback` 2–4 for repeats fading before next bar.
- `dlyTape` 2–4 darkens tail preventing delay competing with note; `dlyModulation` 1–3 prevents repeats sounding cloned.
- `rvbMix` 3–5 on clean and piezo, 2–3 on solo, 1–2 on heavy riff.
  `rvbPreDelay` 3–5 is the trick keeping note attack dry even with lots of reverb — use whenever raising mix.
- `rvbShimmer` only on ambient passages. On rhythmic or heavy scenes, off.

### What you can't control

- **Parametric EQ**: bands not mapped — only toggle. Keep `eqOn` false and shape tone through tonestack, `tight`, and overdrive alone.
- **Cabinet**: microphone placement out of scope, as with other plugins.
- **All four `*Mode`** parameters (phaser, chorus, chorus 2, delay) haven't been probed yet — don't know what each position does. Leave at false and dial tone through other controls.
- **Amp Type switching** may require manual action depending on setup — app will notify when needed.

### Recipes by territory

- **Prog metal riff**: RHYTHM gain 6.5, tight 6.5, bite on, midBoost off, bass 5, mid 5.5, treble 6, presence 6, master 5, gate 5, delay off, reverb mix 1.5.
- **Singing lead**: LEAD gain 6, soar on, bass 4, mid 6.5, treble 6, presence 6.5, master 5.5, od (drive 2, level 8, tone 6), delay mix 2.5 with L 4 / R 6, reverb mix 2.5 with pre-delay 4.
- **Big ballad clean**: CLEAN gain 3, bright on, bass 5, mid 5, treble 6, presence 5.5, master 5, comp 4, chorus2 (mix 3, rate 3, depth 4), delay mix 3 with L 4 / R 5.5, reverb mix 4 with pre-delay 4.
- **Acoustic**: PIEZO body 6.5, air on, bass 4.5, mid 6.5, treble 6.5, presence 5.5, comp 4, reverb mix 4 with pre-delay 3.5, everything else off.
- **Solo over dense band**: RHYTHM gain 6.5, tight 5.5, midBoost on, od (drive 2.5, level 8.5), output 1.5 above base scene, delay mix 2, reverb mix 2.
