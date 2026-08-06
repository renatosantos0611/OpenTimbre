/**
 * Owns the secret-encryption capability the key-store (`secrets/key-store.ts`,
 * a later task) needs but cannot provide itself: the core has no keychain
 * access. The host (Electron main, via `safeStorage`) injects an
 * implementation at startup; the CLI can run with none at all (`null`), in
 * which case the key-store degrades to storing keys unprotected and marks the
 * row accordingly — absence is a supported state, not a crash, per
 * `opentimbre-core-boundary`.
 */
export type Vault = {
  protect(plain: string): Uint8Array
  reveal(sealed: Uint8Array): string
}
