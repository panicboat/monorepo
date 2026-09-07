#!/usr/bin/env bash
set -euo pipefail

module_dir="$(cd "$(dirname "$0")/.." && pwd)"

if rg -n 'resource "aws_security_group" "monolith_db"' "$module_dir" --glob '*.tf'; then
  echo "The dedicated monolith RDS security group must not remain in module configuration." >&2
  exit 1
fi

echo "Dedicated monolith RDS security group removal contract passed."
