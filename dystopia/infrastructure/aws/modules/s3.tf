resource "aws_s3_bucket" "media" {
  bucket = "dystopia-media-${var.environment}"

  tags = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://dystopia.city"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_iam_policy" "monolith_media_s3" {
  name = "monolith-${var.environment}-media-s3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.media.arn}/*"
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "monolith_media_s3" {
  role       = aws_iam_role.monolith.name
  policy_arn = aws_iam_policy.monolith_media_s3.arn
}
