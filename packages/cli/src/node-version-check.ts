/**
 * Fails the CLI early, with a message naming the required version, when the
 * running Node is too old — no silent degradation (ratified 2026-08-03).
 *
 * The minimum is Node >=22.12, matching Electron 43's `engines.node`: the CLI
 * and the future Electron main process share `@opentimbre/core`, so holding
 * both entry points to the same floor now avoids a version-specific bug that
 * only reproduces on one of them later.
 *
 * Pure and injectable — `version` is a parameter, never read from
 * `process.version` internally — so the rule is testable without depending on
 * whichever Node actually runs the test (`repl.ts`/`probe.ts` call this with
 * the real `process.version`; the test calls it with fixtures).
 *
 * This message is intentionally plain English, not run through `t()`: it can
 * fire before locale is resolved (locale resolution itself runs core code
 * this gate exists to protect), and it reports an environment/toolchain
 * failure rather than app UI copy.
 */

const REQUIRED_MAJOR = 22
const REQUIRED_MINOR = 12

export type NodeVersionCheck = { readonly ok: true } | { readonly ok: false; readonly message: string }

/** `version` accepts `process.version`'s leading `'v'` or a bare `'22.12.0'`. */
export function checkNodeVersion(version: string): NodeVersionCheck {
  const cleaned = version.startsWith('v') ? version.slice(1) : version
  const [majorPart, minorPart] = cleaned.split('.')
  const major = Number(majorPart)
  const minor = Number(minorPart)

  if (!Number.isInteger(major) || !Number.isInteger(minor)) {
    return {
      ok: false,
      message: `Could not parse Node version '${version}'. OpenTimbre requires Node >=${REQUIRED_MAJOR}.${REQUIRED_MINOR}.`,
    }
  }

  const ok = major > REQUIRED_MAJOR || (major === REQUIRED_MAJOR && minor >= REQUIRED_MINOR)
  if (ok) return { ok: true }

  return {
    ok: false,
    message:
      `OpenTimbre requires Node >=${REQUIRED_MAJOR}.${REQUIRED_MINOR}, but this is running on Node ${cleaned}. ` +
      'Install a newer Node and try again.',
  }
}
