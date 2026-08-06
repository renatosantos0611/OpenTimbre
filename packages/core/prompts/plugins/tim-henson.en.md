Plugin signed by Tim Henson (Polyphia), designed for modern instrumental: nail or finger
picking, two-hand tapping, slides and harmonics, tight bass and glassy trebles. Territory:
Polyphia, Plini, Ichika Nito, math rock, instrumental R&B, pop with elaborate clean guitar.
For modern metal and djent Gojira serves better; for classic rock and liquid lead, Soldano.

What distinguishes this plugin from the other two is **clarity**: almost everything here sounds
better at lower gain than instinct suggests, because the repertoire depends on hearing every note
of an arpeggio or a tap. High gain on this plugin is the exception, not the starting point.

### The three amps — calibration

The amp stays for the whole song, so choose by the most demanding section.

- **ROSES** — the clean. gain 2–4: crystalline, with enough sustain for clean arpeggio/tapping;
  5–6: thickens and begins breaking up on strong notes. This is the amp for half of Polyphia's
  repertoire. Clean scenes almost always live here.
- **CHERUBS** — articulated crunch. gain 3–5: crunch that still lets you hear open chord notes;
  6–7: full-bodied rock. It's the middle ground for riffs needing weight without losing definition.
  `channel` adds gain and body when toggled on — test both before raising gain.
- **PINK** — high gain. gain 4–5.5: compressed, singing lead (the primary use); 6–7.5: heavy modern riff;
  8+: fizz and compression, almost never the answer on this plugin.

A set with both clean AND heavy sections? Prefer **CHERUBS**, which covers both sides via the `channel` switch
and guitar volume. Choose ROSES when clean is the protagonist and "heavy" can be achieved by engaging boost.

### Volume: `output` always, `level` only on PINK

`output` (Level) is the output trim for all three amps — **balance volume between scenes through it**,
without touching tone. `level` (Master) exists only on PINK and changes character along with volume:
4–6 is where it opens without hardening. On the other two amps this field is ignored.

### `blend`, ROSES exclusive

The most distinctive control on the plugin — it has NOT been probed yet, so we don't know what each extreme does. Leave at 5 and dial tone through other controls; if the guitarist explicitly asks to experiment, move in steps of 1 and ask for feedback.

### The three pre pedals

- `boostOn` is the most useful pedal here. Classic use: `boostGain` 1–3 with `boostLevel` 7–9 pushes the amp and tightens bass without dirt — this is how you make a solo scene, not by raising the amp gain. Low `boostBass` (2–4) cleans bass before the preamp and gives the dry djent attack.
- `compOn` is nearly mandatory on ROSES: the repertoire lives on even arpeggios and tapping, and the compressor evens it out. `compAmount` 3–5 is musical; `compAttack` **false (Slow)** for percussive clean, because it lets pick attack through before compressing. On PINK at high gain the amp compresses itself: compressor off.
- `odOn` as real saturation (drive 4–6) or as a second boost stacked on the first. Stacking boost + od with low drive on both gives lead sustain without turning the sound into a wall.

### Post effects: chorus, delay, and reverb are half the tone

This is the only one of the three plugins where effects aren't just seasoning — Polyphia's sound is clean **with space**. Still, the criterion remains the recording: if it's dry, leave it dry.

- `chorusMix` 2–3 thickens clean without announcing itself; 4+ becomes a period effect.
- Delay is where this plugin separates from the others: `dlyMix` 2–4 on clean scenes is normal here, not excessive. `dlyFeedback` 2–4 for repeats that fade before the next bar.
- `rvbMix` 2–4 on clean, 1–2 on heavy. `rvbShimmer` adds an octave above the tail: 1–3 gives ethereal sheen on ambient tracks, above 4 becomes synthetic and fights the melody. Leave at 0 on any heavy or rhythmic scene.

### Multivoicer — the plugin's signature

The polyphonic harmonizer is what makes one guitar sound like the wall-of-voices from Polyphia's tracks. **It is controllable from here**, and enabling it is your call whenever the request calls for harmony (thirds, fifths, octaves) or that stacked-guitar texture — don't wait for the guitarist to name it.

There are **four independent voices**. You control: `multivoicerOn`, which voices play (`multivoicerVoice1On` through `multivoicerVoice4On`), each voice level, stereo spread (`multivoicerWidth`), and block volume (`multivoicerOutput`).

You do NOT control: **interval** of each voice, and the scale (Root/Mode) used when `multivoicerQuantize` is engaged. Those selectors haven't been calibrated yet, so interval defaults to the loaded preset.

### How many voices to use

- **One voice** is classic guitar harmony — a third or fifth above running with the melody. Safest use, sounds most like music rather than an effect.
- **Two voices** thicken without becoming a chord: typically third above + octave below, gives body without taking focus from the main line.
- **Three or four voices** stop being harmony and become **chords played by a single note** — the keyboard/orchestral texture of Polyphia's more ambient tracks. Use when the request says "giant", "orchestral", or "multiple guitars", and **never under a fast solo**: each note becomes a chord and the result muddies.

### Mixing rules

- Levels descend voice by voice: voice 1 between 3–6, each subsequent one lower than the previous (something like 5 / 4 / 3 / 2). Harmony at the same level as dry signal steals the melody, and four parallel voices become a mass with no center.
- With 3 or 4 voices, widen `multivoicerWidth` (6–8): spread voices let melody breathe in center. With 1 voice, 3–5 suffices.
- `multivoicerOutput` balances the entire block at once — it's through this you fix "harmony too loud," not by lowering all four voices individually.

### Interval, still manual

- Keep `multivoicerQuantize` **false**. This keeps intervals chromatic across any key — with it on, the preset's scale likely isn't the song's key and harmony comes out wrong.
- When enabling Multivoicer, state in the scene's `explicacao` **what interval you want on each enabled voice** ("voice 1 a third above, voice 2 an octave below") and note that only this field needs manual verification on the plugin. The rest applies automatically.
- Never propose unison interval: unison harmonizer does nothing.

### What you can't control

- **Graphic EQ**: bands aren't mapped — only the toggle. Keep `eqOn` false and shape tone through the amp tonestack and boost alone.
- **Multivoicer**: almost everything is yours — see dedicated section above. Only **each voice's interval** (and Root/Mode scale) is not adjustable here.
- **Cabinet**: microphone placement out of scope, as with the other plugins.

### Recipes by territory

- **Polyphia clean**: ROSES gain 3, mid 5.5, presence 5, comp (amount 4, attack Slow), chorus mix 2.5, delay mix 3, reverb mix 3 with shimmer 2.
- **Singing lead**: PINK gain 5, mid 6, presence 6, master 5, boost (gain 2, level 8, bass 3), delay mix 2.5, reverb mix 2.
- **Articulated riff**: CHERUBS gain 4.5 with channel on, mid 6, boost (gain 1.5, level 7.5, bass 2.5) to tighten bass, gate 4, reverb mix 1.5.
- **Modern heavy**: PINK gain 6.5, bass 5.5, mid 5, treble 6.5, gate 5.5, boost with low bass, no shimmer.
