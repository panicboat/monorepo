# Monorepo

This monorepo contains multiple services and infrastructure configurations for various projects.

## 📁 Repository Structure

```
monorepo/
├── README.md                           # This file
├── .github/                            # GitHub Actions configuration
│   ├── terragrunt-actions-config.yaml  # Terragrunt Actions configuration
│   ├── workflows/                      # GitHub Actions workflows
│   └── scripts/                        # GitHub Actions scripts
├── github-actions/                     # GitHub Actions related services
│   └── claude-code-action/             # Claude Code Action service
└── github-oidc-auth/                   # GitHub OIDC authentication
```

## 🌿 Branch Strategy

This monorepo follows a standardized branch strategy:

```
feature/xxx → develop → staging/service-name → production/service-name
```

- **develop**: Integration and development environment
- **staging/***: Service-specific staging environments
- **production/***: Service-specific production environments

---

# 🛠️ Development Guide

This section provides comprehensive guidance for developers working with this monorepo, covering setup, workflows, and best practices.

## Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Terragrunt >= 0.45.0
- Make (for convenient commands)
- Git with proper SSH/HTTPS access

## Local Development Setup

### Initial Setup
1. Clone the repository
2. Install required tools (see Prerequisites)
3. Configure AWS credentials
4. Verify access to required environments

### Service Development
1. Create feature branch from `develop`
2. Make changes in service-specific directory
3. Test locally using service-specific commands
4. Commit and push changes
5. Create pull request to `develop`

## Deployment Process
1. **Development**: Test changes in develop environment
2. **Integration**: Deploy to staging for integration testing
3. **Production**: Deploy to production with manual approval

## Adding New Services
1. Create service directory: `<service-name>/terragrunt/`
2. Copy structure from existing service
3. Update `project_name` in `root.hcl`
4. Modify module resources as needed
5. Add appropriate CODEOWNERS entries
6. Update this README with service documentation

## Best Practices
- Test changes in develop environment first
- Use descriptive commit messages
- Follow naming conventions for resources
- Maintain consistent patterns across services

## 🤝 Contributing

### Code Standards
- Follow established coding conventions for each language
- Ensure all tests pass before submitting pull requests
- Include appropriate documentation for new features
- Use meaningful commit messages following conventional commit format

### Review Process
- All changes require pull request review
- Test changes thoroughly in develop environment
- Ensure CI/CD pipelines pass successfully
- Update documentation as needed

### Quality Guidelines
- Maintain consistent patterns across services
- Follow security best practices
- Optimize for maintainability and readability
- Consider impact on other services in the monorepo

---

# 🔐 Security & Compliance

This section outlines the comprehensive security measures and compliance requirements across all services and infrastructure in this monorepo.

## Authentication & Authorization

### GitHub Actions Authentication
- **OIDC Integration**: Secure GitHub Actions authentication without long-term keys
- **Branch-based Access**: Environment access controlled by branch patterns
- **Least Privilege**: IAM policies grant only necessary permissions

### AWS Access Control
- **Role-based Access**: Environment-specific IAM roles
- **Temporary Credentials**: No long-term AWS keys in CI/CD
- **Audit Trail**: All infrastructure changes tracked

## Infrastructure Security

### Encryption & Storage
- **State Encryption**: All Terraform state files encrypted at rest
- **S3 Security**: Public access blocked on all S3 resources
- **State Locking**: DynamoDB table prevents concurrent modifications

### Network Security
- **VPC Isolation**: Service-specific network boundaries
- **Security Groups**: Principle of least privilege for network access
- **TLS Encryption**: All data in transit encrypted

## CI/CD Security

### Pipeline Security
- **Dependency Scanning**: npm audit, go mod verify
- **Container Scanning**: Trivy security analysis
- **Code Quality**: Linting and formatting enforcement
- **Secret Management**: GitHub secrets for sensitive data

### Access Control
- **Branch Protection**: Environment-specific deployment controls
- **Required Reviews**: Code review requirements
- **Status Checks**: Automated security validation

## Monitoring & Compliance

### Observability
- **CloudWatch Integration**: Centralized logging for all services
- **Audit Trail**: All infrastructure and deployment changes tracked
- **Environment Tagging**: Consistent resource tagging for cost allocation

### Compliance Requirements
- **Data Protection**: Encryption at rest and in transit
- **Access Logging**: Comprehensive audit trails
- **Regular Updates**: Automated dependency and security updates

---

# 🤖 Dependency Management

This section outlines the automated dependency management strategy using Renovate, ensuring secure and efficient updates across all services in the monorepo.

## Renovate Configuration

### Automated Merge Strategy
Renovate is configured with intelligent auto-merge rules to balance security, stability, and development velocity:

- **Auto-merge enabled** for most dependency updates
- **Manual review required** for production environments and major updates
- **Scheduled execution** on Tuesday and Wednesday mornings (before 9 AM JST)
- **Minimum release age** of 1 day for stability validation

### Environment-Based Rules

#### 🚫 Production Environments - Manual Review Only
- **Scope**: All files in `**/production/**` paths
- **Policy**: Auto-merge disabled, manual review required
- **Labels**: `⚠️ production`, `manual-review`
- **Rationale**: Production stability takes precedence over automation

#### 📈 Major Updates - Manual Review Only
- **Scope**: All major version updates (e.g., 1.x.x → 2.x.x)
- **Policy**: Auto-merge disabled, manual review required
- **Labels**: `📈 major-update`, `manual-review`
- **Rationale**: Breaking changes require careful evaluation

#### ✅ Standard Updates - Auto-merge
- **Scope**: Minor and patch updates in non-production environments
- **Policy**: Auto-merge enabled with PR-based merging
- **Labels**: `🤖 auto-merge`
- **Grouping**: Dependencies grouped by package directory

### Security & Quality Assurance

#### Review Process
- **Code Owners**: Automatic assignment of reviewers from CODEOWNERS
- **Platform Integration**: GitHub's native auto-merge for seamless integration
- **Stability Window**: 1-day minimum release age before auto-merge eligibility

#### Monitoring & Oversight
- **Scheduled Execution**: Limited to specific time windows to avoid disruption
- **Timezone Awareness**: Configured for Asia/Tokyo timezone
- **Grouped Updates**: Related dependencies updated together for consistency

## Best Practices

### For Developers
- **Monitor auto-merge PRs**: Review automated updates even when auto-merged
- **Test thoroughly**: Ensure CI/CD pipelines validate all dependency changes
- **Production awareness**: Understand that production updates require manual approval

### For Maintainers
- **Regular review**: Periodically review Renovate configuration effectiveness
- **Security updates**: Prioritize security-related dependency updates
- **Breaking changes**: Carefully evaluate major version updates before approval

### Troubleshooting

#### Common Issues
```bash
# Check Renovate configuration
renovate-config-validator .github/renovate.json

# Review recent Renovate activity
gh pr list --label "🤖 auto-merge" --state all

# Check for stuck auto-merge PRs
gh pr list --label "manual-review" --state open
```

#### Emergency Procedures
- **Disable auto-merge**: Temporarily disable by setting `"automerge": false` in renovate.json
- **Force manual review**: Add `manual-review` label to any PR requiring immediate attention
- **Rollback dependencies**: Use standard git revert procedures for problematic updates

> **Note**: For comprehensive security guidelines related to dependency management, see the [Security & Compliance](#-security--compliance) section.

---

# 🏗️ Terragrunt Infrastructure

This section documents the shared Terragrunt infrastructure patterns and common configurations for AWS deployment across multiple services.

## Architecture Overview

This repository follows a monorepo pattern with service-specific infrastructure managed through Terragrunt. Each service maintains its own Terraform modules and environment configurations while sharing common patterns and state management.

### Key Principles
- **Service Isolation**: Each service has its own infrastructure path
- **Shared State Management**: Common S3 backend for all services
- **Environment Consistency**: Standardized environment structure (develop/staging/production)
- **Security First**: OIDC authentication and least privilege access

## 🗂️ Shared Infrastructure Patterns

### State Management
All services use a shared S3 backend pattern:

```
S3 Bucket: terragrunt-state-<aws_account_id>
├── github-oidc-auth/
│   └── develop/terraform.tfstate
└── other-services/
    └── ...
```

### Environment Structure
Each service follows a consistent environment structure:

```
service/terragrunt/
├── root.hcl            # Shared Terragrunt configuration
├── Makefile            # Development and deployment commands
├── modules/            # Terraform module definition
└── envs/               # Environment-specific configurations
    ├── develop/
    ├── staging/
    └── production/
```

## Infrastructure-Specific Configuration

### Terragrunt Configuration
- **Root Configuration**: Shared settings in `root.hcl`
- **Environment Variables**: Environment-specific settings in `env.hcl`
- **Module Organization**: Consistent module structure across services

### State Management Best Practices
- **Naming Conventions**: Consistent state file naming
- **Lock Management**: Proper handling of state locks
- **Backup Strategy**: Regular state file backups

> **Note**: For comprehensive security guidelines, see the [Security & Compliance](#-security--compliance) section.
> For development workflows, see the [Development Guide](#️-development-guide) section.

## 🚨 Common Infrastructure Issues

### State Lock Conflicts
```bash
# Check for stuck locks
aws dynamodb scan --table-name terragrunt-state-locks

# Force unlock if necessary (use with caution)
cd envs/<environment>
terragrunt force-unlock <lock-id>
```

### Terragrunt Configuration Issues
```bash
# Enable verbose logging
export TG_LOG=debug

# Validate configuration
make validate ENV=<environment>

# Check dependency graph
terragrunt graph-dependencies
```

### AWS Credentials Issues
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check assumed role
aws sts get-caller-identity --query 'Arn'
```

> **Advanced Troubleshooting**: For complex issues spanning multiple services, see the [Comprehensive Troubleshooting Guide](#comprehensive-troubleshooting-guide) in the Resources & Support section.

---

# 🚀 CI/CD Pipeline

This section documents the automated CI/CD pipeline architecture for building, testing, and deploying services in this monorepo.

## Architecture Overview

The CI/CD system uses a **hybrid approach** combining path-based triggers with reusable workflows to achieve optimal cost efficiency and maintainability.

### Key Principles
- **Cost Optimization**: Path-based triggers ensure only relevant services run
- **DRY Principle**: Reusable workflows eliminate code duplication
- **Language Agnostic**: Support for Node.js, Go, and extensible to other languages
- **Security First**: Integrated security scanning and testing
- **Parallel Execution**: Optimized for speed with intelligent dependencies

## 🗂️ Workflow Structure

```
.github/workflows/
├── reusable-{language}-ci.yaml      # Language-specific CI/CD
├── reusable-docker-build.yaml       # Container building & scanning
├── reusable-terragrunt-*.yaml       # Infrastructure management
└── {service-name}-ci.yaml           # Service integration workflows
```

### Workflow Categories

- **Language CI**: Reusable workflows for specific programming languages
- **Infrastructure**: Terragrunt-based infrastructure management
- **Container**: Docker building, testing, and security scanning
- **Integration**: Service-specific workflows that orchestrate the above
- **Utilities**: Helper workflows for change detection and coordination

## 🔄 Execution Flow

### Pull Request Workflow
```
PR Created/Updated
       ↓
┌─────────────┬────────────────┐
│ Application │ Infrastructure │
│ CI/CD       │ Plan           │
│ (parallel)  │ (parallel)     │
└─────────────┴────────────────┘
       ↓
   PR Comments with Results
```

### Deployment Workflow
```
Push to Branch
       ↓
 Application CI/CD
       ↓
┌─────────────┬────────────────┐
│ Docker      │ Infrastructure │
│ Build       │ Apply          │
│ (sequential)│ (sequential)   │
└─────────────┴────────────────┘
       ↓
 Deployment Summary
```

## Service Integration

### CI/CD Workflow Configuration
Each service requires a dedicated CI/CD workflow file following the naming pattern `{service-name}-ci.yaml`.

> **Note**: For complete service setup instructions, see [Adding New Services](#adding-new-services) in the Development Guide.

### Workflow Template
```yaml
# .github/workflows/service-name-ci.yaml
name: 'Service Name - CI/CD'

on:
  pull_request:
    branches: [develop, staging/service-name, production/service-name]
    paths: ['service-name/**', '.github/workflows/service-name-*.yaml']
  push:
    branches: [develop, staging/service-name, production/service-name]
    paths: ['service-name/**']

env:
  SERVICE_NAME: service-name
  SERVICE_PATH: service-name

jobs:
  test-and-build:
    uses: ./.github/workflows/reusable-go-ci.yaml  # or reusable-nodejs-ci.yaml
    with:
      service_path: ${{ env.SERVICE_PATH }}
      go_version: '1.21'  # or node_version: '20'

  docker-build:
    needs: test-and-build
    if: github.event_name == 'push'
    uses: ./.github/workflows/reusable-docker-build.yaml
    with:
      service_path: ${{ env.SERVICE_PATH }}
      image_name: ${{ env.SERVICE_NAME }}

  terragrunt-plan:
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/reusable-terragrunt-plan.yaml
    with:
      project_name: ${{ env.SERVICE_NAME }}

  terragrunt-apply:
    needs: test-and-build
    if: github.event_name == 'push'
    uses: ./.github/workflows/reusable-terragrunt-apply.yaml
    with:
      project_name: ${{ env.SERVICE_NAME }}
```

## 🎯 Cost Optimization Features

### Path-Based Triggers
- **Selective Execution**: Only run CI/CD for changed services
- **Resource Efficiency**: Avoid unnecessary compute usage
- **Faster Feedback**: Reduced queue times

### Intelligent Dependencies
- **Parallel Testing**: Application and infrastructure validation
- **Sequential Deployment**: Safe deployment order
- **Conditional Execution**: Skip unnecessary steps

### Artifact Management
- **Short Retention**: Build artifacts (1 day)
- **Extended Retention**: Coverage reports (7 days)
- **Compression**: Docker images saved as compressed archives

## 🔒 Security & Quality

> **Note**: For comprehensive security guidelines, see the [Security & Compliance](#-security--compliance) section.

### Pipeline-Specific Security
- **Automated Scanning**: Integrated dependency and container security scanning
- **Quality Gates**: Automated code quality and test coverage enforcement
- **Secure Deployment**: OIDC-based authentication and least privilege access

## 📊 Monitoring & Observability

### Deployment Tracking
- **GitHub Summaries**: Automated deployment reports
- **PR Comments**: Infrastructure plan visibility
- **Artifact Preservation**: Build and test outputs

### Performance Metrics
- **Build Times**: Language-specific optimization
- **Test Coverage**: Quality metrics tracking
- **Resource Usage**: Cost monitoring

## 🚨 Common Pipeline Issues

### Workflow Not Triggering
```bash
# Check path patterns in workflow file
# Ensure files are in correct service directory
# Verify branch naming convention

# Example: Check if paths match your changes
git diff --name-only HEAD~1 HEAD
```

### Reusable Workflow Errors
```bash
# Check input parameter names and types
# Verify workflow file syntax
# Ensure proper permissions are set

# Validate workflow syntax locally
yq eval '.jobs' .github/workflows/service-name-ci.yaml
```

### Permission Issues
```bash
# Verify GitHub token permissions
gh auth status

# Check OIDC configuration
# Ensure IAM role ARNs are correct in terragrunt-actions-config.yaml
```

### Debug Commands
```bash
# Test workflow locally (if using act)
act pull_request -W .github/workflows/service-name-ci.yaml

# Check reusable workflow inputs
gh workflow view service-name-ci.yaml
```

> **Advanced Troubleshooting**: For complex pipeline issues and cross-service problems, see the [Comprehensive Troubleshooting Guide](#comprehensive-troubleshooting-guide) in the Resources & Support section.

## 📚 Best Practices

### Workflow Design
- **Keep service workflows simple**: Use reusable workflows for complex logic
- **Minimize dependencies**: Only add necessary job dependencies
- **Use descriptive names**: Clear job and step naming
- **Handle failures gracefully**: Appropriate error handling and reporting

### Performance
- **Cache dependencies**: Leverage GitHub Actions caching
- **Parallel execution**: Run independent jobs concurrently
- **Conditional steps**: Skip unnecessary operations
- **Artifact optimization**: Minimize artifact size and retention

### Security
- **Minimal permissions**: Grant only required access
- **Secret management**: Use GitHub secrets appropriately
- **Dependency updates**: Regular security updates
- **Scan everything**: Code, dependencies, and containers

---

# 📚 Resources & Support

This section provides comprehensive resources, documentation links, and support information for working with this monorepo.

## Documentation

### Infrastructure
- [Terragrunt Documentation](https://terragrunt.gruntwork.io/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)

### CI/CD & Security
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)

### Development Tools
- [Git Documentation](https://git-scm.com/doc)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## Comprehensive Troubleshooting Guide

> **Quick Reference**: For common issues specific to each area, see:
> - [Infrastructure Issues](#-common-infrastructure-issues) in the Terragrunt Infrastructure section
> - [Pipeline Issues](#-common-pipeline-issues) in the CI/CD Pipeline section

This section covers complex, cross-service issues and advanced troubleshooting techniques.

### Cross-Service Issues

#### Multi-Service Deployment Failures
```bash
# Check dependencies between services
terragrunt graph-dependencies --terragrunt-working-dir envs/<environment>

# Identify failed services
gh run list --workflow="*-ci.yaml" --status=failure

# Check for resource conflicts
aws resourcegroupstaggingapi get-resources --tag-filters Key=Environment,Values=<environment>
```

#### State Corruption Across Services
```bash
# Backup current state
aws s3 sync s3://terragrunt-state-<account-id> ./state-backup/

# Check state integrity
terragrunt state list --terragrunt-working-dir envs/<environment>

# Restore from backup if needed
terragrunt import <resource_type>.<resource_name> <resource_id>
```

### Advanced Debugging

#### Environment-Wide Issues
```bash
# Check all services health
for service in github-actions github-oidc-auth github-repository; do
  echo "Checking $service..."
  cd $service/terragrunt/envs/<environment>
  terragrunt plan --terragrunt-non-interactive
  cd -
done

# Verify OIDC configuration across all workflows
grep -r "permissions:" .github/workflows/
```

#### Performance Troubleshooting
```bash
# Analyze workflow execution times
gh run list --limit 50 --json conclusion,createdAt,updatedAt,workflowName

# Check for resource bottlenecks
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name NumberOfObjects \
  --dimensions Name=BucketName,Value=terragrunt-state-<account-id>
```

### Emergency Procedures

#### Complete Environment Recovery
```bash
# 1. Stop all running workflows
gh workflow disable --all

# 2. Clear all state locks
aws dynamodb scan --table-name terragrunt-state-locks \
  --query 'Items[].LockID.S' --output text | \
  xargs -I {} terragrunt force-unlock {}

# 3. Validate all configurations
find . -name "terragrunt.hcl" -exec terragrunt validate --terragrunt-working-dir {} \;

# 4. Re-enable workflows
gh workflow enable --all
```

#### Rollback Procedures
```bash
# Rollback to previous working state
git log --oneline -10  # Find last working commit
git checkout <commit-hash>

# Force apply previous configuration
terragrunt apply --terragrunt-non-interactive --auto-approve
```

### Monitoring and Prevention

#### Health Checks
```bash
# Daily health check script
#!/bin/bash
echo "=== Monorepo Health Check ==="

# Check AWS connectivity
aws sts get-caller-identity || echo "AWS auth failed"

# Check state locks
LOCKS=$(aws dynamodb scan --table-name terragrunt-state-locks --query 'Count')
echo "Active state locks: $LOCKS"

# Check recent workflow failures
FAILURES=$(gh run list --status=failure --created="$(date -d '24 hours ago' --iso-8601)" --json conclusion | jq length)
echo "Recent workflow failures: $FAILURES"
```

## Getting Help

### Internal Support
- **Infrastructure Issues**: Contact @panicboat
- **CI/CD Pipeline Issues**: Contact @panicboat
- **General Questions**: Create an issue in this repository

### External Resources
- [Terragrunt Community](https://github.com/gruntwork-io/terragrunt/discussions)
- [GitHub Actions Community](https://github.community/c/github-actions/9)
- [AWS Support](https://aws.amazon.com/support/)

---

## Maintenance Information

**Terragrunt Infrastructure Maintained by**: @panicboat
**CI/CD Pipeline Maintained by**: @panicboat
**Last Updated**: 2025-06-01
**Terraform Version**: >= 1.0
**Terragrunt Version**: >= 0.45.0
**GitHub Actions**: Reusable Workflows v1.0
