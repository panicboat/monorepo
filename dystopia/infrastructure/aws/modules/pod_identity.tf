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

resource "aws_iam_policy" "monolith_cognito_admin_delete" {
  name = "monolith-${var.environment}-cognito-admin-delete"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminDeleteUser"]
      Resource = aws_cognito_user_pool.this.arn
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

resource "aws_iam_role" "meeting_translation" {
  name = "meeting-translation-${var.environment}"

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

resource "aws_iam_policy" "meeting_translation" {
  name = "meeting-translation-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["transcribe:StartStreamTranscription"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-lite-v1:0"
      },
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "meeting_translation" {
  role       = aws_iam_role.meeting_translation.name
  policy_arn = aws_iam_policy.meeting_translation.arn
}

resource "aws_eks_pod_identity_association" "meeting_translation" {
  cluster_name    = data.aws_eks_cluster.this.name
  namespace       = "dystopia"
  service_account = "meeting-translation"
  role_arn        = aws_iam_role.meeting_translation.arn

  tags = var.common_tags
}
