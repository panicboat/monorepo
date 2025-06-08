#!/bin/bash

set -e

# Initialize Ruby environment
echo "🚀 Initializing GitHub Scripts environment..."

# Bundle install (quiet mode for cleaner output)
if [ -f "Gemfile" ]; then
    echo "📦 Installing Ruby dependencies..."
    bundle install --quiet --jobs=$(nproc)
fi

# Environment check
echo "📋 Environment Check:"
echo "  - Ruby: $(ruby --version)"
echo "  - Terraform: $(terraform --version | head -1)"
echo "  - Terragrunt: $(terragrunt --version)"
echo "  - AWS CLI: $(aws --version)"
echo "  - jq: $(jq --version)"
echo "  - yq: $(yq --version)"

# Git configuration (for GitHub Actions)
if [ -n "$GITHUB_ACTIONS" ]; then
    echo "🔧 Configuring Git for GitHub Actions..."
    git config --global --add safe.directory /github/workspace
    git config --global --add safe.directory /app

    git config --global user.name "github-actions[bot]"
    git config --global user.email "github-actions[bot]@users.noreply.github.com"
fi

# Configuration file check
CONFIG_FILE="auto-label-mappings.yaml"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Configuration file found: $CONFIG_FILE"
else
    echo "⚠️  Configuration file not found: $CONFIG_FILE"
fi

# Execute command
if [ $# -gt 0 ]; then
    echo "🏃 Executing: $*"
    exec "$@"
else
    echo "💻 Starting interactive shell..."
    echo "Available commands:"
    echo "  ruby bin/label-dispatcher test"
    echo "  ruby bin/deploy-trigger test_branch develop"
    echo "  ruby bin/workflow-config validate"
    echo ""
    exec bash
fi
