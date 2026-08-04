Simulação dos amps e pedais que o Joe Duplantier usa. Cobre metal moderno e
djent, mas a faixa é bem mais larga do que o nome sugere.

### Calibração de ganho por amplificador

O amp é **único para a música inteira** — não muda entre cenas. Escolha pelo
território dominante e cubra as outras seções com gain, pedais e volume da
guitarra.

- **CLN** (Fender Twin Reverb) — gain 1–4: limpo cristalino com headroom;
  5–7: começa a esquentar, quebra leve ao atacar forte (blues, soul); 8+:
  breakup declarado, cru e vintage. É a escolha para qualquer limpo de verdade
  e para tons no limiar da quebra.
- **RUST** (EVH 5150 III canal azul) — a faixa de ganho mais larga do plugin.
  gain 2–3.5: crunch clássico (AC/DC, rock de riff); 4–5.5: hard rock (Guns,
  Van Halen por aproximação); 6–7.5: metal (thrash, groove); 8+: satura e
  afofa o palm mute — quase nunca é a resposta. Na dúvida entre amps, é ele.
- **HOT** (EVH 5150 III canal vermelho) — já nasce comprimido. gain 3–5: metal
  moderno apertado com ataque definido; 6+: parede saturada, só para texturas
  sem definição de nota. Use apenas quando a música realmente é desse mundo.

### Particularidades dos controles

- `level` e `output` são coisas diferentes. `level` é o Master: abrir empurra o
  estágio de potência e **muda o caráter** — é o que faz um amp "abrir". Já
  `output` é só trim de saída, muda o volume sem tocar no timbre. Use `level`
  para o tom (4–6 é um bom ponto de partida) e `output` para equilibrar o
  volume entre as cenas.
- `presence` e `resonance` são opcionais — só use quando o tom pedir algo
  específico. `presence` realça agudo e definição de ataque; suba um pouco
  (5–6.5) em tons que precisam cortar. `resonance` reforça o grave do estágio
  de potência; em ganho alto borra rápido — acima de 6 junto com gain alto é
  quase sempre erro. **O CLN não tem nenhum dos dois, nem `level`** — em
  compensação é o único com o switch `bright`, que devolve o sparkle quando o
  volume está baixo.
- `gate` acompanha o ganho: 4–6 em metal, 6–7 em djent staccato (corte seco
  entre notas é parte do estilo), 0–2 em crunch, desligado em limpo.

### O que o tone stack não resolve

O tone stack tem 3 bandas largas. Quando o problema é mais cirúrgico, use as
ferramentas específicas — mas só quando houver um problema real a resolver.

- **EQ gráfico** (`eqOn` + `eq1`..`eq9`, da mais grave para a mais aguda, 5 =
  flat): correção pontual por amplificador — tirar o barro em `eq1`/`eq2`
  (4–4.5), domar a aspereza do médio-agudo em `eq7` (4–4.5), cortar o fizz em
  `eq9`. Movimentos de ±1 a ±1.5 bastam; ±3 é reconstrução, não correção. Se
  ligar o EQ, mande as nove bandas — deixe em 5 as que não mudam.
- **Microfones do cabinete** mudam o tom mais do que qualquer EQ. `cab1Mic`:
  DYN57 agressivo e médio-agudo (o padrão do rock e metal), DYN421 mais grave
  e encorpado, COND414/COND184 abertos e detalhados (limpos, arpejos), RIB160/
  RIB121 escuros e suaves (solos lisos, jazz). `cab1Position` 2–3 para ataque
  agressivo, 6–8 para redondo; `cab1Distance` baixo para tudo que é riff (mais
  ataque e grave), alto para ar em limpos. Ligue `cab2On` com um mic de caráter
  diferente quando a gravação tiver guitarra grande e larga — equilibre os
  levels e espalhe o pan (3 e 7). Para a maioria dos tons, um mic basta.

### Os pedais

- `odOn` (tipo SD-1): o boost padrão. Solo ou tightening de metal: drive 1–2,
  level 7–9, tone 5–6. Como pedal de drive soando por si (blues rock): drive
  4–6, level 5.
- `drtOn` (tipo ProCo Rat): mais sujo e comprimido que o overdrive. Use quando
  o caráter da gravação é de pedal de distorção, não de amp saturado (indie,
  grunge, fuzz-adjacent). O `drtTone` é um filtro invertido: mais alto = mais
  agudo.
- `wowOn` é um pitch shifter: modo `FATSO` acrescenta uma camada uma oitava
  abaixo (use `wowPosition` e `wowMix`); `BLADE1`/`BLADE2` são divebomb.
  Desligado a menos que a música claramente peça.
- `octOn` (tipo OC-2): `octOct1` uma oitava abaixo, `octOct2` duas, `octDirect`
  o sinal seco — mantenha o direto alto (7+) ou o som fica sintético.
- Delay: `dlyTime` é o BPM das repetições (0 = lento, 10 = rápido) — tente
  casar com o andamento da música. `dlyTone` baixo (3–4) esconde as repetições
  atrás da guitarra; `dlySat` dá caráter analógico. `dlyMix` 2–3 para ambiência
  de solo, 4+ só para delay-como-efeito (U2, post-rock).
- Reverb: `rvbLowCut` 3–5 tira o barro da cauda; `rvbHighCut` baixo escurece e
  esconde. `rvbShimmer` sobrepõe uma cauda uma oitava acima — marcante demais
  para uso casual; só em música etérea de verdade.

### Receitas por território

Pontos de partida comprovados — ajuste a partir deles, não do zero:

- **Djent / metal moderno**: HOT gain 3.5–5 (ou RUST 6.5–7.5) + OD boost
  (drive 1, level 8), gate 5.5–7, mid 4.5–5.5 (não escave), DYN57 position 2.
- **Thrash / metal 80s–90s**: RUST gain 6–7, bass 6, mid 3.5–4.5, treble 6,
  OD boost nos solos, room curto no reverb (mix 1–2).
- **Hard rock**: RUST gain 4–5.5, mid 5.5–6.5, presence 5.5, sem boost na base.
- **Blues / rock clássico**: CLN gain 6–8 (quebra natural) ou RUST 2–3;
  reverb mix 2–3.
- **Limpo moderno**: CLN gain 2–3.5, bright ligado se faltar sparkle, COND414,
  chorus sutil (mix 2), reverb mix 2.5–3.5.
