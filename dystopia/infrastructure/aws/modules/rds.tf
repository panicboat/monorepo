resource "random_password" "monolith_db_master" {
  length           = 32
  special          = true
  override_special = "!*-_.~"
}

resource "aws_secretsmanager_secret" "monolith_database" {
  name                    = "dystopia/monolith/database"
  description             = "PostgreSQL credentials for monolith service"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

// TODO: Remove after RDS uses only the private trust security group and this SG has no ENI attachments.
resource "aws_security_group" "monolith_db" {
  name        = "monolith-database-${var.environment}"
  description = "Security group for monolith RDS database (= ${var.environment})"
  vpc_id      = data.aws_vpc.eks_production.id
  tags        = var.common_tags
}

resource "aws_db_subnet_group" "monolith" {
  name       = var.db_subnet_group_name
  subnet_ids = data.aws_subnets.private.ids
  tags       = var.common_tags
}

resource "aws_db_instance" "monolith" {
  identifier     = var.db_identifier
  engine         = "postgres"
  engine_version = "18.6"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "monolith"
  username = "postgres"
  password = random_password.monolith_db_master.result

  db_subnet_group_name   = aws_db_subnet_group.monolith.name
  vpc_security_group_ids = [data.aws_security_group.private_trust.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7
  backup_window           = "16:00-17:00"
  maintenance_window      = "sun:17:00-sun:18:00"

  skip_final_snapshot = true
  deletion_protection = false

  tags = var.common_tags
}
