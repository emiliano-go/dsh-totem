#!/usr/bin/env bun
/**
 * Route the Artifacts page's editor link through the DSH origin.
 *
 * dsh-claude-artifacts returns the editor's own absolute URL
 * (`http://<host>:4720/...`). A Cloudflare-tunneled DSH domain does not expose
 * that port, so the plugin now serves the same path at `/design/...`; opening
 * the pathname keeps the owner token and uses that proxy.
 *
 * Idempotent; a plugin update overwrites the installed bundle, so rerun this
 * after upgrading dsh-claude-artifacts.
 *
 * Usage: bun run script/patch-design-links.ts
 *
 * @module dsh-totem/script/patch-design-links
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const profile = process.env.DSH_TOTEM_PROFILE?.trim() || 'web-totem'
const file = join(
  homedir(),
  '.dsh',
  'profiles',
  profile,
  'node_modules',
  'dsh-claude-artifacts',
  'lib',
  'index.js',
)

if (!existsSync(file)) {
  console.error(`not found: ${file}`)
  process.exit(1)
}

const source = readFileSync(file, 'utf8')
if (source.includes('const at = new URL(out.remoteUrl)')) {
  console.log('design-links: already patched')
  process.exit(0)
}

const before = `  if (!remoteHost) return { url: out.url, reused };
  return typeof out.remoteUrl === "string" ? { url: out.remoteUrl, reused } : { url: out.url, reused, remote: "unsupported" };`
const after = `  if (!remoteHost) return { url: out.url, reused };
  if (typeof out.remoteUrl === "string") {
    const at = new URL(out.remoteUrl);
    return { url: at.pathname + at.search, reused };
  }
  return { url: out.url, reused, remote: "unsupported" };`

if (!source.includes(before)) {
  console.error('design-links: remote-URL block not found (plugin changed?)')
  process.exit(1)
}

copyFileSync(file, `${file}.bak-totem-design`)
writeFileSync(file, source.replace(before, after))
console.log(`design-links: patched ${file}`)
