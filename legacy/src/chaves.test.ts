/**
 * O que os testes protegem aqui é a precedência entre banco e `.env`, que é
 * onde os erros ficam invisíveis: uma chave removida na janela que continuasse
 * no `process.env` faria a app seguir usando a conta antiga, e o guitarrista
 * veria a fatura do lugar errado sem nenhum sinal na tela.
 *
 * O banco é `:memory:` e o cofre é de mentira — nada aqui toca a DPAPI nem o
 * `config/` de verdade.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import * as chaves from './chaves.js'

// Antes de qualquer chamada: o módulo fotografa o ambiente na primeira vez que
// precisa dele, e é essa foto que ele restaura ao remover uma chave.
process.env.ANTHROPIC_API_KEY = 'sk-ant-do-ambiente'
delete process.env.OPENAI_API_KEY

chaves.configurar({ arquivo: ':memory:', cofre: null })

/** Cifra de brinquedo: só precisa não ser a identidade. */
const cofreFalso: chaves.Cofre = {
  proteger: (t) => Buffer.from(t, 'utf8').map((b) => b ^ 0x5a),
  revelar: (d) => Buffer.from(Buffer.from(d).map((b) => b ^ 0x5a)).toString('utf8'),
}

function chaveDe(provedor: string): chaves.Chave {
  return chaves.listar().find((c) => c.provedor === provedor)!
}

test('sem nada guardado, a origem é o ambiente — ou coisa nenhuma', () => {
  assert.equal(chaveDe('anthropic').origem, 'ambiente')
  assert.equal(chaveDe('openai').origem, 'nenhuma')
})

test('a chave guardada precede o .env e chega ao process.env', () => {
  chaves.guardar('anthropic', 'sk-ant-api03-DAJANELA0000000000abcd')

  assert.equal(chaveDe('anthropic').origem, 'app')
  assert.equal(process.env.ANTHROPIC_API_KEY, 'sk-ant-api03-DAJANELA0000000000abcd')
})

test('a dica mostra as pontas e esconde o meio', () => {
  const dica = chaveDe('anthropic').dica!
  assert.equal(dica, 'sk-ant…abcd')
  assert.ok(!dica.includes('DAJANELA'), 'a dica não pode conter o miolo da chave')
})

test('remover devolve o ambiente exatamente como estava', () => {
  chaves.guardar('openai', 'sk-proj-0000000000000000wxyz')
  assert.equal(process.env.OPENAI_API_KEY, 'sk-proj-0000000000000000wxyz')

  chaves.remover('openai')
  chaves.remover('anthropic')

  // A do .env volta; a que não existia some, em vez de ficar com o valor antigo.
  assert.equal(process.env.ANTHROPIC_API_KEY, 'sk-ant-do-ambiente')
  assert.equal(process.env.OPENAI_API_KEY, undefined)
  assert.equal(chaveDe('openai').origem, 'nenhuma')
})

test('com cofre, o segredo é cifrado e continua utilizável', () => {
  chaves.configurar({ cofre: cofreFalso })
  chaves.guardar('openai', 'sk-proj-CIFRADA00000000wxyz')

  const c = chaveDe('openai')
  assert.equal(c.protegida, true)
  assert.equal(c.legivel, true)
  assert.equal(process.env.OPENAI_API_KEY, 'sk-proj-CIFRADA00000000wxyz')
})

test('linha cifrada sem cofre é ilegível, e o ambiente não fica com sobra', () => {
  // É o caso do banco copiado para outra máquina, ou de outra conta do Windows.
  chaves.configurar({ cofre: null })
  chaves.aplicarNoAmbiente()

  const c = chaveDe('openai')
  assert.equal(c.legivel, false)
  assert.equal(c.origem, 'nenhuma')
  assert.equal(process.env.OPENAI_API_KEY, undefined)
})

test('chave vazia ou colada pela metade não entra no banco', () => {
  assert.throws(() => chaves.guardar('anthropic', '   '), /vazia/)
  assert.throws(() => chaves.guardar('anthropic', 'ANTHROPIC_API_KEY= sk-ant-1'), /espaço/)
})
