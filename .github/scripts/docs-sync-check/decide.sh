#!/usr/bin/env bash
set -euo pipefail

changed_files="$(cat)"
is_approved="$APPROVED"
remove_label=false

emit() {
  echo "mode=$1"
  echo "remove_label=${remove_label}"
}

if [ "$EVENT_ACTION" = "labeled" ] && [ "$EVENT_LABEL" != "docs-check-approved" ]; then
  emit ignore
  exit 0
fi

if [ "$AUTHOR_TYPE" = "Bot" ]; then
  emit skip-bot
  exit 0
fi

if [ "$EVENT_ACTION" = "synchronize" ] && [ "$is_approved" = "true" ]; then
  is_approved=false
  remove_label=true
fi

if [ "$is_approved" = "true" ]; then
  emit approved
  exit 0
fi

if ! grep -q '^dystopia/' <<<"$changed_files"; then
  emit skip-unchanged
  exit 0
fi

emit judge
