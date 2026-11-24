# Web operations and assistant surfaces

The web half is not only a settings page. It owns host lifetime, recovery after
a restart, session metadata, cross-device marks, audit artifacts, and a few
optional proxies. This document describes what is mounted and how each piece
behaves.

## Host restart

The host can be relaunched from three places:

- **Settings → Assistant → Server**: two-tap confirmation.
- `/restart`: a slash command with no model cost.
- `POST /totem/restart`, authenticated with `apiToken`.

`GET /totem/host` reports the pid, busy state, and resolved launcher.
`GET /totem/ping` stays available while the old process drains, so the browser
waits for the **pid to change**, not for a ping to fail.

The restart controller:

1. Resolves `restartCommand` against `PATH`, `~/.local/bin`, and
   `~/.npm-global/bin`.
2. Refuses a second request while one is queued.
3. Defers an idle restart until the current turn reaches
   `agent/turn-stopping`.
4. Uses systemd when the host is supervised (`INVOCATION_ID`), otherwise
   spawns the launcher detached with `DSH_TOTEM_PORT` set to the request port.

When the launcher is `dsh-totem`, the wrapper kills the port owner, waits for
the port to free, and starts the new process. The browser reloads only after
the pid changes.

## Interrupted-turn resume

`resumeInterrupted` (default `true`) scans recent sessions on boot for two
shapes:

- a graceful shutdown: `turn/end` with `reason.kind === 'disposed'` and
  `aborted`;
- a crash: an open tail turn with no closers.

For each eligible session it queues one continuation prompt through
`sessionController.prompt()`. The prompt tells the agent to verify state before
repeating side effects. The crash path appends the synthetic closers before
starting the turn.

A continuable subagent cannot deliver a result without its parent, so interrupted
children wake their top-level parent once with their ids and labels; the parent
resumes each child through the normal `send_message` cold-resume path.

The resume ledger at `~/.dsh/totem/resume.json` makes this idempotent and
crash-loop safe:

| Field | Default |
|---|---|
| `resumeWindowMinutes` | `30` |
| `resumeMaxSessions` | `3` |
| `resumeMaxAttempts` | `3` |
| `resumeCooldownMinutes` | `30` |

## Unread marks

The green completion dot belongs to the UI, but the intent to return to a
session belongs to the user. Unread marks are host-authoritative:

- the browser keeps a `localStorage` mirror for instant paint and offline
  starts;
- the Host stores the source of truth in `~/.dsh/totem/unread.json`;
- reconciliation runs on load, settings updates, window focus, tab visibility,
  and a 20-second poll.

Marks expire after 30 days and the document is capped so an abandoned browser
cannot grow it without bound. The session `...` menu contributes **Mark as
unread** / **Clear unread** with a native icon, keyboard navigation, and touch
support. Running or opened sessions clear the mark on the Host too.

## Session titles and hover TLDRs

`src/titles.ts` replaces the one-shot first-prompt title with a provider that
keeps refining through the first five human turns, then settles. A manual
rename wins; automatic work stops after a `source.kind === 'user'` title.

The same cheap route writes a two-sentence TLDR of the last three completed
turns into `~/.dsh/totem/session-tldr.json`. The browser reads it from
`sidebar.session.row.hover`, so the card never waits on a model call.

Titles use `titleProvider`/`titleModel`, falling back to `provider`/`model`.
`tldr: false` disables the hover text; the title still works.

## Release approvals

The release tracker is
[emiliano-go/github-release-tracker](https://github.com/emiliano-go/github-release-tracker),
an n8n workflow that polls GitHub releases and merged PRs, drafts posts for X,
and holds them for approval. The browser cannot reach the LAN workflow, so the
Host proxies list, act, and enqueue calls at `/totem/approvals`.

Configuration is deliberately outside the plugin document:

```json
{
  "url": "http://192.168.31.200:5678",
  "token": "<DSH_WEBHOOK_TOKEN>"
}
```

Path: `~/.local/share/totem/approvals.json`. Environment fallbacks:
`DSH_N8N_URL` and `DSH_N8N_TOKEN`. The route uses `apiToken` for browser
authentication and keeps the tracker token on the Host. A missing tracker
token returns `503` with a setup hint; a timeout returns `504`.

The Overview page renders approval cards and the sidebar carries an approval
dot. Polling is shared, so both surfaces stay in step.

## Notifications, reminders, and watches

`ntfy` and Telegram are configured on the Assistant **Notifications** tab.
`notifyTurnEnd` and `notifyApproval` control the automatic hooks. Reminders
have kinds (`appointment`, `task`, `deadline`, `habit`, `countdown`) with
phase-based escalation; `quietHours` holds silent slots until the window ends.
Watches poll a page, RSS feed, or a condition and notify on change.

`watchAllowPrivate` is required before a watch may fetch loopback or private
addresses. Watches fail closed by default.

## Overview and usage

`GET /totem/overview` aggregates `~/.dsh/totem/usage.jsonl` and any imported
history. The page shows:

- total and per-day tokens/cost;
- session and source breakdowns;
- an import action for historical usage;
- the release approvals block.

The import writes `overview-import.json` and is safe to repeat.

## Deterministic verify card

The Host runs the built-in rule lane after each turn, stores findings, and the
client renders them under `conversation.chat.turnTail`. The card is read-only:
the Host already decided the veto. `GET /totem/verify?turn=` and
`GET /totem/verify/rules` expose the same data.

Two turn gates sit beside the card:

- `verifyGate` forces one more step when files changed and no check passed
  after the last edit. `verifyGateNudges` caps the forced steps.
- `exploreGate` refuses mutating tools after two repeated failures with no new
  experiment. A command the session has not run before clears the stuck state.

Both are fail-open and can be disabled from the live settings.

## Design editor proxy

The design surface is the `dsh-claude-design` profile dependency (version
`2.16.0`, upstream
[JimLiu/baoyu-design](https://github.com/JimLiu/baoyu-design)). It is not a
package dependency; install it with
`dsh plugin --profile web-totem add dsh-claude-design@2.16.0`. It supplies the
canvas editor and the `claude-design` skill.

The editor runs on loopback at `designEditorPort` (default `4720`). A remote
device cannot reach `http://<host>:4720`, so the Host proxies:

- `/design/*` HTTP traffic;
- a WebSocket upgrade per canvas root.

Canvas roots are discovered from the editor's artifact records; a watcher adds
or removes upgrade routes as canvases open. The proxy is enabled by default
(`designProxy: true`) and can be disabled if the editor is not installed.

The repository's `designs/` folder is local output and is not shipped or
committed; the canvas artifacts themselves are written by the editor into the
project. On a new machine install the profile dependency and optionally copy
`designs/` from the old machine if those exact artifacts are still needed.

## Login and PWA

`src/login.ts` mints a one-time cookie from a record secret in
`~/.dsh/.credentials.yaml`; `/totem/login/<key>/continue` exchanges it at the
same origin. The link is path-based and bookmarkable; a missing credential
disables the link instead of crashing the host.

`script/patch-pwa.ts` installs the Web app shell metadata. The PWA and the
regular Web UI share the same host; the patch is an artifact customization,
not a separate server.

## Live profile rows

The live `web-totem` profile also mounts:

| Area | Rows |
|---|---|
| Models | `llm-pi-ai` (`opencode-go`), `agent-default-model` |
| Totem | `totem`, MCP research servers |
| UI | `ui-settings-general`, `ui-chat`, `ui-theme`, `connection` |
| Subagents | `subagent-model-selection-settings`, `subagent` |
| External MCP | TrustSight harness, rbg-mcp, Panopticon, Git, GitHub, GPG, Aster, Context7, Chrome DevTools, shadcn, Trivy |
| Disabled MCP | Semgrep, Sentry, Postgres, Figma, Supabase, Neon, Burp |

The profile files are outside this repository and are not required to build the
package. See [customizations.md](customizations.md) for the complete
shipped-versus-local split.
