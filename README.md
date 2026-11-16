# dsh-totem

Totem persistent engineering memory for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This bundle does six things:

1. **Native memory tools.** `memory_search`, `memory_get`, `memory_list`, `memory_create`, `memory_update`, `memory_delete`, `memory_recent`, `memory_tasks`, `memory_commands`, `memory_relate`, `memory_relations`, `memory_history`, `memory_verify`, `memory_check_record`, `memory_audit`, `engineering_context`, `memory_export`, `memory_import`, `memory_feedback`, `memory_feedback_list`, `memory_train_models`, `memory_consolidate`, `memory_recall_sessions`, `memory_conflicts`, `memory_resolve_conflict`, `memory_eval`; proxied to the Totem MCP server over one lazy stdio connection.
2. **Memory-gated file tools.** A fork of `@deepseek-ai/dsh-tool-fs`: `read`, `write`, `edit`, and `apply_patch` require a `memory` argument (`{ kind: "register", symbol?: "<name>" }`). After each successful touch the service registers the file (and each changed symbol, for writes) in Totem.
3. **Secondary memory model.** Memory prose is authored by a separately configured model (or the deployment default when unset), selected in the Web GUI on the Plugins page (`provider`, `model`). If distillation fails, a deterministic draft is stored.

A workflow prompt section and a first-step recent-memory digest are also mounted.

4. **Compaction survival.** The plugin notices the Harness compaction markers,
   persists the session's work before the summary replaces it, and restores the
   durable decisions, invariants, contracts, and active tasks at the next step.
5. **Commands and skills.** `/remember`, `/recall`, `/forget`, `/memory`,
   `/handoff` run without spending a model turn, and every stored workflow is
   projected into the skill catalog as a loadable skill.
6. **Conflict inbox and evaluation.** Contradictions reported by a write are
   kept for review in the Web GUI and resolvable from the model or the human,
   and `bun run eval` gates ranking quality on a golden case file.

## Requirements

- DeepSeek Harness 0.2.2 (`dsh`).
- Totem 0.10.0 or newer, with the MCP server on `PATH` as `totem-mcp`, or set `command` to an absolute path in the plugin config.

### Totem 0.10.0 capabilities

The plugin surface tracks the 0.10.0 tool set:

- `memory_check_record` records an observed check: command, cwd, exit code,
  output hash, evidence hash, commit, and run time.
- `memory_verify` takes an optional `check_id`; with it the verification must
  match a passing check and the current evidence digest, and is stored as
  `verificationMode: check`. Without it the verification is stored as an
  assertion and is ranked below check-backed claims.
- `memory_audit` verifies the hash-chained history and each item state digest.
- `engineering_context` accepts `max_item_chars`, and returns `trustScores`,
  `closestId`, and `calibration` from the advisory ranking models.
- `memory_create` and `memory_update` accept `valid_from` and `valid_to`;
  context and search accept `as_of` and `include_expired`.
- `memory_search` returns fused lexical and dense scores plus the reasons each
  result entered; context sets `abstained` when nothing clears the threshold.
- `memory_feedback` records useful, wrong, irrelevant, verified, or stale
  signals. `memory_train_models` fits the reranker and calibrator once both
  classes exist.
- `memory_consolidate` clusters near-duplicates; it is a dry run unless
  `apply` is true.
- `memory_file_context` stores one current-state TLDR per file, keyed by content
  hash; repeated reads return `fresh: true` without rewriting.
- A whole-file `read` checks the cached TLDR first. When the file is unchanged,
  the tool returns the TLDR and symbol outline instead of the full body; pass
  `force: true` to read the body. File reads are stored as TLDRs instead of
  `Read <name>` markers. Writes update the same file-state record instead of
  appending `Patched <name>` records.
- `memory_session_summary` stores one summary per session from the changed paths
  and work description, and links it to the touched file-state records.
- `memory_quality` reports signal ratio, provenance coverage, stale evidence,
  conflicts, digest composition, memory classes, and entities.
- `memory_workflow`, `memory_graph`, `memory_rollup`, `memory_heat`,
  `memory_decay`, `memory_induce_workflow`, and `memory_maintenance` expose
  procedural memory, the entity graph, hierarchical summaries, and lifecycle.
- `memory_export_markdown` and `memory_import_markdown` move memory to and from
  human-readable notes.
- The first-step digest excludes file-state records and keeps decisions,
  gotchas, contracts, architecture, and observations.

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
| `embeddingBackend` | Retrieval encoder: `auto` (default, Model2Vec when installed), `model2vec`, or `hash`. Also editable from the Settings page; applies on the next Totem server start. |
| `embeddingModel` | Static model id or local directory, default `minishlab/potion-retrieval-32M`. |
| `embeddingLocal` | Pre-pulled model directory for offline installs; wins over `embeddingModel`. |
| `distill` | Let the secondary model author memory (default true). |
| `readRegister` | Register a deterministic memory after every successful read (default true). |
| `autoRegister` | Register after every write/edit/patch (default true). |
| `preferFileContext` | Serve a fresh file TLDR instead of the full body on a whole-file read (default true). |
| `digest` | Inject a recent-memory digest at the first step of a session (default true). |
| `maxTokens`, `maxInputBytes`, `timeoutMs` | Distillation and MCP bounds. |
| `debug` | Log registration failures. |

Changes persist to the profile and apply on restart.

### Retrieval encoder

The Plugins page exposes a **Retrieval encoder** choice next to the memory
model:

- **Automatic** uses the Model2Vec static encoder when the optional Python
  package is installed, and the dependency-free hash encoder otherwise.
- **Model2Vec** requires `pip install 'totem-mcp[embeddings]'` and downloads
  `minishlab/potion-retrieval-32M` on first use (32M parameters, CPU-only,
  numpy-based, no torch).
- **Offline hash** never downloads a model and keeps the original deterministic
  encoder.

The plugin passes the choice to the Totem child as
`TOTEM_EMBEDDING_BACKEND`, `TOTEM_EMBEDDING_MODEL`, and
`TOTEM_EMBEDDING_LOCAL`. Explicit entries in `env` win over these fields. The
choice takes effect when the Totem MCP server next starts; `totem models status`
reports the active encoder.

## Compaction survival

The Harness compacts long sessions by replacing an older span with one summary
written by a model. That summary keeps what its summarizer judged important, so
a decision or gotcha recorded early can disappear.

The plugin watches the session log for both compaction markers
(`compaction/start` and the `compact-checkpoint` message source), persists the
current session's work through `memory_session_summary`, and injects a
budgeted recovery block at the next step. Only durable types are restored —
decisions, invariants, contracts, gotchas, constraints, architecture, bugs, and
rejected ideas — plus in-progress `task:` memories. File-state TLDRs are
excluded because they are cheap to reconstruct.

Two budgets keep injection honest:

| Field | Default | Meaning |
|---|---|---|
| `digestTokens` | `400` | Token budget for the first-step digest. |
| `recoveryTokens` | `600` | Token budget for the post-compaction block. |

The estimate is four characters per token, which slightly over-counts prose and
therefore errs on the safe side of the budget.

Turn distillation has two additional controls:

| Field | Default | Meaning |
|---|---|---|
| `coverage` | `true` | Skip a turn already extracted at the same fingerprint and extractor version; reopen a changed turn. |
| `clues` | `false` | Expand a multi-hop task into 2-4 clue queries and pass the matching ids as context seeds. |

## Deterministic verification

The judge is an opinion; these tools are evidence. All three run offline — no
Host, no model, no GPU — which is also how the rules are tested.

- `src/rules.ts` adds nine diff-aware rules on top of the built-in verify lane:
  conflict markers, debugger calls, credential files, writes that escape the
  project, bare `except`, assertion-free tests, sleeps in tests, added binaries,
  and dependency drift. Each looks at *added* lines only, skips generated and
  vendored paths (a sourcemap contains the rule patterns themselves), and uses
  the same `VerifyFinding` shape, so a high-severity hit vetoes the turn.
- `bun run script/verify.ts --repo .` runs both lanes over the working-tree diff
  (`--patch file.diff` and `--changes list.json` also work) and exits 1 on a
  blocking finding.
- `bun run script/evidence.ts --command "bun test" --repeat 3` records exit
  code, duration, output hash, and a tail; repeating it reports whether a
  failure is stable or flaky.
- `bun run script/replay-verify.ts` replays the persisted judge calls through
  both lanes and reports which verdicts a deterministic veto would have changed.
- `bun run script/coverage.ts --repo . --coverage coverage/lcov.info` maps the
  added lines of the diff onto an existing coverage report (Istanbul JSON, LCOV,
  or Cobertura) and fails when a new executable line never ran. It costs no test
  run and ignores added lines with no coverage entry, so declarations and
  comments are not reported as uncovered.
- `bun run script/mutation.ts --file src/queue.ts --command "bun test"` mutates
  one file line by line (comparison and boolean flips), runs the suite per
  mutant, and reports the kill rate. A surviving mutant is a test that does not
  notice the behaviour; the source is restored in a `finally` after every run.

## Commands

Registered when the profile mounts `dsh-commands`; a profile without a command
surface simply gets none. A command runs directly against the agent and never
becomes a model message.

| Command | Effect |
|---|---|
| `/remember [type:decision] [tags:a,b] <statement>` | Store a memory; the secondary model still authors the prose. |
| `/recall <query>` | Search project memory and print the strongest matches. |
| `/forget <id> [reason]` | Delete one memory with a reason. |
| `/memory` | Active/archived counts, open conflicts, and stale evidence. |
| `/handoff <summary>` | Store a session handoff before the context is compacted. |

## Workflow skills

`memory_workflow` already stores procedures, but a database row is inert. When
the profile mounts `dsh-skill`, this plugin registers a read-through provider
that projects every `kind: workflow` memory into the skill catalog: the summary
is cheap discovery, the body is rendered from the stored steps and loaded on
demand, and an edited workflow appears on the next catalog without an
invalidation step.

Three portable skills also ship under `.agents/skills/`, which the filesystem
provider scans automatically: `totem-memory-hygiene`, `totem-session-handoff`,
and `totem-conflict-resolution`. Copy that directory to `~/.agents/skills` to
make them available in every project.

## Conflict inbox

`memory_create` already detects contradictions, but a conflict that only
appears in one tool result is easy to miss. Detected conflicts are retained in
a bounded inbox (`~/.dsh/totem/conflicts.json`), listed by `memory_conflicts`,
shown on the **Conflicts** tab of the assistant settings, and resolved with
`memory_resolve_conflict` or the tab itself:

- `keep-a` / `keep-b` records a `contradicts` relation and supersedes the
  losing memory so retrieval stops returning it as current.
- `both` records the contradiction without changing either item.

Resolution is deliberately local: Totem's own `resolve_conflict` tool needs the
`conflicts` table row id, and neither the create result nor the export exposes
it, so the plugin records the knowledge instead of pretending to mutate a row it
cannot address.

## Session recall

`memory_recall_sessions` searches the summaries Totem writes at the end of each
session and returns what was done, which files changed, and at which commit.
Session summaries are a minority of stored memories, so the tool asks for a wide
page and filters rather than relying on a narrow search.

## Subagents

A delegated agent that runs in a worktree or a scratch directory would otherwise
write into a second, near-empty store. `subagent/start` pins the child session to
its parent's project, so what a child learns is visible to the parent.

## Evaluation

```sh
bun run eval                                   # auto smoke set: wiring and latency only
bun run eval --cases eval/cases.json           # golden set: gate on recall@10 and MRR
bun run eval --baseline eval/baseline.json     # gate against a prior report
```

The harness runs `totem_eval_tool` through a real MCP connection and exits
non-zero on a gate failure. With no case file it derives cases from whatever the
database happens to contain, so recall on that set measures the data, not the
ranker; the auto mode therefore gates only on having cases and on latency, and
quality gates require `--cases`. Exit codes are `0` pass, `1` gate failure, `2`
usage or transport error.

## Laya decision engine

The `totem` plugin can run the custom Laya judge locally:

- **`decision_ask`** — **advisory only**: it scores an agent-supplied snapshot
  and never counts as the turn gate, never records a decision, and cannot pass a
  failed turn.
- **Turn evaluation** at `agent/turn-stopping`: builds the trained state
  (`task`, Totem memory, changes/diffs, answer, tool calls, grounding), applies
  the deterministic verify lane, then asks Laya; failing verdicts steer one
  bounded retry.
- **Verify lane**: hardcoded secrets, SQL/code injection, destructive commands,
  assignment-in-condition, silent swallow, test weakening, unsafe advice,
  execution evidence, optional project verify command and optional external
  scanners (`layaVerifyExternal`).
- **Step checks**: `layaStepChecks` (`off`/`veto`/`full`), `layaStepCadence`
  (`turn`/`tool`/`both`), and a per-turn feedback budget with dedupe. A step
  verdict is always **advisory**: it steers the model with corrective feedback
  and appears as a `step` row in the turn card, but it never becomes the turn
  decision. With `veto` (the default) the step boundary runs only the
  deterministic verify lane over the recorded diffs, and a call is recorded only
  when a rule vetoes; set `full` to also ask the judge after each step. Files are
  read from disk only when external scanners (`layaVerifyExternal`) are on.
- **Log**: `<project>/.encoder/decision-log.jsonl` (turn and step entries).
- **Managed server**: the composer **Laya** switch is **off by default**. Turning
  it on starts the server and preloads the model into VRAM (switch shows
  `· loading` until ready); turning it off kills the process, frees VRAM, hides
  `decision_ask`, and skips verify/step/judge. State persists in
  `~/.dsh/totem/laya.json`.
- **Fail-closed scoring**: every configured question must be answered; a missing
  answer, low confidence, or a composite inside `layaReviewBand` (default `0.05`)
  resolves to `needs_review` instead of flipping pass/fail.
- **Review-only outcomes**: a `needs_review` reached without evidence of a real
  problem — a marginal veto, a near-threshold composite, or low confidence when
  the composite is not a clear pass — is recorded with `reviewOnly: true` and
  does **not** steer the turn; the card labels it `review only` and explains
  why. A clear pass (`composite >= pass + band`) is never downgraded by low
  confidence. Set `layaSteerOnReview: true` to enforce review-only outcomes
  anyway. A floor above the judge's typical confidence (this model usually
  answers at 0.05–0.4) makes near-threshold turns review-only; it does not make
  clear passes review-only.
- **Manual localization**: `POST /totem/laya/localize` with `{task, diff}` (or
  `{task, changes}`) ranks diff hunks by likelihood of containing the bug and
  returns `{top, hunks: [{index, header, added, score}], ms}`. It is a manual
  narrowing probe: it never records a decision and never steers, and it works
  while the automatic gate is disabled as long as the shared server is healthy.
  The **Laya → Narrow a diff** panel in the Assistant settings tab exposes it:
  paste a diff, or click **Use last turn diff** to load the newest recorded
  turn's changes. With Laya enabled, the `laya_localize` tool exposes the same
  call to the agent.
- **Assistant → Laya tab**: pass threshold, review band, veto threshold,
  confidence floor, retries, step checks/cadence/budget, verify command, external
  scanners, disabled rules, model path, questions file, calibration file.
- **Chat footer badge**: finalized assistant messages show `· Decision <verdict>
  <composite>` once the turn's evaluation is recorded.
- **Judge-call card**: each assistant message with judge calls gets a collapsible
  card showing the verdict, composite, margin, latency, per-question answers, and
  the request/response JSON.

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

## Overview page

The sidebar gets an **Overview** entry above **Plugins**. It shows token usage
from the session log:

- lifetime token total, peak day, streaks, active days, sessions;
- average tokens/day, prompts/day, tokens/prompt, and tokens/session;
- a GitHub-style 53-week activity heatmap (daily or cumulative);
- top models by token share.

Usage is recorded from live `assistant/message` events and backfilled on first
load from `~/.dsh/sessions/**/session*.jsonl.zstd`; the durable aggregate lives
in `~/.dsh/totem/usage.jsonl`.

The **All / dsh / opencode / encoder** filters cover more than dsh: the
**Import history** button reads the opencode and encoder SQLite `message` tables
(`~/.local/share/opencode/opencode.db`, `~/.local/share/encoder/encoder-local.db`,
`encoder-main.db`) once, aggregates per day, and caches the result in
`~/.dsh/totem/overview-import.json`. Importing is manual (no surprise disk
scan); **Re-import** picks up new history. The page uses the same `apiToken` as
the other `/totem` routes.

## GitHub CI

- `ci_status` — check runs + legacy statuses for a commit/PR, with pending and
  failing counts.
- `ci_watch` — background job that polls until every check completes; follow
  with `job_output(job_id, wait: true)` to block, or `job_kill` to stop it.
  Auth uses `GITHUB_TOKEN` or `gh auth token`.

## Rows open by default

The bundled web chat client mounts every disclosure collapsed. The patch expands
the assistant's **Think** rows plus **bash/PowerShell** and
**write/edit/apply_patch** rows (so the command and changed text are visible);
other tool rows stay collapsed:

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
Totem MCP create/search round trip, the service's distillation + file/symbol
registration path, token-budgeted blocks, compaction detection and recovery,
command parsing, workflow-to-skill rendering, session recall, and the conflict
inbox including its failure path.
