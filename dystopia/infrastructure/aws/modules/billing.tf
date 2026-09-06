resource "aws_secretsmanager_secret" "monolith_billing" {
  name                    = "dystopia/monolith/billing"
  description             = "Stripe billing configuration for monolith service"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}
