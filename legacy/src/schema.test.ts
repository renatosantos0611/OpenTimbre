/**
 * Regras de derivação do schema — o que o zod passa a exigir a partir de um
 * `PluginSpec`.
 *
 * As asserções são calculadas **do próprio spec**, nunca escritas à mão. Um
 * teste que dissesse "gojira exige 11 campos" viraria manutenção toda vez que
 * um parâmetro nascesse; assim ele continua valendo para os três plugins de
 * hoje e para os que vierem.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CATALOGO, type Cena, type PluginSpec } from './plugins/index.js'
import { cenaSchema, parseRig, rigJsonSchema, toolName } from './schema.js'

/** A cena mínima que passa: todo campo `required`, no valor mais neutro. */
function cenaMinima(spec: PluginSpec): Cena {
  const cena: Record<string, unknown> = {}
  for (const [nome, p] of Object.entries({ ...spec.ampParams, ...spec.params })) {
    if (!p.required) continue
    if (p.type === 'toggle') cena[nome] = false
    else if (p.type === 'select') cena[nome] = Object.keys(p.options ?? {})[0]
    else cena[nome] = 5
  }
  return cena as Cena
}

/**
 * Anthropic e OpenAI aceitam `^[a-zA-Z0-9_-]{1,64}$` como nome de tool. O id de
 * plugin entra nesse nome, então um id com ponto, acento ou espaço quebraria as
 * duas APIs — e só na hora de gerar a rig, não no boot.
 */
test('o nome da tool de cada plugin é aceito pelas duas APIs', () => {
  for (const spec of CATALOGO) {
    const nome = toolName(spec)
    assert.match(nome, /^[a-zA-Z0-9_-]{1,64}$/, `'${nome}' seria recusado pela API`)
  }
})

for (const spec of CATALOGO) {
  describe(spec.id, () => {
    const cena = cenaSchema(spec)

    test('a cena mínima passa', () => {
      const r = cena.safeParse(cenaMinima(spec))
      assert.ok(r.success, JSON.stringify(r.success ? null : r.error.issues, null, 2))
    })

    test('os obrigatórios do JSON Schema são exatamente os required do spec', () => {
      const json = rigJsonSchema(spec) as {
        properties: {
          cenas: { additionalProperties: { properties: { params: { required?: string[] } } } }
        }
      }
      const doSchema = [...(json.properties.cenas.additionalProperties.properties.params.required ?? [])].sort()
      const doSpec = Object.entries({ ...spec.ampParams, ...spec.params })
        .filter(([, p]) => p.required)
        .map(([nome]) => nome)
        .sort()
      assert.deepEqual(doSchema, doSpec)
    })

    test('faltar um obrigatório é erro, nunca default silencioso', () => {
      const min = { ...cenaMinima(spec) } as Record<string, unknown>
      const primeiro = Object.keys(min)[0]
      if (!primeiro) return
      delete min[primeiro]
      assert.equal(cena.safeParse(min).success, false, `'${primeiro}' sumiu e passou mesmo assim`)
    })

    test('campo fora do mapa é rejeitado, não ignorado', () => {
      const r = cena.safeParse({ ...cenaMinima(spec), naoExiste: 7 })
      assert.equal(r.success, false, 'chave inventada precisa virar erro de validação')
    })

    test('knob fora de 0–10 é rejeitado', () => {
      const knob = Object.entries({ ...spec.ampParams, ...spec.params }).find(
        ([, p]) => p.type === 'knob',
      )
      if (!knob) return
      assert.equal(cena.safeParse({ ...cenaMinima(spec), [knob[0]]: 11 }).success, false)
      assert.equal(cena.safeParse({ ...cenaMinima(spec), [knob[0]]: -1 }).success, false)
    })

    test('efeito ligado sem os knobs dele é rejeitado', () => {
      const grupo = Object.entries(spec.grupos)[0]
      if (!grupo) return
      const [toggle, knobs] = grupo

      const semKnobs = { ...cenaMinima(spec) } as Record<string, unknown>
      semKnobs[toggle] = true
      for (const k of knobs) delete semKnobs[k]

      const r = cena.safeParse(semKnobs)
      assert.equal(r.success, false, `'${toggle}' ligado sem knobs soaria como desligado`)
      if (!r.success) {
        assert.ok(
          r.error.issues.some((i) => i.message.includes(toggle)),
          'a mensagem precisa citar o toggle culpado — é ela que volta para o modelo',
        )
      }
    })

    test('a rig precisa da cena base', () => {
      const detalhada = {
        titulo: 'Base de riffs',
        resumo: 'drive de amp com o grave apertado',
        explicacao: 'porque sim',
        guitarra: { captador: 'ponte', volume: 10, tone: 7, tecnica: 'palhetada' },
        params: cenaMinima(spec),
      }
      const base = {
        musica: 'M',
        artista: 'A',
        amp: spec.amps[0],
        nota: 'n',
        cenas: { base: detalhada },
      }

      assert.ok(parseRig(spec, base), 'a rig com cena base deveria passar')
      assert.equal(
        parseRig(spec, { ...base, cenas: { solo: detalhada } }),
        null,
        'sem a cena base a rig não pode ser aceita',
      )
    })

    test('parseRig carimba o plugin e ignora o que vier no arquivo', () => {
      const rig = parseRig(spec, {
        plugin: 'outro-plugin-qualquer',
        musica: 'M',
        artista: 'A',
        amp: spec.amps[0],
        nota: 'n',
        cenas: {
          base: {
            titulo: 'Base',
            resumo: 'r',
            explicacao: 'e',
            guitarra: { captador: 'ponte', volume: 10, tone: 7, tecnica: 't' },
            params: cenaMinima(spec),
          },
        },
      })
      assert.equal(rig?.plugin, spec.id, 'quem manda é o spec usado para validar')
    })
  })
}
