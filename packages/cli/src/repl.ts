/**
 * REPL entry point (`npm run dev`). Deliberately the only file the `dev`
 * script points at, and deliberately tiny: it imports nothing beyond
 * `node:process` and the version-check module itself, so the Node-version
 * gate is the first thing that can possibly run — never preceded by a
 * static import of something (like `node:sqlite`, pulled in transitively by
 * `key-store.ts`) that would throw its own, uncrafted error while the
 * module graph is still linking, on a Node old enough to lack it.
 *
 * The real REPL lives in `repl-main.ts`, reached only via a genuine dynamic
 * `import()` — evaluated after the gate passes, not hoisted alongside it.
 * See `repl-main.ts`'s header for the full reasoning.
 */
import { checkNodeVersion } from './node-version-check.ts'

const versionCheck = checkNodeVersion(process.version)
if (!versionCheck.ok) {
  console.error(versionCheck.message)
  process.exit(1)
}

await import('./repl-main.ts')
