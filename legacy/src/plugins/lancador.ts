/**
 * Abrir o app do plugin e cuidar do mapeamento MIDI.
 *
 * A app gera timbres, mas eles só viram som se o plugin estiver aberto **e**
 * com o mapeamento carregado. Os dois passos eram manuais e silenciosos: sem
 * eles, a app parecia funcionar e nada acontecia. Aqui ela passa a saber o
 * estado dos dois e a resolver o que dá para resolver.
 */

import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import * as store from '../config-store.js'
import type { PluginSpec } from './types.js'

const exec = promisify(execFile)

const MAPEAMENTOS_DIR = path.resolve(process.cwd(), 'midi-mapping')

/** Caminhos de executável escolhidos à mão, quando a instalação foge do padrão. */
const CaminhosSchema = z.object({ caminhos: z.record(z.string(), z.string()) }).strict()
type Caminhos = z.infer<typeof CaminhosSchema>
const PADRAO: Caminhos = { caminhos: {} }

export type EstadoMapeamento = 'ok' | 'desatualizado' | 'ausente'

export type EstadoApp = {
  /** Achou o executável no disco. */
  instalado: boolean
  caminho: string | null
  rodando: boolean
  mapeamento: EstadoMapeamento
}

// ------------------------------------------------------------------ executável

export function localizar(spec: PluginSpec): string | null {
  const manual = store.read('plugins', CaminhosSchema, PADRAO).caminhos[spec.id]
  if (manual && fs.existsSync(manual)) return manual

  for (const candidato of spec.app.candidatos) {
    if (fs.existsSync(candidato)) return candidato
  }
  return null
}

export function definirCaminho(spec: PluginSpec, caminho: string): void {
  const atual = store.read('plugins', CaminhosSchema, PADRAO)
  store.write('plugins', { caminhos: { ...atual.caminhos, [spec.id]: caminho } })
}

/**
 * Lê a saída do `tasklist` em CSV e diz se o processo está lá.
 *
 * **O formato CSV não é preferência de estilo, é o conserto de um bug.** No
 * formato de tabela (o default) o `tasklist` trunca a coluna Image Name em 25
 * caracteres, sem aviso:
 *
 *     Archetype Tim Henson X.exe  ->  "Archetype Tim Henson X.ex"
 *
 * Como a checagem antiga era `stdout.includes(processo)`, o Tim Henson — o
 * único nome do catálogo com mais de 25 caracteres — aparecia como fechado para
 * sempre, mesmo aberto. O `Archetype Petrucci X.exe` tem 24 e escapou por um
 * caractere, o que mostra o quanto isso era questão de sorte.
 *
 * Em `/FO CSV` o nome vem inteiro e entre aspas. A comparação é exata, e não
 * por `includes`: dois plugins cujo nome fosse prefixo um do outro se
 * confundiriam.
 */
export function processoNaLista(stdout: string, processo: string): boolean {
  const alvo = processo.toLowerCase()
  for (const linha of stdout.split(/\r?\n/)) {
    // Sem match, o tasklist responde "INFO: No tasks are running..." — sem
    // aspas, então não passa por aqui.
    const nome = /^"([^"]*)"/.exec(linha)?.[1]
    if (nome !== undefined && nome.toLowerCase() === alvo) return true
  }
  return false
}

/**
 * O Windows não expõe "esse processo está rodando?" sem dependência nativa,
 * então vai de `tasklist`. É grosseiro, mas custa alguns milissegundos e evita
 * abrir uma segunda instância brigando pelo dispositivo de áudio.
 */
export async function rodando(spec: PluginSpec): Promise<boolean> {
  try {
    const { stdout } = await exec('tasklist', [
      '/FI',
      `IMAGENAME eq ${spec.app.processo}`,
      '/FO',
      'CSV',
      '/NH',
    ])
    return processoNaLista(stdout, spec.app.processo)
  } catch {
    // Sem tasklist (ou fora do Windows) não dá para saber — assumir "fechado"
    // é o erro mais barato: no pior caso o usuário clica em abrir e nada muda.
    return false
  }
}

/**
 * Sobe o plugin **solto** do processo da janela: `detached` + `unref` para que
 * fechar o OpenTimbre não derrube o plugin no meio de um take.
 */
export function abrir(spec: PluginSpec): string {
  const caminho = localizar(spec)
  if (!caminho) {
    throw new Error(
      `Não encontrei o ${spec.nome}. Procurei em:\n${spec.app.candidatos.map((c) => `  ${c}`).join('\n')}`,
    )
  }

  spawn(caminho, {
    detached: true,
    stdio: 'ignore',
    cwd: path.dirname(caminho),
  }).unref()

  return caminho
}

// ------------------------------------------------------------- mapeamento MIDI

function origemMapeamento(spec: PluginSpec): string {
  return path.join(MAPEAMENTOS_DIR, spec.app.mapeamento)
}

function destinoMapeamento(spec: PluginSpec): string {
  const appData = process.env['APPDATA'] ?? ''
  return path.join(appData, spec.app.settings, spec.app.pastaMidi, spec.app.mapeamento)
}

/**
 * Compara o XML do repositório com o instalado, **normalizando quebra de
 * linha**: o repositório guarda LF e o Windows grava CRLF, então byte a byte o
 * mesmo arquivo apareceria como diferente e a janela reclamaria para sempre de
 * um mapeamento que está correto.
 *
 * `desatualizado` importa tanto quanto `ausente`: um mapeamento de uma versão
 * anterior manda os CCs para os parâmetros errados, que é pior do que não
 * mandar nada.
 */
function normalizar(arquivo: string): string {
  return fs.readFileSync(arquivo, 'utf8').replace(/\r\n/g, '\n').trimEnd()
}

export function estadoMapeamento(spec: PluginSpec): EstadoMapeamento {
  const origem = origemMapeamento(spec)
  const destino = destinoMapeamento(spec)

  if (!fs.existsSync(origem)) return 'ausente'
  if (!fs.existsSync(destino)) return 'ausente'

  try {
    return normalizar(origem) === normalizar(destino) ? 'ok' : 'desatualizado'
  } catch {
    return 'desatualizado'
  }
}

/** Copia o XML para a pasta do plugin. Carregar no plugin continua sendo manual. */
export function instalarMapeamento(spec: PluginSpec): string {
  const origem = origemMapeamento(spec)
  if (!fs.existsSync(origem)) {
    throw new Error(`Mapeamento não encontrado no repositório: ${origem}`)
  }

  const destino = destinoMapeamento(spec)
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.copyFileSync(origem, destino)
  return destino
}

// ----------------------------------------------------------------- estado

export async function estado(spec: PluginSpec): Promise<EstadoApp> {
  const caminho = localizar(spec)
  return {
    instalado: caminho !== null,
    caminho,
    rodando: await rodando(spec),
    mapeamento: estadoMapeamento(spec),
  }
}
