# IAM Role for Claude Code Action
resource "aws_iam_role" "claude_code_actions_role" {
  name = "${var.project_name}-${var.environment}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
      },
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-role"
  })
}

# IAM Policy for Bedrock Claude access
resource "aws_iam_policy" "bedrock_claude_policy" {
  name        = "${var.project_name}-${var.environment}-bedrock-policy"
  description = "Policy allowing access to Claude models on Bedrock"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          for model in var.claude_models :
          "arn:aws:bedrock:${var.aws_region}::foundation-model/${model}"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:GetFoundationModel",
          "bedrock:ListFoundationModels"
        ]
        Resource = "*"
      }
    ]
  })

  tags = var.common_tags
}

# Attach Bedrock policy to IAM role
resource "aws_iam_role_policy_attachment" "claude_bedrock_policy_attachment" {
  role       = aws_iam_role.claude_code_actions_role.name
  policy_arn = aws_iam_policy.bedrock_claude_policy.arn
}

# CloudWatch Logs policy
resource "aws_iam_policy" "cloudwatch_logs_policy" {
  name        = "${var.project_name}-${var.environment}-logs-policy"
  description = "Policy allowing CloudWatch Logs access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })

  tags = var.common_tags
}

# Attach CloudWatch Logs policy to IAM role
resource "aws_iam_role_policy_attachment" "cloudwatch_logs_policy_attachment" {
  role       = aws_iam_role.claude_code_actions_role.name
  policy_arn = aws_iam_policy.cloudwatch_logs_policy.arn
}

# Attach any additional policies specified
resource "aws_iam_role_policy_attachment" "additional_policies" {
  count      = length(var.additional_iam_policies)
  role       = aws_iam_role.claude_code_actions_role.name
  policy_arn = var.additional_iam_policies[count.index]
}

# Random suffix for S3 bucket naming
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# S3 bucket for Claude Code Action (logs, configs, etc.)
resource "aws_s3_bucket" "claude_code_actions_bucket" {
  bucket = "${var.project_name}-${var.environment}-${random_id.bucket_suffix.hex}"

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-bucket"
  })
}

# Enable S3 bucket versioning
resource "aws_s3_bucket_versioning" "claude_bucket_versioning" {
  bucket = aws_s3_bucket.claude_code_actions_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "claude_bucket_encryption" {
  bucket = aws_s3_bucket.claude_code_actions_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access to S3 bucket
resource "aws_s3_bucket_public_access_block" "claude_bucket_pab" {
  bucket = aws_s3_bucket.claude_code_actions_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudWatch Log Group for Claude Code Action
resource "aws_cloudwatch_log_group" "claude_code_actions_logs" {
  name              = "/aws/claude-code-action/${var.project_name}-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7

  tags = merge(var.common_tags, {
    LogGroup = "${var.project_name}-${var.environment}"
  })
}
