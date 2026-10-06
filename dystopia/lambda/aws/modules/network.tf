locals {
  availability_zones = ["ap-northeast-1a", "ap-northeast-1c", "ap-northeast-1d"]
}

resource "aws_vpc" "this" {
  cidr_block                       = "10.10.0.0/16"
  assign_generated_ipv6_cidr_block = true
  enable_dns_support               = true
  enable_dns_hostnames             = true

  tags = {
    Name = "dystopia-${var.environment}"
  }
}

resource "aws_subnet" "private" {
  for_each = { for index, zone in local.availability_zones : zone => index }

  vpc_id                          = aws_vpc.this.id
  availability_zone               = each.key
  cidr_block                      = cidrsubnet(aws_vpc.this.cidr_block, 8, each.value)
  ipv6_cidr_block                 = cidrsubnet(aws_vpc.this.ipv6_cidr_block, 8, each.value)
  assign_ipv6_address_on_creation = true

  tags = {
    Name = "dystopia-${var.environment}-private-${each.key}"
  }
}

resource "aws_egress_only_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "dystopia-${var.environment}"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "dystopia-${var.environment}-private"
  }
}

# Use a standalone route because inline routes would fight the S3 gateway endpoint for ownership of the table.
resource "aws_route" "ipv6_egress" {
  route_table_id              = aws_route_table.private.id
  destination_ipv6_cidr_block = "::/0"
  egress_only_gateway_id      = aws_egress_only_internet_gateway.this.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name = "dystopia-${var.environment}-s3"
  }
}

resource "aws_security_group" "lambda" {
  name        = "dystopia-${var.environment}-lambda"
  description = "dystopia Lambda functions"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_egress_rule" "lambda_ipv4" {
  security_group_id = aws_security_group.lambda.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "lambda_ipv6" {
  security_group_id = aws_security_group.lambda.id
  ip_protocol       = "-1"
  cidr_ipv6         = "::/0"
}

resource "aws_security_group" "rds" {
  name        = "dystopia-${var.environment}-rds"
  description = "dystopia RDS instance"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_lambda" {
  security_group_id            = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.lambda.id
}
