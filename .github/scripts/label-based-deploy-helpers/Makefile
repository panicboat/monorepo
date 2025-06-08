# Colors
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m

# Docker image name
IMAGE_NAME := github-scripts

# Fixed volume mounting - mount scripts directory directly
DOCKER_RUN := docker run --rm -it \
	-v $(PWD):/app \
	-v ~/.aws:/root/.aws:ro \
	-e GITHUB_TOKEN=$(GITHUB_TOKEN) \
	-e GITHUB_REPOSITORY=$(GITHUB_REPOSITORY) \
	-w /app

.PHONY: help build shell test lint clean config-validate config-show test-detection test-branch

help: ## Show this help message
	@echo "GitHub Scripts - Development Commands"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(BLUE)%-20s$(NC) %s\n", $$1, $$2}'

build: ## Build Docker image
	@echo "$(YELLOW)Building Docker image...$(NC)"
	docker build -t $(IMAGE_NAME) . -f docker/Dockerfile

shell: build ## Start interactive shell in container
	@echo "$(YELLOW)Starting interactive shell...$(NC)"
	$(DOCKER_RUN) $(IMAGE_NAME)

config-validate: build ## Validate configuration file
	@echo "$(YELLOW)Validating configuration...$(NC)"
	$(DOCKER_RUN) $(IMAGE_NAME) ruby bin/workflow-config validate

config-show: build ## Show parsed configuration
	@echo "$(YELLOW)Showing configuration...$(NC)"
	$(DOCKER_RUN) $(IMAGE_NAME) ruby bin/workflow-config show

test-detection: build ## Test change detection
	@echo "$(YELLOW)Testing change detection...$(NC)"
	$(DOCKER_RUN) $(IMAGE_NAME) ruby bin/label-dispatcher test

test-branch: build ## Test branch deployment
	@echo "$(YELLOW)Testing branch deployment...$(NC)"
	$(DOCKER_RUN) $(IMAGE_NAME) ruby bin/deploy-trigger test_branch develop

# Alternative approach - mount entire monorepo but work in scripts
config-validate-alt: build ## Alternative approach for config validation
	@echo "$(YELLOW)Validating configuration (alternative approach)...$(NC)"
	docker run --rm -it \
		-v $(PWD)/../../..:/monorepo \
		-w /monorepo/.github/scripts \
		-e GITHUB_TOKEN=$(GITHUB_TOKEN) \
		-e GITHUB_REPOSITORY=$(GITHUB_REPOSITORY) \
		$(IMAGE_NAME) ruby bin/workflow-config validate

# Simple tests
test-simple: build ## Simple test to verify container works
	@echo "$(YELLOW)Running simple test...$(NC)"
	$(DOCKER_RUN) $(IMAGE_NAME) bash -c "echo 'Container test:'; ls -la; echo 'Config:'; ls -la config/"

debug-volumes: build ## Debug volume mounting
	@echo "$(YELLOW)Debugging volume mounting...$(NC)"
	@echo "Host scripts dir: $(PWD)"
	@echo "Host monorepo dir: $(PWD)/../../.."
	@echo ""
	@echo "Testing current approach:"
	$(DOCKER_RUN) $(IMAGE_NAME) bash -c "echo 'Container PWD:' \$$(pwd); echo 'Files:'; ls -la | head -5"
	@echo ""
	@echo "Testing alternative approach:"
	docker run --rm -v $(PWD)/../../..:/monorepo -w /monorepo/.github/scripts $(IMAGE_NAME) bash -c "echo 'Container PWD:' \$$(pwd); echo 'Files:'; ls -la | head -5"

# Direct execution (bypass Make variables)
test-direct: build ## Test with direct docker command
	@echo "$(YELLOW)Testing with direct docker command...$(NC)"
	docker run --rm -v $(PWD):/app -w /app $(IMAGE_NAME) ruby bin/workflow-config validate

clean: ## Clean up Docker resources
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker rmi $(IMAGE_NAME) 2>/dev/null || true
