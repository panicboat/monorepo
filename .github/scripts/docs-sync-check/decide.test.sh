#!/usr/bin/env bash
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
decide="${script_dir}/decide.sh"
failed=0

check() {
  local name="$1" action="$2" label="$3" approved="$4" author="$5" files="$6" expected_mode="$7" expected_remove="$8"
  local expected actual
  expected="$(printf 'mode=%s\nremove_label=%s' "$expected_mode" "$expected_remove")"
  actual="$(printf '%s' "$files" | EVENT_ACTION="$action" EVENT_LABEL="$label" APPROVED="$approved" AUTHOR_TYPE="$author" bash "$decide" 2>&1)"
  if [ "$actual" = "$expected" ]; then
    echo "PASS ${name}"
  else
    echo "FAIL ${name}"
    echo "  expected: ${expected//$'\n'/ | }"
    echo "  actual:   ${actual//$'\n'/ | }"
    failed=1
  fi
}

check ignores_other_labels labeled deploy:frontend false User $'dystopia/a.rb' ignore false
check ignores_other_labels_even_when_approved labeled deploy:frontend true User $'dystopia/a.rb' ignore false
check skips_bots opened '' false Bot $'dystopia/a.rb' skip-bot false
check skips_without_dystopia_changes opened '' false User $'platform/a.tf' skip-unchanged false
check skips_empty_diff opened '' false User '' skip-unchanged false
check judges_dystopia_changes opened '' false User $'README.md\ndystopia/docs/x.md' judge false
check does_not_match_prefix_only opened '' false User $'dystopia-old/a.rb' skip-unchanged false
check passes_on_approval_label labeled docs-check-approved true User $'dystopia/a.rb' approved false
check passes_on_edit_while_approved edited '' true User $'dystopia/a.rb' approved false
check push_after_approval_rejudges synchronize '' true User $'dystopia/a.rb' judge true
check push_after_approval_without_dystopia synchronize '' true User $'platform/a.tf' skip-unchanged true

exit "$failed"
