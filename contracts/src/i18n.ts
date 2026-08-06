/**
 * The valid keys into OpenTimbre's message catalog (`en.json` / `pt.json`,
 * per `opentimbre-i18n`). `@opentimbre/core`'s `t(key: LocaleKey, params?)`
 * (Task 3) and, later, the renderer's `I18nService` both key off this type —
 * defined here so neither package invents its own.
 *
 * No UI has been built yet (that starts in a later task/phase), so there are
 * no real strings to enumerate exhaustively. What follows is a starting set
 * inferred from the IPC surface this same task just translated: the states
 * `ipc.ts` names as data (`PluginState.mappingStatus`, `ChatStatus`,
 * `KeyInfo.source`) are exactly the states a screen will need to label, plus
 * `plugin.notMapped`, which `opentimbre-i18n`'s own worked example already
 * names. Growing this union as real strings land (one task's `en.json`/
 * `pt.json` pair at a time, per that skill's "Adding a string" section) is
 * expected and is not a breaking change for existing keys.
 */
export type LocaleKey =
  | 'plugin.state.ok'
  | 'plugin.state.outdated'
  | 'plugin.state.missing'
  | 'plugin.notMapped'
  | 'chat.status.querying'
  | 'chat.status.validating'
  | 'chat.status.correcting'
  | 'keys.source.app'
  | 'keys.source.environment'
  | 'keys.source.none'
  | 'error.generic'
