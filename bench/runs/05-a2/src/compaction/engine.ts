/**
 * Native compaction backend with Totem's memory agent as the summarizer.
 *
 * Only `summarize()` is replaced. The shipped engine still owns range
 * selection, token pressure, retention, the durable lock, tool-pair balancing,
 * and the replacement event. That keeps `/compact` and automatic pressure
 * working exactly as before; only the prose comes from Totem.
 *
 * @module dsh-totem/compaction/engine
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BasicCompactionConfig } from '@deepseek-ai/dsh-compaction-basic'
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import type { TotemService } from '../service.ts'
import { ContextBlockStore } from './blocks.ts'
import { summarizeWithTotem, type CompactionInput } from './summarize.ts'

function textOf(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  return blocks.flatMap((block) => {
    if (typeof block !== 'object' || block === null) return []
    const record = block as { type?: unknown; text?: unknown }
    return record.type === 'text' && typeof record.text === 'string' ? [record.text] : []
  }).join('\n')
}

function sessionIdOf(session: unknown): string {
  return (session as { id?: unknown } | undefined)?.id
    ? String((session as { id: unknown }).id)
    : ''
}

/** Compaction engine whose summary is written by Totem's secondary model. */
export class TotemCompactionEngine extends BasicCompactionEngine {
  /** Durable compact archive, also used by the `compaction_search` tool. */
  readonly blocks: ContextBlockStore

  constructor(ctx: Context, config?: BasicCompactionConfig) {
    super(ctx, config)
    this.blocks = new ContextBlockStore()
    ctx.on('session/event', (session: unknown, event: unknown) => {
      this.noteEvent(session, event)
    })
  }

  /** Preserve every successful native compact, including its hierarchy. */
  private noteEvent(session: unknown, event: unknown): void {
    if (typeof event !== 'object' || event === null) return
    const record = event as { type?: unknown; seq?: unknown; data?: unknown }
    const sessionId = sessionIdOf(session)
    if (sessionId.length === 0) return
    if (record.type === 'compaction/summary') {
      const data = record.data as {
        compactionId?: unknown
        summary?: unknown
        shadowedRange?: { start?: unknown; end?: unknown }
        shadowedSeqs?: unknown
        shadowedTokenCount?: unknown
        provider?: unknown
        model?: unknown
      } | undefined
      const summary = textOf(data?.summary)
      if (typeof data?.compactionId !== 'string' || summary.length === 0) return
      const shadowedSeqs = Array.isArray(data.shadowedSeqs)
        ? data.shadowedSeqs.filter((seq): seq is number => typeof seq === 'number')
        : []
      if (shadowedSeqs.length === 0) return
      const start = typeof data.shadowedRange?.start === 'number' ? data.shadowedRange.start : shadowedSeqs[0]
      const end = typeof data.shadowedRange?.end === 'number'
        ? data.shadowedRange.end
        : shadowedSeqs[shadowedSeqs.length - 1]
      void this.blocks.append({
        sessionId,
        compactionId: data.compactionId,
        summarySeq: typeof record.seq === 'number' ? record.seq : 0,
        startSeq: start,
        endSeq: end,
        shadowedSeqs,
        shadowedTokenCount: typeof data.shadowedTokenCount === 'number' ? data.shadowedTokenCount : 0,
        summary,
        provider: typeof data.provider === 'string' ? data.provider : 'unknown',
        model: typeof data.model === 'string' ? data.model : 'unknown',
      }).catch((error) => {
        this.ctx.logger?.warn(`dsh-totem: compact block was not archived: ${String(error)}`)
      })
      return
    }
    if (record.type !== 'user/message') return
    const data = record.data as {
      message?: { source?: { kind?: unknown; compactionId?: unknown } }
      source?: { kind?: unknown; compactionId?: unknown }
    } | undefined
    const source = data?.message?.source ?? data?.source
    if (source?.kind !== 'compact-checkpoint' || typeof source.compactionId !== 'string') return
    if (typeof record.seq !== 'number') return
    void this.blocks.setReplacement(sessionId, source.compactionId, record.seq).catch(() => {})
  }

  /**
   * Replace the default summarizer. Every failure that is not cancellation
   * falls back to the shipped summarizer so compaction cannot become less
   * reliable just because Totem's model route is down.
   */
  protected async summarize(input: CompactionInput, agent: any, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted) throw signal.reason ?? new Error('compaction aborted')
    let totem: TotemService | undefined
    try {
      totem = this.ctx.get('totem') as TotemService | undefined
    } catch {
      return super.summarize(input as never, agent, signal)
    }
    const target = totem?.compactionTarget()
    if (totem === undefined || target === undefined) return super.summarize(input as never, agent, signal)
    const sessionId = sessionIdOf(agent?.session)
    try {
      const text = await summarizeWithTotem(
        this.ctx,
        target,
        input,
        signal,
        sessionId.length === 0 ? undefined : sessionId,
      )
      if (text === undefined) {
        if (signal?.aborted) throw signal.reason ?? new Error('compaction aborted')
        return super.summarize(input as never, agent, signal)
      }
      return {
        summary: [{ type: 'text', text }],
        provider: target.provider,
        model: target.model,
        maxTokens: target.maxTokens,
        rawOutput: [{ type: 'text', text }],
      }
    } catch (error) {
      if (signal?.aborted) throw error
      this.ctx.logger?.warn(`dsh-totem: memory-agent compaction summary failed: ${String(error)}`)
      return super.summarize(input as never, agent, signal)
    }
  }
}
