Plugin assinado por Tim Henson (Polyphia), desenhado para o instrumental moderno: dedilhado com unhas ou dedos, tapping a duas mãos, slides e harmônicos, graves apertados e agudos vidrados. Território: Polyphia, Plini, Ichika Nito, math rock, R&B instrumental, pop com guitarra limpa elaborada. Para metal moderno e djent o Gojira serve melhor; para rock clássico e lead líquido, o Soldano.

O que distingue este plugin dos outros dois é a **clareza**: aqui quase tudo soa melhor com menos ganho do que o instinto pede, porque o repertório depende de ouvir cada nota de um arpejo ou de um tapping. Ganho alto neste plugin é exceção, não ponto de partida.

### Os três amps — calibração

O amp vale para a música inteira, então escolha pelo trecho mais exigente.

- **ROSES** — o limpo. gain 2–4: cristalino, com sustain suficiente para arpejo e tapping limpo; 5–6: engorda e começa a quebrar nas notas fortes. É o amp de metade do repertório do Polyphia. Cena limpa quase sempre aqui.
- **CHERUBS** — o crunch articulado. gain 3–5: crunch que ainda deixa ouvir as notas de um acorde aberto; 6–7: rock com corpo. É o meio-termo para riff que precisa de peso sem perder definição. O `channel` acrescenta ganho e corpo quando ligado — teste os dois antes de subir o gain.
- **PINK** — o alto ganho. gain 4–5.5: lead comprimido e cantado, que é o uso principal; 6–7.5: riff pesado moderno; 8+: fizz e compressão, quase nunca a resposta neste plugin.

Música com limpo e pesado no mesmo set: prefira **CHERUBS**, que cobre os dois lados com o `channel` e o volume da guitarra. Escolha ROSES quando o limpo é o protagonista e o "pesado" pode ser o boost ligado.

### Volume: `output` sempre, `level` só no PINK

`output` (Level) é o trim de saída dos três amps — **é por ele que se equilibra o volume entre cenas**, sem mexer no timbre. O `level` (Master) existe só no PINK e muda o caráter junto com o volume: 4–6 é onde ele abre sem endurecer. Nos outros dois amps o campo é ignorado.

### `blend`, exclusivo do ROSES

É o controle mais característico do plugin e ainda **não foi sondado na Fase 0** — não se sabe o que cada extremo faz. Deixe em 5 e chegue no timbre pelos outros controles; se o guitarrista pedir explicitamente para experimentar, mova em passos de 1 e peça o retorno dele.

### Os três pedais de pré

- `boostOn` é o pedal mais útil aqui. Uso clássico: `boostGain` 1–3 com `boostLevel` 7–9 empurra o amp e aperta o grave sem sujar — é assim que se faz uma cena de solo, não subindo o gain do amp. `boostBass` baixo (2–4) limpa o grave antes do preamp e é o que dá o ataque seco do djent limpo.
- `compOn` é quase obrigatório no ROSES: o repertório vive de arpejo parelho e tapping, e o compressor é o que nivela isso. `compAmount` 3–5 é musical; `compAttack` **false (Slow)** para limpo percussivo, porque deixa a palhetada passar antes de comprimir. Em PINK com ganho alto o amp já comprime — compressor desligado.
- `odOn` como saturação de verdade (drive 4–6) ou como segundo boost empilhado no primeiro. Empilhar boost + od com drive baixo nos dois dá sustain de lead sem transformar o som em parede.

### Pós: chorus, delay e reverb são metade do timbre

Este é o único dos três plugins em que os efeitos não são só tempero — o som do Polyphia é limpo **com espaço**. Mesmo assim, o critério continua sendo a gravação: se ela é seca, deixe seco.

- `chorusMix` 2–3 engrossa o limpo sem denunciar; 4+ vira efeito de época.
- Delay é onde este plugin se separa dos outros: `dlyMix` 2–4 em cenas limpas é normal aqui, não exagero. `dlyFeedback` 2–4 para repetições que somem antes do próximo compasso.
- `rvbMix` 2–4 nos limpos, 1–2 nos pesados. O `rvbShimmer` acrescenta uma oitava acima na cauda: 1–3 dá o brilho etéreo das faixas ambientais, acima de 4 fica sintético e briga com a melodia. Deixe em 0 em qualquer cena pesada ou rítmica.

### Multivoicer — a assinatura do plugin

O harmonizador polifônico é o que faz uma guitarra soar como a parede de vozes das faixas do Polyphia. **Ele é controlável por aqui**, e ligá-lo é decisão sua sempre que o pedido pedir harmonia (terças, quintas, oitavas) ou aquela textura de várias guitarras empilhadas — não espere o guitarrista pedir por nome.

São **quatro vozes independentes**. O que você controla: `multivoicerOn`, quais vozes tocam (`multivoicerVoice1On` a `multivoicerVoice4On`), o nível de cada uma, a abertura estéreo (`multivoicerWidth`) e o volume do bloco (`multivoicerOutput`).

O que **não** está no seu alcance: o **intervalo** de cada voz, e a escala (Root/Mode) usada quando `multivoicerQuantize` está ligado. Esses seletores ainda não foram calibrados, então o intervalo sai do preset carregado.

### Quantas vozes usar

- **Uma voz** é harmonia de guitarra clássica — uma terça ou uma quinta acima correndo junto com a melodia. É o uso mais seguro e o que mais soa como música, não como efeito.
- **Duas vozes** engrossam sem virar acorde: típico terça acima + oitava abaixo, que dá corpo sem tirar o foco da linha principal.
- **Três ou quatro vozes** deixam de ser harmonia e viram **acorde tocado por uma nota só** — é a textura de teclado/orquestra das faixas mais ambientais do Polyphia. Use quando o pedido fala em algo "gigante", "orquestral" ou "várias guitarras", e **nunca** debaixo de um solo rápido: cada nota vira um acorde e o resultado embola.

### Regras de mistura

- Os níveis descem voz a voz: voz 1 entre 3 e 6, e cada seguinte abaixo da anterior (algo como 5 / 4 / 3 / 2). Harmonia no mesmo nível do sinal seco rouba a melodia, e quatro vozes parelhas viram uma massa sem centro.
- Com 3 ou 4 vozes, abra mais o `multivoicerWidth` (6–8): as vozes espalhadas deixam a melodia respirar no centro. Com 1 voz, 3–5 é o bastante.
- `multivoicerOutput` dosa o bloco inteiro de uma vez — é por ele que se corrige "a harmonia está alta demais", não baixando as quatro vozes uma a uma.

### O intervalo, que continua manual

- Deixe `multivoicerQuantize` **false**. Assim o intervalo é cromático e vale em qualquer tonalidade — com ele ligado, a escala do preset provavelmente não é a da música e a harmonia sai errada.
- Quando ligar o Multivoicer, diga na `explicacao` da cena **qual intervalo você quer em cada voz ligada** ("voz 1 uma terça acima, voz 2 uma oitava abaixo") e avise que só esse campo precisa ser conferido à mão no plugin. O resto a app aplica sozinha.
- Nunca proponha intervalo de uníssono: harmonizador em uníssono não faz nada.

### O que não dá para controlar

- **EQ gráfico**: as bandas não estão mapeadas — só o toggle. Mantenha `eqOn` false e faça toda a modelagem pelo tonestack do amp e pelo boost.
- **Multivoicer**: quase tudo é seu — ver a seção própria acima. Só o **intervalo de cada voz** (e a escala de Root/Mode) não é ajustável por aqui.
- **Cabinete**: microfonação fora de escopo, como nos outros plugins.

### Receitas por território

- **Limpo do Polyphia**: ROSES gain 3, mid 5.5, presence 5, comp (amount 4, attack Slow), chorus mix 2.5, delay mix 3, reverb mix 3 com shimmer 2.
- **Lead cantado**: PINK gain 5, mid 6, presence 6, master 5, boost (gain 2, level 8, bass 3), delay mix 2.5, reverb mix 2.
- **Riff articulado**: CHERUBS gain 4.5 com `channel` ligado, mid 6, boost (gain 1.5, level 7.5, bass 2.5) para apertar o grave, gate 4, reverb mix 1.5.
- **Pesado moderno**: PINK gain 6.5, bass 5.5, mid 5, treble 6.5, gate 5.5, boost com bass baixo, sem shimmer.
