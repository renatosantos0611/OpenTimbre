/**
 * Schemas zod derivados de um `PluginSpec`. Nada de lista de parâmetros escrita
 * à mão aqui — se um CC nasce ou morre no spec, o schema acompanha sozinho.
 *
 * Tudo é por plugin: cada um tem os seus parâmetros, logo o seu schema e a sua
 * tool. É assim que a IA escolhe o plugin — chamando a tool dele.
 */

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { KNOB_MAX, KNOB_MIN, type Cena, type ParamSpec, type PluginSpec } from './plugins/index.js'

/** Um spec vira um tipo zod: knob = 0–10, toggle = boolean, select = enum. */
function fieldFor(spec: ParamSpec): z.ZodTypeAny {
  if (spec.type === 'toggle') return z.boolean().describe(spec.desc)
  if (spec.type === 'select') {
    const names = Object.keys(spec.options ?? {})
    return z.enum(names as [string, ...string[]]).describe(spec.desc)
  }
  return z.number().min(KNOB_MIN).max(KNOB_MAX).describe(spec.desc)
}

/** Todos os campos de uma cena: os do amp (CC depende do amp) + os de CC fixo. */
function todosOsSpecs(plugin: PluginSpec): [string, ParamSpec][] {
  return [...Object.entries(plugin.ampParams), ...Object.entries(plugin.params)]
}

/**
 * Montar os schemas percorre dezenas de parâmetros e o JSON Schema resultante
 * tem alguns KB. Nada disso muda em runtime, e o caminho é percorrido a cada
 * turno de conversa — então o resultado fica em cache por plugin.
 */
const cache = new Map<string, ReturnType<typeof construir>>()

function construir(plugin: PluginSpec) {
  const specs = todosOsSpecs(plugin)

  // Forma "crua" de cada campo, sem decidir required/optional — reusada tanto
  // pela cena completa quanto pelo patch parcial do comando `ajustar`.
  const rawShape: Record<string, z.ZodTypeAny> = {}
  for (const [name, spec] of specs) rawShape[name] = fieldFor(spec)

  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [name, spec] of specs) {
    shape[name] = spec.required ? rawShape[name]! : rawShape[name]!.optional()
  }

  /**
   * `.strict()` rejeita chaves fora do mapa — chave inventada vira erro de
   * validação, nunca um parâmetro silenciosamente ignorado.
   */
  const cena = z
    .object(shape)
    .strict()
    .superRefine((valores, ctx) => {
      // Efeito ligado sem os knobs dele seria aplicado com tudo em zero, que
      // soa como se o efeito não tivesse ligado.
      for (const [toggle, knobs] of Object.entries(plugin.grupos)) {
        if ((valores as Record<string, unknown>)[toggle] !== true) continue
        for (const knob of knobs) {
          if ((valores as Record<string, unknown>)[knob] === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [knob],
              message: `'${knob}' é obrigatório quando '${toggle}' é true`,
            })
          }
        }
      }
    })

  const uso = z
    .object({
      captador: z
        .string()
        .describe('posição do captador: ponte, centro, braço, ponte+centro, centro+braço'),
      volume: z.number().min(0).max(10).describe('volume da guitarra, 0 a 10'),
      tone: z.number().min(0).max(10).describe('tone da guitarra, 0 a 10'),
      tecnica: z
        .string()
        .describe('frase curta: palhetada, abafamento, região de ataque, dedo ou palheta'),
    })
    .strict()

  /**
   * Uma cena é o que o guitarrista lê **mais** o que o MIDI aplica. Os
   * parâmetros ficam isolados em `params` de propósito: é exatamente o objeto
   * que vai para `applyScene`, e misturar texto ali obrigaria todo mundo a
   * filtrar campos.
   */
  const cenaDetalhada = z
    .object({
      /**
       * Três campos de texto, três papéis distintos — e o cartão da janela
       * mostra um em cada faixa. Repetir conteúdo entre eles desperdiça o
       * espaço da janela e faz o guitarrista reler a mesma coisa três vezes.
       */
      titulo: z
        .string()
        .describe(
          'nome curto do trecho, 1 a 3 palavras, como se fosse o rótulo de um banco de patch. Ex.: "Base de riffs", "Solo", "Intro limpa". Sem nome de artista nem de música',
        ),
      resumo: z
        .string()
        .describe(
          'uma linha de até ~60 caracteres dizendo o que esta cena faz em termos de som, sem repetir o título nem citar números. Ex.: "Drive de amp com fuzz na frente, grave apertado"',
        ),
      explicacao: z
        .string()
        .describe(
          'por que este amp, este nível de drive e estes efeitos aproximam o tom da gravação — 2 a 4 frases, para o guitarrista ler. Não repita o resumo',
        ),
      guitarra: uso.describe('ajustes a fazer na guitarra física para esta cena'),
      params: cena.describe('parâmetros do plugin para esta cena'),
    })
    .strict()

  /** O que a IA preenche. `plugin` não entra: vem de qual tool ela chamou. */
  const rigModelo = z
    .object({
      musica: z.string().describe('nome da música'),
      artista: z.string().describe('artista ou banda'),
      amp: z
        .enum(plugin.amps as [string, ...string[]])
        .describe('amplificador para a música inteira'),
      nota: z.string().describe('frase curta: abordagem, captador recomendado, técnica'),
      cenas: z
        .record(z.string(), cenaDetalhada)
        .describe(
          "cenas nomeadas; 'base' é obrigatória, 'solo'/'intro'/'limpo'/'ponte' quando fizer sentido",
        )
        .refine((c) => 'base' in c, { message: 'precisa conter a cena "base"' }),
    })
    .strict()

  // Patch parcial do comando `ajustar`: só o que muda.
  const ajusteShape: Record<string, z.ZodTypeAny> = {}
  for (const name of Object.keys(rawShape)) ajusteShape[name] = rawShape[name]!.optional()

  const ajuste = z
    .object({
      resumo: z.string().describe('frase curta do que mudou e por quê'),
      mudancas: z
        .object(ajusteShape)
        .strict()
        .describe('somente os campos que devem mudar para atender ao pedido — omita o resto'),
    })
    .strict()

  const json = (schema: z.ZodTypeAny) => {
    const out = zodToJsonSchema(schema, {
      target: 'jsonSchema7',
      $refStrategy: 'none',
    }) as Record<string, unknown>
    delete out['$schema']
    return out
  }

  return {
    cena,
    cenaDetalhada,
    rigModelo,
    ajuste,
    rigJson: json(rigModelo),
    ajusteJson: json(ajuste),
  }
}

function schemas(plugin: PluginSpec) {
  let pronto = cache.get(plugin.id)
  if (!pronto) {
    pronto = construir(plugin)
    cache.set(plugin.id, pronto)
  }
  return pronto
}

// ------------------------------------------------------------------- público

export function cenaSchema(plugin: PluginSpec): z.ZodTypeAny {
  return schemas(plugin).cena
}

/** O schema que a IA preenche — sem o campo `plugin`, que é deduzido da tool. */
export function rigModeloSchema(plugin: PluginSpec): z.ZodTypeAny {
  return schemas(plugin).rigModelo
}

export function rigJsonSchema(plugin: PluginSpec): Record<string, unknown> {
  return schemas(plugin).rigJson
}

export function ajusteSchema(plugin: PluginSpec): z.ZodTypeAny {
  return schemas(plugin).ajuste
}

export function ajusteJsonSchema(plugin: PluginSpec): Record<string, unknown> {
  return schemas(plugin).ajusteJson
}

/** Nome da tool deste plugin. É por ele que se descobre qual a IA escolheu. */
export function toolName(plugin: PluginSpec): string {
  return `aplicar_rig_${plugin.id}`
}

export const AJUSTE_TOOL_NAME = 'ajustar_cena'

// ---------------------------------------------------------------- tipos e rig

export type UsoGuitarra = {
  captador: string
  volume: number
  tone: number
  tecnica: string
}

export type CenaDetalhada = {
  titulo: string
  /**
   * Uma linha sobre o que a cena faz. Nasceu depois do resto, então uma
   * conversa salva por uma versão anterior pode não trazê-la — o histórico
   * guarda as cenas frouxas (`z.unknown()`) de propósito, e quem redesenha
   * precisa aguentar a ausência sem quebrar.
   */
  resumo: string
  explicacao: string
  guitarra: UsoGuitarra
  params: Cena
}

/**
 * A rig como a app guarda: o que a IA devolveu **mais** o plugin a que ela
 * pertence. Sem esse campo, uma rig lida do disco não teria como saber para
 * qual mapa de CC os valores foram pensados.
 */
export type Rig = {
  plugin: string
  musica: string
  artista: string
  amp: string
  nota: string
  cenas: Record<string, CenaDetalhada>
}

/**
 * Valida uma rig vinda do disco. Precisa do catálogo para achar o plugin dela,
 * então recebe o spec já resolvido por quem chamou.
 *
 * O `plugin` sai antes da validação: o schema é o que a IA preenche, é
 * `.strict()`, e não conhece esse campo — que é da app, não do modelo.
 */
export function parseRig(plugin: PluginSpec, valor: unknown): Rig | null {
  if (typeof valor !== 'object' || valor === null) return null

  const { plugin: _ignorado, ...doModelo } = valor as Record<string, unknown>
  const parsed = schemas(plugin).rigModelo.safeParse(doModelo)
  if (!parsed.success) return null
  return { ...(parsed.data as Omit<Rig, 'plugin'>), plugin: plugin.id }
}
