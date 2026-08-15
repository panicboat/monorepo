# terraform.tf - Terraform configuration for holmes-relay secrets module

terraform {
  required_version = "1.12.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.57.1"
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
