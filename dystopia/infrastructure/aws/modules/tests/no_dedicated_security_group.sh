#!/usr/bin/env sh
set -eu

module_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

for file in "$module_dir"/*.tf; do
  [ -f "$file" ] || continue
  if grep -Eq '^[[:space:]]*resource[[:space:]]+"aws_security_group"[[:space:]]+"monolith_db"[[:space:]]*\{' "$file"; then
    echo "The dedicated monolith RDS security group must not remain in module configuration." >&2
    exit 1
  fi
done

echo "Dedicated monolith RDS security group removal contract passed."
