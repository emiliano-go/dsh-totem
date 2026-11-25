import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * A linked checkout resolves the host's `@deepseek-ai/*` peers natively through
 * its own node_modules. Point that scope at the running DSH installation so the
 * modules are the host's exact copies (same service instances).
 */
function linkHostScope(): void {
  const scope = 'node_modules/@deepseek-ai'
  if (existsSync(join(scope, 'dsh-tools'))) return
  let npmRoot: string
  try {
    npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
  } catch {
    return
  }
  const host = join(npmRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai')
  if (!existsSync(host)) return
  rmSync(scope, { recursive: true, force: true })
  mkdirSync('node_modules', { recursive: true })
  symlinkSync(host, scope, 'dir')
}

linkHostScope()

await rm('lib', { recursive: true, force: true })

const targets: [{ entry: string; outdir: string }] = [
  { entry: 'src/index.ts', outdir: 'lib' },
  { entry: 'src/tool-fs/index.ts', outdir: 'lib/tool-fs' },
  { entry: 'src/pipelines/index.ts', outdir: 'lib/pipelines' },
  { entry: 'src/compaction/index.ts', outdir: 'lib/compaction' },
]

for (const target of targets) {
  const result = await Bun.build({
    entrypoints: [target.entry],
    outdir: target.outdir,
    target: 'node',
    format: 'esm',
    external: ['@deepseek-ai/*'],
    sourcemap: 'linked',
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    process.exit(1)
  }
}


// Browser half: bundle to CJS, then wrap it in the client module loader's
// lazy-CJS factory format. Platform modules stay external and resolve from the
// shell's shared table at materialization.
const clientStage = 'lib/.client'
const client = await Bun.build({
  entrypoints: ['src/client/index.tsx'],
  outdir: clientStage,
  target: 'browser',
  format: 'cjs',
  jsx: { runtime: 'automatic', development: false },
  external: [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
  ],
})
if (!client.success) {
  for (const log of client.logs) console.error(log)
  process.exit(1)
}
const body = await Bun.file(`${clientStage}/index.js`).text()
await Bun.write('lib/client.js', `window.__ModuleLoader__.load({
  id: "dsh-totem",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${body}
    return module.exports;
  }
});
`)
await rm(clientStage, { recursive: true, force: true })
