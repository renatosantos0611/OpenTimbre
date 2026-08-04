/**
 * Owns the two OS-specific facts the core needs about the host machine: is a
 * given plugin process running, and where does its settings file live.
 * `platform-node` implements one `PlatformInfo` per OS (per
 * `opentimbre-cross-platform`); the core only ever sees these two methods.
 *
 * `appInfo` is `unknown` here on purpose — the real shape (the plugin's app
 * name, its settings-file naming convention) arrives with the plugin-spec
 * task. Committing to a shape now would be inventing it ahead of that task.
 */
export type PlatformInfo = {
  isRunning(processName: string): Promise<boolean>
  settingsDir(appInfo: unknown): string
}
