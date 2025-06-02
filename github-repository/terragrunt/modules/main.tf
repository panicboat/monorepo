# main.tf - GitHub Repository Management

# Get current AWS Account ID (used for CloudWatch logging)
data "aws_caller_identity" "current" {}

# GitHub repository basic configuration
resource "github_repository" "repository" {
  name        = var.repository_config.name        # Repository name
  description = var.repository_config.description # Repository description
  visibility  = var.repository_config.visibility  # public/private/internal

  # Feature toggles
  has_issues   = var.repository_config.features.issues   # Enable Issues feature
  has_wiki     = var.repository_config.features.wiki     # Enable Wiki feature
  has_projects = var.repository_config.features.projects # Enable Projects feature

  # Security settings
  vulnerability_alerts = true # Enable vulnerability alerts (recommended)

  # Merge method settings
  allow_merge_commit     = true # Allow regular merge commits
  allow_squash_merge     = true # Allow squash merge (combine multiple commits into one)
  allow_rebase_merge     = true # Allow rebase merge (maintain linear history)
  delete_branch_on_merge = true # Auto-delete branches after merge (cleaner repo management)

  # Archive settings
  archived = false # Keep repository active (not read-only)
}

# Branch protection for develop branch
# Ensures security and code quality for development branch
resource "github_branch_protection" "develop" {
  count = contains(keys(var.repository_config.branch_protection), "develop") ? 1 : 0

  repository_id = github_repository.repository.node_id
  pattern       = "develop" # Protected branch name

  # Pull request review requirements
  required_pull_request_reviews {
    required_approving_review_count = var.repository_config.branch_protection.develop.required_reviews           # Number of required approvals
    dismiss_stale_reviews           = var.repository_config.branch_protection.develop.dismiss_stale_reviews      # Dismiss reviews when code changes
    require_code_owner_reviews      = var.repository_config.branch_protection.develop.require_code_owner_reviews # Require CODEOWNERS file owner review
    require_last_push_approval      = var.repository_config.branch_protection.develop.require_last_push_approval # Require re-approval after last push
  }

  # Status check requirements (CI/CD results)
  required_status_checks {
    strict   = false                                                                  # Branch must be up-to-date before merge
    contexts = var.repository_config.branch_protection.develop.required_status_checks # Required CI checks (tests, lint, etc.)
  }

  # Push restrictions (who can push to this branch)
  push_restrictions = var.repository_config.branch_protection.develop.restrict_pushes ? [] : null # Empty list restricts to admins/write access only

  # Admin privileges and branch operation restrictions
  enforce_admins                  = var.repository_config.branch_protection.develop.enforce_admins                  # Admins must follow protection rules
  allows_force_pushes             = var.repository_config.branch_protection.develop.allow_force_pushes              # Allow force pushes (usually false recommended)
  allows_deletions                = var.repository_config.branch_protection.develop.allow_deletions                 # Allow branch deletion (usually false recommended)
  required_linear_history         = var.repository_config.branch_protection.develop.required_linear_history         # Enforce linear history (no merge commits)
  require_conversation_resolution = var.repository_config.branch_protection.develop.require_conversation_resolution # Require PR conversation resolution
  require_signed_commits          = var.repository_config.branch_protection.develop.require_signed_commits          # Require signed commits
}

# Branch protection for staging/* branches
# Protection for staging environment branches (less strict than develop)
resource "github_branch_protection" "staging" {
  count = contains(keys(var.repository_config.branch_protection), "staging_branches") ? 1 : 0

  repository_id = github_repository.repository.node_id
  pattern       = var.repository_config.branch_protection.staging_branches.pattern # Pattern match like staging/*

  # Pull request review requirements (less strict than develop)
  required_pull_request_reviews {
    required_approving_review_count = var.repository_config.branch_protection.staging_branches.required_reviews           # Number of required approvals (usually 1-2)
    dismiss_stale_reviews           = var.repository_config.branch_protection.staging_branches.dismiss_stale_reviews      # Dismiss reviews when code changes
    require_code_owner_reviews      = var.repository_config.branch_protection.staging_branches.require_code_owner_reviews # Require CODEOWNERS file owner review
    require_last_push_approval      = var.repository_config.branch_protection.staging_branches.require_last_push_approval # Require re-approval after last push
  }

  # Status check requirements (basic tests only)
  required_status_checks {
    strict   = true                                                                            # Branch must be up-to-date before merge
    contexts = var.repository_config.branch_protection.staging_branches.required_status_checks # Required CI checks (basic tests only)
  }

  # Push restrictions (who can push to this branch)
  push_restrictions = var.repository_config.branch_protection.staging_branches.restrict_pushes ? [] : null # Empty list restricts to admins/write access only

  # Admin privileges and branch operation restrictions (less strict than develop)
  enforce_admins                  = var.repository_config.branch_protection.staging_branches.enforce_admins                  # Admins must follow protection rules
  allows_force_pushes             = var.repository_config.branch_protection.staging_branches.allow_force_pushes              # Allow force pushes
  allows_deletions                = var.repository_config.branch_protection.staging_branches.allow_deletions                 # Allow branch deletion
  required_linear_history         = var.repository_config.branch_protection.staging_branches.required_linear_history         # Enforce linear history
  require_conversation_resolution = var.repository_config.branch_protection.staging_branches.require_conversation_resolution # Require PR conversation resolution
  require_signed_commits          = var.repository_config.branch_protection.staging_branches.require_signed_commits          # Require signed commits
}

# Branch protection for production/* branches
# Strict protection for production environment branches (most restrictive settings)
resource "github_branch_protection" "production" {
  count = contains(keys(var.repository_config.branch_protection), "production_branches") ? 1 : 0

  repository_id = github_repository.repository.node_id
  pattern       = var.repository_config.branch_protection.production_branches.pattern # Pattern match like production/*

  # Pull request review requirements (most strict settings)
  required_pull_request_reviews {
    required_approving_review_count = var.repository_config.branch_protection.production_branches.required_reviews           # Number of required approvals (usually 3+)
    dismiss_stale_reviews           = var.repository_config.branch_protection.production_branches.dismiss_stale_reviews      # Dismiss reviews when code changes (required)
    require_code_owner_reviews      = var.repository_config.branch_protection.production_branches.require_code_owner_reviews # Require CODEOWNERS file owner review (required)
    require_last_push_approval      = var.repository_config.branch_protection.production_branches.require_last_push_approval # Require re-approval after last push (required)
  }

  # Status check requirements (all quality checks required)
  required_status_checks {
    strict   = true                                                                               # Branch must be up-to-date before merge (required)
    contexts = var.repository_config.branch_protection.production_branches.required_status_checks # All CI checks (tests, lint, security scan, etc.)
  }

  # Push restrictions (who can push to this branch)
  push_restrictions = var.repository_config.branch_protection.production_branches.restrict_pushes ? [] : null # Empty list restricts to admins/write access only

  # Admin privileges and branch operation restrictions (most strict)
  enforce_admins                  = var.repository_config.branch_protection.production_branches.enforce_admins                  # Admins must follow protection rules (required)
  allows_force_pushes             = var.repository_config.branch_protection.production_branches.allow_force_pushes              # Allow force pushes (usually false)
  allows_deletions                = var.repository_config.branch_protection.production_branches.allow_deletions                 # Allow branch deletion (usually false)
  required_linear_history         = var.repository_config.branch_protection.production_branches.required_linear_history         # Enforce linear history (recommended)
  require_conversation_resolution = var.repository_config.branch_protection.production_branches.require_conversation_resolution # Require PR conversation resolution (required)
  require_signed_commits          = var.repository_config.branch_protection.production_branches.require_signed_commits          # Require signed commits (recommended)
}

# CloudWatch Log Group for GitHub Actions (audit logging)
# Records GitHub Actions and repository event logs for monitoring and compliance
resource "aws_cloudwatch_log_group" "github_repository_logs" {
  name              = "/github-repository/${var.repository_config.name}" # Log group name (created per repository)
  retention_in_days = var.log_retention_days                             # Log retention period (for cost optimization)

  # Resource tagging (for resource management and cost tracking)
  tags = merge(var.common_tags, {
    LogGroup = "${var.project_name}-${var.repository_config.name}" # Log group identification tag
    Purpose  = "github-repository-management"                      # Purpose clarification
  })
}
