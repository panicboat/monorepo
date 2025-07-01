#!/bin/bash
set -euo pipefail

# Generate comment message for Kubernetes results
# Args: All necessary variables passed as environment variables

if [ "$BUILD_FAILED" == "true" ]; then
  TEMPLATE_FILE="$ACTION_PATH/templates/comment-failure.md"
else
  TEMPLATE_FILE="$ACTION_PATH/templates/comment-success.md"
fi

# Read template and substitute variables
COMMENT_BODY=$(cat "$TEMPLATE_FILE" | \
  sed "s|{{service-name}}|$SERVICE_NAME|g" | \
  sed "s|{{environment}}|$ENVIRONMENT|g" | \
  sed "s|{{build-status}}|$BUILD_STATUS|g" | \
  sed "s|{{target-repository}}|$TARGET_REPOSITORY|g" | \
  sed "s|{{target-branch}}|$TARGET_BRANCH|g" | \
  sed "s|{{source-path}}|$SOURCE_PATH|g" | \
  sed "s|{{has-changes}}|$HAS_CHANGES|g" | \
  sed "s|{{pr-number}}|$PR_NUMBER|g" | \
  sed "s|{{github-sha}}|$GITHUB_SHA|g" | \
  sed "s|{{github-server-url}}|$GITHUB_SERVER_URL|g" | \
  sed "s|{{github-repository}}|$GITHUB_REPOSITORY|g" | \
  sed "s|{{github-run-id}}|$GITHUB_RUN_ID|g")

# Save to output
echo "comment-body<<EOF" >> $GITHUB_OUTPUT
echo "$COMMENT_BODY" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT
