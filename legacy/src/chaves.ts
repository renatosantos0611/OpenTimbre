/**
 * As chaves de IA, guardadas pela janela.
 *
 * Antes elas só existiam no `.env`, o que obriga a fechar a app, editar um
 * arquivo com um editor de texto e reabrir só para trocar de conta. Este módulo
 * é o dono do segredo: ninguém mais lê ou grava o banco, e a chave em claro só
 * sai daqui para dentro do `process.env`, que é onde os SDKs a procuram.
 *
 * **Por que SQLite e não mais um JSON em `config/`.** Os outros arquivos de
 * config são inspecionáveis de propósito — o guitarrista abre `guitarra.json`
 * no bloco de notas e entende. Uma chave de API é o oposto disso: não deve ser
 * legível, nem sobreviver a uma gravação pela metade (um `writeFileSync`
 * interrompido deixa a chave truncada, e o erro só aparece na próxima chamada
 * de API). Uma transação do SQLite resolve as duas coisas, e a tabela ainda dá
 * lugar natural para o que uma chave carrega junto: quando foi trocada, se está
 * cifrada, que dica mostrar na tela.
 *
 * **Por que a cifragem vem de fora.** Quem sabe cifrar é o Electron
 * (`safeStorage`, que no Windows usa a DPAPI e amarra o segredo à conta do
 * usuário), e `src/` não pode importar Electron. Então quem tem o cofre o
 * injeta em `configurar`. Sem cofre — o REPL, os testes — a chave é gravada em
 * texto e a linha fica **marcada** como desprotegida, para a janela poder
 * avisar em vez de mentir que está segura.
 *
 * Requer `node:sqlite`, que existe a partir do Node 22.5. O Electron 43 traz
 * Node 24, então a janela está coberta; o REPL num Node antigo não é.
 */

import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import * as store from './config-store.js'
import { knownProviders } from './provider.js'
import type { ProviderId } from './providers/types.js'

/**
 * Quem cifra e decifra. Duas funções, porque é tudo que o Electron oferece e
 * tudo que este módulo precisa: `revelar` estoura quando o dado veio de outra
 * máquina ou de outra conta do Windows, e quem trata isso é `revelarLinha`.
 */
export type Cofre = {
  proteger(texto: string): Uint8Array
  revelar(dado: Uint8Array): string
}

/** O que a tela de Configurações mostra sobre uma chave — nunca a chave. */
export type Chave = {
  provedor: ProviderId
  label: string
  /** Env var equivalente, para quem prefere continuar usando o `.env`. */
  env: string
  /** De onde sai a chave que a app vai usar agora. */
  origem: 'app' | 'ambiente' | 'nenhuma'
  /** `sk-ant-…9f3a` — o bastante para reconhecer, não para usar. */
  dica: string | null
  atualizadaEm: string | null
  /** `true` quando a linha está cifrada com a DPAPI desta conta do Windows. */
  protegida: boolean
  /**
   * `false` quando existe linha guardada mas ela não abre — banco copiado de
   * outra máquina, ou cifrado por uma conta diferente. A tela pede a chave de
   * novo em vez de deixar a app falhar só na hora de gerar o timbre.
   */
  legivel: boolean
}

const TABELA = `
  CREATE TABLE IF NOT EXISTS chaves (
    provedor      TEXT PRIMARY KEY,
    segredo       BLOB    NOT NULL,
    protegida     INTEGER NOT NULL,
    dica          TEXT    NOT NULL,
    atualizada_em TEXT    NOT NULL
  ) STRICT
`

type Linha = {
  provedor: string
  segredo: Uint8Array
  protegida: number
  dica: string
  atualizada_em: string
}

let banco: DatabaseSync | null = null
let arquivo: string | null = null
let cofre: Cofre | null = null

/**
 * O `.env` como estava antes de qualquer chave da app entrar. É o que permite
 * *remover* uma chave: sem esta cópia, apagar a linha do banco deixaria no
 * ambiente a chave que ela sobrescreveu, e a app continuaria usando a antiga
 * sem que ninguém entendesse por quê.
 */
let ambiente: Record<string, string | undefined> | null = null

/**
 * Chamado uma vez pelo processo main: o arquivo do banco (os testes usam
 * `:memory:`) e o cofre. Passar só um dos dois deixa o outro como está.
 */
export function configurar(opcoes: { arquivo?: string; cofre?: Cofre | null }): void {
  if (opcoes.arquivo !== undefined && opcoes.arquivo !== arquivo) {
    banco?.close()
    banco = null
    arquivo = opcoes.arquivo
  }
  if (opcoes.cofre !== undefined) cofre = opcoes.cofre
}

export function caminho(): string {
  arquivo ??= path.join(store.dir(), 'chaves.db')
  return arquivo
}

function conexao(): DatabaseSync {
  if (!banco) {
    banco = new DatabaseSync(caminho())
    banco.exec(TABELA)
  }
  return banco
}

function provedores(): { id: ProviderId; label: string; env: string }[] {
  return knownProviders().map(({ provider }) => ({
    id: provider.id,
    label: provider.label,
    env: provider.keyEnv,
  }))
}

/** Guarda o ambiente original na primeira vez que alguém precisa dele. */
function capturarAmbiente(): Record<string, string | undefined> {
  ambiente ??= Object.fromEntries(provedores().map((p) => [p.env, process.env[p.env]]))
  return ambiente
}

function linhas(): Map<string, Linha> {
  const todas = conexao().prepare('SELECT * FROM chaves').all() as unknown as Linha[]
  return new Map(todas.map((l) => [l.provedor, l]))
}

function revelarLinha(linha: Linha): string | null {
  if (!linha.protegida) return Buffer.from(linha.segredo).toString('utf8')
  if (!cofre) return null
  try {
    return cofre.revelar(linha.segredo)
  } catch {
    // Cifrada por outra conta do Windows. Não é erro da app — é chave perdida.
    return null
  }
}

/**
 * Os seis primeiros caracteres identificam o provedor e a conta; os quatro
 * últimos são o que o guitarrista confere contra o painel da OpenAI ou da
 * Anthropic. O meio nunca sai daqui.
 */
function dicaDe(chave: string): string {
  return chave.length <= 12 ? '•'.repeat(chave.length) : `${chave.slice(0, 6)}…${chave.slice(-4)}`
}

export function listar(): Chave[] {
  const guardadas = linhas()
  const original = capturarAmbiente()

  return provedores().map((p) => {
    const linha = guardadas.get(p.id)
    const legivel = linha ? revelarLinha(linha) !== null : true
    const doAmbiente = Boolean(original[p.env]?.trim())

    return {
      provedor: p.id,
      label: p.label,
      env: p.env,
      origem: linha && legivel ? 'app' : doAmbiente ? 'ambiente' : 'nenhuma',
      dica: linha?.dica ?? null,
      atualizadaEm: linha?.atualizada_em ?? null,
      protegida: Boolean(linha?.protegida),
      legivel,
    }
  })
}

export function guardar(provedor: ProviderId, chave: string): void {
  const limpa = chave.trim()
  if (!limpa) throw new Error('Chave vazia — cole a chave inteira antes de salvar.')
  // Espaço no meio é quase sempre uma chave colada pela metade, ou colada junto
  // do `ANTHROPIC_API_KEY=` do `.env`. Barrar aqui evita uma ida à rede.
  if (/\s/.test(limpa)) throw new Error('A chave tem espaço no meio — cole só a chave.')

  const protegida = cofre ? 1 : 0
  const segredo = cofre ? cofre.proteger(limpa) : Buffer.from(limpa, 'utf8')

  conexao()
    .prepare(
      `INSERT INTO chaves (provedor, segredo, protegida, dica, atualizada_em)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(provedor) DO UPDATE SET
         segredo = excluded.segredo,
         protegida = excluded.protegida,
         dica = excluded.dica,
         atualizada_em = excluded.atualizada_em`,
    )
    .run(provedor, segredo, protegida, dicaDe(limpa), new Date().toISOString())

  aplicarNoAmbiente()
}

export function remover(provedor: ProviderId): void {
  conexao().prepare('DELETE FROM chaves WHERE provedor = ?').run(provedor)
  aplicarNoAmbiente()
}

/**
 * Põe as chaves guardadas no `process.env`, que é onde os SDKs as procuram.
 *
 * A chave da app **precede** a do `.env`: quem digitou na janela espera que
 * valha a que digitou. Onde não há chave guardada (ou ela não abre), o valor
 * original do ambiente volta — inclusive a ausência dele.
 */
export function aplicarNoAmbiente(): void {
  const original = capturarAmbiente()
  const guardadas = linhas()

  for (const p of provedores()) {
    const linha = guardadas.get(p.id)
    const chave = linha ? revelarLinha(linha) : null

    if (chave) {
      process.env[p.env] = chave
    } else if (original[p.env] === undefined) {
      delete process.env[p.env]
    } else {
      process.env[p.env] = original[p.env]
    }
  }
}
