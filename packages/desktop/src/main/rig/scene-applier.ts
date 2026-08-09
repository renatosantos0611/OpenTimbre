/**
 * Owns a loaded rig and applies one of its scenes to the plugin as MIDI.
 *
 * The decision — which CC gets which value, which amp is actually mapped — is
 * already made by `planScene`/`resolveAmp`/`getAmpStrategy` in core; this
 * module is the plumbing that runs that plan against a `MidiTransport`, per
 * `opentimbre-testing`'s decision/I-O split. It holds the current `Rig` (set
 * by the chat controller when the model produces one) and opens the MIDI port
 * lazily on the first apply, caching the `send` so a fully connected session
 * never re-scans the port.
 *
 * Every failure is a contained `Result` (`{ error: string }`), never a throw,
 * and a missing MIDI port leaves the app open — the guitarist keeps seeing
 * the screen (see `opentimbre-cross-platform`).
 *
 * The clock is injectable so tests can measure `ms` without a real timer.
 */
import type { AppliedScene, Result, Rig } from '@opentimbre/contracts'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import type { MidiTransport, Send } from '@opentimbre/core/src/ports/midi-transport.ts'
import { getAmpStrategy, resolveAmp } from '@opentimbre/core/src/plugins/types.ts'
import { planScene } from '@opentimbre/core/src/scenes/plan-scene.ts'

export type SceneApplierClock = () => number

const defaultClock: SceneApplierClock = () => Date.now()

export type SceneApplierOptions = {
  transport: MidiTransport
  clock?: SceneApplierClock
}

export type SceneApplier = {
  setRig(rig: Rig | null): void
  apply(scene: string): Promise<Result<AppliedScene>>
  /** Current MIDI connection state — `{ port, error }` or both null before first connect. */
  midiState(): { port: string | null; error: string | null }
}

export function createSceneApplier(options: SceneApplierOptions): SceneApplier {
  const { transport } = options
  const clock = options.clock ?? defaultClock

  let rig: Rig | null = null
  let send: Send | null = null
  let midiPort: string | null = null
  let midiError: string | null = null

  return {
    setRig(r) {
      rig = r
    },
    midiState() {
      return { port: midiPort, error: midiError }
    },
    async apply(sceneName) {
      if (!rig) return { error: 'No rig loaded — nothing to apply yet.' }
      const currentRig = rig // a local const so the fields survive the closure narrowing

      const spec = CATALOG.find((p) => p.id === currentRig.plugin)
      if (!spec) return { error: `Unknown plugin '${currentRig.plugin}' in the loaded rig.` }

      const scene = currentRig.scenes[sceneName]
      if (!scene) return { error: `Scene '${sceneName}' is not in the loaded rig.` }

      if (!send) {
        const connection = await transport.connect()
        if ('error' in connection) {
          midiError = connection.error
          return connection // port missing — contained failure, app stays open
        }
        send = connection.send
        midiError = null
        midiPort = 'VoiceRig'
      }

      const warnings: string[] = []
      const { amp: resolvedAmp, warning } = resolveAmp(spec, currentRig.amp)
      if (warning) warnings.push(warning)

      const strategy = getAmpStrategy(spec)
      const instruction = strategy.apply(resolvedAmp, send)
      if (instruction) warnings.push(instruction)

      const plan = planScene(spec, scene.params, resolvedAmp)
      const started = clock()
      for (const { cc, value } of plan) send(cc, value)
      const ms = clock() - started

      return { scene: sceneName, amp: resolvedAmp, ccsSent: plan.length, ms, warnings }
    },
  }
}