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

override_resource {
  target = aws_cognito_user_pool.this
  values = {
    arn = "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test"
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

run "monolith_can_delete_a_cognito_user_by_sub" {
  command = plan

  assert {
    condition     = toset(jsondecode(aws_iam_policy.monolith_cognito_admin_delete.policy).Statement[0].Action) == toset(["cognito-idp:AdminDeleteUser", "cognito-idp:ListUsers"])
    error_message = "The monolith role must look up the username by sub and then delete the user."
  }

  assert {
    condition     = jsondecode(aws_iam_policy.monolith_cognito_admin_delete.policy).Statement[0].Resource == aws_cognito_user_pool.this.arn
    error_message = "The Cognito permissions must be limited to the user pool."
  }
}
