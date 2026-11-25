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

## 03 retrieval index (200k documents)

| arm | design | lines | grade |
| --- | --- | --- | --- |
| A reasoning only | inverted index, galloping intersection, BM25, bounded heap, prefix fallback | 320 | pass |
| B reasoning + MVPs | spike ranked inverted+BM25 18 µs > bitset+TF-IDF 40 µs > full scan 145 µs; implemented inverted | 210 | pass |

Tie. The tournament eliminated the full-scan design at 8x in its own harness — the
same design the hidden suite rejects by 660x — but the reasoning arm never
proposed it: the inverted index is the textbook answer, and textbook answers are
exactly what reasoning is good at.

## 04 eviction policy (no textbook answer)

| arm | design | grade |
| --- | --- | --- |
| A reasoning only | W-TinyLFU: 1% window, SLRU 20/80, count-min admission, aging | pass |
| B reasoning + MVPs | spike ranked SLRU > W-TinyLFU > LFU > LRU; implemented **W-TinyLFU** anyway, on the grounds that only hit rate is graded | pass |

The trace mixes skewed popularity with sequential scans, and LRU fails it by 8.4
points against a two-queue fixture. Arm A nevertheless reasoned to a design that
resists scans — its own traces put it 8-9 points above LRU — without any
tournament. The distinguishing fact it used was in the spec: the workload has
periodic scans.

Arm B's tournament over-ranked SLRU because its own criterion set included
throughput, which the graded objective ignores; it then implemented the
hit-rate winner instead of the score winner, and said so. The tool ranked, the
arm decided, and the decision was right — which is the division of labour the
tool is for, and also a reminder that a tournament is only as good as the
criteria handed to it.

## 05 repository issue (SWE-bench shape)

Checkout of the repository at the commit before a real bug fix, with the issue as
a user would report it and the fix's tests held back as the hidden suite.

| arm | grade | note |
| --- | --- | --- |
| A reasoning only | pass 5/5 | first run discarded: the grader had left the hidden suite in the checkout, and the arm ran it |
| B reasoning + MVPs | pending | |

Calibration: the pre-fix checkout fails the hidden suite and the same checkout
with the real fix passes, so the oracle is a genuine FAIL_TO_PASS.

## What this establishes

Three problems, three ties, six arm runs, all graded by the same hidden suites:
the reasoning arm matched the MVP arm every time, including on the problem built
to separate them. The premise that reasoning would pick the comfortable design
was wrong twice over (fsync-per-write, then full scan).

The MVP phase's observable contribution is not a better answer on familiar
ground, it is a *cheaper rejection*: it priced three designs in minutes and threw
out the failing one before any code was written. It also hardened the winner
afterwards, though those fixes (torn-tail resync, batch rejection, prefix
fallback) came from the arm, not from the tournament.

The honest reading: on problems whose correct answer is textbook, the tournament
buys evidence and discarded alternatives, not better outcomes. It should only pay
where the answer is *not* knowable from memory, which is the case none of these
three problems actually exercised.

## Validity gaps, in order of importance

1. The arms could read `targets.json` next to the spec, so they could tune to the
   grading threshold instead of discovering the constraint; arm A cited the floor
   directly. Thresholds now live in `bench/grading/` and reach the suites only
   through `BENCH_TARGETS` at grade time, so the problem folder an arm is sent to
   no longer contains them. That removes the accidental visibility, not the
   determined one: everything in the repository is still readable, and only a
   working copy that holds the spec alone would enforce it.
2. `n=2` problems. A tie on two is not evidence of parity in general.
3. The no-retrieval rule is an instruction, not a profile without web tools.
4. The hidden suites are mine, and they measure what I chose to measure: they did
   not price maintainability, and arm B's extra machinery (compaction, directory
   fsync) is invisible to them.
