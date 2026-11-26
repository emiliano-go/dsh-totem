# Midpoint

| Subquestion | Status | Evidence | Missing |
| --- | --- | --- | --- |
| Q1 coding core | supported | GitHub, Context7, Playwright, Chrome DevTools, Sentry primary docs | none load-bearing |
| Q2 frontend/unslop | supported | shadcn, Figma, Anthropic `frontend-design`; Playwright/Chrome for verification | Magic UI/21st and local DSH design skills not read as primary |
| Q3 backend | supported | Supabase read-only URL, Neon local-only warning, Postgres MCP Pro restricted mode | Docker MCP not read |
| Q4 cybersecurity | partial | Semgrep (deprecated repo), Burp, Trivy | no verified Snyk endpoint; OWASP ASVS not read |
| Q5 selection/security | supported | OWASP MCP Top 10, vendor security warnings | none load-bearing |
| Q6 stack | synthesis | derived from Q1–Q5 | no new source needed |

## Decision

Continue to edges, but do not add more vendors. The report should:

- Rank only tools with primary docs read.
- Treat Magic UI/21st, Snyk, Docker MCP, and OWASP ASVS as unverified alternatives, not picks.
- Make the "MCP is not always the best interface" point explicit: Playwright and Context7 both ship CLI+skills modes.
- State the plan limits: Figma MCP can be six calls/month on Starter/View/Collab; Neon MCP is not for production.

## Gaps

- G1: no primary evidence for Magic UI/21st MCP.
- G2: no verified official Snyk MCP endpoint; dependency/SCA coverage is thinner than SAST/DAST.
- G3: Docker MCP catalog not read; container scanning is covered by Trivy.

Close G1/G2 as "kept out of ranked picks", G3 as "out of scope, Trivy covers the loop".
