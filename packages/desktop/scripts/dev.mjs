import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const build = spawn(npm, ['run', 'build', '-w', '@opentimbre/desktop'], {
  cwd: packageDir,
  stdio: 'inherit',
})

build.on('exit', (code, signal) => {
  if (code !== 0 || signal) process.exit(code ?? 1)
  const electron = spawn(npm, ['run', 'start', '-w', '@opentimbre/desktop'], {
    cwd: packageDir,
    stdio: 'inherit',
  })
  electron.on('exit', (electronCode) => process.exit(electronCode ?? 1))
})
