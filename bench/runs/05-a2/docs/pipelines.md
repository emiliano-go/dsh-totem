# Audit pipelines

`dsh-totem/pipelines` is an opt-in Cordis plugin. The bundle exports and builds
it, but `cordis.patch.yml` does not mount it. Add a plugin row to use it:

```yaml
- id: totem-pipelines
  name: dsh-totem/pipelines
  config:
    provider: opencode-go
    model: beam-free
    reviewProvider: opencode-go
    reviewModel: deepseek-v4.1-flash
```

## Tools

### `sec_audit`

One call runs a deterministic security audit and returns a compact finding
list:

- changed-file scope (`base`/`head`) or a repository walk;
- the shared diff-aware rule pack;
- `trivy fs --scanners vuln,secret` when available;
- optional evidence-validated model review;
- artifacts on disk and a deterministic summary.

Parameters: `target`, `base`, `head`, `max_findings`, `review`.

### `site_audit`

One call audits one to five HTTP(S) URLs:

- HTML metadata and page-hygiene checks;
- alt-text, heading, link, and structured-data counts;
- copy/slop hints;
- Playwright full-page screenshots when available;
- optional SEO/copy/design review;
- a page scorecard and artifacts.

Parameters: `urls`, `screenshots`, `review`, `max_findings`.

### `pipeline_detail`

Reads `findings.json`, `pages.json`, or `report.md` for a completed run:

```json
{ "run_id": "...", "artifact": "report.md" }
```

The run id and artifact name are validated against strict allowlists.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `provider` | `''` | Summarizer provider; empty disables the summary call. |
| `model` | `''` | Summarizer model. |
| `reviewProvider` | `''` | Reviewer provider; empty follows `provider`. |
| `reviewModel` | `''` | Reviewer model; empty follows `model`. |
| `maxTokens` | `8000` | Output cap per model call. |
| `timeoutMs` | `120000` | Model-call timeout. |
| `screenshots` | `true` | Capture page screenshots with Playwright. |
| `allowPrivate` | `false` | Allow audit requests to loopback/private hosts. |
| `artifactDir` | `''` | Artifact root; empty uses `~/.dsh/totem/pipelines`. |

## Design constraints

- Deterministic stages run in-process and are the source of truth.
- The model only reviews or condenses supplied evidence; a model finding is
  unverified until its evidence is checked.
- Repository and page text are treated as untrusted data, never instructions.
- `sec_audit` is read-only. `site_audit` issues only GET requests.
- Artifacts stay on disk so a compact tool result never loses the evidence.

## Artifacts

```text
~/.dsh/totem/pipelines/<run-id>/
  findings.json
  raw-trivy.json
  report.md
  pages.json        # site_audit
  screenshot-*.png  # site_audit, when Playwright is available
```

## Tests

`test/pipelines.test.ts` covers:

- planted security defects and evidence artifacts;
- site metadata/alt-text parsing;
- a live page scorecard;
- tool registration and schemas.

Run:

```sh
bun test test/pipelines.test.ts
```
