---
name: totem-conflict-resolution
description: Use when memory_conflicts reports an open contradiction, when a write is rejected or flagged as conflicting, or when two stored claims disagree about the same subject.
whenToUse: Whenever two memories make incompatible claims about the same subject, and before relying on either of them.
---

# Conflict resolution

Two live contradictory claims are worse than one stale claim: every later
retrieval returns both, and the reader has no way to tell which one is current.

## Detect

- A write that contradicts an existing memory returns `conflicts` in its result.
- `memory_conflicts` lists everything detected and not yet resolved.
- The Conflicts tab in the assistant settings shows the same inbox.

## Decide

Establish which claim is true **from the code, a test, or the user** — not from
which memory is newer. Recency is a hint, never evidence.

- Resolve as `keep-a` or `keep-b` when one claim is wrong: the other memory is
  superseded, so retrieval stops returning it as current.
- Resolve as `both` when the claims are compatible under a condition you can
  state; record that condition rather than leaving the disagreement implicit.
- If neither claim is right, resolve as `both` and write the corrected memory.

## Record

Resolution records a `contradicts` relation between the pair, so the reasoning
survives the status change. A later reader can see that both were considered.

Do not resolve a conflict by deleting one memory without recording why: the
deletion is invisible, and the same contradiction will be recreated the next
time someone writes the same fact.

## Prevent

- Before writing a claim, search for the subject. `memory_update` the existing
  memory instead of creating a second one.
- When a fact changes because the code changed, update the original and set
  `valid_from` on the replacement rather than storing both.
