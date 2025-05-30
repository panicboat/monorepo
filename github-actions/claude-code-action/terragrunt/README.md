# Claude Code Action - AWS Bedrock Infrastructure

This directory contains the Terragrunt configuration for deploying AWS Bedrock infrastructure to support Claude Code Action in a monorepo environment.

## 🏗️ Architecture Overview

### Purpose
This infrastructure provisions AWS resources necessary for Claude Code Action to interact with AWS Bedrock Claude models. It creates IAM roles, policies, S3 storage, and CloudWatch logging resources across multiple environments.

### Key Components
- **IAM Role**: Allows Claude Code Action to assume a role and access Bedrock
- **Bedrock Policies**: Grants permissions to invoke Claude models
- **S3 Bucket**: Storage for configurations, logs, and artifacts
- **CloudWatch Logs**: Centralized logging for Claude Code Action
- **State Management**: Shared S3 backend for Terraform state across the monorepo

## 📁 Directory Structure

```
github-actions/claude-code-action/terragrunt/
├── root.hcl                      # Root Terragrunt configuration (shared settings)
├── Makefile                      # Development and deployment commands
├── modules/                      # Terraform module definition
└── envs/                         # Environment-specific configurations
    ├── development/              # Development environment
    │   ├── env.hcl              # Development-specific variables
    │   └── terragrunt.hcl       # Development Terragrunt config
    ├── staging/                  # Staging environment
    │   ├── env.hcl              # Staging-specific variables
    │   └── terragrunt.hcl       # Staging Terragrunt config
    └── production/               # Production environment
        ├── env.hcl              # Production-specific variables
        └── terragrunt.hcl       # Production Terragrunt config
```

## 🎯 Design Principles

### Monorepo Integration
- **Shared State**: All services use `terragrunt-state-<aws_account_id>` S3 bucket
- **Service Isolation**: Each service has its own path in the state bucket
- **Code Ownership**: Clear ownership via `.github/CODEOWNERS` file
- **Consistent Patterns**: Reusable structure for other services

### Environment Management
- **Directory-based**: Each environment has its own directory (no temporary files)
- **DRY Configuration**: Common settings in `root.hcl`, environment-specific in `env.hcl`
- **Progressive Complexity**: Development uses minimal resources, production uses full capabilities
- **Clear Separation**: Environment-specific variables and configurations

### Security & Compliance
- **Least Privilege**: IAM policies grant only necessary permissions
- **Encryption**: S3 buckets and state files encrypted at rest
- **Access Control**: Public access blocked on all S3 resources
- **Audit Trail**: CloudWatch logging for all actions

## 🚀 Quick Start

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Terragrunt >= 0.45.0
- Make (for convenient commands)

### Installation
```bash
# Navigate to the terragrunt directory
cd github-actions/claude-code-action/terragrunt

# Check available commands
make help

# Deploy development environment
make development

# Or step by step
make init ENV=development
make plan ENV=development
make apply ENV=development
```

## 🛠️ Available Commands

### Environment Operations
```bash
make init ENV=<env>        # Initialize Terragrunt for environment
make plan ENV=<env>        # Plan infrastructure changes
make apply ENV=<env>       # Apply infrastructure changes
make outputs ENV=<env>     # Show infrastructure outputs
make destroy ENV=<env>     # Destroy infrastructure (use with caution)
```

### Utility Commands
```bash
make fmt                   # Format all Terragrunt/Terraform files
make validate ENV=<env>    # Validate configuration
make clean                 # Clean Terragrunt cache
make get-config ENV=<env>  # Get Claude configuration JSON
make list-envs             # List available environments
make check-env ENV=<env>   # Check if environment exists
```

### Environment Shortcuts
```bash
make development          # Full development deployment
make staging             # Full staging deployment
make production          # Full production deployment (with extra confirmation)
```

## 🌍 Environment Configuration

### Development Environment
- **Purpose**: Development and testing
- **Claude Models**: Haiku, Sonnet (cost-effective)
- **Log Retention**: 7 days
- **Tags**: `AutoShutdown=enabled`, `CostCenter=development`

### Staging Environment
- **Purpose**: Integration testing and QA
- **Claude Models**: Haiku, Sonnet, Claude 3.5 Sonnet
- **Log Retention**: 7 days
- **Tags**: `Environment=pre-production`, `CostCenter=staging`

### Production Environment
- **Purpose**: Live production workloads
- **Claude Models**: All available models (Haiku, Sonnet, Claude 3.5, Opus)
- **Log Retention**: 30 days
- **Tags**: `MonitoringTier=critical`, `Compliance=required`, `SLA=99.9%`

## 🗂️ State Management

### Shared S3 Backend
All Terragrunt configurations use a shared S3 bucket for state management:

```
S3 Bucket: terragrunt-state-<aws_account_id>
├── claude-code-action/
│   ├── development/terraform.tfstate
│   ├── staging/terraform.tfstate
│   └── production/terraform.tfstate
├── other-service-a/
│   └── production/terraform.tfstate
└── shared-infrastructure/
    └── production/terraform.tfstate
```

### State Locking
- **DynamoDB Table**: `terragrunt-state-locks` (shared across all services)
- **Encryption**: All state files encrypted at rest
- **Versioning**: S3 bucket versioning enabled for state history

## 🔧 Configuration Management

### Adding New Environments
1. Create new directory: `envs/<new-environment>/`
2. Add `env.hcl` with environment-specific configuration
3. Add `terragrunt.hcl` following existing pattern
4. Update GitHub Actions workflow if needed

### Modifying Claude Models
Edit the `claude_models` list in the appropriate `env.hcl` file:

```hcl
# envs/development/env.hcl
locals {
  claude_models = [
    "anthropic.claude-3-haiku-20240307-v1:0",
    "anthropic.claude-3-sonnet-20240229-v1:0"
  ]
}
```

### Adding IAM Policies
Add policy ARNs to `additional_iam_policies` in `env.hcl`:

```hcl
# envs/production/env.hcl
locals {
  additional_iam_policies = [
    "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
  ]
}
```

## 🔐 Security Considerations

### IAM Permissions
- Claude Code Action role can assume Bedrock service role
- Permissions limited to specific Claude models
- CloudWatch Logs access for centralized logging
- Additional policies can be attached per environment

### Network Security
- S3 buckets block all public access
- Resources deployed in default VPC (consider VPC customization for production)
- Encryption in transit and at rest

### Access Control
- State files protected by S3 bucket policies
- DynamoDB state locking prevents concurrent modifications
- IAM policies follow least privilege principle

## 📊 Monitoring & Logging

### CloudWatch Integration
- **Log Groups**: `/aws/claude-code-action/<project>-<environment>`
- **Retention**: 7 days (dev/staging), 30 days (production)
- **Structured Logging**: JSON format recommended for Claude Code Action

### Metrics & Alerting
Consider adding:
- Bedrock API usage metrics
- Error rate monitoring
- Cost allocation tags for billing

## 🚨 Troubleshooting

### Common Issues

**State Lock Conflicts**
```bash
# Check for stuck locks
aws dynamodb scan --table-name terragrunt-state-locks

# Force unlock if necessary (use with caution)
cd envs/<environment>
terragrunt force-unlock <lock-id>
```

**Permission Errors**
- Verify AWS credentials have necessary permissions
- Check IAM role trust relationships
- Ensure Bedrock model access is enabled in AWS console

**Module Not Found**
```bash
# Clean and reinitialize
make clean
make init ENV=<environment>
```

### Debugging
```bash
# Enable verbose logging
export TG_LOG=debug
make plan ENV=development

# Validate configuration
make validate ENV=development

# Check Terraform plan
cd envs/development
terragrunt plan -detailed-exitcode
```

## 🤝 Contributing

### Code Reviews
- All changes require PR review
- Infrastructure changes automatically trigger planning
- Production deployments require manual approval

### Best Practices
- Test changes in development first
- Use descriptive commit messages
- Update documentation for configuration changes
- Follow naming conventions for resources

### Adding New Services
When adding similar services to the monorepo:
1. Copy this structure to `github-actions/<service-name>/terragrunt/`
2. Update `project_name` in `root.hcl`
3. Modify module resources as needed
4. Add appropriate CODEOWNERS entries

## 📚 Additional Resources

- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Claude API Documentation](https://docs.anthropic.com/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## 🆘 Support

For issues with this infrastructure:
1. Check this README for common solutions
2. Review GitHub Actions logs for deployment failures
3. Check AWS CloudWatch logs for runtime issues
4. Contact @panicboat for Claude-specific questions
5. Contact @panicboat for infrastructure questions

---

**Maintained by**: @panicboat
**Last Updated**: $(date +'%Y-%m-%d')
**Terraform Version**: >= 1.0
**Terragrunt Version**: >= 0.45.0
