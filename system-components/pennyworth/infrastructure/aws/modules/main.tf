# pennyworth does not manage any Secrets Manager secret of its own: all three
# (Slack, Alertmanager, GitHub App) already exist as pre-provisioned secrets
# with real values and are referenced directly by ExternalSecret remoteRef.
#
# - Slack (eks/holmesgpt/slack) and GitHub App (github-app/holmes-bot): managed
#   by panicboat/platform's aws/secrets-manager stack (container only, value
#   provisioned manually — see that repo).
# - Alertmanager (eks/holmesgpt/alertmanager): shared with panicboat/platform's
#   own ExternalSecret for the same value (see that repo's
#   kubernetes/components/prometheus-operator/production/kustomization/holmes-alertmanager-external-secret.yaml).
#
# Creating Terraform-managed secrets here would just be unsynced duplicates.
