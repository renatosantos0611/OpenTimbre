/**
 * Traduzir uma cena em mensagens de Control Change.
 *
 * Esta é a única parte do caminho da cena que é **decisão** — qual CC recebe
 * qual valor, o que fazer com um knob cujo pedal está desligado, qual amp
 * mandar quando o pedido não é controlável. O resto é encanamento: abrir a
 * porta e escrever bytes, que mora em `midi-out.ts`.
 *
 * Separar os dois tem uma consequência prática que justifica o arquivo: esta
 * função é pura, então dá para testá-la sem loopMIDI, sem plugin aberto e sem
 * Windows. Enquanto ela vivia dentro do `applyScene`, a única forma de saber se
 * uma cena virava os CCs certos era ligar o som e escutar.
 */

import {
  knobToMidi,
  resolveAmp,
  toggleToMidi,
  type AmpStrategy,
  type Cena,
  type ParamSpec,
  type PluginSpec,
} from './types.js'

export type MensagemCC = { readonly cc: number; readonly valor: number }

export type ScenePlan = {
  /** Amp realmente controlado — pode diferir do pedido se ele não estiver mapeado. */
  readonly amp: string
  /** Instrução manual, quando a estratégia de amp não manda MIDI. */
  readonly ampInstruction: string | null
  /** Aviso de amp sem knobs mapeados. */
  readonly warning: string | null
  /** Na ordem exata em que devem ser enviadas. */
  readonly mensagens: readonly MensagemCC[]
}

/**
 * Valor MIDI de um parâmetro, ou `null` quando não há o que enviar.
 *
 * - toggle: sempre resolve — ausente vira `off`, o que mantém a cena determinística.
 * - select: só resolve se a IA mandou um nome que existe nas opções.
 * - knob: usa o valor da cena; se o efeito que governa o knob está desligado,
 *   usa o valor de repouso (`off`, default 0 — mas 5 nas bandas de EQ, que é o flat).
 */
function midiValueFor(spec: ParamSpec, raw: unknown, resting: boolean): number | null {
  if (spec.type === 'toggle') return toggleToMidi(raw === true)
  if (spec.type === 'select') {
    const value = typeof raw === 'string' ? spec.options?.[raw] : undefined
    return value ?? null
  }
  if (typeof raw === 'number') return knobToMidi(raw)
  return resting ? knobToMidi(spec.off ?? 0) : null
}

/**
 * Quais knobs devem ir para o valor de repouso: os governados por um toggle que
 * não está ligado. A validação do schema garante que um efeito ligado sempre
 * traz os knobs dele, então nada que deveria soar acaba zerado por aqui.
 */
function knobsEmRepouso(plugin: PluginSpec, campos: Record<string, unknown>): Set<string> {
  const repouso = new Set<string>()
  for (const [toggle, knobs] of Object.entries(plugin.grupos)) {
    if (campos[toggle] !== true) for (const knob of knobs) repouso.add(knob)
  }
  return repouso
}

/**
 * Monta o plano de envio de uma cena **inteira**, nunca de um delta: MIDI é via
 * única e a app não consegue ler o estado do plugin, então reenviar tudo é o
 * que mantém os dois em sincronia. Se o usuário mexer num knob com o mouse, a
 * próxima troca de cena corrige.
 */
export function planScene(
  plugin: PluginSpec,
  cena: Cena,
  ampPedido: string,
  strategy: AmpStrategy,
): ScenePlan {
  const mensagens: MensagemCC[] = []
  const send = (cc: number, valor: number) => void mensagens.push({ cc, valor })

  // Trocar o amp e depois mexer nos knobs de OUTRO amp seria inaudível e
  // confuso — então quem manda é o amp que a app consegue de fato controlar.
  const { amp, warning } = resolveAmp(plugin, ampPedido)
  const ampInstruction = strategy.apply(amp, send)

  // Uma seção bypassada engoliria a cena inteira em silêncio, e a app não tem
  // como ler o estado do plugin para descobrir isso. Então liga todas antes.
  for (const cc of Object.values(plugin.sempreLigado)) send(cc, 127)

  const campos = cena as Record<string, unknown>
  const repouso = knobsEmRepouso(plugin, campos)

  // Parâmetros do amp: o CC depende de qual amplificador está ativo, e o amp
  // que não tem o controle simplesmente não tem entrada na tabela.
  const ampCCs = plugin.ampCC[amp] ?? {}
  for (const [nome, spec] of Object.entries(plugin.ampParams)) {
    const cc = ampCCs[nome]
    if (cc === undefined) continue
    const valor = midiValueFor(spec, campos[nome], repouso.has(nome))
    if (valor !== null) send(cc, valor)
  }

  for (const [nome, spec] of Object.entries(plugin.params)) {
    const valor = midiValueFor(spec, campos[nome], repouso.has(nome))
    if (valor !== null) send(spec.cc, valor)
  }

  return { amp, ampInstruction, warning, mensagens }
}
