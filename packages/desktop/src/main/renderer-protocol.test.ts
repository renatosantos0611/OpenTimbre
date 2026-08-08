import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { resolveRendererAsset } from './renderer-protocol.ts'

const ROOT = path.resolve('/renderer-bundle')

function file(...segments: string[]): string {
  return path.join(ROOT, ...segments)
}

test('root path and /index.html both serve the bundle entry document', () => {
  const root = resolveRendererAsset('/', ROOT)
  const explicit = resolveRendererAsset('/index.html', ROOT)
  assert.ok(root, 'entry document unreachable at / — the window would stay blank')
  assert.ok(explicit, 'entry document unreachable at /index.html — the window would stay blank')
  assert.equal(root.file, file('index.html'))
  assert.equal(root.contentType, 'text/html', 'entry served without an html content type — the browser would not render it')
  assert.equal(explicit.file, file('index.html'))
  assert.equal(explicit.contentType, 'text/html', 'entry served without an html content type — the browser would not render it')
})

test('paths escaping the renderer root are rejected', () => {
  const escapes = [
    '/..',
    '/../index.html',
    '/assets/../../secrets.json',
    '/%2e%2e/index.html',
    '/%2e%2e%2findex.html',
    '/assets/%2e%2e/%2e%2e/secrets.json',
    '/..\\..\\secrets.json',
    '/%5c..%5csecrets.json',
    '..',
  ]
  for (const pathname of escapes) {
    assert.equal(resolveRendererAsset(pathname, ROOT), null, `${pathname} escaped the renderer root — path traversal`)
  }
})

test('unknown extensions and extension-less files are rejected', () => {
  for (const pathname of ['/notes.txt', '/bundle', '/data.map', '/index.html.bak']) {
    assert.equal(resolveRendererAsset(pathname, ROOT), null, `${pathname} served despite an unknown extension — only bundled asset types may leave the renderer dir`)
  }
})

test('every known asset extension maps to its content type', () => {
  const catalog: Array<[string, string]> = [
    ['/app.html', 'text/html'],
    ['/main-HD27F.js', 'text/javascript'],
    ['/MAIN.JS', 'text/javascript'],
    ['/styles.css', 'text/css'],
    ['/assets/settings.json', 'application/json'],
    ['/media/icon.svg', 'image/svg+xml'],
    ['/media/splash.png', 'image/png'],
    ['/favicon.ico', 'image/x-icon'],
    ['/fonts/barlow.woff', 'font/woff'],
    ['/fonts/barlow.woff2', 'font/woff2'],
    ['/fonts/barlow.ttf', 'font/ttf'],
  ]
  for (const [pathname, contentType] of catalog) {
    const asset = resolveRendererAsset(pathname, ROOT)
    assert.ok(asset, `${pathname} dropped despite a known extension — the asset would 404 in the renderer`)
    assert.equal(asset.contentType, contentType, `${pathname} served with the wrong content type — strict MIME checking would block it`)
    assert.equal(asset.file, file(pathname.slice(1)), `${pathname} resolved to a different location than requested — path tampering`)
  }
})

test('file paths with spaces survive intact for file-URL encoding downstream', () => {
  const spacedRoot = path.resolve('/program files/opentimbre')
  const asset = resolveRendererAsset('/media/drum kit sample.png', spacedRoot)
  assert.ok(asset, 'asset with spaces dropped — it would 404 in the renderer')
  assert.equal(asset.file, path.join(spacedRoot, 'media', 'drum kit sample.png'))
})

test('malformed percent-encoding and control bytes are rejected', () => {
  assert.equal(resolveRendererAsset('/%zz.png', ROOT), null, 'malformed percent-encoding accepted — ambiguous path interpretation surface')
  assert.equal(resolveRendererAsset('/%00main.js', ROOT), null, 'null byte accepted — path truncation risk')
})
