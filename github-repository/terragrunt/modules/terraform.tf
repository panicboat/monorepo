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
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}
