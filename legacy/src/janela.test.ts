/**
 * `autoAplicar` chegou depois dos outros campos, e `JanelaSchema` é `.strict()`
 * — a combinação clássica que reseta a config inteira de quem já tinha a
 * janela salva. O que garante que isso não aconteça é o `.default(false)` no
 * campo novo; este teste existe para não deixar alguém trocá-lo de volta por
 * um `z.boolean()` cru sem perceber a consequência.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JanelaSchema, PADRAO } from './janela.js'

test('o default preenche a config nova', () => {
  assert.equal(PADRAO.autoAplicar, false)
})

test('um config/janela.json salvo antes deste campo continua válido', () => {
  const antigo = {
    largura: 500,
    altura: 800,
    x: 100,
    y: 50,
    sempreNoTopo: false,
    escurecerSemFoco: true,
    // sem autoAplicar — é exatamente o arquivo de uma versão anterior
  }

  const parsed = JanelaSchema.safeParse(antigo)
  assert.ok(parsed.success, 'campo novo com .default() não pode invalidar o arquivo antigo')
  if (parsed.success) {
    assert.equal(parsed.data.autoAplicar, false, 'preenche com o default, não com undefined')
    // Os campos que já existiam sobrevivem intactos — é o que quebraria se o
    // parse caísse por inteiro e devolvesse PADRAO no lugar.
    assert.equal(parsed.data.largura, 500)
    assert.equal(parsed.data.sempreNoTopo, false)
  }
})

test('um config/janela.json novo, com o campo explícito, é respeitado', () => {
  const novo = { ...PADRAO, autoAplicar: true }
  const parsed = JanelaSchema.safeParse(novo)
  assert.ok(parsed.success)
  if (parsed.success) assert.equal(parsed.data.autoAplicar, true)
})
