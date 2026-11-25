# Report format

Generate the skeleton with `scripts/research.ts report`; fill it without
removing the required sections. `check --strict` requires `## Answer`,
`## Evidence`, and `## Sources`, and requires every claim id to appear.

## Shape

```markdown
# <question>

## Answer
<2–5 sentences that directly answer the question. State the verdict before the
qualification.>

## Evidence
| # | Claim | Sources | Confidence |
|---|-------|---------|------------|
| C1 | ... | [S1], [S3] | high / medium / low |

## Details
<Organized by subquestion. Inline [S#] on every factual sentence. Inferences are
marked as inference. Unverified statements are marked unverified.>

## Contradictions and gaps
<Where credible sources disagree, why, and what would settle it. What could not
be verified. What is out of scope.>

## Sources
| # | Source | Type | Published / retrieved |
|---|--------|------|-----------------------|
| S1 | Title — https://full.url | primary | 2026-03-04 / 2026-11-20 |

## Method
Queries: N · Pages: N · Depth: N · Budget used: ...
```

## Rules

- **Answer first.** A reader who stops after five sentences still has the
  answer and the main caveat.
- **One claim per row.** The evidence table is an index, not a summary.
- **Confidence is per claim**, not for the whole report.
- **Distinguish fact, inference, unverified.** "Source X says Y" is fact;
  "therefore Z" is inference; "I could not confirm W" is unverified.
- **Contradictions stay visible.** Do not average two incompatible numbers.
  Explain the version, date, definition, or population that differs.
- **No source padding.** Do not list a source you did not read.
- **No orphan citations.** Every `[S#]` resolves to the source table; every
  source in the table is cited at least once.
- **Method is reproducible.** List the query trail, pages read, recursion depth,
  and budget used. If you exceeded the budget, say by how much and why.

## Length

A short question gets a short report. Do not inflate with background that does
not serve the answer. A deep report is long because the evidence is complex,
not because the template demands words.
