import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

function text(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: 'text'; text: string } =>
      typeof block === 'object' && block !== null && (block as any).type === 'text')
    .map(block => block.text)
    .join('')
}

test('totem MCP create/search round trip', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-'))
  const transport = new StdioClientTransport({ command: 'totem-mcp', args: [] })
  const client = new Client({ name: 'dsh-totem-test', version: '0.1.0' }, {
    capabilities: {}, versionNegotiation: { mode: 'auto' },
  })
  await client.connect(transport)
  try {
    await client.callTool({ name: 'totem_init_tool', arguments: { project } }, { timeout: 30000 })
    const created = await client.callTool({
      name: 'memory_create_tool',
      arguments: {
        type: 'gotcha',
        title: 'dsh-totem smoke',
        statement: 'The dsh-totem test marker is zebra-42.',
        tags: ['smoke'],
        project,
      },
    }, { timeout: 30000 })
    expect(created.isError).toBe(false)
    const found = await client.callTool({
      name: 'memory_search_tool',
      arguments: { query: 'zebra-42', project },
    }, { timeout: 30000 })
    expect(found.isError).toBe(false)
    expect(text(found.content)).toContain('zebra-42')
  } finally {
    await client.close()
  }
}, 60000)
