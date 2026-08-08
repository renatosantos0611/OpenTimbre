/**
 * O contrato de um plugin da Neural DSP.
 *
 * A app nasceu em cima do Archetype Gojira, com o mapa de CC dele espalhado em
 * constantes globais. Aqui esse conhecimento vira **dado**: cada plugin é um
 * `PluginSpec`, e schema, envio MIDI e system prompt são derivados do spec em
 * vez de importarem um módulo específico.
 *
 * O que mora neste arquivo é o que vale para qualquer plugin — as escalas, as
 * estratégias de troca de amp, os tipos. O que é do Gojira mora em `gojira.ts`.
 */

// ------------------------------------------------------------------ parâmetros

export type ParamType = 'knob' | 'toggle' | 'select'

export type ParamSpec = {
  readonly type: ParamType
  /** Se true, a cena precisa trazer o valor — nunca há default silencioso. */
  readonly required: boolean
  readonly desc: string
  /**
   * Valor (na escala 0–10) enviado quando o toggle que governa este knob está
   * desligado. Default 0. As bandas de EQ usam 5, que é o flat — mandar 0 seria
   * -12 dB em tudo.
   */
  readonly off?: number
  /** Só para `select`: nome que a IA usa → valor MIDI 0–127. */
  readonly options?: Readonly<Record<string, number>>
}

/** Um `ParamSpec` com CC fixo — usado pelos parâmetros que não dependem do amp. */
export type FixedParamSpec = ParamSpec & { readonly cc: number }

/**
 * Uma cena são os valores dos parâmetros do plugin.
 *
 * O tipo é frouxo de propósito. Antes ele era derivado por mapped types dos
 * literais do Gojira, o que dava autocomplete campo a campo — mas isso só
 * funciona com **um** plugin conhecido em tempo de compilação. A garantia real
 * sempre foi o zod, que valida nome, tipo e faixa de cada campo em runtime a
 * partir do spec; o que se perde aqui é conveniência de edição, não segurança.
 */
export type ParamValue = number | boolean | string
export type Cena = Record<string, ParamValue>

// --------------------------------------------------------------------- escalas

export const KNOB_MIN = 0
export const KNOB_MAX = 10

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** A IA trabalha em 0–10; o plugin fala 0–127. */
export function knobToMidi(v: number): number {
  return clamp(Math.round(v * 12.7), 0, 127)
}

export function toggleToMidi(on: boolean): number {
  return on ? 127 : 0
}

// ------------------------------------------------------------------- o plugin

/** O que o lançador precisa saber para abrir o app e cuidar do mapeamento. */
export type AppInfo = {
  /** Caminhos prováveis do executável, na ordem em que devem ser tentados. */
  readonly candidatos: readonly string[]
  /** Nome do processo no Windows, para saber se já está aberto. */
  readonly processo: string
  /** Subpasta em %APPDATA% onde o plugin guarda settings e mapeamentos. */
  readonly settings: string
  /**
   * Subpasta de `settings` onde o plugin guarda os arquivos de MIDI Mapping.
   * Não é universal: o Gojira usa `MIDI Mappings`, o Soldano usa só `MIDI`.
   */
  readonly pastaMidi: string
  /** Arquivo em `midi-mapping/` que a app instala nessa pasta. */
  readonly mapeamento: string
}

export type PluginSpec = {
  readonly id: string
  readonly nome: string
  /** Uma frase para a IA decidir quando este plugin é a escolha certa. */
  readonly quando: string
  /** Cadeia de sinal, para a doc do system prompt. */
  readonly cadeia: string
  /** Arquivo em `prompts/plugins/` com o conhecimento de tom deste plugin. */
  readonly doc: string

  readonly amps: readonly string[]
  readonly ampDesc: Readonly<Record<string, string>>
  /** O seletor de amp: em que CC ele está e que valor corresponde a cada amp. */
  readonly ampSelect: { readonly cc: number; readonly valores: Readonly<Record<string, number>> }
  /** Os controles que definem um amp como "mapeado" — ver `resolveAmp`. */
  readonly ampCore: readonly string[]
  /** Parâmetros cujo CC depende de qual amp está ativo. */
  readonly ampParams: Readonly<Record<string, ParamSpec>>
  /** CC de cada parâmetro do amp, por amp. Ausente = aquele amp não tem o controle. */
  readonly ampCC: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Parâmetros de CC fixo (pedais, cabinete, delay, reverb). */
  readonly params: Readonly<Record<string, FixedParamSpec>>
  /** Toggle → knobs que ele governa, dos pedais e do EQ do amp juntos. */
  readonly grupos: Readonly<Record<string, readonly string[]>>
  /** Bypass de seção: sempre enviados em 127 antes da cena. */
  readonly sempreLigado: Readonly<Record<string, number>>

  readonly app: AppInfo
}

// ------------------------------------------------------------- amps mapeados

export function ampMapeado(spec: PluginSpec, amp: string): boolean {
  const ccs = spec.ampCC[amp] ?? {}
  return spec.ampCore.every((k) => ccs[k] !== undefined)
}

export function ampsMapeados(spec: PluginSpec): string[] {
  return spec.amps.filter((a) => ampMapeado(spec, a))
}

/**
 * Se o amp pedido não tem knobs mapeados, cai no primeiro que tem — senão a
 * app trocaria o amp e depois mexeria nos knobs de outro, que é inaudível e
 * confuso. Retorna o aviso para a interface mostrar.
 */
export function resolveAmp(spec: PluginSpec, target: string): { amp: string; warning: string | null } {
  if (ampMapeado(spec, target)) return { amp: target, warning: null }

  const fallback = ampsMapeados(spec)[0]
  if (!fallback) {
    return { amp: target, warning: 'nenhum amp tem knobs mapeados — só o seletor foi enviado' }
  }
  return {
    amp: fallback,
    warning: `o amp ${target} ainda não tem knobs mapeados no plugin — aplicando em ${fallback}`,
  }
}

// ------------------------------------------------- estratégia de troca de amp

export type Send = (cc: number, value: number) => void

export type AmpStrategy = {
  readonly name: string
  /** Retorna null se aplicou via MIDI, ou uma instrução em texto se exigir ação manual. */
  apply(target: string, send: Send): string | null
  /** Ressincroniza o estado interno (só o `increment` guarda estado). */
  reset(current?: string): void
}

/** CC contínuo 0–127 mapeado nas posições do seletor. */
function continua(spec: PluginSpec): AmpStrategy {
  return {
    name: 'continuous',
    apply(target, send) {
      const valor = spec.ampSelect.valores[target]
      if (valor === undefined) return `amp '${target}' não existe em ${spec.nome}`
      send(spec.ampSelect.cc, valor)
      return null
    },
    reset() {},
  }
}

/**
 * Seletor que só avança uma posição por pulso. Mantém a posição atual em
 * memória — se alguém mexer no plugin com o mouse, o estado dessincroniza e
 * é preciso chamar `reset()`.
 */
function incremento(spec: PluginSpec): AmpStrategy {
  let current = spec.amps[0] ?? ''
  return {
    name: 'increment',
    apply(target, send) {
      const n = spec.amps.length
      const steps = (spec.amps.indexOf(target) - spec.amps.indexOf(current) + n) % n
      for (let i = 0; i < steps; i++) {
        send(spec.ampSelect.cc, 127)
        send(spec.ampSelect.cc, 0)
      }
      current = target
      return null
    },
    reset(c) {
      current = c ?? spec.amps[0] ?? ''
    },
  }
}

const manual: AmpStrategy = {
  name: 'manual',
  apply(target) {
    return `selecione o amp ${target} no plugin`
  },
  reset() {},
}

/**
 * Default: `manual`. A Fase 0 (`amptest`) decide se `continuous` ou `increment`
 * funciona. `GOJIRA_AMP_STRATEGY` continua valendo — é o nome que já está nos
 * `.env` existentes, e quebrá-lo trocaria a estratégia de quem já configurou.
 */
export function getAmpStrategy(
  spec: PluginSpec,
  name = process.env.AMP_STRATEGY ?? process.env.GOJIRA_AMP_STRATEGY ?? 'manual',
): AmpStrategy {
  switch (name) {
    case 'continuous':
      return continua(spec)
    case 'increment':
      return incremento(spec)
    case 'manual':
      return manual
    default:
      throw new Error(
        `Estratégia de amp desconhecida: '${name}'. Use manual | continuous | increment.`,
      )
  }
}
