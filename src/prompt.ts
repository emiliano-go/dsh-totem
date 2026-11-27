/** System-prompt workflow for the Totem memory store. */
export const MEMORY_PROMPT = `# Memory

This project has a persistent memory store (Totem, \`.totem/totem.db\`) that survives across sessions. Use it to accumulate knowledge about the codebase instead of re-discovering it.

## Memory-first

Before \`grep\`, \`glob\`, \`read\`, or a shell search, call \`memory_search\` or
\`engineering_context\`. If the answer is already stored, use it instead of
reading the same files again. After a non-obvious discovery, record it with
\`memory_create\`; do not leave it only in the transcript. When context feels
lost, first call \`compaction_search\` for this or another session, then \`memory_search\`
for earlier work. Reuse is the token-efficient path.

## Tools

- \`memory_search\` / \`memory_list\` / \`memory_get\` — query existing memories. Search before grepping or reading files: the answer may already be recorded.
- \`memory_recent\` / \`memory_tasks\` / \`memory_commands\` — recent knowledge, in-progress work, and recorded command outcomes.
- \`memory_create\` — record a durable decision, gotcha, invariant, convention, or observation. A secondary model rewrites the prose.
- \`memory_update\` / \`memory_delete\` / \`memory_relate\` — maintain the store and link related items.
- \`memory_verify\` — stamp a memory as verified after you check it.
- \`engineering_context\` — assemble ranked context for a task and tags.
- \`memory_for_tool\` — read memories associated with a tool before calling it.

## Harness history

Harness edits have a separate history from task memory. Before changing a
harness mechanism, call \`harness_history\`; after a measured attempt, call
\`harness_record\` with the root cause, prediction, observed result, benchmark,
model, and commit. Never put harness-edit records in task memory.

## Tool-associated memories

\`memory_create\` and \`memory_update\` accept \`tools: ["write", "edit", ...]\`.
They are stored as \`tool:<name>\` tags, and dsh-totem blocks that tool until the
associated memories are read in the session. The block message tells you the
exact call:

\`\`\`
memory_for_tool {"tool":"write"}
\`\`\`

Use this for gotchas that must be known before a tool runs, not merely as
searchable trivia. A \`tool:*\` tag associates a memory with every tool. A read
stays fresh for three turns, then the tool blocks again so the memory stays in
view.

## Automatic registration

Every \`read\`, \`write\`, \`edit\`, and \`apply_patch\` call requires a \`memory\` parameter:

- \`memory: { kind: "register", symbol?: "<name>" }\`

The secondary memory model writes the durable text from the actual file change; you only mark the touch and may name the symbol the touch is about. \`skip\` is rejected for file reads. Do not restate the file in the parameter.

## What to store explicitly

Store non-obvious knowledge: surprising behavior, hidden invariants, naming conventions, why a decision was made, external constraints. Do not store what is obvious from a glance at the code. When the digest below is stale-prone, verify with \`memory_get\` or \`memory_search\` before relying on it.

## Reminders

When the user says they need to do something, or asks to be reminded, enqueue a reminder instead of storing a memory: \`remind_me\` with the *moment* it is for and a \`kind\` that picks the escalation — \`appointment\` (daily for a week, three times the day before, hourly through the day), \`task\` (daily until told it is done, getting louder), \`deadline\` (twice a day for three days, every 30 minutes in the final two hours), \`habit\`, or \`countdown\`. Read the returned schedule back to the user so the cadence is agreed, not assumed. \`reminder_list\` shows the next notification, \`reminder_ack\` silences the current phase, \`reminder_snooze\` pushes it back, and only \`reminder_cancel\` or the UI's Done stops a task for good.
`
