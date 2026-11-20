---
name: deep-research
description: Use when a question needs multi-source web research rather than a single lookup — staged investigation, breadth-first landscape mapping, deep primary-source reading, contradiction and boundary closure, verification, and a cited report.
whenToUse: When asked to investigate, compare, fact-check, or produce a research report; when the first search leaves claims unverified or sources disagree; when the answer must cite primary sources; when the task is large enough that a compacted or restarted session must resume mid-research.
---

# Deep research

The goal is evidence, not the first plausible page. The work is staged, and the
stage state is written to disk so a compacted or restarted session resumes
instead of starting over.

## The operating contract

1. Create a run before searching. This writes `research/<slug>/state.json`:
   ```bash
   bun <skill-dir>/scripts/research.ts init \
     --question "<one sentence>" \
     --subquestion "<thread 1> :: <what evidence would settle it>" \
     --subquestion "<thread 2> :: ..." \
     --subquestion "<thread 3> :: ..."
   ```
2. Work one stage at a time. Add sources and claims **as you read**, not at the
   end. After each stage, record the gate and advance:
   ```bash
   bun <skill-dir>/scripts/research.ts gate pass --note "landscape mapped"
   bun <skill-dir>/scripts/research.ts advance
   ```
3. Before writing the report, close every gap and run `check`. A failed check is
   a blocker, not a suggestion:
   ```bash
   bun <skill-dir>/scripts/research.ts check
   ```
4. Generate the report skeleton, fill it, then run the strict check:
   ```bash
   bun <skill-dir>/scripts/research.ts report
   bun <skill-dir>/scripts/research.ts check --strict
   ```
5. Finish with a red-team pass; see [references/stages.md](references/stages.md).

`<skill-dir>` is the base directory of this skill. If `research/` contains more
than one run, pass `--dir research/<slug>` to every command.

## Stages and gates

| # | Stage | Goal | Gate question |
|---|-------|------|---------------|
| 0 | `brief` | One-sentence question, 3–6 subquestions, evidence type per subquestion, budget, scope in/out. | Is the question answerable and the scope bounded? |
| 1 | `landscape` | Big picture: taxonomy, key terms, actors, timeline, 3 competing narratives, source-quality map. | Can you name the map and the 5 sources worth reading deeply? |
| 2 | `plan` | Threads, hypotheses, evidence matrix, primary-source targets, query fan-out, effort split. | Is every subquestion testable and assigned a budget? |
| 3 | `depth` | Read primary sources fully, follow citations to depth 2, record claims with exact quotes. | Does every thread have primary evidence? |
| 4 | `midpoint` | Coverage matrix (supported / contradicted / missing); decide continue, refocus, or stop. | Is the remaining work worth its cost? |
| 5 | `edges` | Contrarian and failure queries, boundary conditions, alternative explanations, recency and coverage checks. | Are the edges named and the disconfirming evidence sought? |
| 6 | `verify` | Independence and citation checks, number/date/unit checks, negative claims, gap closure. | Does every load-bearing claim meet the evidence rule? |
| 7 | `report` | Answer-first report with evidence table, details, contradictions, sources, method. | Does the report answer the brief and cite every factual sentence? |
| 8 | `redteam` | What would falsify the conclusion? What stakeholder or source was omitted? Archive state. | Would you bet on this conclusion? |

Full stage playbook: [references/stages.md](references/stages.md).

## Working with the ledger

- **Source**: `source add --id S1 --url <url> --type primary|secondary [--title] [--publisher] [--published] [--derived-from S0]`
- **Claim**: `claim add --id C1 --statement "<claim>" --source S1 [--source S2] --quote "<exact passage>" --confidence high|medium|low [--status supported|contradicted|unverified] [--subquestion Q1]`
- **Gap**: `gap add --id G1 --kind missing|contradicted --note "<what is missing>" --next "<cheapest way to get it>"`; close with `gap close --id G1 --evidence "<what settled it>"`.
- **Budget**: `budget searches|pages|minutes <n>` after each batch.
- **Status**: `status [--json]` is the resume entry point.

The check is deterministic: a high-confidence supported claim needs a primary
source, or two independent secondaries, plus a non-empty quote. Two secondaries
are independent only when their domains differ and neither derives from the
other. Open gaps block the verify stage. The report must contain `## Answer`,
`## Evidence`, and `## Sources`; `--strict` also requires every claim id to
appear in the report.

## Effort scaling

| Task | Threads | Tool calls |
|------|---------|------------|
| Simple fact | 1 | 3–10 |
| Comparison | 2–4 | 10–15 per thread |
| Complex, multi-field | 5–10+ | divided by responsibility |

Default budget: 25 searches, 15 pages read in full, 45 minutes. State it if you
exceed it; the check warns on overruns.

## Hard rules

- Start wide, then narrow. Do not begin with a long, specific query unless you
  already know the exact source.
- Read the page before citing it. A snippet is discovery, not evidence.
- Prefer primary sources (specs, docs, repos, papers, filings, first-hand
  reports); drop syndicated copies and SEO roundups.
- Every load-bearing sentence traces to a claim in the ledger with a source and
  a quote. If it is not in the ledger, it is not evidence.
- Report contradictions instead of smoothing them away. Unresolved gaps stay
  explicit.
- Never write the report before `check` passes; never hand-wave a failed check.
- Record retrieval dates and versions for time-sensitive claims.

## Toolchain

| Server | Use for |
| --- | --- |
| `searxncrawl` | Discovery and bulk extraction: `search`, `crawl`, `crawl_site`. |
| `cluefinch` | Deep reading: `web_search`, `web_fetch`, `web_links`, `research_collect`. |
| `playwright` | JS-rendered, authenticated, or interactive pages. |
| `browser-use` | Multi-step agentic browsing with Python state inspection. |

Tool names are namespaced (`mcp__searxncrawl__search`, `mcp__cluefinch__web_fetch`, …).
Prefer the cheapest tool that gets the evidence: search → crawl → chunked fetch
→ browser.

## Resuming

On a new turn, after compaction, or after a restart:

1. `status` (or read `research/<slug>/state.json`).
2. Find the current stage and its gate.
3. Continue from the ledger; do not re-run completed searches or re-add sources.
4. If the stage is `report`, read the draft before editing it.

Anthropic’s production research system resumes from checkpoints, summarizes
completed phases to external memory, and hands fresh subagents a state summary
instead of the whole transcript. This skill applies the same principle at the
task level.

## References

- [references/stages.md](references/stages.md) — stage-by-stage playbook, queries, gates.
- [references/verification.md](references/verification.md) — independence, numbers, negative claims, ACH, source quality.
- [references/report.md](references/report.md) — report structure and citation rules.
