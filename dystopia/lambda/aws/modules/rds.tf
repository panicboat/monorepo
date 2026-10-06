# Keep the password alphanumeric because it is embedded in DATABASE_URL without escaping.
resource "random_password" "monolith_db_master" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "monolith" {
  name       = "monolith-${var.environment}"
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]
}

resource "aws_db_instance" "monolith" {
  identifier     = "monolith-${var.environment}"
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
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7
  backup_window           = "16:00-17:00"
  maintenance_window      = "sun:17:00-sun:18:00"

  skip_final_snapshot = true
  deletion_protection = false
}

resource "aws_route53_zone" "dystopia_local" {
  name = "dystopia.local"

  vpc {
    vpc_id = aws_vpc.this.id
  }
}

resource "aws_route53_record" "monolith_db" {
  zone_id = aws_route53_zone.dystopia_local.zone_id
  name    = "monolith-db.dystopia.local"
  type    = "CNAME"
  ttl     = 300
  records = [aws_db_instance.monolith.address]
}
