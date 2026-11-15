import { expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const COMMAND = process.env.TOTEM_MCP_COMMAND ?? 'totem-mcp'

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
  const transport = new StdioClientTransport({ command: COMMAND, args: [] })
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

test('totem MCP check backed verification and audit', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-totem-check-'))
  const transport = new StdioClientTransport({ command: COMMAND, args: [] })
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
        title: 'check gate smoke',
        statement: 'Check backed verification marker is otter-17.',
        tags: ['smoke'],
        project,
      },
    }, { timeout: 30000 })
    expect(created.isError).toBe(false)
    const item = JSON.parse(text(created.content))

    const recorded = await client.callTool({
      name: 'memory_check_record_tool',
      arguments: {
        id: item.id,
        name: 'pytest tests/test_smoke.py',
        command: 'pytest tests/test_smoke.py',
        exit_code: 0,
        output: '1 passed',
        project,
      },
    }, { timeout: 30000 })
    expect(recorded.isError).toBe(false)
    const check = JSON.parse(text(recorded.content))

    const verified = await client.callTool({
      name: 'memory_verify_tool',
      arguments: { id: item.id, check_id: check.id, project },
    }, { timeout: 30000 })
    expect(verified.isError).toBe(false)
    expect(JSON.parse(text(verified.content)).verificationMode).toBe('check')

    const audit = await client.callTool({
      name: 'memory_audit_tool',
      arguments: { project },
    }, { timeout: 30000 })
    expect(audit.isError).toBe(false)
    expect(JSON.parse(text(audit.content)).ok).toBe(true)
  } finally {
    await client.close()
  }
}, 60000)
