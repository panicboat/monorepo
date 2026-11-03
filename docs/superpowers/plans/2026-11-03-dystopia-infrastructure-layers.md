# dystopia Infrastructure Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** platform の共有 VPC（NAT なし・IPv6 egress）、monolith のデータ層、Lambda の実行層に dystopia のインフラを分け、production を作り直す。

**Architecture:** platform `aws/vpc` が VPC・subnet・共通 SG `internal` を持つ。monorepo の `dystopia/monolith/aws` が RDS・Cognito・media 用 S3 を持ち、`dystopia/lambda/aws` が terragrunt `dependency` でその出力を受けて Lambda・CloudFront を持つ。両 stack は platform の VPC を data source で引く。

**Tech Stack:** OpenTofu 1.12.6、Terragrunt 1.0.2（aqua）、AWS provider 6.71.0、`terraform-aws-modules/vpc` 6.7.3、`tofu test`、kustomize

**Spec:** `docs/superpowers/specs/2026-11-03-dystopia-infrastructure-layers-design.md`

## Global Constraints

- コマンドは aqua 経由で実行する: `aqua exec -- tofu ...`、`aqua exec -- terragrunt ...`
- 名前に環境名を入れない。対応表は spec の「Naming」をそのまま使う
- S3 バケット名のみ `dystopia-media-<account_id>`（production は `dystopia-media-337169763788`）
- 共通 SG は `internal`。Terraform のリソース名・lookup の出力キーも `internal`
- NAT Gateway は作らない（`enable_nat_gateway = false`、`single_nat_gateway = true`）
- IPv6 は private subnet のみ（`private_subnet_ipv6_prefixes = [0, 1, 2]`）
- RDS: PostgreSQL 18.6、`db.t4g.micro`、単一 AZ、`publicly_accessible = false`、`deletion_protection = true`、パスワードは英数字 32 文字
- コードコメントは 1 行で Why not だけを書く。タスクや変更への言及を書かない
- ドキュメントは見出し英語・本文日本語。CHANGELOG は変更しない
- commit は `git commit -s`。`Co-Authored-By` を付けない
- 実環境（AWS）への apply・destroy は Task 9 の手順でのみ行う。Task 1〜8 は手元のテストだけで完了させる

## Review Focus

- `internal` SG に IPv6 egress がないと、Lambda から Cognito に届かずサインインが全滅する → Task 1 のテストで `::/0` egress を固定
- Lambda の subnet に IPv6 CIDR がないと、`ipv6_allowed_for_dual_stack` の関数作成が失敗する → Task 1 のテストで private subnet の IPv6 設定を固定
- 実行層の apply に `dependency` の mock 値が使われると、偽の DB 接続先で関数が作られる → Task 7 の contract test で `mock_outputs_allowed_terraform_commands` に apply を含めないことを固定
- monorepo の PR を merge すると deploy workflow が即座に実行層を apply する → Task 9 で destroy とデータ層 apply を merge 前に行う順序を固定
- pennyworth の state 移動を忘れると、次回 apply で Secrets Manager を新規作成しようとして名前衝突で失敗する → Task 9 で plan の差分なしを完了条件にする

---

## Repositories and branches

| リポジトリ | ブランチ | Task |
|---|---|---|
| platform | `feat/vpc-ipv6-egress`（`origin/main` から） | 1〜3 |
| monorepo | `feat/dystopia-infrastructure-layers`（spec の PR #1930 と同じ） | 4〜8 |

Task 9 は両方の PR が揃ってから行う。

---

### Task 1: platform VPC module（IPv6・NAT フラグ・命名・`internal` SG）

**Files:**
- Modify: `aws/vpc/modules/main.tf`
- Modify: `aws/vpc/modules/variables.tf`
- Modify: `aws/vpc/modules/outputs.tf`
- Modify: `aws/vpc/production/terragrunt.hcl`
- Rename: `aws/vpc/modules/tests/private_trust.tftest.hcl` → `aws/vpc/modules/tests/network.tftest.hcl`

**Interfaces:**
- Produces（AWS 上の名前。Task 2・5・6 が data source で引く）: VPC の Name タグ `vpc`、subnet の Tier タグ `public` / `private` / `database`、DB subnet group `vpc`、SG 名と Name タグ `internal`
- Produces（output）: `internal_security_group_id`（`private_trust_security_group_id` を置き換え）

- [ ] **Step 1: テストを書き換える**

`network.tftest.hcl` は既存の `override_module` を使い、`database_subnet_group_name = "vpc"` にする。`variables` から `environment` を外し、`enable_nat_gateway = false` を入れる。run を 2 つにする。

```hcl
run "creates_internal_security_group" {
  command = plan
  # aws_security_group.internal.name == "internal"
  # tags["Name"] == "internal"
  # internal_self: ip_protocol == "-1" && referenced_security_group_id == aws_security_group.internal.id
  # internal_ipv4: ip_protocol == "-1" && cidr_ipv4 == "0.0.0.0/0"
  # internal_ipv6: ip_protocol == "-1" && cidr_ipv6 == "::/0"
  # output.internal_security_group_id == aws_security_group.internal.id
  # EKS discovery タグを持たない（既存 assert を流用）
}

run "network_has_ipv6_egress_without_nat" {
  command = plan
  # aws_vpc_endpoint.s3.tags["Name"] == "vpce-s3"
  # aws_vpc_endpoint.s3.route_table_ids == toset(["rtb-private"])
}
```

module の入力値（`enable_ipv6` など）は `override_module` 下では plan から読めないため、Step 5 の contract script で固定する。

- [ ] **Step 2: テストが落ちることを確認する**

Run: `cd aws/vpc/modules && aqua exec -- tofu init -backend=false -input=false && aqua exec -- tofu test`
Expected: FAIL（`aws_security_group.internal` が未定義）

- [ ] **Step 3: module を変更する**

- `module "vpc"`: `name = "vpc"`、`enable_nat_gateway = var.enable_nat_gateway`、`enable_ipv6 = true`、`create_egress_only_igw = true`、`private_subnet_ipv6_prefixes = [0, 1, 2]`、`private_subnet_assign_ipv6_address_on_creation = true`。`single_nat_gateway = var.single_nat_gateway` と `one_nat_gateway_per_az = false` は残す
- default SG の Name タグ `default-vpc-locked`、S3 endpoint の Name タグ `vpce-s3`
- `aws_security_group.private_trust` → `aws_security_group.internal`（`name = "internal"`、Name タグ `internal`、description `"Shared trust boundary for VPC workloads"`）。rule は `internal_self`・`internal_ipv4`・`internal_ipv6`（`cidr_ipv6 = "::/0"`）
- `variables.tf`: `environment` を削除、`enable_nat_gateway`（`bool`、default なし、description `"Create NAT Gateway(s) for IPv4 egress from private subnets"`）を追加
- `outputs.tf`: `private_trust_security_group_id` → `internal_security_group_id`
- `production/terragrunt.hcl`: `inputs` の `environment` を削除し、`enable_nat_gateway = false` を追加

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd aws/vpc/modules && aqua exec -- tofu fmt -check -recursive && aqua exec -- tofu test`
Expected: PASS（2 passed）

- [ ] **Step 5: module 入力の contract script を追加する**

Create: `aws/vpc/tests/network-contract.sh`（`aws/eks/tests/security-group-contract.sh` と同じく `awk` で `module "vpc"` ブロックを切り出す）。次の行が完全一致で含まれることを検査し、最後に `echo "VPC network contract passed."`。

```
  name = "vpc"
  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  enable_ipv6            = true
  create_egress_only_igw = true
  private_subnet_ipv6_prefixes                   = [0, 1, 2]
  private_subnet_assign_ipv6_address_on_creation = true
```

行の空白は `tofu fmt` 後の実ファイルに合わせる。`public_subnet_ipv6_prefixes` と `database_subnet_ipv6_prefixes` が存在しないことも検査する。

Run: `bash aws/vpc/tests/network-contract.sh`
Expected: `VPC network contract passed.`

- [ ] **Step 6: Commit**

```bash
git add aws/vpc
git commit -s -m "feat(aws/vpc): add IPv6 egress and make NAT optional with environment-free names"
```

### Task 2: platform VPC lookup と EKS 系の参照

**Files:**
- Modify: `aws/vpc/lookup/main.tf`、`aws/vpc/lookup/outputs.tf`
- Delete: `aws/vpc/lookup/variables.tf`
- Rename: `aws/vpc/lookup/tests/private_trust.tftest.hcl` → `aws/vpc/lookup/tests/internal.tftest.hcl`
- Modify: `aws/eks/modules/lookups.tf`、`aws/eks/modules/main.tf`、`aws/eks/modules/tests/private_trust_security_group.tftest.hcl`（ファイル名も `internal_security_group.tftest.hcl` に）、`aws/eks/tests/security-group-contract.sh`
- Modify: `aws/eks-karpenter/modules/lookups.tf`、`aws/eks-karpenter/modules/main.tf`、`aws/eks-karpenter/modules/tests/security_group_attachments.tftest.hcl`、`aws/eks-karpenter/tests/security-group-contract.sh`

**Interfaces:**
- Consumes: Task 1 の AWS 上の名前
- Produces: `module "vpc"`（`source = "../../vpc/lookup"`、入力なし）の出力 `security_groups.internal`、`db_subnet_group`（name `vpc`）、`vpc`、`subnets`

- [ ] **Step 1: lookup のテストを書き換える**

`internal.tftest.hcl`: `override_data` の target を `data.aws_security_group.internal`（`id = "sg-internal"`、`name = "internal"`）、`variables` ブロックを削除。run `finds_internal_security_group` で `data.aws_security_group.internal.vpc_id == data.aws_vpc.this.id` と `output.security_groups.internal.id == "sg-internal"` を検査する。

- [ ] **Step 2: テストが落ちることを確認する**

Run: `cd aws/vpc/lookup && aqua exec -- tofu init -backend=false -input=false && aqua exec -- tofu test`
Expected: FAIL

- [ ] **Step 3: lookup を変更する**

`data.aws_vpc.this` の Name タグ `vpc`、`data.aws_db_subnet_group.this` の name `vpc`、`data.aws_security_group.private_trust` → `internal`（Name タグ `internal`）。出力キー `security_groups.internal`。`variables.tf` を削除。

- [ ] **Step 4: EKS 系の参照を置き換える**

`lookups.tf` 2 つから `environment = var.environment` を削除。`git grep -n "private_trust\|private-trust" -- aws/eks aws/eks-karpenter` の全ヒットを `internal`（`sg-private-trust` は `sg-internal`）に置き換える。テストの run 名・ファイル名の `private_trust` も `internal` に変える（`security-group-contract.sh` の `-filter=` も新ファイル名に）。

- [ ] **Step 5: テストが通ることを確認する**

Run:
```bash
for d in aws/vpc/lookup aws/eks/modules aws/eks-karpenter/modules; do (cd $d && aqua exec -- tofu init -backend=false -input=false >/dev/null && aqua exec -- tofu test) || exit 1; done
bash aws/eks/tests/security-group-contract.sh
bash aws/eks-karpenter/tests/security-group-contract.sh
git grep -n "private_trust\|private-trust" -- aws ':!**/CHANGELOG.md'
```
Expected: 全 test PASS、2 つの contract が passed、最後の grep が 0 件

- [ ] **Step 6: Commit**

```bash
git add aws
git commit -s -m "refactor(aws): look up the shared VPC and the internal security group without environment names"
```

### Task 3: Karpenter EC2NodeClass の SG セレクタ と platform PR

**Files:**
- Modify: `kubernetes/components/karpenter/production/kustomization/ec2nodeclass.yaml:16`
- Modify: `kubernetes/components/karpenter/tests/security-group-selectors.sh:36`

**Interfaces:**
- Consumes: Task 1 の SG Name タグ `internal`

- [ ] **Step 1: テストの期待値を `'      Name: internal'` に変える**

- [ ] **Step 2: テストが落ちることを確認する**

Run: `bash kubernetes/components/karpenter/tests/security-group-selectors.sh`
Expected: FAIL（exit 1）

- [ ] **Step 3: `ec2nodeclass.yaml` のセレクタを `Name: internal` にする**

`aws:eks:cluster-name: eks-production` と `role: Karpenter-eks-production` は別 spec の範囲なので変えない。

- [ ] **Step 4: テストが通ることを確認する**

Run: `bash kubernetes/components/karpenter/tests/security-group-selectors.sh`
Expected: `Security group selector contract passed.`

- [ ] **Step 5: Commit・push・Draft PR**

```bash
git add kubernetes/components/karpenter
git commit -s -m "refactor(kubernetes/components/karpenter): select the internal security group"
git push -u origin HEAD
```

PR 本文は `panicboat/.github` の PR テンプレートに従う。タイトル `feat(aws/vpc): share an IPv6-egress VPC without NAT and drop environment names`。`gh pr create --draft`。CI の hydrator が `kubernetes/manifests/production/karpenter/manifest.yaml` を更新したことを PR の commit で確認する（`Name: internal` が入る）。

### Task 4: monorepo の stack パス規約を `{service}/aws/{environment}` に移す

**Files:**
- Move: `dystopia/monolith/infrastructure/aws` → `dystopia/monolith/aws`
- Move: `dystopia/frontend/infrastructure/aws` → `dystopia/frontend/aws`
- Move: `system-components/pennyworth/infrastructure/aws` → `system-components/pennyworth/aws`
- Modify: `workflow-config.yaml`
- Modify: `dystopia/monolith/README.md`、`dystopia/monolith/README-ja.md`、その他 `git grep -n "infrastructure/aws"` で見つかる README

**Interfaces:**
- Produces: stack のパス `dystopia/monolith/aws/{develop,production}`。state キーは `monorepo/dystopia/monolith/aws/production/terraform.tfstate`

- [ ] **Step 1: `git mv` で 3 つのディレクトリを移す**

移動後に空になる `infrastructure/` ディレクトリは残さない。

- [ ] **Step 2: `workflow-config.yaml` を変える**

`aws` stack の `path` を `"aws/{environment}"` に、`exclude` に `- environment: develop` を追加する。既存のコメント（production の exclude 理由）は残す。

- [ ] **Step 3: README のパスを直す**

`git grep -n "infrastructure/aws" -- ':!**/CHANGELOG.md' ':!docs/superpowers' ':!dystopia/infrastructure'` の全ヒットを新しいパスにする。

- [ ] **Step 4: terragrunt の state キーが新しいパスになることを確認する**

Run: `cd system-components/pennyworth/aws/production && aqua exec -- terragrunt render --format json | jq -r '.remote_state.config.key'`
Expected: `monorepo/system-components/pennyworth/aws/production/terraform.tfstate`

`render` が使えない版なら `terragrunt render-json` を使う。

- [ ] **Step 5: grep が 0 件であることを確認して Commit**

Run: `git grep -n "infrastructure/aws" -- ':!**/CHANGELOG.md' ':!docs/superpowers' ':!dystopia/infrastructure'`
Expected: 0 件

```bash
git add -A dystopia/monolith dystopia/frontend system-components/pennyworth workflow-config.yaml
git commit -s -m "refactor: place terragrunt stacks at {service}/aws/{environment}"
```

### Task 5: monolith のデータ層

**Files:**
- Create: `dystopia/monolith/aws/modules/data.tf`、`rds.tf`、`cognito.tf`、`s3.tf`、`outputs.tf`
- Modify: `dystopia/monolith/aws/modules/terraform.tf`（`random` provider を追加。`required_version` は変えない）
- Modify: `dystopia/monolith/aws/modules/variables.tf`（`domain_name` を追加）
- Modify: `dystopia/monolith/aws/production/env.hcl`・`terragrunt.hcl`（`domain_name = "dystopia.city"` を渡す）。develop も同じ変数を渡す（`domain_name = "develop.dystopia.city"` は使われないが plan の入力を満たすため）
- Create: `dystopia/monolith/aws/modules/tests/data_layer.tftest.hcl`

**Interfaces:**
- Consumes: Task 1 の VPC Name `vpc`、DB subnet group `vpc`、SG Name `internal`
- Produces（output。Task 6 が `dependency.monolith.outputs.<name>` で使う）:
  - `database_host` (string) = `aws_route53_record.monolith_db.fqdn`（`monolith-db.dystopia.local`）
  - `database_port` (number)、`database_name` (string)、`database_username` (string)
  - `database_password` (string, sensitive)
  - `user_pool_id`、`user_pool_arn`、`user_pool_client_id` (string)
  - `media_bucket_name`、`media_bucket_arn` (string)

- [ ] **Step 1: テストを書く**

`data_layer.tftest.hcl`: `mock_provider "aws"`（`aws_caller_identity` の `account_id = "337169763788"`、`aws_vpc` の `id = "vpc-test"`、`aws_security_group` の `id = "sg-internal"`）、`mock_provider "random"`。`variables`: `aws_region = "ap-northeast-1"`、`domain_name = "dystopia.city"`。

```hcl
run "database_is_private_and_shared_through_internal" {
  command = plan
  # aws_db_instance.monolith.identifier == "monolith"
  # publicly_accessible == false && deletion_protection == true && multi_az == false
  # engine_version == "18.6" && instance_class == "db.t4g.micro"
  # db_subnet_group_name == "vpc"
  # vpc_security_group_ids == toset(["sg-internal"])
  # random_password.monolith_db_master.special == false && length == 32
  # aws_route53_record.monolith_db.name == "monolith-db.dystopia.local"
}

run "identity_and_media_names_have_no_environment" {
  command = plan
  # aws_cognito_user_pool.this.name == "dystopia"
  # aws_cognito_user_pool_client.this.name == "dystopia"
  # aws_iam_role.cognito_sms.name == "dystopia-cognito-sms"
  # aws_cognito_user_pool.this.sms_configuration[0].external_id == "dystopia-cognito-sms"
  # aws_cognito_user_pool.this.deletion_protection == "ACTIVE"
  # aws_s3_bucket.media.bucket == "dystopia-media-337169763788"
  # aws_s3_bucket_cors_configuration.media の allowed_origins == ["https://dystopia.city"]
}
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `cd dystopia/monolith/aws/modules && aqua exec -- tofu init -backend=false -input=false && aqua exec -- tofu test`
Expected: FAIL

- [ ] **Step 3: module を書く**

- `data.tf`: `data "aws_vpc" "this"`（Name `vpc`）、`data "aws_db_subnet_group" "vpc"`（name `vpc`）、`data "aws_security_group" "internal"`（vpc_id 制約 + Name `internal`）、`data "aws_caller_identity" "current"`
- `rds.tf`: 現行 `dystopia/lambda/aws/modules/rds.tf` の RDS・`random_password`・private zone・record を移す。identifier `monolith`、`db_subnet_group_name = data.aws_db_subnet_group.vpc.name`、`vpc_security_group_ids = [data.aws_security_group.internal.id]`、private zone の `vpc_id = data.aws_vpc.this.id`。自前の `aws_db_subnet_group` は作らない
- `cognito.tf`: 現行 `cognito.tf` を移し、`local.user_pool_name = "dystopia"`。client の Terraform リソース名を `aws_cognito_user_pool_client.this`、name を `"dystopia"` に
- `s3.tf`: 現行 `s3.tf` を移し、bucket を `"dystopia-media-${data.aws_caller_identity.current.account_id}"`
- `outputs.tf`: Interfaces の Produces どおり。`database_password` に `sensitive = true`
- 既存コメント（パスワードを英数字にする理由など）は移した先でも残す

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd dystopia/monolith/aws/modules && aqua exec -- tofu fmt -check -recursive && aqua exec -- tofu test`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/aws
git commit -s -m "feat(dystopia/monolith/aws): own the database, the user pool and the media bucket"
```

### Task 6: Lambda の実行層をデータ層と platform VPC に載せ替える

**Files:**
- Delete: `dystopia/lambda/aws/modules/network.tf`、`rds.tf`、`cognito.tf`、`s3.tf`
- Create: `dystopia/lambda/aws/modules/data.tf`
- Modify: `dystopia/lambda/aws/modules/lambda.tf`、`cdn.tf:65`、`outputs.tf`、`variables.tf`、`terraform.tf`（`random` provider を削除）
- Modify: `dystopia/lambda/aws/production/terragrunt.hcl`
- Modify: `dystopia/lambda/aws/modules/tests/hosting.tftest.hcl`

**Interfaces:**
- Consumes: Task 5 の output 全て（同名の variable で受ける）、Task 1 の VPC Name `vpc`・Tier `private`・SG Name `internal`
- Produces: 関数名 `dystopia` / `dystopia-task`（Task 7 の workflow が使う）

- [ ] **Step 1: テストを書き換える**

`hosting.tftest.hcl`:
- `mock_provider "aws"` から `aws_vpc`・`aws_security_group`・`aws_cognito_user_pool`・`aws_s3_bucket` の mock と `random` を削除。`override_data` で `data.aws_vpc.this`（`id = "vpc-test"`）、`data.aws_subnets.private`（`ids = ["subnet-a", "subnet-c", "subnet-d"]`）、`data.aws_security_group.internal`（`id = "sg-internal"`）を固定
- `variables` に `database_host = "monolith-db.dystopia.local"`、`database_port = 5432`、`database_name = "monolith"`、`database_username = "postgres"`、`database_password = "TestPassword0123456789"`、`user_pool_id = "ap-northeast-1_test"`、`user_pool_arn = "arn:aws:cognito-idp:ap-northeast-1:337169763788:userpool/ap-northeast-1_test"`、`user_pool_client_id = "test-client"`、`media_bucket_name = "dystopia-media-337169763788"`、`media_bucket_arn = "arn:aws:s3:::dystopia-media-337169763788"`
- run `database_is_private` を削除。run `egress_is_ipv6_only` を `functions_join_the_shared_vpc` に変え、両関数の `vpc_config[0].subnet_ids == toset(["subnet-a", "subnet-c", "subnet-d"])`、`security_group_ids == toset(["sg-internal"])`、`ipv6_allowed_for_dual_stack == true` を検査
- 関数名の期待値を `dystopia` / `dystopia-task` に、`DATABASE_URL` の期待値は現行と同じ `postgres://postgres:TestPassword0123456789@monolith-db.dystopia.local:5432/monolith`
- run `application_function_settings` に `COGNITO_USER_POOL_ID == "ap-northeast-1_test"`、`COGNITO_CLIENT_ID == "test-client"`、`MEDIA_BUCKET_NAME == "dystopia-media-337169763788"` を追加
- run `purge_lists_only_media_keys` の Resource 比較を `var.media_bucket_arn` に
- run `names_have_no_environment` を追加: ロール `dystopia-lambda` / `dystopia-scheduler`、ポリシー `dystopia-lambda-app` / `dystopia-scheduler-invoke-task`、スケジュール `dystopia-purge-deactivated`、ロググループ `/aws/lambda/dystopia` / `/aws/lambda/dystopia-task`、CloudFront comment `dystopia`

- [ ] **Step 2: テストが落ちることを確認する**

Run: `cd dystopia/lambda/aws/modules && aqua exec -- tofu init -backend=false -input=false && aqua exec -- tofu test`
Expected: FAIL

- [ ] **Step 3: module を変更する**

- `data.tf`: `data "aws_vpc" "this"`（Name `vpc`）、`data "aws_subnets" "private"`（vpc-id + Tier `private`）、`data "aws_security_group" "internal"`
- `variables.tf`: Task 5 の output と同名・同型の variable を追加（`database_password` は `sensitive = true`）
- `lambda.tf`: `app_function_name = "dystopia"`、`task_function_name = "dystopia-task"`、IAM・Scheduler の名前を Naming どおりに。`vpc_config` は `subnet_ids = data.aws_subnets.private.ids`、`security_group_ids = [data.aws_security_group.internal.id]`。`database_url` と `shared_environment` の Cognito・S3 の値、IAM ポリシーの ARN を variable から取る
- `cdn.tf`: `comment = "dystopia"`
- `outputs.tf`: `user_pool_id`・`client_id`・`media_bucket_name`・`rds_alias` を削除（データ層の出力になったため）
- `production/terragrunt.hcl`: 

```hcl
dependency "monolith" {
  config_path = "../../../monolith/aws/production"

  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
  mock_outputs = { /* Task 5 の output 全キー。値は hosting.tftest.hcl の variables と同じ */ }
}
```

`inputs` に `database_host = dependency.monolith.outputs.database_host` から `media_bucket_arn` までの 10 個を追加する。

- [ ] **Step 4: テストが通ることを確認する**

Run: `cd dystopia/lambda/aws/modules && aqua exec -- tofu fmt -check -recursive && aqua exec -- tofu test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/lambda/aws
git commit -s -m "feat(dystopia/lambda/aws): run on the shared VPC and the monolith data layer"
```

### Task 7: contract test・deploy workflow・README

**Files:**
- Modify: `dystopia/lambda/aws/modules/tests/contract_test.sh`
- Modify: `.github/workflows/deploy-dystopia-lambda.yaml`
- Modify: `dystopia/lambda/README.md`

**Interfaces:**
- Consumes: Task 6 の関数名、`production/terragrunt.hcl` の `dependency` ブロック

- [ ] **Step 1: contract test を変える**

`assert_count` を `aws_nat_gateway 0`、`aws_internet_gateway 0`、`aws_egress_only_internet_gateway 0`、`aws_vpc 0`、`aws_subnet 0`、`aws_security_group 0`、`aws_db_instance 0`、`aws_cognito_user_pool 0`、`aws_s3_bucket 0`、`aws_vpc_security_group_ingress_rule 0`、`aws_lambda_function_url 1` にする。`../../production/terragrunt.hcl` の `mock_outputs_allowed_terraform_commands` 行が `["init", "validate", "plan"]` と完全一致することを `grep -Fx` で検査し、違えば `Mock outputs must never reach apply.` を出して exit 1。

- [ ] **Step 2: contract test を実行する**

Run: `sh dystopia/lambda/aws/modules/tests/contract_test.sh`
Expected: `Lambda hosting module contract passed.`

- [ ] **Step 3: workflow を変える**

`APP_FUNCTION: dystopia`、`TASK_FUNCTION: dystopia-task`。

Run: `aqua exec -- actionlint .github/workflows/deploy-dystopia-lambda.yaml`（monorepo に actionlint がなければ `lint-actions.yml` が CI で実行するのを PR で確認する）
Expected: エラーなし

- [ ] **Step 4: README を新しい構成に合わせる**

- 「Decisions」の「Terraform の置き場」行: データ層は `dystopia/monolith/aws`、VPC は platform `aws/vpc` にあり、この stack は実行環境だけを持つ、に書き換える。「CI の組み込み方」行の `dystopia/infrastructure` への言及を削除
- 「Layout」の `aws/modules` 行: ECR、Lambda、CloudFront、EventBridge Scheduler。`dystopia/infrastructure` の段落を削除し、「データ層と VPC の出力を受け取る（`production/terragrunt.hcl` の `dependency`）」を追記
- 関数名・ロググループ名・ENI の description フィルタ（`ENI-dystopia*`）を新しい名前に
- 「Teardown」: 削除保護の対象（RDS・user pool・media バケット）はデータ層にあり、この stack の destroy では消えないことを書く

Run: `git grep -n "dystopia-production\|dystopia/infrastructure" -- dystopia/lambda .github`
Expected: 0 件

- [ ] **Step 5: Commit**

```bash
git add dystopia/lambda .github/workflows/deploy-dystopia-lambda.yaml
git commit -s -m "chore(dystopia/lambda): point the deploy and the docs at the layered stacks"
```

### Task 8: EKS 用 stack の削除と monorepo PR

**Files:**
- Delete: `dystopia/infrastructure/`
- Modify: `git grep -n "dystopia/infrastructure"` でヒットする README・docs（`docs/superpowers` と CHANGELOG を除く）

- [ ] **Step 1: `git rm -r dystopia/infrastructure`**

- [ ] **Step 2: 参照を消す**

Run: `git grep -n "dystopia/infrastructure" -- ':!**/CHANGELOG.md' ':!docs/superpowers'`
Expected: 0 件（ヒットした README の記述は、データ層 `dystopia/monolith/aws` への参照に置き換える）

- [ ] **Step 3: 全テストを通す**

Run:
```bash
(cd dystopia/monolith/aws/modules && aqua exec -- tofu test)
(cd dystopia/lambda/aws/modules && aqua exec -- tofu test)
sh dystopia/lambda/aws/modules/tests/contract_test.sh
```
Expected: 全て PASS

- [ ] **Step 4: Commit・push・PR 更新**

```bash
git add -A dystopia
git commit -s -m "chore(dystopia): remove the EKS-only infrastructure stack"
git push
```

PR #1930 のタイトルを `feat(dystopia): split infrastructure into platform, data and runtime layers` に、本文を実装内容に合わせて更新する。platform の PR を「Related Issues and PRs」に載せる。PR の `Plan` job（mock_outputs 使用）が成功することを確認する。

### Task 9: Cutover（実環境）

実行前にユーザーへ開始の確認を取る。各手順の完了条件を満たしてから次へ進む。production の認証は `OrganizationAccountAccessRole`（337169763788）を使う。

- [ ] **Step 1: platform の PR を merge し、VPC を apply する**

Run: `cd platform/aws/vpc/production && aqua exec -- terragrunt apply`
Expected: private subnet 3 つに IPv6 CIDR、private route table に `::/0` → `eigw-*`、`aws ec2 describe-nat-gateways --filter Name=state,Values=available` が空、SG `internal` が存在、`aws ec2 describe-subnets --filters Name=tag:Tier,Values=private` の `EnableDns64` が全て false

- [ ] **Step 2: deploy workflow を止める**

Step 3 から Step 6 の merge までの間に dystopia/frontend・monolith・lambda への変更が main に入ると、deploy workflow が旧コードで実行層を apply するため止めておく。

Run: `gh workflow disable deploy-dystopia-lambda.yaml -R panicboat/monorepo`
Expected: `gh workflow list --all -R panicboat/monorepo` で `Deploy - dystopia Lambda` が `disabled_manually`

- [ ] **Step 3: 旧 stack の削除保護を外し、バケットと ECR を空にする**

```bash
aws rds modify-db-instance --db-instance-identifier monolith-production --no-deletion-protection --apply-immediately
aws cognito-idp update-user-pool --user-pool-id <pool id> --deletion-protection INACTIVE
aws s3 rm s3://dystopia-media-production --recursive
aws ecr batch-delete-image --repository-name dystopia --image-ids "$(aws ecr list-images --repository-name dystopia --query imageIds --output json)"
```
Expected: `describe-db-instances` の `DeletionProtection` が false、`describe-user-pool` の `DeletionProtection` が `INACTIVE`、バケットと ECR が空

`update-user-pool` は指定しない属性を既定値に戻すが、直後に destroy するため影響はない。

- [ ] **Step 4: 旧 stack を destroy する**

main（Task 4〜8 を含まない）の `dystopia/lambda/aws/production` で実行する。

Run: `aqua exec -- terragrunt destroy`
Expected: destroy 成功。ENI 残存で VPC 削除が止まったら README の Teardown のコマンド（description `ENI-dystopia-production*`）で消して再実行

- [ ] **Step 5: データ層を apply する**

monorepo の PR ブランチの `dystopia/monolith/aws/production` で実行する。

Run: `aqua exec -- terragrunt apply`
Expected: `terragrunt output database_host` が `"monolith-db.dystopia.local"`、RDS `monolith` が available

- [ ] **Step 6: deploy workflow を再開し、monorepo の PR を merge する**

Run: `gh workflow enable deploy-dystopia-lambda.yaml -R panicboat/monorepo`
Expected: `gh workflow list -R panicboat/monorepo` で `Deploy - dystopia Lambda` が `active`

workflow が `active` になってから PR を merge する。

Expected: `Deploy - dystopia Lambda` workflow が成功（migration と Verify を含む）。`https://dystopia.city` でサインアップ → 投稿まで通る。CloudTrail の `InitiateAuth` の送信元が新 VPC の IPv6 アドレス

- [ ] **Step 7: pennyworth の state を移す**

```bash
aws s3 cp s3://terragrunt-state-337169763788/monorepo/system-components/pennyworth/infrastructure/aws/production/terraform.tfstate \
          s3://terragrunt-state-337169763788/monorepo/system-components/pennyworth/aws/production/terraform.tfstate
cd system-components/pennyworth/aws/production && aqua exec -- terragrunt plan -detailed-exitcode
```
Expected: exit code 0（差分なし）。確認後に旧キーのオブジェクトを `aws s3 rm` で消す
