# Dystopia Infrastructure Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate `dystopia/monolith/infrastructure/` and `dystopia/frontend/infrastructure/` into a single `dystopia/infrastructure/aws/` Terragrunt stack, delete the empty Stripe stub, and make sure CI keeps working for the newly-discovered `infrastructure` pseudo-service without touching `panicboat/deploy-actions`.

**Architecture:** One Terraform module (Cognito User Pool + BFF client + SMS role + RDS + Secrets Manager container + Pod Identity) under `dystopia/infrastructure/aws/modules/`, one Terragrunt stack (`dystopia/infrastructure/aws/production/`) with no cross-directory `dependency` block. `workflow-config.yaml` needs only a one-line directory change. The `container` stack's false-positive match against the new `dystopia/infrastructure` directory (it has no Dockerfile) is absorbed by a Dockerfile-existence gate added to monorepo's own `reusable--container-builder.yaml` — not by deploy-actions or a `workflow-config.yaml` override.

**Tech Stack:** Terraform (via OpenTofu, invoked through Terragrunt v1.0.2), GitHub Actions (reusable workflows), Ruby (`panicboat/deploy-actions` `action-scripts`, used read-only here to verify `workflow-config.yaml` parses as expected).

**Spec:** `docs/superpowers/specs/2026-09-06-dystopia-infrastructure-consolidation-design.md`

## Global Constraints

- No production `terragrunt apply` / AWS mutation in this plan — this is a pure file-layout change. Neither the old nor the new stack has been applied yet (VERIFIED: no `dystopia/*` key exists in the `terragrunt-state-337169763788` S3 bucket), so there is nothing to migrate and nothing live to break.
- `system-components/pennyworth` is untouched by every task in this plan.
- Every commit uses `git commit -s` (signoff). Never add a `Co-Authored-By` trailer (repo convention, see `AGENTS.md`).
- All work happens in the existing worktree at `.claude/worktrees/refactor-dystopia-infrastructure-consolidation` on branch `refactor/dystopia-infrastructure-consolidation`. Do not create a new worktree or branch.

---

### Task 1: Create the consolidated `dystopia/infrastructure/aws` Terragrunt stack

**Files:**
- Create: `dystopia/infrastructure/aws/modules/terraform.tf`
- Create: `dystopia/infrastructure/aws/modules/variables.tf`
- Create: `dystopia/infrastructure/aws/modules/user_pool.tf`
- Create: `dystopia/infrastructure/aws/modules/sms_role.tf`
- Create: `dystopia/infrastructure/aws/modules/main.tf`
- Create: `dystopia/infrastructure/aws/modules/pod_identity.tf`
- Create: `dystopia/infrastructure/aws/modules/outputs.tf`
- Create: `dystopia/infrastructure/aws/root.hcl`
- Create: `dystopia/infrastructure/aws/production/env.hcl`
- Create: `dystopia/infrastructure/aws/production/terragrunt.hcl`

**Interfaces:**
- Produces: Terraform module inputs `project_name`, `environment`, `aws_region`, `common_tags`, `user_pool_name`, `db_identifier`, `db_subnet_group_name`, `db_security_group_name` (no `cognito_user_pool_arn` — Task 2 in the spec's "Terraform Changes" removed it, the module computes it internally as `aws_cognito_user_pool.this.arn`). Outputs: `user_pool_id`, `user_pool_arn`, `client_id`, `issuer`, `jwks_uri`, `rds_endpoint`, `rds_port`, `secret_arn`, `secret_name`.
- Consumes: nothing from other tasks (this is the first task).

Both `dystopia/monolith/infrastructure/aws/modules/main.tf` and `dystopia/frontend/infrastructure/aws/modules/sms_role.tf` each declare `data "aws_caller_identity" "current" {}`, and neither file actually references `data.aws_caller_identity.current` anywhere (dead code in both originals). Merging both files unmodified into one module would produce a "duplicate data source" error, so this block is dropped entirely from the consolidated module — it doesn't need to be replaced.

- [ ] **Step 1: Create the provider/version file**

`dystopia/infrastructure/aws/modules/terraform.tf`:

```hcl
# terraform.tf - Terraform configuration for dystopia's shared AWS infrastructure module

terraform {
  required_version = "1.12.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.60.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}
```

- [ ] **Step 2: Create the variables file**

`dystopia/infrastructure/aws/modules/variables.tf`:

```hcl
variable "project_name" {
  type        = string
  description = "Project name (= services)"
}

variable "environment" {
  type        = string
  description = "Environment name (= develop / staging / production)"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
  default     = {}
}

variable "user_pool_name" {
  type        = string
  description = "Cognito User Pool name"
}

variable "db_identifier" {
  type        = string
  description = "RDS DB instance identifier (= 環境別に {env}/terragrunt.hcl で指定)"
}

variable "db_subnet_group_name" {
  type        = string
  description = "RDS DB subnet group name (= 環境別に {env}/terragrunt.hcl で指定)"
}

variable "db_security_group_name" {
  type        = string
  description = "RDS DB security group name (= 環境別に {env}/terragrunt.hcl で指定)"
}
```

- [ ] **Step 3: Create the Cognito User Pool file (unchanged copy of frontend's)**

`dystopia/infrastructure/aws/modules/user_pool.tf`:

```hcl
resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name

  alias_attributes = ["phone_number"]

  auto_verified_attributes = ["phone_number"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "phone_number"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  mfa_configuration = "OFF"

  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  sms_configuration {
    external_id    = "${var.user_pool_name}-cognito-sms"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
    sns_region     = var.aws_region
  }

  # Guard against terraform destroy wiping the pool by accident.
  deletion_protection = "ACTIVE"

  tags = var.common_tags
}

resource "aws_cognito_user_pool_client" "bff" {
  name         = "${var.user_pool_name}-bff"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}
```

- [ ] **Step 4: Create the Cognito SMS role file (frontend's original minus the unused `data "aws_caller_identity"` block)**

`dystopia/infrastructure/aws/modules/sms_role.tf`:

```hcl
resource "aws_iam_role" "cognito_sms" {
  name = "${var.user_pool_name}-cognito-sms"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cognito-idp.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "sts:ExternalId" = "${var.user_pool_name}-cognito-sms"
        }
      }
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy" "cognito_sms" {
  name = "${var.user_pool_name}-cognito-sms"
  role = aws_iam_role.cognito_sms.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sns:Publish"]
      Resource = "*"
    }]
  })
}
```

- [ ] **Step 5: Create the RDS/Secrets Manager file (monolith's original, `cognito_user_pool_arn` reference internalized)**

`dystopia/infrastructure/aws/modules/main.tf`:

```hcl
# =============================================================================
# AWS RDS PostgreSQL for monolith service
# =============================================================================
# db.t4g.micro Single-AZ、 eks-production VPC private subnets で deploy、
# monolith Pod のみから 5432 access 許可。 master credentials は AWS Secrets
# Manager で管理、 ESO 経由で K8s Secret に注入。
# =============================================================================

data "aws_vpc" "eks_production" {
  tags = {
    Name = "vpc-production"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.eks_production.id]
  }
  tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

data "aws_subnet" "private_details" {
  for_each = toset(data.aws_subnets.private.ids)
  id       = each.value
}

resource "random_password" "monolith_db_master" {
  length           = 32
  special          = true
  override_special = "!*-_.~"
}

# =============================================================================
# AWS Secrets Manager secret container (= empty)
# =============================================================================
# secret value (= username / password / host / port / database / url JSON) は
# terragrunt scope 外で manual provision (= AWS CLI / Console、 ESO で K8s Secret
# monolith-database に inject)。 plan role の secretsmanager:GetSecretValue 権限不要
# 設計、 secret rotation も terragrunt 外で manage (= Lambda / Secrets Manager
# Automatic Rotation 等)。
#
# Initial secret value provision (= apply 後の manual operation):
# 1. aws secretsmanager put-secret-value \
#      --secret-id dystopia/monolith/database \
#      --secret-string '{"username":"postgres","password":"<rds-master-pw>","host":"<rds-endpoint>","port":5432,"database":"monolith","url":"postgres://..."}'
# 2. ESO ExternalSecret monolith-database が AWS から sync、 K8s Secret に inject。
# =============================================================================
resource "aws_secretsmanager_secret" "monolith_database" {
  name                    = "dystopia/monolith/database"
  description             = "PostgreSQL credentials for monolith service"
  recovery_window_in_days = 0
  tags                    = var.common_tags
}

resource "aws_security_group" "monolith_db" {
  name        = var.db_security_group_name
  # FALLBACK: description は AWS SG の immutable field、 var.db_security_group_name
  # 参照に変更すると terraform が forces replacement と判定して SG 再作成 → DB 一時
  # downtime のため、 module 内で唯一 var.environment 直接参照を残す。
  description = "Security group for monolith RDS database (= ${var.environment})"
  vpc_id      = data.aws_vpc.eks_production.id
  tags        = var.common_tags
}

resource "aws_security_group_rule" "monolith_db_ingress" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = [for s in data.aws_subnet.private_details : s.cidr_block]
  security_group_id = aws_security_group.monolith_db.id
  description       = "PostgreSQL access from private subnets (= monolith Pod via VPC CNI)"
}

resource "aws_db_subnet_group" "monolith" {
  name       = var.db_subnet_group_name
  subnet_ids = data.aws_subnets.private.ids
  tags       = var.common_tags
}

resource "aws_db_instance" "monolith" {
  identifier     = var.db_identifier
  engine         = "postgres"
  engine_version = "17.4"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "monolith"
  username = "postgres"
  password = random_password.monolith_db_master.result

  db_subnet_group_name   = aws_db_subnet_group.monolith.name
  vpc_security_group_ids = [aws_security_group.monolith_db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7
  backup_window           = "16:00-17:00"
  maintenance_window      = "sun:17:00-sun:18:00"

  skip_final_snapshot = true
  deletion_protection = false

  tags = var.common_tags
}

resource "aws_iam_policy" "monolith_cognito_admin_delete" {
  name = "monolith-${var.environment}-cognito-admin-delete"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cognito-idp:AdminDeleteUser"]
      Resource = aws_cognito_user_pool.this.arn
    }]
  })

  tags = var.common_tags
}
```

- [ ] **Step 6: Create the Pod Identity file (unchanged copy of monolith's original)**

`dystopia/infrastructure/aws/modules/pod_identity.tf`:

```hcl
# =============================================================================
# EKS Pod Identity for the monolith pod
# =============================================================================
# Binds the Kubernetes ServiceAccount `dystopia:monolith` to an IAM role so the
# pod can call AWS APIs without static credentials. Uses the Pod Identity
# mechanism (`pods.eks.amazonaws.com`) rather than IRSA (OIDC federation)
# because the cluster runs the `eks-pod-identity-agent` addon and the pattern
# elsewhere in the platform repo (`eks-secrets`, `eks-traces`, ...) is Pod
# Identity.
#
# Currently attached policies:
# - `monolith_cognito_admin_delete` — Cognito hard-delete for the purge cron.
#
# Additional AWS permissions (S3 for media uploads, etc.) should attach to
# `aws_iam_role.monolith` here, not to a new role.
# =============================================================================

data "aws_eks_cluster" "this" {
  name = "eks-${var.environment}"
}

resource "aws_iam_role" "monolith" {
  name = "monolith-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "pods.eks.amazonaws.com"
      }
      Action = ["sts:AssumeRole", "sts:TagSession"]
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "monolith_cognito_admin_delete" {
  role       = aws_iam_role.monolith.name
  policy_arn = aws_iam_policy.monolith_cognito_admin_delete.arn
}

resource "aws_eks_pod_identity_association" "monolith" {
  cluster_name    = data.aws_eks_cluster.this.name
  namespace       = "dystopia"
  service_account = "monolith"
  role_arn        = aws_iam_role.monolith.arn

  tags = var.common_tags
}
```

- [ ] **Step 7: Create the merged outputs file**

`dystopia/infrastructure/aws/modules/outputs.tf`:

```hcl
output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.bff.id
}

output "issuer" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "jwks_uri" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.this.id}/.well-known/jwks.json"
}

output "rds_endpoint" {
  value       = aws_db_instance.monolith.address
  description = "RDS instance endpoint hostname"
}

output "rds_port" {
  value       = aws_db_instance.monolith.port
  description = "RDS instance port"
}

output "secret_arn" {
  value       = aws_secretsmanager_secret.monolith_database.arn
  description = "AWS Secrets Manager secret ARN for RDS credentials"
}

output "secret_name" {
  value       = aws_secretsmanager_secret.monolith_database.name
  description = "AWS Secrets Manager secret name (= ESO ExternalSecret で参照)"
}
```

- [ ] **Step 8: Create the Terragrunt root config**

`dystopia/infrastructure/aws/root.hcl`:

```hcl
# root.hcl - Root Terragrunt configuration for dystopia's shared AWS infrastructure

locals {
  # Project metadata
  project_name = "dystopia"

  # Parse environment from the directory path
  # The environment is the last path segment (e.g. .../production)
  path_parts  = split("/", path_relative_to_include())
  environment = element(local.path_parts, length(local.path_parts) - 1)

  # Common tags applied to all resources
  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terragrunt"
    Repository  = "monorepo"
    Component   = "infrastructure"
    Team        = "panicboat"
  }
}

# Remote state configuration using shared S3 bucket
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    # Shared bucket for all monorepo services
    bucket = "terragrunt-state-${get_aws_account_id()}"

    # dystopia/infrastructure/<environment>/terraform.tfstate
    key    = "dystopia/infrastructure/${local.environment}/terraform.tfstate"
    region = "ap-northeast-1"

    # Shared DynamoDB table for state locking across all services
    dynamodb_table = "terragrunt-state-locks"

    # Enable server-side encryption
    encrypt = true
  }
}

# Common inputs passed to all Terraform modules
inputs = {
  project_name = local.project_name
  environment  = local.environment
  common_tags  = local.common_tags
  aws_region   = "ap-northeast-1"
}
```

- [ ] **Step 9: Create the production environment config**

`dystopia/infrastructure/aws/production/env.hcl`:

```hcl
# env.hcl - Production environment configuration
locals {
  # Environment metadata
  environment = "production"
  aws_region  = "ap-northeast-1"
  # Production-specific resource tags
  additional_tags = {
    CostCenter   = "production"
    Owner        = "panicboat"
    Purpose      = "dystopia"
    AutoShutdown = "enabled"
  }
}
```

- [ ] **Step 10: Create the production stack config (no `dependency` block, no `cognito_user_pool_arn` input)**

`dystopia/infrastructure/aws/production/terragrunt.hcl`:

```hcl
include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

include "env" {
  path   = "env.hcl"
  expose = true
}

terraform {
  source = "../modules"
}

inputs = {
  aws_region              = include.env.locals.aws_region
  user_pool_name          = "dystopia-production"
  db_identifier           = "monolith-production"
  db_subnet_group_name    = "monolith-production"
  db_security_group_name  = "monolith-database-production"
  common_tags = merge(
    include.root.locals.common_tags,
    include.env.locals.additional_tags
  )
}
```

- [ ] **Step 11: Validate the stack**

Run:
```bash
cd dystopia/infrastructure/aws/production
terragrunt run -- init -backend=false
terragrunt run -- validate
```
Expected: both commands succeed; `validate` prints `Success! The configuration is valid.`

- [ ] **Step 12: Clean up validation artifacts and commit**

```bash
cd dystopia/infrastructure/aws/production
rm -rf .terragrunt-cache .terraform.lock.hcl
cd -
git add dystopia/infrastructure
git status --short   # confirm no .terragrunt-cache / .terraform.lock.hcl staged
git commit -s -m "$(cat <<'EOF'
feat(dystopia/infrastructure): add consolidated aws stack

frontend and monolith each owned a Terragrunt stack for what is really
one product's shared auth infrastructure (Cognito) plus monolith's own
RDS, forcing a cross-directory dependency block for the Cognito output.
Neither stack has been applied yet, so fold both into one stack now
before there's any state to migrate.
EOF
)"
```

---

### Task 2: Delete the old per-service infrastructure directories

**Files:**
- Delete: `dystopia/monolith/infrastructure/` (aws, stripe — everything under it)
- Delete: `dystopia/frontend/infrastructure/` (everything under it)

**Interfaces:**
- Consumes: nothing (independent of Task 1's file contents, only needs Task 1's directories to already exist so the repo never has zero copies of this infra on disk between commits).
- Produces: nothing new; this is a pure deletion.

- [ ] **Step 1: Delete the old directories**

```bash
git rm -r dystopia/monolith/infrastructure
git rm -r dystopia/frontend/infrastructure
```

- [ ] **Step 2: Verify nothing else on disk still references the old paths**

```bash
grep -rn "infrastructure/aws\|infrastructure/stripe\|dependency \"cognito\"" dystopia/ system-components/ 2>/dev/null
```
Expected: no output (system-components' own `infrastructure/aws/{environment}` convention string lives only in `workflow-config.yaml`, not under `dystopia/` or `system-components/`, so this should already be empty — if `system-components/pennyworth/infrastructure/...` paths appear, that's expected and fine, they're unrelated to this refactor. Only flag matches under `dystopia/`.)

- [ ] **Step 3: Commit**

```bash
git commit -s -m "$(cat <<'EOF'
refactor(dystopia): remove per-service infrastructure stacks

Superseded by dystopia/infrastructure/aws (previous commit). The
Stripe stack is dropped rather than moved: it has zero resources
today, so there's nothing to carry forward — recreate the scaffold
when real Stripe integration is needed.
EOF
)"
```

---

### Task 3: Update `workflow-config.yaml`

**Files:**
- Modify: `workflow-config.yaml`

**Interfaces:**
- Consumes: nothing from Tasks 1-2 directly, but must be consistent with the new `dystopia/infrastructure/aws/production` path created in Task 1.
- Produces: the `terragrunt` stack (`id: aws`) directory pattern `dystopia/{service}/aws/{environment}`, consumed by CI once this PR merges.

- [ ] **Step 1: Edit the `dystopia/{service}` convention**

In `workflow-config.yaml`, replace:

```yaml
  - root: dystopia/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        id: aws
        directory: infrastructure/aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: terragrunt
        id: stripe
        directory: infrastructure/stripe/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
```

with:

```yaml
  - root: dystopia/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        id: aws
        directory: aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
```

Leave the `system-components/{service}` convention block below it untouched.

- [ ] **Step 2: Verify the config still parses and the new pattern resolves**

```bash
ruby -e '
require "yaml"
require "/Users/takanokenichi/GitHub/panicboat/deploy-actions/action-scripts/shared/entities/workflow_config"
config = Entities::WorkflowConfig.new(YAML.load_file("workflow-config.yaml"))
puts config.stack_conventions_for("monolith", "aws").inspect
puts config.stack_conventions_for("monolith", "stripe").inspect
puts config.stack_conventions_for("infrastructure", "aws").inspect
'
```

Expected output (three lines):
```
["dystopia/{service}/aws/{environment}"]
[]
["dystopia/{service}/aws/{environment}"]
```

The first and third lines being identical is correct — `stack_conventions_for` returns the *pattern*, not the expanded path; substituting `{service}` with `monolith` or `infrastructure` respectively gives the two different real directories `dystopia/monolith/aws/production` (doesn't exist → no target generated at deploy time) and `dystopia/infrastructure/aws/production` (exists → target generated). The second line being `[]` confirms the `stripe` id no longer exists anywhere in the config.

- [ ] **Step 3: Commit**

```bash
git add workflow-config.yaml
git commit -s -m "$(cat <<'EOF'
chore(workflow-config): point terragrunt aws stack at dystopia/infrastructure

Matches the previous commit's directory move. The stripe id entry is
removed along with it since that stack no longer exists.
EOF
)"
```

---

### Task 4: Skip the container build when there's no Dockerfile

**Files:**
- Modify: `.github/workflows/reusable--container-builder.yaml`

**Interfaces:**
- Consumes: `inputs.working-directory` (already an existing input to this reusable workflow).
- Produces: a `steps.dockerfile.outputs.exists` step output, gating the four steps that assume a Dockerfile is present.

Once Task 3 lands, `dystopia/infrastructure` matches the `dystopia/{service}` convention's `container` stack (`directory: .`) for the discovered pseudo-service `infrastructure`, because that directory now exists. There is no `Dockerfile` there, so the existing `deploy-container` job would otherwise fail trying to build one. This fix lives entirely in monorepo's own reusable workflow — deciding whether a directory is container-buildable isn't `panicboat/deploy-actions`' job.

- [ ] **Step 1: Add the Dockerfile-existence check and gate the build steps**

In `.github/workflows/reusable--container-builder.yaml`, replace:

```yaml
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          # Use GITHUB_TOKEN to ensure permission to create new packages
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Log in to the Container registry
        uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        uses: docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0
        with:
          images: ghcr.io/${{ github.repository }}/${{ inputs.image-name }}
          tags: |
            type=sha
            type=ref,event=pr
            type=raw,value=latest,enable={{is_default_branch}}
            type=raw,value=${{ github.actor }}
            type=semver,pattern={{raw}},value=${{ inputs.semver-tag }},enable=${{ inputs.semver-tag != '' }}

      - name: Build and push Docker image
        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
        with:
          platforms: linux/arm64
          context: ${{ inputs.working-directory }}
          file: ${{ inputs.working-directory }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

with:

```yaml
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          # Use GITHUB_TOKEN to ensure permission to create new packages
          token: ${{ secrets.GITHUB_TOKEN }}

      # label-resolver matches this stack on directory existence alone, so a
      # discovered pseudo-service with no Dockerfile (e.g. dystopia/infrastructure)
      # still reaches this job. Skip the build instead of failing on a missing file.
      - name: Check for Dockerfile
        id: dockerfile
        run: |
          if [ -f "${{ inputs.working-directory }}/Dockerfile" ]; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Log in to the Container registry
        if: steps.dockerfile.outputs.exists == 'true'
        uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        if: steps.dockerfile.outputs.exists == 'true'
        uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        if: steps.dockerfile.outputs.exists == 'true'
        uses: docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0
        with:
          images: ghcr.io/${{ github.repository }}/${{ inputs.image-name }}
          tags: |
            type=sha
            type=ref,event=pr
            type=raw,value=latest,enable={{is_default_branch}}
            type=raw,value=${{ github.actor }}
            type=semver,pattern={{raw}},value=${{ inputs.semver-tag }},enable=${{ inputs.semver-tag != '' }}

      - name: Build and push Docker image
        if: steps.dockerfile.outputs.exists == 'true'
        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
        with:
          platforms: linux/arm64
          context: ${{ inputs.working-directory }}
          file: ${{ inputs.working-directory }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Lint the workflow file**

```bash
actionlint .github/workflows/reusable--container-builder.yaml
```
Expected: no output, exit code 0 (matches the pre-edit baseline).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/reusable--container-builder.yaml
git commit -s -m "$(cat <<'EOF'
fix(ci): skip container build when working-directory has no Dockerfile

label-resolver matches the container stack on directory existence
alone. dystopia/infrastructure (added two commits back) has no
Dockerfile, so without this gate the job would fail trying to build
one instead of simply having nothing to do.
EOF
)"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `README-ja.md`
- Modify: `dystopia/monolith/README.md`
- Modify: `dystopia/monolith/README-ja.md`

**Interfaces:** None — documentation only, no code interfaces.

- [ ] **Step 1: Update the top-level `README.md`**

Replace:
```markdown
  - `terragrunt` → runs `terragrunt plan/apply` under `dystopia/{service}/infrastructure/{aws,stripe}/{environment}` or `system-components/{service}/infrastructure/aws/{environment}`. `dystopia/monolith` carries two instances (`id: aws` and `id: stripe`); other services carry a single AWS instance.
```
with:
```markdown
  - `terragrunt` → runs `terragrunt plan/apply` under `dystopia/{service}/aws/{environment}` or `system-components/{service}/infrastructure/aws/{environment}`. `dystopia/infrastructure` is a shared stack for frontend/monolith's AWS resources (Cognito, RDS) — not a real deployable service.
```

- [ ] **Step 2: Update the top-level `README-ja.md`**

Replace:
```markdown
  - `terragrunt` → `dystopia/{service}/infrastructure/{aws,stripe}/{environment}` または `system-components/{service}/infrastructure/aws/{environment}` で `terragrunt plan/apply` を実行する。`dystopia/monolith` は 2 つのインスタンス（`id: aws` と `id: stripe`）を持ち、それ以外のサービスは AWS の単一インスタンスを持つ。
```
with:
```markdown
  - `terragrunt` → `dystopia/{service}/aws/{environment}` または `system-components/{service}/infrastructure/aws/{environment}` で `terragrunt plan/apply` を実行する。`dystopia/infrastructure` は frontend/monolith 共有の AWS リソース（Cognito、RDS）を持つ stack であり、実際にデプロイされるサービスではない。
```

- [ ] **Step 3: Update `dystopia/monolith/README.md`**

Replace:
```markdown
## Infrastructure

Terragrunt stacks live under `infrastructure/`:

- `infrastructure/aws/production/` — RDS, Cognito Pod Identity, IAM policies (depends on `dystopia/frontend/infrastructure/aws/production` for the Cognito user pool ARN).
- `infrastructure/stripe/production/` — empty scaffold; Stripe Terraform provider and resources land in a follow-up PR.
```
with:
```markdown
## Infrastructure

monolith has no Terragrunt stack of its own. Its AWS resources (RDS, Cognito Pod
Identity, IAM policies) live in `dystopia/infrastructure/aws/production/`, shared
with `dystopia/frontend` (Cognito).
```

- [ ] **Step 4: Update `dystopia/monolith/README-ja.md`**

Replace:
```markdown
## Infrastructure

Terragrunt stack は `infrastructure/` 配下にあります。

- `infrastructure/aws/production/` — RDS、Cognito Pod Identity、IAM ポリシー（Cognito user pool ARN は `dystopia/frontend/infrastructure/aws/production` に依存）。
- `infrastructure/stripe/production/` — 空の scaffold。Stripe Terraform provider とリソースは後続の PR で追加します。
```
with:
```markdown
## Infrastructure

monolith 自身の Terragrunt stack は無い。AWS リソース（RDS、Cognito Pod Identity、
IAM ポリシー）は `dystopia/infrastructure/aws/production/` にあり、`dystopia/frontend`
（Cognito）と共有している。
```

- [ ] **Step 5: Verify no stale references remain**

```bash
grep -rn "infrastructure/aws/production\|infrastructure/stripe" README.md README-ja.md dystopia/monolith/README.md dystopia/monolith/README-ja.md
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add README.md README-ja.md dystopia/monolith/README.md dystopia/monolith/README-ja.md
git commit -s -m "$(cat <<'EOF'
docs: update dystopia infrastructure layout references

Follows the dystopia/infrastructure consolidation (previous commits).
EOF
)"
```

---

### Task 6: Final sweep, push, and Draft PR

**Files:** None (verification + git operations only).

**Interfaces:** None.

- [ ] **Step 1: Repo-wide residue check**

```bash
grep -rln "infrastructure/aws\|infrastructure/stripe\|dependency \"cognito\"" -- . \
  ':!.claude/worktrees' ':!docs/superpowers/specs' ':!docs/superpowers/plans' \
  ':!system-components'
```
Expected: no output. (The excluded paths are the historical spec/plan docs from the 2026-08-29 refactor, which are a record of what was true then and are not rewritten, and `system-components/pennyworth`, which is untouched and legitimately still uses `infrastructure/aws/{environment}`.)

- [ ] **Step 2: Confirm the full task list**

```bash
git log --oneline origin/main..HEAD
```
Expected: 5 commits (Tasks 1-5), each with a `Signed-off-by:` trailer and no `Co-Authored-By:` trailer.

- [ ] **Step 3: Push and open the Draft PR**

```bash
git push -u origin HEAD
gh pr create --draft --title "refactor(dystopia): consolidate per-service infrastructure into dystopia/infrastructure" --body "$(cat <<'EOF'
## Summary
- Consolidate `dystopia/monolith/infrastructure/aws` and `dystopia/frontend/infrastructure/aws` into one `dystopia/infrastructure/aws` Terragrunt stack (Cognito + RDS + Pod Identity), removing the cross-directory `dependency` block.
- Delete the empty `dystopia/monolith/infrastructure/stripe` stub (zero resources; recreate when real Stripe integration is needed).
- `workflow-config.yaml`: one-line directory change for the `aws` terragrunt stack, `stripe` id entry removed.
- `reusable--container-builder.yaml`: skip the build when `working-directory` has no `Dockerfile`, since `dystopia/infrastructure` now matches the `container` stack's directory-existence check with nothing to build.

## Why
Neither the monolith nor the frontend AWS stack has ever been applied under the current production account (recreated 2026-09-04) — this is the last point to change the layout without a state migration. See `docs/superpowers/specs/2026-09-06-dystopia-infrastructure-consolidation-design.md` for the full design.

## Test plan
- [x] `terragrunt run -- init -backend=false && terragrunt run -- validate` passes for `dystopia/infrastructure/aws/production`
- [x] `workflow_config.rb` resolves the new `aws` pattern and confirms `stripe` no longer exists
- [x] `actionlint` passes on the modified workflow file
- [ ] CI on this PR: `deploy:infrastructure` label appears, `deploy-terragrunt` matrix shows exactly one `aws` target, `deploy-container` job for `infrastructure` (if triggered) completes green via skip
- [ ] CI on this PR: `monolith`/`frontend`/`pennyworth` container builds still run normally (regression check for the new gate)
EOF
)"
```

- [ ] **Step 4: Report the PR URL back to the user**

No further action — this plan's scope ends here. The actual `terragrunt apply` / Secrets Manager provisioning / pod restart against production is a separate, already-agreed task that starts after this PR merges.

## Self-Review Notes

- **Spec coverage:** Every section of the design spec (Decisions, Target Structure, workflow-config.yaml, CI Workflow Changes, Terraform Changes, Path Changes, README updates) maps to Task 1-5. "Not Changing" and "Out of Scope" items are correctly absent from every task.
- **Type/name consistency:** `db_identifier`/`db_subnet_group_name`/`db_security_group_name`/`user_pool_name` values in Task 1 Step 10's `inputs` block match the variable names declared in Task 1 Step 2, and match the values previously hardcoded in the two original `terragrunt.hcl` files (no accidental renaming).
- **Duplicate-resource fix:** called out explicitly in Task 1's preamble and reflected in both Step 4 (`sms_role.tf`) and Step 5 (`main.tf`) — neither file declares `data "aws_caller_identity" "current"`.
- **No placeholders:** every step shows full file content or an exact diff; no "add appropriate X" language.
