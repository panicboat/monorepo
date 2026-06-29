# terraform.tf - Terraform configuration for monolith RDS module

terraform {
  required_version = "1.12.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.52.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
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
