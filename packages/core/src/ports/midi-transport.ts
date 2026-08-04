/**
 * Owns the "how does a CC value reach the plugin" capability. The core
 * decides *what* to send (`scenes/plan-scene.ts`, a later task); this port is
 * how something else *sends* it, per `opentimbre-core-boundary`'s
 * decision/I-O split. `platform-node` implements one `MidiTransport` per OS
 * (loopMIDI port lookup on Windows, an owned virtual port on macOS) — none of
 * that shows up here.
 *
 * `connect()` never rejects: a missing port is a named failure
 * (`{ error: string }`), not a thrown exception, so callers can show it
 * without a try/catch.
 */
export type Send = (cc: number, value: number) => void

export type MidiTransport = {
  connect(): Promise<{ send: Send } | { error: string }>
}
