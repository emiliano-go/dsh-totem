# dsh-totem documentation

Reference documentation for this checkout. The top-level [README](../README.md)
is the short tour; these files are the durable inventory of what the bundle
adds to DeepSeek Harness and what is customized only in the live profile.

| Document | Covers |
|---|---|
| [customizations.md](customizations.md) | Every bundle entrypoint, patched row, tool, command, client slot, HTTP route, state file, and script |
| [configuration.md](configuration.md) | Every `totem` configuration field, default, and effect |
| [compaction.md](compaction.md) | Native compaction, the Totem summarizer, compact archive, and `compaction_search` |
| [skills.md](skills.md) | Shipped skills, workflow-skill projection, external skill installation, and the lock file |
| [pipelines.md](pipelines.md) | The opt-in `dsh-totem/pipelines` plugin and its audit tools |
| [operations.md](operations.md) | Restart, interrupted-turn resume, unread marks, titles/TLDRs, design proxy, approvals, notifications, and the assistant UI |
| [new-machine.md](new-machine.md) | Exact rebuild path for a fresh host: versions, profile dependencies, services, credentials, skills, and durable-state migration |
| [telemetry.md](telemetry.md) | Disabled senders, the session mode, the hosts-file block, and residual egress |
| [mcp-and-skills-install.md](mcp-and-skills-install.md) | Dated record of the live profile's MCP and skill installation and smoke tests |

## Shipped versus profile-local

The repository ships source, the client bundle, the `cordis.patch.yml` bundle
layer, portable skills under `.agents/skills`, and the installer scripts.

The live `web-totem` profile adds model routes and MCP servers in
`~/.dsh/profiles/web-totem/cordis.patch.yml`, and names its bundles in
`~/.dsh/profiles/web-totem/package.json`. Those rows are intentionally outside
this repository: they contain host-specific paths, LAN addresses, and optional
credentials. [operations.md](operations.md) and
[customizations.md](customizations.md) list them by name so the profile can be
reconstructed without treating it as part of the package.

## Recreating the setup

A clone plus `bun install`, `bun run build`, and
`dsh plugin --profile <name> add .` reproduces the package, the bundle patch,
the native compaction backend, the four preset overrides, and the checked-in
skills. The installers reproduce the external skill set, the research servers'
local prerequisites, and the optional Claude SEO runtime.

It does **not** reproduce the exact live environment by itself. The missing
parts are:

- the profile user layer: provider routes and model catalog, MCP client rows,
  UI/connection/subagent rows, the Totem row's token and model choice;
- credentials and the `dsh-totem` launcher;
- globally installed skills that have no repository or lock entry;
- host services: Totem MCP, Model2Vec extras, SearXNG, Chromium, Playwright,
  Trivy, `uv`/`npx`, and the DSH version;
- external MCP checkouts and their environment variables;
- durable user state: memory databases, compacts, reminders, watches, unread
  marks, usage history, and session ledgers.

Use [new-machine.md](new-machine.md) for the exact rebuild path,
[customizations.md](customizations.md) for the complete row list,
[operations.md](operations.md) for the state and service behavior, and
[skills.md](skills.md) for which global skills are reproducible.

## Verification

```sh
bun run build
bun test
bun run eval --min-recall 0.5
dsh --profile web-totem --dump-config
```

`bun run build` rebuilds `lib/` and the browser bundle as well as the `lib/`
entrypoints for `dsh-totem/tool-fs`, `dsh-totem/pipelines`, and
`dsh-totem/compaction`. A profile change is not live until the host reloads.
