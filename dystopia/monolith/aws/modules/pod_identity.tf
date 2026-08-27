# =============================================================================
# EKS Pod Identity for the monolith pod
# =============================================================================
# Binds the Kubernetes ServiceAccount `dystopia:monolith` to an IAM role so the
# pod can call AWS APIs without static credentials. Uses the Pod Identity
# mechanism (`pods.eks.amazonaws.com`) rather than IRSA (OIDC federation)
# because the cluster runs the `eks-pod-identity-agent` addon and the pattern
# elsewhere in the platform repo (`eks-secrets`, `eks-traces`, ...) is Pod
# Identity.
#
# Currently attached policies:
# - `monolith_cognito_admin_delete` — Cognito hard-delete for the purge cron.
#
# Additional AWS permissions (S3 for media uploads, etc.) should attach to
# `aws_iam_role.monolith` here, not to a new role.
# =============================================================================

data "aws_eks_cluster" "this" {
  name = "eks-${var.environment}"
}

resource "aws_iam_role" "monolith" {
  name = "monolith-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "pods.eks.amazonaws.com"
      }
      Action = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "monolith_cognito_admin_delete" {
  role       = aws_iam_role.monolith.name
  policy_arn = aws_iam_policy.monolith_cognito_admin_delete.arn
}

resource "aws_eks_pod_identity_association" "monolith" {
  cluster_name    = data.aws_eks_cluster.this.name
  namespace       = "dystopia"
  service_account = "monolith"
  role_arn        = aws_iam_role.monolith.arn

  tags = var.common_tags
}
