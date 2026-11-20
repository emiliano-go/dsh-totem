# Stage playbook

Each stage has one job, one gate, and one artifact. Do not advance until the
gate question can be answered without hedging. Use `scripts/research.ts` for
the state transitions and ledger.

## 0. Brief

**Job:** turn a request into an answerable research question.

- One sentence: the question.
- The decision it informs and the audience.
- Date sensitivity: what must be true "as of" when?
- Scope in and out; what would be out of scope even if interesting.
- 3–6 subquestions. Each gets the evidence type that would settle it:
  specification, dataset, official statement, measured result, first-hand report.
- Budget: searches, pages, minutes. Default 25 / 15 / 45. Scale by task.

**Gate:** the question is answerable, the scope is bounded, and each
subquestion has an evidence type.

**Failure:** a question so broad that any report would be a survey ("what is the
best AI?"). Narrow it or split it.

## 1. Landscape

**Job:** see the big picture before drilling.

- 10–15 broad queries: canonical term, adjacent term, competing school, timeline.
- Skim 15–25 sources; read only the 3–5 that define the field.
- Build: taxonomy of approaches, key terms and disputed definitions, actors,
  timeline, and **three competing narratives** about the topic.
- For each narrative, name the sources that would support and challenge it.
- Note source quality: primary docs/repos/papers vs reporting vs SEO.

**Queries:** start short and broad ("topic overview", "topic taxonomy",
"topic vs", "topic limitations", field review). Do not start with a long
specific query unless you already know the exact source.

**Gate:** you can name the map, the disputed terms, the three narratives, and
the five sources worth reading deeply.

**Failure:** ten sources that all cite the same origin. That is one source.

## 2. Plan

**Job:** convert the map into testable threads.

For each subquestion:

- Hypothesis: what you expect to find.
- Evidence that would support it and evidence that would refute it.
- Primary-source targets (spec, repo, paper, filing, dataset).
- Query fan-out: 3–4 genuinely different queries (canonical, exact phrase,
  `site:` primary filter, contrarian/failure, local language if relevant).
- Effort: 1 thread/3–10 calls for a fact; 2–4 threads/10–15 calls each for a
  comparison; 5–10+ threads for a complex question.

Deduplicate queries across threads; assign ownership if subagents are used.

**Gate:** every subquestion is testable, has a source target, and has a budget.

**Failure:** threads that are just restatements of the same question.

## 3. Depth

**Job:** read, don't skim.

- Work one thread at a time.
- Read the primary source fully. Use `crawl` for pages, `crawl_site` for docs,
  `web_fetch` for long documents, `web_links` for citation navigation.
- Follow cited primary sources to depth 2, then stop.
- Record every load-bearing claim as you go:
  ```bash
  bun <skill-dir>/scripts/research.ts source add --id S1 --url <url> --type primary --title "..."
  bun <skill-dir>/scripts/research.ts claim add --id C1 --statement "..." --source S1 --quote "..." --confidence high
  ```
- Keep a contradiction log: claim, source A says, source B says, which is
  upstream (different version, date, definition, population).

**Gate:** every thread has at least one primary source, and the claims that
matter have exact quotes.

**Failure:** citing a page from a snippet; ten pages that are the same
syndicated article; a citation chain into unrelated pages.

## 4. Midpoint

**Job:** decide whether the current plan is still the right plan.

Build a coverage matrix per subquestion: **supported / contradicted / missing**.
Then:

- Kill threads that are not load-bearing.
- Name the missing evidence and the cheapest way to get it.
- Reallocate budget to the two or three gaps that could change the answer.
- Decide: continue, refocus, or stop (with a stated reason).

**Gate:** the remaining work is worth its cost; the next action is written down.

**Failure:** continuing to search because stopping feels premature, or stopping
because the first three results agree.

## 5. Edges

**Job:** close the boundary, not just the center.

For every major claim:

- One contrarian query ("limitations", "does not work", "failed", "criticism").
- One failure/boundary case (old version, small sample, different region,
  different model, edge user).
- One alternative explanation (ACH-style): list the hypotheses and ask which
  evidence discriminates between them.
- Recency and version check: is the claim still true as of the retrieval date?
- Coverage check: which stakeholder, region, or segment is missing?

Record each as a gap and close it with evidence:
```bash
bun <skill-dir>/scripts/research.ts gap add --id G1 --kind missing --note "No non-US data" --next "Search EU regulator filings"
bun <skill-dir>/scripts/research.ts gap close --id G1 --evidence "Found EU filing S7"
```

**Gate:** every major claim has a named boundary and at least one disconfirming
search; open gaps are closed or explicitly out of scope.

**Failure:** a smooth report with no limitations section; treating absence of
evidence as evidence of absence.

## 6. Verify

**Job:** prove the claims, not the narrative.

Run:

```bash
bun <skill-dir>/scripts/research.ts check
```

Fix every error. Then do the human checks the tool cannot:

- Open every cited URL; does it resolve and say what the quote says?
- Is each secondary source independent, or a syndicated copy?
- Do numbers have source, unit, date, and definition?
- Do negative claims have a primary source that says so?
- Is anything "unverified" presented as fact?

**Gate:** every load-bearing claim passes the evidence rule; no open gaps that
affect the answer.

## 7. Report

**Job:** answer first, evidence second.

Generate the skeleton, then fill it:

```bash
bun <skill-dir>/scripts/research.ts report
bun <skill-dir>/scripts/research.ts check --strict
```

See [report.md](report.md). The strict check requires every claim id to appear
in the report and every required section to exist.

**Gate:** the report answers the brief, every factual sentence has a citation,
and the gaps section is honest.

## 8. Red team

**Job:** try to break your own conclusion.

- What evidence would change the answer? Did you look for it?
- What is the strongest counter-argument? Is it in the report?
- Which stakeholder or source was omitted?
- Is the confidence calibrated, or does it read more certain than the evidence?
- Archive the state and report so a later session can resume or audit.

**Gate:** you would bet on the conclusion, and the report says what would
falsify it.
