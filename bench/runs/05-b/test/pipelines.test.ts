import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditSecurity } from '../src/pipelines/security.ts'
import { auditSite, parsePage } from '../src/pipelines/site.ts'
import { registerPipelineTools } from '../src/pipelines/index.ts'
import type { PipelineDependencies } from '../src/pipelines/types.ts'

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-pipeline-'))
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content, 'utf8')
  }
  return dir
}

function deps(cwd: string, artifactRoot: string): PipelineDependencies {
  return {
    cwd,
    artifactRoot,
    run: async (command) => {
      if (command === 'trivy') return { code: 1, stdout: '', stderr: 'trivy unavailable in test' }
      return { code: 1, stdout: '', stderr: 'not a git repository' }
    },
    readFile: async path => readFile(path, 'utf8'),
    writeFile: async (path, data) => writeFile(path, data, 'utf8'),
    mkdir: async (path) => {
      const { mkdir } = await import('node:fs/promises')
      await mkdir(path, { recursive: true })
    },
    screenshots: false,
    now: () => new Date('2026-11-24T12:00:00Z'),
  }
}

describe('sec_audit', () => {
  test('finds the planted defects and writes evidence artifacts', async () => {
    const target = await fixture({
      'server.ts': [
        'const price = req.body.price',
        'res.redirect(req.query.next || "/")',
        'if (event.type === "checkout.session.completed") await markPaid()',
      ].join('\n'),
      'schema.sql': 'create policy "all" on orders using (true);',
      'secret.ts': 'const key = "sk_live_1234567890123456"',
      '.env.example': 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=fake\n',
    })
    const root = await mkdtemp(join(tmpdir(), 'dsh-pipeline-artifacts-'))
    const result = await auditSecurity(deps(target, root), { target, review: false })
    const ids = result.findings.map(item => item.id)
    expect(result.status).toBe('completed')
    expect(ids).toContain('SEC-CLIENT-PRICE')
    expect(ids).toContain('SEC-OPEN-REDIRECT')
    expect(ids).toContain('SEC-WEBHOOK-UNSIGNED')
    expect(ids).toContain('SEC-RLS-TRUE')
    expect(ids).toContain('SEC-SECRET')
    expect(ids).toContain('SEC-PUBLIC-SERVICE-ROLE')
    expect(result.findings.every(item => item.evidence.length > 0)).toBe(true)
    expect(result.findings.every(item => item.location.includes(':'))).toBe(true)
    expect(result.artifacts.some(item => item.name === 'findings.json')).toBe(true)
    const report = await readFile(join(root, result.run_id, 'report.md'), 'utf8')
    expect(report).toContain('SEC-CLIENT-PRICE')
  })
})

describe('site_audit', () => {
  let server: ReturnType<typeof Bun.serve>
  let html = ''

  beforeAll(() => {
    html = `<!doctype html><html lang="en"><head>
      <title>A useful page about invoices</title>
      <meta name="description" content="A practical guide to sending invoices, tracking payment status, and reconciling the month without spreadsheets.">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="canonical" href="http://127.0.0.1/">
      <script type="application/ld+json">{"@type":"Article"}</script>
      <style>.hero{background:linear-gradient(90deg,#a855f7,#ec4899);box-shadow:0 0 30px #a855f7}</style>
    </head><body>
      <h1>Send an invoice in three minutes</h1>
      <img src="/one.png"><img src="/two.png" alt="Invoice preview">
      <a href="/pricing">Pricing</a><a href="https://example.com">Example</a>
      <p>${'This page explains the workflow in plain language for a small business owner who needs a reliable invoice. '.repeat(15)}</p>
      <nav>✨ Features 🚀</nav>
    </body></html>`
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname
        if (path === '/') return new Response(html, { headers: { 'content-type': 'text/html' } })
        return new Response('not found', { status: 404 })
      },
    })
  })

  afterAll(() => {
    server.stop(true)
  })

  test('parses metadata and counts the missing alt text', () => {
    const parsed = parsePage(html, 'http://127.0.0.1/')
    expect(parsed.title).toBe('A useful page about invoices')
    expect(parsed.h1).toBe(1)
    expect(parsed.images).toBe(2)
    expect(parsed.missingAlt).toBe(1)
    expect(parsed.viewport).toBe(true)
    expect(parsed.structuredData).toBe(1)
  })

  test('audits a live page and keeps a page scorecard', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-site-artifacts-'))
    const local = deps(process.cwd(), root)
    local.allowPrivate = true
    const result = await auditSite(local, { urls: [`http://127.0.0.1:${server.port}/`], screenshots: false, review: false })
    expect(result.status).toBe('completed')
    expect(result.pages).toHaveLength(1)
    expect(result.pages?.[0]?.title).toContain('invoices')
    expect(result.findings.some(item => item.id === 'SEO-IMG-ALT')).toBe(true)
    expect(result.findings.some(item => item.id === 'SLOP-GRADIENT')).toBe(true)
    expect(result.findings.some(item => item.id === 'SEO-THIN')).toBe(false)
    expect(result.artifacts.some(item => item.name === 'pages.json')).toBe(true)
  })
})

describe('pipeline tool registration', () => {
  test('mounts sec_audit and site_audit with the expected schemas', async () => {
    const target = await fixture({
      'server.ts': 'const price = req.body.price\n',
    })
    const root = await mkdtemp(join(tmpdir(), 'dsh-pipeline-register-'))
    const tools: any[] = []
    const ctx = {
      tools: { register: (tool: any) => { tools.push(tool); return () => {} } },
      workingDirectory: { ensure: async () => target },
      llm: { stream: async function* () {} },
    }
    registerPipelineTools(ctx as any, {
      provider: '', model: '', reviewProvider: '', reviewModel: '',
      maxTokens: 1000, timeoutMs: 1000, screenshots: false, allowPrivate: true, artifactDir: root,
    })
    expect(tools.map(tool => tool.name)).toEqual(['sec_audit', 'site_audit', 'pipeline_detail'])
    const sec = tools.find(tool => tool.name === 'sec_audit')
    expect(sec.parameters.properties.target.type).toBe('string')
    expect(sec.parameters.properties.review.type).toBe('boolean')
  })
})
