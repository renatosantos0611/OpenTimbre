import { cpSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `rig-builder.ts` resolves its prompt files relative to its OWN
 * `import.meta.url` (`../prompts/`) — correct when it runs unbundled
 * (packages/core's tests, the CLI), but once esbuild inlines it into
 * `dist/main/main.js`, `import.meta.url` reflects the bundle's location, not
 * the original source file's. This mirrors `packages/core/prompts/` into
 * `dist/prompts/` so that same relative lookup resolves correctly post-bundle
 * too, instead of changing the (correct, for every unbundled caller) lookup
 * itself.
 */
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(packageDir, '../core/prompts')
const dest = path.join(packageDir, 'dist/prompts')

cpSync(source, dest, { recursive: true })
