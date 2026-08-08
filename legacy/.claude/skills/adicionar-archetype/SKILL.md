---
name: adicionar-archetype
description: Receita completa para acrescentar um plugin da Neural DSP (Archetype, Soldano, Morgan) ao catálogo — descobrir o mapa de CC na janela MIDI Mappings, escrever o XML, preencher o PluginSpec, registrar no catálogo e escrever o doc do system prompt. Use quando o pedido for adicionar, mapear ou configurar um plugin novo, ou quando um plugin existente precisar de CCs a mais.
---

# Adicionar um Archetype ao catálogo

Já foi feito três vezes (Gojira, Soldano SLO-100 X, Tim Henson X). O código
está preparado: **o trabalho é preencher um descritor e um markdown**. O que não
sai de graça é o mapa de CC, que só o plugin sabe.

Ordem obrigatória: **primeiro o mapa, depois o código.** Escrever o
`PluginSpec` antes de conhecer os CCs produz um arquivo bonito que não emite som.

---

## 1. Levantar o mapa de CC

Abra o plugin em modo standalone → **MIDI Mappings** (barra de utilidades) e leia
o dropdown **"Parameter/Preset"**. Ele lista todos os parâmetros automatizáveis
pelo nome de **exibição**.

**Há um teto de ~100 mapeamentos.** Plugins grandes expõem bem mais que isso (o
Tim Henson X tem ~190), então o mapa é uma curadoria. O que já se decidiu nas
três rodadas anteriores, e vale repetir:

| Entra | Fica de fora |
|---|---|
| seletor de amp e os knobs de cada amp | EQ gráfico banda a banda (só o toggle, para desligar o EQ do preset) |
| gate, boost, compressor, overdrive | cabinete inteiro (microfonação é fora de escopo) |
| delay e reverb: Active/Mix/Time/Feedback/Decay | delay fino (Sync, Mode, Note, Tempo, cortes) |
| bypasses de seção (vão em `sempreLigado`) | Input/Output Gain, metrônomo, navegação de preset |

Regra de corte que custou caro para aprender: **recorte por parâmetro, nunca por
bloco.** Numa primeira versão o Multivoicer inteiro do Tim Henson ficou fora do
schema porque três seletores não estavam calibrados — mas os outros oito CCs
eram toggles e knobs contínuos, que não dependiam de calibração nenhuma. O
resultado foi o modelo respondendo "esse recurso não é controlável" e sugerindo
ao guitarrista ligar um harmonizador em uníssono. Um seletor incerto não
contamina os knobs ao lado dele.

## 2. Escrever o XML de mapeamento

Vá para `midi-mapping/<id>-neural-ai.xml`. **Existem dois formatos** — copie o de
um plugin da mesma geração:

```xml
<!-- Série X (Soldano, Tim Henson): use este nos plugins novos -->
<routing type="cc_absolute" target="ampType" midiChannel="0" data1="20" data2="0" value="0.0" enabled="1"/>

<!-- Gojira (formato antigo) -->
<routing parameter="ampType" type="cc_value" channel="0" enabled="1" cc="20"/>
```

Canal 1 (`midiChannel="0"`, 0-indexed). `data2` e `value` não importam em
`cc_absolute` — o plugin recalcula. Comentários sobrevivem à instalação.

Os `target=""` são **nomes internos, não os rótulos da GUI**. Escreva por
analogia ao plugin mais parecido, sabendo que a taxa de acerto é mais ou menos
metade. Duas armadilhas já confirmadas:

- Os amps costumam usar nomes por **função**, não pelo tema da GUI: no Gojira
  `clean`/`rhythm`/`lead` são CLN/RUST/HOT; no Tim Henson `acoustic`/`rhythm`/
  `lead` são Roses/Cherubs/Pink.
- **Não confie em analogia para os bypasses de seção.** Gojira e Soldano
  compartilham `pedalsActiveID`/`fxActive`, o que sugeria infraestrutura comum —
  e o Tim Henson desmentiu, usando `preFXActive`/`postFXActive`.

## 3. Confirmar os nomes

Mapeie cada CC à mão na janela do plugin, escolhendo o parâmetro pelo nome no
dropdown, e salve com **"Save as..."**. O export traz o `target=""` real.

Atalho para conferir sem revisar linha por linha: **o plugin descarta em
silêncio o `routing` cujo `target` não existe.** Carregue o XML, exporte de novo
e conte as linhas. Se voltarem menos do que foram, as que sumiram são as que
erraram o nome.

```bash
grep -c "<routing " "$APPDATA/Neural DSP/<Nome do Plugin>/MIDI/<arquivo>.xml"
```

## 4. Escrever o `PluginSpec`

Copie `src/plugins/soldano.ts` (um amp, dois canais) ou `tim-henson.ts` (três
amps independentes), o que estiver mais perto. Os campos que exigem decisão:

- **`ampParams` vs `params`** — o parâmetro vai em `ampParams` se o CC dele
  **muda conforme o amp ativo**; em `params` se é fixo. No Soldano o tonestack é
  compartilhado pelos dois canais, então mora em `params`; no Gojira e no Tim
  Henson cada amp tem o seu, então mora em `ampParams`.
- **`ampCC`** — parâmetro ausente da tabela de um amp significa "esse amp não
  tem esse controle", e nada é enviado. É assim que se modela o CLN sem Master
  ou o Cherubs sem Blend.
- **`ampCore`** — os controles que definem um amp como "mapeado". Um amp que não
  os tem faz a app cair no primeiro que tem, com aviso.
- **`grupos`** — toggle → knobs que ele governa. Serve a duas coisas: o zod passa
  a exigir os knobs quando o toggle está ligado, e os knobs de um efeito
  desligado vão para o valor de repouso (`off`, default 0 — mas 5 nas bandas de
  EQ, que é o flat). Switches de *caráter* (bright, attack, canal) ficam **fora**
  dos grupos: eles não são dependência de "efeito desligado".
- **`sempreLigado`** — bypasses de seção, forçados em 127 antes de cada cena.
  Sem isso uma seção bypassada engoliria a cena inteira em silêncio.
- **`required`** — só marque `true` o que a cena não pode deixar de trazer. Um
  campo obrigatório ausente vira erro de validação, nunca default silencioso.
  Quando um controle existe em só um amp mas você não sabe o que ele faz, marcar
  `required: true` é o mais seguro: garante que a cena sobrescreva o valor do
  preset em vez de herdá-lo.
- **Seletores discretos não calibrados ficam fora do schema.** Mapeie no XML
  (ficam alcançáveis pelo `set` do probe) e deixe de fora do `PluginSpec` até
  saber qual valor MIDI cai em qual posição.
- **`app`** — confira no disco, não chute:
  ```bash
  ls "$ProgramFiles/Neural DSP"; ls "$APPDATA/Neural DSP/<Nome>/"
  ```
  A subpasta de mapeamento **não é universal**: Gojira usa `MIDI Mappings`, a
  série X usa `MIDI`.

## 5. Registrar no catálogo

Uma linha em `src/plugins/index.ts` — o import e o item do array. É só isso: a
tool da IA, o schema zod, a seção do system prompt, a barra do plugin na janela
e o botão **Abrir** aparecem sozinhos.

## 6. Escrever `prompts/plugins/<id>.md`

Conhecimento de **tom**, não de estrutura. Não repita amps, controles nem faixas:
isso é gerado do `PluginSpec` e injetado automaticamente. O que só o markdown
tem:

- em que território o plugin ganha dos outros do catálogo, e em qual perde;
- faixas de ganho por amp, com o que acontece em cada uma ("gain 3–5: crunch que
  ainda deixa ouvir as notas do acorde");
- o que fazer com controles ainda não sondados;
- 3 a 5 receitas por território.

O campo `quando` do `PluginSpec` é o que a IA lê para **escolher** entre os
plugins — escreva-o comparando, não elogiando.

## 7. Verificar

```bash
npm run check
```

A suíte percorre o `CATALOGO`, então o plugin novo já entra sendo verificado:
CC duplicado, CC fora de 0–127, **CC que o spec manda mas o XML não mapeia**,
grupo apontando para parâmetro inexistente, amp sem descrição, doc ausente,
nome de tool que as APIs recusariam. Nenhum teste novo precisa ser escrito.

Depois, com o plugin aberto e o `VoiceRig` no loopMIDI:

```bash
PLUGIN=<id> npm run probe
```

`amptest` diz se o seletor de amp é `continuous`, precisa de `increment` ou fica
`manual` (o default). `sweep <cc>` mostra se um parâmetro responde contínuo e,
nos seletores, em que valor cada posição entra.

Registre o resultado em `capabilities.md` — é o diário de bordo do que é e do
que não é controlável, e é lá que se procura antes de repetir uma sondagem.

---

## Hipótese útil para calibrar seletor

Os plugins da Neural são JUCE, e `AudioParameterChoice` mapeia por extremos:
`índice = round(cc/127 × (N−1))`, logo `valor_i = round(i × 127 / (N−1))`. Bate
com o seletor de 3 posições do Gojira (0/64/127) e o de 2 do Soldano (0/127).
Para 12 posições daria 0, 12, 23, 35, 46, 58, 69, 81, 92, 104, 115, 127.
Confirme com `sweep` antes de escrever no spec.
