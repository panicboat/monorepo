mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "337169763788"
    }
  }

  mock_data "aws_vpc" {
    defaults = {
      id = "vpc-test"
    }
  }

  mock_data "aws_security_group" {
    defaults = {
      id = "sg-internal"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::337169763788:role/dystopia-cognito-sms"
    }
  }

  mock_resource "aws_db_instance" {
    defaults = {
      port = 5432
    }
  }

  mock_resource "aws_route53_record" {
    defaults = {
      fqdn = "monolith-db.dystopia.local"
    }
  }

  mock_resource "aws_cognito_user_pool" {
    defaults = {
      id  = "ap-northeast-1_test"
      arn = "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test"
    }
  }

  mock_resource "aws_cognito_user_pool_client" {
    defaults = {
      id = "testclientid"
    }
  }

  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::dystopia-media-337169763788"
    }
  }
}

mock_provider "random" {}

override_resource {
  target = random_password.monolith_db_master
  values = {
    result = "TestPassword0123456789"
  }
}

variables {
  aws_region  = "ap-northeast-1"
  domain_name = "dystopia.city"
}

run "database_is_private_and_shared_through_internal" {
  command = plan

  assert {
    condition = (
      data.aws_vpc.this.tags["Name"] == "vpc" &&
      data.aws_security_group.internal.tags["Name"] == "internal"
    )
    error_message = "The VPC and the shared security group must be looked up by the Name tags the platform VPC stack sets."
  }

  assert {
    condition     = aws_db_instance.monolith.identifier == "monolith"
    error_message = "The database identifier must not carry an environment name."
  }

  assert {
    condition = (
      aws_db_instance.monolith.publicly_accessible == false &&
      aws_db_instance.monolith.deletion_protection == true &&
      aws_db_instance.monolith.multi_az == false
    )
    error_message = "RDS must be private, protected from deletion and single AZ."
  }

  assert {
    condition = (
      aws_db_instance.monolith.engine_version == "18.6" &&
      aws_db_instance.monolith.instance_class == "db.t4g.micro"
    )
    error_message = "RDS must run PostgreSQL 18.6 on db.t4g.micro."
  }

  assert {
    condition     = aws_db_instance.monolith.db_subnet_group_name == "vpc"
    error_message = "RDS must use the DB subnet group owned by the platform VPC stack."
  }

  assert {
    condition     = aws_db_instance.monolith.vpc_security_group_ids == toset(["sg-internal"])
    error_message = "RDS must accept traffic through the shared internal security group only."
  }

  assert {
    condition     = random_password.monolith_db_master.special == false && random_password.monolith_db_master.length == 32
    error_message = "The database password must stay 32 alphanumeric characters because DATABASE_URL embeds it without escaping."
  }

  assert {
    condition     = aws_route53_record.monolith_db.name == "monolith-db.dystopia.local"
    error_message = "The database must keep the private DNS alias monolith-db.dystopia.local."
  }

  assert {
    condition = (
      output.database_host == "monolith-db.dystopia.local" &&
      output.database_port == 5432 &&
      output.database_name == "monolith" &&
      output.database_username == "postgres" &&
      output.database_password == "TestPassword0123456789"
    )
    error_message = "The connection outputs must expose the DNS alias, port, database name, user and password."
  }
}

run "identity_and_media_names_have_no_environment" {
  command = plan

  assert {
    condition     = aws_cognito_user_pool.this.name == "dystopia"
    error_message = "The user pool name must not carry an environment name."
  }

  assert {
    condition     = aws_cognito_user_pool_client.this.name == "dystopia"
    error_message = "The user pool client name must be dystopia."
  }

  assert {
    condition = (
      aws_iam_role.cognito_sms.name == "dystopia-cognito-sms" &&
      aws_cognito_user_pool.this.sms_configuration[0].external_id == "dystopia-cognito-sms"
    )
    error_message = "The SMS role and its external ID must both be dystopia-cognito-sms."
  }

  assert {
    condition     = aws_cognito_user_pool.this.deletion_protection == "ACTIVE"
    error_message = "The user pool must be protected from deletion."
  }

  assert {
    condition     = aws_s3_bucket.media.bucket == "dystopia-media-337169763788"
    error_message = "The media bucket name must carry the account ID so one name serves any environment."
  }

  assert {
    condition     = one(aws_s3_bucket_cors_configuration.media.cors_rule).allowed_origins == toset(["https://dystopia.city"])
    error_message = "Browser uploads must be allowed from the public domain only."
  }

  assert {
    condition = (
      output.user_pool_id == "ap-northeast-1_test" &&
      output.user_pool_arn == "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test" &&
      output.user_pool_client_id == "testclientid" &&
      output.media_bucket_name == "dystopia-media-337169763788" &&
      output.media_bucket_arn == "arn:aws:s3:::dystopia-media-337169763788"
    )
    error_message = "The identity and media outputs must expose the user pool, its client and the media bucket."
  }
}
