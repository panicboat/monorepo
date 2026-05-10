# =============================================================================
# AWS RDS PostgreSQL for monolith service
# =============================================================================
# Phase 6-2 (= application deploy) で provision。 db.t4g.micro Single-AZ、
# eks-production VPC private subnets で deploy、 monolith Pod のみから
# 5432 access 許可。 master credentials は AWS Secrets Manager で管理、
# ESO 経由で K8s Secret に注入。
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_vpc" "eks_production" {
  tags = {
    Name = "vpc-production"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.eks_production.id]
  }
  tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

data "aws_subnet" "private_details" {
  for_each = toset(data.aws_subnets.private.ids)
  id       = each.value
}

resource "random_password" "monolith_db_master" {
  length           = 32
  special          = true
  override_special = "!*-_.~"
}

resource "aws_secretsmanager_secret" "monolith_database" {
  name                    = "panicboat/monolith/database"
  description             = "PostgreSQL credentials for monolith service"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

resource "aws_secretsmanager_secret_version" "monolith_database" {
  secret_id = aws_secretsmanager_secret.monolith_database.id
  secret_string = jsonencode({
    username = "postgres"
    password = random_password.monolith_db_master.result
    host     = aws_db_instance.monolith.address
    port     = aws_db_instance.monolith.port
    database = "monolith"
    url      = "postgres://postgres:${random_password.monolith_db_master.result}@${aws_db_instance.monolith.address}:${aws_db_instance.monolith.port}/monolith"
  })
}

resource "aws_security_group" "monolith_db" {
  name        = "monolith-database-${var.environment}"
  description = "Security group for monolith RDS database (= ${var.environment})"
  vpc_id      = data.aws_vpc.eks_production.id
  tags        = var.common_tags
}

resource "aws_security_group_rule" "monolith_db_ingress" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [for s in data.aws_subnet.private_details : s.cidr_block]
  security_group_id = aws_security_group.monolith_db.id
  description       = "PostgreSQL access from private subnets (= monolith Pod via VPC CNI)"
}

resource "aws_db_subnet_group" "monolith" {
  name       = "monolith-${var.environment}"
  subnet_ids = data.aws_subnets.private.ids
  tags       = var.common_tags
}

resource "aws_db_instance" "monolith" {
  identifier     = "monolith-${var.environment}"
  engine         = "postgres"
  engine_version = "17.4"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "monolith"
  username = "postgres"
  password = random_password.monolith_db_master.result

  db_subnet_group_name   = aws_db_subnet_group.monolith.name
  vpc_security_group_ids = [aws_security_group.monolith_db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7
  backup_window           = "16:00-17:00"
  maintenance_window      = "sun:17:00-sun:18:00"

  skip_final_snapshot = true
  deletion_protection = false

  tags = var.common_tags
}
