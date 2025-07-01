#!/bin/bash
set -euo pipefail

# Validate Kubernetes directory structure
# Args: $1 = source-path, $2 = service-name

SOURCE_PATH="$1"
SERVICE_NAME="$2"

if [ ! -d "$SOURCE_PATH" ]; then
  echo "::error::Kustomize directory not found: $SOURCE_PATH"
  echo "Expected kustomize directory structure with overlays for each environment"
  exit 1
fi

KUSTOMIZATION_FILE="$SOURCE_PATH/kustomization.yaml"
if [ ! -f "$KUSTOMIZATION_FILE" ]; then
  echo "::error::kustomization.yaml not found: $KUSTOMIZATION_FILE"
  exit 1
fi

echo "✅ Kustomize structure validated for $SERVICE_NAME"
