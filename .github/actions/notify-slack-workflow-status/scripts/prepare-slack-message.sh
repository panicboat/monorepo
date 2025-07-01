#!/bin/bash
set -euo pipefail

# Prepare Slack message payload
# Args: All necessary variables passed as environment variables

case "$WORKFLOW_STATUS" in
  "success")
    TITLE="🎉 *All workflows passed*"
    ;;
  "failure")
    TITLE="🚨 *Workflows failed*"
    ;;
  "in_progress")
    TITLE="⏳ *Workflows still running*"
    ;;
  *)
    TITLE="❓ *Unknown workflow status*"
    ;;
esac

# Read template and substitute variables
PAYLOAD=$(cat "$ACTION_PATH/templates/slack-message.json" | \
  sed "s/{{title}}/$TITLE/g" | \
  sed "s/{{pr-number}}/$PR_NUMBER/g" | \
  sed "s/{{pr-author}}/$PR_AUTHOR/g" | \
  sed "s/{{workflow-status}}/$WORKFLOW_STATUS/g" | \
  sed "s|{{pr-url}}|$PR_URL|g" | \
  sed "s/{{slack-channel}}/$SLACK_CHANNEL/g")

echo "payload<<EOF" >> $GITHUB_OUTPUT
echo "$PAYLOAD" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT
