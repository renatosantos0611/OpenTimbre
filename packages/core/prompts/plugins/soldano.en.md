Simulation of the Soldano SLO-100, the 100W amp that defined "liquid" high-gain —
singing sustain with articulation — and influenced everything after it (the 5150
was born from it). Eric Clapton used the clean; Steve Vai, George Lynch, and Mark
Tremonti built careers on Overdrive. Territory: classic rock, hard rock, and liquid solos. For modern metal and djent, Gojira serves better.

### One amp, two channels — calibration

The channel (`amp`) stays for the **whole song**, but Normal's `mode` changes per scene — making NORMAL surprisingly versatile.

- **NORMAL in Clean** (`mode` false) — gain 2–4: bright clean with headroom;
  5+: thickens and begins to break up. `bright` restores sparkle at low gain; at high gain it becomes harsh.
- **NORMAL in Crunch** (`mode` true) — gain 3–5: warm Marshall-style crunch pushed forward; 6+: hard rock with body. This is the mode for classic rock riffs.
- **OVERDRIVE** — gain 3–4: hard rock with attack; 4.5–6: the classic SLO lead, liquid sustain that sings (this is where the amp is legendary); 6.5–8: 80s/90s metal; 9+: just compression and fizz, almost never the answer.

A set with both clean AND heavy sections? Prefer **NORMAL** — clean scenes in Clean mode, heavy scenes in Crunch stacked with an overdrive pedal. Choose OVERDRIVE when the weight dominates and the "clean" can just be the guitar volume rolled back (note this in the scene's `guitarra` field).

### Master is the only volume per scene

Unlike other plugins, there is **no separate output trim**: `level` (Master) is both character and volume. Starting point 4–6 — the SLO opens with the master pushed. Balance volume between scenes with `level`, knowing that moving it also moves the tone; prefer correcting large volume differences through `gain` and pedal levels instead.

`bass`/`mid`/`treble`/`presence`/`depth` apply to both channels but are re-sent per scene — each scene can have its own tonestack. `depth` above 6 with high gain blurs the bass; `presence` 5–6.5 is where the lead cuts without being harsh.

### The four pre pedals

- `compOn`: raises sustain and evens dynamics — elastic clean, even arpeggios, funk. `compAmount` 3–5 is musical; 7+ becomes an effect. Fast attack (true) flattens attack — leave slow for percussive cleans. In high-gain the amp compresses itself: compressor off.
- `od1On`/`od2On`: two independent overdrives. Solo boost or tightening: drive 1–2, level 7–9. `od2Peak` adds upper-mid — enable it on solo boosts to cut the mix. Stacking both (od1 as boost into od2) gives 80s lead sustain without raising the amp gain.
- `chorusOn`: `chorusMix` 2–3 thickens without announcing itself; 5+ is a period effect. `chorusRate` is naturally slow (0.10–2.5 Hz) — 3–5 modulates visibly.

### Cabinet: two mics and a dedicated room

`micL`/`micR` are positionable microphones: position 2–3 = cone center (aggressive), 6–8 = edge (round); close distance = attack and bass, far = air. Enable `micROn` with different character than left and spread pan (3 and 7) when the recording needs wide guitar; a single centered mic suffices for most tones.

Room (`micLRoomOn`/`micLRoomSend`, same for R) is a short ambient space **before** the pedal reverb — send 2–4 gives the "80s album room air" without tail length. Prefer it over reverb when what's missing is space, not tail.

### EQ, gate, and utilities

- 9-band EQ (65 Hz–16 kHz, 5 = flat) + `eqHpf`/`eqLpf`: surgical correction, ±1 to ±1.5 movements. `eqHpf` 2–3 clears sub-bass at high gain; `eqLpf` 7–8 removes fizz without killing shimmer. If enabled, send all nine bands.
- `gateOn` + `gateThreshold`: 4–6 on Overdrive at high gain; off on clean.
- `transpose`: **5 = no transpose — leave at 5** unless the song uses another tuning and the guitarist won't restop (0 = -12st, 10 = +12st).
- `doublerOn`: simulates stereo doubling — useful for wide riffs without a second guitar; disable on solos (doubling spreads the attack).

### Post effects: delay and reverb

`dlySyncMode` FREE uses `dlyTime` in ms (16–1500); DAW locks to host tempo — prefer FREE with BPM-calculated time when there's rhythmic delay. Low `dlyTone` hides repeats. Reverb: `rvbMix` 1–3 for rock, low `rvbTone` darkens the tail.

### Recipes by territory

- **Liquid lead (Vai, Lynch)**: OVERDRIVE gain 5–5.5, mid 5.5–6.5, presence 6, od2 boost (drive 1.5, level 8, Peak on), rhythmic delay mix 2.5, mic at edge (position 6).
- **Hard rock riff**: OVERDRIVE gain 3.5–4.5 or NORMAL Crunch gain 6, mid 6, depth 4.5, room send 3 instead of reverb.
- **Classic rock**: NORMAL Crunch gain 4–5, bright as pickup dictates, treble 6, no boost.
- **Bright clean**: NORMAL Clean gain 3, bright on, comp 3–4 with slow attack, chorus mix 2, reverb mix 2.5.
