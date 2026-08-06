Plugin assinado por John Petrucci (Dream Theater), desenhado em cima do rig dele: alto ganho apertado para riff em compasso quebrado, lead de legato longo e cantado, limpos grandes com chorus e delay, e o captador **piezo** do Music Man Majesty. Território: Dream Theater, Liquid Tension Experiment, Symphony X, Rush, prog metal em geral, e qualquer coisa que peça peso **com melodia**.

Onde ele ganha e onde perde, contra os outros do catálogo:

- Contra o **Gojira**: escolha o Petrucci quando o pedido pede peso articulado com solo melódico por cima. O Gojira ganha em djent, thrash e peso puro.
- Contra o **Soldano**: os dois cobrem hard rock e prog, mas o Soldano é o SLO-100 dos discos de 1992 — mais quente e mais vintage. O Petrucci é o som moderno, mais apertado no grave e mais controlado no agudo.
- Contra o **Tim Henson**: o Henson ganha no limpo elaborado de dedilhado e tapping. O Petrucci ganha em tudo que precise de peso.
- **Nada no catálogo tem o PIEZO.** Se a música alterna elétrica e violão, ou se o pedido cita violão, viola, 12 cordas ou "acústico", este plugin é a única resposta possível — ver a seção própria abaixo.

### Os quatro amps — calibração

O amp vale para a música inteira, então escolha pelo trecho mais exigente. A única exceção é o PIEZO, que só faz sentido quando o violão é o protagonista.

- **PIEZO** — não é um amplificador, é o preamp do captador piezo. Não tem gain nem master; o timbre inteiro sai de `body`, `air` e do tonestack. Não distorce em hipótese nenhuma.
- **CLEAN** — o limpo. gain 2–4: cristalino, com o headroom que aguenta acorde cheio sem quebrar; 5–6.5: começa a engrossar e a saturar nas notas fortes, que é o limpo "quente" de balada. `bright` ligado é o padrão — desligue só se o pedido pedir um limpo escuro ou abafado.
- **RHYTHM** — o canal de riff. gain 4–5.5: crunch encorpado com o acorde ainda audível nota a nota; 6–7.5: o peso padrão do prog metal, que é onde ele mais vive; 8+: já perde definição, e neste amp definição é o ponto.
- **LEAD** — o canal de solo. gain 5–6.5: sustain e compressão de legato sem fizz, o uso principal; 7–8: solo que precisa cantar por cima de banda densa; 9+: quase nunca a resposta.

Música pesada com solo: **RHYTHM** para a música inteira e a cena de solo feita com boost + `soar`, não trocando de amp — o amp é um só para todas as cenas. Escolha LEAD quando o solo é o protagonista e o riff é secundário.

### Os controles que só um amp tem

Estes são o caráter do plugin. Todos são obrigatórios ou resolvem sozinhos, mas o valor **importa**:

- **`tight` (RHYTHM)** é o controle mais útil do plugin inteiro. Corta grave **antes** do preamp, então aperta o palm mute sem afinar o som depois. 5–7 em riff pesado, 7–8.5 em riff rápido de corda grave, 3–4 quando o riff é aberto e precisa de corpo. Suba o `tight` antes de baixar o `bass`.
- **`bite` (RHYTHM)** realça o ataque: ligue em riff rápido, onde a palhetada precisa aparecer. Desligue em riff lento e sustentado, que fica agressivo demais.
- **`midBoost` (RHYTHM)** joga os médios para a frente. Ligue quando o riff precisa cortar; desligue quando a mix já tem teclado ocupando essa faixa — que é a situação normal em prog.
- **`soar` (LEAD)** é o que faz o legato flutuar por cima da banda. Ligue em quase todo solo; é ele, e não o gain, que dá o "líquido" do Petrucci.
- **`bright` (CLEAN)** ligado por padrão, como acima.
- **`body` e `air` (PIEZO)** — ver a seção do piezo.

### Volume: `output` para equilibrar, `level` para o caráter

`output` (rótulo **Output** na tela) é o trim de saída, e é por ele que se equilibra o volume entre cenas — solo mais alto que a base se faz aqui, nunca subindo o gain. `level` (rótulo **Master**) é o estágio de potência: 4–6 é onde ele abre sem endurecer. O PIEZO não tem `level`; o campo é ignorado nele.

Há ainda o `volumeGain`, que é a seção Volume — o volume da guitarra emulado. **Mantenha em 10.** Ele existe para o pedido raro de "som de volume abaixado" (aquele limpo meio comprimido que se faz fechando o volume da guitarra com o amp distorcido): aí, RHYTHM com gain alto e `volumeGain` 4–5.

### O PIEZO — o que nenhum outro plugin do catálogo faz

Use quando a música tem violão de verdade, ou quando o pedido cita acústico. Não use como "limpo mais limpo": ele não é um amp, e num contexto de banda elétrica soa fino e deslocado.

- `body` é o corpo da caixa simulada. 6–7 é o padrão; abaixo de 4 fica fino e quebradiço, acima de 8 fica abafado e sem definição de palheta.
- `air` ligado é o brilho de corda de aço — o violão dedilhado quase sempre quer; violão de acompanhamento em levada cheia costuma ficar melhor sem.
- Tonestack conservador: bass 4–5, mid 6–7, treble 6–7. Piezo já é naturalmente duro no médio-agudo, e exagerar no treble entrega o som de captador.
- Compressor 3–5 ajuda muito no dedilhado, pelo mesmo motivo que ajuda em violão de verdade.
- Reverb 3–5 com `rvbPreDelay` 3–4 é o que dá a sala. Delay geralmente atrapalha.
- Todo o resto — overdrive, flanger, boost de qualquer tipo — desligado.

Numa música que **alterna** violão e elétrica, o amp da rig é um só. Escolha o amp elétrico que a música mais precisa, e diga na `explicacao` da cena de violão que o guitarrista precisa trocar o Amp Type para PIEZO à mão nesse trecho.

### Cadeia de pré

- **`odOn` é o pedal de solo.** Uso clássico: `odDrive` 1–3 com `odLevel` 7–9 empurra o amp e aperta o grave sem sujar — é assim que se faz uma cena de solo, não subindo o gain. Com drive 4–6 vira saturação de verdade, para riff que precisa de mais do que o amp dá.
- **`compOn`** (não tem Attack aqui) 3–5 é musical em limpo e no piezo. Em RHYTHM ou LEAD com ganho alto o amp já comprime — deixe desligado.
- **`wahOn`** só se o pedido citar wah. Sem pedal de expressão o `wahPosition` vira um filtro fixo: 6–8 é o "cocked wah" de solo, que é um som legítimo e bem do território.
- **`phaserOn` e `flangerOn`** são de época e de trecho específico. Phaser rate 2–3 em limpo de balada; flanger só quando a gravação claramente tem — com `flangerFeedback` abaixo de 6, ou vira jato de avião.
- **`chorusOn` (pré) contra `chorus2On` (pós)**: o de pós é o que se quer em quase todo caso, porque modula o som já amplificado e é o que soa como os limpos gigantes dos discos. O de pré é para o efeito mais sujo e datado, com o chorus entrando no amp.

### Pós: delay duplo e reverb

Este é um plugin em que os efeitos de pós fazem parte do timbre, não são tempero — mas o critério continua sendo a gravação: se ela é seca, deixe seca.

- **O delay é duplo**: `dlyTimeL` e `dlyTimeR` são independentes, e é aí que está a graça. Valores diferentes (algo como 4 e 6) espalham as repetições no estéreo e dão a largura característica; valores iguais mantêm tudo no centro, que é o que se quer quando a mix já é densa.
- `dlyMix` 2–3.5 em limpo, 1.5–2.5 em solo, 0–1 em riff pesado. `dlyFeedback` 2–4, para as repetições sumirem antes do próximo compasso.
- `dlyTape` 2–4 escurece a cauda e evita que o delay compita com a nota; `dlyModulation` 1–3 impede que as repetições soem clonadas.
- `rvbMix` 3–5 em limpo e piezo, 2–3 em solo, 1–2 em riff pesado.
  `rvbPreDelay` 3–5 é o truque que mantém o ataque da nota seco mesmo com muito reverb — use sempre que subir o mix.
- `rvbShimmer` só em passagem ambiental. Em cena rítmica ou pesada, desligado.

### O que não dá para controlar

- **EQ paramétrico**: as bandas não estão mapeadas — só o toggle. Mantenha `eqOn` false e faça toda a modelagem pelo tonestack, pelo `tight` e pelo overdrive.
- **Cabinete**: microfonação fora de escopo, como nos outros plugins.
- **Os quatro `*Mode`** (phaser, chorus, chorus 2, delay) ainda não foram sondados — não se sabe o que cada posição faz. Deixe em false e chegue no timbre pelos outros controles.
- **A troca de Amp Type** pode exigir ação manual, dependendo da configuração — a app avisa quando for o caso.

### Receitas por território

- **Riff de prog metal**: RHYTHM gain 6.5, tight 6.5, bite ligado, midBoost desligado, bass 5, mid 5.5, treble 6, presence 6, master 5, gate 5, delay desligado, reverb mix 1.5.
- **Solo cantado**: LEAD gain 6, soar ligado, bass 4, mid 6.5, treble 6, presence 6.5, master 5.5, od (drive 2, level 8, tone 6), delay mix 2.5 com L 4 / R 6, reverb mix 2.5 com pre-delay 4.
- **Limpo grande de balada**: CLEAN gain 3, bright ligado, bass 5, mid 5, treble 6, presence 5.5, master 5, comp 4, chorus2 (mix 3, rate 3, depth 4), delay mix 3 com L 4 / R 5.5, reverb mix 4 com pre-delay 4.
- **Violão**: PIEZO body 6.5, air ligado, bass 4.5, mid 6.5, treble 6.5, presence 5.5, comp 4, reverb mix 4 com pre-delay 3.5, todo o resto desligado.
- **Solo sobre banda densa**: RHYTHM gain 6.5, tight 5.5, midBoost ligado, od (drive 2.5, level 8.5), output 1.5 acima da cena base, delay mix 2, reverb mix 2.
