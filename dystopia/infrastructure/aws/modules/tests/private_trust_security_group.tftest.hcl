mock_provider "aws" {
  mock_data "aws_security_group" {
    defaults = {
      id = "sg-private-trust"
    }
  }

  mock_resource "aws_iam_policy" {
    defaults = {
      arn = "arn:aws:iam::337169763788:policy/test"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::337169763788:role/test"
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

run "uses_private_trust_security_group_for_rds" {
  command = plan

  assert {
    condition = (
      length(aws_db_instance.monolith.vpc_security_group_ids) == 1 &&
      contains(aws_db_instance.monolith.vpc_security_group_ids, data.aws_security_group.private_trust.id)
    )
    error_message = "RDS must use only the private trust security group."
  }

  assert {
    condition     = data.aws_security_group.private_trust.vpc_id == data.aws_vpc.eks_production.id
    error_message = "The private trust security group must be constrained to the production VPC."
  }

  assert {
    condition     = length(data.aws_security_group.private_trust.tags) == 1 && data.aws_security_group.private_trust.tags["Name"] == "private-trust-production"
    error_message = "The private trust lookup must select exactly the production Name tag."
  }

}
