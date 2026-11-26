# Plan

## Threads and evidence

### T1 — Coding core (Q1)

Hypothesis: the smallest useful coding stack is GitHub (repo/PR), Context7 (current docs), Playwright or Chrome DevTools (browser verification), plus Sentry once there is production traffic.

Primary targets:
- github/github-mcp-server README
- upstash/context7 README
- microsoft/playwright-mcp README
- ChromeDevTools/chrome-devtools-mcp README
- getsentry/sentry-mcp README

### T2 — Frontend, design, unslop (Q2)

Hypothesis: unslopping needs three inputs, not one: a real design source (Figma), real components (shadcn/Magic UI), and a critique/verification loop (Anthropic `frontend-design` + a visual browser). A design skill alone cannot verify the result.

Primary targets:
- ui.shadcn.com/docs/mcp
- Figma Dev Mode MCP docs / figma/mcp-server-guide
- anthropics/skills `frontend-design/SKILL.md`
- local DSH design skills (`design-taste-frontend`, `unslop`, `impeccable`, `hallmark`) — secondary/local evidence only

### T3 — Backend quality (Q3)

Hypothesis: backend quality is best served by provider-native, read-only-by-default database servers (Supabase/Neon), a tuning server for self-managed Postgres (Postgres MCP Pro), container tooling (Docker/Trivy), and runtime evidence (Sentry). Generic "run SQL" servers are the weakest choice.

Primary targets:
- supabase-community/supabase-mcp README
- neondatabase/mcp-server-neon README
- crystaldba/postgres-mcp README
- Docker MCP catalog docs
- Sentry MCP (reuse)

### T4 — Cybersecurity (Q4)

Hypothesis: no single scanner is enough. A practical stack is SAST (Semgrep), SCA/secrets/container (Snyk or Trivy), DAST/manual (Burp), and a code-audit skill (Trail of Bits); OWASP ASVS supplies the backend checklist.

Primary targets:
- semgrep/mcp README
- PortSwigger/mcp-server README
- aquasecurity/trivy-mcp README
- OWASP ASVS
- Trail of Bits skills repo

### T5 — Selection and MCP security (Q5)

Hypothesis: the dominant risk is not a bad model but an over-privileged or poisoned tool. Selection must include least privilege, read-only modes, pinning, and tool scanning.

Primary targets:
- modelcontextprotocol.io security best practices
- OWASP MCP Top 10
- OWASP MCP Tool Poisoning page

### T6 — Synthesis (Q6)

Combine per-category picks into a small default stack, plus a "only if" list. State what is not recommended and why.

## Queries (to run)

- `site:github.com <repo> README` via direct fetch
- `"MCP" "read-only" database server`
- `"tool poisoning" MCP allowlist`
- `"frontend-design" skill Anthropic`
- `Semgrep MCP tools`
- `Burp MCP extension`
- `Trivy MCP`
- `Superpowers skills TDD`
- `Trail of Bits skills`

## Budget split

- T1: 4 pages
- T2: 3 pages
- T3: 3 pages
- T4: 3 pages
- T5: 2 pages
- Total: 15 pages, 25 searches.

## Effort

Six threads, but T6 is synthesis. Read depth 1 for official READMEs; depth 2 only for security claims that need the spec.
