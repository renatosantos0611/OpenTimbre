/**
 * The Electron-side `safeStorage` vault that the core key-store depends on.
 * The core cannot import Electron (see `opentimbre-core-boundary`), so this
 * adapter is the host injecting the encryption capability. `safeStorage`
 * encrypts with the OS keychain (DPAPI on Windows, Keychain on macOS), and
 * `protect`/`reveal` return/consume only `Uint8Array` — the plaintext key
 * never leaves the key-store's own call into `safeStorage` (see
 * `opentimbre-secrets`).
 *
 * When `safeStorage` isn't available (Linux without a keyring, or a test
 * without Electron), `isAvailable()` is false and the caller falls back to an
 * unprotected store that marks rows accordingly — absence is a supported
 * state, not a crash.
 */
import { safeStorage } from '../electron.ts'
import type { Vault } from '@opentimbre/core/src/ports/vault.ts'

export function createSafeStorageVault(): Vault | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  return {
    protect(plain: string): Uint8Array {
      return new Uint8Array(safeStorage.encryptString(plain))
    },
    reveal(sealed: Uint8Array): string {
      return safeStorage.decryptString(Buffer.from(sealed))
    },
  }
}