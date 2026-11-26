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
| B reasoning + MVPs | pass 5/5 | its own spike harness had a wrong expectation flag, so the ranking fell to `loc`; the arm caught it, fixed the harness, and implemented on correctness |

Calibration: the pre-fix checkout fails the hidden suite and the same checkout
with the real fix passes, so the oracle is a genuine FAIL_TO_PASS.

## 05b — what the repository task showed

Both arms fixed the same two defects and both pass. Arm B's tournament was
misled by its *own* harness: a wrong expectation flag under-scored every
candidate equally and the rendered table omitted the correctness criterion, so
the decision fell to lines of code. The arm noticed, repaired the harness, and
implemented on correctness. That is the second time an arm had to override its
tournament, and the second time the cause was the criteria, not the designs.

## 06 performance optimization (SWE-fficiency task)

The real `pandas-dev__pandas-57479` task from the SWE-fficiency dataset: the
repository at its base commit, the expert's timing workload, and a bar of 1.3x
speedup with the project's own tests green. Calibration: pristine 1.05x (fail),
expert patch 2.20x (pass).

| arm | change | speedup | tests | grade |
| --- | --- | --- | --- | --- |
| A reasoning only | `loc[:, k] = res_k` -> positional `isetitem` when the dtype is unchanged | **2.88x** | pass | pass |
| B reasoning + MVPs | `loc[:, k] = res_k` -> `result[k] = res_k` for the unique-column case | **2.89x** | pass | pass |

Both beat the expert patch. Arm B's tournament produced **no ranking**: its
candidates were Python and `spike` assumed a TypeScript harness (`impl.ts`,
`bun run bench.ts`), so every candidate failed to emit JSON and the arm ranked
the approaches with its own harness instead. `spike` now takes a `runner`, so a
Python project can be measured with `python3 bench.py`.

## 07 Terminal-Bench: db-wal-recovery

A real Terminal-Bench task run as a real environment: official image, the task's
`/app` mounted from disk, and the benchmark's own verifier available to the arm.
The task is SQLite WAL recovery where the WAL is XOR-obfuscated; graded on
`/app/recovered.json`. Calibration: pristine 7 failed, official solution 7 passed.

| arm | approach | verifier | grade |
| --- | --- | --- | --- |
| A reasoning only | header inspection, found single-byte key `0x42`, decrypt, checkpoint, restore a valid WAL | 7 passed | pass |
| B reasoning + MVPs | three approaches spiked (known-plaintext, brute-force key search, manual frame replay); winner was manual replay | 7 passed | pass |

Both produced byte-identical `recovered.json` (11 records). This is the task class
where the model's published score is 15.7% (Terminal-Bench-Science), and both arms
solved this instance. Arm B's first spike attempt emitted no measurement again —
`harness:file:` with no runner defaulted to `bun run bench.ts` on a Python task;
`spike` now infers `python3 bench.py` / `bash bench.sh` from the harness name.

## 08 Terminal-Bench: regex-chess

Write `/app/re.json`, a list of `[regex, replacement]` pairs that enumerate every
legal chess move from a FEN. Expert estimate 24 hours; the official verifier
replays four real games and takes 5 minutes per run.

| arm | approach | pairs | verifier | grade |
| --- | --- | --- | --- | --- |
| A reasoning only | fixed-width line, absolute-offset move patterns, king-attack post-filter | 6301 | 4 passed / 71.8s | pass |
| B reasoning + MVPs | same family, castling availability probed on the seed line, layered per-move patterns | 4963 | 4 passed / 45.9s | pass |

Arm B's spike ranked chained relative walkers first and it implemented the
absolute-offset family anyway, for layered testability — the third time an arm
overruled its own ranking on grounds the ranking could not express.

## 09 Terminal-Bench: feal-linear-cryptanalysis

Recover a FEAL-like cipher's four round keys from 32 known plaintexts and decrypt
100 ciphertexts. Expert estimate 16 hours.

| arm | approach | verifier | grade |
| --- | --- | --- | --- |
| A reasoning only | noticed F is byte-wise invertible, inverted each Feistel round in closed form, then a 2^20 hash join instead of 2^40 meet-in-the-middle | 1 passed | pass |
| B reasoning + MVPs | running | | |

## 10 Terminal-Bench: gpt2-codegolf

Write a dependency-free C program under 5000 bytes that loads the 497 MB GPT-2
124M checkpoint, tokenizes with vocab.bpe, and continues a prompt for 20 argmax
tokens. Expert estimate 40 hours; the reference implementation is 3271 bytes.

| arm | approach | bytes | verifier | grade |
| --- | --- | --- | --- | --- |
| A reasoning only | reverse-engineered the checkpoint as raw float32, recovered the tensor order empirically, found that the dump is name-sorted as strings so layers are h0,h1,h10,h11,h2,..., then a KV-cached forward pass and byte-level BPE | 4904 | 1 passed / 1.6s | pass |
| B reasoning + MVPs | spiked three C architectures (preload+KV cache, bf16-quantized, mmap+recompute); preload won at 607 ms vs 899 vs 3732 | 4860 | 1 passed / 1.0s | pass |

The first attempt at this task was abandoned mid-run by the host restart: its
`gpt2.c` was written at 8664 bytes and never golfed under the limit, so it scored
nothing. It was re-run from a pristine checkout with the same 90 minutes the other
arm had, and passed.

Both arms independently discovered the same trap: the checkpoint is a bare float32
dump in lexicographic tensor-name order, so the layer blocks are h0,h1,h10,h11,h2...
Running them in numeric order produces fluent but wrong text.

## 11 SWE-bench Pro (hard subset)

The public tier closest to Cognition's FrontierCode 2.0, whose tasks are private.
`instance_ansible__ansible-d62496fe`: `human_to_bytes` must reject malformed size
strings. Hidden tests installed and unreadable to the arm. Calibration: base +
test patch 22 failed / 107 passed; base + gold patch 129 passed.

| arm | change | tests | grade |
| --- | --- | --- | --- |
| A reasoning only | full-match ASCII parse, unit validation moved to a whitelist helper | 129 passed | pass |
| B reasoning + MVPs | three parsers spiked (anchored regex 1.24 us, char scanner 1.44 us, right-split 1.57 us); anchored regex won | 129 passed | pass |

Both found the same five bug classes without reading the tests: trailing prose,
units merely containing "byte", Unicode digits, leading whitespace, and silent
truncation at the first separator.

## 12 Terminal-Bench: fix-ocaml-gc

A deliberately broken OCaml 5.5 garbage collector: run-length compressed free runs
in the major heap, the compiler segfaults while bootstrapping itself, and the
`.git` directory is deleted so it cannot be reverted. Expert estimate 24 hours.

| arm | finding | evidence | grade |
| --- | --- | --- | --- |
| A reasoning only | `pool_sweep` advanced by `Whsize_hd(hd)` instead of the pool's fixed `wh`, so a freed block moved the scan one word and every later header was parsed from the middle of an object | one-line fix `p += wh`; `make` exits 0; `tests/basic` 40 passed | pass |

## 13 Terminal-Bench: write-compressor

Produce a `data.comp` of at most 2500 bytes that a supplied range-decoder-based
decompressor turns back into a 4868-byte text file.

| arm | approach | bytes | grade |
| --- | --- | --- | --- |
| A reasoning only | modelled the decoder exactly, built a constructive range encoder, optimal-parse LZ DP with iterative cost re-estimation | **2276** | pass |

## 15 Terminal-Bench: model-extraction-relu-logits

Recover the weight matrix `A1` of `A2*ReLU(A1x+b1)+b2` from **query access only**,
up to permutation and scaling.

| arm | approach | result | grade |
| --- | --- | --- | --- |
| A reasoning only | scan random lines for kinks; each kink's location follows in closed form from the two pure slopes, and the gradient difference across it is `+-A2[i]*A1[i,:]`; cluster those directions | 30x10 recovered, ratio error 2e-7 against a 1e-4 bar | pass |

## 16 Terminal-Bench: circuit-fibsqrt

Build `/app/gates.txt`, under 32000 lines, so the supplied gate simulator (only
`& | ^ ~` and constants) prints `fib(isqrt(N)) mod 2^32` for N on stdin.

| arm | approach | result | grade |
| --- | --- | --- | --- |
| A reasoning only | exploited the simulator's index-ordered relaxation: low-index copies of high-index signals act as flip-flops, so a combinational cone re-settles every step; 16 unrolled restoring-sqrt stages (threshold `(root<<2)|1`), then a state machine advancing the Fibonacci pair by 4 per step with a freeze counter | 3640 lines; 5447 host cases and 304 in-container cases, 0 mismatches | pass |

## What this establishes

Thirteen problems, thirteen ties, twenty-four arm runs, all graded by the same hidden suites:
the reasoning arm matched the MVP arm every time, including on the problems built
to separate them, and including the repository task with no design freedom. The premise that reasoning would pick the comfortable design
was wrong twice over (fsync-per-write, then full scan).

The MVP phase's observable contribution is not a better answer on familiar
ground, it is a *cheaper rejection*: it priced three designs in minutes and threw
out the failing one before any code was written. It also hardened the winner
afterwards, though those fixes (torn-tail resync, batch rejection, prefix
fallback) came from the arm, not from the tournament.

Across four difficulty tiers -- designed problems, a repository bug fix, a real
performance task, and Terminal-Bench tasks whose expert estimates run to 40 hours --
the reasoning arm never lost. Four times an arm overruled its own spike ranking for
a reason the criteria could not express, and one tournament returned an `unresolved`
verdict that the arm then settled by measuring both survivors at full size.

The honest reading: the tournament buys evidence, discarded alternatives and a
record of why, not better outcomes. It should only pay
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
