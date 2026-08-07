/**
 * A leitura do `tasklist` é a única parte do lançador que dá para testar sem o
 * Windows na frente — e é justamente onde morava um bug que passou despercebido
 * por três plugins: o formato de tabela trunca o nome do processo em 25
 * caracteres, e o `Archetype Tim Henson X.exe` tem 26.
 *
 * As saídas abaixo foram **capturadas do `tasklist` real**, não inventadas.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { processoNaLista } from './lancador.js'
import { CATALOGO } from './index.js'

/** O que o `tasklist /NH /FO CSV /FI "IMAGENAME eq ..."` devolve sem match. */
const SEM_MATCH = 'INFO: No tasks are running which match the specified criteria.\r\n'

const COM_MATCH = '"StartMenuExperienceHost.exe","5268","Console","11","195,612 K"\r\n'

test('acha o processo na linha em CSV', () => {
  assert.equal(processoNaLista(COM_MATCH, 'StartMenuExperienceHost.exe'), true)
})

test('o nome longo sobrevive — é o bug do Tim Henson', () => {
  const saida = '"Archetype Tim Henson X.exe","10548","Console","11","512,000 K"\r\n'
  assert.equal(
    processoNaLista(saida, 'Archetype Tim Henson X.exe'),
    true,
    'nome de 26 caracteres precisa casar; era aqui que o formato de tabela truncava',
  )
})

test('a saída truncada do formato de tabela NÃO passa por engano', () => {
  // Se alguém trocar o `/FO CSV` de volta, este teste cai — que é o ponto.
  const tabela = 'Archetype Tim Henson X.ex     10548 Console                   11    512,000 K\r\n'
  assert.equal(processoNaLista(tabela, 'Archetype Tim Henson X.exe'), false)
})

test('sem match não vira falso positivo', () => {
  assert.equal(processoNaLista(SEM_MATCH, 'Archetype Gojira.exe'), false)
  assert.equal(processoNaLista('', 'Archetype Gojira.exe'), false)
})

test('a comparação é exata, não por prefixo', () => {
  const saida = '"Archetype Gojira Deluxe.exe","1","Console","1","1 K"\r\n'
  assert.equal(
    processoNaLista(saida, 'Archetype Gojira.exe'),
    false,
    'um plugin cujo nome é prefixo de outro não pode ser confundido com ele',
  )
})

test('ignora maiúsculas — o Windows também ignora', () => {
  const saida = '"ARCHETYPE GOJIRA.EXE","1","Console","1","1 K"\r\n'
  assert.equal(processoNaLista(saida, 'Archetype Gojira.exe'), true)
})

describe('catálogo', () => {
  test('todo plugin é encontrado pelo próprio nome de processo', () => {
    for (const spec of CATALOGO) {
      const saida = `"${spec.app.processo}","1234","Console","11","1 K"\r\n`
      assert.equal(
        processoNaLista(saida, spec.app.processo),
        true,
        `${spec.id}: '${spec.app.processo}' não casa consigo mesmo`,
      )
    }
  })

  test('nenhum plugin é confundido com outro do catálogo', () => {
    for (const spec of CATALOGO) {
      const saida = `"${spec.app.processo}","1234","Console","11","1 K"\r\n`
      for (const outro of CATALOGO) {
        if (outro.id === spec.id) continue
        assert.equal(
          processoNaLista(saida, outro.app.processo),
          false,
          `${outro.id} se acha aberto quando quem está aberto é o ${spec.id}`,
        )
      }
    }
  })
})
