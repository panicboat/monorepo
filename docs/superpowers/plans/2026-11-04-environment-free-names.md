# Environment-free Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EKS 系 stack・kubernetes component・GCP の表示名とディレクトリ・dotfiles の `eks-login` から環境名を外し、Loki・Mimir・Tempo の保持期限をバケット全体に効かせる。

**Architecture:** platform は名前を固定値にし、名前にしか使っていない `environment` 入力を消す。参照側（lookup・kubernetes values・スクリプト・dotfiles）を同じ名前に揃える。稼働中は GCP の stack だけで、state を新しいキーへコピーしてから merge する。

**Tech Stack:** OpenTofu 1.12.6、Terragrunt 1.0.2（aqua）、`terraform-aws-modules/eks`・`s3-bucket` 5.17.0、Helmfile・kustomize、bash

**Spec:** `docs/superpowers/specs/2026-11-04-environment-free-names-design.md`

## Global Constraints

- 名前は spec の「Naming」の対応表どおり。`aws/github-oidc-auth` は変更しない
- コマンドは aqua 経由: `aqua exec -- tofu ...`、`aqua exec -- terragrunt ...`
- 実 AWS・GCP への plan / apply、変更系の CLI は Task 8 でのみ行う
- コードコメントは 1 行で Why not だけ。タスクや変更への言及をしない
- ドキュメントは見出し英語・本文日本語。CHANGELOG と `docs/superpowers/` は変更しない
- commit は `git commit -s`。`Co-Authored-By` を付けない。本文末尾に `Claude-Session: https://claude.ai/code/session_01N1XYRqYgvhvUhTt3pt1Ygu`
- 完了時の grep（各リポジトリ、CHANGELOG と `docs/superpowers/` を除く）が 0 件: `eks-production`・`Karpenter-eks-production`・`eks-admin-production`・`google-oauth-production`・`bucketPathPrefix`・`eks-${`・`eks-admin-${`・`Karpenter-eks-${`・`eks-${env}-`

## Review Focus

- 参照元と参照先の片方だけが変わる（例: ロール名を変えたが kubernetes の ARN が旧名）→ Task 4 の grep と、各 task のテストで名前を固定
- ライフサイクルルールの対象が空のまま「全オブジェクト」にならない（filter の書き方次第で何も消えない）→ Task 3 のテストで filter を固定
- GCP の stack を移した PR の CI plan が「作成」になる（state のコピー漏れ）→ Task 8 Step 1 で plan の差分なしを完了条件にする
- `eks/lookup` の入力を消したのに、呼び出し側が `environment` を渡し続けて plan が `Unsupported argument` で落ちる → Task 1 で 6 つの呼び出し元を全て直し、各 module で `tofu validate`
- dotfiles の `eks-login` が develop 用の分岐を失う → Task 7 で `_env` によるアカウント・リージョン選択を残す

---

## Repositories and branches

| リポジトリ | worktree | ブランチ | Task |
|---|---|---|---|
| platform | `/Users/takanokenichi/GitHub/panicboat/platform/.worktrees/refactor-environment-free-names` | `refactor/environment-free-names` | 1〜5 |
| monorepo | `/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/refactor-environment-free-names` | 同上 | 6 |
| dotfiles | `/Users/takanokenichi/GitHub/panicboat/dotfiles/.worktrees/refactor-environment-free-names` | 同上 | 7 |

---

### Task 1: EKS クラスタと lookup

**Files:**
- Modify: `aws/eks/modules/main.tf`、`addons.tf`、`iam_admin.tf`、`variables.tf`
- Modify: `aws/eks/production/terragrunt.hcl`（`environment` 入力を消す場合）
- Modify: `aws/eks/lookup/main.tf`、Delete: `aws/eks/lookup/variables.tf`
- Modify: `aws/{eks-holmesgpt,eks-karpenter,eks-logs,eks-metrics,eks-secrets,eks-traces}/modules/lookups.tf`（`module "eks"` の `environment` を削除）
- Test: `aws/eks/lookup/tests/security_groups.tftest.hcl`、`aws/eks/modules/tests/internal_security_group.tftest.hcl`

**Interfaces:**
- Produces: クラスタ名 `eks`、ロール `eks-ebs-csi`・`eks-alb-controller`・`eks-external-dns`・`eks-cilium-operator`・`eks-admin`。`module "eks" { source = "../../eks/lookup" }` は入力なし

- [ ] **Step 1: テストに名前の assert を足す**

lookup のテスト: `variables` から `environment` を外し、`data.aws_eks_cluster.this.name == "eks"`（lookup の data source 名に合わせる）を検査する run を足す。eks module のテスト: `module.eks` の入力を読めない場合は、`aws_iam_role` などのルートリソースの `name` を検査する（`eks-admin`、`eks-ebs-csi` など、ルートで作るものだけ）。

- [ ] **Step 2: RED を確認**

Run: `for d in aws/eks/lookup aws/eks/modules; do (cd $d && aqua exec -- tofu init -backend=false -input=false >/dev/null && aqua exec -- tofu test) ; done`
Expected: FAIL

- [ ] **Step 3: 名前を固定値にし、`environment` を消す**

`iam_admin.tf` の cluster ARN も `cluster/eks`。`var.environment` が名前以外で使われていなければ `variables.tf` から削除し、テストの `variables` と `production/terragrunt.hcl` の inputs からも消す。6 つの `lookups.tf` の `module "eks"` から `environment = var.environment` を削除する。

- [ ] **Step 4: GREEN と validate**

Run:
```bash
for d in aws/eks/lookup aws/eks/modules; do (cd $d && aqua exec -- tofu test) || exit 1; done
for d in aws/eks-holmesgpt aws/eks-karpenter aws/eks-logs aws/eks-metrics aws/eks-secrets aws/eks-traces; do (cd $d/modules && aqua exec -- tofu init -backend=false -input=false >/dev/null && aqua exec -- tofu validate -no-color) || exit 1; done
bash aws/eks/tests/security-group-contract.sh
```
Expected: 全て PASS / `Success!`

- [ ] **Step 5: Commit** `refactor(aws/eks): name the cluster and its roles without the environment`

### Task 2: Karpenter・ESO・HolmesGPT

**Files:**
- Modify: `aws/eks-karpenter/modules/main.tf`、`aws/eks-secrets/modules/main.tf`、`aws/eks-holmesgpt/modules/main.tf`、各 `variables.tf`・`production/terragrunt.hcl`（`environment` が不要になる場合）
- Test: `aws/eks-karpenter/modules/tests/security_group_attachments.tftest.hcl`、`aws/eks-karpenter/tests/*.sh`

**Interfaces:**
- Consumes: Task 1 の `module "eks"`（入力なし）
- Produces: `Karpenter-eks`（ノードロールと割り込みキュー）、`eks-system-critical`、`eks-eso`、`eks-holmesgpt`

- [ ] **Step 1: karpenter のテストに `node_iam_role_name == "Karpenter-eks"`（読める形で）と system-critical の名前の assert を足す。module 入力が読めない場合は contract script（`aws/eks-karpenter/tests/security-group-contract.sh` と同じ形）で `main.tf` の行を固定する**
- [ ] **Step 2: RED を確認**（`tofu test` または contract script が FAIL）
- [ ] **Step 3: 名前を固定値にし、不要になった `environment` を削除**
- [ ] **Step 4: GREEN**: `aws/eks-karpenter/modules` の `tofu test`、`aws/eks-karpenter/tests/*.sh`、`aws/eks-secrets/modules`・`aws/eks-holmesgpt/modules` の `tofu validate` が成功
- [ ] **Step 5: Commit** `refactor(aws): name the karpenter, ESO and HolmesGPT resources without the environment`

### Task 3: Loki・Mimir・Tempo のロールと保持期限

**Files:**
- Modify: `aws/{eks-logs,eks-metrics,eks-traces}/modules/main.tf`、`outputs.tf`（`bucket_path_prefix` を削除）、`variables.tf`・`production/terragrunt.hcl`（`environment` が不要になる場合）
- Create: `aws/{eks-logs,eks-metrics,eks-traces}/modules/tests/storage.tftest.hcl`

**Interfaces:**
- Consumes: Task 1 の `module "eks"`
- Produces: ロール `eks-loki`・`eks-mimir`・`eks-tempo`（`eks-${local.service_name}`）、ライフサイクルルール id `retention` がバケット全体に効く

- [ ] **Step 1: テストを書く**

各 module に `mock_provider "aws"`（`aws_caller_identity` の `account_id = "337169763788"`）と `override_module`（`module.eks` の lookup）で plan する run を 1 つ作り、次を検査する。
- Pod Identity 用ロールの名前が `eks-<service>`
- `module.s3` に渡すライフサイクルルールの id が `retention` で、filter に prefix がない（または空文字）

`module.s3` の入力が plan で読めない場合は、lifecycle の値を `local` に出してそれを検査する。

- [ ] **Step 2: RED を確認**
- [ ] **Step 3: 実装**

`id = "retention"`。filter は `terraform-aws-modules/s3-bucket` 5.17.0 の `lifecycle_rule` の実装（`.terraform/modules/s3/main.tf`）を読み、バケット全体を対象にする書き方にする（例: `filter = {}`）。`bucket_path_prefix` 出力を削除する。

- [ ] **Step 4: GREEN**: 3 module の `tofu fmt -check -recursive` と `tofu test` が成功
- [ ] **Step 5: Commit** `fix(aws): expire every Loki, Mimir and Tempo object and drop the environment path prefix`

### Task 4: kubernetes・スクリプト・文書

**Files:**
- Modify: `kubernetes/components/{aws-load-balancer-controller,external-dns,karpenter,opentelemetry-collector,tempo,loki,mimir}/production/*`、`kubernetes/helmfile.yaml.gotmpl`、`kubernetes/components/karpenter/tests/security-group-selectors.sh`、`kubernetes/README.md`
- Modify: `scripts/eks-lifecycle/**`、`aws/eks/README.md`、`Makefile`
- Rename: `docs/runbooks/eks-production-recreate.md` → `docs/runbooks/eks-recreate.md`（内容の名前も直す）

**Interfaces:**
- Consumes: Task 1〜3 の名前

- [ ] **Step 1: karpenter の selector テストの期待値を `aws:eks:cluster-name: eks` に変え、RED を確認**

Run: `bash kubernetes/components/karpenter/tests/security-group-selectors.sh` → FAIL

- [ ] **Step 2: kubernetes の値を「Naming」どおりに直す**

`bucketPathPrefix` はキーごと削除し、Mimir の `storage_prefix` と Tempo の `prefix` の行も削除する。`kubernetes/manifests` は編集しない。

- [ ] **Step 3: スクリプトと文書を直す**

`scripts/eks-lifecycle` の `eks-${ENV}`・`eks-admin-${ENV}` は `eks`・`eks-admin`（`ENV` がアカウント選択に使われている箇所は残す）。README の EKS ログイン手順は `eks-login`（dotfiles の zsh 関数、`! eks-login`）を使う形にする。runbook を rename し、`Makefile` と README の参照を直す。

- [ ] **Step 4: 検証**

Run:
```bash
bash kubernetes/components/karpenter/tests/security-group-selectors.sh
for c in aws-load-balancer-controller external-dns karpenter opentelemetry-collector tempo loki mimir; do (cd kubernetes/components/$c/production && aqua exec -- helmfile -f helmfile.yaml template >/dev/null) || echo "FAIL $c"; done
bash -n scripts/eks-lifecycle/lib/*.sh
git grep -n -e 'eks-production' -e 'Karpenter-eks-production' -e 'eks-admin-production' -e 'bucketPathPrefix' -e 'eks-${' -e 'eks-admin-${' -e 'Karpenter-eks-${' -e 'eks-${env}-' -- ':!**/CHANGELOG.md' ':!docs/superpowers/**' ':!kubernetes/manifests/**'
```
Expected: selector テスト passed、helmfile template が全て成功（chart 取得にネットワークが要る。失敗した component は理由を報告）、`bash -n` が成功、grep が 0 件

- [ ] **Step 5: Commit** `refactor: point kubernetes, scripts and docs at the environment-free EKS names`

### Task 5: GCP のディレクトリと platform PR

**Files:**
- Move: `gcp/google-oauth-production` → `gcp/google-oauth`
- Modify: `gcp/google-oauth/project.hcl`（`project_name = "google-oauth"`）、`gcp/google-oauth/project/Makefile`

- [ ] **Step 1: `git mv` と表示名の修正**
- [ ] **Step 2: state キーを確認**

Run: `cd gcp/google-oauth/project/master && aqua exec -- terragrunt render --format json | jq -r '.remote_state.config.key'`（STS の読み取りのみ）
Expected: `platform/gcp/google-oauth/project/master/terraform.tfstate`

`dependency "workload_identity"` の相対パス（`../../../github-actions-master/...`）が移動後も解決することを `render` の成功で確認する。

- [ ] **Step 3: 全体の grep**: Global Constraints の grep が platform で 0 件（`kubernetes/manifests` は hydrator の更新待ちなので除外）
- [ ] **Step 4: Commit・push・Draft PR**

Commit `refactor(gcp): name the OAuth project directory without the environment`。`git push -u origin HEAD`。PR タイトル `refactor: drop environment names from the EKS stacks and the GCP OAuth project`。本文は `panicboat/.github` のテンプレートに従い、1 文 1 行。「What Else Is Affected」に「merge 前に GCP の state を新しいキーへコピーする」「merge 後に GCP の表示名を変える」を書く。Related に monorepo と dotfiles の PR を載せる（作成後に追記）。CI の hydrator が `kubernetes/manifests` を更新したことを確認する。

### Task 6: monorepo の configmap と PR

**Files:**
- Modify: `dystopia/monolith/kubernetes/overlays/production/configmap.yaml:6`

- [ ] **Step 1: `MEDIA_BUCKET_NAME: dystopia-media-337169763788` にする**
- [ ] **Step 2: 検証**: `aqua exec -- kustomize build dystopia/monolith/kubernetes/overlays/production | grep MEDIA_BUCKET_NAME` が新しい値
- [ ] **Step 3: Commit・push・Draft PR**

Commit `fix(dystopia/monolith/kubernetes): point the media bucket at the account-scoped name`。`git push -u origin HEAD`。PR は spec と plan を含む。タイトル `refactor: drop environment names from the remaining EKS and GCP names`。本文はテンプレートに従う。

### Task 7: dotfiles の eks-login と PR

**Files:**
- Modify: `.script/eks-login.sh`

- [ ] **Step 1: 名前を固定する**

`_role_arn` を `arn:aws:iam::${_account_id}:role/eks-admin`、`update-kubeconfig --name` を `eks` にする。`_env` の case（アカウント・リージョン選択）は残す。ヘッダーコメントの `eks-admin-${env}` も `eks-admin` にする。

- [ ] **Step 2: 検証**

Run: `bash -n .script/eks-login.sh && git grep -n 'eks-admin-\|eks-\${' -- .script .zshrc`
Expected: 構文 OK、grep 0 件

- [ ] **Step 3: Commit・push・Draft PR**

Commit `fix(eks-login): use the environment-free EKS cluster and admin role names`。`git push -u origin HEAD`。dotfiles のテンプレート（なければ `panicboat/.github`）に従い Draft PR を作る。

### Task 8: Cutover（実環境）

実行前にユーザーへ開始の確認を取る。

- [ ] **Step 1: GCP の state を新しいキーへコピーする**

```bash
aws s3 cp s3://terragrunt-state-559744160976/platform/gcp/google-oauth-production/project/master/terraform.tfstate \
          s3://terragrunt-state-559744160976/platform/gcp/google-oauth/project/master/terraform.tfstate
```
platform PR の CI を再実行する。Expected: `gcp/google-oauth/project/master` の plan が差分なし

- [ ] **Step 2: 3 つの PR を merge する**（platform → monorepo → dotfiles）。Expected: platform の main で AWS の terragrunt apply が走らない（production は exclude）。GCP の apply は差分なし
- [ ] **Step 3: GCP の表示名を変える**: `gcloud projects update panicboat-platform-auth --name=google-oauth`（再認証が要ればユーザーに `! gcloud auth login` を依頼）。Expected: `gcloud projects describe panicboat-platform-auth --format='value(name)'` が `google-oauth`
- [ ] **Step 4: 旧キーの state を削除する**: `aws s3 rm s3://terragrunt-state-559744160976/platform/gcp/google-oauth-production/project/master/terraform.tfstate`
