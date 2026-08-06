Simulação do Soldano SLO-100, o amp de 100W que definiu o high-gain "líquido"
— sustain cantado com articulação — e influenciou tudo que veio depois (o 5150
nasceu dele). Eric Clapton usou o limpo; Steve Vai, George Lynch e Mark
Tremonti fizeram carreira no Overdrive. Território: rock clássico, hard rock e
solos líquidos. Para metal moderno e djent, o Gojira serve melhor.

### Um amp, dois canais — calibração

O canal (`amp`) vale para a **música inteira**, mas o `mode` do Normal muda
por cena — o que torna o NORMAL surpreendentemente versátil.

- **NORMAL em Clean** (`mode` false) — gain 2–4: limpo com brilho e headroom;
  5+: engorda e começa a quebrar. `bright` devolve o sparkle em gain baixo;
  em gain alto deixa áspero.
- **NORMAL em Crunch** (`mode` true) — gain 3–5: crunch quente estilo Marshall
  empurrado; 6+: hard rock com corpo. É o modo para riff de rock clássico.
- **OVERDRIVE** — gain 3–4: hard rock com ataque; 4.5–6: o lead clássico do
  SLO, sustain líquido que canta (é aqui que o amp é lendário); 6.5–8: metal
  80s/90s; 9+: só compressão e fizz, quase nunca a resposta.

Música com limpo E pesado no mesmo set: prefira **NORMAL** — cena limpa em
Clean, cena pesada em Crunch com overdrive empilhado. Escolha OVERDRIVE quando
o peso domina e o "limpo" pode ser só o volume da guitarra abaixado (anote
isso no campo `guitarra` da cena).

### Master é o único volume por cena

Diferente de outros plugins, aqui **não há trim de saída separado**: `level`
(Master) é ao mesmo tempo caráter e volume. Ponto de partida 4–6 — o SLO abre
com o master empurrado. Equilibre o volume entre cenas por ele, sabendo que
mexer muito também mexe no timbre; prefira corrigir diferenças grandes de
volume pelo `gain` e pelos levels dos pedais.

`bass`/`mid`/`treble`/`presence`/`depth` valem para os dois canais, mas são
reenviados por cena — cada cena pode ter o seu tonestack. `depth` acima de 6
com gain alto borra o grave; `presence` 5–6.5 é onde o lead corta sem ficar
áspero.

### Os quatro pedais de pré

- `compOn`: sobe o sustain e nivela a dinâmica — clean elástico, arpejos
  parelhos, funk. `compAmount` 3–5 é musical; 7+ é efeito. `compAttack` rápido
  (true) esmaga o ataque — para limpos percussivos deixe lento. Em high-gain o
  amp já comprime: compressor desligado.
- `od1On`/`od2On`: dois overdrives independentes. Boost de solo ou tightening:
  drive 1–2, level 7–9. `od2Peak` acrescenta médio-agudo — ligue no boost de
  solo para cortar a mix. Empilhar os dois (od1 como boost dentro do od2) dá
  sustain de lead anos 80 sem subir o gain do amp.
- `chorusOn`: `chorusMix` 2–3 engrossa sem denunciar; 5+ é efeito de época.
  `chorusRate` é lento por natureza (0.10–2.5 Hz) — 3–5 já modula visivelmente.

### Cabinete: dois mics e uma room própria

`micL`/`micR` são dois microfones posicionáveis: position 2–3 = centro do cone
(agressivo), 6–8 = borda (redondo); distance baixo = ataque e grave, alto = ar.
Ligue `micROn` com caráter diferente do esquerdo e espalhe o pan (3 e 7) quando
a gravação tem guitarra larga; um mic central basta para a maioria.

A room (`micLRoomOn`/`micLRoomSend`, idem R) é um ambiente curto **antes** do
reverb de pedal — send 2–4 dá o "ar de sala" dos discos dos anos 80 sem cauda.
Prefira ela ao reverb quando o que falta é espaço, não cauda.

### EQ, gate e utilidades

- EQ de 9 bandas (65 Hz–16 kHz, 5 = flat) + `eqHpf`/`eqLpf`: correção pontual,
  movimentos de ±1 a ±1.5. `eqHpf` 2–3 limpa o sub-grave em high-gain; `eqLpf`
  7–8 tira o fizz sem apagar o brilho. Se ligar, mande as nove bandas.
- `gateOn` + `gateThreshold`: 4–6 no Overdrive com gain alto; desligado em
  limpo.
- `transpose`: **5 = sem transposição — deixe em 5** a menos que a música use
  outra afinação e o guitarrista não queira reafinar (0 = -12st, 10 = +12st).
- `doublerOn`: simula dobra estéreo — útil para riff largo sem segunda
  guitarra; desligue em solos (o dobro espalha o ataque).

### Pós: delay e reverb

`dlySyncMode` FREE usa `dlyTime` em ms (16–1500); DAW trava no tempo do host —
prefira FREE com o tempo calculado para o BPM da música quando houver delay
rítmico. `dlyTone` baixo esconde as repetições. Reverb: `rvbMix` 1–3 para rock,
`rvbTone` baixo escurece a cauda.

### Receitas por território

- **Lead líquido (Vai, Lynch)**: OVERDRIVE gain 5–5.5, mid 5.5–6.5, presence 6,
  od2 boost (drive 1.5, level 8, Peak ligado), delay mix 2.5 rítmico, mic na
  borda (position 6).
- **Hard rock riff**: OVERDRIVE gain 3.5–4.5 ou NORMAL Crunch gain 6, mid 6,
  depth 4.5, room send 3 em vez de reverb.
- **Rock clássico**: NORMAL Crunch gain 4–5, bright conforme o captador,
  treble 6, sem boost.
- **Limpo com brilho**: NORMAL Clean gain 3, bright ligado, comp 3–4 com
  attack lento, chorus mix 2, reverb mix 2.5.
