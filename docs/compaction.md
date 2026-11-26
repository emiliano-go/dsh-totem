# Native compaction with Totem

## What changed

The stock `@deepseek-ai/dsh-compaction-basic` backend writes its summary with
its own model. This bundle replaces that backend in every shipped Web agent
preset with `dsh-totem/compaction`, a subclass that keeps the stock
pressure/range/lock/replacement behavior and changes only the summarizer.

The summary is written by Totem's configured memory model through
`runOneShot(..., purpose: 'totem-compact')`. Totem then archives the compact so
the agent can retrieve it later without inflating the live context.

## Runtime flow

1. The stock engine selects a balanced, tool-pair-safe range under token
   pressure (or `/compact`, or context overflow).
2. `TotemCompactionEngine.summarize()` resolves the Totem memory route with
   `TotemService.compactionTarget()`.
3. The selected messages are rendered into a bounded transcript and sent to
   the memory model with the compact system prompt.
4. The returned text becomes the native summary with the Totem provider and
   model recorded in the `compaction/summary` event.
5. The engine observes that event and writes one `ContextBlock` for the session.
6. The following `compact-checkpoint` user message supplies the replacement
   sequence, which is filled into the same block.

If there is no Totem target, the model returns nothing, or the call fails, the
engine falls back to `super.summarize()`. Cancellation is rethrown, never
converted into a fallback. A failed archive write is logged; it never fails the
compaction itself.

## Archive model

One JSON document per session:

```text
~/.dsh/totem/compaction/<sha256(sessionId)[:32]>.json
```

Each `ContextBlock` records:

| Field | Meaning |
|---|---|
| `id` | Stable hash of `sessionId` and `compactionId`. |
| `sessionId` | Owning session. |
| `compactionId` | Native compaction identity. |
| `summarySeq` | Seq of the `compaction/summary` event. |
| `replacementSeq` | Seq of the following `compact-checkpoint` message, when seen. |
| `startSeq`, `endSeq` | Shadowed surface range. |
| `shadowedSeqs` | Every shadowed surface seq. |
| `shadowedTokenCount` | Estimated token price of the removed range. |
| `summary` | Compact text exactly as the memory agent wrote it. |
| `tier` | Hierarchy depth; `1` for a direct conversation compact. |
| `parentIds` | Earlier compacts whose summary/replacement seq was shadowed. |
| `provider`, `model` | Route that wrote the compact. |
| `createdAt` | ISO-8601 creation time. |

Parent detection matches the new block's `shadowedSeqs` against prior
`summarySeq`/`replacementSeq` values. A later compact that folds an earlier
compact gets `tier = max(parent.tier) + 1`.

## `compaction_search`

The compaction plugin registers one read-only tool, scoped to the calling
session:

```json
{
  "query": "text to match",
  "limit": 5
}
```

It searches the session's summaries, compaction ids, and block ids, newest
first, with a maximum of 50. It never restores the old transcript and cannot
read another session's archive by guessing an id.

Use it when the live context no longer contains an earlier decision, path,
command, or error:

```text
compaction_search({"query": "the SQLite decision"})
```

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `compactionTokens` | `4096` | Output cap for one compact. |
| `compactionMaxInputBytes` | `512000` | Transcript byte cap before truncation. |
| `provider`, `model` | deployment default | Memory-agent route; `distill: false` removes the route and forces the stock summarizer. |
| `timeoutMs` | `15000` | Auxiliary-call timeout. |

The compact system prompt preserves the goal, constraints, decisions and
reasons, exact paths/symbols/commands/errors, completed and verified work, open
work, and failed attempts worth not repeating. The transcript is rendered from
text, tool calls, and tool results; reasoning blocks are omitted.

The input cap must stay large enough for the selected span. A 64 KB cap on a
multi-hundred-thousand-token span summarizes only the oldest few percent, so
the agent wakes up with a compact that silently lost most of its work. The
default is now 512 KB, and the summary output cap is 4096 tokens.

## Coordination with recovery

The older recovery path still runs independently: it observes
`compaction/start` and the `compact-checkpoint` source, persists the session
work, and injects a budgeted durable-memory block at the next step. Native
compaction and recovery are complementary:

- the native compact replaces the old span in the live transcript;
- `ContextBlock` keeps the compact searchable;
- recovery re-injects durable decisions, invariants, gotchas, and active tasks.

## Why billion-context was removed from this lane

billion-context disables the native compaction backend and its wire guard
refuses native compaction calls. Native compaction and billion-context cannot
own the same session lane. The live `web-totem` profile therefore no longer
bundles billion-context; Totem's native backend is the compressor.

## Source map

| File | Responsibility |
|---|---|
| `src/compaction/index.ts` | Cordis plugin row, engine construction, tool registration |
| `src/compaction/engine.ts` | `BasicCompactionEngine` subclass, fallback, event archive |
| `src/compaction/summarize.ts` | Bounded transcript and memory-model call |
| `src/compaction/blocks.ts` | Per-session JSON archive, hierarchy, search |
| `src/compaction/tools.ts` | `compaction_search` |
| `src/service.ts` | `compactionTarget()` route and budgets |
| `src/distill.ts` | `totem-compact` one-shot purpose |
| `script/gen-patch.ts` | Replaces the stock backend in every preset |

## Verification

```sh
bun test test/compaction-blocks.test.ts \
  test/compaction-summarize.test.ts \
  test/compaction-tools.test.ts \
  test/compaction-target.test.ts \
  test/compaction-patch.test.ts
bun run build
```

The live verification in this checkout used a compact generated by
`opencode-go/deepseek-v4.1-flash`, confirmed the archive block and replacement
seq, and returned the block through `compaction_search`. A headless run with a
distinct memory model (`deepseek-v4.1-flash` while the default was
`beam-free`) confirmed the Totem summarizer branch rather than the stock
fallback.
