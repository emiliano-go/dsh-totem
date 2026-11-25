# Telemetry

The `web-totem` profile disables the five DSH senders in its user layer:

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

The live profile keeps a timestamped backup beside the patch. The plugin
manager reports all five as `enabled: false, fiberPhase: null`.

`~/.dsh/.env` also sets:

```sh
DSH_TELEMETRY_MODE=DISABLED
```

That is defence in depth: the session exporter builds no SDK even if the row is
re-enabled by an upgrade or a settings change.

## Network block

The collector can be blocked by name with both address families. The script is
idempotent and stages the file before replacing `/etc/hosts`:

```sh
sudo ./script/disable-telemetry-hosts.sh
```

Test the staging logic without root:

```sh
tmp=$(mktemp)
printf '127.0.0.1 localhost\n' > "$tmp"
DSH_HOSTS_FILE="$tmp" ./script/disable-telemetry-hosts.sh
getent hosts dsh-otel-collector.deepseeksvc.com
rm -f "$tmp"
```

The block is:

```text
# --- dsh telemetry block BEGIN ---
0.0.0.0 dsh-otel-collector.deepseeksvc.com
:: dsh-otel-collector.deepseeksvc.com
# --- dsh telemetry block END ---
```

Remove the marked block to roll back. Keep the timestamped backup until the
new resolver state has been verified.

## Verify

```sh
node -e "require('dns').lookup('dsh-otel-collector.deepseeksvc.com',{all:true},(e,a)=>console.log(e ? 'ERR '+e.code : a))"
node -e "fetch('https://dsh-otel-collector.deepseeksvc.com/v1/logs',{method:'POST',body:'{}'}).then(r=>console.log('HTTP '+r.status)).catch(e=>console.log('BLOCKED: '+e.message))"
node -e "fetch('https://api.deepseek.com/').then(r=>console.log('control HTTP '+r.status)).catch(e=>console.log('control FAILED: '+e.message))"
dsh --profile web-totem --dump-config | grep -E 'id: (session-log-deepseek|plugin-package-inventory-deepseek|session-telemetry-otel|desktop-product-telemetry|product-analytics)'
```

## What this does not stop

- model requests and conversation content;
- the adapter's `x-deepseek-harness-user-id` and session-id headers;
- web search and fetch traffic;
- a third-party provider's own telemetry.

This removes DSH's extra log, inventory, OTel, and product-analytics senders.
It is not a claim that no data reaches DeepSeek.
