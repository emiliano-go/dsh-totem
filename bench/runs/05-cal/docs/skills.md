# Skills

The bundle has three skill surfaces:

1. portable project skills under `.agents/skills`;
2. workflow memories projected into the runtime skill catalog;
3. external skill repositories installed by script.

## Portable project skills

These are checked into the repository and scanned as a project root when the
session cwd is inside the checkout:

| Skill | Purpose |
|---|---|
| `totem-memory-hygiene` | Decide what belongs in durable memory, and fix stale or conflicting claims before relying on them. |
| `totem-session-handoff` | Write the handoff before compaction, a session end, or a subagent handoff. |
| `totem-conflict-resolution` | Resolve contradictory memories with the local conflict inbox. |
| `deep-research` | Staged multi-source research with a state file, evidence gates, and a cited report. |
| `modern-web-guidance` | Mandatory modern HTML/CSS/client-side guidance fetched on demand through `npx`. |

`deep-research` carries its own scripts under `.agents/skills/deep-research/`;
`/research` repeats the non-negotiable protocol so a profile without the global
skill link can still run the turn. `modern-web-guidance` has a `PROVENANCE.md`
recording the upstream source.

Run:

```sh
bun run skills:install
```

to link these into `~/.agents/skills`, where every project sees them.
Linking, not copying, keeps the global view in sync with the checkout.

## Workflow memories as skills

When the composition mounts `dsh-skill`, `src/skills.ts` registers the
`totem-workflows` provider. It projects every memory with
`metadata.kind === "workflow"` into the catalog:

- the catalog summary comes from `metadata.responsibility`;
- `metadata.preconditions` becomes `whenToUse`;
- loading the skill re-reads the stored steps, verification, and failure
  modes and renders them as imperative instructions;
- an edited workflow appears on the next catalog request without cache
  invalidation.

Discovery failures return an empty catalog instead of taking down the skill
surface. Use `memory_workflow` to create/update a procedure, then
`memory_induce_workflow` to turn a session summary into a draft.

## External skills

`skills.lock.json` declares the external set:

```text
taste-skill, hallmark, last30days, impeccable, humanizer,
logo-design, diagram-design, unslop,
charles-unslop, charles-polish, charles-color-analysis,
charles-unreasonable-craft, charles-store-screenshots,
charles-hero-mockups, dimensional-drawing
```

`bun run skills:install` keeps one shallow, sparse checkout per repository
under `~/.local/share/dsh-totem/skills/<name>` and links only the declared
paths into `~/.agents/skills`. Updates are `git pull --ff-only` on the next
run.

`bun run skills:install --check` prints the plan without cloning.
`--no-external` limits the run to this package's own skills.

The six upstream Ponytail skills (`ponytail`, `ponytail-audit`,
`ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review`) are
copied separately because one repository ships all six; they are not lock
entries.

### Agent Reach

`bun run extras:setup` installs Agent Reach from its GitHub release zip (the
PyPI package with the same name is a different project). Agent Reach installs
its own skill and keeps channel state in `~/.agent-reach/`. It is read-only
and needs no MCP row.

### Claude SEO

`bun run script/install-claude-seo.ts` installs 29 `seo*` skills, rewrites
their `${CLAUDE_PLUGIN_ROOT}` launcher paths to `~/.agents/skills`, keeps the
sub-agent prompts under `seo/agents/`, and builds the isolated Python/Chromium
runtime under `~/.local/share/claude-seo`.

The upstream `PostToolUse` schema hook has no DSH equivalent and is not
installed. The installer also removes the upstream "Community Footer"
instruction that would append a promotional banner after every audit.

### OpenMotion

`bun run extras:setup` also clones OpenMotion, but the published tree currently
fails to build. Its MCP row uses `failOnStartupError: false`, so the agent
simply does not get the tools; the rest of the profile still boots.

## Live global catalog

`~/.agents/skills` currently contains 80 linked skill names. They come from
different owners:

- **This repository:** `deep-research`, `modern-web-guidance`,
  `totem-memory-hygiene`, `totem-session-handoff`,
  `totem-conflict-resolution`.
- **This repository's installers:** `skills.lock.json` set, the six Ponytail
  skills, the 29 claude-seo skills, and Agent Reach.
- **Superpowers:** the 15 `brainstorming`/planning/TDD/review/worktree set.
- **Locally adopted security and workflow skills:** `adversarial-review`,
  `pack-threat-model`, `proof-harness`, `security-audit`, `ui-slop-audit`.
- **Other local/global skills:** `frontend-design`, `omarchy`,
  `diagnose-crash`, `reverse-engineer-anything`.

The full live set is:

```text
adversarial-review          agent-reach                brainstorming
charles-color-analysis      charles-hero-mockups       charles-polish
charles-store-screenshots   charles-unreasonable-craft charles-unslop
deep-research               diagnose-crash             diagnosing-superpowers
diagram-design              dimensional-drawing        dispatching-parallel-agents
executing-plans             finishing-a-development-branch
frontend-design             hallmark                   humanizer
impeccable                  last30days                 logo-design
modern-web-guidance         omarchy                    pack-threat-model
ponytail                    ponytail-audit             ponytail-debt
ponytail-gain               ponytail-help              ponytail-review
proof-harness               receiving-code-review      requesting-code-review
reverse-engineer-anything   security-audit             seo
seo-agentic                 seo-audit                  seo-backlinks
seo-bing                    seo-cluster                seo-competitor-pages
seo-content                 seo-content-brief          seo-dataforseo
seo-drift                   seo-ecommerce              seo-flow
seo-geo                     seo-google                 seo-hreflang
seo-image-gen               seo-images                 seo-local
seo-maps                    seo-page                   seo-plan
seo-posthog                 seo-programmatic           seo-schema
seo-shopify                 seo-sitemap                seo-sxo
seo-technical               subagent-driven-development
systematic-debugging        taste-skill                test-driven-development
totem-conflict-resolution   totem-memory-hygiene       totem-session-handoff
ui-slop-audit               unslop                     using-git-worktrees
using-superpowers           verification-before-completion
writing-plans               writing-skills
```

Only the repository-owned skills and the lock-file/installer outputs are
reproducible from this checkout. The locally adopted and host-specific skills
are catalog entries, not package contents; preserve their source repository or
skill directory if the host is rebuilt.

## Verification

```sh
bun run skills:install --check
bun test test/external-skills.test.ts
bun run research:setup
bun run research:verify
```

The skill catalog is the final check: after linking, the five portable skills
and the external set should appear without restarting the agent.
