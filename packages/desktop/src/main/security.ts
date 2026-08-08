/**
 * Pure Electron security policy helpers. Main owns sender validation and
 * navigation policy; the renderer receives neither Electron nor raw events.
 */
import { URL } from 'node:url'

export type SenderLike = { readonly url: string }

export function assertTrustedSender(sender: SenderLike, appOrigin: string): void {
  const actual = new URL(sender.url)
  const expected = new URL(appOrigin)
  if (actual.protocol !== expected.protocol || actual.host !== expected.host) {
    throw new Error('Untrusted IPC sender')
  }
}

export function isTrustedNavigation(target: string, appOrigin: string): boolean {
  const actual = new URL(target)
  const expected = new URL(appOrigin)
  return actual.protocol === expected.protocol && actual.host === expected.host
}

export function denyPermission(): boolean {
  return false
}
