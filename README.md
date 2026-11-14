# dsh-totem

Totem persistent engineering memory for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This bundle does three things:

1. **Native memory tools.** `memory_search`, `memory_get`, `memory_list`, `memory_create`, `memory_update`, `memory_delete`, `memory_recent`, `memory_tasks`, `memory_commands`, `memory_relate`, `memory_relations`, `memory_history`, `memory_verify`, `engineering_context`, `memory_export`, `memory_import` — proxied to the Totem MCP server over one lazy stdio connection.
2. **Memory-gated file tools.** A fork of `@deepseek-ai/dsh-tool-fs`: `read`, `write`, `edit`, and `apply_patch` require a `memory` argument (`{ kind: "register", symbol?: "<name>" }`). After each successful touch the service registers the file (and each changed symbol, for writes) in Totem.
3. **Secondary memory model.** Memory prose is authored by a separately configured model (or the deployment default when unset), selected in the Web GUI on the Plugins page (`provider`, `model`). If distillation fails, a deterministic draft is stored.

A workflow prompt section and a first-step recent-memory digest are also mounted.

## Requirements

- DeepSeek Harness 0.2.2 (`dsh`).
- The Totem MCP server on `PATH` as `totem-mcp` (from the Totem Python package), or set `command` to an absolute path in the plugin config.

## Install

```sh
# Build (also links the host @deepseek-ai scope for a linked checkout).
bun run build

# Create a custom profile from the shipped web template.
dsh --profile web-totem --from-default-profile web --dump-config

# Install this checkout into it.
dsh plugin --profile web-totem add /absolute/path/to/dsh-totem

# Boot (reads OPENCODE_GO_API_KEY from encoder's auth store).
dsh-totem
```

The profile name is arbitrary; `web-totem` keeps the shipped `web` profile untouched.

### Providers (OpenCode Go)

The profile patch ships an OpenAI-compatible `opencode-go` route and sets it as
the default agent and memory model:

```yaml
- id: llm-pi-ai
  config:
    providers:
      opencode-go:
        displayName: OpenCode Go
        api: openai-completions
        baseURL: https://opencode.ai/inference/go/openai/v1
        apiKeyEnv: OPENCODE_GO_API_KEY
        models:
          - id: deepseek-v4.1-flash
            name: DeepSeek V4.1 Flash
            contextWindow: 1000000
            maxTokens: 384000
          - id: mimo-v2.6-flash
            name: MiMo V2.6 Flash
            contextWindow: 1048576
            maxTokens: 131072
- id: agent-default-model
  config: { provider: opencode-go, model: deepseek-v4.1-flash }
- id: totem
  config: { provider: opencode-go, model: mimo-v2.6-flash }
```

`~/.local/bin/dsh-totem` reads the first `opencode-go` key from
`~/.local/share/encoder/auth.json` and exports `OPENCODE_GO_API_KEY` before
launching. Plain `dsh --profile web-totem` works if that variable is already
exported or present in `~/.dsh/.env`. Any OpenAI-compatible provider can be
added the same way; the memory model is a normal `provider`/`model` pair.

## Configure the memory model

Open **Settings → Plugins → Totem memory**. The page lists every model of every
configured provider (read from the Host model catalog) and stages one choice
over the `totem` row's volatile `provider`/`model` fields:

- **Deployment default** keeps both fields empty, so the memory model follows
  `agent-default-model` (Hestia's blank `small_model` behavior).
- Any other choice pins that exact provider/model for memory prose.

The picker writes the profile patch and applies on the next memory operation
(the fields are live); a save refused by the Host keeps the previous choice and
reports it on the page.

The remaining knobs are file-config only:

| Field | Meaning |
|---|---|
| `provider`, `model` | Secondary model route for memory prose; also editable from the Settings page. Each empty field falls back independently to the deployment default (`agent-default-model`). |
| `command`, `args`, `env`, `cwd` | Totem MCP server launch (default `totem-mcp`). |
| `distill` | Let the secondary model author memory (default true). |
| `readRegister` | Register a deterministic memory after every successful read (default true). |
| `autoRegister` | Register after every write/edit/patch (default true). |
| `digest` | Inject a recent-memory digest at the first step of a session (default true). |
| `maxTokens`, `maxInputBytes`, `timeoutMs` | Distillation and MCP bounds. |
| `debug` | Log registration failures. |

Changes persist to the profile and apply on restart.

## Laya decision engine

The `totem` plugin can run the custom Laya judge locally:

- **`decision_ask`** — model-facing judge for an explicit turn snapshot.
- **Turn evaluation** at `agent/turn-stopping`: builds the trained state
  (`task`, Totem memory, changes/diffs, answer, tool calls, grounding), applies
  the deterministic verify lane, then asks Laya; failing verdicts steer one
  bounded retry.
- **Verify lane**: hardcoded secrets, SQL/code injection, destructive commands,
  assignment-in-condition, silent swallow, test weakening, unsafe advice,
  execution evidence, optional project verify command and optional external
  scanners (`layaVerifyExternal`).
- **Step checks**: `layaStepChecks` (`off`/`veto`/`full`), `layaStepCadence`
  (`turn`/`tool`/`both`), and a per-turn feedback budget with dedupe.
- **Log**: `<project>/.encoder/decision-log.jsonl` (turn and step entries).
- **Managed server**: start/stop with the composer **Laya** switch; off kills
  the server (frees VRAM), hides `decision_ask`, and skips verify/step/judge.
  State persists in `~/.dsh/totem/laya.json`.

```yaml
- id: totem
  config:
    layaEnabled: true
    layaBaseUrl: http://127.0.0.1:8765
    layaServerCommand: '/path/to/python /path/to/laya-server.py --model /path/to/checkpoint --port 8765'
    layaManageServer: true
    layaPassThreshold: 0.65
    layaMaxRetries: 1
    layaStepChecks: veto
    layaStepCadence: turn
    layaStepMaxFeedback: 2
    layaVerifyCommand: ''
    layaVerifyExternal: 'off'
    layaVerifyDisable: []
```

## GitHub CI

- `ci_status` — check runs + legacy statuses for a commit/PR, with pending and
  failing counts.
- `ci_watch` — background job that polls until every check completes; follow
  with `job_output(job_id, wait: true)` to block, or `job_kill` to stop it.
  Auth uses `GITHUB_TOKEN` or `gh auth token`.

## Think rows open by default

The bundled web chat client mounts every reasoning disclosure collapsed. To
expand only the assistant's **Think** rows (tool/process disclosures stay
collapsed):

```sh
bun run script/patch-think-default.ts
```

This edits the installed `@deepseek-ai/dsh-client-ui-chat/lib/client.js`
(the row is not a replaceable slot) and keeps a `.bak-totem` backup. Rerun it
after every DSH upgrade or reinstall, then restart the app.

## Upgrade DSH

The file tools are mounted **inside every shipped Web agent preset**, so this
bundle overrides each preset row (`standard`, `ptc`, `cordis`, `minimal`) to
mount `dsh-totem/tool-fs`. That generated section is version-specific:

```sh
bun run script/gen-patch.ts   # rewrites cordis.patch.yml from the installed dsh
bun run build
```

`bun run build` only links the host scope; run the generator after a DSH upgrade
and re-check `dsh --profile web-totem --dump-config`.

## Design notes

- **Why a fork instead of a hook:** the required `memory` parameter is part of
  the model-facing tool contract, and DSH arguments are immutable across
  `tools/pre-execute`/`tools/post-execute`. A post-execute hook cannot require
  the parameter.
- **Why the preset overrides:** the Web app disables the global `tool-fs` row and
  mounts file tools per agent preset; preset child lists are not addressable by
  patch id, so the bundle restates each preset row.
- **Why one MCP connection:** the Totem Python server owns the libSQL/turso FTS
  schema and migrations. Reimplementing it in TypeScript would risk database
  incompatibility.
- **Peer resolution:** a linked checkout needs `node_modules/@deepseek-ai` to
  point at the running DSH installation so `@deepseek-ai/*` imports resolve to
  the host's exact module instances. `build.ts` creates that link.

## Tests

```sh
bun test
```

Covers the forked tool schemas (required `memory`), the native tool surface, the
Totem MCP create/search round trip, and the service's distillation +
file/symbol registration path.
