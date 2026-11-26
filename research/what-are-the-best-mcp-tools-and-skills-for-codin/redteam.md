# Red team

## What would falsify the recommendation?

- An independent benchmark showing a server outside this list materially outperforms GitHub/Context7/Playwright/Chrome DevTools on coding tasks.
- Evidence that Playwright’s CLI+skills mode makes its MCP obsolete for coding agents (it already beats MCP on token efficiency [S2], so this is a real risk).
- A maintained, official Figma or shadcn alternative that removes the registry/plan constraints.
- A production-safe Neon MCP mode that contradicts the vendor’s “not for production” warning [S10].
- A Semgrep binary MCP that is documented and maintained better than the deprecated repo [S12].
- A Snyk or ASVS integration that closes the dependency/checklist gap.

## Strongest counter-arguments

1. **“Just use CLIs and skills.”** For coding agents, CLI+skills are often cheaper than MCP [S2][S3]. The counter is that persistent browser state, OAuth-scoped SaaS access, and structured tool results are real MCP advantages. The report keeps both.
2. **“Install the popular list.”** Popularity is not maintenance or safety. OWASP’s MCP Top 10 exists because tool poisoning, scope creep, and shadow servers are real [S14].
3. **“One scanner is enough.”** SAST, DAST, and container scanning see different surfaces; the report treats them as layers, not substitutes.
4. **“Figma MCP is unusable.”** It is usable on Dev/Full seats; the six-call limit applies to Starter/View/Collab [S7]. The recommendation is conditional, not universal.

## Omitted / unverified

- Snyk official MCP endpoint (404), OWASP ASVS, Docker MCP, Magic UI/21st MCP.
- Local DSH design skills (`design-taste-frontend`, `unslop`, `impeccable`, `hallmark`) were not benchmarked or read in full.
- No measured head-to-head benchmark of the listed servers.

## Confidence

- Per-tool facts: high (primary vendor docs).
- “Best” ranking: medium — it is a documented fit/maintenance/security judgment, not a measured task-performance result.
- The overall pattern (fewer servers, read-only default, layered security, CLI+skill where token cost matters): high.
