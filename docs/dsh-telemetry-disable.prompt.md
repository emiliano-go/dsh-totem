# Prompt — Disable DSH telemetry and stop data egress

**How to use:** paste everything below the horizontal rule into a fresh DSH session
on the target machine. It assumes DSH Desktop 0.2.2-rc.5 (the version this was
validated against); Step 1 makes the agent confirm that before touching anything.

**Validated on:** Windows, DSH Desktop 0.2.2-rc.5, profile `desktop`, 2026-11-25.

---

You are operating on **DeepSeek Harness (DSH) Desktop**. Your task is to disable
its telemetry and session-upload paths, and to block its telemetry collector at
the network layer. This is a privacy hardening job on a live installation.

## Rules

1. **Verify from the installed code, not from this prompt.** Every factual claim
   here was true of one specific build. Confirm each one by reading the actual
   files before acting. Where this prompt and the code disagree, the code wins —
   and say so in your report.
2. **Do not modify `app.asar`.** Config-only. It is 200+ MB, code-signed, and an
   auto-update would silently revert it.
3. **Read before you write.** Confirm the current state of every file you change.
4. **Never mutate the hosts file in place.** See Pitfalls.
5. **Ask before changing anything** outside the profile patch file and the hosts
   file.
6. Report honestly what remains leaking after the job — Step 7 is not optional.

## Objective

Five independent plugins are the senders. All five must end up disabled:

| Row id | Package | What it sends |
|---|---|---|
| `session-log-deepseek` | `@deepseek-ai/dsh-session-log-deepseek` | whole session log, as a `dsh_session_log` field on model requests |
| `plugin-package-inventory-deepseek` | `@deepseek-ai/dsh-plugin-package-inventory-deepseek` | `dsh_plugin_packages` field: installed plugin names+versions |
| `session-telemetry-otel` | `@deepseek-ai/dsh-session-telemetry-otel` | session log to OTLP on feedback |
| `desktop-product-telemetry` | `@deepseek-ai/dsh-host-product-telemetry-otel` | product usage events to OTLP |
| `product-analytics` | `@deepseek-ai/dsh-client-product-analytics` | GUI actions to the product telemetry service |

Plus a network-level block on `dsh-otel-collector.deepseeksvc.com` as the
independent second layer.

---

## Step 1 — Recon (read-only)

Confirm the build and locate the composition:

1. Read `resources/app.asar/dsh/package.json` in the install directory (usually
   `C:\Users\<you>\AppData\Local\Programs\DeepSeek Harness\`). Record `version`.
2. `plugin_manager(action="list_plugins", limit=100, offset=0)` and again at
   `offset=100`. Confirm the five rows exist and note each one's `enabled` and
   `fiberPhase`. You need this baseline to prove later that nothing else broke.
3. Read the active profile's `<dsh-home>/profiles/desktop/cordis.patch.yml`
   (`<dsh-home>` is usually `C:\Users\<you>\.dsh`). Note any existing entries for
   the five rows.
4. Read the bundle compositions to confirm the collector URL for this build:
   - `app.asar/dsh/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml` → the
     `session-telemetry-otel` row's `exporter.url`
   - `app.asar/dsh/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml` → the
     `desktop-product-telemetry` row's `endpoint`
   - `app.asar/dsh/node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/lib/index.js`
     → its `Config` schema's default `endpoint`
   Expected: both land on `https://dsh-otel-collector.deepseeksvc.com/v1/logs`.
   If they don't, use what the code says for Step 4.

**Do not proceed** if the five rows are not present or the version differs
materially — report the discrepancy instead.

## Step 2 — Disable the five senders

Use the plugin manager; it persists to the profile patch **and** applies live, so
no restart is needed:

```
plugin_manager(action="set_plugin", target="include:<row-id>", enabled=false)
```

for each of the five `row-id`s above, one at a time. The `include:` prefix is the
entry-id form the registry reports.

**Expected warning, not an error:** disabling `desktop-product-telemetry` reports
that `product-analytics` is `pending (waiting for service: productTelemetry)`.
`product-analytics` injects a service the former provides. Disabling
`product-analytics` too resolves it — do that before judging the result.

**Manual fallback** if the plugin manager is unavailable: append to
`<dsh-home>/profiles/desktop/cordis.patch.yml`

```yaml
- id: session-log-deepseek
  disabled: true
- id: plugin-package-inventory-deepseek
  disabled: true
- id: session-telemetry-otel
  disabled: true
- id: desktop-product-telemetry
  disabled: true
- id: product-analytics
  disabled: true
```

then restart DSH. Keep the file a single top-level YAML array.

## Step 3 — Verify the loader state

`list_plugins` at both offsets again and check:

- All five now report `enabled: false, fiberPhase: null`.
- **No** entry reports `enabled: true` with `fiberPhase: null` — that combination
  means a plugin is mounted but never activated, i.e. you broke a consumer.
- `llm-deepseek` is still `active`. If it is not, model calls are dead; roll back.

Confirm the patch file now shows `disabled: true` on all five.

## Step 4 — Network block on the collector

First resolve the host and record the result:

```powershell
Resolve-DnsName dsh-otel-collector.deepseeksvc.com
```

It is normally a **CloudFront** CNAME. Confirm this before choosing a mechanism:
**if it is CloudFront, do not create an IP-based firewall rule** — its IP rotates
(failing open later) and its IPs are shared with unrelated services. Check:

```powershell
Resolve-DnsName api.deepseek.com -Type A
```

If that returns the same IP as the collector, an IP rule would also break the
DeepSeek API. Use a **hosts-file block** instead: name-based, survives IP churn,
zero collateral.

Write the block as a script, then run it **elevated** (a UAC prompt will appear;
the agent's shell is not elevated by default):

1. Take a timestamped backup of the hosts file.
2. Rebuild the full content from the backup (or the current file if it is intact),
   stripping any earlier copy of the marked block so the operation is idempotent.
3. Append:

```
# --- dsh telemetry block BEGIN ---
0.0.0.0 dsh-otel-collector.deepseeksvc.com
:: dsh-otel-collector.deepseeksvc.com
# --- dsh telemetry block END ---
```

4. Write that content to a **staging file** in the same directory, verify its size
   is plausible, and only then `Copy-Item -Force` it over hosts. Verify the
   resulting size matches the staged size.
5. `ipconfig /flushdns`.

Both the IPv4 and IPv6 lines are required: pinning only `0.0.0.0` leaves an AAAA
route open.

## Step 5 — Verification battery

Prove the block at the socket level, not just in the resolver:

```powershell
# Same resolver the DSH host process uses. Expect ENOENT.
node -e "const dns=require('dns');dns.lookup('dsh-otel-collector.deepseeksvc.com',{all:true},(e,a)=>console.log(e?'ERR '+e.code:JSON.stringify(a)))"

# Expect failure. Must NOT print an HTTP status.
node -e "fetch('https://dsh-otel-collector.deepseeksvc.com/v1/logs',{method:'POST',body:'{}',signal:AbortSignal.timeout(10000)}).then(r=>console.log('HTTP '+r.status)).catch(e=>console.log('BLOCKED: '+e.message))"
```

Then prove you broke nothing else:

```powershell
# Other names must still resolve normally.
Resolve-DnsName api.deepseek.com -Type A
Resolve-DnsName github.com -Type A

# Live HTTPS control must succeed (401 is a pass: reachable, just unauthenticated).
node -e "fetch('https://api.deepseek.com/',{signal:AbortSignal.timeout(10000)}).then(r=>console.log('control HTTP '+r.status)).catch(e=>console.log('control FAILED: '+e.message))"
```

## Step 6 — Optional hardening (ask first)

- `DSH_TELEMETRY_MODE=DISABLED` — the session exporter builds no SDK at all.
- `DSH_TELEMETRY_OTLP_URL` / `DSH_PRODUCT_ANALYTICS_OTLP_URL` — redirect each
  exporter to an endpoint you control, instead of blocking it.
- `DSH_TELEMETRY_DISABLED` (any value, including `0`/`false`) — the launchers patch
  only the **session** telemetry row disabled. It does **not** affect product
  telemetry. Do not rely on it alone.
- Delete `<dsh-home>/.anonymous-user-id` to rotate the fixed install identity. It
  is regenerated on next start; deleting it does not stop it being sent.

## Step 7 — Report what still leaks

Be explicit that this job does **not** achieve "no data to DeepSeek". Still true
after all of the above:

1. **Model requests themselves.** Using a DeepSeek model sends your conversation
   to DeepSeek by design. Step 2 removes the extra log field, not the request.
2. **Fixed identifiers.** `x-deepseek-harness-user-id` and
   `x-deepseek-harness-session-id` are added by the adapter, not by the five
   plugins. No config switch removes them. Only patching `app.asar`, or routing
   through a proxy that strips them, does. Do not claim otherwise.
3. **Third-party routes.** The two request-extension fields only attach to the
   official DeepSeek adapter. With a third-party provider mounted through
   `llm-pi-ai`, they are never added — but a DeepSeek request later in the same
   session still carries that session's history.
4. **Web search / fetch** contact DeepSeek's APIs when those tools are used, with
   the account token or API key. Unrelated to telemetry, still egress.

State plainly which of these are in scope of the user's request and which are
inherent to using the product.

## Rollback

- Plugins: set `disabled: false` via `plugin_manager`, or delete the five patch
  entries.
- Hosts: remove the four marked lines and restore from the timestamped
  `hosts.bak-*`, then `ipconfig /flushdns`.

---

## Pitfalls (all observed in practice)

| Don't | Why | Do instead |
|---|---|---|
| `config: {enabled: false}` and assume the plugin is off | It is a plugin *setting*. The row stays mounted; the registry still shows `enabled: true`. It may gate behaviour (e.g. `session-log-deepseek` reads it per request) but the code still loads. | Top-level `disabled: true` on the row. |
| `Set-Content` directly on `C:\Windows\System32\drivers\etc\hosts` | Observed truncating the file to **0 bytes** and then failing the write, leaving an empty hosts file and exit code 1 with no logged exception. | Stage to a temp file, verify size, `Copy-Item -Force`, verify again. |
| Disable `desktop-product-telemetry` alone | Leaves `product-analytics` `pending` on a missing `productTelemetry` service. | Disable both together. |
| IP-based firewall rule for the collector | CloudFront: IP rotates (block fails open) and is shared (breaks other sites — it can collide with `api.deepseek.com`). | hosts-file block by name. |
| `0.0.0.0` line only | Leaves the AAAA path open. | Add the `::` line too. |
| Editing `app.asar` | Code signing, and every auto-update reverts it. | Profile patch + hosts. |

## Acceptance criteria

- [ ] All five rows: `enabled: false, fiberPhase: null`.
- [ ] No entry has `enabled: true` with `fiberPhase: null`.
- [ ] `llm-deepseek` still `active`; a model call succeeds after the change.
- [ ] Patch file persists `disabled: true` on all five.
- [ ] `node` `dns.lookup` on the collector returns `ENOENT`.
- [ ] A real `fetch` to the collector fails; no HTTP status is printed.
- [ ] `api.deepseek.com` resolves and returns a live HTTP response.
- [ ] hosts file has a timestamped backup and is not empty.
- [ ] Step 7 reported, with the remaining egress named explicitly.
