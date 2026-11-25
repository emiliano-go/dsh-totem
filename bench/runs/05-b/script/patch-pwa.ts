#!/usr/bin/env bun
/**
 * Make the installed DSH Web shell installable behind Cloudflare Access.
 *
 * Chrome fetches a manifest with credentials omitted unless the manifest link
 * asks for them. Behind Cloudflare Access that turns every manifest request
 * into a login redirect, so the browser never sees a valid manifest and "Add
 * to Home screen" creates a browser shortcut instead of an app. The link's
 * `crossorigin="use-credentials"` makes the fetch carry the Access session
 * cookie; the same cookies then keep the app shell in the standalone window.
 *
 * Also pins the manifest identity and start URL, gives the shell a dark
 * status bar/theme, and relaxes the DSH browser cookie from SameSite=Strict to
 * Lax. A standalone launch is a top-level navigation, and Strict cookies can be
 * withheld when the OS hands the start URL to the browser; Lax still blocks
 * cross-site subresource and POST requests. Idempotent; a dsh upgrade
 * overwrites the installed packages, so rerun this after upgrading.
 *
 * Usage: bun run script/patch-pwa.ts
 *
 * @module dsh-totem/script/patch-pwa
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const dist = join(npmRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist')
const indexFile = join(dist, 'index.html')
const manifestFile = join(dist, 'manifest.webmanifest')
const connectionFile = join(
  npmRoot,
  '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js',
)

if (!existsSync(indexFile) || !existsSync(manifestFile)) {
  console.error(`not found: ${indexFile} or ${manifestFile}`)
  process.exit(1)
}

const indexPath = `${indexFile}.bak-totem-pwa`
const currentIndex = readFileSync(indexFile, 'utf8')
const manifestLink = /<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/u

if (currentIndex.includes('crossorigin="use-credentials"')) {
  console.log('pwa: manifest link already credentialled')
} else if (!manifestLink.test(currentIndex)) {
  console.error(`pwa: manifest link not found in ${indexFile} (dsh frontend changed?)`)
  process.exit(1)
} else {
  copyFileSync(indexFile, indexPath)
  let next = currentIndex.replace(
    manifestLink,
    '<link rel="manifest" href="./manifest.webmanifest" crossorigin="use-credentials" />',
  )
  if (!next.includes('name="theme-color"')) {
    next = next.replace('</head>', '    <meta name="theme-color" content="#0b0f14" />\n  </head>')
  }
  if (!next.includes('apple-mobile-web-app-status-bar-style')) {
    next = next.replace(
      '</head>',
      '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n  </head>',
    )
  }
  writeFileSync(indexFile, next)
  console.log(`pwa: patched ${indexFile}`)
}

const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, unknown>
const nextManifest = {
  ...manifest,
  id: '/',
  start_url: '/',
  scope: '/',
  theme_color: '#0b0f14',
  background_color: '#0b0f14',
  display_override: ['standalone', 'minimal-ui'],
}
if (JSON.stringify(manifest) !== JSON.stringify(nextManifest)) {
  writeFileSync(manifestFile, `${JSON.stringify(nextManifest, null, 2)}\n`)
  console.log(`pwa: updated ${manifestFile}`)
}

if (!existsSync(connectionFile)) {
  console.error(`not found: ${connectionFile}`)
  process.exit(1)
}
const connection = readFileSync(connectionFile, 'utf8')
if (!connection.includes('SameSite=Strict')) {
  console.log('pwa: auth cookie already relaxed')
} else {
  copyFileSync(connectionFile, `${connectionFile}.bak-totem-pwa`)
  writeFileSync(connectionFile, connection.replaceAll('SameSite=Strict', 'SameSite=Lax'))
  console.log(`pwa: relaxed auth cookie in ${connectionFile}`)
}
