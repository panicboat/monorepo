# repo.hcl - Configuration for panicboat/monorepo repository

locals {
  repository_config = {
    name        = "monorepo"
    description = "Monorepo for multiple services and infrastructure configurations"
    visibility  = "public"

    # Repository features
    features = {
      issues   = true
      wiki     = false
      projects = true
    }

    # Branch protection rules
    branch_protection = {
      develop = {
        required_reviews                = 2
        dismiss_stale_reviews           = false
        require_code_owner_reviews      = false
        restrict_pushes                 = false
        require_last_push_approval      = false
        required_status_checks          = ["ci"]
        enforce_admins                  = false
        allow_force_pushes              = false
        allow_deletions                 = false
        required_linear_history         = false
        require_conversation_resolution = false
        require_signed_commits          = false
      }

      staging_branches = {
        pattern                         = "staging/*"
        required_reviews                = 1
        dismiss_stale_reviews           = false
        require_code_owner_reviews      = false
        restrict_pushes                 = false
        require_last_push_approval      = false
        required_status_checks          = ["ci"]
        enforce_admins                  = false
        allow_force_pushes              = false
        allow_deletions                 = false
        required_linear_history         = false
        require_conversation_resolution = false
        require_signed_commits          = false
      }

      production_branches = {
        pattern                         = "production/*"
        required_reviews                = 3
        dismiss_stale_reviews           = false
        require_code_owner_reviews      = false
        restrict_pushes                 = false
        require_last_push_approval      = false
        required_status_checks          = ["ci"]
        enforce_admins                  = false
        allow_force_pushes              = false
        allow_deletions                 = false
        required_linear_history         = false
        require_conversation_resolution = false
        require_signed_commits          = false
      }
    }
  }
}
