Simulation of the amps and pedals Joe Duplantier uses. Covers modern metal and
djent, but the range is much wider than the name suggests.

### Gain calibration per amplifier

The amp is **fixed for the whole song** — it doesn't change between scenes.
Choose it by the dominant territory and cover the other sections with gain,
pedals, and guitar volume.

- **CLN** (Fender Twin Reverb) — gain 1–4: crystal-clean with headroom;
  5–7: starts to warm up, breaks up lightly on a hard attack (blues, soul);
  8+: outright breakup, raw and vintage. The choice for any genuine clean and
  for tones sitting right at the edge of breakup.
- **RUST** (EVH 5150 III blue channel) — the widest gain range in the
  plugin. gain 2–3.5: classic crunch (AC/DC, riff-driven rock); 4–5.5: hard
  rock (Guns, Van Halen-adjacent); 6–7.5: metal (thrash, groove); 8+:
  saturates and mushes the palm mute — almost never the answer. When in
  doubt between amps, this is the one.
- **HOT** (EVH 5150 III red channel) — already compressed out of the gate.
  gain 3–5: tight modern metal with defined attack; 6+: saturated wall, only
  for textures with no note definition. Use it only when the song genuinely
  lives in that world.

### Control quirks

- `level` and `output` are different things. `level` is the Master: opening
  it pushes the power stage and **changes the character** — it's what makes
  an amp "open up". `output` is just output trim, changing volume without
  touching the tone. Use `level` for the tone (4–6 is a good starting point)
  and `output` to balance volume between scenes.
- `presence` and `resonance` are optional — use them only when the tone
  calls for something specific. `presence` boosts treble and attack
  definition; raise it a bit (5–6.5) on tones that need to cut through.
  `resonance` reinforces the power stage's low end; at high gain it blurs
  quickly — above 6 together with high gain is almost always a mistake.
  **CLN has neither, nor `level`** — in exchange it's the only one with the
  `bright` switch, which brings back the sparkle when the volume is low.
- `gate` follows the gain: 4–6 in metal, 6–7 in staccato djent (a clean cut
  between notes is part of the style), 0–2 in crunch, off in clean.

### What the tone stack doesn't solve

The tone stack has 3 broad bands. When the problem is more surgical, use the
specific tools — but only when there's an actual problem to solve.

- **Graphic EQ** (`eqOn` + `eq1`..`eq9`, lowest to highest, 5 = flat):
  targeted correction per amplifier — clear the mud in `eq1`/`eq2` (4–4.5),
  tame upper-mid harshness in `eq7` (4–4.5), cut the fizz in `eq9`. Moves of
  ±1 to ±1.5 are enough; ±3 is a rebuild, not a correction. If you turn the
  EQ on, send all nine bands — leave the ones that don't change at 5.
- **Cabinet microphones** change the tone more than any EQ. `cab1Mic`:
  DYN57 aggressive and upper-mid forward (the rock/metal default), DYN421
  fuller and darker, COND414/COND184 open and detailed (cleans, arpeggios),
  RIB160/RIB121 dark and smooth (smooth solos, jazz). `cab1Position` 2–3 for
  an aggressive attack, 6–8 for round; `cab1Distance` low for anything
  riff-based (more attack and bass), high for air on cleans. Turn on
  `cab2On` with a different-character mic when the recording has a big, wide
  guitar sound — balance the levels and spread the pan (3 and 7). For most
  tones, one mic is enough.

### The pedals

- `odOn` (SD-1-style): the default boost. Solo or metal tightening: drive
  1–2, level 7–9, tone 5–6. As a drive pedal sounding on its own (blues
  rock): drive 4–6, level 5.
- `drtOn` (ProCo Rat-style): dirtier and more compressed than the overdrive.
  Use it when the recording's character is a distortion pedal, not a
  saturated amp (indie, grunge, fuzz-adjacent). `drtTone` is an inverted
  filter: higher = brighter.
- `wowOn` is a pitch shifter: `FATSO` mode adds a layer an octave below (use
  `wowPosition` and `wowMix`); `BLADE1`/`BLADE2` are divebomb effects. Off
  unless the song clearly calls for it.
- `octOn` (OC-2-style): `octOct1` an octave below, `octOct2` two octaves
  below, `octDirect` the dry signal — keep the direct signal high (7+) or it
  sounds synthetic.
- Delay: `dlyTime` is the BPM of the repeats (0 = slow, 10 = fast) — try to
  match the song's tempo. `dlyTone` low (3–4) hides the repeats behind the
  guitar; `dlySat` gives an analog character. `dlyMix` 2–3 for solo ambience,
  4+ only for delay-as-effect (U2, post-rock).
- Reverb: `rvbLowCut` 3–5 clears the mud from the tail; `rvbHighCut` low
  darkens and hides it. `rvbShimmer` overlays a tail an octave up — too
  striking for casual use; only for genuinely ethereal music.

### Recipes by territory

Proven starting points — adjust from them, not from scratch:

- **Djent / modern metal**: HOT gain 3.5–5 (or RUST 6.5–7.5) + OD boost
  (drive 1, level 8), gate 5.5–7, mid 4.5–5.5 (don't scoop it), DYN57
  position 2.
- **Thrash / 80s–90s metal**: RUST gain 6–7, bass 6, mid 3.5–4.5, treble 6,
  OD boost on solos, short room on the reverb (mix 1–2).
- **Hard rock**: RUST gain 4–5.5, mid 5.5–6.5, presence 5.5, no boost on the
  base.
- **Blues / classic rock**: CLN gain 6–8 (natural breakup) or RUST 2–3;
  reverb mix 2–3.
- **Modern clean**: CLN gain 2–3.5, bright on if it lacks sparkle, COND414,
  subtle chorus (mix 2), reverb mix 2.5–3.5.
