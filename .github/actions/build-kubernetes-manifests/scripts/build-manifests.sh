#!/bin/bash
set -euo pipefail

# Build Kubernetes manifests using Kustomize
# Args: $1 = source-path, $2 = service-name

SOURCE_PATH="$1"
SERVICE_NAME="$2"
OUTPUT_FILE="/tmp/${SERVICE_NAME}-generated.yaml"

echo "Building manifests from: $SOURCE_PATH"

if kustomize build "$SOURCE_PATH" > "$OUTPUT_FILE"; then
  if [ ! -s "$OUTPUT_FILE" ]; then
    echo "::error::Generated manifest file is empty"
    echo "status=❌ Failed" >> $GITHUB_OUTPUT
    echo "build-failed=true" >> $GITHUB_OUTPUT
    exit 1
  fi

  echo "status=✅ Success" >> $GITHUB_OUTPUT
  echo "output-file=$OUTPUT_FILE" >> $GITHUB_OUTPUT
  echo "build-failed=false" >> $GITHUB_OUTPUT
  echo "✅ Successfully built manifests for $SERVICE_NAME"
else
  echo "status=❌ Failed" >> $GITHUB_OUTPUT
  echo "build-failed=true" >> $GITHUB_OUTPUT
  echo "::error::Failed to build manifests for $SERVICE_NAME"
  exit 1
fi
