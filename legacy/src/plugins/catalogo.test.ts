/**
 * Invariantes do catálogo — rodam sozinhas para **todo** plugin registrado.
 *
 * Nenhum teste aqui conhece Gojira, Soldano ou Tim Henson pelo nome: eles
 * percorrem o `CATALOGO`. É de propósito. Acrescentar um Archetype novo passa a
 * herdar a suíte inteira sem escrever um teste, que é o que se quer quando "a
 * maioria do que vai ser adicionado é a mesma lógica do que já existe".
 *
 * O que se está protegendo aqui não é hipótese: cada invariante corresponde a
 * um erro que já aconteceu de verdade neste projeto — CC repetido em duas
 * linhas do XML, grupo apontando para um knob que mudou de nome, e um mapa
 * instalado no plugin sem os CCs que o spec já mandava.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, test } from 'node:test'
import { CATALOGO, ampsMapeados, type PluginSpec } from './index.js'

const RAIZ = new URL('../../', import.meta.url)
const arquivo = (rel: string) => new URL(rel, RAIZ)

/** CCs declarados no `.xml` de mapeamento, nos dois formatos que existem. */
function ccsDoMapeamento(spec: PluginSpec): Set<number> {
  const caminho = arquivo(`midi-mapping/${spec.app.mapeamento}`)
  const bruto = fs.readFileSync(caminho, 'utf8')

  // Sem os comentários: eles citam CCs em prosa e falsificariam a conferência.
  const xml = bruto.replace(/<!--[\s\S]*?-->/g, '')

  const ccs = new Set<number>()
  // Série X: data1="20". Gojira (formato antigo): cc="20".
  for (const m of xml.matchAll(/\bdata1="(\d+)"/g)) ccs.add(Number(m[1]))
  for (const m of xml.matchAll(/\scc="(\d+)"/g)) ccs.add(Number(m[1]))
  return ccs
}

/** Todo CC que o spec pode mandar, com o nome do campo que o usa. */
function ccsDoSpec(spec: PluginSpec): Map<number, string[]> {
  const mapa = new Map<number, string[]>()
  const anota = (cc: number, quem: string) => {
    const atual = mapa.get(cc) ?? []
    atual.push(quem)
    mapa.set(cc, atual)
  }

  anota(spec.ampSelect.cc, 'ampSelect')
  for (const [amp, ccs] of Object.entries(spec.ampCC)) {
    for (const [nome, cc] of Object.entries(ccs)) anota(cc, `${amp}.${nome}`)
  }
  for (const [nome, p] of Object.entries(spec.params)) anota(p.cc, nome)
  for (const [nome, cc] of Object.entries(spec.sempreLigado)) anota(cc, nome)
  return mapa
}

test('os ids do catálogo são únicos', () => {
  const ids = CATALOGO.map((p) => p.id)
  assert.deepEqual(ids, [...new Set(ids)], 'dois plugins com o mesmo id se sobrescreveriam em porId()')
})

test('o catálogo não está vazio', () => {
  assert.ok(CATALOGO.length > 0, 'padrao() explode com o catálogo vazio')
})

for (const spec of CATALOGO) {
  describe(spec.id, () => {
    const doSpec = ccsDoSpec(spec)

    test('nenhum CC é usado por dois parâmetros', () => {
      const repetidos = [...doSpec.entries()].filter(([, quem]) => quem.length > 1)
      assert.deepEqual(
        repetidos.map(([cc, quem]) => `CC ${cc}: ${quem.join(' e ')}`),
        [],
        'dois parâmetros no mesmo CC — o segundo sobrescreve o primeiro em silêncio',
      )
    })

    test('todo CC está na faixa MIDI válida', () => {
      for (const cc of doSpec.keys()) {
        assert.ok(
          Number.isInteger(cc) && cc >= 0 && cc <= 127,
          `CC ${cc} fora de 0–127 — sendCC() joga em runtime`,
        )
      }
    })

    test('todo CC do spec existe no arquivo de mapeamento', () => {
      const noXml = ccsDoMapeamento(spec)
      const ausentes = [...doSpec.entries()]
        .filter(([cc]) => !noXml.has(cc))
        .map(([cc, quem]) => `CC ${cc} (${quem.join(', ')})`)

      assert.deepEqual(
        ausentes,
        [],
        `${spec.app.mapeamento} não mapeia esses CCs — a app manda e o plugin ignora`,
      )
    })

    test('o doc do system prompt existe', () => {
      assert.ok(
        fs.existsSync(arquivo(`prompts/plugins/${spec.doc}`)),
        `prompts/plugins/${spec.doc} não existe — loadSystemPrompt() falha`,
      )
    })

    test('os amps têm descrição, CC e valor de seletor', () => {
      for (const amp of spec.amps) {
        assert.ok(spec.ampDesc[amp], `${amp} sem descrição — o system prompt sai capenga`)
        assert.ok(spec.ampCC[amp], `${amp} sem tabela de CC`)
        assert.ok(
          spec.ampSelect.valores[amp] !== undefined,
          `${amp} sem valor no seletor — a estratégia continuous não consegue trocar para ele`,
        )
      }
    })

    test('o seletor de amp não inventa amps', () => {
      for (const nome of Object.keys(spec.ampSelect.valores)) {
        assert.ok(spec.amps.includes(nome), `'${nome}' está no seletor mas não em amps`)
      }
    })

    test('a tabela de CC por amp só cita parâmetros que existem', () => {
      for (const [amp, ccs] of Object.entries(spec.ampCC)) {
        for (const nome of Object.keys(ccs)) {
          assert.ok(
            nome in spec.ampParams,
            `${amp}.${nome} tem CC mas não está em ampParams — nunca seria enviado`,
          )
        }
      }
    })

    test('ampCore só cita parâmetros que existem', () => {
      for (const nome of spec.ampCore) {
        assert.ok(nome in spec.ampParams, `ampCore cita '${nome}', que não está em ampParams`)
      }
    })

    test('pelo menos um amp está mapeado', () => {
      assert.ok(
        ampsMapeados(spec).length > 0,
        'nenhum amp cumpre o ampCore — toda cena cairia no aviso de "sem knobs mapeados"',
      )
    })

    test('os grupos ligam toggles reais a knobs reais', () => {
      const todos = { ...spec.ampParams, ...spec.params }
      for (const [toggle, knobs] of Object.entries(spec.grupos)) {
        const dono = todos[toggle]
        assert.ok(dono, `grupo '${toggle}' não é um parâmetro`)
        assert.equal(dono.type, 'toggle', `grupo '${toggle}' precisa ser toggle, é ${dono.type}`)
        for (const knob of knobs) {
          assert.ok(todos[knob], `'${toggle}' governa '${knob}', que não é um parâmetro`)
        }
      }
    })

    test('todo select tem opções', () => {
      const todos = { ...spec.ampParams, ...spec.params }
      for (const [nome, p] of Object.entries(todos)) {
        if (p.type !== 'select') continue
        assert.ok(
          p.options && Object.keys(p.options).length > 0,
          `select '${nome}' sem options — o zod monta um enum vazio`,
        )
      }
    })

    test('o executável e a pasta de settings estão preenchidos', () => {
      assert.ok(spec.app.candidatos.length > 0, 'sem candidatos, localizar() nunca acha o app')
      assert.ok(spec.app.processo.endsWith('.exe'), 'processo precisa ser o nome do .exe')
      assert.ok(spec.app.mapeamento.endsWith('.xml'))
    })
  })
}
