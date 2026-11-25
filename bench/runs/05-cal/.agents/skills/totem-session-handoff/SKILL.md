---
name: totem-session-handoff
description: Use before a context compaction, when a session is ending, or when work must continue in a later session and the next agent needs to know what changed and why.
whenToUse: Before compaction, before ending a session with unfinished work, and when handing a task to a subagent or a new session.
---

# Session handoff

A compaction summary is written by a model and keeps what that model judged
important. A handoff is written by you, on purpose, for the next reader.

## Before the context is compacted

The plugin already persists a session summary when it observes a compaction
marker and restores durable memory afterwards. Do not rely on that as the only
record: the summary needs the *decision*, not just the changed files.

Run `/handoff <what the next session must know>` when:

- a design choice was made and rejected alternatives matter;
- an investigation reached a dead end (that is the most expensive thing to
  repeat);
- the next step depends on something outside the repository.

## What a handoff contains

1. **Goal**: the outcome being pursued, in one sentence.
2. **State**: what is done, what is verified, what is merely believed.
3. **Next step**: the exact next action, with the file or command.
4. **Traps**: what already failed and why not to retry it.

Do not paste diffs or logs. Link the paths and record the claim; the next
session can read the code.

## Verify before you hand off

- A claim that a check passes belongs in `memory_check_record`, not in prose.
- Delete or update `task:` memories that no longer describe reality; a stale
  in-progress task sends the next session in the wrong direction.
