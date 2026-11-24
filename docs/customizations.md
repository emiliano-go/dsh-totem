# Customization inventory

This is the complete inventory of what `dsh-totem` adds or changes. It covers
the package, the bundle patch, the browser half, and the local profile rows
that are deliberately not shipped by the package.

## Bundle entrypoints

| Entrypoint | Source | Mounted by |
|---|---|---|
| `dsh-totem` | `src/index.ts` | The top-level `totem` row in `cordis.patch.yml` |
| `dsh-totem/tool-fs` | `src/tool-fs/index.ts` | Every Web preset's scoped file-tool row and the top-level `tool-fs-totem` row |
| `dsh-totem/compaction` | `src/compaction/index.ts` | Every Web preset's `compaction-basic` child |
| `dsh-totem/pipelines` | `src/pipelines/index.ts` | Opt-in; add a plugin row with this name |
| `dsh-totem/client` | `src/client/index.tsx` | The package's Web client entry |

The package exports these as `.`, `./tool-fs`, `./compaction`, `./pipelines`,
`./client`, and `./package.json`.

## Bundle patch

`cordis.patch.yml` is generated from the installed DSH Web presets by
`script/gen-patch.ts`, then preserves the profile-only MCP rows from the
existing file.

It does four things:

1. Disables the global `tool-fs` row.
2. Inserts the Totem service, `dsh-totem/tool-fs`, and the research/browser MCP
   client rows.
3. Overrides each shipped preset (`standard`, `ptc`, `cordis`, `minimal`) so
   its scoped `tool-fs` child is `dsh-totem/tool-fs`.
4. Replaces each preset's `@deepseek-ai/dsh-compaction-basic` child with
   `dsh-totem/compaction`, while keeping `command-compact` and the tool-result
   pruner.

The top-level MCP rows inserted by the bundle are:

| Row | Server | Role |
|---|---|---|
| `mcp-searxncrawl` | `searxncrawl` | SearXNG discovery and page/site Markdown extraction |
| `mcp-cluefinch` | `cluefinch` | Chunked full-text reading, link navigation, bounded collection |
| `mcp-playwright` | `playwright` | Deterministic headless Chromium control |
| `mcp-browser-use` | `browser-use` | Agentic browser control through a Python REPL |
| `mcp-openmotion` | `openmotion` | Optional motion-design MCP; non-fatal when unavailable |

## Tools

### Memory surface

The plugin proxies the Totem MCP tool set with short model-facing names:

```text
engineering_context
memory_aliases            memory_argument           memory_audit
memory_check_record       memory_commands           memory_conflicts
memory_consolidate        memory_coverage           memory_create
memory_decay              memory_delete             memory_eval
memory_export             memory_export_markdown    memory_feedback
memory_feedback_list      memory_file_context       memory_get
memory_graph              memory_heat               memory_history
memory_identity           memory_import             memory_import_markdown
memory_induce_workflow    memory_list               memory_maintenance
memory_profile            memory_provenance         memory_quality
memory_recent             memory_relate             memory_relations
memory_resolve_conflict   memory_rollup             memory_search
memory_session_summary    memory_tasks              memory_touch
memory_train_models       memory_update             memory_verify
memory_workflow
```

### File tools

`dsh-totem/tool-fs` registers:

```text
read read_image write edit apply_patch
```

`read`, `write`, `edit`, and `apply_patch` require
`memory: { kind: "register", symbol?: "<name>" }`. A successful read stores a
file-state TLDR; writes store file and symbol memories. `read_image` is the
image path and does not require a memory marker.

### Gate, profile, and recall

| Tool | Purpose |
|---|---|
| `memory_for_tool` | Read memories associated with a guarded tool and mark them read for this session. |
| `set_owner_name` | Persist the owner's preferred name in the global profile. |
| `remember_preference` / `forget_preference` / `list_preferences` | Manage global preferences injected into future prompts. |
| `memory_recall_sessions` | Search summaries of earlier sessions. |
| `notify` | Send a push through the configured ntfy/Telegram channels. |

### Reminders and watches

`remind_me`, `reminder_list`, `reminder_ack`, `reminder_snooze`,
`reminder_cancel`, `watch_add`, `watch_list`, `watch_cancel`.

### CI

`ci_status` and `ci_watch` read GitHub Actions and check-run state.

### Compaction

`compaction_search` searches the current session's archived compacts. See
[compaction.md](compaction.md).

### Pipelines

`sec_audit`, `site_audit`, and `pipeline_detail` are registered only when the
opt-in `dsh-totem/pipelines` plugin is mounted. See
[pipelines.md](pipelines.md).

## Slash commands

Registered only when the composition mounts `dsh-commands`:

| Command | Cost | Effect |
|---|---|---|
| `/remember [type:decision] [tags:a,b] <statement>` | no model turn | Store a user-asserted memory. |
| `/recall <query>` | no model turn | Search project memory and print the strongest matches. |
| `/forget <id> [reason]` | no model turn | Delete one memory with a reason. |
| `/memory` | no model turn | Show active/archived counts, open conflicts, stale evidence. |
| `/handoff <summary>` | no model turn | Store a session summary before compaction. |
| `/restart` | no model turn | Schedule an idle host restart. |
| `/triage [window] [--limit N]` | one steered turn | Queue untriaged TrustSight alerts and run evidence triage. |
| `/research <question>` | one steered turn | Run the staged deep-research protocol. |

The stock `/compact` command remains mounted through `command-compact`.

## Turn gates

Two hooks in `src/index.ts` turn agent discipline into a host rule:

| Gate | Source | Behavior |
|---|---|---|
| Verification gate | `src/verify-gate.ts` | After a file edit, a turn cannot end without a passing check that ran after the last edit. It steers a continuation message and is bounded by `verifyGateNudges`. |
| Exploration gate | `src/explore.ts` | Two failures with the same signature and no new command since the last one block mutating tools until the session tries something new. Read-only commands do not count as an experiment. |

Both gates are advisory-safe: a gate that throws does not block work, and both
can be disabled with `verifyGate: false` / `exploreGate: false`.

## Browser UI

| Slot / surface | ID | Contribution |
|---|---|---|
| `plugins.item` | `totem` | **Totem memory** card: memory model, title model, encoder |
| `settings.section` | `assistant` | Assistant tabs: Memory, Candidates, Conflicts, Reminders, Watches, Notifications, Verify, Server |
| `sidebar.session.row.hover` | `totem.tldr` | Host-generated hover TLDR for the last completed turns |
| `contextMenu.icon` | `totem.unread` | Restore the green unread dot |
| native context menu | `totem.unread` | Mark as unread / clear unread, ordered with the session menu |
| `sidebar.panellist` | `overview` | **Overview** sidebar entry |
| `main` | `overview` | Usage, tokens, session/cost breakdown, approvals block |
| `conversation.chat.turnTail` | `verify-turn` | Deterministic verify findings for a turn |
| `conversation.input.dock` | paste hook | Convert large plain-text pastes into `.txt` attachments |
| client hooks | emoji | GitHub-style `:shortcode:` rendering and autocomplete |

The client also polls `/totem/approvals` for release approval cards in the
Overview and sidebar dot.

## HTTP routes

All assistant routes require the `apiToken` bearer token except `/totem/ping`
(health) and the one-time login path, which authenticates with its key.

| Method | Path | Purpose |
|---|---|---|
| GET | `/totem/ping` | Health check, including during a draining restart |
| GET | `/totem/host` | Host pid, busy flag, resolved restart launcher |
| GET | `/totem/verify/rules` | Built-in verify rule catalogue |
| GET | `/totem/verify?turn=` | Stored verify findings for one turn |
| GET | `/totem/state` | Aggregate assistant state |
| GET | `/totem/memories` | Memory browser page |
| GET | `/totem/candidates` | Pending memory candidates |
| GET | `/totem/conflicts` | Conflict inbox |
| GET | `/totem/reminders` | Reminders |
| GET | `/totem/watches` | Watches |
| GET | `/totem/unread` | Host-authoritative unread marks |
| GET | `/totem/tldr?sessionId=` | Hover TLDR for a session |
| GET | `/totem/overview` | Usage and cost overview |
| POST | `/totem/restart` | Schedule an idle host restart |
| POST | `/totem/overview/import` | Import historical usage |
| POST | `/totem/tldr` | Write a TLDR |
| POST | `/totem/unread` | Mark a session unread |
| POST | `/totem/unread/clear` | Clear a mark |
| POST | `/totem/watches` | Add/remove a watch |
| POST | `/totem/notify-test` | Send a test notification |
| GET/POST | `/totem/approvals` | Proxy the LAN release tracker's list/act/enqueue calls |
| GET | `/totem/login/<key>/...` | One-time login link and cookie exchange |

## State files

Everything lives under `~/.dsh/totem/` unless noted:

| Path | Purpose |
|---|---|
| `compaction/<hash>.json` | Per-session compact archive |
| `conflicts.json` | Conflict inbox |
| `candidates.json` | Pending distilled memory candidates |
| `reminders.json` | Reminder definitions and fired-slot ledger |
| `watches.json` | Watches |
| `resume.json` | Interrupted-turn resume ledger |
| `session-tldr.json` | Session TLDR records |
| `unread.json` | Host-authoritative unread marks |
| `usage.jsonl` | Usage/token history for Overview |
| `pipelines/<run-id>/` | Audit findings, pages, raw scanner output, report |
| `user` | Global user profile and preference state used by the user tools |
| `ledgers/` | Session working-state ledgers |

Profile-specific state under `~/.dsh/profiles/web-totem/` is listed in
[operations.md](operations.md).

## Scripts

| Script | Purpose |
|---|---|
| `script/gen-patch.ts` | Regenerate the Web preset overrides from the installed DSH presets, preserving the research MCP rows |
| `script/install-skills.ts` | Link project skills globally and install external skills from `skills.lock.json` |
| `script/external-skills.ts` | Sparse-checkout and link external skill repositories |
| `script/install-claude-seo.ts` | Install the 29 claude-seo skills and their Python/Chromium runtime |
| `script/research-setup.ts` | Start the bundled SearXNG and warm the browser/search caches |
| `script/verify-research.ts` | Handshake and live-test the research MCP servers |
| `script/extras-setup.ts` | Install Agent Reach and OpenMotion, and link Modern Web Guidance |
| `script/verify.ts` | Offline diff/repo verification through both deterministic lanes |
| `script/evidence.ts` | Run a command, hash its output, and detect flaky repeats |
| `script/replay-verify.ts` | Replay old persisted calls through the deterministic lanes |
| `script/coverage.ts` | Map added lines to an existing Istanbul/LCOV/Cobertura report |
| `script/mutation.ts` | Mutate source lines and report the test kill rate |
| `script/eval.ts` | Golden-case ranking evaluation |
| `script/patch-pwa.ts` | Install the PWA shell customization |
| `script/patch-workspace-status.ts` | Workspace folder status marker patch |
| `script/patch-design-links.ts` | Design editor link patch |
| `script/patch-think-default.ts` | Default thinking-mode patch |

## Live profile customizations

These are not shipped in the repository. They live in
`~/.dsh/profiles/web-totem/`:

- Bundles: `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, `dsh-totem`,
  `dsh-claude-design`, `dsh-undo`.
- Model route: the `opencode-go` provider, `agent-default-model`, and the
  memory/title model choices.
- MCP clients: TrustSight harness, rbg-mcp, Panopticon, Git, GitHub, GPG,
  Aster, Context7, Chrome DevTools, shadcn, Trivy, and disabled templates for
  Semgrep, Sentry, Postgres, Figma, Supabase, Neon, and Burp.
- UI rows: general settings, chat, theme, connection, subagent model selection.
- Release approvals tracker:
  [emiliano-go/github-release-tracker](https://github.com/emiliano-go/github-release-tracker);
  URL/token in `~/.local/share/totem/approvals.json` (or
  `DSH_N8N_URL`/`DSH_N8N_TOKEN`).

The dated MCP/skill installation record is
[mcp-and-skills-install.md](mcp-and-skills-install.md).
