/**
 * Owns the two OS-specific facts the core needs about the host machine: is a
 * given plugin process running, and where does its settings file live.
 * `platform-node` implements one `PlatformInfo` per OS (per
 * `opentimbre-cross-platform`); the core only ever sees these two methods.
 *
 * `appInfo` was `unknown` here on purpose while `AppInfo` didn't exist yet —
 * now that the plugin-spec task defined it, the parameter is typed for real.
 */
import type { AppInfo } from '../plugins/types.ts'

export type PlatformInfo = {
  isRunning(processName: string): Promise<boolean>
  settingsDir(appInfo: AppInfo): string
}
