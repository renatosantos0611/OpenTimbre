import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import type { AppInfo, PluginSpec } from '@opentimbre/core/src/plugins/types.ts'
import { CATALOG } from '@opentimbre/core/src/plugins/catalog.ts'
import { createMacosPluginHost, createPluginHost, type PluginFileSystem } from './plugin-host.ts'

const appInfo: AppInfo = {
  candidates: { win32: ['C:\\Program Files\\Fixture\\Fixture.exe'] },
  process: 'Fixture.exe',
  settings: 'Fixture',
  midiFolder: 'MIDI',
  mapping: 'fixture.xml',
}
function fixtureSpec(root: string): PluginSpec {
  return {
    id: 'fixture',
    name: 'Fixture',
    app: { ...appInfo, candidates: { win32: [path.join(root, 'Fixture.exe')] } },
  } as unknown as PluginSpec
}

let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  roots = []
})

async function fixtureFs(root: string): Promise<PluginFileSystem> {
  return {
    exists: async (file) => {
      try {
        await readFile(file)
        return true
      } catch {
        return false
      }
    },
    read: (file) => readFile(file, 'utf8'),
    mkdir: (dir) => import('node:fs/promises').then(({ mkdir }) => mkdir(dir, { recursive: true })).then(() => undefined),
    copy: (source, target) => import('node:fs/promises').then(({ copyFile }) => copyFile(source, target)),
    root,
  }
}

test('PluginHost inspects installation, running state, and mapping status', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opentimbre-host-'))
  roots.push(root)
  const spec = fixtureSpec(root)
  const platform = { isRunning: async () => false, settingsDir: () => root }
  const executable = path.join(root, 'Fixture.exe')
  const mapping = path.join(root, 'MIDI', 'fixture.xml')
  await writeFile(executable, 'binary')
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path.dirname(mapping), { recursive: true }))
  await writeFile(mapping, 'mapping')
  const host = createPluginHost({ platform, fileSystem: await fixtureFs(root), launchProcess: async () => {}, candidatePlatform: 'win32' })

  const state = await host.inspect(spec)

  assert.equal(state.installed, true)
  assert.equal(state.path, executable)
  assert.equal(state.running, false)
  assert.equal(state.mappingStatus, 'ok')
})

test('PluginHost installs a mapping into the platform settings folder', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opentimbre-host-'))
  roots.push(root)
  const spec = fixtureSpec(root)
  const source = path.join(root, 'source.xml')
  await writeFile(source, 'mapping')
  const host = createPluginHost({ platform: { isRunning: async () => false, settingsDir: () => root }, fileSystem: await fixtureFs(root), launchProcess: async () => {}, candidatePlatform: 'win32' })

  const state = await host.installMapping(spec, source)

  assert.equal(state.mappingStatus, 'ok')
  assert.equal(await readFile(path.join(root, 'MIDI', 'fixture.xml'), 'utf8'), 'mapping')
})

test('PluginHost.launch uses only a confirmed candidate and reports launch failures', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opentimbre-host-'))
  roots.push(root)
  const spec = fixtureSpec(root)
  const attempted: string[] = []
  await writeFile(path.join(root, 'Fixture.exe'), 'binary')
  const host = createPluginHost({
    platform: { isRunning: async () => false, settingsDir: () => root },
    fileSystem: await fixtureFs(root),
    launchProcess: async (executable) => {
      attempted.push(executable)
      throw new Error('access denied')
    },
    candidatePlatform: 'win32',
  })

  const result = await host.launch(spec)

  assert.deepEqual(attempted, [path.join(root, 'Fixture.exe')])
  assert.match((result as { error: string }).error, /access denied/)
})

test('PluginHost does not invent a macOS candidate when the descriptor has none', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opentimbre-host-'))
  roots.push(root)
  const spec = { ...fixtureSpec(root), app: { ...appInfo, candidates: {} } } as unknown as PluginSpec
  const host = createPluginHost({
    platform: { isRunning: async () => false, settingsDir: () => root },
    fileSystem: await fixtureFs(root),
    launchProcess: async () => {},
    candidatePlatform: 'darwin',
  })

  const state = await host.inspect(spec)

  assert.equal(state.installed, false)
  assert.equal(state.path, null)
})

test('real catalog entries keep their confirmed platform boundaries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opentimbre-host-'))
  roots.push(root)
  const fileSystem = await fixtureFs(root)
  const host = createMacosPluginHost(
    { isRunning: async () => false, settingsDir: () => root },
    fileSystem,
    async () => {},
  )

  for (const entry of CATALOG) {
    assert.equal(entry.app.candidates.darwin, undefined, `${entry.id} must not invent a macOS path`)
    const state = await host.inspect(entry)
    assert.equal(state.installed, false)
    assert.equal(state.path, null)
  }
})
