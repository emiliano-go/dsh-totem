# Verification rules

The check script enforces the mechanical rules. This file explains the
judgment calls around them.

## Evidence rule

A **load-bearing claim** is any sentence that changes the answer, the
recommendation, or the confidence. It needs:

- one **primary** source, or
- two **independent secondary** sources.

Primary means the thing itself: specification, official documentation, source
repository, release note, dataset, paper, filing, first-hand report. Secondary
means reporting about it that names its sources. Derivative means SEO roundups,
content farms, AI summaries, and syndicated copies — not evidence.

The script treats a high-confidence supported claim as load-bearing. If a claim
is high confidence without a primary source or two independent secondaries, it
fails the check.

## Independence

Two sources are independent only when neither derives from the other. The
script's deterministic approximation:

- different hostnames, and
- neither source lists the other in `--derived-from`.

That catches syndication and "article about the same press release," but not
two outlets that both interviewed the same person. Record that in the claim's
notes or in a gap when it matters.

Ask: if source A disappeared, would source B still exist and say the same
thing? If not, they are one source.

## Quotes and citations

- Add the exact passage to the claim (`--quote`). A paraphrase is not a quote.
- Open the URL and confirm the quote appears on the page, not in the snippet.
- Cite the full URL in the report; never "the docs" or a bare domain.
- Every factual sentence in the report carries an inline `[S#]`.
- The source table lists every cited source, with type and published/retrieved
  dates.

## Numbers

Every number needs:

- the value and unit,
- the date or version it applies to,
- the definition (what is counted, over what population),
- the source.

"Usage fell 84%" is incomplete. "Context editing cut token consumption by 84%
on Anthropic's 100-turn internal eval (retrieved 20/11/2026)" is a claim.

## Negative claims

"X does not support Y" needs a primary source that says so, not the absence of
evidence. If you could not find support, write "I could not verify that X
supports Y" and mark it unverified.

## Time and version

Time-sensitive claims need a retrieval date and a version. Check whether a
newer release, ruling, or dataset supersedes the source. When two credible
sources disagree, first check whether they are describing different versions,
dates, definitions, or populations.

## Analysis of competing hypotheses (edge closure)

For a contested question:

1. List every plausible hypothesis, including the boring one.
2. List the evidence.
3. Build a matrix: consistent / inconsistent / not diagnostic for each
   hypothesis.
4. Prefer the hypothesis with the least inconsistent evidence, not the one with
   the most supporting evidence.
5. Ask what new evidence would discriminate between the survivors.

The point is to stop collecting support for your favorite explanation.

## Confidence levels

- **high** — primary source read in full, quote checked, no credible conflict.
- **medium** — primary source plus ambiguity, or two independent secondaries
  that agree, or a strong secondary with named sources.
- **low** — single secondary source, indirect evidence, or unresolved conflict.
- **unverified** — could not confirm; say so in the report.

Do not use "high" for a claim you only saw in a snippet.

## Source quality heuristics

- Prefer the primary source over any article about it.
- A GitHub release or repository beats a blog announcing it.
- A paper beats an article about the paper.
- A regulator filing beats a news summary of the filing.
- Check publication date, author/org, and whether the page links its own claims.
- Treat a page that cites no sources as a lead, not evidence.
- Ten pages with the same text are one source.
