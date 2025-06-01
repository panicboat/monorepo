# main.tf - GitHub Repository Management

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

# Repository configuration
resource "github_repository" "repository" {
  name        = var.repository_config.name
  description = var.repository_config.description
  visibility  = var.repository_config.visibility

  has_issues   = var.repository_config.features.issues
  has_wiki     = var.repository_config.features.wiki
  has_projects = var.repository_config.features.projects

  # Security settings
  vulnerability_alerts = true

  # Merge settings
  allow_merge_commit     = true
  allow_squash_merge     = true
  allow_rebase_merge     = true
  delete_branch_on_merge = true

  # Archive settings
  archived = false
}

# Branch protection for develop branch
resource "github_branch_protection" "develop" {
  count = contains(keys(var.repository_config.branch_protection), "develop") ? 1 : 0

  repository_id = github_repository.repository.node_id
  pattern       = "develop"

  required_pull_request_reviews {
    required_approving_review_count = var.repository_config.branch_protection.develop.required_reviews
    dismiss_stale_reviews           = var.repository_config.branch_protection.develop.dismiss_stale_reviews
    require_code_owner_reviews      = var.repository_config.branch_protection.develop.require_code_owner_reviews
  }

  required_status_checks {
    strict   = true
    contexts = var.repository_config.branch_protection.develop.required_status_checks
  }

  enforce_admins                  = var.repository_config.branch_protection.develop.enforce_admins
  allows_force_pushes             = var.repository_config.branch_protection.develop.allow_force_pushes
  allows_deletions                = var.repository_config.branch_protection.develop.allow_deletions
  required_linear_history         = var.repository_config.branch_protection.develop.required_linear_history
  require_conversation_resolution = var.repository_config.branch_protection.develop.require_conversation_resolution
  require_signed_commits          = var.repository_config.branch_protection.develop.require_signed_commits
}

# Branch protection for staging/* branches
resource "github_branch_protection" "staging" {
  count = contains(keys(var.repository_config.branch_protection), "staging_branches") ? 1 : 0

  repository_id = github_repository.repository.node_id
  pattern       = var.repository_config.branch_protection.staging_branches.pattern

  required_pull_request_reviews {
    required_approving_review_count = var.repository_config.branch_protection.staging_branches.required_reviews
    dismiss_stale_reviews           = var.repository_config.branch_protection.staging_branches.dismiss_stale_reviews
    require_code_owner_reviews      = var.repository_config.branch_protection.staging_branches.require_code_owner_reviews
  }

  required_status_checks {
    strict   = true
    contexts = var.repository_config.branch_protection.staging_branches.required_status_checks
  }

  enforce_admins                  = var.repository_config.branch_protection.staging_branches.enforce_admins
  allows_force_pushes             = var.repository_config.branch_protection.staging_branches.allow_force_pushes
  allows_deletions                = var.repository_config.branch_protection.staging_branches.allow_deletions
  required_linear_history         = var.repository_config.branch_protection.staging_branches.required_linear_history
  require_conversation_resolution = var.repository_config.branch_protection.staging_branches.require_conversation_resolution
  require_signed_commits          = var.repository_config.branch_protection.staging_branches.require_signed_commits
}

# Branch protection for production/* branches
resource "github_branch_protection" "production" {
  count = contains(keys(var.repository_config.branch_protection), "production_branches") ? 1 : 0

  repository_id = github_repository.repository.node_id
  pattern       = var.repository_config.branch_protection.production_branches.pattern

  required_pull_request_reviews {
    required_approving_review_count = var.repository_config.branch_protection.production_branches.required_reviews
    dismiss_stale_reviews           = var.repository_config.branch_protection.production_branches.dismiss_stale_reviews
    require_code_owner_reviews      = var.repository_config.branch_protection.production_branches.require_code_owner_reviews
  }

  required_status_checks {
    strict   = true
    contexts = var.repository_config.branch_protection.production_branches.required_status_checks
  }

  enforce_admins                  = var.repository_config.branch_protection.production_branches.enforce_admins
  allows_force_pushes             = var.repository_config.branch_protection.production_branches.allow_force_pushes
  allows_deletions                = var.repository_config.branch_protection.production_branches.allow_deletions
  required_linear_history         = var.repository_config.branch_protection.production_branches.required_linear_history
  require_conversation_resolution = var.repository_config.branch_protection.production_branches.require_conversation_resolution
  require_signed_commits          = var.repository_config.branch_protection.production_branches.require_signed_commits
}

# CloudWatch Log Group for GitHub Actions (optional, for audit logging)
resource "aws_cloudwatch_log_group" "github_repository_logs" {
  name              = "/github-repository/${var.repository_config.name}"
  retention_in_days = 30

  tags = merge(var.common_tags, {
    LogGroup = "${var.project_name}-${var.repository_config.name}"
    Purpose  = "github-repository-management"
  })
}
