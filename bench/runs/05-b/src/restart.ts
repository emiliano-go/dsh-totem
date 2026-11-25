/**
 * Restart the DSH host process from inside it.
 *
 * The host is replaced by the same launcher the desktop entry uses
 * (`dsh-totem`), which stops whatever holds the port, waits for the port to
 * free, and starts a fresh host. Because the launcher owns the kill, this
 * module only spawns it detached and gets out of the way.
 *
 * A restart scheduled with `idle` is deferred until every running turn has
 * finished, so pressing the button mid-turn cannot cut a turn in half.
 *
 * @module dsh-totem/restart
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'

/** Longest delay a request may ask for. */
export const MAX_RESTART_DELAY = 120_000
/** Default pause so the HTTP response and the turn's last events flush first. */
export const DEFAULT_RESTART_DELAY = 1_500

/** What a caller asks for. */
export interface RestartRequest {
  /** Wait for running turns before restarting. Default true. */
  idle?: boolean
  /** Milliseconds between the turn boundary and the launcher spawn. */
  delayMs?: number
  /** Port the host listens on, exported so the launcher targets it. */
  port?: number
}

/** What the controller decided to do. */
export interface RestartPlan {
  launcher: string
  /** `idle` means it is waiting for the running turns to finish. */
  mode: 'now' | 'idle'
  delayMs: number
  port?: number
}

/** Host facts the Server tab shows. */
export interface RestartStatus {
  pid: number
  busy: boolean
  launcher: string | null
}

type SpawnLike = (command: string, args: readonly string[], options: {
  detached: boolean
  stdio: 'ignore'
  cwd: string
  env: NodeJS.ProcessEnv
}) => { unref: () => void }

/** Collaborators the controller needs; all overridable for tests. */
export interface RestartDeps {
  /** Configured launcher command, resolved against the directories. */
  launcher: () => string
  /** True while at least one turn is running. */
  busy: () => boolean
  /** systemd user unit that owns the host when it is supervised. */
  service?: () => string
  /** True when the host runs under systemd (a unit or a transient scope). */
  supervised?: () => boolean
  env?: NodeJS.ProcessEnv
  cwd?: () => string
  exists?: (path: string) => boolean
  dirs?: () => readonly string[]
  spawn?: SpawnLike
}

/** Directories a bare launcher name is looked up in. */
export function launcherDirs(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const seen = new Set<string>()
  for (const entry of (env.PATH ?? '').split(delimiter)) {
    const dir = entry.trim()
    if (dir.length > 0) seen.add(dir)
  }
  // Desktop launches do not inherit an interactive shell PATH.
  seen.add(join(home, '.local/bin'))
  seen.add(join(home, '.npm-global/bin'))
  return [...seen]
}

/**
 * Resolve the configured launcher to an absolute path.
 * @returns the first existing candidate, or undefined when none exists.
 */
export function resolveLauncher(
  command: string,
  dirs: readonly string[],
  exists: (path: string) => boolean,
): string | undefined {
  const name = command.trim()
  if (name.length === 0) return undefined
  const candidates = isAbsolute(name)
    ? [name]
    : name.includes('/')
      ? [join(process.cwd(), name)]
      : dirs.map(dir => join(dir, name))
  return candidates.find(candidate => exists(candidate))
}

function refuse(message: string): Error {
  return Object.assign(new Error(message), { status: 409 })
}

/** Tracks restart requests and spawns the launcher when it is safe to. */
export class RestartController {
  private pending: { delayMs: number; port?: number } | undefined
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly deps: RestartDeps) {}

  /** Launcher path, or undefined when it cannot be found. */
  launcher(): string | undefined {
    const exists = this.deps.exists ?? existsSync
    return resolveLauncher(this.deps.launcher(), this.dirs(), exists)
  }

  /** Snapshot for the Server tab. */
  status(): RestartStatus {
    const launcher = this.launcher()
    return { pid: process.pid, busy: this.deps.busy(), launcher: launcher ?? null }
  }

  /**
   * Schedule one restart.
   * @throws an error tagged `status: 409` when no launcher exists or a
   * restart is already queued.
   */
  schedule(request: RestartRequest = {}): RestartPlan {
    if (this.timer !== undefined || this.pending !== undefined) {
      throw refuse('a restart is already scheduled')
    }
    const launcher = this.launcher()
    if (launcher === undefined) {
      throw refuse('no restart launcher found: set restartCommand in the Totem plugin config')
    }
    const delayMs = Math.min(MAX_RESTART_DELAY, Math.max(0, request.delayMs ?? DEFAULT_RESTART_DELAY))
    const port = request.port
    const base: RestartPlan = { launcher, mode: 'now', delayMs, ...port === undefined ? {} : { port } }
    if (request.idle !== false && this.deps.busy()) {
      this.pending = { delayMs, ...port === undefined ? {} : { port } }
      return { ...base, mode: 'idle' }
    }
    this.fire(launcher, delayMs, port)
    return base
  }

  /** Called at a turn boundary; fires a deferred restart once nothing runs. */
  tick(): void {
    if (this.pending === undefined || this.deps.busy()) return
    const { delayMs, port } = this.pending
    this.pending = undefined
    const launcher = this.launcher()
    if (launcher === undefined) return
    this.fire(launcher, delayMs, port)
  }

  private dirs(): readonly string[] {
    return this.deps.dirs?.() ?? launcherDirs(this.deps.env ?? process.env)
  }

  private fire(launcher: string, delayMs: number, port: number | undefined): void {
    const env: NodeJS.ProcessEnv = { ...(this.deps.env ?? process.env) }
    if (port !== undefined && port > 0) env.DSH_TOTEM_PORT = String(port)
    const cwd = this.deps.cwd?.() ?? process.cwd()
    const run = this.deps.spawn ?? spawn as unknown as SpawnLike
    const supervised = this.deps.supervised?.() ?? env.INVOCATION_ID !== undefined
    const service = this.deps.service?.() ?? 'dsh-totem.service'
    this.timer = setTimeout(() => {
      this.timer = undefined
      // Under systemd a detached launcher would still live in the host's
      // cgroup, so stopping the unit kills the replacement too. Ask the user
      // manager for the restart instead; --no-block returns before this exit.
      const child = supervised
        ? run('systemctl', ['--user', '--no-block', 'restart', service], { detached: true, stdio: 'ignore', cwd, env })
        : run(launcher, [], { detached: true, stdio: 'ignore', cwd, env })
      child.unref()
    }, delayMs)
  }
}
