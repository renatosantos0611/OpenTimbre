/**
 * Guards the packaging fix for the "AI never responds" bug: `rig-builder.ts`
 * resolves `PROMPTS_DIR` as `../prompts/` relative to its own `import.meta.url`
 * — correct when it runs unbundled (packages/core's tests, the CLI), but once
 * esbuild inlines it into `dist/main/main.js`, `import.meta.url` reflects the
 * BUNDLE's location, so that same lookup resolves to `dist/prompts/`. Nothing
 * put the prompt files there, so `loadSystemPrompt()` threw on every send,
 * caught only by chat-controller's outer generic catch — "Something went
 * wrong", no detail. `build:prompts` (`scripts/copy-prompts.mjs`) mirrors
 * `packages/core/prompts/` into `dist/prompts/` so the bundled lookup finds
 * real files. This test proves the shipped bundle, not the unbundled source
 * tree, which is what let the bug ship past every other suite in the first
 * place — every one of them runs `rig-builder.ts` unbundled.
 *
 * Requires `npm run build` first, same convention as
 * `e2e-packaged/packaged.spec.ts`: fails loudly naming the missing directory
 * instead of silently skipping.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const MAIN_DIR = fileURLToPath(new URL('../../dist/main/', import.meta.url))
const PROMPTS_DIR = fileURLToPath(new URL('../../dist/prompts/', import.meta.url))

test('the bundled prompts directory sits where the bundled main.js resolves it', () => {
  if (!existsSync(MAIN_DIR)) {
    throw new Error(`dist/main missing — run 'npm run build' before this test: ${MAIN_DIR}`)
  }
  for (const file of ['system-rig.en.md', 'system-rig.pt.md']) {
    assert.ok(existsSync(PROMPTS_DIR + file), `missing ${file} at ${PROMPTS_DIR} — run 'npm run build:prompts'`)
  }
})
