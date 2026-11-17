/** Notification delivery: ntfy and Telegram, best-effort. */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { TotemConfig, TotemService } from './service.ts'

export interface NotifyText {
  title: string
  message: string
  priority?: 'min' | 'low' | 'default' | 'high' | 'max'
}

/**
 * Send one notification to every configured channel.
 * @returns per-channel results; never throws.
 */
export async function sendNotification(
  config: TotemConfig,
  text: NotifyText,
  signal?: AbortSignal,
): Promise<{ ntfy?: string; telegram?: string }> {
  const tasks: Promise<void>[] = []
  const result: { ntfy?: string; telegram?: string } = {}
  const topic = config.ntfyTopic.get().trim()
  if (topic.length > 0) {
    const base = config.ntfyUrl.get().trim().replace(/\/+$/u, '') || 'https://ntfy.sh'
    const headers: Record<string, string> = { 'content-type': 'text/plain' }
    const token = config.ntfyToken.get().trim()
    if (token.length > 0) headers.authorization = `Bearer ${token}`
    const priority = text.priority ?? 'default'
    if (priority !== 'default') headers['x-priority'] = priority
    // ntfy titles are single-line; strip line breaks.
    const title = text.title.replace(/[\r\n]+/gu, ' ').slice(0, 200)
    if (title.length > 0) headers.title = title
    tasks.push((async () => {
      const response = await fetch(`${base}/${encodeURIComponent(topic)}`, {
        method: 'POST',
        headers,
        body: text.message,
        signal,
      })
      result.ntfy = response.ok ? 'ok' : `http ${response.status}`
    })().catch(error => { result.ntfy = `error: ${String(error)}` }))
  }
  const bot = config.telegramBotToken.get().trim()
  const chat = config.telegramChatId.get().trim()
  if (bot.length > 0 && chat.length > 0) {
    tasks.push((async () => {
      const response = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: `${text.title}\n\n${text.message}`.slice(0, 4000) }),
        signal,
      })
      result.telegram = response.ok ? 'ok' : `http ${response.status}`
    })().catch(error => { result.telegram = `error: ${String(error)}` }))
  }
  await Promise.allSettled(tasks)
  return result
}

/** Register the model-facing notify tool. */
export function registerNotifyTool(ctx: import('@deepseek-ai/cordis').Context, totem: TotemService): void {
  ctx.tools.register(defineTool({
    name: 'notify',
    description: 'Send a push notification to the configured ntfy/Telegram channels.',
    parameters: {
      title: { type: 'string', required: true, description: 'Short notification title.' },
      message: { type: 'string', required: true, description: 'Notification body.' },
      priority: { type: 'string', enum: ['min', 'low', 'default', 'high', 'max'], description: 'Optional priority.' },
    },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{
      type: 'text' as const,
      text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    }] },
    async execute(args: NotifyText) {
      return sendNotification(totem.config, args)
    },
  }))
}

/** True when at least one delivery channel has enough config to send. */
export function hasNotificationChannel(config: TotemConfig): boolean {
  if (config.ntfyTopic.get().trim().length > 0) return true
  return config.telegramBotToken.get().trim().length > 0
    && config.telegramChatId.get().trim().length > 0
}

/**
 * Read a volatile boolean, tolerating a config composed before the field
 * existed. A patch row may supply only its own keys, so a flag can arrive
 * `undefined`; calling `.get()` on it throws inside an awaited turn listener
 * and the notification silently never happens.
 */
function flag(value: { get: () => boolean } | undefined, fallback: boolean): boolean {
  try {
    return value?.get() ?? fallback
  } catch {
    return fallback
  }
}

/** Short label for a session: its cwd basename, else its id. */
function sessionLabel(session: { id?: string; header?: { cwd?: string } } | undefined): string {
  const cwd = session?.header?.cwd ?? ''
  if (cwd.length > 0) {
    const parts = cwd.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? cwd
  }
  return session?.id ?? 'session'
}

/**
 * Notify on turn completion and on tool-approval requests.
 *
 * Both hooks are fire-and-forget. `agent/turn-stopping` is a *serial, awaited*
 * event: the turn boundary does not commit until every listener returns, so a
 * synchronous HTTP round-trip here would add push latency to every turn. The
 * delivery promise is left unawaited and failures stay silent by design
 * (`sendNotification` never throws).
 *
 * Subagent turns are skipped — one workflow can close dozens of them, and the
 * interesting signal is the root session going quiet.
 */
export function registerNotificationHooks(ctx: import('@deepseek-ai/cordis').Context, totem: TotemService): void {
  const config = totem.config

  ctx.on('agent/turn-stopping', ({ agent, turn }) => {
    try {
      if (!flag(config.notifyTurnEnd, true) || !hasNotificationChannel(config)) return
      if (agent.parentAgent !== undefined) return
      const session = (agent as { session?: { id?: string; header?: { cwd?: string } } }).session
      const cwd = session?.header?.cwd ?? ''
      const lines = [`${sessionLabel(session)} · turn ${turn}`]
      if (cwd.length > 0) lines.push(cwd)
      void sendNotification(config, { title: 'DSH finished a turn', message: lines.join('\n') })
    } catch (error) {
      console.error('[totem] turn-end notification failed:', error)
    }
  })

  ctx.on('session/event', (session, event) => {
    try {
      if ((event as { type?: string }).type !== 'approval/asked') return
      if (!flag(config.notifyApproval, true) || !hasNotificationChannel(config)) return
      const data = (event as { data?: { toolName?: string; reason?: string } }).data ?? {}
      const typed = session as { id?: string; header?: { cwd?: string } }
      const lines = [`tool: ${data.toolName ?? 'unknown'}`]
      if (data.reason !== undefined && data.reason.length > 0) lines.push(data.reason)
      const cwd = typed.header?.cwd ?? ''
      if (cwd.length > 0) lines.push(cwd)
      void sendNotification(config, {
        title: 'DSH needs approval',
        message: lines.join('\n'),
        priority: 'high',
      })
    } catch (error) {
      console.error('[totem] approval notification failed:', error)
    }
  })
}
