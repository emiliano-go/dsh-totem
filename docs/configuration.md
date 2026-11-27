# Configuration reference

All fields below belong to the `totem` plugin row (`name: dsh-totem`). Defaults
come from the loader schema in `src/index.ts`; the same values are resolved by
`resolveConfig()`.

**Volatile** fields can be changed from the Web settings page and apply without
a restart. Other fields apply when the plugin mounts.

## Totem server and retrieval

| Field | Default | Live | Meaning |
|---|---|---|---|
| `command` | `totem-mcp` | no | Executable that serves the Totem MCP server over stdio. |
| `args` | `[]` | no | Arguments passed to `command`. |
| `env` | `{}` | no | Extra environment for the Totem child. Explicit keys win over the embedding fields. |
| `cwd` | unset | no | Working directory for the Totem child; unset uses the Host directory. |
| `embeddingBackend` | `auto` | yes | Retrieval encoder: `auto` uses Model2Vec when installed, `model2vec` requires it, `hash` stays offline. |
| `embeddingModel` | `minishlab/potion-retrieval-32M` | no | Static retrieval model id or local directory. |
| `embeddingLocal` | `''` | no | Pre-pulled local model directory; wins over `embeddingModel`. |

The resolved child environment is `TOTEM_EMBEDDING_BACKEND`,
`TOTEM_EMBEDDING_MODEL`, and `TOTEM_EMBEDDING_LOCAL`, overlaid by explicit
`env` entries.

## Memory and model

| Field | Default | Live | Meaning |
|---|---|---|---|
| `provider` | `''` | yes | Secondary-model provider for memory, titles, and compaction; empty follows the deployment default. |
| `model` | `''` | yes | Secondary-model id; empty follows the deployment default. |
| `titleProvider` | `''` | yes | Provider for session titles and hover TLDRs; empty follows `provider`. |
| `titleModel` | `''` | yes | Model for titles and TLDRs; empty follows `model`. |
| `tldr` | `true` | yes | Generate a hover TLDR for the last completed turns. |
| `readRegister` | `true` | no | Register a deterministic file-state memory after every successful read. |
| `autoRegister` | `true` | no | Register file and symbol memories after write/edit/patch. |
| `memoryIgnore` | scratch/benchmark globs | no | Files that never enter automatic file memory: `.spike/**`, `.tmp-*/**`, `bench/runs/**`, `designs/**`, `research/**`, `node_modules/**`, `.git/**`. |
| `fileContextTtlDays` | `14` | no | Ignore cached file TLDRs older than this many days. |
| `memoryInvalidateOnWrite` | `true` | no | Mark memories with changed evidence `potentially_stale` after a file write. |
| `metrics` | `true` | no | Append memory and harness events to `~/.dsh/totem/metrics.jsonl`. |
| `preferFileContext` | `true` | no | Return a fresh file TLDR instead of the full body on a whole-file read. |
| `distill` | `true` | no | Let the secondary model author memory prose; when false the deterministic draft is used and compaction has no Totem target. |
| `digest` | `true` | no | Inject a recent-memory digest at the first step of a session. |
| `digestTokens` | `600` | no | Token budget for the first-step digest. |
| `recoveryTokens` | `1600` | no | Token budget for the post-compaction recovery block. |
| `maxTokens` | `512` | no | Output cap for one memory distillation call. |
| `maxInputBytes` | `24000` | no | Input byte cap for one distillation call. |
| `compactionTokens` | `4096` | no | Output cap for a native compaction summary. |
| `compactionMaxInputBytes` | `512000` | no | Input byte cap for a native compaction summary. |
| `timeoutMs` | `15000` | no | Per-call Totem and auxiliary-model timeout. |
| `debug` | `false` | no | Log memory registration failures. |
| `userContext` | `true` | no | Inject the owner's global preferences at the first step. |

The model route is resolved field by field: `provider` and `model` fall back
independently, and titles follow the memory model when their own fields are
empty. The memory model is not the main agent model.

## Turn distillation, coverage, and tool gate

| Field | Default | Live | Meaning |
|---|---|---|---|
| `distillTurn` | `true` | yes | Distill each completed turn into memory candidates. |
| `distillTurnMinChars` | `200` | yes | Minimum assistant text length for turn distillation. |
| `coverage` | `true` | yes | Skip a turn already extracted at the same fingerprint and extractor version. |
| `clues` | `false` | yes | Expand a multi-hop task into 2-4 clue queries for context seeds. |
| `toolGate` | `true` | yes | Block a tool while memories associated with `tool:<name>` are unread. |
| `toolGateTtlMs` | `30000` | no | Association-cache lifetime. |
| `toolGateTurns` | `3` | no | Turns a `memory_for_tool` read stays fresh before the gate re-arms. |

The gate is fail-open, exempts memory tools and `memory_for_tool`, and refuses
to run the guarded tool until it is read. `tool:*` guards every tool.

## Web composer and output

| Field | Default | Live | Meaning |
|---|---|---|---|
| `pasteToFile` | `true` | no | Turn large plain-text composer pastes into `.txt` draft attachments. |
| `pasteToFileChars` | `4000` | no | Character threshold for a paste attachment. |
| `pasteToFileLines` | `80` | no | Line threshold for a paste attachment. |

Pastes that already contain files, are small, or do not originate in the
composer are untouched.

## Notifications, reminders, and watches

| Field | Default | Live | Meaning |
|---|---|---|---|
| `apiToken` | `''` | yes | Bearer token for the assistant HTTP routes and the login cookie exchange. |
| `ntfyUrl` | `https://ntfy.sh` | yes | ntfy base URL. |
| `ntfyTopic` | `''` | yes | ntfy topic; empty disables ntfy. |
| `ntfyToken` | `''` | yes | Optional ntfy bearer token. |
| `telegramBotToken` | `''` | yes | Telegram bot token. |
| `telegramChatId` | `''` | yes | Telegram chat id. |
| `notifyTurnEnd` | `true` | yes | Send a push notification when a turn finishes. |
| `notifyApproval` | `true` | yes | Send a push notification when a tool approval is requested. |
| `watchAllowPrivate` | `false` | yes | Allow watches to fetch loopback/private addresses. |
| `quietHours` | `22:00-08:00` | yes | Local quiet window for silent reminder slots; empty disables it. |

Reminder kinds and schedules are documented in the main
[README](../README.md#reminders).

## TrustSight triage

| Field | Default | Live | Meaning |
|---|---|---|---|
| `triageDir` | `''` | no | Artifact directory; empty uses `<session cwd>/alert-triage`. `~/` is expanded. |
| `triageFeedUrl` | `''` | no | Watcher feed base; empty uses `WATCHER_FEED_URL`, then the public feed. |
| `triageWindowDays` | `7` | no | Lookback when the ledger has no entries. |
| `triageBatch` | `5` | no | Maximum alerts queued per `/triage`; `0` queues every untriaged alert. |

The command never decides a verdict. It writes a queue and steers one
model-visible turn to use the TrustSight MCP evidence tools. The ledger is
append-only and is the resume point.

## Deterministic verification

| Field | Default | Live | Meaning |
|---|---|---|---|
| `verifyCommand` | `''` | yes | Command run once per turn; empty disables the command lane. |
| `verifyDisable` | `[]` | yes | Rule ids to skip. |
| `verifyGate` | `true` | yes | Force a turn that edited files to run a check before it may end. |
| `verifyGateNudges` | `2` | yes | Extra steps the gate may force per turn; `0` disables it. |
| `exploreGate` | `true` | yes | Refuse further file edits while the same failure repeats and nothing new was tried. |

The built-in rule lane always runs and stores findings for the turn card. The
command lane adds project-specific evidence; a high-severity finding vetoes
the turn. The verification gate also checks ordering: an edit followed by no
passing check is not a finished turn.

## Restart, resume, and process lifetime

| Field | Default | Live | Meaning |
|---|---|---|---|
| `restartCommand` | `dsh-totem` | yes | Launcher used to restart the host; resolved against `PATH`, `~/.local/bin`, and `~/.npm-global/bin`. |
| `restartService` | `dsh-totem.service` | yes | systemd user unit used when the host is supervised. |
| `resumeInterrupted` | `true` | yes | Continue interrupted turns and resumable subagents after a host restart. |
| `resumeWindowMinutes` | `30` | no | Only sessions active within this window are considered. |
| `resumeMaxSessions` | `3` | no | Maximum sessions resumed per boot. |
| `resumeMaxAttempts` | `3` | no | Maximum auto-resume attempts per session per cooldown. |
| `resumeCooldownMinutes` | `30` | no | Cooldown over which attempts are counted. |

An idle restart is deferred to the turn boundary. A second request while one is
queued is refused. The browser waits for the host pid to change before
reloading because the draining process still answers `/totem/ping`.

## Design editor proxy

| Field | Default | Live | Meaning |
|---|---|---|---|
| `designProxy` | `true` | no | Proxy the claude-design editor under the DSH origin at `/design/*`. |
| `designEditorPort` | `4720` | no | Loopback port of the editor. |
| `designPublicUrl` | `https://dsh.emiliano-go.com` | no | Public origin used by `generate_canvas_url`. |

The proxy handles both the HTTP prefix and the editor's WebSocket upgrade, one
upgrade route per canvas root.

## Pipeline plugin

`dsh-totem/pipelines` has its own configuration surface:
`provider`, `model`, `reviewProvider`, `reviewModel`, `maxTokens`,
`timeoutMs`, `screenshots`, `allowPrivate`, and `artifactDir`. See
[pipelines.md](pipelines.md).
