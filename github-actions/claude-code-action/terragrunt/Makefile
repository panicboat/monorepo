# Makefile for Terragrunt operations (Environment Directories)
.PHONY: help init plan apply destroy clean fmt validate outputs

# Default environment
ENV ?= develop

# Colors for output
BLUE = \033[0;34m
GREEN = \033[0;32m
RED = \033[0;31m
YELLOW = \033[0;33m
NC = \033[0m

help: ## Show available commands
	@echo "$(BLUE)Claude Code Action - Terragrunt Operations$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@echo "  make <command> [ENV=<environment>]"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-12s$(NC) %s\n", $1, $2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Available environments:$(NC)"
	@echo "  develop, staging, production"
	@echo ""
	@echo "$(GREEN)Examples:$(NC)"
	@echo "  make plan ENV=develop"
	@echo "  make apply ENV=production"

init: ## Initialize Terragrunt for environment
	@echo "$(BLUE)Initializing $(ENV) environment...$(NC)"
	@if [ ! -d "envs/$(ENV)" ]; then \
		echo "$(RED)Environment $(ENV) not found!$(NC)"; \
		exit 1; \
	fi
	cd envs/$(ENV) && terragrunt init

plan: ## Plan changes for environment
	@echo "$(BLUE)Planning $(ENV) environment...$(NC)"
	@if [ ! -d "envs/$(ENV)" ]; then \
		echo "$(RED)Environment $(ENV) not found!$(NC)"; \
		exit 1; \
	fi
	cd envs/$(ENV) && terragrunt plan

apply: ## Apply changes to environment
	@echo "$(BLUE)Applying changes to $(ENV) environment...$(NC)"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		y|Y|yes|YES) cd envs/$(ENV) && terragrunt apply ;; \
		*) echo "$(YELLOW)Cancelled.$(NC)" ;; \
	esac

destroy: ## Destroy environment resources
	@echo "$(RED)Destroying $(ENV) environment...$(NC)"
	@printf "Type 'yes' to confirm: "; \
	read REPLY; \
	case "$$REPLY" in \
		yes|YES) cd envs/$(ENV) && terragrunt destroy ;; \
		*) echo "$(YELLOW)Cancelled.$(NC)" ;; \
	esac

outputs: ## Show outputs for environment
	@echo "$(BLUE)Outputs for $(ENV) environment:$(NC)"
	cd envs/$(ENV) && terragrunt output

fmt: ## Format all Terragrunt files
	@echo "$(BLUE)Formatting Terragrunt files...$(NC)"
	terragrunt hclfmt

validate: ## Validate environment configuration
	@echo "$(BLUE)Validating $(ENV) environment...$(NC)"
	cd envs/$(ENV) && terragrunt validate-inputs

clean: ## Clean Terragrunt cache
	@echo "$(BLUE)Cleaning Terragrunt cache...$(NC)"
	find . -type d -name ".terragrunt-cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.tfplan" -delete 2>/dev/null || true
	@echo "$(GREEN)Cache cleaned.$(NC)"

# Environment shortcuts
develop: ## Deploy develop environment
	@echo "$(BLUE)Initializing develop environment...$(NC)"
	@cd envs/develop && terragrunt init
	@echo "$(BLUE)Planning develop environment...$(NC)"
	@cd envs/develop && terragrunt plan
	@echo "$(BLUE)Applying changes to develop environment...$(NC)"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		y|Y|yes|YES) cd envs/develop && terragrunt apply ;; \
		*) echo "$(YELLOW)Cancelled.$(NC)" ;; \
	esac

staging: ## Deploy staging environment
	@echo "$(BLUE)Initializing staging environment...$(NC)"
	@cd envs/staging && terragrunt init
	@echo "$(BLUE)Planning staging environment...$(NC)"
	@cd envs/staging && terragrunt plan
	@echo "$(BLUE)Applying changes to staging environment...$(NC)"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		y|Y|yes|YES) cd envs/staging && terragrunt apply ;; \
		*) echo "$(YELLOW)Cancelled.$(NC)" ;; \
	esac

production: ## Deploy production environment (with extra confirmation)
	@echo "$(RED)Production deployment - Extra confirmation required$(NC)"
	@echo "$(BLUE)Initializing production environment...$(NC)"
	@cd envs/production && terragrunt init
	@echo "$(BLUE)Planning production environment...$(NC)"
	@cd envs/production && terragrunt plan
	@echo "$(RED)Proceeding with production apply...$(NC)"
	@printf "Are you sure? [y/N] "; \
	read REPLY; \
	case "$$REPLY" in \
		y|Y|yes|YES) cd envs/production && terragrunt apply ;; \
		*) echo "$(YELLOW)Cancelled.$(NC)" ;; \
	esac

# Utility commands
get-config: ## Get Claude configuration JSON for environment
	@echo "$(BLUE)Claude configuration for $(ENV):$(NC)"
	@cd envs/$(ENV) && \
	printf '{\n  "provider": "bedrock",\n  "region": "%s",\n  "model": "anthropic.claude-3-sonnet-20240229-v1:0",\n  "role_arn": "%s",\n  "log_group": "%s"\n}\n' \
		"$(terragrunt output -raw aws_region)" \
		"$(terragrunt output -raw iam_role_arn)" \
		"$(terragrunt output -raw cloudwatch_log_group_name)"

check-env: ## Check if environment exists
	@if [ -d "envs/$(ENV)" ]; then \
		echo "$(GREEN)Environment $(ENV) exists$(NC)"; \
	else \
		echo "$(RED)Environment $(ENV) not found$(NC)"; \
		exit 1; \
	fi

list-envs: ## List available environments
	@echo "$(BLUE)Available environments:$(NC)"
	@ls -1 envs/ | sed 's/^/  /'
