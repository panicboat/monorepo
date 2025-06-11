# Claude Code Action Terragrunt Configuration

This Terragrunt configuration creates the necessary AWS resources for using `anthropics/claude-code-action@beta` with Amazon Bedrock.

## Overview

This module creates:

- **IAM Role**: For GitHub Actions to assume with OIDC authentication
- **IAM Policies**: For accessing Amazon Bedrock Claude models and CloudWatch Logs
- **CloudWatch Log Group**: For storing Claude Code Action logs
- **SSM Parameters**: For storing configuration values accessible by GitHub Actions
- **OIDC Provider**: (Optional) GitHub OIDC identity provider

## Architecture

```
GitHub Actions (claude-code-action)
    ↓ (OIDC Authentication)
AWS IAM Role
    ↓ (Permissions)
Amazon Bedrock Claude Models
    ↓ (Logging)
CloudWatch Logs
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terragrunt** installed (`brew install terragrunt` or [download](https://terragrunt.gruntwork.io/docs/getting-started/install/))
3. **Terraform** installed (`brew install terraform` or [download](https://www.terraform.io/downloads))
4. **AWS CLI** configured with appropriate credentials
5. **GitHub OIDC Provider** (can be created by this module or use existing one)

## Quick Start

1. **Clone and navigate to the directory:**
   ```bash
   cd .github/actions/claude-code-action/terragrunt
   ```

2. **Review and update configuration:**
   ```bash
   # Edit environment-specific settings
   vim envs/monorepo/env.hcl
   ```

3. **Initialize and apply:**
   ```bash
   make dev-apply ENV=monorepo
   ```

## Configuration

### Environment Configuration

Edit `envs/monorepo/env.hcl` to customize:

```hcl
locals {
  # GitHub configuration
  github_repo = "monorepo"
  github_branches = ["main", "develop", "feature/*"]
  github_environments = ["production", "staging", "development"]

  # AWS configuration
  aws_region = "ap-northeast-1"
  claude_model_region = "us-west-2"  # Claude models region

  # OIDC Provider (update with your actual ARN)
  oidc_provider_arn = "arn:aws:iam::ACCOUNT-ID:oidc-provider/token.actions.githubusercontent.com"

  # Bedrock models to allow access to
  bedrock_models = [
    "anthropic.claude-sonnet-4-20250514-v1:0"
  ]
}
```

### Key Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `github_repo` | GitHub repository name | `"monorepo"` |
| `github_branches` | Allowed branches | `["main", "develop"]` |
| `aws_region` | Primary AWS region | `"ap-northeast-1"` |
| `claude_model_region` | Bedrock Claude region | `"us-west-2"` |
| `create_oidc_provider` | Create new OIDC provider | `false` |
| `max_session_duration` | IAM role session duration | `7200` (2 hours) |
| `log_retention_days` | CloudWatch log retention | `14` days |

## Usage

### Development Commands

```bash
# Show available commands
make help

# Setup development environment
make dev-setup

# Plan changes
make plan ENV=monorepo

# Apply changes
make apply ENV=monorepo

# Show outputs
make output ENV=monorepo

# Destroy resources (careful!)
make destroy ENV=monorepo
```

### CI/CD Commands

```bash
# Validate configuration
make ci-validate ENV=monorepo

# Plan with detailed exit code
make ci-plan ENV=monorepo

# Apply automatically
make ci-apply ENV=monorepo
```

## GitHub Actions Integration

After deploying this infrastructure, you can use the Claude Code Action in your GitHub workflows:

```yaml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-review:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.CLAUDE_CODE_ACTION_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Claude Code Action
        uses: anthropics/claude-code-action@beta
        with:
          model: claude-sonnet-4-20250514
          provider: bedrock
          region: us-west-2
```

### Required GitHub Secrets

Add these secrets to your GitHub repository:

| Secret | Description | Example |
|--------|-------------|---------|
| `CLAUDE_CODE_ACTION_ROLE_ARN` | IAM Role ARN | `arn:aws:iam::123456789012:role/claude-code-action-monorepo-claude-code-action-role` |

You can get the role ARN from Terragrunt outputs:
```bash
make output ENV=monorepo
```

## Outputs

This module provides several outputs for integration:

```bash
# View all outputs
make output ENV=monorepo
```

Key outputs:
- `iam_role_arn`: IAM role ARN for GitHub Actions
- `cloudwatch_log_group_name`: Log group for monitoring
- `github_actions_configuration`: Complete configuration object
- `bedrock_models`: List of allowed Claude models

## Security Considerations

1. **Least Privilege**: The IAM role only has permissions for Bedrock Claude models and CloudWatch Logs
2. **OIDC Authentication**: Uses GitHub OIDC for secure, keyless authentication
3. **Branch/Environment Restrictions**: Can limit access to specific branches or environments
4. **Audit Logging**: All Bedrock API calls are logged to CloudWatch

## Troubleshooting

### Common Issues

1. **OIDC Provider Not Found**
   ```bash
   # Check if OIDC provider exists
   aws iam list-open-id-connect-providers

   # Update oidc_provider_arn in env.hcl or set create_oidc_provider = true
   ```

2. **Bedrock Access Denied**
   ```bash
   # Ensure Bedrock models are enabled in your AWS account
   aws bedrock list-foundation-models --region us-west-2
   ```

3. **GitHub Actions Permission Denied**
   ```bash
   # Verify the role ARN in GitHub secrets
   # Check the trust policy allows your repository
   ```

### Debug Commands

```bash
# Validate configuration
make validate ENV=monorepo

# Check Terraform formatting
make fmt

# Show current state
make show ENV=monorepo

# List resources
make state-list ENV=monorepo
```

## File Structure

```
.github/actions/claude-code-action/terragrunt/
├── README.md                           # This file
├── Makefile                           # Development commands
├── root.hcl                          # Root Terragrunt configuration
├── modules/                          # Terraform modules
│   ├── main.tf                      # Main resources
│   ├── variables.tf                 # Input variables
│   ├── outputs.tf                   # Output values
│   └── terraform.tf                 # Provider configuration
└── envs/                            # Environment configurations
    └── monorepo/                    # Monorepo environment
        ├── env.hcl                  # Environment variables
        └── terragrunt.hcl           # Terragrunt configuration
```

## Contributing

1. Make changes to the appropriate files
2. Run `make check` to validate and format
3. Test with `make plan ENV=monorepo`
4. Submit a pull request

## Support

For issues related to:
- **This Terragrunt configuration**: Open an issue in this repository
- **Claude Code Action**: Check the [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) repository
- **Amazon Bedrock**: Consult the [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/)

## License

This configuration is provided as-is for use with the Claude Code Action.
