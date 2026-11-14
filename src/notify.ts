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
