import { defineConfig } from '@playwright/test'

/**
 * Packaged-runtime smoke. Runs the built portable exe through Playwright's
 * Electron support — no webServer, no injected bridge: the app under test is
 * the artifact itself. One test, one worker, and a 60s ceiling covering the
 * cold packaged start (see `e2e-packaged/packaged.spec.ts`).
 */
export default defineConfig({
  testDir: './e2e-packaged',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
})
