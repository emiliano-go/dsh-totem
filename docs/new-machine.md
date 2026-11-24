# New-machine setup

This is the complete rebuild path for the live `web-totem` host. It separates
what the repository reproduces from profile data, host services, credentials,
skills, and durable state that must be carried over.

Clone a commit that contains `docs/` and `src/compaction/`. Uncommitted work is
invisible to `git clone`, so commit and push the current checkout first.

Baseline observed on this host on 24/11/2026:

| Component | Version / value |
|---|---|
| OS | Arch Linux / Omarchy |
| Node | `v26.12.1` (mise) |
| Bun | `1.4.5` |
| npm | `11.20.0` |
| DSH | `@deepseek-ai/dsh@0.2.2-rc.1` |
| Totem MCP | `totem-mcp 0.11.0`, Python `3.14.9`, `model2vec 0.10.0` |
| Chromium | `148.0.7778.96` at `/usr/bin/chromium` |
| Playwright CLI | `1.63.0` |
| Trivy | `0.76.2`, MCP plugin `0.0.20` |
| uv | `0.13.9` |
| SearXNG | `docker.io/searxng/searxng:latest` on `127.0.0.1:8888` |
| DSH profile | `web-totem`, port `3080` |
| Public origin | `https://dsh.emiliano-go.com/` |

Pin these versions when rebuilding. A newer DSH may change a patch target or a
peer interface; a newer Totem MCP may change the tool schema.

## 1. Base tools

```sh
# Node 26.12.1 and Bun 1.4.5
mise use -g node@26.12.1
curl -fsSL https://bun.sh/install | bash

# DSH, pinned
npm install -g @deepseek-ai/dsh@0.2.2-rc.1

# Totem MCP with the Model2Vec encoder extra
pipx install 'totem-mcp[embeddings]==0.11.0'
totem-mcp --version
```

`pipx` installs the package into its own environment; do not install Totem into
the system Python. The `embeddings` extra supplies `model2vec` and `numpy`;
`torch` and `sentence-transformers` are not used.

Also install `git`, `docker` with Compose, `uv`, `npx`, `trivy`, and a system
Chromium. Verify:

```sh
dsh --version
node --version
bun --version
totem-mcp --version
uv --version
npx --version
trivy --version
chromium --version
docker compose version
```

## 2. Repository and bundle

```sh
git clone <dsh-totem-repository> ~/Documents/GitHub/dsh-totem
cd ~/Documents/GitHub/dsh-totem
bun install
bun run build

dsh --profile web-totem --from-default-profile web --dump-config
dsh plugin --profile web-totem add "$PWD"
```

`bun run build` creates `lib/`, `lib/tool-fs/`, `lib/pipelines/`,
`lib/compaction/`, and `lib/client.js`. The bundle patch then replaces the
preset file-tool rows and compaction backend.

## 3. Profile dependencies

The profile has two dependencies that are not package dependencies:

```sh
dsh plugin --profile web-totem add dsh-claude-design@2.16.0

# dsh-undo is a locally patched tarball, not a registry package.
mkdir -p ~/.dsh/vendor
cp /path/to/backup/dsh-undo-0.2.0-totem.6.tgz ~/.dsh/vendor/
sha256sum ~/.dsh/vendor/dsh-undo-0.2.0-totem.6.tgz
# expected: b908314c20de83b6eb4fd5cf6c4e1f15452e31102ad64b8eead2ef1d9dba7499
dsh plugin --profile web-totem add file:"$HOME/.dsh/vendor/dsh-undo-0.2.0-totem.6.tgz"
```

`dsh plugin add` normally adds the bundle to the profile. Confirm
`~/.dsh/profiles/web-totem/package.json` lists these bundles:

```json
[
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dsh-totem",
  "dsh-claude-design",
  "dsh-undo"
]
```

The tarball's upstream is `https://github.com/LingLambda/dsh-undo`; the
`0.2.0-totem.6` build is the patched artifact used here. Keep the tarball in
the machine backup if the upstream branch is not reproducible.

## 4. Profile user layer

The user layer is the largest piece that is not shipped by the package:

```text
~/.dsh/profiles/web-totem/cordis.patch.yml
```

It contains:

- the `opencode-go` provider and model catalog;
- `agent-default-model`;
- the `totem` row's model and token overrides;
- UI, connection, and subagent rows;
- TrustSight, rbg-mcp, Panopticon, Git, GitHub, GPG, Aster, Context7,
  Chrome DevTools, shadcn, and Trivy MCP rows;
- disabled templates for Semgrep, Sentry, Postgres, Figma, Supabase, Neon, and
  Burp.

Copy it from the old machine, then review every absolute path:

```sh
cp /backup/web-totem/cordis.patch.yml ~/.dsh/profiles/web-totem/cordis.patch.yml
```

Treat this file as secret: it contains the Totem `apiToken` and may contain
other local tokens. Replace machine-specific paths before booting:

| Row | Old path / value | Replace with |
|---|---|---|
| TrustSight harness | `/home/eclipse/Documents/GitHub/trustsight/trustsight-harness` | new checkout path |
| rbg-mcp | `/home/eclipse/Documents/GitHub/harness/mcp_main.py` | new checkout path |
| Panopticon | its local checkout path | new checkout path |
| `RBG_ALLOWED_ROOTS` | `/home/eclipse/Documents/GitHub:/tmp:/home/eclipse/Documents/Apps/Spacesuit` | new roots |
| provider `apiKeyEnv` | `OPENCODE_GO_API_KEY` | same variable, new value |

Validate before booting:

```sh
dsh --profile web-totem --dump-config > /tmp/web-totem.yml
grep -nE 'mcp-|llm-pi-ai|dsh-totem/compaction|dsh-totem/tool-fs' /tmp/web-totem.yml
```

The dump must contain four `dsh-totem/compaction` rows and no
`@deepseek-ai/dsh-compaction-basic`.

## 5. Host services

### SearXNG

The bundle's `research:setup` script starts the bundled compose file, generates
`deploy/searxng/.env` if absent, waits for the JSON API, warms `uvx` caches, and
links the portable skills:

```sh
cd ~/Documents/GitHub/dsh-totem
bun run research:setup
```

Requirements: `docker`, `uvx`, and `npx`. The container binds
`127.0.0.1:8888` with host networking. A remote SearXNG can be used instead:

```sh
SEARXNG_URL=https://search.example.com bun run research:setup --no-browsers
```

### Chromium and Playwright

The research MCP uses the system Chromium. `research:setup` also asks the
Playwright MCP package to install its pinned Chromium revision:

```sh
npx -y @playwright/mcp@latest install-browser chromium
```

If browser-use cannot find a browser, run once:

```sh
uvx --from 'browser-use[cli]' browser-use install
```

### Trivy MCP

```sh
trivy plugin install mcp@0.0.20
trivy plugin list
```

### Agent Reach and optional extras

```sh
bun run extras:setup
```

This installs Agent Reach from its GitHub release zip, clones/builds
OpenMotion, and links Modern Web Guidance. OpenMotion currently fails to build
upstream; its row is non-fatal. Re-run with `--skip-open-motion` if it is not
needed.

### Totem launcher and health

The live host uses:

```text
~/.local/bin/dsh-totem
~/.local/bin/dsh-totem-health
```

`dsh-totem` exports `OPENCODE_GO_API_KEY` from
`~/.local/share/encoder/auth.json` (falling back to
`~/.local/share/opencode/auth.json`), restarts a stale profile on port 3080,
and logs to `~/.dsh/logs/dsh-totem.log`. Copy both scripts from the old
machine or recreate them from the profile backup; they are not shipped in the
package.

## 6. MCP services and credentials

The profile rows require the following services or credentials:

| Row | Requirement |
|---|---|
| `mcp-trustsight-harness` | TrustSight checkout with `uv`; optional `TRUSTSIGHT_*` variables |
| `mcp-rbg` | `harness/mcp_main.py`, `RBG_ALLOWED_ROOTS` |
| `mcp-panopticon` | Panopticon checkout and Python environment |
| `mcp-git` | `git` |
| `mcp-github` | `gh auth token` or `GITHUB_TOKEN` |
| `mcp-gpg` | `gpg`, gpg-agent |
| `mcp-aster` | Aster server configuration |
| `mcp-context7` | `npx -y @upstash/context7-mcp` |
| `mcp-chrome-devtools` | Chromium at `/usr/bin/chromium` |
| `mcp-shadcn` | `npx -y shadcn@latest mcp`; project `components.json` for registry items |
| `mcp-trivy` | Trivy + MCP plugin |
| disabled templates | Sentry/Figma/Supabase/Neon/Burp/Postgres need their own auth or URI |

The exact command/args/env for these rows is in the profile user layer. Copy it
rather than retyping it, then fix the absolute paths.

## 7. Credentials and secrets

These files are required for the exact setup and must be transferred securely:

| Path | Contents |
|---|---|
| `~/.dsh/.credentials.yaml` | Totem login record secret |
| `~/.dsh/.env` | `OPENCODE_GO_API_KEY` and other local exports |
| `~/.local/share/encoder/auth.json` | Encoder auth; launcher reads the `opencode-go` key |
| `~/.local/share/opencode/auth.json` | Fallback OpenCode key |
| `~/.dsh/profiles/web-totem/cordis.patch.yml` | Totem `apiToken`, tracker/token references |
| `~/.local/share/totem/approvals.json` | n8n tracker URL/token, if used |
| `~/.cloudflared/tunnel-token` | Cloudflare tunnel |

Also transfer environment-only values:

```text
OPENCODE_GO_API_KEY
GITHUB_TOKEN
DSH_N8N_URL
DSH_N8N_TOKEN
DATABASE_URI          # only if Postgres MCP is enabled
```

Keep modes `600` on credentials and `.env`; never commit any of them. The
profile patch is also sensitive even though it is not a conventional secret
file.

## 8. Skills

The repository reproduces its five portable skills and the lock-file set:

```sh
bun run skills:install
bun run skills:install --check
```

Extra sources:

```sh
# Superpowers (15 skills); the live checkout is at 22f0b46
git clone --depth 1 https://github.com/obra/superpowers.git \
  ~/.local/share/dsh-totem/superpowers
cp -r ~/.local/share/dsh-totem/superpowers/skills/* ~/.agents/skills/

# Claude SEO, pinned to v2.6.2 by the installer
bun run script/install-claude-seo.ts
```

Agent Reach is installed by `bun run extras:setup`; Modern Web Guidance is
linked from this repository.

### Locally adopted skills

These are not installed by `skills.lock.json` and must be copied from the old
machine:

```text
adversarial-review
pack-threat-model
proof-harness
security-audit
ui-slop-audit
frontend-design
reverse-engineer-anything
```

Archive and restore them:

```sh
tar -C "$HOME/.agents/skills" -czf /backup/local-skills.tgz \
  adversarial-review pack-threat-model proof-harness security-audit \
  ui-slop-audit frontend-design reverse-engineer-anything

tar -C "$HOME/.agents/skills" -xzf /backup/local-skills.tgz
```

`omarchy` and `diagnose-crash` are links into the Omarchy system skill tree:

```text
/usr/share/omarchy/default/agents/skills/omarchy
/usr/share/omarchy/default/agents/skills/diagnose-crash
```

Install Omarchy on the new machine, or copy those two directories into
`~/.agents/skills`. The source notes for the locally adapted skills are in
their `SKILL.md`; preserve the directories, not just their names.

## 9. Durable state

Stop the host and tunnel before copying SQLite-backed state:

```sh
systemctl --user stop dsh-totem.service cloudflared-dsh.service
```

Back up:

| Path | Why |
|---|---|
| `~/.dsh/totem/` | Compacts, conflicts, candidates, reminders, watches, resume ledger, TLDRs, unread marks, usage |
| `~/.local/share/totem/totem.db` | User-scope Totem database |
| `~/.dsh/sessions/` | Session history; needed for exact resume/title/unread behavior |
| `~/.dsh/profiles/web-totem/` | Profile config, lockfile, patch, local state |
| `~/.dsh/vendor/` | `dsh-undo` tarball |
| `~/.agents/skills/` | Global skill set and local copies |
| `~/.local/share/dsh-totem/` | Superpowers, external skill checkouts, OpenMotion |
| `~/.local/share/claude-seo/` | Optional Claude SEO runtime and Playwright cache |
| `~/.config/systemd/user/dsh-totem*.{service,timer}` | Host units |
| `~/.cloudflared/tunnel-token` | Tunnel auth |

Project memory is separate: each project has `.totem/totem.db` (plus `-wal`
and `-shm`). Copy the whole `.totem/` directory for every project whose memory
must survive. Do not copy a database while the Totem process is writing it.

Restore with the same paths and permissions, then start:

```sh
systemctl --user daemon-reload
systemctl --user start dsh-totem.service cloudflared-dsh.service
```

The browser's `localStorage` is only a mirror; the Host copy of unread marks is
authoritative, so a fresh browser profile is fine.

## 10. Verification

```sh
dsh --version
totem-mcp --version
~/.local/share/pipx/venvs/totem-mcp/bin/python -c \
  'import model2vec; print(model2vec.__version__)'
dsh --profile web-totem --dump-config >/tmp/web-totem.yml
grep -c "dsh-totem/compaction" /tmp/web-totem.yml   # 4
grep -c "dsh-compaction-basic" /tmp/web-totem.yml  # 0

cd ~/Documents/GitHub/dsh-totem
bun test
bun run research:verify
```

Then open `https://dsh.emiliano-go.com/` and check:

- the sidebar shows **Overview**;
- Settings → Plugins → Totem memory lists the model picker;
- `compaction_search` returns an existing compact for this session;
- Settings → Assistant → Server shows the restart action;
- the Totem memory page shows the expected project.

## What cannot be reproduced from the repository alone

- The profile user layer and its tokens.
- The `dsh-undo` tarball unless it is backed up.
- The `dsh-totem` and `dsh-totem-health` launchers.
- Credentials and provider keys.
- The locally adopted global skills.
- External MCP checkouts and their environment.
- The Totem databases, session log, compacts, and other durable state.

[customizations.md](customizations.md) lists the shipped and local surfaces;
[operations.md](operations.md) explains how the state-bearing features behave.
