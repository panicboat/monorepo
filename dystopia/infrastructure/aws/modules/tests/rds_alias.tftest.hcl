mock_provider "aws" {
  mock_data "aws_security_group" {
    defaults = {
      id = "sg-private-trust"
    }
  }
}
mock_provider "random" {}

override_data {
  target = data.aws_vpc.eks_production
  values = {
    id = "vpc-test"
  }
}

override_data {
  target = data.aws_subnets.private
  values = {
    ids = ["subnet-a", "subnet-b"]
  }
}

override_data {
  target = data.aws_security_group.private_trust
}

override_resource {
  target = random_password.monolith_db_master
  values = {
    result = "TestPassword-0123456789"
  }
}

variables {
  project_name         = "services"
  environment          = "production"
  user_pool_name       = "services-production"
  aws_region           = "ap-northeast-1"
  db_identifier        = "monolith-production"
  db_subnet_group_name = "monolith-production"
  common_tags = {
    Environment = "production"
  }
}

run "rds_alias_zone_and_record_are_configured" {
  command = plan

  assert {
    condition     = aws_route53_zone.dystopia_local.name == "dystopia.local"
    error_message = "The private hosted zone must be named dystopia.local."
  }

  assert {
    condition     = contains([for v in aws_route53_zone.dystopia_local.vpc : v.vpc_id], data.aws_vpc.eks_production.id)
    error_message = "The private hosted zone must be associated with the production VPC."
  }

  assert {
    condition     = aws_route53_record.monolith_db.name == "monolith-db.dystopia.local"
    error_message = "The alias record name must be monolith-db.dystopia.local."
  }

  assert {
    condition     = aws_route53_record.monolith_db.type == "CNAME"
    error_message = "The alias must be a CNAME record."
  }
}
