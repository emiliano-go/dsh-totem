# Metrics and harness history

Metrics are local, append-only JSON lines at `~/.dsh/totem/metrics.jsonl`.
They are separate from memory and never enter `memory_search`.

## Events

| Event | Fields | Purpose |
|---|---|---|
| `memory.file_touch` | `action`, `tool`, `path` | Shows how often file memory is registered, ignored, or expired. |
| `memory.invalidate` | `path`, `count` | Records how many memories a write marked stale. |
| `memory.query` | `tool`, `ms`, `bytes`, `results` | Tracks memory search latency and result volume. |
| `memory.digest` | `bytes`, `context`, `selected` | Tracks the first-step digest. |
| `memory.recovery` | `bytes`, `compact`, `durable`, `tasks` | Tracks post-compaction recovery size. |
| `harness.record` | `id`, `status`, `benchmark`, `model` | Records a harness attempt. |
| `harness.plan` | `rootCause`, `matched`, `accepted`, `rejected` | Records a harness-plan lookup. |
| `harness.history` | `results` | Records a harness-history lookup. |

Read them with `memory_metrics(limit=200)` or directly:

```sh
tail -n 100 ~/.dsh/totem/metrics.jsonl
```

## Harness history

Harness-optimization attempts live in their own store:
`~/.dsh/totem/harness-edits.jsonl`.

Use `harness_plan` before changing a harness mechanism; it returns the
strongest accepted edit, the rejected edits, and one next experiment. Use
`harness_history` when you need the raw records. After measuring the change,
call `harness_record`. The record captures the recurring
root cause, edit, rationale, predicted outcome, observed outcome, benchmark,
model, commit, status, and numeric metrics.

These records are intentionally not returned by `memory_search`: task memory
answers what the project knows, while harness history answers what changed and
what happened.
