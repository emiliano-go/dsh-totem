/** GitHub CI status and a background watcher that settles when all checks finish. */
import { execFileSync } from 'node:child_process'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'

const API = 'https://api.github.com'
const HEADERS = {
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
}

/** One check run reduced to the fields the agent needs. */
export interface CheckRow {
  name: string
  status: string
  conclusion: string | null
  url: string | null
  app: string | null
}

/** One legacy commit status. */
export interface StatusRow {
  context: string
  state: string
  url: string | null
}

/** Snapshot returned by ci_status. */
export interface CiState {
  repo: string
  ref: string
  done: boolean
  noChecks: boolean
  total: number
  completed: number
  pending: number
  failing: number
  checks: CheckRow[]
  statuses: StatusRow[]
  summary: string
}

const FAILED = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale'])

function token(): string {
  const env = process.env.GITHUB_TOKEN?.trim()
  if (env !== undefined && env.length > 0) return env
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', timeout: 10_000 }).trim()
  } catch {
    throw new Error('no GitHub token: set GITHUB_TOKEN or run `gh auth login`')
  }
}

/** Parse `owner/repo` from a remote URL. */
export function parseRepoUrl(url: string): string | undefined {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/u.exec(url.trim())
  return match === null ? undefined : `${match[1]}/${match[2]}`
}

/** Resolve the repository from an argument or the session's git remote. */
export function resolveRepo(value: string | undefined, cwd: string): string {
  const explicit = value?.trim() ?? ''
  if (explicit.length > 0) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(explicit)) throw new Error(`invalid repo: ${explicit}`)
    return explicit
  }
  const remote = execFileSync('git', ['-C', cwd, 'remote', 'get-url', 'origin'], { encoding: 'utf8', timeout: 10_000 }).trim()
  const repo = parseRepoUrl(remote)
  if (repo === undefined) throw new Error(`cannot parse a GitHub repository from remote: ${remote}`)
  return repo
}

/** Resolve the commit ref to watch: PR head, explicit ref, branch, or the checkout HEAD. */
export async function resolveRef(
  options: { repo: string; pr?: string; ref?: string; branch?: string; cwd: string },
  headers: Record<string, string>,
): Promise<string> {
  if (options.pr !== undefined && options.pr.trim().length > 0) {
    const pull = await api<{ head: { sha: string } }>(`/repos/${options.repo}/pulls/${options.pr.trim()}`, headers)
    return pull.head.sha
  }
  if (options.ref !== undefined && options.ref.trim().length > 0) return options.ref.trim()
  if (options.branch !== undefined && options.branch.trim().length > 0) return options.branch.trim()
  try {
    return execFileSync('git', ['-C', options.cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10_000 }).trim()
  } catch {
    // No git checkout: watch the repository's default branch.
    const repo = await api<{ default_branch: string }>(`/repos/${options.repo}`, headers)
    return repo.default_branch
  }
}

async function api<T>(path: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`GitHub ${response.status} for ${path}${detail.length > 0 ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return await response.json() as T
}

/** Reduce check runs and legacy statuses into one snapshot. */
export function summarize(repo: string, ref: string, runs: unknown[], statuses: unknown[]): CiState {
  const checks: CheckRow[] = runs.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const row = entry as Record<string, unknown>
    if (typeof row.name !== 'string') return []
    return [{
      name: row.name,
      status: typeof row.status === 'string' ? row.status : 'unknown',
      conclusion: typeof row.conclusion === 'string' ? row.conclusion : null,
      url: typeof row.html_url === 'string' ? row.html_url : typeof row.details_url === 'string' ? row.details_url : null,
      app: typeof row.app === 'object' && row.app !== null && typeof (row.app as { name?: unknown }).name === 'string'
        ? String((row.app as { name: string }).name) : null,
    }]
  })
  const legacy: StatusRow[] = statuses.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const row = entry as Record<string, unknown>
    if (typeof row.context !== 'string' || typeof row.state !== 'string') return []
    return [{ context: row.context, state: row.state, url: typeof row.target_url === 'string' ? row.target_url : null }]
  })
  const completed = checks.filter(check => check.status === 'completed').length
  const failing = checks.filter(check => check.conclusion !== null && FAILED.has(check.conclusion)).length
    + legacy.filter(status => status.state === 'failure' || status.state === 'error').length
  const pending = checks.length - completed + (legacy.some(status => status.state === 'pending') ? 1 : 0)
  const noChecks = checks.length === 0 && legacy.length === 0
  const done = noChecks || (completed === checks.length && !legacy.some(status => status.state === 'pending'))
  const summary = noChecks
    ? `No CI checks are registered for ${repo}@${ref}.`
    : `${done ? 'CI finished' : 'CI running'} for ${repo}@${ref}: ${completed}/${checks.length} checks completed, ${failing} failing`
  return { repo, ref, done, noChecks, total: checks.length, completed, pending, failing, checks, statuses: legacy, summary }
}

async function snapshot(repo: string, ref: string): Promise<CiState> {
  const headers = { ...HEADERS, authorization: `Bearer ${token()}` }
  const [checks, status] = await Promise.all([
    api<{ check_runs: unknown[] }>(`/repos/${repo}/commits/${ref}/check-runs?per_page=100`, headers),
    api<{ statuses: unknown[] }>(`/repos/${repo}/commits/${ref}/status`, headers),
  ])
  return summarize(repo, ref, checks.check_runs, status.statuses)
}

function cwdOf(exec: { agent?: { session?: { header?: { cwd?: string } } } }): string {
  return exec.agent?.session?.header?.cwd ?? process.cwd()
}

/** Register ci_status and ci_watch. */
export function registerCiTools(ctx: Context): void {
  const render = (value: unknown): { type: 'text'; text: string }[] => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }]
  const target = async (args: { repo?: string; pr?: string; ref?: string; branch?: string; cwd: string }) => {
    const repo = resolveRepo(args.repo, args.cwd)
    const headers = { ...HEADERS, authorization: `Bearer ${token()}` }
    const ref = await resolveRef({ ...args, repo }, headers)
    return { repo, ref }
  }

  ctx.tools.register(defineTool({
    name: 'ci_status',
    description: 'Check GitHub Actions/check-run status for a repository commit or pull request. Returns every check, what is still running, and what failed.',
    parameters: {
      repo: { type: 'string', description: "Repository as owner/name; defaults to the current checkout's origin." },
      pr: { type: 'string', description: 'Pull request number to watch its head commit.' },
      ref: { type: 'string', description: 'Explicit commit SHA or ref.' },
      branch: { type: 'string', description: 'Branch name.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args, exec) {
      const { repo, ref } = await target({ ...args, cwd: cwdOf(exec) })
      return snapshot(repo, ref)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'ci_watch',
    description: 'Start a background watcher that polls GitHub CI until every check for a pull request/commit finishes, then settles with a pass/fail summary. Follow with job_output(job_id, wait: true) to block until it returns.',
    parameters: {
      repo: { type: 'string', description: "Repository as owner/name; defaults to the current checkout's origin." },
      pr: { type: 'string', description: 'Pull request number.' },
      ref: { type: 'string', description: 'Explicit commit SHA or ref.' },
      branch: { type: 'string', description: 'Branch name.' },
      interval_seconds: { type: 'number', description: 'Poll interval in seconds (default 20, minimum 10).' },
      timeout_minutes: { type: 'number', description: 'Give up after this many minutes (default 45).' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => render(value) },
    async execute(args, exec) {
      const jobs = ctx.get('jobs') as { start: (spec: unknown) => string } | undefined
      if (jobs === undefined) throw new Error('background jobs are not available in this composition; use ci_status and poll')
      const cwd = cwdOf(exec)
      const { repo, ref } = await target({ ...args, cwd })
      const interval = Math.max(10, Math.floor(args.interval_seconds ?? 20))
      const timeoutMinutes = Math.max(1, Math.floor(args.timeout_minutes ?? 45))
      const owner = (exec.agent as { id?: string } | undefined)?.id
      const id = jobs.start({
        kind: 'ci-watch',
        label: `CI ${repo}@${ref}`,
        ...owner === undefined ? {} : { owner },
        run: (job: { append: (text: string) => void; updateProgress: (line: string) => void }) => {
          const controller = new AbortController()
          let stopped = false
          const done = (async () => {
            const deadline = Date.now() + timeoutMinutes * 60_000
            for (;;) {
              if (stopped || controller.signal.aborted) return { status: 'killed' as const }
              try {
                const state = await snapshot(repo, ref)
                job.updateProgress(`${state.completed}/${state.total} checks`)
                if (state.done) {
                  job.append(`${state.summary}\n`)
                  for (const check of state.checks) {
                    if (check.conclusion !== null && FAILED.has(check.conclusion)) {
                      job.append(`FAILED ${check.name}${check.app === null ? '' : ` (${check.app})`}${check.url === null ? '' : ` ${check.url}`}\n`)
                    }
                  }
                  for (const status of state.statuses) {
                    if (status.state === 'failure' || status.state === 'error') {
                      job.append(`FAILED ${status.context}${status.url === null ? '' : ` ${status.url}`}\n`)
                    }
                  }
                  return { status: state.failing > 0 ? 'failed' as const : 'completed' as const, detail: state.summary, result: state.summary }
                }
                if (Date.now() >= deadline) {
                  const text = `CI watch timed out after ${timeoutMinutes}m with ${state.pending} pending`
                  job.append(`${text}\n`)
                  return { status: 'failed' as const, detail: text }
                }
              } catch (error) {
                job.append(`ci_watch: ${error instanceof Error ? error.message : String(error)}\n`)
                return { status: 'failed' as const, detail: error instanceof Error ? error.message : String(error) }
              }
              await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, interval * 1000)
                controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
              })
            }
          })()
          return {
            cancel: (reason?: string) => { stopped = true; controller.abort(reason) },
            done,
          }
        },
      })
      return {
        jobId: id,
        repo,
        ref,
        hint: 'Use job_output with this job_id and wait: true to block until CI finishes.',
      }
    },
  }))
}
