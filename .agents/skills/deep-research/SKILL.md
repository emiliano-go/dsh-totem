---
name: deep-research
description: Use when a question needs multi-source web research rather than a single lookup — evidence gathering, recursive source reading, cross-verification, and a cited report.
whenToUse: When asked to investigate, compare, fact-check, or produce a research report; when the first search leaves claims unverified or sources disagree; when the answer must cite primary sources.
---

# Deep research

The goal is evidence, not the first plausible page. Every load-bearing sentence
in the final report must trace to a source you actually read, at a URL you can
name, on a date you can state.

## The toolchain

Four MCP servers are wired by the `dsh-totem` bundle:

| Server | Use for |
| --- | --- |
| `searxncrawl` | Discovery and bulk extraction: `search` (multi-engine, metadata), `crawl` (one or many URLs → Markdown), `crawl_site` (docs sites) |
| `cluefinch` | Deep reading: `web_search`, `web_fetch` (chunked full text), `web_links` (source navigation), `research_collect` (bounded multi-source evidence) |
| `playwright` | Deterministic browser control for JS-rendered, authenticated, or interactive pages |
| `browser-use` | Multi-step agentic browsing when you need to drive a session and inspect state with Python |

Tool names are namespaced: `mcp__searxncrawl__search`,
`mcp__cluefinch__web_fetch`, `mcp__playwright__browser_navigate`, and so on.

Prefer the cheapest tool that gets the evidence: search → crawl → chunked fetch
→ browser. Do not open a browser for a page that `crawl` can read.

## Phase 0 — Frame the question

Before searching, write down:

- The question in one sentence, and what a correct answer would look like.
- 3–6 subquestions that together settle it.
- For each subquestion, the kind of evidence that would count (spec, dataset,
  official statement, measured result, first-hand report).
- A budget. Default: 20 searches, 12 distinct pages read in full, recursion
  depth 2, 15 minutes. Scale it; do not drift past it silently.

If the user's question is underspecified, state the interpretation you are
researching rather than asking a blocking question — unless the ambiguity
changes what evidence is relevant.

## Phase 1 — Query fan-out

For each subquestion, generate 3–4 genuinely different queries, not
rephrasings that share the same words:

1. **Canonical** — the standard term an expert would use.
2. **Exact phrase** — a quoted phrase from the primary source if known.
3. **Primary-source filter** — `site:` for the official docs, repository,
   standards body, journal, or filings.
4. **Contrarian / failure** — "limitations", "does not work", "vs", the
   competing implementation, the known bug.
5. **Local language** — when the subject is regional, search in that language.

Issue the searches **in parallel in one assistant turn**. Vary `engines`
(google, brave, duckduckgo, wikipedia, wikidata…) and `time_range` when
recency matters. Use `max_results: 10` for discovery; do not ask for 50 and
read none of them.

Record every query you ran. A report without its query trail is not
reproducible.

## Phase 2 — Triage sources

Rank, then discard:

1. **Primary** — official specifications, documentation, source repositories,
   release notes, datasets, papers, court filings, first-hand interviews.
2. **Reputable secondary** — reporting that names its sources and dates them.
3. **Derivative** — SEO roundups, content farms, AI-generated summaries,
   syndicated copies of a secondary piece.

Prefer the primary source over any article about it. A GitHub release page
beats a blog post announcing the release. A paper beats an article about the
paper. When the same text appears on several domains, keep the original.

Check before trusting a page: publication date, author/org, whether it links
its own claims, and whether it is still current for the question.

## Phase 3 — Read, do not skim

- `searxncrawl.crawl` one or several URLs at once. Request Markdown, strip
  links only when you do not need to follow them.
- `searxncrawl.crawl_site` for documentation sites: `max_depth: 2`,
  `max_pages: 15–25`, and the docs root as the seed.
- `cluefinch.web_fetch` for long documents: read in chunks with
  `start_offset`/`max_chars`, follow `expected_content_hash` across chunks,
  and stop when the relevant sections are covered. Never cite a page you only
  saw as a snippet.
- `cluefinch.web_links` when a page's own structure is the map: chapters,
  pagination, cited references, related specifications.

Maintain a claim ledger as you read: claim → source URL → exact supporting
passage → date → confidence. If a claim has no passage, it is not evidence.

## Phase 4 — Follow citations recursively

Follow links that plausibly carry the claim, not every link on the page:

- depth 1: the page's cited references and "learn more" primary sources;
- depth 2: the references of those references, only when depth 1 was
  secondary or ambiguous;
- stop at primary sources, dead ends, or the depth budget.

Use `web_links` to enumerate and select, then `crawl`/`web_fetch` the chosen
pages. Do not recurse into navigation, ads, author bios, or unrelated
"related posts".

## Phase 5 — Gap loop

After reading, classify every subquestion as **supported**, **contradicted**,
or **missing**. For each missing or contradicted item:

- re-search with new wording, a different engine, a different language, or the
  primary-source filter;
- look for the dataset, changelog, issue tracker, or standard that would settle
  it;
- if two credible sources disagree, find the upstream cause (different
  versions, dates, definitions, populations) and report the disagreement
  explicitly instead of picking a side.

Stop when the budget is exhausted, two consecutive loops add no new
load-bearing evidence, or every load-bearing claim has primary corroboration.

## Phase 6 — Verify before writing

- **Independence:** two sources count as independent only when neither derives
  from the other. Syndicated copies, press-release reprints, and articles citing
  the same single source are one source.
- **Load-bearing claims** need either one primary source or two independent
  secondary sources.
- **Numbers** need a source, a unit, a date, and a definition.
- **Time-sensitive claims** need the retrieval date and the version.
- **Negative claims** ("X does not support Y") need a primary source that says
  so, not the absence of evidence.

Mark anything you could not verify. An explicit "unverified" is honest; a
confident sentence built on a snippet is not.

## Phase 7 — Report

Answer first, then evidence. Use this shape unless the user asked for another:

```markdown
## Answer
<2–5 sentences that directly answer the question.>

## Evidence
| # | Claim | Sources | Confidence |
|---|-------|---------|------------|
| C1 | ... | [S1], [S3] | high / medium / low |

## Details
<Organized by subquestion. Inline citations [S1] on every factual sentence.>

## Contradictions and gaps
<Where sources disagree, what could not be verified, what would settle it.>

## Sources
| # | Source | Type | Published / retrieved |
|---|--------|------|-----------------------|
| S1 | Title — https://full.url | primary | 2026-03-04 / 2026-11-17 |

## Method
Queries run: ... · Pages read: ... · Recursion depth: ... · Budget used: ...
```

Rules:

- Cite the full URL, never "the docs" or a bare domain.
- Distinguish **fact** (sourced), **inference** (your reasoning over sources),
  and **unverified** (could not confirm).
- Do not pad with a source list you did not read.
- If the evidence is insufficient, say so and name the missing evidence.

## Failure modes to avoid

- Searching once and writing from snippets. Snippets are discovery, not
  evidence.
- Treating search-result consensus as truth: ten SEO articles can share one
  uncited origin.
- Following citation chains into unrelated pages and calling it depth.
- Letting a contradiction disappear into a smooth summary.
- Reporting a retrieval date you did not record.
- Exceeding the budget without saying so.
