#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER=panicboat-local

echo "==> Preflight: container runtime (colima)"
if ! colima status >/dev/null 2>&1; then
  echo "    colima not running; starting (4 CPU / 8GiB / 60GiB)"
  colima start --cpu 4 --memory 8 --disk 60
fi

echo "==> Cluster: $CLUSTER"
if ! k3d cluster list "$CLUSTER" >/dev/null 2>&1; then
  k3d cluster create --config "$HERE/cluster/k3d-config.yaml"
else
  echo "    exists; reusing"
fi

echo "==> Gateway API CRDs (standard channel v1.2.1)"
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml

echo "==> Cilium (Helm)"
helm repo add cilium https://helm.cilium.io >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install cilium cilium/cilium \
  --namespace kube-system \
  -f "$HERE/infra/cilium/values.yaml" \
  --wait --timeout 5m

echo "==> Wait for node Ready"
kubectl wait --for=condition=Ready node --all --timeout=180s

echo "==> Gateway"
kubectl apply -f "$HERE/infra/gateway/lb-ip-pool.yaml"
kubectl apply -f "$HERE/infra/gateway/gateway-class.yaml"
kubectl apply -f "$HERE/infra/gateway/gateway.yaml"
kubectl wait --for=condition=Programmed gateway/cilium-gateway -n default --timeout=120s

echo "==> Apps (postgres / monolith / frontend)"
kubectl apply -k "$HERE/apps"
kubectl wait --for=condition=Ready pod -l app=postgres --timeout=120s
kubectl rollout status deploy/monolith --timeout=180s
kubectl rollout status deploy/frontend --timeout=180s

echo "==> Cluster foundation ready"
