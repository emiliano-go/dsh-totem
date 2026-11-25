# MCP and skill installation — 20/11/2026

Installed and smoke-tested the stack recommended by the deep-research report
(`research/what-are-the-best-mcp-tools-and-skills-for-codin/report.md`).
Tests used the MCP stdio protocol: `initialize` → `notifications/initialized` →
`tools/list` → one real `tools/call`.

The live DSH host mounted the new servers and they were also called through
DSH's own namespaced tools: `mcp__context7__resolve-library-id`,
`mcp__shadcn__get_project_registries`, `mcp__chrome-devtools__navigate_page`,
and `mcp__trivy__trivy_version` / `scan_filesystem` all succeeded.

## Installed and tested

| Tool | Install | Test evidence | Status |
| --- | --- | --- | --- |
| GitHub MCP | already in profile (`docker run ghcr.io/github/github-mcp-server`, `gh auth token`) | `get_me` returned the `emiliano-go` profile | working |
| Playwright MCP | already in profile (`npx @playwright/mcp`) | new isolated tab loaded `https://example.com` | working |
| Context7 | `npx -y @upstash/context7-mcp` | 2 tools; `resolve-library-id` returned React library IDs | working |
| Chrome DevTools MCP | `npx -y chrome-devtools-mcp@latest` | 13+ tools; `navigate_page` loaded `https://example.com` in Chromium | working |
| shadcn MCP | `npx -y shadcn@latest mcp` | 7 tools; `get_project_registries` responded | working (project needs `components.json`) |
| Trivy MCP | `trivy` 0.76.2 + `trivy plugin install mcp` (0.0.20) | 6 tools; `trivy fs --scanners vuln` exited 0 | working |
| Postgres MCP Pro | `docker pull crystaldba/postgres-mcp` | 9 tools; `list_schemas` returned the schemas of a test Postgres | working (needs `DATABASE_URI`) |
| Semgrep | `uv tool install semgrep` → 1.186.0 | CLI scan detected a custom `os.system(...)` rule; `semgrep mcp` lists 7 tools | **MCP disabled**: tool calls need Semgrep Pro |
| frontend-design skill | copied from `anthropics/skills` | appears in the live skill catalog | installed |
| Superpowers | 15 skills from `obra/superpowers` | all 15 appear in the live skill catalog | installed |

### Why Semgrep MCP is disabled

`semgrep mcp` starts and lists tools, but a real tool call hangs and stderr says:

```
User doesn't have the Pro Engine installed, not running `semgrep mcp` daemon...
```

The free CLI works (`semgrep scan`), and the deprecated `semgrep-mcp` PyPI
package additionally requires `semgrep --pro --version`. The profile entry is
kept with `disabled: true` so it does not expose broken tools. Re-enable after
`semgrep login` and installing the Pro engine.

## Installed but credential/browser-gated

| Tool | Result | What is needed |
| --- | --- | --- |
| Sentry MCP | `npx @sentry/mcp-server` exits 10: “Not authenticated” | `npx -y @sentry/mcp-server auth login` |
| Figma MCP | `https://mcp.figma.com/mcp` → HTTP 401 | Figma OAuth / Dev or Full seat |
| Supabase MCP | `https://mcp.supabase.com/mcp` → 401 “No access token provided” | Supabase OAuth or PAT |
| Neon MCP | `https://mcp.neon.tech/mcp` → 401 “No authorization provided” | Neon OAuth/API key; dev-only by vendor |
| Burp MCP | no Burp Suite installed | Burp Suite + the PortSwigger extension |

They are configured in the profile with `disabled: true`, so the connection
details are ready but a failing server does not add tool-call errors to every
session. Postgres MCP Pro is in the same block: installed and tested, but it
needs a real `DATABASE_URI` before it should be enabled.

## Profile changes

`~/.dsh/profiles/web-totem/cordis.patch.yml` now mounts:

- `mcp-context7`
- `mcp-chrome-devtools` — `--headless --isolated --no-usage-statistics
  --executablePath /usr/bin/chromium`
- `mcp-shadcn`
- `mcp-trivy`
- `mcp-semgrep` — `disabled: true` until Pro

Disabled templates: `mcp-sentry`, `mcp-postgres`, `mcp-figma`, `mcp-supabase`,
`mcp-neon`, `mcp-burp`. Remove `disabled: true` after authenticating (and set
`DATABASE_URI` for Postgres, and the Burp proxy jar path). This accounts for
every executable recommendation in the research report; OWASP MCP Top 10 is a
checklist, not a server.

All use `failOnStartupError: false` so a missing optional dependency does not
stop DSH from booting. The config was validated with:

```bash
dsh --profile web-totem --dump-config
```

It exits 0 and contains all five server names.

## Skills

Added to `~/.agents/skills`:

- `frontend-design` (Anthropic) — anti-template design direction and review.
- 15 Superpowers skills: `brainstorming`, `writing-plans`,
  `test-driven-development`, `systematic-debugging`,
  `verification-before-completion`, `requesting-code-review`,
  `receiving-code-review`, `subagent-driven-development`, `executing-plans`,
  `dispatching-parallel-agents`, `using-git-worktrees`,
  `finishing-a-development-branch`, `using-superpowers`,
  `diagnosing-superpowers`, `writing-skills`.

They appear in the live skill catalog; the catalog refresh after installation
is the verification.

## Reproduce the MCP tests

The smoke harness is intentionally small: spawn the command, send
`initialize`, send `notifications/initialized`, call `tools/list`, then one
tool. A reusable version is at `/tmp/mcp-smoke.mjs` and `/tmp/mcp-call.mjs`
(ephemeral). For a persistent copy, add `script/mcp-smoke.ts` — not done here.

Key examples:

```bash
# list tools
node /tmp/mcp-smoke.mjs npx -y @upstash/context7-mcp
node /tmp/mcp-smoke.mjs trivy mcp

# call one tool
MCP_TOOL=resolve-library-id MCP_ARGS='{"libraryName":"react","query":"hooks"}' \
  node /tmp/mcp-call.mjs npx -y @upstash/context7-mcp

MCP_TOOL=navigate_page MCP_ARGS='{"pageId":1,"url":"https://example.com"}' \
  node /tmp/mcp-call.mjs npx -y chrome-devtools-mcp@latest \
  --headless --isolated --no-usage-statistics --executablePath /usr/bin/chromium
```

## Notes and cleanup

- The Postgres test used a disposable `postgres:16-alpine` container named
  `dsh-mcp-pg` on port 55433. Remove it with `docker rm -f dsh-mcp-pg` when no
  longer testing.
- Chrome DevTools MCP runs Chromium at `/usr/bin/chromium` because Google
  Chrome is not installed. It is officially supported for Chrome/Chrome for
  Testing only; Chromium worked in the smoke test, but is a compatibility risk.
- shadcn MCP is project-scoped: without `components.json` it starts and
  responds with an empty registry list.
- The live DSH host hot-reloaded the profile after the patch change and mounted
  the new servers; a restart is still the reliable path on older DSH builds.
  The skills are already live through `~/.agents/skills`.
