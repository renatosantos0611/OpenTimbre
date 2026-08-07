/**
 * O cartão da janela é a única superfície em que o guitarrista lê a cena, então
 * o que ele mostra é contrato, não detalhe de desenho. Os testes de invariante
 * percorrem o `CATALOGO` — plugin novo já entra sendo verificado.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { exibirCena, rotulo } from './exibicao.js'
import { CATALOGO, ampsMapeados, type Cena, type PluginSpec } from './index.js'

/** Cena preenchida: todo knob em 5, todo toggle ligado, todo select na 1ª opção. */
function cenaCheia(spec: PluginSpec): Cena {
  const cena: Cena = {}
  for (const [nome, p] of Object.entries({ ...spec.ampParams, ...spec.params })) {
    if (p.type === 'knob') cena[nome] = 5
    else if (p.type === 'toggle') cena[nome] = true
    else cena[nome] = Object.keys(p.options ?? {})[0] ?? ''
  }
  return cena
}

test('o rótulo separa camelCase e sobe para caixa alta', () => {
  assert.equal(rotulo('gain'), 'GAIN')
  assert.equal(rotulo('dlyMix'), 'DLY MIX')
  // Dígito não abre palavra nova: OD1 é um nome, não "OD 1".
  assert.equal(rotulo('od1'), 'OD1')
})

for (const spec of CATALOGO) {
  describe(spec.id, () => {
    const amp = ampsMapeados(spec)[0]!
    const cheia = cenaCheia(spec)

    test('a linha de faceplate não estoura o espaço da janela', () => {
      const { valores } = exibirCena(spec, cheia, amp)
      assert.ok(valores.length > 0, 'cena cheia sem nenhum valor — o cartão sairia vazio')
      assert.ok(valores.length <= 6, `${valores.length} valores não cabem em 420px`)
    })

    test('só entram na linha os controles que este amp realmente tem', () => {
      const ccs = spec.ampCC[amp] ?? {}
      const { valores } = exibirCena(spec, cheia, amp)
      for (const { label } of valores) {
        const doAmp = Object.keys(spec.ampParams).find((n) => rotulo(n) === label)
        if (!doAmp) continue
        assert.ok(
          ccs[doAmp] !== undefined,
          `${label} aparece no cartão mas o amp ${amp} não tem esse CC — o cartão mentiria`,
        )
      }
    })

    test('efeito desligado não vira bloco', () => {
      const desligada: Cena = { ...cheia }
      for (const toggle of Object.keys(spec.grupos)) desligada[toggle] = false

      const { pedais } = exibirCena(spec, desligada, amp)
      assert.deepEqual(pedais, [], 'pedal desligado descrito como se estivesse soando')
    })

    test('efeito ligado vira bloco, na ordem da cadeia de sinal', () => {
      const { pedais } = exibirCena(spec, cheia, amp)
      assert.deepEqual(
        pedais.map((p) => p.nome),
        Object.keys(spec.grupos).map((t) => rotulo(t.endsWith('On') ? t.slice(0, -2) : t)),
      )
    })

    /**
     * Dígito colado num nome (`eq1`, `od2`) passa; o que não pode aparecer é um
     * número solto, porque aí o bloco estaria repetindo o valor do knob — que é
     * papel da linha de faceplate, e só dela.
     */
    test('o bloco descreve o knob em palavra, nunca em número', () => {
      const { pedais } = exibirCena(spec, cheia, amp)
      for (const p of pedais) {
        assert.ok(
          !/\b\d+(\.\d+)?\b/.test(p.detalhe),
          `'${p.nome}: ${p.detalhe}' tem número solto — isso é papel da linha de faceplate`,
        )
      }
    })

    test('nenhum bloco vira parede de texto', () => {
      const { pedais } = exibirCena(spec, cheia, amp)
      for (const p of pedais) {
        assert.ok(
          p.detalhe.split(' · ').length <= 5,
          `'${p.nome}' descreve knobs demais: ${p.detalhe}`,
        )
      }
    })

    test('nenhum parâmetro aparece nas duas regiões do cartão', () => {
      const { valores, pedais } = exibirCena(spec, cheia, amp)
      const naLinha = new Set(valores.map((v) => v.label))

      for (const [toggle, knobs] of Object.entries(spec.grupos)) {
        if (cheia[toggle] !== true) continue
        for (const knob of knobs) {
          assert.ok(
            !naLinha.has(rotulo(knob)),
            `'${knob}' está na linha de faceplate E no bloco de pedal`,
          )
        }
      }
      assert.ok(pedais.length >= 0)
    })

    test('cena vazia não quebra nem inventa valor', () => {
      const { valores, pedais } = exibirCena(spec, {}, amp)
      assert.deepEqual(valores, [])
      assert.deepEqual(pedais, [])
    })
  })
}
