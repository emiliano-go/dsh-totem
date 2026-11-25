#!/usr/bin/env bun
/**
 * Verify the MCP servers wired by `cordis.patch.yml`.
 *
 * Every check is a real MCP session: connect over stdio, list tools, and (for
 * the search servers) run one live query against the configured SearXNG. A
 * handshake alone proves the process starts; the query proves credentials,
 * network, and parsing. Browser checks are opt-in because they need Chromium
 * and take longer: pass `--browsers`.
 *
 * Run `bun run research:setup` first.
 *
 * @module dsh-totem/script/verify-research
 */
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const searxngUrl = (process.env.SEARXNG_URL ?? 'http://127.0.0.1:8888').replace(/\/$/u, '')
const checkBrowsers = process.argv.includes('--browsers')

interface Spec {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  expected: string[]
  call?: { tool: string; arguments: Record<string, unknown> }
}

const specs: Spec[] = [
  {
    name: 'searxncrawl',
    command: 'uvx',
    args: ['searxncrawl'],
    env: { SEARXNG_URL: searxngUrl },
    expected: ['search', 'crawl', 'crawl_site'],
    call: { tool: 'search', arguments: { query: 'SearXNG JSON API', max_results: 3 } },
  },
  {
    name: 'cluefinch',
    command: 'uvx',
    args: ['--from', 'cluefinch', 'cluefinch'],
    env: { MCP_SEARCH_SEARXNG_URL: searxngUrl },
    expected: ['web_search', 'web_fetch', 'web_links', 'research_collect'],
    call: { tool: 'web_search', arguments: { query: 'SearXNG JSON API', max_results: 3 } },
  },
]

const browserSpecs: Spec[] = [
  {
    name: 'playwright',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest', '--headless', '--isolated', '--browser', 'chromium'],
    expected: ['browser_navigate', 'browser_snapshot', 'browser_click'],
    call: { tool: 'browser_navigate', arguments: { url: 'https://example.com' } },
  },
  {
    name: 'browser-use',
    command: 'uvx',
    args: ['--from', 'browser-use[cli]', 'browser-use', '--cli-mcp'],
    env: { ANONYMIZED_TELEMETRY: 'false', BROWSER_USE_NO_UPDATE_CHECK: '1' },
    expected: ['browser_exec'],
    call: {
      tool: 'browser_exec',
      arguments: { code: 'new_tab("about:blank")\nprint("browser-use ok")' },
    },
  },
]

function text(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' && block !== null && (block as { type?: unknown }).type === 'text')
    .map(block => block.text)
    .join('\n')
}

async function verify(spec: Spec): Promise<string[]> {
  const failures: string[] = []
  const transport = new StdioClientTransport({
    command: spec.command,
    args: spec.args,
    env: { ...process.env, ...spec.env } as Record<string, string>,
    stderr: 'ignore',
  })
  const client = new Client({ name: 'dsh-totem-verify', version: '0.1.0' }, {
    capabilities: {},
    versionNegotiation: { mode: 'auto' },
  })
  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    const names = new Set(tools.map(tool => tool.name))
    const missing = spec.expected.filter(name => !names.has(name))
    if (missing.length > 0) failures.push(`missing tools: ${missing.join(', ')}`)
    console.log(`  ${spec.name}: ${tools.length} tools`)

    if (spec.call !== undefined) {
      const result = await client.callTool({
        name: spec.call.tool,
        arguments: spec.call.arguments,
      }, { timeout: 120_000 })
      const body = text(result.content)
      if (result.isError === true) failures.push(`${spec.call.tool}: ${body.slice(0, 300)}`)
      else console.log(`    ${spec.call.tool} ok (${body.length} chars)`)
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error))
  } finally {
    await client.close().catch(() => {})
  }
  return failures
}

const all = [...specs, ...(checkBrowsers ? browserSpecs : [])]
console.log(`Verifying ${all.length} MCP servers against ${searxngUrl}`)
let failed = 0
for (const spec of all) {
  const failures = await verify(spec)
  if (failures.length > 0) {
    failed += 1
    console.error(`  ✗ ${spec.name}`)
    for (const failure of failures) console.error(`    ${failure}`)
  } else {
    console.log(`  ✓ ${spec.name}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} server(s) failed. Check the SearXNG container, uvx/npx caches, and Chromium.`)
  process.exit(1)
}
console.log('\nAll research MCP servers passed.')
