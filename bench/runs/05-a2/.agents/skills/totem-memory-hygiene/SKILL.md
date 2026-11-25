---
name: totem-memory-hygiene
description: Use when deciding whether a fact belongs in project memory, when a stored memory looks stale or wrong, or when a write is reported as conflicting with an existing memory.
whenToUse: Before writing a durable memory, and whenever a retrieval returns something you suspect is out of date.
---

# Memory hygiene

Totem stores claims, not transcripts. The question is never "was this
interesting" but "will the next agent need this and fail without it".

## Write

- **Store the why.** A decision without its rationale is a rule nobody can
  safely change. Put the reason in `metadata.rationale`.
- **Store the surprise.** A gotcha earns its place when the code does not
  obviously do that. "Ran the tests" does not.
- **Store what is checked.** If a claim is backed by a command, record the
  result with `memory_check_record` and verify with `memory_verify(check_id)`;
  a check-backed claim outranks an assertion.
- **Prefer one precise claim to five vague ones.** Consolidate instead of
  appending.
- **Set validity when the claim has a lifetime.** `valid_from` / `valid_to` let
  later retrieval skip what no longer holds.

## Do not write

- File contents, tool output, or "I read X" markers: the file-state TLDR
  already covers those.
- Task progress ("phase A complete"): use a `task:` tag and update it.
- Anything the next reader sees in one glance at the code.

## Read

- Search before grepping. Memory is cheaper than a repository scan and usually
  carries the reason the code looks the way it does.
- Treat every memory as stale-prone: verify against the code before relying on
  a claim, and record `memory_feedback(signal: "stale")` when it no longer
  holds.
- `engineering_context` is the ranked entry point; `memory_search` is the
  narrow one.

## Conflicts

A write that contradicts an existing memory returns `conflicts` and opens an
entry in `memory_conflicts`. Do not ignore it and do not store a third version:
resolve it, because two live contradictory claims are worse than one stale
claim.
