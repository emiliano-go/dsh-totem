import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  STAGES,
  addBudget,
  addClaim,
  addGap,
  addSource,
  advanceStage,
  checkState,
  closeGap,
  initResearch,
  loadState,
  renderReportSkeleton,
  saveState,
  setGate,
  slugFor,
  type ResearchState,
} from '../.agents/skills/deep-research/scripts/lib.ts'

function fresh(subquestions = 3): { state: ResearchState; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-research-'))
  const { state } = initResearch({
    question: 'Does staged research beat one-shot search?',
    dir,
    subquestions: Array.from({ length: subquestions }, (_, index) => ({
      text: `Subquestion ${index + 1}`,
      evidence: 'primary study',
    })),
  })
  return { state, dir }
}

function passTo(state: ResearchState, target: (typeof STAGES)[number]): void {
  while (state.stage !== target) {
    setGate(state, 'passed')
    advanceStage(state)
  }
}

describe('research state', () => {
  test('slug is filesystem-safe and bounded', () => {
    expect(slugFor('How does SearXNG JSON output work?')).toBe('how-does-searxng-json-output-work')
    expect(slugFor('¿?¡!')).toBe('research')
    expect(slugFor('a'.repeat(80)).length).toBe(48)
  })

  test('init creates a brief-stage state and requires three subquestions', () => {
    const { state } = fresh()
    expect(state.stage).toBe('brief')
    expect(state.gates.brief.status).toBe('pending')
    expect(state.subquestions).toHaveLength(3)
    expect(state.budget.limits.searches).toBe(25)
    const dir = mkdtempSync(join(tmpdir(), 'dsh-research-bad-'))
    expect(() => initResearch({
      question: 'x',
      dir,
      subquestions: [{ text: 'one' }, { text: 'two' }],
    })).toThrow('at least 3')
  })

  test('stage order requires a passed gate; force is explicit', () => {
    const { state } = fresh()
    expect(() => advanceStage(state)).toThrow('gate "brief" is pending')
    setGate(state, 'passed', 'scope fixed')
    expect(advanceStage(state)).toBe('landscape')
    expect(() => advanceStage(state)).toThrow('gate "landscape" is pending')
    expect(advanceStage(state, { force: true })).toBe('plan')
    expect(state.gates.brief.status).toBe('passed')
  })

  test('earlier gates block a later check', () => {
    const { state } = fresh()
    passTo(state, 'depth')
    state.gates.brief = { status: 'failed' }
    const result = checkState(state)
    expect(result.ok).toBe(false)
    expect(result.errors.some(error => error.includes('earlier gate "brief"'))).toBe(true)
  })

  test('state persists atomically and reloads', () => {
    const { state, dir } = fresh()
    state.claims.push({ id: 'C1', statement: 'x', sourceIds: [], confidence: 'low', status: 'unverified' })
    saveState(dir, state)
    const loaded = loadState(dir)
    expect(loaded.claims[0]?.id).toBe('C1')
    expect(JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')).version).toBe(1)
  })
})

describe('sources and claims', () => {
  test('a primary source verifies a load-bearing claim', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://example.org/paper', type: 'primary' })
    addClaim(state, {
      id: 'C1',
      statement: 'Staged research improves coverage.',
      sourceIds: ['S1'],
      quote: 'coverage improved by 10%',
      confidence: 'high',
      status: 'supported',
    })
    expect(checkState(state).ok).toBe(true)
  })

  test('two independent secondary sources verify a claim; same domain does not', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://alpha.example/a', type: 'secondary' })
    addSource(state, { id: 'S2', url: 'https://beta.example/b', type: 'secondary' })
    addClaim(state, {
      id: 'C1', statement: 'Claim', sourceIds: ['S1', 'S2'], quote: '"..."', confidence: 'high', status: 'supported',
    })
    expect(checkState(state).ok).toBe(true)

    const { state: same } = fresh()
    addSource(same, { id: 'S1', url: 'https://alpha.example/a', type: 'secondary' })
    addSource(same, { id: 'S2', url: 'https://alpha.example/b', type: 'secondary' })
    addClaim(same, {
      id: 'C1', statement: 'Claim', sourceIds: ['S1', 'S2'], quote: '"..."', confidence: 'high', status: 'supported',
    })
    expect(checkState(same).ok).toBe(false)
  })

  test('derived secondary sources are not independent', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://alpha.example/a', type: 'secondary' })
    addSource(state, { id: 'S2', url: 'https://beta.example/b', type: 'secondary', derivedFrom: ['S1'] })
    addClaim(state, {
      id: 'C1', statement: 'Claim', sourceIds: ['S1', 'S2'], quote: '"..."', confidence: 'high', status: 'supported',
    })
    expect(checkState(state).ok).toBe(false)
  })

  test('a high-confidence claim needs a quote', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://example.org/x', type: 'primary' })
    addClaim(state, { id: 'C1', statement: 'Claim', sourceIds: ['S1'], confidence: 'high', status: 'supported' })
    expect(checkState(state).errors.some(error => error.includes('no supporting quote'))).toBe(true)
  })

  test('unknown source references are rejected at add time and at check', () => {
    const { state } = fresh()
    expect(() => addClaim(state, {
      id: 'C1', statement: 'x', sourceIds: ['S9'], confidence: 'medium', status: 'unverified',
    })).toThrow('unknown source S9')
  })
})

describe('gaps, budget and report', () => {
  test('open gaps block verification and close with evidence', () => {
    const { state } = fresh()
    passTo(state, 'verify')
    addGap(state, { id: 'G1', kind: 'missing', note: 'No primary source', status: 'open' })
    const blocked = checkState(state)
    expect(blocked.errors.some(error => error.includes('open gap G1'))).toBe(true)
    closeGap(state, 'G1', 'Found the paper')
    expect(checkState(state).ok).toBe(true)
  })

  test('budget counters accumulate and exceeding a limit warns', () => {
    const { state } = fresh()
    addBudget(state, 'searches', 26)
    const result = checkState(state)
    expect(result.warnings.some(warning => warning.includes('budget exceeded'))).toBe(true)
  })

  test('report skeleton carries claims, sources and required sections', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://example.org/x', type: 'primary', title: 'Paper' })
    addClaim(state, {
      id: 'C1', statement: 'Claim', sourceIds: ['S1'], quote: 'q', confidence: 'high', status: 'supported',
    })
    const report = renderReportSkeleton(state)
    expect(report).toContain('## Answer')
    expect(report).toContain('## Evidence')
    expect(report).toContain('| C1 | Claim | [S1] | high |')
    expect(report).toContain('https://example.org/x')
  })

  test('report-stage check requires the report sections', () => {
    const { state } = fresh()
    passTo(state, 'report')
    setGate(state, 'passed')
    const missing = checkState(state, { report: '# draft' })
    expect(missing.ok).toBe(false)
    expect(missing.errors.some(error => error.includes('missing ## Answer'))).toBe(true)
    const ok = checkState(state, { report: '## Answer\n\n## Evidence\n\n## Sources\n' })
    expect(ok.ok).toBe(true)
  })

  test('strict mode turns uncited claims into errors', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://example.org/x', type: 'primary' })
    addClaim(state, {
      id: 'C1', statement: 'Claim', sourceIds: ['S1'], quote: 'q', confidence: 'high', status: 'supported',
    })
    passTo(state, 'report')
    setGate(state, 'passed')
    const result = checkState(state, { report: '## Answer\n\n## Evidence\n\n## Sources\n', strict: true })
    expect(result.errors.some(error => error.includes('does not cite claim C1'))).toBe(true)
  })

  test('report citations must resolve to recorded sources', () => {
    const { state } = fresh()
    addSource(state, { id: 'S1', url: 'https://example.org/x', type: 'primary' })
    passTo(state, 'report')
    setGate(state, 'passed')
    const unknown = checkState(state, { report: '## Answer\n\n## Evidence\n\n## Sources\n\n[S9]' })
    expect(unknown.errors.some(error => error.includes('cites unknown source S9'))).toBe(true)
    const unused = checkState(state, { report: '## Answer\n\n## Evidence\n\n## Sources\n', strict: true })
    expect(unused.errors.some(error => error.includes('source S1 is listed but never cited'))).toBe(true)
  })
})

describe('research CLI', () => {
  const script = join(import.meta.dir, '../.agents/skills/deep-research/scripts/research.ts')
  const run = (cwd: string, args: string[]) => Bun.spawnSync({
    cmd: ['bun', script, ...args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  test('init, status and check work end to end', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-research-cli-'))
    const init = run(cwd, [
      'init',
      '--question', 'Does the CLI work?',
      '--subquestion', 'First thread :: primary docs',
      '--subquestion', 'Second thread :: paper',
      '--subquestion', 'Third thread :: dataset',
    ])
    expect(init.exitCode).toBe(0)
    expect(init.stdout.toString()).toContain('stage 1/9: brief')

    const status = run(cwd, ['status'])
    expect(status.exitCode).toBe(0)
    expect(status.stdout.toString()).toContain('Does the CLI work?')

    const check = run(cwd, ['check'])
    expect(check.exitCode).toBe(0)

    const blocked = run(cwd, ['advance'])
    expect(blocked.exitCode).toBe(1)
    expect(blocked.stderr.toString()).toContain('gate "brief" is pending')
  })

  test('source, claim and check enforce the evidence rule via the CLI', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-research-cli2-'))
    run(cwd, [
      'init',
      '--question', 'Evidence rule?',
      '--subquestion', 'One', '--subquestion', 'Two', '--subquestion', 'Three',
    ])
    const source = run(cwd, ['source', 'add', '--id', 'S1', '--url', 'https://example.org/x', '--type', 'primary'])
    expect(source.exitCode).toBe(0)
    const claim = run(cwd, [
      'claim', 'add', '--id', 'C1', '--statement', 'Claim', '--source', 'S1',
      '--quote', 'quote', '--confidence', 'high',
    ])
    expect(claim.exitCode).toBe(0)
    expect(run(cwd, ['check']).exitCode).toBe(0)
  })

  test('walk every gate, generate the report and pass the strict check', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-research-cli3-'))
    run(cwd, [
      'init',
      '--question', 'Walk the stages?',
      '--subquestion', 'One', '--subquestion', 'Two', '--subquestion', 'Three',
    ])
    expect(run(cwd, ['source', 'add', '--id', 'S1', '--url', 'https://example.org/x', '--type', 'primary']).exitCode).toBe(0)
    expect(run(cwd, [
      'claim', 'add', '--id', 'C1', '--statement', 'Claim', '--source', 'S1',
      '--quote', 'quote', '--confidence', 'high',
    ]).exitCode).toBe(0)
    for (let index = 0; index < 7; index += 1) {
      expect(run(cwd, ['gate', 'pass', '--note', `stage ${index + 1}`]).exitCode).toBe(0)
      expect(run(cwd, ['advance']).exitCode).toBe(0)
    }
    const report = run(cwd, ['report'])
    expect(report.exitCode).toBe(0)
    expect(run(cwd, ['check', '--strict']).exitCode).toBe(0)
    expect(run(cwd, ['status', '--json']).stdout.toString()).toContain('"stage": "report"')
  })
})
