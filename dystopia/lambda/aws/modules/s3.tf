resource "aws_s3_bucket" "media" {
  bucket = "dystopia-media-${var.environment}"
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
    allowed_origins = ["https://${var.domain_name}"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
