#!/bin/bash
set -euo pipefail

# Generate status message for PR workflow status
# Args: All necessary variables passed as environment variables

case "$WORKFLOW_STATUS" in
  "success")
    STATUS_MESSAGE="### ✅ All Workflows Passed!"
    ;;
  "failure")
    STATUS_MESSAGE="### ❌ Some Workflows Failed"
    ;;
  "in_progress")
    STATUS_MESSAGE="### ⏳ Workflows Still Running"
    ;;
  "no_workflows")
    STATUS_MESSAGE="### ❓ No Workflows Found"
    ;;
  *)
    STATUS_MESSAGE="### ❓ Unknown Status"
    ;;
esac

echo "status-message=$STATUS_MESSAGE" >> $GITHUB_OUTPUT
