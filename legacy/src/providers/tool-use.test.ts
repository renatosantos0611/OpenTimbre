/**
 * O protocolo de tool use, testado com uma sessão de mentira.
 *
 * Este arquivo é a justificativa do refactor. Enquanto o laço vivia dentro de
 * cada provedor, verificar "ele tenta duas vezes e só duas" exigia uma chave de
 * API, rede e um modelo disposto a errar na hora certa — ou seja, não se
 * verificava. Com a `Sessao` invertida, o teste roteia respostas de mentira e
 * confere o comportamento inteiro em milissegundos.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { executar, type Chamada, type Resposta, type Sessao, type Veredito } from './tool-use.js'

/** Uma resposta pronta, para a fila da sessão falsa. */
function comTool(argumentos: unknown, texto = ''): Resposta {
  return {
    texto,
    chamada: { id: 'call-1', nome: 'tool_x', argumentos },
    bruto: {},
    usage: {},
    stopReason: 'tool_use',
  }
}

function soTexto(texto: string): Resposta {
  return { texto, chamada: null, bruto: {}, usage: {}, stopReason: 'end_turn' }
}

type Falsa = Sessao & {
  readonly historia: string[]
  readonly enviados: number
}

/** Sessão que devolve respostas de uma fila e anota tudo que aconteceu com ela. */
function sessaoFalsa(fila: Resposta[]): Falsa {
  const historia: string[] = []
  let enviados = 0

  const s = {
    label: 'Falsa',
    system: 'system de teste',
    model: () => 'modelo-de-teste',
    historia,
    get enviados() {
      return enviados
    },

    pedir(texto: string) {
      historia.push(`user:${texto}`)
    },

    async responder(): Promise<Resposta> {
      enviados++
      const proxima = fila.shift()
      if (!proxima) throw new Error('a fila da sessão falsa acabou — o laço pediu turnos demais')
      historia.push('assistant')
      return proxima
    },

    corrigir(_c: Chamada, feedback: string) {
      historia.push(`corrigir:${feedback}`)
    },

    confirmar(_c: Chamada, texto: string) {
      historia.push(`confirmar:${texto.slice(0, 8)}`)
    },

    marcar: () => historia.length,
    desfazer(marca: number) {
      historia.length = marca
    },
    historico: () => historia,
  }

  return s as unknown as Falsa
}

const OK: Veredito<string> = { ok: true, valor: 'pronto' }
const RUIM: Veredito<string> = {
  ok: false,
  issues: [{ path: ['gain'], message: 'obrigatório' }],
  feedback: 'conserta o gain',
}

const base = { operacao: 'rig' as const, pedido: 'oi', tools: [], forcar: 'tool_x' }

describe('executar', () => {
  test('devolve o valor validado quando o modelo acerta de primeira', async () => {
    const sessao = sessaoFalsa([comTool({ gain: 5 })])
    const valor = await executar({ ...base, sessao, validar: () => OK })

    assert.equal(valor, 'pronto')
    assert.equal(sessao.enviados, 1, 'acertou de primeira — não pode haver segunda ida')
  })

  test('entrega ao validador os argumentos já parseados', async () => {
    const sessao = sessaoFalsa([comTool({ gain: 7 })])
    let visto: unknown = null

    await executar({
      ...base,
      sessao,
      validar: (c) => {
        visto = c.argumentos
        return OK
      },
    })

    assert.deepEqual(visto, { gain: 7 })
  })

  test('devolve os issues ao modelo e aceita a segunda tentativa', async () => {
    const sessao = sessaoFalsa([comTool({}), comTool({ gain: 5 })])
    let vez = 0

    const valor = await executar({
      ...base,
      sessao,
      validar: () => (++vez === 1 ? RUIM : OK),
    })

    assert.equal(valor, 'pronto')
    assert.equal(sessao.enviados, 2)
    assert.ok(
      sessao.historia.includes('corrigir:conserta o gain'),
      'o feedback do zod precisa voltar para o modelo, senão a retentativa é um chute',
    )
  })

  test('desiste depois de duas falhas, sem uma terceira ida', async () => {
    const sessao = sessaoFalsa([comTool({}), comTool({})])

    await assert.rejects(
      executar({ ...base, sessao, validar: () => RUIM }),
      /falhou na validação duas vezes[\s\S]*gain: obrigatório/,
    )
    assert.equal(sessao.enviados, 2, 'a terceira tentativa custaria tokens sem mudar o resultado')
  })

  test('confirma a chamada bem-sucedida para o próximo turno não começar devendo', async () => {
    const sessao = sessaoFalsa([comTool({ gain: 5 })])
    await executar({ ...base, sessao, validar: () => OK })

    assert.ok(sessao.historia.some((h) => h.startsWith('confirmar:')))
  })

  test('sem tool e sem saída de texto prevista, falha citando o motivo da parada', async () => {
    const sessao = sessaoFalsa([soTexto('não vou chamar')])

    await assert.rejects(
      executar({ ...base, sessao, validar: () => OK }),
      /não chamou a tool 'tool_x'.*stop=end_turn/s,
    )
  })

  test('na conversa, turno só de texto é resposta legítima', async () => {
    const sessao = sessaoFalsa([soTexto('do álbum ou do ao vivo?')])

    const valor = await executar({
      ...base,
      sessao,
      forcar: null,
      validar: () => OK,
      semChamada: (texto) => `texto:${texto}`,
    })

    assert.equal(valor, 'texto:do álbum ou do ao vivo?')
  })

  test('o texto do turno chega ao validador junto da chamada', async () => {
    const sessao = sessaoFalsa([comTool({ gain: 5 }, 'aqui está')])
    let visto = ''

    await executar({
      ...base,
      sessao,
      validar: (_c, texto) => {
        visto = texto
        return OK
      },
    })

    assert.equal(visto, 'aqui está', 'no chat a prosa e a tool vêm no mesmo turno')
  })
})

describe('higiene do histórico', () => {
  test('erro de rede desfaz o turno inteiro, inclusive o pedido', async () => {
    const sessao = sessaoFalsa([])
    const antes = [...sessao.historia]

    await assert.rejects(executar({ ...base, sessao, validar: () => OK }))
    assert.deepEqual(
      sessao.historia,
      antes,
      'um turno pela metade envenena todos os seguintes — a API rejeita a conversa inteira',
    )
  })

  test('falha de validação em dobro também desfaz o turno', async () => {
    const sessao = sessaoFalsa([comTool({}), comTool({})])

    await assert.rejects(executar({ ...base, sessao, validar: () => RUIM }))
    assert.deepEqual(sessao.historia, [])
  })

  test('validador que joga não deixa resto no histórico', async () => {
    const sessao = sessaoFalsa([comTool({ gain: 5 })])

    await assert.rejects(
      executar({
        ...base,
        sessao,
        validar: () => {
          throw new Error('tool desconhecida')
        },
      }),
      /tool desconhecida/,
    )
    assert.deepEqual(sessao.historia, [])
  })

  test('sucesso preserva o turno no histórico', async () => {
    const sessao = sessaoFalsa([comTool({ gain: 5 })])
    await executar({ ...base, sessao, validar: () => OK })

    assert.ok(sessao.historia.includes('user:oi'), 'a conversa precisa lembrar do que foi pedido')
  })
})
