# Landscape

## The map

Three layers, often conflated in listicles:

1. **MCP servers** — connections to external systems (repo, browser, database, scanner). They add tools, auth, and attack surface.
2. **Agent Skills** — `SKILL.md` folders of procedural knowledge, references, and scripts. They add judgment and workflow, not connectivity.
3. **Built-in commands** — `/review`, `/security-review`, test runners. Cheapest when they already exist.

For coding, the useful unit is the **loop** a tool closes:

| Loop | What it needs | Candidates seen in the landscape |
| --- | --- | --- |
| Repo change | read/write code, branches, PRs, issues | GitHub MCP, local git/filesystem |
| Current docs | version-correct API reference | Context7, vendor docs MCP |
| Visual verification | render, screenshot, inspect, click | Playwright MCP, Chrome DevTools MCP, browser-use |
| Design source | read the real design, not a guess | Figma MCP, Penpot MCP, Storybook MCP |
| Components | use the project's real component library | shadcn MCP, Magic UI/21st MCP |
| Runtime evidence | errors, traces, releases | Sentry MCP, observability MCPs |
| Database | schema, safe queries, migrations, explain plans | Supabase MCP, Neon MCP, Postgres MCP Pro |
| Container/infra | build, run, scan | Docker MCP, Trivy MCP |
| Secure code | SAST, SCA, secrets, DAST | Semgrep MCP, Snyk, SonarQube, Trivy, Burp MCP |
| Research discipline | plan, TDD, debug, verify, review | Superpowers, Anthropic skills, Trail of Bits skills |

## Three competing narratives

1. **Official-vendor MCPs win.** GitHub, Microsoft (Playwright), Google (Chrome DevTools), Figma, Supabase, Neon, Semgrep, PortSwigger, and Sentry ship their own servers. Official ownership implies maintenance and a named security contact. The counter: official does not mean safe or well-designed; a vendor server can still over-scope tokens.
2. **Registry + skill beats generic generation for UI.** shadcn/Magic UI/Figma give the agent the real components and design; Anthropic's `frontend-design` and local skills (`design-taste-frontend`, `unslop`, `impeccable`, `hallmark`) supply taste and a critique loop. The counter: skills can be long, opinionated, and unmaintained; a skill is not a verification.
3. **The MCP supply chain is the new attack surface.** OWASP's MCP Top 10 and MCP security guidance emphasize tool poisoning, scope creep, token theft, and shadow servers. The counter-narrative ("install more servers") is the risky one; the defensible position is fewer servers, read-only default, pinned versions, and a scanner.

## Disputed terms

- **"Best"** — popularity (stars, listicles), maintenance (releases, commits), or fit (closes a loop with acceptable risk)? This report ranks by fit and maintenance, and says so where evidence is only popularity.
- **MCP vs CLI** — many MCP servers wrap a CLI. The MCP form is worth it when the agent needs structured, permissioned access; a shell command is cheaper when it already works.
- **Skill vs prompt** — a skill is discoverable, versioned, and can bundle scripts/references. A prompt is ad hoc. The value is repeatability, not length.

## Sources worth reading deeply

- MCP security best practices / OWASP MCP Top 10.
- GitHub MCP server and Playwright MCP (official, high-leverage).
- shadcn MCP, Figma MCP, Anthropic `frontend-design` skill.
- Supabase/Neon/Postgres MCP Pro and Docker MCP.
- Semgrep MCP, Burp MCP, Trivy/Snyk, OWASP ASVS for backend security.
- Superpowers and Trail of Bits skills for workflow/security discipline.
