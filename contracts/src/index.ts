/**
 * Public surface of `@opentimbre/contracts`: everything a later package
 * (Phase 3's main/preload/renderer, and `@opentimbre/core`'s `t()`) imports
 * lives behind this one entry point rather than reaching into `ipc.ts` or
 * `i18n.ts` directly.
 */
export * from './ipc.js'
export * from './i18n.js'
