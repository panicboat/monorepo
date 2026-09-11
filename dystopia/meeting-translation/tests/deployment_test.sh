#!/usr/bin/env sh
set -eu

service_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
repository_dir=$(CDPATH= cd -- "$service_dir/../.." && pwd)
rendered_service=$(mktemp)
rendered_cluster=$(mktemp)
trap 'rm -f "$rendered_service" "$rendered_cluster"' EXIT

kustomize build "$service_dir/kubernetes/overlays/production" >"$rendered_service"
kustomize build "$repository_dir/clusters/production/dystopia" >"$rendered_cluster"

assert_value() {
  actual=$(yq eval-all "$1" "$2")
  expected=$3
  message=$4

  if [ "$actual" != "$expected" ]; then
    printf '%s: expected %s, got %s\n' "$message" "$expected" "$actual" >&2
    exit 1
  fi
}

assert_pattern() {
  actual=$(yq eval-all "$1" "$2")
  expected=$3
  message=$4

  if ! printf '%s\n' "$actual" | grep -Eq -- "$expected"; then
    printf '%s: %s does not match %s\n' "$message" "$actual" "$expected" >&2
    exit 1
  fi
}

assert_value 'select(.kind == "Deployment" and .metadata.name == "meeting-translation") | .spec.replicas' "$rendered_service" '1' 'Deployment replicas'
assert_value 'select(.kind == "Deployment" and .metadata.name == "meeting-translation") | .spec.strategy.type' "$rendered_service" 'Recreate' 'Deployment strategy'
assert_value 'select(.kind == "Deployment" and .metadata.name == "meeting-translation") | .spec.template.spec.containers[0].env[] | select(.name == "PORT") | .value' "$rendered_service" '3000' 'Container PORT'
assert_pattern 'select(.kind == "Deployment" and .metadata.name == "meeting-translation") | .spec.template.spec.containers[0].image' "$rendered_service" '^ghcr\.io/panicboat/monorepo/meeting-translation:v[0-9]+\.[0-9]+\.[0-9]+$' 'Production image'
assert_value 'select(.kind == "Service" and .metadata.name == "meeting-translation") | .spec.ports[0].targetPort' "$rendered_service" '3000' 'Service target port'
assert_value 'select(.kind == "HTTPRoute" and .metadata.name == "meeting-translation") | .spec.rules[0].matches[0].path.value' "$rendered_service" '/translate' 'HTTPRoute prefix'
assert_value 'select(.kind == "ConfigMap" and .metadata.name == "meeting-translation") | .data | length' "$rendered_service" '4' 'ConfigMap key count'
assert_value '[select(.kind == "Kustomization" and .metadata.name == "meeting-translation" and .metadata.namespace == "flux-system")] | length' "$rendered_cluster" '1' 'Flux service registration'
assert_value '[select(.kind == "ImagePolicy" and .metadata.name == "meeting-translation")] | length' "$rendered_cluster" '1' 'Flux image policy registration'

printf 'Meeting translation deployment contract passed.\n'
