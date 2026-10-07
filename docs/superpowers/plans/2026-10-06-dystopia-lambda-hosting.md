# dystopia Lambda Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** frontend と monolith を 1 つのコンテナに同居させた Lambda 構成を `dystopia/lambda` に追加し、main への push で `https://dystopia.city` にデプロイされる状態を作る。

**Architecture:** CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js :3000 → gRPC `127.0.0.1:50051` → private な RDS。外向き通信は IPv6 の egress-only internet gateway と S3 gateway endpoint のみ。migration と DB への手動操作は、同じイメージを起動コマンドだけ差し替えた task 用関数で行う。関数の設定は Terraform が持ち、動かすイメージは deploy workflow が更新する。

**Tech Stack:** OpenTofu 1.12.6 / Terragrunt 1.0.2（aqua 管理）、AWS provider 6.66.0、Node.js 24（`node:test`）、Docker、GitHub Actions、Lambda Web Adapter 1.1.0。

**Spec:** `docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md`

## Global Constraints

- 作業場所は worktree `.worktrees/feat-dystopia-lambda-hosting`（ブランチ `feat/dystopia-lambda-hosting`）。本 plan のパスは全て worktree のルートからの相対パス
- 変更してよいのは `dystopia/lambda/**`、`.github/workflows/deploy-dystopia-lambda.yaml`、`docs/superpowers/**` だけ。`dystopia/infrastructure`、`dystopia/frontend`、`dystopia/monolith`、`clusters/`、`workflow-config.yaml`、`release-please-config.json`、`aqua.yaml` は変更しない
- IaC のコマンドは `tofu` と `terragrunt` を使う。CI が aqua の OpenTofu で動くため `terraform` コマンドは使わない
- AWS provider は `6.66.0` 固定、random provider は `~> 3.9`。モジュールに `required_version` を書かない
- gRPC のポートは `50051`。`9001` は Lambda の Runtime API が使うため禁止
- リソース名は固定: user pool `dystopia-production`、media バケット `dystopia-media-production`、DB 識別子 `monolith-production`、アプリ用関数 `dystopia-production`、task 用関数 `dystopia-production-task`、ECR リポジトリ `dystopia`、state キー `dystopia/lambda/production/terraform.tfstate`
- NAT Gateway、Internet Gateway、public subnet を作らない
- 依存を追加しない。`task.mjs` とそのテストは Node.js の標準ライブラリだけで書く
- Dockerfile に BuildKit 専用の記法（`# syntax=`、`RUN --mount`、`COPY --chmod`）を使わない。ローカルの docker に buildx がなく、結合テストが legacy builder で通る必要がある
- テスト用のシェルスクリプトは macOS 標準の bash 3.2 で動くこと
- コードコメントは英語、1 行、why / why-not だけを書く。タスクや修正への言及は書かない
- commit は `git commit -s`。メッセージは英語。`Co-Authored-By` を付けない。末尾に `Claude-Session: https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV` を付ける
- ドキュメントは見出しを英語、本文を日本語で書く
- production への apply をローカルから実行しない。ローカルで許されるのは読み取りだけの `terragrunt plan -lock=false`

## Review Focus

- SQL にシェルのメタ文字や引用符（`$(...)`、バッククォート、`'`、`"`）が含まれる。そのまま psql の 1 引数として渡り、シェルに解釈されない（Task 2 の `passes SQL to psql as one argument without shell interpretation`）
- gRPC と Next.js の片方だけが落ちる。実行環境全体が非ゼロで終了し、半分だけ動いた環境にリクエストが流れ続けない（Task 3 の `container stops with a failure status when the ... process exits`）
- 複数文の SQL の途中の文が失敗する。後続の文を実行せず 500 を返す（Task 3 の `a failing statement stops the script`）
- リクエスト本文が JSON でない、空、または `null`。サーバーは落ちずに 500 を返す（Task 2 の `rejects a body that is not a JSON object with a task`）
- コマンドの出力が Lambda の同期応答の上限を超える。末尾 256 KiB だけを返す（Task 2 の `keeps only the tail of very large output`）

---

## File Structure

- `dystopia/lambda/aws/root.hcl`（新規）— state の置き場と共通タグ
- `dystopia/lambda/aws/production/env.hcl`（新規）— production の値（ドメイン、Route53 用ロール）
- `dystopia/lambda/aws/production/terragrunt.hcl`（新規）— モジュールへの入力
- `dystopia/lambda/aws/modules/terraform.tf`（新規）— provider 3 つ（東京、us-east-1、management account の Route53）
- `dystopia/lambda/aws/modules/variables.tf`（新規）
- `dystopia/lambda/aws/modules/network.tf`（新規）— VPC、subnet、egress-only internet gateway、S3 gateway endpoint、security group
- `dystopia/lambda/aws/modules/rds.tf`（新規）— RDS、subnet group、VPC 内の DNS 別名
- `dystopia/lambda/aws/modules/cognito.tf`（新規）— user pool、client、SMS 用ロール
- `dystopia/lambda/aws/modules/s3.tf`（新規）— media バケット
- `dystopia/lambda/aws/modules/lambda.tf`（新規）— ECR、実行ロール、アプリ用と task 用の関数、Function URL
- `dystopia/lambda/aws/modules/cdn.tf`（新規）— ACM 証明書、CloudFront、apex の DNS
- `dystopia/lambda/aws/modules/outputs.tf`（新規）
- `dystopia/lambda/aws/modules/tests/hosting.tftest.hcl`（新規）— mock provider による plan 結果の検査
- `dystopia/lambda/aws/modules/tests/contract_test.sh`（新規）— fmt / validate と、禁止リソースの有無の検査
- `dystopia/lambda/image/task.mjs`（新規）— task 用関数の HTTP サーバー
- `dystopia/lambda/image/tests/task.test.mjs`（新規）— `task.mjs` の単体テスト
- `dystopia/lambda/image/Dockerfile`（新規）— 統合イメージ
- `dystopia/lambda/image/Dockerfile.dockerignore`（新規）
- `dystopia/lambda/image/start`（新規）— アプリ用関数の起動スクリプト
- `dystopia/lambda/image/tests/image_test.sh`（新規）— コンテナの結合テスト
- `.github/workflows/deploy-dystopia-lambda.yaml`（新規）— PR で plan、main で deploy
- `dystopia/lambda/README.md`（新規）

---

### Task 1: Terraform module for the Lambda hosting stack

**Files:**
- Create: `dystopia/lambda/aws/root.hcl`
- Create: `dystopia/lambda/aws/production/env.hcl`
- Create: `dystopia/lambda/aws/production/terragrunt.hcl`
- Create: `dystopia/lambda/aws/modules/terraform.tf`
- Create: `dystopia/lambda/aws/modules/variables.tf`
- Create: `dystopia/lambda/aws/modules/network.tf`
- Create: `dystopia/lambda/aws/modules/rds.tf`
- Create: `dystopia/lambda/aws/modules/cognito.tf`
- Create: `dystopia/lambda/aws/modules/s3.tf`
- Create: `dystopia/lambda/aws/modules/lambda.tf`
- Create: `dystopia/lambda/aws/modules/cdn.tf`
- Create: `dystopia/lambda/aws/modules/outputs.tf`
- Test: `dystopia/lambda/aws/modules/tests/hosting.tftest.hcl`
- Test: `dystopia/lambda/aws/modules/tests/contract_test.sh`

**Interfaces:**
- Consumes: なし
- Produces:
  - Terraform のリソースアドレス `aws_ecr_repository.app`（Task 4 の workflow が `-target` で指定する）
  - ECR リポジトリ名 `dystopia`、関数名 `dystopia-production` と `dystopia-production-task`（Task 4 が使う）
  - task 用関数の起動コマンド `node /app/lambda/task.mjs`、作業ディレクトリ `/app/monolith`（Task 2 と Task 3 がこのパスに合わせる）
  - アプリ用関数の環境変数 `GRPC_BIND_ADDRESS=0.0.0.0:50051`、`MONOLITH_URL=http://127.0.0.1:50051`、`AWS_LWA_PORT=3000`
  - task 用関数の環境変数 `AWS_LWA_PORT=8080`
  - output: `ecr_repository_url`、`app_function_name`、`task_function_name`、`function_url`、`cloudfront_domain_name`、`user_pool_id`、`client_id`、`media_bucket_name`、`rds_alias`

- [ ] **Step 1: plan 結果を検査するテストを書く**

`dystopia/lambda/aws/modules/tests/hosting.tftest.hcl`:

```hcl
mock_provider "aws" {
  mock_resource "aws_vpc" {
    defaults = {
      id              = "vpc-test"
      ipv6_cidr_block = "2406:da14:1234:5600::/56"
    }
  }

  mock_resource "aws_security_group" {
    defaults = {
      id = "sg-test"
    }
  }

  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::337169763788:role/test"
    }
  }

  mock_resource "aws_cognito_user_pool" {
    defaults = {
      arn = "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test"
    }
  }

  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::dystopia-media-production"
    }
  }

  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:337169763788:certificate/00000000-0000-0000-0000-000000000000"
    }
  }

  mock_resource "aws_lambda_function_url" {
    defaults = {
      function_url = "https://abcdefghijklmnop.lambda-url.ap-northeast-1.on.aws/"
    }
  }
}

mock_provider "aws" {
  alias = "us_east_1"

  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:337169763788:certificate/00000000-0000-0000-0000-000000000000"
    }
  }
}

mock_provider "aws" {
  alias = "route53"
}

mock_provider "random" {}

override_resource {
  target = random_password.monolith_db_master
  values = {
    result = "TestPassword0123456789"
  }
}

variables {
  environment           = "production"
  aws_region            = "ap-northeast-1"
  domain_name           = "dystopia.city"
  route53_zone_role_arn = "arn:aws:iam::559744160976:role/route53-zone-access"
  common_tags = {
    Environment = "production"
  }
}

run "database_is_private" {
  command = plan

  assert {
    condition     = aws_db_instance.monolith.publicly_accessible == false
    error_message = "RDS must not be publicly accessible."
  }

  assert {
    condition = (
      aws_vpc_security_group_ingress_rule.rds_from_lambda.from_port == 5432 &&
      aws_vpc_security_group_ingress_rule.rds_from_lambda.to_port == 5432 &&
      aws_vpc_security_group_ingress_rule.rds_from_lambda.cidr_ipv4 == null &&
      aws_vpc_security_group_ingress_rule.rds_from_lambda.cidr_ipv6 == null
    )
    error_message = "RDS must accept PostgreSQL traffic from a security group only, never from a CIDR range."
  }

  assert {
    condition     = random_password.monolith_db_master.special == false
    error_message = "The database password must stay alphanumeric because DATABASE_URL embeds it without escaping."
  }

  assert {
    condition     = length(aws_subnet.private) == 3
    error_message = "The VPC must have one private subnet in each of the three availability zones."
  }
}

run "egress_is_ipv6_only" {
  command = plan

  assert {
    condition     = aws_route.ipv6_egress.destination_ipv6_cidr_block == "::/0"
    error_message = "The only default route must be the IPv6 route through the egress-only internet gateway."
  }

  assert {
    condition     = aws_vpc_endpoint.s3.vpc_endpoint_type == "Gateway"
    error_message = "S3 must be reached through a gateway endpoint."
  }

  assert {
    condition = (
      aws_lambda_function.app.vpc_config[0].ipv6_allowed_for_dual_stack == true &&
      aws_lambda_function.task.vpc_config[0].ipv6_allowed_for_dual_stack == true
    )
    error_message = "Both functions must allow IPv6 egress on dual-stack subnets."
  }
}

run "grpc_port_avoids_the_lambda_runtime_api" {
  command = plan

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["GRPC_BIND_ADDRESS"] == "0.0.0.0:50051"
    error_message = "The monolith must bind gRPC to port 50051."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["MONOLITH_URL"] == "http://127.0.0.1:50051"
    error_message = "The frontend must call the monolith on the same gRPC port."
  }

  assert {
    condition = (
      aws_lambda_function.app.environment[0].variables["AWS_LWA_READINESS_CHECK_PORT"] == "50051" &&
      aws_lambda_function.app.environment[0].variables["AWS_LWA_READINESS_CHECK_PROTOCOL"] == "tcp"
    )
    error_message = "Readiness must wait for the gRPC port over TCP."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["AWS_LWA_PORT"] == "3000"
    error_message = "The adapter must forward requests to Next.js on port 3000."
  }
}

run "application_function_settings" {
  command = plan

  assert {
    condition = (
      aws_lambda_function.app.function_name == "dystopia-production" &&
      aws_lambda_function.app.memory_size == 1024 &&
      aws_lambda_function.app.timeout == 30 &&
      aws_lambda_function.app.architectures == tolist(["arm64"])
    )
    error_message = "The application function must be dystopia-production on arm64 with 1024 MB and a 30 second timeout."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["COGNITO_ADAPTER"] == "aws"
    error_message = "The frontend must use the real Cognito adapter."
  }

  assert {
    condition     = aws_lambda_function.app.environment[0].variables["DATABASE_URL"] == "postgres://postgres:TestPassword0123456789@monolith-db.dystopia.local:5432/monolith"
    error_message = "DATABASE_URL must point at the private DNS alias."
  }

  assert {
    condition     = aws_lambda_function_url.app.authorization_type == "NONE"
    error_message = "The function URL must be public so CloudFront can forward browser POST requests."
  }

  assert {
    condition     = aws_lambda_function_url.app.function_name == "dystopia-production"
    error_message = "The only function URL must belong to the application function, never to the task function."
  }
}

run "task_function_settings" {
  command = plan

  assert {
    condition = (
      aws_lambda_function.task.function_name == "dystopia-production-task" &&
      aws_lambda_function.task.timeout == 900
    )
    error_message = "The task function must be dystopia-production-task with a 900 second timeout."
  }

  assert {
    condition = (
      aws_lambda_function.task.image_config[0].entry_point == tolist(["node", "/app/lambda/task.mjs"]) &&
      aws_lambda_function.task.image_config[0].working_directory == "/app/monolith"
    )
    error_message = "The task function must start task.mjs from the monolith directory."
  }

  assert {
    condition = (
      aws_lambda_function.task.environment[0].variables["AWS_LWA_PORT"] == "8080" &&
      aws_lambda_function.task.environment[0].variables["AWS_LWA_ERROR_STATUS_CODES"] == "500-599"
    )
    error_message = "The task function must surface HTTP 5xx responses as failed invocations."
  }

  assert {
    condition     = aws_lambda_function.task.environment[0].variables["DATABASE_URL"] == aws_lambda_function.app.environment[0].variables["DATABASE_URL"]
    error_message = "Both functions must use the same database."
  }
}

run "cloudfront_serves_the_domain" {
  command = plan

  assert {
    condition     = aws_cloudfront_distribution.this.aliases == toset(["dystopia.city"])
    error_message = "CloudFront must serve the public domain."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.this.origin).domain_name == "abcdefghijklmnop.lambda-url.ap-northeast-1.on.aws"
    error_message = "The origin must be the function URL host without scheme or trailing slash."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.ordered_cache_behavior[0].path_pattern == "/_next/static/*"
    error_message = "Static assets must have their own cached behavior."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "Viewers must be redirected to HTTPS."
  }

  assert {
    condition     = toset(keys(aws_route53_record.apex)) == toset(["A", "AAAA"])
    error_message = "The apex must have both A and AAAA alias records."
  }
}
```

- [ ] **Step 2: 禁止リソースの有無を検査するテストを書く**

`dystopia/lambda/aws/modules/tests/contract_test.sh`:

```sh
#!/usr/bin/env sh

set -eu

module_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

count_resources() {
  cat "$module_dir"/*.tf | grep -Ec "^[[:space:]]*resource[[:space:]]+\"$1\"[[:space:]]" || true
}

assert_count() {
  type=$1
  expected=$2
  actual=$(count_resources "$type")

  if [ "$actual" != "$expected" ]; then
    printf 'Expected %s resources of type %s, found %s\n' "$expected" "$type" "$actual" >&2
    exit 1
  fi
}

cd "$module_dir"

tofu fmt -check -recursive
tofu init -backend=false -input=false -no-color
tofu validate -no-color

assert_count aws_nat_gateway 0
assert_count aws_internet_gateway 0
assert_count aws_egress_only_internet_gateway 1
assert_count aws_vpc_security_group_ingress_rule 1
assert_count aws_lambda_function_url 1

if ! grep -Fq 'ignore_changes = [image_uri]' lambda.tf; then
  echo 'Lambda functions must ignore image_uri so the deploy workflow owns the running image.' >&2
  exit 1
fi

echo 'Lambda hosting module contract passed.'
```

```bash
chmod 755 dystopia/lambda/aws/modules/tests/contract_test.sh
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `sh dystopia/lambda/aws/modules/tests/contract_test.sh`
Expected: 非ゼロで終了し、`Expected 1 resources of type aws_egress_only_internet_gateway, found 0` を出力する

Run: `(cd dystopia/lambda/aws/modules && tofu test -no-color)`
Expected: `Failure! 0 passed, 1 failed, 5 skipped.`

- [ ] **Step 4: Terragrunt の設定を書く**

`dystopia/lambda/aws/root.hcl`:

```hcl
locals {
  project_name = "dystopia"

  path_parts  = split("/", path_relative_to_include())
  environment = element(local.path_parts, length(local.path_parts) - 1)

  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terragrunt"
    Repository  = "monorepo"
    Component   = "lambda"
    Team        = "panicboat"
  }
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket = "terragrunt-state-${get_aws_account_id()}"

    key    = "dystopia/lambda/${local.environment}/terraform.tfstate"
    region = "ap-northeast-1"

    dynamodb_table = "terragrunt-state-locks"

    encrypt = true
  }
}

inputs = {
  environment = local.environment
  common_tags = local.common_tags
  aws_region  = "ap-northeast-1"
}
```

`dystopia/lambda/aws/production/env.hcl`:

```hcl
locals {
  aws_region = "ap-northeast-1"

  domain_name = "dystopia.city"

  # Role assumed to manage the public hosted zone in the management account.
  route53_zone_role_arn = "arn:aws:iam::559744160976:role/route53-zone-access"

  additional_tags = {
    CostCenter = "production"
    Owner      = "panicboat"
    Purpose    = "dystopia"
  }
}
```

`dystopia/lambda/aws/production/terragrunt.hcl`:

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
  aws_region            = include.env.locals.aws_region
  domain_name           = include.env.locals.domain_name
  route53_zone_role_arn = include.env.locals.route53_zone_role_arn
  common_tags = merge(
    include.root.locals.common_tags,
    include.env.locals.additional_tags
  )
}
```

- [ ] **Step 5: provider と変数を書く**

`dystopia/lambda/aws/modules/terraform.tf`:

```hcl
terraform {
  # Omit required_version because CI runs OpenTofu, whose version numbers differ from Terraform's.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.66.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}

# CloudFront only accepts ACM certificates issued in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = var.common_tags
  }
}

# The dystopia.city hosted zone lives in the management account.
provider "aws" {
  alias  = "route53"
  region = var.aws_region

  assume_role {
    role_arn = var.route53_zone_role_arn
  }

  default_tags {
    tags = var.common_tags
  }
}
```

`dystopia/lambda/aws/modules/variables.tf`:

```hcl
variable "environment" {
  type        = string
  description = "Environment name (production)"
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

variable "domain_name" {
  type        = string
  description = "Public domain name served by CloudFront"
}

variable "route53_zone_role_arn" {
  type        = string
  description = "Role assumed to manage the public hosted zone in the management account"
}
```

- [ ] **Step 6: ネットワークを書く**

`dystopia/lambda/aws/modules/network.tf`:

```hcl
locals {
  availability_zones = ["ap-northeast-1a", "ap-northeast-1c", "ap-northeast-1d"]
}

resource "aws_vpc" "this" {
  cidr_block                       = "10.10.0.0/16"
  assign_generated_ipv6_cidr_block = true
  enable_dns_support               = true
  enable_dns_hostnames             = true

  tags = {
    Name = "dystopia-${var.environment}"
  }
}

resource "aws_subnet" "private" {
  for_each = { for index, zone in local.availability_zones : zone => index }

  vpc_id                          = aws_vpc.this.id
  availability_zone               = each.key
  cidr_block                      = cidrsubnet(aws_vpc.this.cidr_block, 8, each.value)
  ipv6_cidr_block                 = cidrsubnet(aws_vpc.this.ipv6_cidr_block, 8, each.value)
  assign_ipv6_address_on_creation = true

  tags = {
    Name = "dystopia-${var.environment}-private-${each.key}"
  }
}

resource "aws_egress_only_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "dystopia-${var.environment}"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "dystopia-${var.environment}-private"
  }
}

# Use a standalone route because inline routes would fight the S3 gateway endpoint for ownership of the table.
resource "aws_route" "ipv6_egress" {
  route_table_id              = aws_route_table.private.id
  destination_ipv6_cidr_block = "::/0"
  egress_only_gateway_id      = aws_egress_only_internet_gateway.this.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name = "dystopia-${var.environment}-s3"
  }
}

resource "aws_security_group" "lambda" {
  name        = "dystopia-${var.environment}-lambda"
  description = "dystopia Lambda functions"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_egress_rule" "lambda_ipv4" {
  security_group_id = aws_security_group.lambda.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "lambda_ipv6" {
  security_group_id = aws_security_group.lambda.id
  ip_protocol       = "-1"
  cidr_ipv6         = "::/0"
}

resource "aws_security_group" "rds" {
  name        = "dystopia-${var.environment}-rds"
  description = "dystopia RDS instance"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_lambda" {
  security_group_id            = aws_security_group.rds.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.lambda.id
}
```

- [ ] **Step 7: RDS を書く**

`dystopia/lambda/aws/modules/rds.tf`:

```hcl
# Keep the password alphanumeric because it is embedded in DATABASE_URL without escaping.
resource "random_password" "monolith_db_master" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "monolith" {
  name       = "monolith-${var.environment}"
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]
}

resource "aws_db_instance" "monolith" {
  identifier     = "monolith-${var.environment}"
  engine         = "postgres"
  engine_version = "18.6"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "monolith"
  username = "postgres"
  password = random_password.monolith_db_master.result

  db_subnet_group_name   = aws_db_subnet_group.monolith.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7
  backup_window           = "16:00-17:00"
  maintenance_window      = "sun:17:00-sun:18:00"

  skip_final_snapshot = true
  deletion_protection = false
}

resource "aws_route53_zone" "dystopia_local" {
  name = "dystopia.local"

  vpc {
    vpc_id = aws_vpc.this.id
  }
}

resource "aws_route53_record" "monolith_db" {
  zone_id = aws_route53_zone.dystopia_local.zone_id
  name    = "monolith-db.dystopia.local"
  type    = "CNAME"
  ttl     = 300
  records = [aws_db_instance.monolith.address]
}
```

- [ ] **Step 8: Cognito と S3 を書く**

`dystopia/lambda/aws/modules/cognito.tf`（`dystopia/infrastructure/aws/modules/user_pool.tf` と `sms_role.tf` と同じ設定で、名前を `var.environment` から導出する）:

```hcl
locals {
  user_pool_name = "dystopia-${var.environment}"
}

resource "aws_iam_role" "cognito_sms" {
  name = "${local.user_pool_name}-cognito-sms"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cognito-idp.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "sts:ExternalId" = "${local.user_pool_name}-cognito-sms"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "cognito_sms" {
  name = "${local.user_pool_name}-cognito-sms"
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

resource "aws_cognito_user_pool" "this" {
  name = local.user_pool_name

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

  sms_verification_message = "【dystopia.city】認証コードは {####} です。本人以外に共有しないでください。"

  mfa_configuration = "OFF"

  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  sms_configuration {
    external_id    = "${local.user_pool_name}-cognito-sms"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
    sns_region     = var.aws_region
  }

  deletion_protection = "ACTIVE"
}

resource "aws_cognito_user_pool_client" "bff" {
  name         = "${local.user_pool_name}-bff"
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

`dystopia/lambda/aws/modules/s3.tf`:

```hcl
resource "aws_s3_bucket" "media" {
  bucket = "dystopia-media-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${var.domain_name}"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
```

- [ ] **Step 9: ECR と Lambda を書く**

`dystopia/lambda/aws/modules/lambda.tf`:

```hcl
locals {
  app_function_name  = "dystopia-${var.environment}"
  task_function_name = "dystopia-${var.environment}-task"

  # Avoid 9001 because the Lambda Runtime API listens on 127.0.0.1:9001.
  grpc_port = 50051

  database_url = "postgres://${aws_db_instance.monolith.username}:${random_password.monolith_db_master.result}@${aws_route53_record.monolith_db.name}:5432/${aws_db_instance.monolith.db_name}"

  # Stripe is unreachable without IPv4 egress, but the monolith refuses to boot unless these settings are present.
  shared_environment = {
    DATABASE_URL              = local.database_url
    COGNITO_REGION            = var.aws_region
    COGNITO_USER_POOL_ID      = aws_cognito_user_pool.this.id
    COGNITO_CLIENT_ID         = aws_cognito_user_pool_client.bff.id
    MEDIA_BUCKET_NAME         = aws_s3_bucket.media.bucket
    MEDIA_BUCKET_REGION       = var.aws_region
    STRIPE_API_KEY            = "disabled"
    STRIPE_WEBHOOK_SECRET     = "disabled"
    STRIPE_PRICE_ID_GUEST     = "disabled"
    STRIPE_PRICE_ID_CAST      = "disabled"
    BILLING_SUCCESS_URL       = "disabled"
    BILLING_CANCEL_URL        = "disabled"
    BILLING_PORTAL_RETURN_URL = "disabled"
  }
}

resource "aws_ecr_repository" "app" {
  name                 = "dystopia"
  image_tag_mutability = "MUTABLE"
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_iam_role" "lambda" {
  name = "dystopia-${var.environment}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_app" {
  name = "dystopia-${var.environment}-lambda-app"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["cognito-idp:AdminDeleteUser"]
        Resource = aws_cognito_user_pool.this.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/lambda/${local.app_function_name}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "task" {
  name              = "/aws/lambda/${local.task_function_name}"
  retention_in_days = 30
}

resource "aws_lambda_function" "app" {
  function_name = local.app_function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:latest"
  architectures = ["arm64"]
  memory_size   = 1024
  timeout       = 30

  vpc_config {
    subnet_ids                  = [for subnet in aws_subnet.private : subnet.id]
    security_group_ids          = [aws_security_group.lambda.id]
    ipv6_allowed_for_dual_stack = true
  }

  environment {
    variables = merge(local.shared_environment, {
      GRPC_BIND_ADDRESS                = "0.0.0.0:${local.grpc_port}"
      MONOLITH_URL                     = "http://127.0.0.1:${local.grpc_port}"
      COGNITO_ADAPTER                  = "aws"
      OTEL_SDK_DISABLED                = "true"
      AWS_LWA_PORT                     = "3000"
      AWS_LWA_READINESS_CHECK_PORT     = tostring(local.grpc_port)
      AWS_LWA_READINESS_CHECK_PROTOCOL = "tcp"
    })
  }

  # The deploy workflow owns the running image so that migrations can run before the application is updated.
  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_cloudwatch_log_group.app,
    aws_iam_role_policy_attachment.lambda_vpc_access,
  ]
}

resource "aws_lambda_function" "task" {
  function_name = local.task_function_name
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:latest"
  architectures = ["arm64"]
  memory_size   = 1024
  timeout       = 900

  image_config {
    entry_point       = ["node", "/app/lambda/task.mjs"]
    working_directory = "/app/monolith"
  }

  vpc_config {
    subnet_ids                  = [for subnet in aws_subnet.private : subnet.id]
    security_group_ids          = [aws_security_group.lambda.id]
    ipv6_allowed_for_dual_stack = true
  }

  environment {
    variables = merge(local.shared_environment, {
      AWS_LWA_PORT                 = "8080"
      AWS_LWA_READINESS_CHECK_PATH = "/"
      AWS_LWA_ERROR_STATUS_CODES   = "500-599"
    })
  }

  lifecycle {
    ignore_changes = [image_uri]
  }

  depends_on = [
    aws_cloudwatch_log_group.task,
    aws_iam_role_policy_attachment.lambda_vpc_access,
  ]
}

resource "aws_lambda_function_url" "app" {
  function_name      = aws_lambda_function.app.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"
}

resource "aws_lambda_permission" "app_function_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.app.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Function URLs also require lambda:InvokeFunction, scoped here to invocations that arrive through the URL.
resource "aws_lambda_permission" "app_function_url_invoke" {
  statement_id             = "AllowPublicFunctionUrlInvoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.app.function_name
  principal                = "*"
  invoked_via_function_url = true
}
```

- [ ] **Step 10: CloudFront と DNS を書く**

`dystopia/lambda/aws/modules/cdn.tf`:

```hcl
data "aws_route53_zone" "public" {
  provider = aws.route53

  name         = var.domain_name
  private_zone = false
}

resource "aws_acm_certificate" "cdn" {
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cdn_validation" {
  provider = aws.route53

  for_each = {
    for option in aws_acm_certificate.cdn.domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  }

  allow_overwrite = true
  zone_id         = data.aws_route53_zone.public.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "cdn" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cdn.arn
  validation_record_fqdns = [for record in aws_route53_record.cdn_validation : record.fqdn]
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  cdn_origin_id = "app"
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "dystopia ${var.environment}"
  aliases         = [var.domain_name]
  price_class     = "PriceClass_200"
  http_version    = "http2and3"

  origin {
    origin_id   = local.cdn_origin_id
    domain_name = trimsuffix(trimprefix(aws_lambda_function_url.app.function_url, "https://"), "/")

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = local.cdn_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = local.cdn_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cdn.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_route53_record" "apex" {
  provider = aws.route53

  for_each = toset(["A", "AAAA"])

  # Overwrite existing apex records because another hosting stack may have left its own aliases behind.
  allow_overwrite = true
  zone_id         = data.aws_route53_zone.public.zone_id
  name            = var.domain_name
  type            = each.key

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}
```

- [ ] **Step 11: output を書く**

`dystopia/lambda/aws/modules/outputs.tf`:

```hcl
output "ecr_repository_url" {
  value       = aws_ecr_repository.app.repository_url
  description = "ECR repository that holds the combined frontend and monolith image"
}

output "app_function_name" {
  value       = aws_lambda_function.app.function_name
  description = "Lambda function that serves the application"
}

output "task_function_name" {
  value       = aws_lambda_function.task.function_name
  description = "Lambda function that runs migrations and ad hoc SQL"
}

output "function_url" {
  value       = aws_lambda_function_url.app.function_url
  description = "Origin URL behind CloudFront"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.this.domain_name
  description = "CloudFront distribution domain name"
}

output "user_pool_id" {
  value       = aws_cognito_user_pool.this.id
  description = "Cognito user pool ID"
}

output "client_id" {
  value       = aws_cognito_user_pool_client.bff.id
  description = "Cognito app client ID used by the frontend"
}

output "media_bucket_name" {
  value       = aws_s3_bucket.media.bucket
  description = "S3 bucket for media storage"
}

output "rds_alias" {
  value       = aws_route53_record.monolith_db.fqdn
  description = "Stable DNS alias for the RDS instance inside the VPC"
}
```

- [ ] **Step 12: テストが通ることを確認する**

Run: `sh dystopia/lambda/aws/modules/tests/contract_test.sh`
Expected: 最終行が `Lambda hosting module contract passed.`

Run: `(cd dystopia/lambda/aws/modules && tofu test -no-color)`
Expected: `Success! 6 passed, 0 failed.`

- [ ] **Step 13: 実環境に対して読み取りだけの plan を実行する**

mock では分からない点（マネージドポリシー名、Route53 の cross-account 参照、state バケットへの接続）を確かめる。リソースは作らない。

```bash
unset AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
export AWS_REGION=ap-northeast-1 AWS_DEFAULT_REGION=ap-northeast-1 AWS_PAGER=""
credentials=$(aws sts assume-role --role-arn arn:aws:iam::337169763788:role/OrganizationAccountAccessRole --role-session-name dystopia-lambda-plan --query Credentials --output json)
export AWS_ACCESS_KEY_ID=$(echo "$credentials" | jq -r .AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo "$credentials" | jq -r .SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo "$credentials" | jq -r .SessionToken)
(cd dystopia/lambda/aws/production && terragrunt plan -no-color -input=false -lock=false) 2>&1 | grep -E "Plan:|Error"
```

Expected: `Plan: 46 to add, 0 to change, 0 to destroy.` を含み、`Error` を含まない

- [ ] **Step 14: commit する**

```bash
git add dystopia/lambda/aws
git commit -s -m "feat(dystopia/lambda): add Terraform for Lambda hosting" \
  -m "The EKS-oriented stack in dystopia/infrastructure looks up the EKS VPC and cluster, so it cannot be applied while the cluster is gone. This stack owns its own VPC and keeps the database private by sending egress over IPv6 only, which avoids the fixed cost of a NAT gateway." \
  -m "Claude-Session: https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV"
```

---

### Task 2: Task server for migrations and ad hoc SQL

**Files:**
- Create: `dystopia/lambda/image/task.mjs`
- Test: `dystopia/lambda/image/tests/task.test.mjs`

**Interfaces:**
- Consumes: Task 1 が決めた待ち受けポートの環境変数 `AWS_LWA_PORT`（task 用関数では `8080`）と、作業ディレクトリ `/app/monolith`
- Produces:
  - HTTP サーバー。`POST`（パスは問わない）の本文 `{"task":"migrate"}` または `{"task":"psql","sql":"<SQL>"}` を受ける
  - 応答は JSON `{"task": string|null, "exitCode": number, "output": string}`。`exitCode` が 0 なら 200、それ以外は 500
  - `POST` 以外のリクエストには 200 と `ok` を返す（Lambda Web Adapter の readiness check 用）
  - コマンドは現在の作業ディレクトリで起動する。`migrate` は `bundle exec hanami db migrate --no-dump`、`psql` は `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -P pager=off -c "<SQL>"`

- [ ] **Step 1: 失敗するテストを書く**

`bundle` と `psql` を、受け取った引数を 1 行ずつ `[...]` で囲んで出力するスタブに差し替えて検証する。

`dystopia/lambda/image/tests/task.test.mjs`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const taskScript = join(dirname(fileURLToPath(import.meta.url)), "..", "task.mjs");
const port = 18080 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;

let stubDirectory;
let server;

function writeStub(name, body) {
  const path = join(stubDirectory, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", body });
  return { status: response.status, json: await response.json() };
}

before(async () => {
  stubDirectory = mkdtempSync(join(tmpdir(), "task-test-"));
  writeStub("bundle", 'for argument in "$@"; do printf "[%s]\\n" "$argument"; done');
  writeStub(
    "psql",
    [
      'for argument in "$@"; do last="$argument"; printf "[%s]\\n" "$argument"; done',
      'case "$last" in',
      '  FAIL) echo "ERROR: relation does not exist" >&2; exit 3 ;;',
      '  BIG) head -c 1048576 /dev/zero | tr "\\0" "x"; echo TAIL ;;',
      "esac",
    ].join("\n"),
  );

  server = spawn(process.execPath, [taskScript], {
    env: {
      PATH: `${stubDirectory}:${process.env.PATH}`,
      AWS_LWA_PORT: String(port),
      DATABASE_URL: "postgres://stub",
    },
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("task server did not start");
});

after(() => {
  server.kill();
  rmSync(stubDirectory, { recursive: true, force: true });
});

test("answers the readiness check on any GET path", async () => {
  assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/anything`)).status, 200);
});

test("runs the migration command", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "migrate" }));

  assert.equal(status, 200);
  assert.equal(json.task, "migrate");
  assert.equal(json.exitCode, 0);
  assert.equal(json.output, "[exec]\n[hanami]\n[db]\n[migrate]\n[--no-dump]\n");
});

test("accepts the event on any POST path", async () => {
  const { status } = await post("/", JSON.stringify({ task: "migrate" }));

  assert.equal(status, 200);
});

test("passes SQL to psql as one argument without shell interpretation", async () => {
  const sql = "select '$(touch /tmp/owned)'; select `id` from \"t\" where a = 'b c'";
  const { status, json } = await post("/events", JSON.stringify({ task: "psql", sql }));

  assert.equal(status, 200);
  assert.equal(
    json.output,
    `[postgres://stub]\n[-v]\n[ON_ERROR_STOP=1]\n[-P]\n[pager=off]\n[-c]\n[${sql}]\n`,
  );
});

test("reports a failing command as a server error with its output", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "psql", sql: "FAIL" }));

  assert.equal(status, 500);
  assert.equal(json.exitCode, 3);
  assert.match(json.output, /ERROR: relation does not exist/);
});

test("rejects an unknown task", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "shell", command: "id" }));

  assert.equal(status, 500);
  assert.equal(json.output, "unknown task");
});

test("rejects psql without SQL text", async () => {
  assert.equal((await post("/events", JSON.stringify({ task: "psql" }))).status, 500);
  assert.equal((await post("/events", JSON.stringify({ task: "psql", sql: "" }))).status, 500);
  assert.equal((await post("/events", JSON.stringify({ task: "psql", sql: ["select 1"] }))).status, 500);
});

test("rejects a body that is not a JSON object with a task", async () => {
  assert.equal((await post("/events", "not json")).status, 500);
  assert.equal((await post("/events", "")).status, 500);
  assert.equal((await post("/events", "null")).status, 500);
});

test("keeps only the tail of very large output", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "psql", sql: "BIG" }));

  assert.equal(status, 200);
  assert.equal(Buffer.byteLength(json.output), 256 * 1024);
  assert.ok(json.output.endsWith("TAIL\n"));
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test dystopia/lambda/image/tests/task.test.mjs`
Expected: `pass 0`、`fail 9`、`Error: task server did not start`

- [ ] **Step 3: 実装を書く**

`dystopia/lambda/image/task.mjs`:

```js
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const port = Number(process.env.AWS_LWA_PORT ?? 8080);

// Keep the tail only because a synchronous Lambda invocation cannot return more than 6 MB.
const maxOutputBytes = 256 * 1024;

function commandFor(event) {
  if (event?.task === "migrate") {
    return ["bundle", ["exec", "hanami", "db", "migrate", "--no-dump"]];
  }

  if (event?.task === "psql" && typeof event.sql === "string" && event.sql !== "") {
    return [
      "psql",
      [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-P", "pager=off", "-c", event.sql],
    ];
  }

  return null;
}

function run(command, args) {
  return new Promise((resolve) => {
    const chunks = [];
    // Pass arguments as an array because a shell would interpret SQL text.
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => resolve({ exitCode: 127, output: String(error) }));
    child.on("close", (exitCode) => {
      const output = Buffer.concat(chunks);
      resolve({ exitCode: exitCode ?? 1, output: output.subarray(-maxOutputBytes).toString("utf8") });
    });
  });
}

async function handle(body) {
  const event = JSON.parse(body);
  const command = commandFor(event);

  if (!command) {
    return { task: event?.task ?? null, exitCode: 1, output: "unknown task" };
  }

  const result = await run(...command);
  return { task: event.task, ...result };
}

const server = createServer(async (request, response) => {
  // Answer every non-POST request so the Lambda Web Adapter readiness check passes on any path.
  if (request.method !== "POST") {
    response.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  let result;
  try {
    result = await handle(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    result = { task: null, exitCode: 1, output: String(error) };
  }

  // Log the outcome without the output because query results can contain personal data.
  console.log(JSON.stringify({ task: result.task, exitCode: result.exitCode }));

  response
    .writeHead(result.exitCode === 0 ? 200 : 500, { "content-type": "application/json" })
    .end(JSON.stringify(result));
});

server.listen(port);
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test dystopia/lambda/image/tests/task.test.mjs`
Expected: `pass 9`、`fail 0`

- [ ] **Step 5: commit する**

```bash
git add dystopia/lambda/image/task.mjs dystopia/lambda/image/tests/task.test.mjs
git commit -s -m "feat(dystopia/lambda): add task server for migrations and SQL" \
  -m "Lambda cuts initialization off at ten seconds, so migrations cannot run at startup, and nothing outside the VPC can reach the private database. The Lambda Web Adapter in the shared image always owns the event loop, so the task function has to answer over HTTP." \
  -m "Claude-Session: https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV"
```

---

### Task 3: Combined container image

**Files:**
- Create: `dystopia/lambda/image/Dockerfile`
- Create: `dystopia/lambda/image/Dockerfile.dockerignore`
- Create: `dystopia/lambda/image/start`
- Test: `dystopia/lambda/image/tests/image_test.sh`

**Interfaces:**
- Consumes: Task 2 の `dystopia/lambda/image/task.mjs`
- Produces:
  - イメージ内の配置: monolith は `/app/monolith`、frontend の standalone 出力は `/app/frontend`、`/app/lambda/start`、`/app/lambda/task.mjs`、Lambda Web Adapter は `/opt/extensions/lambda-adapter`
  - `ENTRYPOINT ["/app/lambda/start"]`
  - ビルドコマンド: `docker build -f dystopia/lambda/image/Dockerfile dystopia`（Task 4 の workflow が同じコンテキストとファイルを指定する）
  - `start` は環境変数 `GRPC_BIND_ADDRESS` と `MONOLITH_URL` をそのまま子プロセスに渡す。値は関数の設定（Task 1）が決める

このタスクのテストは Docker を使う。Docker が動いていなければ `colima start --cpu 4 --memory 8` で起動し、タスクの最後に `colima stop` で止める。

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/lambda/image/tests/image_test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

tests_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
dystopia_dir=$(cd -- "$tests_dir/../../.." && pwd)

image="dystopia-lambda-test:latest"
network="dystopia-lambda-test"
database="dystopia-lambda-test-db"
task="dystopia-lambda-test-task"
app="dystopia-lambda-test-app"
context=$(mktemp -d)

seed_account_id="11111111-1111-4111-8111-111111111111"
sign_in_body='{"phoneNumber":"+819000000101","password":"password"}'

settings=(
  -e "DATABASE_URL=postgres://postgres:password@$database:5432/monolith"
  -e STRIPE_API_KEY=disabled
  -e STRIPE_WEBHOOK_SECRET=disabled
  -e STRIPE_PRICE_ID_GUEST=disabled
  -e STRIPE_PRICE_ID_CAST=disabled
  -e BILLING_SUCCESS_URL=disabled
  -e BILLING_CANCEL_URL=disabled
  -e BILLING_PORTAL_RETURN_URL=disabled
  -e MEDIA_BUCKET_NAME=test
  -e MEDIA_BUCKET_REGION=ap-northeast-1
  -e COGNITO_REGION=ap-northeast-1
  -e COGNITO_USER_POOL_ID=test
)

cleanup() {
  docker rm -f "$app" "$task" "$database" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$context"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "ok: $*"
}

post() {
  docker exec "$1" node -e '
    const [url, body] = process.argv.slice(1);
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
      .then(async (response) => console.log(response.status, await response.text()))
      .catch((error) => console.log("000", error.message));
  ' "$2" "$3"
}

run_task() {
  post "$task" "http://127.0.0.1:8080/events" "$1"
}

# Build the payload with printf because bash 3.2 brace-expands JSON written inside a nested command substitution.
run_sql() {
  local payload
  payload=$(printf '{"task":"psql","sql":"%s"}' "$1")
  run_task "$payload"
}

sign_in() {
  post "$app" "http://127.0.0.1:3000/api/identity/sign-in" "$sign_in_body"
}

expect_status() {
  local expected=$1 actual=$2 label=$3
  [ "${actual%% *}" = "$expected" ] || fail "$label: expected status $expected, got: $actual"
  pass "$label"
}

wait_for_sign_in() {
  local response=""
  for _ in $(seq 1 60); do
    response=$(sign_in)
    [ "${response%% *}" = "200" ] && { echo "$response"; return 0; }
    sleep 1
  done
  fail "sign-in did not return 200 within 60 seconds, last response: $response"
}

running() {
  docker inspect -f '{{.State.Running}}' "$1"
}

child_pid() {
  docker exec "$app" bash -c '
    for directory in /proc/[0-9]*; do
      pid=${directory#/proc/}
      [ "$pid" = 1 ] && continue
      # Strip through the last parenthesis because Next.js renames its process to a title that contains spaces.
      [ "$(sed "s/^.*) //" "$directory/stat" 2>/dev/null | cut -d" " -f2)" = 1 ] || continue
      case "$(readlink "$directory/exe" 2>/dev/null)" in
        *'"$1"'*) echo "$pid" ;;
      esac
    done | head -n 1
  '
}

expect_exit_after_killing() {
  local pattern=$1 pid
  pid=$(child_pid "$pattern")
  [ -n "$pid" ] || fail "no child process matching $pattern"
  docker exec "$app" bash -c "kill -TERM $pid"

  for _ in $(seq 1 30); do
    [ "$(running "$app")" = "false" ] && break
    sleep 1
  done
  [ "$(running "$app")" = "false" ] || fail "container kept running after its $pattern process exited"
  [ "$(docker inspect -f '{{.State.ExitCode}}' "$app")" != "0" ] || fail "container exited with status 0 after its $pattern process exited"
  pass "container stops with a failure status when the $pattern process exits"
}

echo "== build"
# Export tracked and untracked-but-not-ignored files so local node_modules and build output stay out of the image.
(cd "$dystopia_dir" && git ls-files -co --exclude-standard -z -- frontend monolith lambda/image | tar --null -T - -cf - | tar -xf - -C "$context")
docker build -q -f "$context/lambda/image/Dockerfile" -t "$image" "$context" >/dev/null
pass "image builds"

echo "== database"
docker rm -f "$app" "$task" "$database" >/dev/null 2>&1 || true
docker network rm "$network" >/dev/null 2>&1 || true
docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=monolith \
  postgres:18.6-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$database" pg_isready -U postgres -d monolith >/dev/null 2>&1 && break
  sleep 1
done
sleep 2

echo "== task function"
docker run -d --name "$task" --network "$network" --read-only --tmpfs /tmp \
  --entrypoint node -w /app/monolith -e AWS_LWA_PORT=8080 "${settings[@]}" \
  "$image" /app/lambda/task.mjs >/dev/null
for _ in $(seq 1 30); do
  [ "$(docker exec "$task" node -e 'fetch("http://127.0.0.1:8080/").then((r) => console.log(r.status)).catch(() => console.log(0))')" = "200" ] && break
  sleep 1
done

response=$(run_task '{"task":"migrate"}')
expect_status 200 "$response" "migrate creates the schema on an empty database"

response=$(run_sql "select 'accounts-table-' || (to_regclass('identity.accounts') is not null)")
expect_status 200 "$response" "psql runs a query"
[[ "$response" == *accounts-table-true* ]] || fail "identity.accounts does not exist after migrate: $response"
pass "migrate created identity.accounts"

response=$(run_task '{"task":"migrate"}')
expect_status 200 "$response" "migrate is repeatable"

response=$(run_sql "select * from missing_table")
expect_status 500 "$response" "failing SQL is reported as an error"

response=$(run_sql "select 1; select * from missing_table; select 2")
expect_status 500 "$response" "a failing statement stops the script"

response=$(run_task '{"task":"shell"}')
expect_status 500 "$response" "unknown task is rejected"

response=$(run_sql "insert into identity.accounts (id, role) values ('$seed_account_id', 2)")
expect_status 200 "$response" "psql can write"

echo "== application function"
docker run -d --name "$app" --network "$network" --read-only --tmpfs /tmp \
  -e GRPC_BIND_ADDRESS=0.0.0.0:50051 -e MONOLITH_URL=http://127.0.0.1:50051 "${settings[@]}" \
  "$image" >/dev/null

response=$(wait_for_sign_in)
[[ "$response" == *"$seed_account_id"* ]] || fail "sign-in response does not contain the seeded account: $response"
pass "sign-in reaches the database through Next.js and gRPC on a read-only filesystem"

expect_exit_after_killing ruby

docker start "$app" >/dev/null
wait_for_sign_in >/dev/null
expect_exit_after_killing node

docker start "$app" >/dev/null
wait_for_sign_in >/dev/null
started=$(date +%s)
docker stop -t 30 "$app" >/dev/null
elapsed=$(( $(date +%s) - started ))
[ "$elapsed" -lt 15 ] || fail "container took $elapsed seconds to stop on SIGTERM"
pass "container stops promptly on SIGTERM"

echo "All image tests passed."
```

```bash
chmod 755 dystopia/lambda/image/tests/image_test.sh
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `bash dystopia/lambda/image/tests/image_test.sh`
Expected: `== build` の直後に非ゼロで終了する（Dockerfile が存在しないため）

- [ ] **Step 3: 起動スクリプトを書く**

`dystopia/lambda/image/start`:

```bash
#!/bin/bash
set -uo pipefail

(cd /app/monolith && exec ./bin/grpc) &
grpc_pid=$!

(cd /app/frontend && exec node server.js) &
next_pid=$!

trap 'kill -TERM "$grpc_pid" "$next_pid" 2>/dev/null' TERM INT

# Stop the whole environment when either process exits because a half-running pair keeps accepting requests it cannot serve.
wait -n "$grpc_pid" "$next_pid"
status=$?

kill -TERM "$grpc_pid" "$next_pid" 2>/dev/null
wait

# Report failure even for a clean exit because neither process is expected to stop on its own.
if [ "$status" -eq 0 ]; then
  status=1
fi
exit "$status"
```

```bash
chmod 755 dystopia/lambda/image/start
```

- [ ] **Step 4: Dockerfile を書く**

ベースイメージの版は `dystopia/frontend/Dockerfile`（`node:24.21.0`）と `dystopia/monolith/Dockerfile`（`ruby:4.0.3`）に合わせる。着手時に両ファイルを開き、版が変わっていればそちらに合わせる。

`dystopia/lambda/image/Dockerfile`:

```dockerfile
FROM node:24.21.0-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends git ca-certificates

WORKDIR /app
COPY frontend/ .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM ruby:4.0.3-slim AS monolith-builder
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential libpq-dev git libyaml-dev

WORKDIR /app
COPY monolith/Gemfile monolith/Gemfile.lock ./
ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3
RUN bundle config set --local frozen true && \
    bundle install

FROM ruby:4.0.3-slim AS runner
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends libpq5 postgresql-client-17 libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter
# Copy only the binary because the Next.js standalone server needs no other part of the Node.js distribution.
COPY --from=node:24.21.0-slim /usr/local/bin/node /usr/local/bin/node

# Point HOME at /tmp because Lambda mounts every other path read-only.
ENV BUNDLE_PATH=/usr/local/bundle \
    HANAMI_ENV=production \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOME=/tmp \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=monolith-builder /usr/local/bundle /usr/local/bundle
WORKDIR /app/monolith
COPY monolith/ .

WORKDIR /app/frontend
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
COPY --from=frontend-builder /app/public ./public

COPY lambda/image/start lambda/image/task.mjs /app/lambda/
RUN chmod 755 /app/lambda/start

ENTRYPOINT ["/app/lambda/start"]
```

`dystopia/lambda/image/Dockerfile.dockerignore`:

```
**/.git
**/node_modules
**/.next
**/.env.local
**/*.log

infrastructure/
lambda/aws/
lambda/image/tests/

frontend/kubernetes/
frontend/CHANGELOG.md
frontend/README.md
frontend/README-ja.md

monolith/kubernetes/
monolith/log/
monolith/tmp/
monolith/spec/
monolith/coverage/
monolith/vendor/bundle/
monolith/.bundle/
monolith/public/uploads/
monolith/CHANGELOG.md
monolith/README.md
monolith/README-ja.md
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `bash dystopia/lambda/image/tests/image_test.sh`
Expected: 最終行が `All image tests passed.`。途中に次の `ok:` 行が全て出る

```
ok: image builds
ok: migrate creates the schema on an empty database
ok: psql runs a query
ok: migrate created identity.accounts
ok: migrate is repeatable
ok: failing SQL is reported as an error
ok: a failing statement stops the script
ok: unknown task is rejected
ok: psql can write
ok: sign-in reaches the database through Next.js and gRPC on a read-only filesystem
ok: container stops with a failure status when the ruby process exits
ok: container stops with a failure status when the node process exits
ok: container stops promptly on SIGTERM
```

- [ ] **Step 6: スクリプトを lint する**

Run: `shellcheck dystopia/lambda/image/start dystopia/lambda/image/tests/image_test.sh && /bin/bash -n dystopia/lambda/image/tests/image_test.sh`
Expected: 出力なしで終了コード 0

- [ ] **Step 7: commit する**

```bash
git add dystopia/lambda/image/Dockerfile dystopia/lambda/image/Dockerfile.dockerignore dystopia/lambda/image/start dystopia/lambda/image/tests/image_test.sh
git commit -s -m "feat(dystopia/lambda): add combined frontend and monolith image" \
  -m "The Lambda Web Adapter only relays HTTP/1.1, so the gRPC monolith cannot be exposed as its own function. Running it next to Next.js in one container keeps the existing gRPC transport on localhost without changing application code." \
  -m "Claude-Session: https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV"
```

---

### Task 4: Deploy workflow

**Files:**
- Create: `.github/workflows/deploy-dystopia-lambda.yaml`

**Interfaces:**
- Consumes:
  - Task 1 の Terragrunt ディレクトリ `dystopia/lambda/aws/production`、リソースアドレス `aws_ecr_repository.app`、ECR リポジトリ名 `dystopia`、関数名 `dystopia-production` と `dystopia-production-task`
  - Task 2 のイベント `{"task":"migrate"}`
  - Task 3 のビルドコンテキスト `dystopia` と `dystopia/lambda/image/Dockerfile`
  - 既存の `.github/workflows/reusable--terragrunt-executor.yaml`（入力: `service-name`、`environment`、`action-type`、`iam-role`、`aws-region`、`working-directory`、`app-id`、secret `private-key`）
- Produces: PR では plan の結果を PR コメントに出す。main への push では ECR の apply → イメージの push → 全体の apply → migration → アプリ更新の順に実行する

action は全て commit SHA で固定する（`lint-actions.yml` が検査する）。下の SHA はリポジトリと `panicboat/panicboat-actions` で既に使われているものと同じ。

- [ ] **Step 1: workflow を書く**

`.github/workflows/deploy-dystopia-lambda.yaml`:

```yaml
name: 'Deploy - dystopia Lambda'

on:
  pull_request:
    paths:
      - 'dystopia/lambda/aws/**'
      - '.github/workflows/deploy-dystopia-lambda.yaml'
  push:
    branches:
      - main
    paths:
      - 'dystopia/frontend/**'
      - 'dystopia/monolith/**'
      - 'dystopia/lambda/**'
      - '.github/workflows/deploy-dystopia-lambda.yaml'
      - '!dystopia/**/*.md'
      - '!dystopia/**/kubernetes/**'
      - '!dystopia/lambda/**/tests/**'
  workflow_dispatch: {}

permissions:
  id-token: write
  contents: read
  pull-requests: write

concurrency:
  group: deploy-dystopia-lambda-${{ github.event.pull_request.number || 'main' }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  plan:
    name: 'Plan'
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/reusable--terragrunt-executor.yaml
    with:
      service-name: lambda
      environment: production
      action-type: plan
      iam-role: arn:aws:iam::337169763788:role/github-oidc-auth-production-github-actions-plan-role
      aws-region: ap-northeast-1
      working-directory: dystopia/lambda/aws/production
      app-id: ${{ vars.APP_ID }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}

  deploy:
    name: 'Deploy'
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-24.04-arm
    timeout-minutes: 90
    env:
      AWS_REGION: ap-northeast-1
      TF_INPUT: 'false'
      TERRAGRUNT_DIRECTORY: dystopia/lambda/aws/production
      ECR_REPOSITORY: dystopia
      APP_FUNCTION: dystopia-production
      TASK_FUNCTION: dystopia-production-task
    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@254c19bd240aabef8777f48595e9d2d7b972184b # v6.2.1
        with:
          role-to-assume: arn:aws:iam::337169763788:role/github-oidc-auth-production-github-actions-apply-role
          aws-region: ${{ env.AWS_REGION }}
          role-session-name: GitHubActions-DystopiaLambda-Deploy
          role-duration-seconds: 7200
          audience: sts.amazonaws.com

      - name: Setup aqua
        uses: aquaproj/aqua-installer@96a9bc20066c5bf5e275b41019cfc165b25f4e2e # v4.0.5
        with:
          aqua_version: v2.48.2

      # Apply the repository first because a Lambda function cannot be created while its image is missing.
      - name: Apply ECR repository
        working-directory: ${{ env.TERRAGRUNT_DIRECTORY }}
        run: terragrunt apply -auto-approve -input=false -no-color -target=aws_ecr_repository.app

      - name: Log in to ECR
        id: ecr
        run: |
          set -euo pipefail
          registry="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com"
          aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"
          echo "image=${registry}/${ECR_REPOSITORY}" >> "$GITHUB_OUTPUT"

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1

      # Disable provenance because Lambda rejects the multi-manifest image index that attestations produce.
      - name: Build and push image
        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: dystopia
          file: dystopia/lambda/image/Dockerfile
          platforms: linux/arm64
          provenance: false
          push: true
          tags: |
            ${{ steps.ecr.outputs.image }}:${{ github.sha }}
            ${{ steps.ecr.outputs.image }}:latest
          cache-from: type=gha,scope=dystopia-lambda
          cache-to: type=gha,mode=max,scope=dystopia-lambda

      - name: Apply infrastructure
        working-directory: ${{ env.TERRAGRUNT_DIRECTORY }}
        run: terragrunt apply -auto-approve -input=false -no-color

      - name: Run migrations
        env:
          IMAGE_URI: ${{ steps.ecr.outputs.image }}:${{ github.sha }}
        run: |
          set -euo pipefail
          aws lambda update-function-code --function-name "$TASK_FUNCTION" --image-uri "$IMAGE_URI" --query LastUpdateStatus --output text
          aws lambda wait function-updated-v2 --function-name "$TASK_FUNCTION"
          aws lambda invoke --function-name "$TASK_FUNCTION" \
            --cli-binary-format raw-in-base64-out --cli-read-timeout 900 \
            --payload '{"task":"migrate"}' "$RUNNER_TEMP/migrate-output.json" > "$RUNNER_TEMP/migrate-invoke.json"
          cat "$RUNNER_TEMP/migrate-output.json"
          echo
          if jq -e 'has("FunctionError")' "$RUNNER_TEMP/migrate-invoke.json" > /dev/null; then
            echo "::error::Migration failed; the application function was not updated."
            exit 1
          fi

      - name: Update application
        env:
          IMAGE_URI: ${{ steps.ecr.outputs.image }}:${{ github.sha }}
        run: |
          set -euo pipefail
          aws lambda update-function-code --function-name "$APP_FUNCTION" --image-uri "$IMAGE_URI" --query LastUpdateStatus --output text
          aws lambda wait function-updated-v2 --function-name "$APP_FUNCTION"
```

- [ ] **Step 2: workflow を lint する**

Run: `actionlint .github/workflows/deploy-dystopia-lambda.yaml`
Expected: 出力なしで終了コード 0

- [ ] **Step 3: 手順の順序を確認する**

Run: `grep -n "name: " .github/workflows/deploy-dystopia-lambda.yaml | sed -n '/Apply ECR repository/,$p'`
Expected: 次の順で並ぶ

```
      - name: Apply ECR repository
      - name: Log in to ECR
      - name: Set up Docker Buildx
      - name: Build and push image
      - name: Apply infrastructure
      - name: Run migrations
      - name: Update application
```

- [ ] **Step 4: commit する**

```bash
git add .github/workflows/deploy-dystopia-lambda.yaml
git commit -s -m "ci(dystopia/lambda): deploy to Lambda on merge to main" \
  -m "workflow-config.yaml keeps production disabled so that stacks whose infrastructure was torn down are not re-applied, which means the convention-based deploy flow cannot be reused. Migrations run before the application function is updated, an ordering a single Terraform apply cannot express." \
  -m "Claude-Session: https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV"
```

---

### Task 5: README

**Files:**
- Create: `dystopia/lambda/README.md`

**Interfaces:**
- Consumes: Task 1〜4 の成果物の名前とコマンド
- Produces: なし

- [ ] **Step 1: README を書く**

`dystopia/lambda/README.md`:

````markdown
# dystopia Lambda hosting

## What

EKS に戻すまでの間、dystopia を AWS Lambda で動かすための構成。frontend（Next.js）と monolith（gRPC）を 1 つのコンテナイメージに同居させ、CloudFront と Lambda Function URL の後ろで動かす。

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js :3000
                                                                    └→ gRPC 127.0.0.1:50051 → RDS
```

設計の全体と各選択の理由は `docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md` にある。

## Layout

| パス | 内容 |
|---|---|
| `image/Dockerfile` | 統合イメージ。ビルドコンテキストは `dystopia/` |
| `image/start` | アプリ用関数の起動スクリプト。gRPC と Next.js を起動し、片方が終了したら全体を終了する |
| `image/task.mjs` | task 用関数の HTTP サーバー。migration と SQL の実行を受ける |
| `aws/modules` | Terraform。VPC、RDS、Cognito、S3、ECR、Lambda、CloudFront |
| `aws/production` | Terragrunt の production 設定 |

`dystopia/infrastructure` は EKS 向けの構成で、この構成とは同じ名前のリソースを定義している。2 つを同時に apply することはできない。

## Constraints

- gRPC のポートは 50051。Lambda の Runtime API が `127.0.0.1:9001` を使うため、monolith の既定値 9001 は使えない
- migration は起動時に実行しない。Lambda の初期化は 10 秒で打ち切られる
- 外向き通信は IPv6 と S3 gateway endpoint だけ。IPv4 でしか到達できない Stripe には届かないため、課金は動かない
- アカウントの Lambda 同時実行数の上限が、同時に処理できるリクエスト数の上限になる
- 静かな時間帯の最初のリクエストは cold start で約 5 秒かかる

## Deploy

main への push で `.github/workflows/deploy-dystopia-lambda.yaml` が次の順に実行する。

1. ECR リポジトリだけを apply する
2. イメージをビルドし、commit の SHA と `latest` のタグで push する
3. 全体を apply する
4. task 用関数を新しいイメージに更新し、migration を実行する
5. アプリ用関数を新しいイメージに更新する

migration が失敗すると 5 は実行されない。migration はアプリより先に反映されるため、破壊的なスキーマ変更は 2 回のデプロイに分ける。

関数が動かすイメージは workflow が決める。Terraform は関数の作成時に `latest` を使い、以後は `image_uri` を変更しない。

## Operations

task 用関数 `dystopia-production-task` は IAM で `lambda:InvokeFunction` を持つ利用者だけが呼べる。

migration を手動で実行する。

```bash
aws lambda invoke --function-name dystopia-production-task \
  --cli-binary-format raw-in-base64-out --cli-read-timeout 900 \
  --payload '{"task":"migrate"}' /dev/stdout
```

SQL を実行する。

```bash
aws lambda invoke --function-name dystopia-production-task \
  --cli-binary-format raw-in-base64-out \
  --payload "$(jq -nc --arg sql 'select count(*) from identity.accounts' '{task:"psql",sql:$sql}')" /dev/stdout
```

応答の `exitCode` が 0 以外のとき、invoke の結果に `FunctionError` が付く。`output` は末尾 256 KiB までを返す。

ログは CloudWatch Logs の `/aws/lambda/dystopia-production` と `/aws/lambda/dystopia-production-task` にある。

## Tests

```bash
sh dystopia/lambda/aws/modules/tests/contract_test.sh
(cd dystopia/lambda/aws/modules && tofu test)
node --test dystopia/lambda/image/tests/task.test.mjs
bash dystopia/lambda/image/tests/image_test.sh
```

`image_test.sh` は Docker を使う。イメージのビルドを含むため、初回は 10 分ほどかかる。

## Teardown

- Cognito user pool は削除保護が有効なので、destroy の前に `deletion_protection` を `INACTIVE` にして apply する
- Lambda は VPC 内のネットワークインターフェースを実行ロールの権限で片付ける。destroy では関数の直後にロールも消えるため、インターフェースが `available` のまま残って security group と subnet の削除が止まることがある。その場合は次のコマンドで削除する

```bash
aws ec2 describe-network-interfaces \
  --filters 'Name=description,Values=AWS Lambda VPC ENI-dystopia-production*' Name=status,Values=available \
  --query 'NetworkInterfaces[].NetworkInterfaceId' --output text \
  | xargs -n 1 aws ec2 delete-network-interface --network-interface-id
```
````

- [ ] **Step 2: README のコマンドが実在するファイルを指していることを確認する**

Run: `ls dystopia/lambda/aws/modules/tests/contract_test.sh dystopia/lambda/image/tests/task.test.mjs dystopia/lambda/image/tests/image_test.sh docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md .github/workflows/deploy-dystopia-lambda.yaml`
Expected: 5 つのパスが全て表示され、エラーが出ない

- [ ] **Step 3: commit する**

```bash
git add dystopia/lambda/README.md
git commit -s -m "docs(dystopia/lambda): describe the Lambda hosting stack" \
  -m "Claude-Session: https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV"
```

---

### Task 6: Publish the branch and confirm the CI plan

**Files:**
- なし（PR #1383 の更新のみ）

**Interfaces:**
- Consumes: Task 1〜5 の commit
- Produces: CI の plan が通った PR #1383

- [ ] **Step 1: 全テストをもう一度通す**

```bash
sh dystopia/lambda/aws/modules/tests/contract_test.sh
(cd dystopia/lambda/aws/modules && tofu test -no-color)
node --test dystopia/lambda/image/tests/task.test.mjs
actionlint .github/workflows/deploy-dystopia-lambda.yaml
```

Expected: 順に `Lambda hosting module contract passed.`、`Success! 6 passed, 0 failed.`、`pass 9` / `fail 0`、出力なし

`image_test.sh` は Task 3 の後にイメージ関連のファイルを変更した場合だけ再実行する。

- [ ] **Step 2: 変更範囲が Global Constraints の範囲内であることを確認する**

Run: `git diff --name-only origin/main...HEAD | grep -vE '^(dystopia/lambda/|docs/superpowers/|\.github/workflows/deploy-dystopia-lambda\.yaml$)'`
Expected: 出力なし（終了コード 1）

- [ ] **Step 3: 追加したコメントを規約と突き合わせる**

Run: `git diff origin/main...HEAD -- dystopia/lambda .github/workflows | grep -E '^\+\s*(#|//)'`
Expected: 各行が英語の 1 行コメントで、理由（because / so that など）を述べ、タスクや修正に言及していない。該当しないコメントがあれば削除して commit する

- [ ] **Step 4: push して PR を更新する**

```bash
git push
gh pr edit 1383 --title "feat(dystopia): host on Lambda until EKS returns" --body "$(cat <<'EOF'
## Summary

dystopia を EKS の外で動かすための Lambda 構成を `dystopia/lambda` に追加します。frontend と monolith を 1 つのコンテナに同居させ、CloudFront と Lambda Function URL の後ろで動かします。

## Why

- `eks-production` は固定費が大きく、既に撤去済みです。dystopia は現在どこでも動いていません。
- いずれ EKS に戻すため、既存の EKS 向け資産（`dystopia/infrastructure`、kubernetes マニフェスト、Flux 設定、release-please）は変更していません。Lambda 構成は `dystopia/lambda` と workflow 1 本を消せば取り除けます。
- 設計と各選択の理由は `docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md` にあります。

## What is added

- `dystopia/lambda/aws`: VPC、RDS、Cognito、S3、ECR、Lambda、CloudFront の Terraform
- `dystopia/lambda/image`: 統合イメージの Dockerfile、起動スクリプト、migration と SQL 実行用の task サーバー
- `.github/workflows/deploy-dystopia-lambda.yaml`: PR で plan、main への push でデプロイ

## Merging creates production resources

merge すると workflow が production アカウントに 46 リソースを作成し、`dystopia.city` の A / AAAA を CloudFront に向けます。初回は RDS と CloudFront の作成で 20〜30 分かかります。

## Known limits

- 外向き通信は IPv6 と S3 gateway endpoint だけです。Stripe には届かないため課金は動きません。
- Cognito への IPv6 接続は実環境で未検証です。初回デプロイ後に最初に確認します。
- アカウントの Lambda 同時実行数の上限は 10 です。
- 静かな時間帯の最初のリクエストは cold start で約 5 秒かかります。

## Test plan

- [x] `sh dystopia/lambda/aws/modules/tests/contract_test.sh`
- [x] `tofu test`（6 run）
- [x] `node --test dystopia/lambda/image/tests/task.test.mjs`（9 test）
- [x] `bash dystopia/lambda/image/tests/image_test.sh`
- [x] `actionlint`
- [ ] CI の terragrunt plan
- [ ] 初回デプロイ後の本番確認（サインイン、media、DNS、応答時間）

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QVAYKxvwujsFuADkdbHDmV
EOF
)"
```

- [ ] **Step 5: CI の plan 結果を確認する**

Run: `gh pr checks 1383 --watch`
Expected: `Deploy - dystopia Lambda / Plan` が pass する

Run: `gh pr view 1383 --json comments --jq '.comments[].body' | grep -E "Plan: [0-9]+ to add"`
Expected: `Plan: 46 to add, 0 to change, 0 to destroy.`

plan が失敗した場合は、失敗したジョブのログ（`gh run view --log-failed`）から原因を特定して修正し、Step 1 から繰り返す。

- [ ] **Step 6: ユーザーに報告して merge を待つ**

テスト結果、plan の結果、merge すると production に 46 リソースが作られることを報告する。Draft の解除と merge はユーザーが行う。

---

### Task 7: First deploy and production verification

**開始条件:** ユーザーが PR #1383 を merge している。merge されるまでこのタスクを開始しない。

**Files:**
- なし

**Interfaces:**
- Consumes: main に入った Task 1〜5 の成果物
- Produces: `https://dystopia.city` で動く dystopia と、検証結果の報告

- [ ] **Step 1: 初回デプロイの完了を待つ**

```bash
run_id=$(gh run list --workflow deploy-dystopia-lambda.yaml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: 終了コード 0。初回は RDS と CloudFront の作成があるので 20〜30 分かかる

失敗した場合は `gh run view "$run_id" --log-failed` で失敗した手順を特定する。`Run migrations` で失敗した場合、ログに出た task 用関数の応答（`{"task":...,"exitCode":...,"output":...}`）を確認する。応答がこの形でなければ、Lambda Web Adapter のイベントの渡し方が想定と違う（spec の Risks）。原因と応答の実物をユーザーに報告して止まる。

- [ ] **Step 2: 以降の手順で使う認証と値を用意する**

```bash
unset AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
export AWS_REGION=ap-northeast-1 AWS_DEFAULT_REGION=ap-northeast-1 AWS_PAGER=""
credentials=$(aws sts assume-role --role-arn arn:aws:iam::337169763788:role/OrganizationAccountAccessRole --role-session-name dystopia-lambda-verify --query Credentials --output json)
export AWS_ACCESS_KEY_ID=$(echo "$credentials" | jq -r .AccessKeyId)
export AWS_SECRET_ACCESS_KEY=$(echo "$credentials" | jq -r .SecretAccessKey)
export AWS_SESSION_TOKEN=$(echo "$credentials" | jq -r .SessionToken)
pool=$(aws cognito-idp list-user-pools --max-results 10 --query 'UserPools[?Name==`dystopia-production`].Id | [0]' --output text)
echo "pool=$pool"
```

Expected: `pool=ap-northeast-1_` で始まる ID

Bash の呼び出しをまたぐと環境変数が消えるので、以降の各ステップの先頭でこのブロックを再実行する。

- [ ] **Step 3: 検証用アカウントを作る**

電話番号（E.164 形式）とパスワード（12 文字以上、大小英字・数字・記号を含む）をユーザーから受け取り、`PHONE` と `PASSWORD` に設定してから実行する。

```bash
username=$(printf '%s' "$PHONE" | shasum -a 256 | cut -d' ' -f1)
sub=$(aws cognito-idp admin-create-user --user-pool-id "$pool" --username "$username" \
  --user-attributes Name=phone_number,Value="$PHONE" Name=phone_number_verified,Value=true \
  --message-action SUPPRESS --query 'User.Attributes[?Name==`sub`].Value | [0]' --output text)
aws cognito-idp admin-set-user-password --user-pool-id "$pool" --username "$username" --password "$PASSWORD" --permanent
aws lambda invoke --function-name dystopia-production-task --cli-binary-format raw-in-base64-out \
  --payload "$(jq -nc --arg sql "insert into identity.accounts (id, role) values ('$sub', 2)" '{task:"psql",sql:$sql}')" /dev/stdout
```

Expected: 最後のコマンドの出力に `"exitCode":0` と `INSERT 0 1` が含まれ、`FunctionError` が含まれない

- [ ] **Step 4: Cognito への IPv6 接続を確認する**

```bash
curl -sS -c /tmp/dystopia-cookies.txt -X POST https://dystopia.city/api/identity/sign-in \
  -H 'content-type: application/json' \
  -d "$(jq -nc --arg phone "$PHONE" --arg password "$PASSWORD" '{phoneNumber:$phone,password:$password}')" \
  -w '\n%{http_code}\n'
```

Expected: 本文に `"account":{"id":"<sub>","role":2}`、ステータス `200`

200 が返れば、frontend から Cognito への `InitiateAuth` と JWKS の取得が IPv6 の出口で通っている。401 や 5xx の場合は `aws logs tail /aws/lambda/dystopia-production --since 5m` で `sign-in initiateAuth failed` やタイムアウトを確認する。Cognito に届いていなければ spec の Risks にある NAT instance の追加が必要になる。これは設計の変更なので、ログを添えてユーザーに報告して止まる。

- [ ] **Step 5: media のアップロードと削除を確認する**

```bash
upload=$(curl -sS -b /tmp/dystopia-cookies.txt -X POST https://dystopia.city/api/media/upload-url \
  -H 'content-type: application/json' -d '{"filename":"verify.png","contentType":"image/png","mediaType":"IMAGE"}')
upload_url=$(echo "$upload" | jq -r .uploadUrl)
media_key=$(echo "$upload" | jq -r .mediaKey)
media_id=$(echo "$upload" | jq -r .mediaId)
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' | base64 -d > /tmp/verify.png
curl -sS -o /dev/null -w 'put=%{http_code}\n' -X PUT -H 'content-type: image/png' --data-binary @/tmp/verify.png "$upload_url"
registered=$(curl -sS -b /tmp/dystopia-cookies.txt -X POST https://dystopia.city/api/media/register \
  -H 'content-type: application/json' \
  -d "$(jq -nc --arg id "$media_id" --arg key "$media_key" --argjson size "$(wc -c < /tmp/verify.png | tr -d ' ')" '{mediaId:$id,mediaKey:$key,mediaType:"IMAGE",filename:"verify.png",contentType:"image/png",sizeBytes:$size}')")
curl -sS -o /dev/null -w 'get=%{http_code}\n' "$(echo "$registered" | jq -r .media.url)"
curl -sS -b /tmp/dystopia-cookies.txt -X DELETE "https://dystopia.city/api/media/$media_id"
echo
aws s3api head-object --bucket dystopia-media-production --key "$media_key" 2>&1 | tail -n 1
```

Expected: `put=200`、`get=200`、`{"success":true}`、最後の行に `Not Found`（monolith が S3 gateway endpoint 経由でオブジェクトを削除できている）

- [ ] **Step 6: 名前解決、HTTPS、静的ファイルのキャッシュを確認する**

```bash
dig +short dystopia.city A | head -n 2
dig +short dystopia.city AAAA | head -n 2
curl -sS -o /dev/null -w 'http=%{http_code} redirect=%{redirect_url}\n' http://dystopia.city/
curl -sS -o /dev/null -w 'https=%{http_code}\n' https://dystopia.city/
asset=$(curl -sS https://dystopia.city/ | grep -oE '/_next/static/[^"]+\.js' | head -n 1)
curl -sS -o /dev/null -D - "https://dystopia.city$asset" | grep -i '^x-cache'
curl -sS -o /dev/null -D - "https://dystopia.city$asset" | grep -i '^x-cache'
```

Expected: A と AAAA の両方に値がある。`http=301 redirect=https://dystopia.city/`、`https=200`。`x-cache` は 2 回目が `Hit from cloudfront`

- [ ] **Step 7: 応答時間を spike の数値と比べる**

```bash
for attempt in 1 2 3 4 5; do
  curl -sS -o /dev/null -b /tmp/dystopia-cookies.txt -w "warm $attempt %{time_total}\n" https://dystopia.city/api/identity/me
done
```

Expected: 2 回目以降が 0.3 秒未満（spike の warm 時は 55〜120ms で、CloudFront の経由ぶんが加わる）

cold start は、20 分以上どこからもアクセスがない状態で同じコマンドを 1 回実行して測る。Expected: 4〜7 秒（spike は 4.3〜5.9 秒）

- [ ] **Step 8: 結果を報告する**

Step 3〜7 の各結果を、実行したコマンドと出力を添えて報告する。検証レベル（VERIFIED / REASONED / ASSUMED）を明示する。あわせて、検証用アカウントを残すか削除するかをユーザーに確認する。
