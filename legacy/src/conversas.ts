/**
 * Conversas salvas em disco: `conversas/<id>.json`.
 *
 * Cada arquivo guarda duas coisas com propósitos diferentes:
 *
 * - `mensagens` — a transcrição que a janela redesenha. Formato nosso, estável.
 * - `historico` — o array de mensagens **no formato nativo do provedor**,
 *   opaco de propósito. É o que permite reabrir uma conversa antiga e continuar
 *   de onde parou, com o modelo lembrando de tudo. Como o formato é específico
 *   de cada API, guardamos junto qual provedor o gerou: se você reabrir uma
 *   conversa da OpenAI rodando na Anthropic, o histórico nativo não serve e a
 *   sessão recomeça (a transcrição continua visível).
 */

import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { Rig } from './schema.js'

const DIR = path.resolve(process.cwd(), 'conversas')

export const PAPEIS = ['usuario', 'ia', 'erro'] as const
export type Papel = (typeof PAPEIS)[number]

/**
 * A rig é guardada frouxa aqui de propósito: validá-la exigiria resolver o
 * plugin dela contra o catálogo, e uma conversa cujo plugin saiu do catálogo
 * ainda vale como transcrição — o que se perde é poder reaplicar as cenas, não
 * poder reler o que foi conversado. Quem vai de fato aplicar resolve o spec e
 * valida ali.
 */
const RigSalvaSchema = z
  .object({
    plugin: z.string(),
    musica: z.string(),
    artista: z.string(),
    amp: z.string(),
    nota: z.string(),
    cenas: z.record(z.string(), z.unknown()),
  })
  .passthrough()

const MensagemSchema = z.object({
  papel: z.enum(PAPEIS),
  texto: z.string(),
  /** Só nas mensagens da IA que trouxeram timbres. */
  rig: RigSalvaSchema.optional(),
})

const ConversaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  criadaEm: z.string(),
  atualizadaEm: z.string(),
  provedor: z.string(),
  mensagens: z.array(MensagemSchema),
  historico: z.unknown(),
})

export type Mensagem = { papel: Papel; texto: string; rig?: Rig }
export type Conversa = Omit<z.infer<typeof ConversaSchema>, 'mensagens'> & {
  mensagens: Mensagem[]
}

/** O que a lista do histórico precisa — sem carregar as rigs inteiras. */
export type Resumo = {
  id: string
  titulo: string
  atualizadaEm: string
  turnos: number
}

export function novoId(): string {
  // Ordenável por nome e legível no explorador de arquivos.
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function arquivo(id: string): string {
  return path.join(DIR, `${id}.json`)
}

/**
 * Título a partir da primeira frase do guitarrista, trocado por
 * "Artista — Música" assim que a IA devolve o primeiro timbre — que é o nome
 * que ele vai reconhecer na lista depois.
 */
export function tituloDe(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, ' ')
  return limpo.length > 60 ? `${limpo.slice(0, 57)}…` : limpo || 'Sem título'
}

export function carregar(id: string): Conversa | null {
  try {
    const parsed = ConversaSchema.safeParse(JSON.parse(fs.readFileSync(arquivo(id), 'utf8')))
    return parsed.success ? (parsed.data as Conversa) : null
  } catch {
    return null
  }
}

export function salvar(c: Conversa): void {
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(arquivo(c.id), `${JSON.stringify(c, null, 2)}\n`, 'utf8')
}

export function apagar(id: string): void {
  try {
    fs.unlinkSync(arquivo(id))
  } catch {
    // Já não existe: o efeito desejado é o mesmo.
  }
}

/** Mais recente primeiro. Arquivos ilegíveis são ignorados em silêncio. */
export function listar(): Resumo[] {
  if (!fs.existsSync(DIR)) return []

  const resumos: Resumo[] = []
  for (const nome of fs.readdirSync(DIR)) {
    if (!nome.endsWith('.json')) continue
    const c = carregar(nome.replace(/\.json$/, ''))
    if (!c) continue
    resumos.push({
      id: c.id,
      titulo: c.titulo,
      atualizadaEm: c.atualizadaEm,
      turnos: c.mensagens.filter((m) => m.papel === 'usuario').length,
    })
  }

  return resumos.sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))
}

/** O plugin da conversa é o da última rig — é ele que a barra do topo mostra. */
export function pluginDaConversa(c: Conversa): string | null {
  return ultimaRig(c)?.plugin ?? null
}

/** A rig ativa de uma conversa é a última que a IA mandou. */
export function ultimaRig(c: Conversa): Rig | null {
  for (let i = c.mensagens.length - 1; i >= 0; i--) {
    const rig = c.mensagens[i]?.rig
    if (rig) return rig
  }
  return null
}
