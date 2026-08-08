/** Cache em disco das rigs geradas: rigs/<slug>.json. */

import fs from 'node:fs'
import path from 'node:path'
import { porId } from './plugins/index.js'
import { parseRig, type Rig } from './schema.js'

const RIGS_DIR = path.resolve(process.cwd(), 'rigs')

export function slugify(pedido: string): string {
  return (
    pedido
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // tira acentos: "Sertões" -> "sertoes"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'sem-nome'
  )
}

export function rigPath(slug: string): string {
  return path.join(RIGS_DIR, `${slug}.json`)
}

/** Retorna null se não houver cache ou se o arquivo estiver corrompido/desatualizado. */
export function load(slug: string): Rig | null {
  const file = rigPath(slug)
  if (!fs.existsSync(file)) return null

  try {
    const bruto = JSON.parse(fs.readFileSync(file, 'utf8')) as { plugin?: unknown }

    // Sem o plugin não dá para saber a que mapa de CC os valores pertencem, e
    // validar contra o plugin errado aceitaria uma rig que soaria absurda.
    const spec = typeof bruto.plugin === 'string' ? porId(bruto.plugin) : undefined
    if (!spec) return null

    // Cache de uma versão antiga do schema: ignora e regenera.
    return parseRig(spec, bruto)
  } catch {
    return null
  }
}

export function save(slug: string, rig: Rig): string {
  fs.mkdirSync(RIGS_DIR, { recursive: true })
  const file = rigPath(slug)
  fs.writeFileSync(file, `${JSON.stringify(rig, null, 2)}\n`, 'utf8')
  return file
}

export function list(): string[] {
  if (!fs.existsSync(RIGS_DIR)) return []
  return fs
    .readdirSync(RIGS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
}

export type RigEntry = { slug: string; musica: string; artista: string; cenas: string[] }

export function listDetailed(): RigEntry[] {
  return list().map((slug) => {
    const r = load(slug)
    return r
      ? { slug, musica: r.musica, artista: r.artista, cenas: Object.keys(r.cenas) }
      : { slug, musica: '(ilegível)', artista: '', cenas: [] }
  })
}

/**
 * Procura rigs em cache que combinem com o pedido.
 *
 * O slug vem da frase digitada, não da música — "configurar amp para sweet
 * child" e "sweet child o mine" geram slugs diferentes para a mesma música e
 * gastariam duas chamadas de API. Aqui, além do slug exato, também casamos
 * por substring e pelo campo `musica` da rig salva.
 */
export function find(pedido: string): RigEntry[] {
  const q = slugify(pedido)
  const all = listDetailed()

  const exato = all.filter((e) => e.slug === q)
  if (exato.length > 0) return exato

  return all.filter((e) => {
    const m = slugify(e.musica)
    return e.slug.includes(q) || q.includes(e.slug) || m === q || m.includes(q) || q.includes(m)
  })
}
