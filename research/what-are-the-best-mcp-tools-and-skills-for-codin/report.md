# What are the best MCP tools and skills for coding — frontend design, unslopping UI, backend quality, and cybersecurity — as of 20/11/2026?

## Answer

There is no universal “best” stack; the defensible core is **few servers that each close a loop**. For coding, that means GitHub MCP for the repository, Context7 for version-correct docs, one browser server (Playwright for persistent exploration, Chrome DevTools for performance/debugging), and Sentry once there is production traffic [S1][S2][S3][S4][S5]. For frontend work, the strongest combination is **shadcn MCP for real components + Figma MCP for real design context + Anthropic’s `frontend-design` skill for anti-template judgment**, then a browser pass to verify the result [S6][S7][S8]. For backend work, prefer **provider-native database servers in read-only mode** (Supabase) or **Postgres MCP Pro in restricted mode**; Neon’s server is explicitly dev-only [S9][S10][S11]. For security, use layered tools — **Semgrep for SAST, Trivy for containers/filesystems, Burp for DAST** — and treat the MCP layer itself as an attack surface with OWASP’s MCP Top 10 [S12][S13][S14][S16].

## Evidence

| # | Claim | Sources | Confidence |
|---|-------|---------|------------|
| C1 | GitHub’s official MCP server covers repository reads, issues, PRs, CI/CD, and code/security findings. | [S1] | high |
| C2 | Playwright MCP uses accessibility snapshots, but Microsoft says CLI+skills are more token-efficient for coding agents; MCP fits persistent/exploratory loops. | [S2] | high |
| C3 | Context7 supplies version-specific library docs and ships both CLI+skill and MCP modes. | [S3] | high |
| C4 | Chrome DevTools MCP adds performance traces, network/console inspection, screenshots, and automation. | [S4] | high |
| C5 | Chrome DevTools MCP collects usage statistics by default and can send trace URLs to Google’s CrUX API unless disabled. | [S4] | high |
| C6 | Sentry’s MCP service is scoped to human-in-the-loop coding/debugging, not general admin. | [S5] | high |
| C7 | shadcn MCP browses, searches, and installs components from public, private, or third-party registries. | [S6] | high |
| C8 | Figma MCP extracts design context and reuses components via Code Connect, but Starter/View/Collab seats get six tool calls/month. | [S7] | high |
| C9 | Anthropic’s frontend-design skill names generated-design tells and forces a token/plan review before code. | [S8] | high |
| C10 | The skill’s second pass revises any part of the plan that would be the generic default before building. | [S8] | high |
| C11 | Supabase’s official MCP server supports read-only, feature-scoped URLs that exclude mutating tools. | [S9] | high |
| C12 | Neon’s MCP server is intended for local development/IDE use and is not recommended for production. | [S10] | high |
| C13 | Postgres MCP Pro offers index tuning, EXPLAIN analysis, and a restricted read-only mode for production. | [S11] | high |
| C14 | The semgrep/mcp repository is deprecated; future MCP updates ship through the official semgrep binary. | [S12] | high |
| C15 | PortSwigger’s Burp MCP extension is official, supports HTTP/SSE/stdio, and asks approval before sending requests or reading history. | [S13] | high |
| C16 | OWASP’s MCP Top 10 covers token mismanagement, scope creep, tool poisoning, supply-chain tampering, command injection, prompt injection, weak auth, missing audit, shadow servers, and context over-sharing. | [S14] | high |
| C17 | OWASP treats tool poisoning and scope creep as distinct top-10 MCP risks. | [S14] | high |
| C18 | Superpowers packages spec interrogation, implementation planning, red/green TDD, and subagent-driven development as composable skills. | [S15] | high |
| C19 | Aqua’s Trivy MCP plugin scans filesystems, container images, and remote repositories. | [S16] | high |
| C20 | Context7’s library docs are community-contributed and not guaranteed accurate, complete, or secure. | [S3] | high |

## Details

### 1. The coding core

**GitHub MCP** is the official GitHub server, not a community wrapper. It reads repositories and code, manages issues/PRs, monitors Actions, and surfaces code/security findings [S1]. That covers the repo half of the edit–review–ship loop; it is the one server to install first.

**Context7** closes the “the model’s API knowledge is stale” loop with version-specific docs and examples [S3]. It offers two interfaces: a CLI+skill mode and an MCP mode [S3]. The caveat is real: its library docs are community-contributed, and the project disclaims guarantees of accuracy, completeness, or security [S3]. Use it to reduce hallucinations, not as a primary source for security-critical behavior.

**Playwright MCP** drives a page through structured accessibility snapshots rather than screenshots, which is deterministic and vision-model-free [S2]. But Microsoft’s own README says coding agents increasingly prefer CLI+skills because they avoid loading large tool schemas and verbose accessibility trees; MCP remains appropriate for persistent, exploratory, long-running loops [S2]. That is a direct contradiction to “more MCP is always better,” and it should shape the stack: use the MCP when the agent needs a live browser session, the CLI+skill when it needs token-efficient checks.

**Chrome DevTools MCP** is the performance/debugging complement: traces, network requests, console messages with source maps, screenshots [S4]. It is not a drop-in replacement for Playwright’s interaction model; pick one browser server. Two operational details matter: usage statistics are collected by default, and trace URLs may go to Google’s CrUX API unless disabled [S4].

**Sentry MCP** is deliberately narrow: it is designed for human-in-the-loop coding/debugging, and it can be scoped to one org or project [S5]. That narrowness is a feature. It brings production evidence — errors, traces, issues — into the agent without granting general Sentry administration.

### 2. Frontend design and unslopping

“Unslop” is not a single tool. It is four inputs:

1. **Real components.** shadcn MCP browses, searches, and installs components from the project’s configured registries, including private company libraries [S6]. This prevents the agent from inventing a button when the design system already has one.
2. **Real design context.** Figma MCP extracts variables, components, and layout data, and Code Connect lets generated code reuse actual components [S7]. The boundary is the plan: Starter/View/Collab seats get six tool calls per month, while Dev/Full seats get per-minute API limits [S7].
3. **Design judgment.** Anthropic’s `frontend-design` skill is explicitly an anti-template brief: it names current generated-design tells (cream + serif + terracotta, acid-green-on-black, SaaS card kits, all-caps eyebrows, arrow-suffixed buttons) and requires a compact token/type/layout plan [S8]. Its second pass reviews that plan against the brief and revises anything that would be the generic default before writing code [S8]. This is the closest thing to a deterministic “unslop” step in the skill layer.
4. **Visual verification.** Playwright or Chrome DevTools renders the result and exposes console/network/accessibility state [S2][S4]. A design skill can tell the agent what to avoid; only a browser can show whether it avoided it.

The local DSH catalog also exposes design skills such as `design-taste-frontend`, `unslop`, `impeccable`, and `hallmark`. I did not evaluate them against a benchmark or read their full sources, so they are not ranked here; the verified recommendation is the design-source → component-source → critique-skill → browser loop.

### 3. Backend quality

The database server should match the hosting model, and the safest default is read-only.

- **Supabase MCP** is the official server. Its URL supports `read_only=true` and feature scoping, which excludes mutating tools [S9]. That is the right default for an agent exploring schema or debugging queries.
- **Neon MCP** is useful for branching and migrations, but Neon explicitly says it is intended for local development and IDE integrations and does **not** recommend it for production [S10]. Treat it as a development accelerator, not a production operator.
- **Postgres MCP Pro** is the strongest fit for self-managed Postgres: index health, index tuning, EXPLAIN plans, schema intelligence, and a restricted read-only mode with execution-time limits [S11].
- **Sentry MCP** supplies the runtime half of backend quality — production errors and traces — and is scoped to debugging workflows [S5].

Docker MCP and OWASP ASVS were not read in this pass; container scanning is covered by Trivy below, and ASVS remains a gap rather than a verified recommendation.

### 4. Cybersecurity

No single scanner covers the surface. The verified layers are:

- **SAST:** Semgrep is a deterministic static analyzer with a large rule registry and tools for `security_check`, `semgrep_scan`, and custom rules [S12]. The important maintenance caveat: the `semgrep/mcp` repository is deprecated, and future MCP updates ship through the official `semgrep` binary [S12]. Prefer the binary/CI path; do not build a dependency on the archived repo.
- **DAST/manual:** PortSwigger’s Burp MCP extension is official, supports Streamable HTTP, SSE, and a stdio proxy, and by default asks for approval before sending HTTP requests or reading proxy history [S13]. That approval gate is a feature; it keeps the agent from silently attacking a target.
- **Containers/filesystems:** Aqua’s Trivy MCP plugin scans local projects, container images, and remote repositories [S16]. It is the container/IaC complement to Semgrep’s code rules.
- **MCP itself:** OWASP’s MCP Top 10 is the checklist for the layer everything else runs on: token mismanagement, scope creep, tool poisoning, supply-chain tampering, command injection, prompt injection, weak auth, missing audit, shadow servers, and context over-sharing [S14]. Tool poisoning and scope creep are separate risks, not synonyms [S14].

Snyk’s official MCP endpoint could not be verified (the repository URL returned 404), and OWASP ASVS was not read. They are omitted from the ranked picks rather than guessed at.

### 5. Selection criteria that separate leverage from risk

The criteria that survived the evidence:

1. **Official or clearly maintained.** Prefer the vendor’s server (GitHub, Microsoft, Google, Figma, Supabase, Neon, Semgrep, PortSwigger, Aqua, Sentry) over a wrapper [S1][S2][S4][S5][S7][S9][S10][S12][S13][S16].
2. **Narrow tools, read-only default.** Supabase’s `read_only` and Postgres MCP Pro’s restricted mode are the pattern [S9][S11].
3. **A real loop.** If the server does not change what the agent can verify, it is tool bloat.
4. **Documented auth and scopes.** Sentry’s org/project scoping and Burp’s approval prompts are examples [S5][S13].
5. **Token cost.** Playwright and Context7 both offer CLI+skill modes precisely because MCP schemas and accessibility trees cost context [S2][S3].
6. **Plan and environment limits.** Figma’s six-calls-per-month tier and Neon’s “not for production” warning are selection criteria, not footnotes [S7][S10].
7. **MCP-layer security.** OWASP’s Top 10 is the minimum threat model: token exposure, scope creep, tool poisoning, supply chain, injection, auth, audit, shadow servers, context over-sharing [S14].

The practical rule is fewer servers, each with a read-only or narrowly scoped credential, pinned versions, and an audit trail. Popularity (stars, listicles) is not a quality signal; none of the rankings above use it.

### 6. The stack

| Category | Default pick | Why | Boundary |
| --- | --- | --- | --- |
| Repo/PR | GitHub MCP [S1] | Official; covers code, issues, PRs, CI, security findings | Scope the PAT/OAuth app; use toolsets |
| Current docs | Context7 [S3] | Version-specific docs; CLI+skill or MCP | Community docs, not guaranteed [S3] |
| Browser | Playwright MCP **or** Chrome DevTools MCP [S2][S4] | Interaction/accessibility vs performance/debugging | Pick one; CLI+skill may be cheaper [S2] |
| Production errors | Sentry MCP [S5] | Human-in-the-loop debugging; org/project scoping | Not general Sentry admin |
| Components | shadcn MCP [S6] | Real registry components, private registries | Requires `components.json` and a registry |
| Design source | Figma MCP [S7] | Real variables/components + Code Connect | Six calls/month on Starter/View/Collab |
| Design judgment | `frontend-design` skill [S8] | Names tells; forces plan review before code | A skill, not a verifier |
| DB (Supabase) | Supabase MCP, read-only [S9] | Official; excludes mutating tools | Read-only limits migrations |
| DB (Neon) | Neon MCP [S10] | Branching/migrations | Dev/IDE only, not production |
| DB (self-hosted) | Postgres MCP Pro, restricted [S11] | Tuning + EXPLAIN + read-only | Restricted mode constrains resources |
| SAST | Semgrep [S12] | Deterministic rules, custom rules | Repo deprecated; use binary/CI |
| DAST | Burp MCP [S13] | Official; approval-gated requests | Local Burp instance; manual review |
| Containers/FS | Trivy MCP [S16] | Images, filesystems, remote repos | Not a code-semantic SAST |
| MCP security | OWASP MCP Top 10 [S14] | Threat model for the tool layer | A checklist, not a scanner |
| Workflow skill | Superpowers [S15] | Spec → plan → TDD → subagent review | A methodology, not a scanner |

## Contradictions and gaps

- **“Best MCP” is conditional on the interface.** Microsoft says CLI+skills are more token-efficient for coding agents and MCP fits persistent/exploratory loops [S2]; Context7 ships both modes [S3]. A stack that installs every MCP is not the best stack.
- **Figma MCP is plan-dependent.** Six calls per month on Starter/View/Collab is not enough for a full build [S7]. The tool is strong; the plan is the constraint.
- **Neon MCP is dev-only by the vendor’s own warning** [S10]. Do not put it in a production agent loop.
- **Semgrep’s MCP repository is deprecated** [S12]. The scanner remains strong; the integration path changed.
- **No controlled benchmark.** This report ranks by primary documentation, maintenance, loop coverage, and security posture — not by measured task success. I found no independent head-to-head of these servers on coding tasks. That is the biggest limitation.
- **Unexamined:** Snyk’s official MCP endpoint (404), OWASP ASVS, Docker MCP, Magic UI/21st MCP, and the local DSH design skills. They are not recommendations here.
- **Budget:** 13 searches and 17 pages read, against a 25-search / 15-page budget. The page overrun is two pages; no extra searches were spent after the security batch.

## Sources

| # | Source | Type | Published / retrieved |
|---|--------|------|-----------------------|
| S1 | GitHub MCP Server — https://github.com/github/github-mcp-server | primary | — / 20/11/2026 |
| S2 | Playwright MCP — https://github.com/microsoft/playwright-mcp | primary | — / 20/11/2026 |
| S3 | Context7 — https://github.com/upstash/context7 | primary | — / 20/11/2026 |
| S4 | Chrome DevTools MCP — https://github.com/ChromeDevTools/chrome-devtools-mcp | primary | — / 20/11/2026 |
| S5 | Sentry toolkit (CLI + MCP server) — https://github.com/getsentry/toolkit | primary | — / 20/11/2026 |
| S6 | shadcn MCP Server — https://ui.shadcn.com/docs/mcp | primary | — / 20/11/2026 |
| S7 | Figma MCP server guide — https://github.com/figma/mcp-server-guide | primary | — / 20/11/2026 |
| S8 | frontend-design SKILL.md — https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md | primary | — / 20/11/2026 |
| S9 | Supabase MCP — https://github.com/supabase/mcp | primary | — / 20/11/2026 |
| S10 | Neon MCP Server — https://github.com/neondatabase/mcp-server-neon | primary | — / 20/11/2026 |
| S11 | Postgres MCP Pro — https://github.com/crystaldba/postgres-mcp | primary | — / 20/11/2026 |
| S12 | Semgrep MCP (deprecated repository) — https://github.com/semgrep/mcp | primary | — / 20/11/2026 |
| S13 | Burp Suite MCP Server — https://github.com/PortSwigger/mcp-server | primary | — / 20/11/2026 |
| S14 | OWASP MCP Top 10 — https://owasp.org/www-project-mcp-top-10/ | primary | — / 20/11/2026 |
| S15 | Superpowers — https://github.com/obra/superpowers | primary | — / 20/11/2026 |
| S16 | Trivy MCP plugin — https://github.com/aquasecurity/trivy-mcp | primary | — / 20/11/2026 |

## Method

Searches: 13 (nine discovery, four contrarian queries that returned no usable results) · Pages read in full: 17 · Recursion depth: 1 · Budget: 25 searches / 15 pages / 45 minutes, page overrun 17/15. Selection was by primary documentation, maintenance status, loop coverage, and security posture; no measured benchmark of these servers was found or used. All claims above are in the research ledger at `research/what-are-the-best-mcp-tools-and-skills-for-codin/state.json`.
