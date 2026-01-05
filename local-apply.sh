#!/bin/bash
#
# Usage:
#   sh local-apply.sh [apply|delete]
#
# Examples:
#   sh local-apply.sh        # Apply manifests (default) and suspend Flux
#   sh local-apply.sh apply  # Same as above
#   sh local-apply.sh delete # Delete manifests
#

COMMAND=${1:-apply} # apply or delete

# FluxCD suspend the Kustomizations
if [ "$COMMAND" == "apply" ]; then
    flux suspend kustomization monolith reverse-proxy nyx -n flux-system
fi

deploy() {
    echo "Running kubectl $COMMAND -k $1"
    kubectl $COMMAND -k $1
}

# Monolith
deploy "services/monolith/kubernetes/overlays/develop"

# Reverse Proxy
deploy "services/reverse-proxy/kubernetes/overlays/develop"

# Nyx
deploy "web/nyx/kubernetes/overlays/develop"
