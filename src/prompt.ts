/** System-prompt workflow for the Totem memory store. */
export const MEMORY_PROMPT = `# Memory

This project has a persistent memory store (Totem, \`.totem/totem.db\`) that survives across sessions. Use it to accumulate knowledge about the codebase instead of re-discovering it.

## Tools

- \`memory_search\` / \`memory_list\` / \`memory_get\` — query existing memories. Search before grepping or reading files: the answer may already be recorded.
- \`memory_recent\` / \`memory_tasks\` / \`memory_commands\` — recent knowledge, in-progress work, and recorded command outcomes.
- \`memory_create\` — record a durable decision, gotcha, invariant, convention, or observation. A secondary model rewrites the prose.
- \`memory_update\` / \`memory_delete\` / \`memory_relate\` — maintain the store and link related items.
- \`memory_verify\` — stamp a memory as verified after you check it.
- \`engineering_context\` — assemble ranked context for a task and tags.

## Automatic registration

Every \`read\`, \`write\`, \`edit\`, and \`apply_patch\` call requires a \`memory\` parameter:

- \`memory: { kind: "register", symbol?: "<name>" }\`

The secondary memory model writes the durable text from the actual file change; you only mark the touch and may name the symbol the touch is about. \`skip\` is rejected for file reads. Do not restate the file in the parameter.

## What to store explicitly

Store non-obvious knowledge: surprising behavior, hidden invariants, naming conventions, why a decision was made, external constraints. Do not store what is obvious from a glance at the code. When the digest below is stale-prone, verify with \`memory_get\` or \`memory_search\` before relying on it.
`
