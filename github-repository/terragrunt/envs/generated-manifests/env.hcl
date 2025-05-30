# repo.hcl - Configuration for panicboat/generated-manifests repository

locals {
  repository_config = {
    name        = "generated-manifests"
    description = "Generated Kubernetes manifests repository"
    visibility  = "private"

    # Repository features
    features = {
      issues   = true
      wiki     = false
      projects = false
    }

    # Branch protection rules
    branch_protection = {
      # Develop branch protection
      develop = {
        required_reviews           = 1
        dismiss_stale_reviews      = true
        require_code_owner_reviews = false
        required_status_checks     = ["ci"]
        enforce_admins             = false
        allow_force_pushes         = false
        allow_deletions            = false
      }

      # Staging branches protection (staging/*)
      staging_branches = {
        pattern                    = "staging/*"
        required_reviews           = 1
        dismiss_stale_reviews      = true
        require_code_owner_reviews = false
        required_status_checks     = ["ci"]
        enforce_admins             = false
        allow_force_pushes         = false
        allow_deletions            = false
      }

      # Production branches protection (production/*)
      production_branches = {
        pattern                    = "production/*"
        required_reviews           = 1
        dismiss_stale_reviews      = true
        require_code_owner_reviews = false
        required_status_checks     = ["ci"]
        enforce_admins             = false
        allow_force_pushes         = false
        allow_deletions            = false
      }
    }
  }
}
