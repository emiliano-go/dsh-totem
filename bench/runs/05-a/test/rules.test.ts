import { describe, expect, test } from 'bun:test'
import { addedLines, changePath, isGeneratedPath, isTestPath, touchesDependency, verifyExtraChanges, RULES } from '../src/rules.ts'
import type { VerifyChange } from '../src/verify.ts'

function edit(path: string, added: string[], removed: string[] = []): VerifyChange {
  const diff = [
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@ -1,1 +1,1 @@',
    ...removed.map(line => `-${line}`),
    ...added.map(line => `+${line}`),
  ].join('\n')
  return { tool: 'edit', input: `filePath=${path}`, output: 'ok', diff, paths: [path] }
}

const rules = (changes: VerifyChange[], options = {}) => verifyExtraChanges(changes, options).map(finding => finding.rule)

describe('rule pack', () => {
  test('every rule has a unique id, a severity, and a description', () => {
    const ids = RULES.map(rule => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const rule of RULES) {
      expect(['high', 'medium']).toContain(rule.severity)
      expect(rule.description.length).toBeGreaterThan(10)
    }
  })

  test('merge markers left in a file are high severity', () => {
    const findings = verifyExtraChanges([edit('src/a.ts', ['<<<<<<< HEAD', 'const a = 1'])])
    expect(findings.map(finding => finding.rule)).toContain('conflict-markers')
    expect(findings[0].severity).toBe('high')
  })

  test('a debugger call added by the change is caught', () => {
    expect(rules([edit('src/a.py', ['    breakpoint()'])])).toContain('debug-breakpoint')
    expect(rules([edit('src/a.py', ['    pdb.set_trace()'])])).toContain('debug-breakpoint')
    expect(rules([edit('src/a.ts', ['  debugger;'])])).toContain('debug-breakpoint')
  })

  test('pre-existing debuggers are not blamed when a diff is present', () => {
    const change: VerifyChange = {
      tool: 'edit',
      input: 'breakpoint()\nfilePath=src/a.py',
      output: 'ok',
      diff: '@@ -1,1 +1,1 @@\n-old\n+const a = 1',
      paths: ['src/a.py'],
    }
    expect(rules([change])).not.toContain('debug-breakpoint')
  })

  test('writing a credential file is caught, a template is not', () => {
    expect(rules([{ tool: 'write', input: 'KEY=1', output: 'ok', paths: ['.env'] }])).toContain('credential-file')
    expect(rules([{ tool: 'write', input: 'KEY=', output: 'ok', paths: ['.env.example'] }])).not.toContain('credential-file')
    expect(rules([{ tool: 'write', input: 'k', output: 'ok', paths: ['certs/server.pem'] }])).toContain('credential-file')
    // A patch that creates the file is the same risk as a write.
    expect(rules([{ tool: 'apply_patch', input: '', output: '', diff: '--- /dev/null\n+++ b/.env\n@@ -0,0 +1 @@\n+KEY=1', paths: ['.env'] }]))
      .toContain('credential-file')
    // Deleting it is not.
    expect(rules([{ tool: 'apply_patch', input: '', output: '', diff: '--- a/.env\n+++ /dev/null\n@@ -1 +0,0 @@\n-KEY=1', paths: ['.env'] }]))
      .not.toContain('credential-file')
  })

  test('a write that escapes the project is refused, a sibling name is not', () => {
    expect(rules([edit('../../etc/passwd', ['x'])])).toContain('path-escape')
    const root = '/work/project'
    expect(rules([edit('/etc/hosts', ['x'])], { root })).toContain('path-escape')
    expect(rules([edit('src/a.ts', ['x'])], { root })).not.toContain('path-escape')
    // `..` inside a file name is not a traversal.
    expect(rules([edit('src/a..b.ts', ['x'])], { root })).not.toContain('path-escape')
  })

  test('a bare except is medium: suspicious, not blocking', () => {
    const findings = verifyExtraChanges([edit('src/a.py', ['    except:'])])
    const finding = findings.find(entry => entry.rule === 'bare-except')
    expect(finding?.severity).toBe('medium')
  })

  test('assertion-free tests are caught only inside test paths', () => {
    expect(rules([edit('tests/test_a.py', ['    assert True'])])).toContain('assertion-free-test')
    expect(rules([edit('src/a.py', ['    assert True'])])).not.toContain('assertion-free-test')
  })

  test('a fixed wait in a test is caught, a tick is not', () => {
    expect(rules([edit('tests/test_a.py', ['    time.sleep(1)'])])).toContain('test-sleep')
    expect(rules([edit('src/a.py', ['    time.sleep(1)'])])).not.toContain('test-sleep')
    expect(rules([edit('tests/a.test.ts', ['  await new Promise(resolve => setTimeout(resolve, 0))'])]))
      .not.toContain('test-sleep')
    expect(rules([edit('tests/a.test.ts', ['  await new Promise(resolve => setTimeout(resolve, 250))'])]))
      .toContain('test-sleep')
  })

  test('generated and vendored files are not judged as source', () => {
    expect(isGeneratedPath('lib/index.js.map')).toBe(true)
    expect(isGeneratedPath('dist/bundle.js')).toBe(true)
    expect(isGeneratedPath('node_modules/x/index.js')).toBe(true)
    expect(isGeneratedPath('bun.lock')).toBe(true)
    expect(isGeneratedPath('src/index.ts')).toBe(false)
    expect(rules([edit('lib/index.js.map', ['<<<<<<< HEAD'])])).toEqual([])
  })

  test('an added binary is flagged', () => {
    const change: VerifyChange = {
      tool: 'write', input: '', output: 'ok', paths: ['assets/logo.png'],
      diff: 'Binary files a/assets/logo.png and b/assets/logo.png differ',
    }
    expect(rules([change])).toContain('binary-add')
  })

  test('dependency drift needs the manifest without a lockfile in the same change set', () => {
    const manifest: VerifyChange = { tool: 'edit', input: 'filePath=package.json', output: 'ok', paths: ['package.json'] }
    const lock: VerifyChange = { tool: 'edit', input: 'filePath=bun.lock', output: 'ok', paths: ['bun.lock'] }
    expect(rules([{ ...manifest, diff: '--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n-  "zod": "3.0.0",\n+  "zod": "3.1.0",', input: '' }]))
      .toContain('dependency-drift')
    // Metadata-only manifest edits do not need a lockfile.
    expect(rules([{ ...manifest, diff: '--- a/package.json\n+++ b/package.json\n@@ -1 +1 @@\n-  "files": ["lib"],\n+  "files": ["lib", "README.md"],', input: '' }]))
      .not.toContain('dependency-drift')
    expect(rules([manifest, lock])).not.toContain('dependency-drift')
    expect(rules([{ tool: 'edit', input: 'filePath=docs/a.md', output: 'ok', paths: ['docs/a.md'] }]))
      .not.toContain('dependency-drift')
  })

  test('a clean change produces nothing', () => {
    expect(verifyExtraChanges([
      edit('src/queue.py', ['    return retry(attempt + 1)'], ['    return retry(attempt)']),
      edit('tests/test_queue.py', ['    assert client.calls == 3']),
    ])).toEqual([])
  })

  test('rules can be disabled by id', () => {
    expect(verifyExtraChanges([edit('src/a.ts', ['<<<<<<< HEAD'])], { disable: ['conflict-markers'] })).toEqual([])
  })
})

describe('change helpers', () => {
  test('the path comes from explicit paths or the tool argument', () => {
    expect(changePath({ tool: 'edit', input: 'x', output: '', paths: ['a.ts'] })).toBe('a.ts')
    expect(changePath({ tool: 'edit', input: 'filePath="src/a.ts" more', output: '' })).toBe('src/a.ts')
    expect(changePath({ tool: 'edit', input: 'file_path=src/b.py', output: '' })).toBe('src/b.py')
    expect(changePath({ tool: 'edit', input: 'nothing', output: '' })).toBe('')
  })

  test('added lines come from the diff, never from the whole payload', () => {
    expect(addedLines({
      tool: 'edit', input: 'old\nnew', output: '',
      diff: '@@ -1 +1 @@\n-old\n+new',
    })).toEqual(['new'])
    expect(addedLines({ tool: 'write', input: 'a\nb', output: '' })).toEqual(['a', 'b'])
  })

  test('test paths are recognised by directory and file name', () => {
    expect(isTestPath('tests/a.py')).toBe(true)
    expect(isTestPath('src/test_a.py')).toBe(true)
    expect(isTestPath('src/a.spec.ts')).toBe(true)
    expect(isTestPath('src/a.ts')).toBe(false)
  })
})

describe('dependency drift detection', () => {
  test('a versioned dependency line counts, metadata does not', () => {
    expect(touchesDependency(['  "zod": "3.1.0",'])).toBe(true)
    expect(touchesDependency(['  "zod": "^3.1.0",'])).toBe(true)
    expect(touchesDependency(['requests>=2.0'])).toBe(true)
    expect(touchesDependency(['requests = "^2.0"'])).toBe(true)
    expect(touchesDependency(['  "version": "0.2.0",'])).toBe(false)
    expect(touchesDependency(['  "files": ["lib"],'])).toBe(false)
    expect(touchesDependency(['  "description": "2 cool"'])).toBe(false)
  })
})

describe('public API removal', () => {
  test('a removed export is flagged, a kept or renamed one is not', () => {
    const removedExport = verifyExtraChanges([edit('src/api.ts', ['export const b = 2'], ['export const a = 1', 'export const b = 2'])])
    // `b` survives (removed and re-added), `a` is gone.
    expect(removedExport.map(finding => finding.rule)).toContain('public-api-removed')
    // The rule id itself contains a "b"; match the symbol list instead.
    expect(removedExport[0].detail).toContain('symbol(s): a')
    expect(removedExport[0].detail).not.toContain(', b')

    const changedSignature = verifyExtraChanges([edit('src/api.ts', ['export function parse(x: number) {'], ['export function parse(x: string) {'])])
    expect(changedSignature.map(finding => finding.rule)).not.toContain('public-api-removed')

    const privateChange = verifyExtraChanges([edit('src/api.ts', ['function helper2() {'], ['function helper() {'])])
    expect(privateChange.map(finding => finding.rule)).not.toContain('public-api-removed')
  })
})
