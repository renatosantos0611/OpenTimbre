import { defineConfig } from '@playwright/test'

/**
 * Packaged-runtime smoke. Runs the built portable exe through Playwright's
 * Electron support — no webServer, no injected bridge: the app under test is
 * the artifact itself. One test, one worker, and a 120s ceiling covering the
 * cold packaged start — portable self-extraction on a slow CI runner
 * (see `e2e-packaged/packaged.spec.ts`).
 */
export default defineConfig({
  testDir: './e2e-packaged',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
})
