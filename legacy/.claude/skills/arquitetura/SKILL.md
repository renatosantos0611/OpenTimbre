---
name: arquitetura
description: Mapa do neural-ai-control — quais módulos existem, por onde um pedido do guitarrista passa até virar CC no plugin, e quais decisões de projeto não devem ser desfeitas sem motivo. Use antes de mexer em qualquer coisa no src/, ao investigar de onde vem um comportamento, ou quando precisar decidir em que módulo uma funcionalidade nova deve morar.
---

# Como este projeto está montado

POC que recebe um pedido em linguagem natural ("monta uma rig pra tocar Sweet
Child O' Mine"), pede a uma LLM os parâmetros de um plugin da Neural DSP, e
aplica via MIDI CC numa porta virtual do loopMIDI chamada `VoiceRig`.

A fonte de verdade do objetivo é `spec-poc-gojira.md`. Este documento descreve o
**código como ele está**, que já foi além da spec em dois pontos: há três
plugins no catálogo (a spec previa um) e há uma janela desktop além do REPL.

## O caminho de um pedido

```
pedido do usuário (REPL ou janela)
  → scope.ts            barra o que não é música, antes de gastar token
  → provider.ts         elege Anthropic ou OpenAI testando qual chave vale
  → providers/          tool use, validação zod, uma retentativa
  → schema.ts           schemas zod derivados do PluginSpec
  → plugins/cena.ts     cena → lista de mensagens CC   (puro)
  → midi-out.ts         escreve os bytes na porta      (I/O)
```

O ponto de virada é `plugins/cena.ts`: até ali tudo é decisão, dali em diante é
encanamento. Por isso a tradução de cena em CC é testável sem loopMIDI.

## Os módulos, e o que cada um esconde

| Módulo | Esconde |
|---|---|
| `plugins/types.ts` | o contrato `PluginSpec`, as escalas 0–10 ↔ 0–127, as estratégias de troca de amp |
| `plugins/index.ts` | o catálogo; **a única lista de plugins que existe** |
| `plugins/<id>.ts` | tudo que é específico de um plugin: CCs, faixas, amps, agrupamentos |
| `plugins/cena.ts` | a regra de qual CC recebe qual valor (função pura) |
| `plugins/lancador.ts` | achar o `.exe`, saber se está aberto, instalar o mapa MIDI |
| `midi-out.ts` | a API do `@julusian/midi` — **nenhum outro arquivo importa esse pacote** |
| `schema.ts` | como um `PluginSpec` vira zod e JSON Schema |
| `providers/tool-use.ts` | o protocolo: duas tentativas, trace, devolver os `issues` ao modelo |
| `providers/operacoes.ts` | as três operações (rig, ajuste, chat), uma vez só |
| `providers/<id>.ts` | como falar com aquela API e montar o histórico dela |
| `trace.ts` | o que é impresso e logado de cada chamada de IA |

## As decisões que sustentam tudo

Mexer nestas exige um motivo explícito — elas foram pagas com bugs reais.

**Um plugin é dado, não código.** `PluginSpec` é um descritor. Schema zod, envio
MIDI e documentação do system prompt são todos *derivados* dele. Não existe
número de CC escrito em nenhum outro lugar, e nenhum módulo importa um plugin
específico — só o catálogo.

**A IA escolhe o plugin chamando a tool dele.** Há uma tool por item do
catálogo (`aplicar_rig_<id>`). Qual delas o modelo chama **é** a escolha. Não há
etapa de seleção nem chamada extra.

**A resposta da IA vem por tool use e passa pelo zod.** Nunca se parseia JSON de
texto livre. Se o zod reclama, os `issues` voltam ao modelo uma vez; na segunda
falha, aborta com mensagem clara.

**Aplica-se a cena inteira, nunca um delta.** MIDI é via única e a app não
consegue ler o estado do plugin. Reenviar tudo é o que mantém os dois em
sincronia — se o guitarrista mexeu num knob com o mouse, a próxima cena corrige.
Corolário: um toggle omitido pela IA resolve para `false` e é enviado como 0,
o que protege contra um preset que já viesse com o efeito ligado.

**Provedor é escolhido por chave válida, não por env var presente.** Uma chave
revogada ou colada pela metade está "presente" e só falharia na hora de gerar a
rig. `provider.ts` bate no endpoint de listagem de modelos, que é gratuito.

**Código específico de provedor mora só em `providers/<id>.ts`.** Schema, system
prompt e lógica de cena são compartilhados e não podem ganhar
`if (provider === ...)`.

**O system prompt é montado em camadas e lido do disco em runtime.**
`prompts/system-rig.md` (filosofia de tom, vale para qualquer plugin) +
`prompts/plugins/<id>.md` (conhecimento do plugin) + uma referência **gerada** do
`PluginSpec`. O que o spec já expressa não se repete no markdown.

## Duas frentes, um núcleo

`npm run dev` sobe o REPL; `npm run desktop` sobe a janela Electron. Os dois
usam o mesmo núcleo. A regra de dependência é de mão única: `desktop/` importa
de `src/`, nunca o contrário — nada específico de UI desce para `src/`.

Uma diferença de contrato que vale saber: a conversa usa `tool_choice: 'auto'`,
porque num chat o modelo precisa poder devolver uma pergunta ou recusar um
pedido fora de escopo. O `buildRig`/`ajustarCena` seguem com a tool forçada.

O addon nativo `@julusian/midi` só existe no processo main do Electron e fica
`external` no bundle — o porquê está em `capabilities.md`.

## Verificação

`npm run check` = `typecheck` + `test`. Os testes usam só `node:test` (nenhuma
dependência) e rodam em menos de um segundo. Boa parte deles percorre o
`CATALOGO`, então um plugin novo herda a suíte inteira sem escrever teste.

Para adicionar um Archetype, use a skill **adicionar-archetype**.
Para as convenções de escrita, veja `padroes.md` na raiz.
