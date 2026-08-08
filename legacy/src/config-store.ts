/**
 * Configuração em disco: `config/<nome>.json`.
 *
 * Mesma filosofia do `library.ts`: valida com zod na leitura e, se o arquivo
 * estiver corrompido ou de uma versão antiga, devolve o default em vez de
 * quebrar a app. Uma config ilegível nunca deve impedir a janela de abrir.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { z } from 'zod'

const CONFIG_DIR = path.resolve(process.cwd(), 'config')

export function configPath(nome: string): string {
  return path.join(CONFIG_DIR, `${nome}.json`)
}

/**
 * O diretório, criado se ainda não existir. Existe para quem guarda config que
 * não é JSON — hoje só o banco das chaves de IA (`chaves.ts`), que precisa do
 * caminho antes de abrir a conexão.
 */
export function dir(): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  return CONFIG_DIR
}

/**
 * `z.ZodType<T, z.ZodTypeDef, unknown>`, não `z.ZodType<T>` puro: o terceiro
 * parâmetro (`Input`) de um schema com `.default()` — como `autoAplicar` em
 * `janela.ts` — é `T | undefined`, e ele aparece na posição contravariante de
 * `parse()`. Deixado para o TS inferir, `T` acaba virando esse tipo de entrada
 * mais frouxo em vez do tipo de saída (já com o default aplicado), e quem
 * chama `read` com um `fallback` totalmente preenchido esbarra num erro de tipo
 * dizendo que falta o campo que tem default. Fixar `Input` como `unknown` tira
 * essa posição da inferência — `T` passa a vir só de `fallback`.
 */
export function read<T>(nome: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, fallback: T): T {
  const file = configPath(nome)
  if (!fs.existsSync(file)) return fallback

  try {
    const parsed = schema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')))
    return parsed.success ? parsed.data : fallback
  } catch {
    return fallback
  }
}

export function write(nome: string, value: unknown): string {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  const file = configPath(nome)
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return file
}
