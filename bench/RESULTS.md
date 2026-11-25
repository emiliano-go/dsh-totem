# Results

Same model, same budget, same no-retrieval rule; the only difference is whether
three designs are validated as MVPs before implementation.

## 01 crash-safe store

| arm | design | lines | grade |
| --- | --- | --- | --- |
| A reasoning only | CRC32 append log, fsync per ack, truncate at first bad record | 242 | pass 3/3 |
| B reasoning + MVPs | proposed append log / atomic snapshot / snapshot+compaction; implemented snapshot+compaction | 194 | pass 3/3 |

Tie. The tournament preferred its own c3 over c1 by 0.15 points — preference,
not necessity; the simple design met every constraint.

## 02 durable write throughput

| arm | design | lines | grade |
| --- | --- | --- | --- |
| A reasoning only | append log, CRC framing, one write+fsync per event-loop turn (microtask batching) | 226 | pass 2/2 |
| B reasoning + MVPs | spike ranked group commit 10 527 pps > snapshot+rename 8 265 > timer fsync 6 118; implemented group commit with three hardening fixes | 222 | pass 2/2 |

Tie. The premise — that reasoning would pick correct-but-slow fsync-per-write and
lose the throughput floor — was wrong: arm A batched on its own initiative.

## What this establishes

Two problems, two ties. The MVP phase has not shown a correctness or performance
advantage on either, and it costs three candidate agents plus a measurement
round. Its observable contribution was ranking alternatives and hardening the
winner (arm B's torn-tail resync and batch-rejection fix).

## Validity gaps, in order of importance

1. The arms could read `targets.json`, so they could tune to the grading
   threshold instead of discovering the constraint. Arm A cited the floor
   directly. Until targets are hidden at grade time, both arms are handicapped in
   the experimenter's favour and the comparison overstates them equally.
2. `n=2` problems. A tie on two is not evidence of parity in general.
3. The no-retrieval rule is an instruction, not a profile without web tools.
4. The hidden suites are mine, and they measure what I chose to measure: they did
   not price maintainability, and arm B's extra machinery (compaction, directory
   fsync) is invisible to them.
