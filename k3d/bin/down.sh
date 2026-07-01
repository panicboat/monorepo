#!/usr/bin/env bash
set -euo pipefail
CLUSTER=panicboat-local
k3d cluster delete "$CLUSTER"
