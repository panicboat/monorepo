# terraform.tf - Terraform configuration for GitHub Repository Management

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 5.0"
    }
  }

  extra_arguments "parallelism" {
    commands = ["plan", "apply", "destroy"]
    arguments = ["-parallelism=1"]
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}

# GitHub Provider configuration
provider "github" {
  owner = var.github_org
  token = var.github_token

  request_timeout = 60
  max_retries     = 5
  retry_delay     = 5
}
