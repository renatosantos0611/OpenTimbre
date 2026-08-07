/**
 * Build da janela desktop: três bundles esbuild + os estáticos do renderer.
 *
 * A saída de `main` e `preload` é **CJS**, não ESM. O Electron até roda ESM no
 * processo main, mas o preload continua exigindo CJS, e um pé em cada formato
 * custa mais do que rende. Como o esbuild converte ESM na passagem, o `chalk`
 * (que é ESM puro e vem via `trace.ts`) entra no bundle sem drama.
 *
 * `@julusian/midi` fica **external** de propósito: é um addon nativo, e o
 * `pkg-prebuilds` resolve o caminho do `.node` em runtime relativo ao pacote.
 * Bundlar quebraria essa resolução. Os prebuilds são Node-API v7, cuja ABI é
 * estável entre Node e Electron — por isso nenhum rebuild é necessário.
 *
 * Uso: `node scripts/build-desktop.mjs [--watch]`
 */

import { context, build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const saida = path.join(raiz, 'dist')
const watch = process.argv.includes('--watch')

const comum = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
}

const alvos = [
  {
    ...comum,
    entryPoints: [path.join(raiz, 'desktop', 'main.ts')],
    outfile: path.join(saida, 'main.cjs'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron', '@julusian/midi'],
  },
  {
    ...comum,
    entryPoints: [path.join(raiz, 'desktop', 'preload.cts')],
    outfile: path.join(saida, 'preload.cjs'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  },
  {
    ...comum,
    entryPoints: [path.join(raiz, 'desktop', 'renderer', 'app.ts')],
    outfile: path.join(saida, 'renderer', 'app.js'),
    platform: 'browser',
    format: 'iife',
    target: 'chrome120',
  },
]

/**
 * O ícone vai para dentro de `dist/renderer/icon/` por causa da CSP: a página é
 * `file://`, cuja origem é opaca, então `img-src 'self'` só cobre com certeza o
 * que está sob o diretório do próprio `index.html`. O processo main lê o mesmo
 * arquivo dali — uma cópia só, servindo aos dois.
 */
export const ICONE = path.join('renderer', 'icon', 'opentimbre-icon.png')

function copiarEstaticos() {
  const destino = path.join(saida, 'renderer')
  fs.mkdirSync(path.join(destino, 'icon'), { recursive: true })

  for (const arquivo of ['index.html', 'styles.css']) {
    fs.copyFileSync(path.join(raiz, 'desktop', 'renderer', arquivo), path.join(destino, arquivo))
  }
  fs.copyFileSync(path.join(raiz, 'desktop', 'icon', 'opentimbre-icon.png'), path.join(saida, ICONE))
}

copiarEstaticos()

if (watch) {
  for (const alvo of alvos) {
    const ctx = await context(alvo)
    await ctx.watch()
  }
  fs.watch(path.join(raiz, 'desktop', 'renderer'), (_evento, arquivo) => {
    if (arquivo === 'index.html' || arquivo === 'styles.css') copiarEstaticos()
  })
  fs.watch(path.join(raiz, 'desktop', 'icon'), () => copiarEstaticos())
  console.log('build-desktop: observando mudanças. Ctrl+C para sair.')
} else {
  await Promise.all(alvos.map((alvo) => build(alvo)))
}
