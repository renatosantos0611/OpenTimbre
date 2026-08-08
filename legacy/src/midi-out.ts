/**
 * Única parte do código que conhece o `@julusian/midi`. A API dele é orientada
 * a objeto e abre a porta por índice, não por nome — isso fica encapsulado aqui
 * para o resto da app só ver `sendCC`, `applyScene`, `learn`, `sweep`.
 */

import midi from '@julusian/midi'
import { planScene, type AmpStrategy, type Cena, type PluginSpec } from './plugins/index.js'

type Output = InstanceType<typeof midi.Output>

const DEFAULT_PORT = process.env.VOICERIG_PORT ?? 'VoiceRig'

/** Control Change no canal 1. */
const CC_STATUS = 0xb0

let out: Output | null = null
let openPortName = ''
let learnTimer: NodeJS.Timeout | null = null

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function listPorts(): string[] {
  const probe = new midi.Output()
  try {
    return Array.from({ length: probe.getPortCount() }, (_, i) => probe.getPortName(i))
  } finally {
    probe.closePort()
  }
}

/** Abre a primeira porta cujo nome contém `fragment`. Idempotente. */
export function openPort(fragment = DEFAULT_PORT): string {
  if (out) return openPortName

  const candidate = new midi.Output()
  const names = Array.from({ length: candidate.getPortCount() }, (_, i) => candidate.getPortName(i))
  const index = names.findIndex((n) => n.toLowerCase().includes(fragment.toLowerCase()))

  if (index === -1) {
    candidate.closePort()
    // Listar as portas encontradas economiza muito tempo de diagnóstico.
    throw new Error(
      `Porta '${fragment}' não encontrada. Crie no loopMIDI.\n` +
        `Portas de saída visíveis: ${names.length ? names.map((n) => `'${n}'`).join(', ') : '(nenhuma)'}`,
    )
  }

  candidate.openPort(index)
  out = candidate
  openPortName = names[index]!
  return openPortName
}

function requireOut(): Output {
  if (!out) throw new Error('Porta MIDI não está aberta. Chame openPort() primeiro.')
  return out
}

export function sendCC(cc: number, value: number): void {
  if (!Number.isInteger(cc) || cc < 0 || cc > 127) {
    throw new Error(`CC inválido: ${cc} (esperado 0–127)`)
  }
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new Error(`Valor inválido: ${value} (esperado 0–127)`)
  }
  requireOut().sendMessage([CC_STATUS, cc, value])
}

/** Fecha a porta. Sem isso a porta virtual pode ficar presa no Windows. */
export function close(): void {
  stopLearn()
  if (out) {
    out.closePort()
    out = null
    openPortName = ''
  }
}

// ------------------------------------------------------------------ Fase 0

/** Pulsos alternados 127/0 para o MIDI Learn do plugin capturar o CC. */
export function startLearn(cc: number, intervalMs = 500): void {
  stopLearn()
  let high = true
  sendCC(cc, 127)
  learnTimer = setInterval(() => {
    high = !high
    sendCC(cc, high ? 127 : 0)
  }, intervalMs)
}

export function stopLearn(): void {
  if (learnTimer) {
    clearInterval(learnTimer)
    learnTimer = null
  }
}

/** Varre o CC de 0 a 127 e volta a 0, para ver se o parâmetro responde contínuo. */
export async function sweep(cc: number, stepMs = 18): Promise<void> {
  for (let v = 0; v <= 127; v++) {
    sendCC(cc, v)
    await sleep(stepMs)
  }
  sendCC(cc, 0)
}

// ----------------------------------------------------------- aplicar a cena

export type ApplyResult = {
  /** Amp realmente controlado — pode diferir do pedido se ele não estiver mapeado. */
  amp: string
  /** Instrução manual, quando a estratégia de amp não manda MIDI. */
  ampInstruction: string | null
  /** Aviso de amp sem knobs mapeados. */
  warning: string | null
  ccsSent: number
}

/**
 * Aplica a cena inteira na porta. Quem decide o que enviar é o `planScene`, em
 * `plugins/cena.ts`; aqui só se escreve o que ele planejou — é essa divisão que
 * permite testar a tradução de cena em CCs sem uma porta MIDI aberta.
 */
export function applyScene(
  plugin: PluginSpec,
  cena: Cena,
  requested: string,
  strategy: AmpStrategy,
): ApplyResult {
  const plano = planScene(plugin, cena, requested, strategy)
  for (const { cc, valor } of plano.mensagens) sendCC(cc, valor)

  return {
    amp: plano.amp,
    ampInstruction: plano.ampInstruction,
    warning: plano.warning,
    ccsSent: plano.mensagens.length,
  }
}
