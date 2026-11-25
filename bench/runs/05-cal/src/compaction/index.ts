/**
 * Totem-native compaction plugin.
 *
 * This replaces the stock `@deepseek-ai/dsh-compaction-basic` row in every
 * agent preset. The engine subclass keeps the stock range selection, pressure,
 * lock, and replacement behavior; only the summary prose comes from Totem's
 * memory model. `command-compact` and the tool-result pruner stay mounted in
 * the same group.
 *
 * @module dsh-totem/compaction
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BasicCompactionConfig } from '@deepseek-ai/dsh-compaction-basic'
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic'
import { TotemCompactionEngine } from './engine.ts'
import { registerCompactionTools } from './tools.ts'

/** Stable Cordis plugin name. */
export const name = 'totem-compaction'

/** Services needed before the backend and its lookup tool can mount. */
export const inject = [...BasicCompactionEngine.inject, 'totem', 'tools']

/** Same configuration surface as the shipped basic backend. */
export const Config = BasicCompactionEngine.Config

/** Mount the engine and its read-only archive lookup. */
export function apply(ctx: Context, config: BasicCompactionConfig): void {
  const engine = new TotemCompactionEngine(ctx, config)
  registerCompactionTools(ctx, engine.blocks)
}
