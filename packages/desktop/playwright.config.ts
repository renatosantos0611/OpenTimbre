import { defineConfig } from '@playwright/test'

/**
 * E2E for the renderer shell. Runs Chromium (headless) against the built
 * renderer served over HTTP; the fake `window.api` is injected per test via
 * `addInitScript`, so the real shell paints with a stubbed bridge — no
 * Electron, no MIDI, no plugin (see `opentimbre-testing`).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 420, height: 700 },
  },
  webServer: {
    command: 'node scripts/serve-renderer.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})