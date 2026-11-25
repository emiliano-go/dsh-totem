#!/usr/bin/env bash
# Add a marked, idempotent hosts-file block for the DSH telemetry collector.
# Run with root (sudo). Set DSH_HOSTS_FILE to test against another file.
set -euo pipefail

hosts="${DSH_HOSTS_FILE:-/etc/hosts}"
backup="${hosts}.bak-dsh-telemetry-$(date +%Y%m%d-%H%M%S)"
tmp="$(mktemp "$(dirname "$hosts")/.dsh-telemetry-hosts.XXXXXX")"

if [[ ! -f "$hosts" ]]; then
  echo "not a regular file: $hosts" >&2
  exit 1
fi

cp -a "$hosts" "$backup"

python3 - "$hosts" "$tmp" <<'PY'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text()
target = Path(sys.argv[2])
begin = "# --- dsh telemetry block BEGIN ---"
end = "# --- dsh telemetry block END ---"
block = f"{begin}\n0.0.0.0 dsh-otel-collector.deepseeksvc.com\n:: dsh-otel-collector.deepseeksvc.com\n{end}\n"
pattern = re.compile(r"\n?" + re.escape(begin) + r".*?" + re.escape(end) + r"\n?", re.S)
clean = pattern.sub("\n", source).rstrip() + "\n\n"
target.write_text(clean + block)
PY

test -s "$tmp"
grep -q "dsh-otel-collector.deepseeksvc.com" "$tmp"
chmod 0644 "$tmp"
mv -f "$tmp" "$hosts"

echo "blocked dsh-otel-collector.deepseeksvc.com in $hosts"
echo "backup: $backup"
