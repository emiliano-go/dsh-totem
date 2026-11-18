# dsh-totem

Totem persistent engineering memory for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This bundle does seven things:

1. **Native memory tools.** `memory_search`, `memory_get`, `memory_list`, `memory_create`, `memory_update`, `memory_delete`, `memory_recent`, `memory_tasks`, `memory_commands`, `memory_relate`, `memory_relations`, `memory_history`, `memory_verify`, `memory_check_record`, `memory_audit`, `engineering_context`, `memory_export`, `memory_import`, `memory_feedback`, `memory_feedback_list`, `memory_train_models`, `memory_consolidate`, `memory_recall_sessions`, `memory_conflicts`, `memory_resolve_conflict`, `memory_eval`; proxied to the Totem MCP server over one lazy stdio connection.
2. **Memory-gated file tools.** A fork of `@deepseek-ai/dsh-tool-fs`: `read`, `write`, `edit`, and `apply_patch` require a `memory` argument (`{ kind: "register", symbol?: "<name>" }`). After each successful touch the service registers the file (and each changed symbol, for writes) in Totem.
3. **Secondary memory model.** Memory prose is authored by a separately configured model (or the deployment default when unset), selected in the Web GUI on the Plugins page (`provider`, `model`). If distillation fails, a deterministic draft is stored.

A workflow prompt section and a first-step recent-memory digest are also mounted.

4. **Compaction survival.** The plugin notices the Harness compaction markers,
   persists the session's work before the summary replaces it, and restores the
   durable decisions, invariants, contracts, and active tasks at the next step.
5. **Commands, triage, and skills.** `/remember`, `/recall`, `/forget`,
   `/memory`, `/handoff` run without spending a model turn. `/triage` is the
   exception: it steers a normal agent turn to work through untriaged
   TrustSight watcher alerts and keeps the result in an append-only ledger.
   Every stored workflow is projected into the skill catalog as a loadable
   skill.
6. **Conflict inbox and evaluation.** Contradictions reported by a write are
   kept for review in the Web GUI and resolvable from the model or the human,
   and `bun run eval` gates ranking quality on a golden case file.
7. **Research and browser MCP servers.** One research pipeline instead of a
   pile of search servers: SearXNG-backed discovery and extraction
   (`searxncrawl`), chunked reading and citation navigation (`cluefinch`),
   deterministic browser control (`playwright`), and agentic browsing
   (`browser-use`). The `deep-research` skill and `/research` command encode
   the investigation protocol.

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
- `bun run script/replay-verify.ts` replays a persisted call log (from before
  the model judge was removed) through both lanes and reports which verdicts a
  deterministic veto would have changed.
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
surface simply gets none. Most commands run directly against the agent and
never become a model message; `/triage` and `/research` are the deliberate
exceptions, because the evidence work needs a real agent turn.

| Command | Effect |
|---|---|
| `/remember [type:decision] [tags:a,b] <statement>` | Store a memory; the secondary model still authors the prose. |
| `/recall <query>` | Search project memory and print the strongest matches. |
| `/forget <id> [reason]` | Delete one memory with a reason. |
| `/memory` | Active/archived counts, open conflicts, and stale evidence. |
| `/handoff <summary>` | Store a session handoff before the context is compacted. |
| `/triage [12h\|7d\|30\|YYYY-MM-DD\|all] [--limit N]` | Queue a model turn that triages untriaged TrustSight watcher alerts and records each one in `alert-triage/ledger.jsonl`. |
| `/research <question>` | Queue a model turn that runs the deep-research protocol and writes a cited report to `research/<slug>-<date>.md`. |

### TrustSight triage

`/triage` does the deterministic part and leaves the judgement to the agent.
It reads `<triageDir>/ledger.jsonl`, fetches `trustsight.alerts` from the
watcher feed, drops every slug already in the ledger, writes a timestamped
queue, and steers one normal model-visible turn with the batch. The turn uses
the `trustsight-harness` MCP tools (`feed_message`, `fp_triage`,
`aur_pkgbuild`, `feed_package_diff`, `rule_info`, `fp_agent_verify`, ...) to
decide `TP`, `BFP`, `MFP`, or `uncertain` per package. The command itself never
decides a verdict.

```
<session cwd>/alert-triage/
  ledger.jsonl                     one JSON line per triaged alert
  queue-<UTC>.json                 untriaged alerts handed to the agent
  reports/<YYYY-MM-DD-HHMMSS>.md   per-alert report
  README.md                        layout and ledger schema
```

The ledger is append-only and authoritative: a slug that appears there is
skipped by later runs, so an interrupted run resumes instead of redoing work.
The default window starts at the newest alert time already in the ledger, with
a one-day overlap, or the last 7 days when the ledger is empty. `all` removes
the lower bound; the feed is still paged. The default batch is 20 alerts
because one turn cannot perform evidence triage on the ~200 alerts a week of
feed carries; the result text reports how many remain and repeated runs drain
the backlog. A window can be hours (`12h`), days (`7d`, or a bare `30` for
30 days), a `YYYY-MM-DD` date, or `all`.

Every package classified `MFP` is rechecked against the current TrustSight
**HEAD**: the turn resolves the core checkout commit and instrument version,
reconstructs the old and new PKGBUILD texts from the alert diff, and runs
`analyze_diff` with them. The report's `MFP at HEAD` column and the ledger's
`head_checks` map record `persists`, `fixed-at-head`, or `unknown` (with a
reason). A `fixed-at-head` MFP is still a false positive for that alert, but it
no longer needs a rule fix. If the instrument version does not match the
checkout at HEAD, the result is `unknown` rather than a false clean. Because
`analyze_diff` uses a cold scratch database, history-, novelty-, maintainer-,
and campaign-dependent findings cannot be replayed faithfully; those MFPs are
recorded `unknown` with a `cold-db-history` reason instead of being called
fixed.

Writes stay under the session workspace so the file sandbox admits them. Run
the command from a session whose workspace is the TrustSight checkout to keep
the artifacts next to the watcher notes; point `triageDir` at an absolute path
only when that path is writable from the session.

| Field | Default | Meaning |
|---|---|---|
| `triageDir` | `''` | Empty uses `<session cwd>/alert-triage`; `~/` is expanded. |
| `triageFeedUrl` | `''` | Empty uses `WATCHER_FEED_URL`, then `https://watcher.trustsight.org`. |
| `triageWindowDays` | `7` | Default lookback when the ledger has no entries. |
| `triageBatch` | `20` | Maximum alerts queued per run; `0` queues every untriaged alert. |

Alert titles, headlines, and package names are treated as untrusted feed text:
they are sanitized into the queue file and the prompt forbids following
instructions found inside them.

## Research pipeline

The bundle wires four MCP servers in `cordis.patch.yml` — one pipeline, not a
separate server per search engine:

| Server | Tools | Role |
|---|---|---|
| `searxncrawl` | `search`, `crawl`, `crawl_site` | Multi-engine discovery through SearXNG, page and whole-site Markdown extraction. |
| `cluefinch` | `web_search`, `web_fetch`, `web_links`, `research_collect` | Chunked full-text reading, source navigation, bounded multi-source collection. |
| `playwright` | `browser_*` (25 tools) | Deterministic Chromium control for JS-rendered, authenticated, or interactive pages. |
| `browser-use` | `browser_exec`, `browser_feedback` | Agentic browsing: Python against a live browser session. |

Search splits the work: `searxncrawl` for discovery and bulk extraction,
`cluefinch` for reading long primary sources in chunks and following their
links. Browser servers are the fallback for pages that need JavaScript or a
session.

### Setup

```bash
bun run research:setup     # SearXNG, matching Chromium, warm uvx/npx caches
bun run research:verify    # handshake + one live search per search server
bun run research:verify --browsers   # also navigate and drive a browser
```

`research:setup` starts the bundled SearXNG (`deploy/searxng/compose.yaml`,
loopback on port 8888, JSON API enabled) and installs the Chromium revision
that `@playwright/mcp` pins. It also links the portable skills into
`~/.agents/skills` so `deep-research` resolves outside this checkout. It is
idempotent.

To use a SearXNG hosted elsewhere — for example on `solsticio` — start the
compose file there and change `SEARXNG_URL` / `MCP_SEARCH_SEARXNG_URL` in
`cordis.patch.yml`, or export `SEARXNG_URL` before `research:setup` and
`research:verify`. The container uses host networking because Docker's
embedded DNS on user-defined bridges cannot reach a systemd-resolved stub
listening on `127.0.0.53`; the bind address keeps the port loopback-only.

SearXNG needs `formats: [html, json]`; the bundled settings file already
enables both. A public instance should re-enable the limiter.

### The protocol

`/research <question>` steers one agent turn through the pipeline: decompose
the question, fan out 3–4 query variants per subquestion in parallel, prefer
primary sources, read whole pages, follow cited sources to depth 2, re-search
gaps and contradictions, verify load-bearing claims against independent
sources, and write a report with inline `[S#]` citations and a full source
table. The full version is the portable `deep-research` skill under
`.agents/skills/`; copy that directory to `~/.agents/skills` to use it in every
project.

### Security

`playwright` exposes `browser_run_code_unsafe`, and `browser-use` exposes
`browser_exec`: both execute arbitrary code inside the MCP server process,
which runs outside the DSH file sandbox. Treat them like the shell tool and
only connect servers you trust. Playwright runs headless with an in-memory
isolated profile; browser-use attaches to the local Chrome/Chromium or a
browser it starts itself.

## Agent extras

Three external tools extend what the agent can reach. `bun run extras:setup`
installs them idempotently; `--check` prints the plan without touching
anything, and `--skip-agent-reach`, `--skip-open-motion`, `--no-build`, and
`--skip-skills` narrow the run.

| Tool | How it reaches the agent | State |
|---|---|---|
| [Agent Reach](https://github.com/Panniantong/Agent-Reach) | CLI on `PATH`; its own skill is installed by `agent-reach setup` | Installed via `uv tool install` from the GitHub release zip |
| [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) | Skill (vendored, npx-driven) | Linked into `~/.agents/skills`; guides are fetched on demand |
| [OpenMotion](https://github.com/Yuan-ManX/open-motion) | MCP over Streamable HTTP at `http://127.0.0.1:7000/api/mcp` | **Upstream does not build** — see below |

Agent Reach is deliberately installed from the GitHub release asset: the
PyPI package named `agent-reach` is a different project. It keeps its channels,
logins and private tools in `~/.agent-reach/`; logged-in channels need
`agent-reach login <channel>` once. It is read-only by design and needs no
MCP wiring — the skill teaches the agent the `agent-reach <channel> <action>`
form.

Modern Web Guidance is a single SKILL.md with no local data files; it shells
out to `npx -y modern-web-guidance@latest search|retrieve|legacy-scan`, so the
guides stay current without vendoring them. The skill is mandatory for
HTML/CSS and client-side JS work: it steers the agent away from patterns the
model learned from older code.

**OpenMotion is not usable yet.** `extras:setup` clones it to
`~/.local/share/dsh-totem/open-motion` and installs its dependencies, but the
published tree references files it never shipped (`server/routes/batch.ts`,
`motion/templates/crystalCascade.ts`) and fails `tsc` with a dozen type errors,
so neither `npm run build` nor a `tsx` dev run can start the server. The MCP
entry is wired with `failOnStartupError: false`, so it simply stays
unavailable instead of failing the profile. Once upstream builds, rerun
`bun run extras:setup` and start the server with:

```bash
cd ~/.local/share/dsh-totem/open-motion
npm -w @openmotion/server run start   # web UI + MCP on :7000
```

## Workflow skills

`memory_workflow` already stores procedures, but a database row is inert. When
the profile mounts `dsh-skill`, this plugin registers a read-through provider
that projects every `kind: workflow` memory into the skill catalog: the summary
is cheap discovery, the body is rendered from the stored steps and loaded on
demand, and an edited workflow appears on the next catalog without an
invalidation step.

Five portable skills also ship under `.agents/skills/`, which the filesystem
provider scans as a *project* root: `totem-memory-hygiene`,
`totem-session-handoff`, `totem-conflict-resolution`, `deep-research`, and
`modern-web-guidance`. A sixth, `agent-reach`, is installed by Agent Reach's
own setup into the same directory. Project-root skills are visible only in
sessions whose cwd is inside this checkout.
Run `bun run skills:install` to link them into `~/.agents/skills`, which every
session across every project scans; `bun run research:setup` does it too.
Linking (rather than copying) keeps the global view in sync with the checkout.

External skills are declared in `skills.lock.json` and installed the same way:
the installer keeps one **shallow, sparse** checkout per repository under
`~/.local/share/dsh-totem/skills/<name>` and links the skill directory into
`~/.agents/skills`. Sparse checkout matters — seven repositories sum to roughly
450 MB of references and assets, of which only the skill paths are
materialized (143 MB). Adding a skill is one line in the lock file; updates are
`git pull --ff-only` on the next `bun run skills:install`. Current set:
`taste-skill` (design-taste-frontend), `hallmark`, `last30days`, `impeccable`,
`humanizer`, `logo-design`, `diagram-design`. `bun run skills:install --check`
prints the plan, and `--no-external` limits the run to this package's own
skills.

### Claude SEO

`bun run script/install-claude-seo.ts` installs
[claude-seo](https://github.com/AgriciDaniel/claude-seo) for DSH: it copies the
29 `seo*` skills into `~/.agents/skills`, rewrites the upstream
`${CLAUDE_PLUGIN_ROOT}` launcher paths for that location, keeps the 20
sub-agent prompts under `seo/agents/`, and builds the isolated Python/Chromium
runtime in `~/.local/share/claude-seo`. Re-run it after a claude-seo release;
`--skip-browser` skips the 700 MB Chromium download. Claude Code's
`PostToolUse` schema hook has no DSH equivalent and is not installed, so schema
validation runs through the skills' own scripts instead. The installer also
strips the upstream main skill's "Community Footer" instruction, which would
otherwise append a Skool promotional banner after every audit.

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

## Reminders

A reminder is *for* a moment (`dueAt`); the nudges around it are phases relative
to that moment, so one reminder can escalate instead of firing once:

| Kind | Schedule |
|---|---|
| `appointment` | daily for the week before (silent) → three times the day before → hourly through the last three hours and for one hour after |
| `task` | daily, forever, until told it is done; priority climbs a step a day and it starts sounding on day three |
| `deadline` | twice a day for three days → every 30 minutes in the last two hours → every 15 minutes for an hour after |
| `habit` | one nudge at the time, re-arming daily at the same wall-clock time |
| `countdown` | every six hours over the day before |

Scheduling lives in `src/reminder-plan.ts` as pure functions (`dueSlots`,
`nextSlot`, `rollRepeat`), which is what makes it testable without waiting for
time to pass. Delivery is one 30-second loop; each tick records the slots it
handled, so a restart cannot replay them and a long outage collapses into one
notification rather than a flood. Per reminder there is a floor of ten minutes
between notifications and a cap of six per day.

Silent reminders map to ntfy `min`/`low` and never sound; loud ones map to
`default`/`high`/`max`. Quiet hours (`quietHours`, default `22:00-08:00`) park
silent slots until the window ends, while anything at priority ≥4 still fires.
Acknowledging an appointment silences only the running phase (the day-of
warnings survive); acknowledging a task skips to tomorrow, because a task
reminder is supposed to keep nagging until it is done.

The model-facing surface is `remind_me` (with `kind`, `priority`, `sound`,
`repeat`), `reminder_list`, `reminder_ack`, `reminder_snooze`, and
`reminder_cancel`; the workflow prompt tells the agent to read the computed
schedule back so the cadence is agreed before it starts. The Reminders tab shows
the next notification and its phase, with Ack/Snooze/Done/Cancel.

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

## Model judge removed

A local model judge (Laya) used to sit on top of the deterministic lanes as a
turn gate, step check, advisory `decision_ask`, and manual diff-narrowing
endpoint. It was **removed on 2026-11-16**: eight evaluation rounds (gate A/B,
head fine-tunes, memory warm start, repository localization, call-shape and
checkpoint sweeps, hierarchical narrowing, N-best patch selection) found no
measurable benefit, and every ranking shape scored at or below a traceback +
BM25 baseline. The full record, including the two scripts that produced it, is
in `emiliano-go/laya-coding-decisions` (`docs/CONCLUSIONS.md`).

The plugin now ships deterministic paths only: the verify lanes above, the
evidence recorder, the coverage gate, and memory. No model server, no judge
config keys, no Laya tab, badge, turn card, or tool.

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

## Workspace status markers

The sidebar's Workspace folders now carry the primary state of the Sessions
inside them, so a collapsed folder still shows what is happening:

- a spinner when a Session (or one of its subagents) is running;
- a yellow dot when a Session is waiting for approval, a plan review, or an
  answer;
- a green dot when a Session finished while it was not the open view.

```sh
bun run script/patch-workspace-status.ts
```

This edits the installed `@deepseek-ai/dsh-client-ui-workspace/lib/client.js`
(the Workspace row is not a replaceable slot) and keeps a `.bak-totem` backup.
The precedence matches the Session row: pending > running > done. Rerun it
after every DSH upgrade or reinstall, then reload the app.

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
