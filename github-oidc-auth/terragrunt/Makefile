# Makefile for GitHub OIDC Auth Terragrunt

.PHONY: help plan-dev apply-dev plan-staging apply-staging plan-prod apply-prod destroy-dev destroy-staging destroy-prod clean

# Default target
help:
	@echo "GitHub OIDC Auth Terragrunt Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  plan-dev      - Plan develop environment"
	@echo "  apply-dev     - Apply develop environment"
	@echo "  plan-staging  - Plan staging environment"
	@echo "  apply-staging - Apply staging environment"
	@echo "  plan-prod     - Plan production environment"
	@echo "  apply-prod    - Apply production environment"
	@echo "  destroy-dev   - Destroy develop environment"
	@echo "  destroy-staging - Destroy staging environment"
	@echo "  destroy-prod  - Destroy production environment"
	@echo "  clean         - Clean Terragrunt cache"
	@echo "  help          - Show this help message"

# Develop environment
plan-dev:
	@echo "Planning develop environment..."
	cd envs/develop && terragrunt plan

apply-dev:
	@echo "Applying develop environment..."
	cd envs/develop && terragrunt apply

destroy-dev:
	@echo "Destroying develop environment..."
	cd envs/develop && terragrunt destroy

# Staging environment
plan-staging:
	@echo "Planning staging environment..."
	cd envs/staging && terragrunt plan

apply-staging:
	@echo "Applying staging environment..."
	cd envs/staging && terragrunt apply

destroy-staging:
	@echo "Destroying staging environment..."
	cd envs/staging && terragrunt destroy

# Production environment
plan-prod:
	@echo "Planning production environment..."
	cd envs/production && terragrunt plan

apply-prod:
	@echo "Applying production environment..."
	cd envs/production && terragrunt apply

destroy-prod:
	@echo "Destroying production environment..."
	cd envs/production && terragrunt destroy

# Utility targets
clean:
	@echo "Cleaning Terragrunt cache..."
	find . -type d -name ".terragrunt-cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.tfstate*" -delete 2>/dev/null || true
	find . -name ".terraform.lock.hcl" -delete 2>/dev/null || true

# Validate all environments
validate:
	@echo "Validating all environments..."
	cd envs/develop && terragrunt validate
	cd envs/staging && terragrunt validate
	cd envs/production && terragrunt validate

# Format all HCL files
fmt:
	@echo "Formatting HCL files..."
	terragrunt hclfmt

# Show outputs for all environments
outputs:
	@echo "Develop outputs:"
	cd envs/develop && terragrunt output 2>/dev/null || echo "No outputs available"
	@echo ""
	@echo "Staging outputs:"
	cd envs/staging && terragrunt output 2>/dev/null || echo "No outputs available"
	@echo ""
	@echo "Production outputs:"
	cd envs/production && terragrunt output 2>/dev/null || echo "No outputs available"
