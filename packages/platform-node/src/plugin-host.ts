/**
 * Intent-shaped plugin lifecycle for the desktop and CLI. OS adapters choose
 * the candidate family and inject path/process primitives; callers never learn
 * where plugins live or how they are launched.
 */
import type { PluginState, Result } from '@opentimbre/contracts'
import type { AppInfo, PluginSpec } from '@opentimbre/core/src/plugins/types.ts'
import type { PlatformInfo } from '@opentimbre/core/src/ports/platform-info.ts'

export type PluginFileSystem = {
  exists(file: string): Promise<boolean>
  read(file: string): Promise<string>
  mkdir(directory: string): Promise<void>
  copy(source: string, target: string): Promise<void>
  /** Optional source directory for comparing exported mappings during inspect. */
  root?: string
}

export type PluginHost = {
  inspect(spec: PluginSpec): Promise<PluginState>
  launch(spec: PluginSpec): Promise<Result<PluginState>>
  installMapping(spec: PluginSpec, source: string): Promise<PluginState>
}

export type PluginHostOptions = {
  readonly platform: PlatformInfo
  readonly fileSystem: PluginFileSystem
  readonly launchProcess: (executable: string) => Promise<void>
  readonly candidatePlatform: keyof AppInfo['candidates']
}

function mappingPath(platform: PlatformInfo, spec: PluginSpec): string {
  return `${platform.settingsDir(spec.app)}/${spec.app.midiFolder}/${spec.app.mapping}`
}

function candidates(options: PluginHostOptions, spec: PluginSpec): readonly string[] {
  return spec.app.candidates[options.candidatePlatform] ?? []
}

export function createPluginHost(options: PluginHostOptions): PluginHost {
  async function findInstalled(spec: PluginSpec): Promise<string | null> {
    for (const candidate of candidates(options, spec)) {
      if (await options.fileSystem.exists(candidate)) return candidate
    }
    return null
  }

  async function inspect(spec: PluginSpec): Promise<PluginState> {
    const installedPath = await findInstalled(spec)
    const target = mappingPath(options.platform, spec)
    const mappingExists = await options.fileSystem.exists(target)
    let mappingStatus: PluginState['mappingStatus'] = mappingExists ? 'ok' : 'missing'

    if (mappingExists && options.fileSystem.root) {
      const exported = `${options.fileSystem.root}/${spec.app.mapping}`
      if (await options.fileSystem.exists(exported)) {
        mappingStatus = (await options.fileSystem.read(exported)) === (await options.fileSystem.read(target))
          ? 'ok'
          : 'outdated'
      }
    }

    return {
      id: spec.id,
      name: spec.name,
      installed: installedPath !== null,
      path: installedPath,
      running: await options.platform.isRunning(spec.app.process),
      mappingStatus,
    }
  }

  return {
    inspect,
    async launch(spec) {
      const installedPath = await findInstalled(spec)
      if (!installedPath) {
        return { error: `${spec.name} is not installed in a confirmed ${options.candidatePlatform} location.` }
      }
      try {
        await options.launchProcess(installedPath)
        return inspect(spec)
      } catch (error) {
        return { error: `Could not launch ${spec.name}: ${error instanceof Error ? error.message : String(error)}` }
      }
    },
    async installMapping(spec, source) {
      const targetDirectory = `${options.platform.settingsDir(spec.app)}/${spec.app.midiFolder}`
      const target = `${targetDirectory}/${spec.app.mapping}`
      await options.fileSystem.mkdir(targetDirectory)
      await options.fileSystem.copy(source, target)
      return inspect(spec)
    },
  }
}

/** Binds the shared host to Windows descriptor candidates. */
export function createWindowsPluginHost(
  platform: PlatformInfo,
  fileSystem: PluginFileSystem,
  launchProcess: (executable: string) => Promise<void>,
): PluginHost {
  return createPluginHost({ platform, fileSystem, launchProcess, candidatePlatform: 'win32' })
}

/** Binds the shared host to the descriptor's confirmed macOS candidates. */
export function createMacosPluginHost(
  platform: PlatformInfo,
  fileSystem: PluginFileSystem,
  launchProcess: (executable: string) => Promise<void>,
): PluginHost {
  return createPluginHost({ platform, fileSystem, launchProcess, candidatePlatform: 'darwin' })
}
