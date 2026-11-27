# How can a multi-candidate tournament for coding agents convert more failures into solves?

## Answer

Four levers move the number, and only one of them is about trying harder. **Diversity** decides whether the candidates contain a solution at all — parallel sampling is "sharply limited by diversity collapse, where models concentrate on a few modes and repeated samples produce the same mistakes" [S3][C1], and a training-free prompt that asks for a distribution over responses raises diversity 1.6-2.1x [S1][C2]. **Selection** decides whether the best candidate is found: scoring candidates jointly rather than one at a time improves verification by up to 7 points and reaches the same peak at 17-42% lower cost [S4][C3]. **Feedback** decides whether round two is better than round one: a single model can refine itself with its own feedback for about +20 points on average [S2][C5], but only where that feedback carries real information. **The bias ceiling** caps all of it: extra compute reduces variance while ranking bias plateaus [S4][C4], which is why adding candidates alone stops closing the pass@N gap. For this repository the order of work is therefore: make the candidates actually different, score them together, feed failures back, and stop when the oracle's verdict stops moving.

## Evidence

| # | Claim | Sources | Confidence |
|---|-------|---------|------------|
| C1 | Parallel sampling is limited by diversity collapse: models concentrate on a few modes and repeated samples repeat the same mistakes; allocating compute across modes improves scaling and the attainable Pass@k. | [S3] | high |
| C2 | A training-free prompt that asks the model to verbalize a distribution over responses raises output diversity by 1.6-2.1x in creative writing. | [S1] | high |
| C3 | Scoring candidates jointly rather than one at a time improves verification by up to 7 percentage points and reaches the same peak accuracy at 17-42% lower cost. | [S4] | high |
| C4 | More selection compute reduces variance but the ranking bias plateaus, which is why adding candidates does not reliably close the gap to pass@N. | [S4] | high |
| C5 | One model can iteratively refine its own output with self-feedback and gain about 20 points on average across seven tasks, without extra training. | [S2] | medium |

## Details

### Q2 — diversity is the cheapest gain

Candidates that differ only in wording are one candidate paid three times. Mode-conditioning allocates compute across reasoning modes and improves scaling and the maximum attainable Pass@k [S3][C1]; verbalized sampling gets 1.6-2.1x more diversity from the same model with no training [S1][C2]. Concrete change here: measure candidate distance (diff size, distinct files, distinct strategy labels) and warn when they converge, the same way `unresolved` already warns about noise.

### Q4 — score candidates together, not one at a time

Scorpio's result is that joint scoring of randomly grouped candidates beats independent pointwise scoring: up to 7 points better, and the same peak accuracy at 17-42% lower cost [S4][C3]. For the tool that means a verify command that compares candidates against each other — a tournament bracket or a shared corpus — rather than three isolated scores that may be measuring different workloads (the current `comparability` warning exists precisely because this was observed).

### Q3 — feedback loops need information, not iteration

Self-Refine reports ~20 points average from self-feedback [S2][C5], but the earlier run in this repository found the opposite once the feedback was the model's own opinion: it abandoned correct behaviour. The reconciliation is what `rounds` already encodes: feedback must be the oracle's output.

### Q5 — the ceiling is ranking bias

"additional compute reduces variance, while bias initially decreases before approaching a plateau" [S4][C4]. Variance is what more candidates fix; bias is what a better verifier fixes. That is why the coverage simulation found 94% selection accuracy at twenty discriminating checks and 25% at zero.

### What to change, in order

1. Diversity check on the candidate set, surfaced next to `unresolved`.
2. A cross-candidate verification mode (one shared corpus, candidates compared together, not isolated runs).
3. Keep `rounds` fed only by oracle output; never by the agent's own assessment.
4. Budget stop when the oracle's pass count stops improving between rounds.

## Contradictions and gaps

**Where the sources disagree.** Self-Refine reports large gains from self-feedback [S2]; the earlier research in this repository found self-correction degrading without external feedback, and the limits paper shows the ranking bias plateau [S4][C4]. These are compatible if self-feedback only works where the task admits an internal check (e.g. code that can be run), which is exactly the code setting, not the reasoning setting.

**Gaps.** No source isolates "tournament of designs" from "best-of-N of implementations"; the closest measured analogue is best-of-N with verifiers. No numbers exist for pairwise tournaments on repo-level coding tasks at this scale.

**Method.** 9 searches, 4 primary sources read in full (abstracts), retrieval date 26/11/2026. Every claim carries an exact quote in the ledger; deterministic check passed at verify and in strict mode.

## Sources

| # | Source | Type | Published / retrieved |
|---|--------|------|-----------------------|
| S1 | Verbalized Sampling: How to Mitigate Mode Collapse and Unlock LLM Diversity — https://arxiv.org/abs/2510.01171 | primary | 2025-10-01 / 2026-11-27 |
| S2 | Self-Refine: Iterative Refinement with Self-Feedback — https://arxiv.org/abs/2303.17651 | primary | 2023-03-30 / 2026-11-27 |
| S3 | Mode-Conditioning Unlocks Superior Test-Time Scaling — https://arxiv.org/abs/2512.01127 | primary | 2025-11-30 / 2026-11-27 |
| S4 | On the Limits of Test-Time Compute for Self-Evaluation — https://arxiv.org/abs/2611.00350 | primary | 2026-10-30 / 2026-11-27 |

## Method

Queries: 9 · Pages: 0 · Minutes: 0 · Stage: report
