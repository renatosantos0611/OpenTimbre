/**
 * Monta o prompt, chama a IA via tool use e valida a resposta.
 *
 * Nada de "retorne JSON puro": o schema zod vira o `input_schema` da tool (ou o
 * `parameters` da function) e o objeto chega estruturado, sem cerca de markdown
 * nem preâmbulo para limpar.
 *
 * Qual provedor atende — Anthropic ou OpenAI — é decidido em `provider.ts`
 * testando qual chave é válida. Este módulo só delega.
 */

import fs from 'node:fs'
import path from 'node:path'
import * as guitarra from './guitarra.js'
import { CATALOGO, type Cena, type PluginSpec } from './plugins/index.js'
import { resolveProvider } from './provider.js'
import type { Ajuste } from './providers/types.js'
import type { Rig } from './schema.js'

const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts')
const PROMPT_PATH = path.join(PROMPTS_DIR, 'system-rig.md')

function lerDocDoPlugin(spec: PluginSpec): string {
  const arquivo = path.join(PROMPTS_DIR, 'plugins', spec.doc)
  if (!fs.existsSync(arquivo)) {
    throw new Error(`Doc do plugin '${spec.id}' não encontrada em ${arquivo}`)
  }
  return fs.readFileSync(arquivo, 'utf8')
}

/**
 * Referência gerada do spec — o caráter dos amps e quais controles cada um tem
 * saem do catálogo, não de uma lista repetida no markdown, para não haver duas
 * verdades divergindo. Os controles importam: no Gojira o CLN não tem Master
 * nem Presence/Depth, e é o único com o switch Bright.
 */
function referencia(spec: PluginSpec): string {
  const amps = spec.amps
    .map((a) => {
      const tem = Object.keys(spec.ampParams).filter(
        (k) => spec.ampCC[a]?.[k] !== undefined && !k.startsWith('eq'),
      )
      return `- **${a}** — ${spec.ampDesc[a] ?? ''}\n  - controles: ${tem.join(', ')}`
    })
    .join('\n')

  return [
    `### Referência de ${spec.nome} (gerada do catálogo)`,
    '',
    'Cadeia de sinal:',
    '',
    '```',
    spec.cadeia,
    '```',
    '',
    'Amplificadores (os campos fora da lista de controles do amp escolhido são ignorados):',
    '',
    amps,
    '',
  ].join('\n')
}

/**
 * Lido do disco em runtime — `reload` no REPL relê sem reiniciar a app.
 *
 * O prompt é montado em camadas: a filosofia de tom (que vale para qualquer
 * plugin), depois a doc de cada plugin do catálogo com a referência gerada, e
 * por fim a guitarra do usuário. *Com muitos plugins isso infla o prompt; o
 * corte natural será injetar só a doc dos plugins plausíveis para o pedido.*
 */
export function loadSystemPrompt(): string {
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error(`System prompt não encontrado em ${PROMPT_PATH}`)
  }
  const base = fs.readFileSync(PROMPT_PATH, 'utf8')

  const catalogo = CATALOGO.map(
    (spec) => `## ${spec.nome}\n\nQuando usar: ${spec.quando}\n\n${lerDocDoPlugin(spec)}\n\n${referencia(spec)}`,
  ).join('\n---\n\n')

  const escolha =
    CATALOGO.length > 1
      ? '\n\n# Plugins disponíveis\n\nCada plugin abaixo tem a sua própria tool. **Chamar a tool de um plugin é escolhê-lo** — leia o "Quando usar" de cada um e escolha o que chega mais perto do tom pedido.\n\n'
      : '\n\n# O plugin\n\n'

  // A guitarra é lida do disco a cada chamada, então `reload` no REPL e o
  // salvar da tela de config surtem efeito sem reiniciar nada.
  const instrumento = guitarra.toPrompt(guitarra.load())

  return `${base}${escolha}${catalogo}\n${instrumento}`
}

export async function buildRig(
  plugin: PluginSpec,
  pedido: string,
  systemPrompt: string,
): Promise<Rig> {
  const { chosen } = await resolveProvider()
  return chosen.buildRig(plugin, pedido, systemPrompt)
}

/** Ajusta a cena carregada por instrução livre ("aumente o grave"). */
export async function ajustarCena(
  plugin: PluginSpec,
  cenaAtual: Cena,
  amp: string,
  instrucao: string,
  systemPrompt: string,
): Promise<Ajuste> {
  const { chosen } = await resolveProvider()
  return chosen.ajustarCena(plugin, cenaAtual, amp, instrucao, systemPrompt)
}
