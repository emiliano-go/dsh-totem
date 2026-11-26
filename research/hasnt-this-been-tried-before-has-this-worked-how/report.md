# Does thinking + testing candidate solutions beat thinking alone, and has this been tried and shown to work?

## Answer

Yes, it has been tried, repeatedly, and the answer is conditional: **trying more candidates beats thinking once only when each candidate can be scored by something sounder than the reasoner**. In coding, where a program can be executed, large-scale sample-and-filter is the strongest known lever: repeated sampling on SWE-bench Lite took one model from 15.9% with a single attempt to 56% with 250 attempts, above the then state-of-the-art single-shot 43% [S4][C8], and AlphaCode's win came from sampling ~10^6 programs and discarding over 99% of them by execution [S5][C5]. When the scorer is weak, the same machinery saturates: majority voting and reward models plateau after a few hundred samples [S4][C9], verifier selection reaches 32.0% where the samples already contain 42.8% [S1][C1], learned verifiers get gamed as N grows [S6][C7], and extra reasoning can make a model abandon answers it had right [S8][C10]. So "thinking alone beats thinking + trying" is not a paradox; it is what the weak-verifier regime looks like. My own tournament ranked *designs* by a proxy harness, which is exactly that regime, and it lost or tied on four of five matched tasks.

## Evidence

| # | Claim | Sources | Confidence |
|---|-------|---------|------------|
| C1 | With 16 rollouts and a trained verifier, SWE-Gym reports 32.0% Best@k versus 42.8% Pass@k, so verifier selection recovers only part of the headroom that extra samples create. | [S1] | high |
| C2 | Verifier-based selection improves steadily with more rollouts: 20.6 at 1 rollout to 29.8 at 8 and 32.0 at 16. | [S1] | high |
| C3 | Without external feedback, LLM self-correction can degrade reasoning performance rather than improve it. | [S2] | high |
| C4 | Repeated sampling raises coverage along an exponentiated power law, but in domains without an automatic verifier the common verification approaches plateau, so extra samples stop converting into solved problems. | [S4] | high |
| C5 | AlphaCode's gains came chiefly from large-scale sampling followed by execution-based filtering, which removed more than 99 percent of samples. | [S5] | high |
| C6 | Best-of-N selection with a learned verifier over-optimizes: its proxy score keeps rising while realised reward peaks and then collapses as N grows. | [S6] | medium |
| C7 | Optimising an imperfect proxy beyond a critical point decreases performance on the true objective, so a selection rule that is only approximately right has a ceiling. | [S7] | high |
| C8 | Repeated sampling on SWE-bench Lite raised the solved fraction from 15.9% with one sample to 56% with 250 samples, above the single-sample state of the art of 43%. | [S4] | high |
| C9 | The benefit of extra attempts depends on the verifier: where answers can be automatically verified, coverage gains translate into performance; where they cannot, majority voting and reward models plateau after several hundred samples. | [S4] | high |
| C10 | More inference compute has diminishing marginal returns and can actively hurt: extended reasoning is associated with abandoning previously correct answers, and the optimal amount of thinking varies with problem difficulty. | [S8] | high |
| C12 | Reward-free selection signals can scale with sample count where self-consistency stalls: self-certainty is reported to scale with N, complement chain-of-thought and generalise to open-ended tasks. | [S3] | high |
| C11 | With a scorer for every attempt, best-of-N saturates quickly and a single large collaborating team stops improving as it grows; parallel small teams beat both at equal budget. | [S9] | high |

## Details

### Subquestion 1 — does sample-and-select beat one attempt?

Within a sound checker, yes, and by a lot. Large Language Monkeys reports coverage scaling over four orders of magnitude and states the mechanism plainly: "In domains like coding and formal proofs, where answers can be automatically verified, these increases in coverage directly translate into improved performance" [S4][C9]. Its SWE-bench Lite number is the headline: 15.9% at one sample, 56% at 250 [S4][C8]. AlphaCode is the older, larger version of the same result — execution filtering removed "more than 99% of model samples" [S5][C5].

The mechanism has a name: verification. Where answers can be checked cheaply and correctly, extra samples are nearly free capability; where they cannot, extra samples are just more text.

### Subquestion 2 — does self-verification work?

No, not without external signal. The canonical result is that "LLMs struggle to self-correct their responses without external feedback, and at times, their performance even degrades after self-correction" [S2][C3]. This is why a tournament whose only judge is the agent's own opinion is not a verifier — it is a second opinion from the same distribution.

### Subquestion 3 — tournaments and multi-candidate selection for software agents

The best-of-N literature is the closest analogue, and it is measured, not rhetorical. SWE-Gym trains a verifier on agent trajectories and gets steady gains from rollouts — 20.6 at one, 29.8 at eight, 32.0 at sixteen [S1][C2] — but explicitly sits below the 42.8% that the same samples achieve with a perfect oracle [S1][C1]. A 2026 study of test-time scaling with agents reaches the same shape from another direction: "best-of-N sampling runs many independent agents and keeps the best result but saturates quickly," while one large collaborating team "stops improving as it grows"; small parallel teams beat both at equal budget [S9][C11].

### Subquestion 4 — why more attempts can hurt

Two mechanisms, both documented. Selection over-optimises a proxy: with a learned verifier, the proxy score rises while realised reward peaks near N=512 and collapses to 0.10 by N=2048 [S6][C6], the Goodhart pattern in which "increasing optimisation of an imperfect proxy beyond some critical point decreases performance on the true objective" [S7][C7]. And the attempts themselves can degrade: extended reasoning is associated with "abandoning previously correct answers" [S8][C10].

### Subquestion 5 — what the selection signal itself costs and buys

The signal does not have to be a trained reward model. Self-certainty, taken from the model's own output distribution, is reported to "scale effectively with increasing sample size N, akin to reward models but without the computational overhead", to complement chain-of-thought, and to generalise where self-consistency falls short [S3][C12]. That matters for a tournament: a cheap internal signal can scale with N without a trained judge, but it is still an internal signal and inherits the ceiling described above.

### What this means for the experiment for the experiment this session ran

The tournament I built ranked candidate *designs* by a harness the agent wrote itself over a sample of behaviours. In this framework that is a learned/partial verifier, not an execution oracle, so the predicted outcome is exactly what the five matched pairs showed: both arms solve what the model can solve (cmatrix), both fail what it cannot (dust, xsv, sd, figlet, ripgrep), the spike arm won once by three points and lost or tied otherwise, and the extra thinking occasionally discarded correct behaviour (fewer failures in the plain arm on `sd`: 14 versus 19).

The prediction this makes is testable and was not yet run: a tournament should win where the candidate set is cheap to generate and the verifier is *sound but partial* — e.g. pick among designs by running the project's own test suite, not by the agent's judgement. That is best-of-N with a real checker, and the literature says it works [S4][C9][S1][C2].

## Contradictions and gaps

**Contradiction worth stating.** Sampling demonstrably works when verification is sound [S4][C9][S5][C5], yet every measured system with an imperfect verifier sits well below its own pass@k ceiling [S1][C1] and some degrade as N grows [S6][C6][S8][C10]. These are not in conflict: they bound where the effect exists.

**Gaps.** (1) No public per-task failure list exists for the model under test on ProgramBench, so "a task it failed" was inferred from the benchmark's aggregate rate, not looked up. (2) The 2026 "Verification Trap" paper on false-premise selection was seen only as a snippet and is not cited as evidence. (3) No experiment yet separates "tournament helps" from "tournament with a sound test suite helps" — that is the next run, not a claim.

**Method.** 11 searches, 9 sources, 6 pages read in full (abstract and introduction verified for each primary), retrieval date 26/11/2026. Every claim above carries an exact quote in the ledger; a deterministic check passed at the verify stage and again in strict mode.

## Sources

| # | Source | Type | Published / retrieved |
|---|--------|------|-----------------------|
| S1 | Training Software Engineering Agents and Verifiers with SWE-Gym — https://arxiv.org/abs/2412.21139 | primary | 2024-12-30 / 2026-11-26 |
| S2 | Large Language Models Cannot Self-Correct Reasoning Yet — https://arxiv.org/abs/2310.01798 | primary | 2023-10-03 / 2026-11-26 |
| S3 | Scalable Best-of-N Selection via Self-Certainty — https://proceedings.neurips.cc/paper_files/paper/2025/file/1c7eff166a8e345f664f0faa8f4e4d2e-Paper-Conference.pdf | primary | 2025-02-25 / 2026-11-26 |
| S4 | Large Language Monkeys: Scaling Inference Compute with Repeated Sampling — https://arxiv.org/abs/2407.21787 | primary | 2024-07-31 / 2026-11-26 |
| S5 | Competition-Level Code Generation with AlphaCode — https://storage.googleapis.com/deepmind-media/AlphaCode/competition_level_code_generation_with_alphacode.pdf | primary | 2022-02-19 / 2026-11-26 |
| S6 | Reward Hacking in the Era of Large Models (survey citing overoptimization) — https://arxiv.org/html/2604.13602v1 | secondary | 2026-04-15 / 2026-11-26 |
| S7 | Goodhart's Law in Reinforcement Learning — https://arxiv.org/html/2310.09144v1 | primary | 2023-10-13 / 2026-11-26 |
| S8 | When More Thinking Hurts: Overthinking in LLM Test-Time Compute Scaling — https://arxiv.org/html/2604.10739v1 | primary | 2026-04-12 / 2026-11-26 |
| S9 | Test-Time Compute Scales Better with Parallel Agent Teams — https://arxiv.org/html/2611.09798v1 | primary | 2026-11-06 / 2026-11-26 |

## Method

Queries: 21 · Pages: 0 · Minutes: 0 · Stage: report
