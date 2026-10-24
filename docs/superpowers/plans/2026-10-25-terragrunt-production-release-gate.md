# Terragrunt Production Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monorepo の terragrunt stack で、develop は main merge で、production はアプリのリリース公開で apply されるようにし、workflow の名前・説明と README を platform に揃える。

**Architecture:** platform#1105 の仕組み（環境属性 `apply_trigger`、`.github/scripts/terragrunt-release/` のスクリプト、release PR の plan と release 公開の apply）を monorepo に写す。違いは 3 つ：terragrunt stack の paths が `{product}/{service}/infrastructure/aws/{environment}` であること、release-please を container のリリースにも使うので release 環境のない service を `[]` で成功させること、`terragrunt-shared` を作らないこと。

**Tech Stack:** GitHub Actions、panicboat/deploy-actions v2.0.1、release-please-action v5（release-please 17.6.0）、bash + yq（mikefarah v4）+ jq、Terragrunt / OpenTofu、actionlint

**Spec:** `docs/superpowers/specs/2026-10-25-terragrunt-production-release-gate-design.md`

**Reference implementation:** `/Users/takanokenichi/GitHub/panicboat/platform`（main）の `.github/scripts/terragrunt-release/`、`.github/workflows/{release--plan,release--deploy,label-base-deploy--resolver,reusable--terragrunt-executor,test-terragrunt-release}.yaml`、`aws/github-oidc-auth/release-please-config.json`

## Global Constraints

- commit は `git commit -s`。`Co-Authored-By` を付けない。commit message は英語
- コード内コメントは英語 1 行で Why not だけ。現在のタスクへの言及を書かない。例外は workflow 先頭の説明コメント（ユーザー決定）
- README は見出しが英語、`README-ja.md` の本文は日本語
- GitHub Actions は 40 文字の SHA で固定し `# vX.Y.Z` を付ける。新しい action を足さない（monorepo か platform の既存 workflow にある SHA だけを使う）
- workflow に環境名（`develop`・`production`）を書かない。環境の判定は `apply_trigger` だけで行う
- `apply_trigger` は `merge` か `release`
- release tag は `<service>-vX.Y.Z`、release PR の branch は `release-please--branches--main--components--<service>`
- `.github/workflows/deploy-dystopia-lambda.yaml` は一切変えない（ファイル名・`name`・コメントも含む）
- 新しい依存を足さない。テストは plain bash

## Review Focus

- container だけの service（`frontend`）の release 公開や release PR で、`Release - Plan` / `Release - Deploy` が失敗せず skip されること（Task 3 のテスト）
- `{product}` を含む paths から working directory を求めるとき、`dystopia` と `system-components` の両方で正しいパスになること（Task 3 のテスト。`system-components/pennyworth/infrastructure/aws/production`）
- `check-release-configs.sh` が、release 環境を持たない release-please 設定（frontend）を誤ってエラーにしないこと（Task 4 のテスト）
- この実装 PR を merge すると、`dystopia/monolith/` の変更で `deploy-dystopia-lambda.yaml` の production deploy が走ること（Task 7 で PR description に書く。lambda は不可侵なので止めない）
- 名前を変えた workflow を参照する箇所（README、docs、ci-gatekeeper の除外リスト）が残らないこと（Task 1 の検査）

---

### Task 1: workflow のリネームと説明コメント

**Files:**
- Rename（`git mv`）と `name` の変更：
  - `.github/workflows/auto-label--label-dispatcher.yaml` → `label-base-deploy--dispatcher.yaml`、`name: 'Label Base Deploy - Dispatcher'`
  - `.github/workflows/auto-label--deploy-trigger.yaml` → `label-base-deploy--resolver.yaml`、`name: 'Label Base Deploy - Resolver'`
  - `.github/workflows/release.yml` → `release--please.yaml`、`name: 'Release - Please'`
  - `.github/workflows/auto-release--trigger.yaml` → `release--build.yaml`、`name: 'Release - Build'`
- Modify: `deploy-dystopia-lambda.yaml` 以外の全 workflow（1 行目に説明コメント）
- Modify: README / README-ja / `docs/` 配下（`docs/superpowers/` を除く）のうち旧名を参照する箇所

**Interfaces:**
- Produces: 上記の新しいファイル名。Task 2・5 は新しいファイル名を編集する

- [ ] **Step 1: 旧名の参照を数える**

Run: `git grep -nE 'auto-label--|auto-release--|release\.yml|Auto Label|Auto Release|deploy-trigger|Deployment Trigger' -- . ':!docs/superpowers' ':!.github/workflows/deploy-dystopia-lambda.yaml'`
Expected: 旧ファイル・README・concurrency group・job ID がヒットする（リネーム後に 0 件になることを Step 4 で確かめる）

- [ ] **Step 2: リネームし、`name` と残骸を直す**

- 4 ファイルを `git mv` し、`name` を上の値にする
- concurrency group：`deploy-trigger-…` → `label-base-deploy-resolver-…`、`auto-release-trigger-…` → `release-build-…`
- resolver の最初の job：ID `deploy-trigger` → `resolve`、`name: 'Deployment Trigger'` → `name: 'Resolve Targets'`。`needs.deploy-trigger` と `needs: [deploy-trigger, …]` もすべて `resolve` にする
- `ci-gatekeeper.yaml` の `exclude-workflow-names` などに旧 `name` があれば新しい `name` にする

- [ ] **Step 3: 説明コメントを足す**

`deploy-dystopia-lambda.yaml` 以外の全 workflow の 1 行目に、`# <何をする workflow か>` を英語 1 行で足す。中身はファイルを読んで書く（platform main の各 workflow の 1 行目と同じ書き方）。

- [ ] **Step 4: 検査する**

Run: Step 1 のコマンド、`actionlint`、`git diff --stat -- .github/workflows/deploy-dystopia-lambda.yaml`
Expected: Step 1 は 0 件。actionlint は main と同じ件数（新しいエラーなし）。lambda の diff は空

- [ ] **Step 5: commit する**

```bash
git add -A .github README.md README-ja.md docs
git commit -s -m "ci: name workflows by trigger and role and describe each one"
```

---

### Task 2: スクリプトとテスト基盤

**Files:**
- Create: `.github/scripts/terragrunt-release/{validate-apply-trigger,release-service,release-targets,check-release-configs,test}.sh`（platform の同名ファイルから写して直す）
- Create: `.github/workflows/test-terragrunt-release.yaml`（platform と同じ構成。1 行目に説明コメント）

**Interfaces:**
- Produces:
  - `validate-apply-trigger.sh [config]`：platform と同じ
  - `release-service.sh --tag <tag> | --branch <branch>`：platform と同じ
  - `release-targets.sh <service> [config]`：stack `name: terragrunt` の各 path（`{product}` などの placeholder を含む）に `service` と `apply_trigger: release` の環境を入れ、残りの placeholder を 1 階層のワイルドカードとして存在するディレクトリを探す。見つかった各ディレクトリについて `{service, environment, working_directory, aws_region, iam_role_plan, iam_role_apply}` を出す。stack の `exclude`（rule のキーがすべて一致したら除外。キーは `service`・`environment` と、path から取れた placeholder の値）に一致するものを外す。結果が空でも `[]` を出して exit 0（platform は exit 1）
  - `check-release-configs.sh [config]`：`release-targets.sh` の結果が除外前に 1 件以上ある service は、その service の working directory の `infrastructure/` の親ディレクトリ（`{product}/{service}`）に `release-please-config.json` を持つ。その config の `packages["{product}/{service}"].component` が `{service}`、manifest に `{product}/{service}` キーがある。repo のすべての `*/release-please-config.json` の各 package で、`exclude-paths` が `apply_trigger: merge` の全環境の `{package}/infrastructure/aws/{environment}` と（順序を無視して）一致する。release 環境のない config があってもエラーにしない。release 環境の `aws_region`・`iam_role_*` が空ならエラー。違反は `::error::…` で出して exit 1

- [ ] **Step 1: テストを書く**

platform の `test.sh` の構成（helper、fixture、`test_*` 関数）を写し、monorepo 向けに次のテストを置く。fixture の `workflow-config.yaml` は terragrunt stack の paths を `{product}/{service}/infrastructure/aws/{environment}` にし、`develop`（`apply_trigger: merge`）と `production`（`apply_trigger: release`）を持たせる。

```bash
test_validate_*()                                  # platform と同じ 4 本（受理、未設定、不正値、他 stack は無視）。リポジトリの config は Task 3
test_release_service_*()                           # platform と同じ 6 本
test_release_targets_lists_release_envs()          # dystopia/monolith/infrastructure/aws/{develop,production} → production の 1 件、working_directory "dystopia/monolith/infrastructure/aws/production"
test_release_targets_finds_other_products()        # system-components/pennyworth/infrastructure/aws/production → working_directory "system-components/pennyworth/infrastructure/aws/production"
test_release_targets_returns_empty_without_dirs()  # dystopia/frontend だけ → stdout "[]"、exit 0
test_release_targets_skips_excluded_envs()         # exclude [{environment: production}] → "[]"、exit 0
test_check_configs_accepts_matching_set()          # monolith に infrastructure と config、frontend は config だけ → exit 0、出力なし
test_check_configs_rejects_missing_config()        # pennyworth に production dir があり config がない → exit 1、stderr に "system-components/pennyworth/release-please-config.json"
test_check_configs_rejects_wrong_component()       # monolith の component が "frontend" → exit 1
test_check_configs_rejects_missing_exclude_paths() # exclude-paths がない → exit 1、stderr に 'exclude-paths must be ["dystopia/monolith/infrastructure/aws/develop"] (got null)'
test_check_configs_checks_configs_without_infra()  # frontend の exclude-paths が ["dystopia/frontend/infrastructure/aws/develop"] でない → exit 1
test_check_configs_requires_config_for_excluded_env() # exclude [{environment: production}] でも production dir があれば config が必要
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `bash .github/scripts/terragrunt-release/test.sh`
Expected: スクリプトがない、または platform のままの挙動で、monorepo 向けのテストが FAIL

- [ ] **Step 3: スクリプトを実装し、テストを通す**

Run: `bash .github/scripts/terragrunt-release/test.sh`
Expected: 全テスト PASS

- [ ] **Step 4: CI の workflow を足す**

`test-terragrunt-release.yaml` は `pull_request` と `push: main` で `test.sh` を実行する。`validate-apply-trigger.sh` と `check-release-configs.sh` は Task 4 で足す（リポジトリの config がまだ揃っていないため）。

Run: `actionlint`
Expected: 新しいエラーなし

- [ ] **Step 5: commit する**

```bash
git add .github/scripts/terragrunt-release .github/workflows/test-terragrunt-release.yaml
git commit -s -m "ci: add terragrunt release scripts for product service stacks"
```

---

### Task 3: 環境と paths を宣言し、main merge の apply を絞る

**Files:**
- Modify: `workflow-config.yaml`
- Modify: `.github/workflows/label-base-deploy--resolver.yaml`
- Modify: `.github/workflows/test-terragrunt-release.yaml`
- Modify: `.github/scripts/terragrunt-release/test.sh`

**Interfaces:**
- Consumes: Task 2 の `validate-apply-trigger.sh`
- Produces: `workflow-config.yaml` の terragrunt stack（Task 4・5 が読む）

- [ ] **Step 1: テストを書く**

```bash
test_repository_config_is_valid()               # validate-apply-trigger.sh がリポジトリの workflow-config.yaml で exit 0
test_repository_config_never_merges_production() # terragrunt stack の production.apply_trigger が "release"
test_repository_config_excludes_production()     # terragrunt stack の exclude に {environment: production}
test_repository_terragrunt_paths()               # terragrunt stack の paths が ["{product}/{service}/infrastructure/aws/{environment}"] だけ
test_resolver_applies_only_merge_targets()       # resolver の deploy-terragrunt.with.action-type が下の式と一致
```

action-type の期待値：`${{ matrix.target.stack == 'terragrunt' && (github.event_name == 'pull_request' && 'plan' || (matrix.target.apply_trigger == 'merge' && 'apply' || '')) || '' }}`

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `bash .github/scripts/terragrunt-release/test.sh`
Expected: 追加したテストが FAIL

- [ ] **Step 3: 実装する**

- `workflow-config.yaml` の terragrunt stack：
  - `paths` を `"{product}/{service}/infrastructure/aws/{environment}"` だけにする
  - `develop` を足す：`aws_region: ap-northeast-1`、`iam_role_plan: arn:aws:iam::270242382571:role/github-oidc-auth-develop-github-actions-plan-role`、`iam_role_apply: arn:aws:iam::270242382571:role/github-oidc-auth-develop-github-actions-apply-role`、`apply_trigger: merge`
  - `production` に `apply_trigger: release` を足す
  - `exclude` の `environment: production` は残し、コメントを「release の仕組みを有効にするまで production を除外する」という意味の英語 1 行にする
- resolver：最初の job に `actions/checkout`（既存 SHA）と `bash .github/scripts/terragrunt-release/validate-apply-trigger.sh` を足し、`deploy-terragrunt` の action-type を上の式にする
- `test-terragrunt-release.yaml` に `validate-apply-trigger.sh` の step を足す

Run: `bash .github/scripts/terragrunt-release/test.sh && bash .github/scripts/terragrunt-release/validate-apply-trigger.sh && actionlint`
Expected: test と validate は成功、actionlint は新しいエラーなし

- [ ] **Step 4: deploy-actions の検証を通す**

deploy-actions v2.0.1（`1ab520e5ef33b8d744982762ffc4e08009a34744`）を `git -C /Users/takanokenichi/GitHub/panicboat/deploy-actions archive` で scratch に取り出し、`WorkflowConfig` にリポジトリの `workflow-config.yaml` を読ませる。label-resolver の `GenerateMatrix` に `deploy:monolith` と `deploy:pennyworth` を渡し、target を出す（`FileClient` はリポジトリを指す実装を使う）。

Expected: 検証エラーなし。`deploy:monolith` で `dystopia/monolith/infrastructure/aws/develop` の terragrunt target が出る（Task 5 で dir を作った後に再確認）。production の terragrunt target は出ない

- [ ] **Step 5: commit する**

```bash
git add workflow-config.yaml .github
git commit -s -m "ci: apply develop on merge and keep production for releases"
```

---

### Task 4: release-please の設定

**Files:**
- Modify: `dystopia/monolith/release-please-config.json`、`dystopia/frontend/release-please-config.json`、`system-components/pennyworth/release-please-config.json`
- Modify: `.github/workflows/test-terragrunt-release.yaml`
- Modify: `.github/scripts/terragrunt-release/test.sh`

**Interfaces:**
- Consumes: Task 2 の `check-release-configs.sh`、Task 3 の `workflow-config.yaml`

- [ ] **Step 1: リポジトリで検査が失敗することを確かめる**

Run: `bash .github/scripts/terragrunt-release/check-release-configs.sh`
Expected: exit 1。3 つの config の `exclude-paths` が `null` というエラー

- [ ] **Step 2: 3 つの config を直す**

各 config に、platform の `aws/github-oidc-auth/release-please-config.json` と同じ `changelog-sections` をトップレベルに足す。各 package に `"exclude-paths": ["<package>/infrastructure/aws/develop"]` を足す。既存のキーと値は変えない。`bootstrap-sha` は足さない。

- [ ] **Step 3: CI に検査を足し、通す**

`test-terragrunt-release.yaml` に `check-release-configs.sh` の step を足す。`test.sh` に `test_repository_release_configs_are_valid()`（リポジトリで `check-release-configs.sh` が exit 0）を足す。

Run: `bash .github/scripts/terragrunt-release/check-release-configs.sh && bash .github/scripts/terragrunt-release/test.sh && actionlint`
Expected: すべて成功

- [ ] **Step 4: commit する**

```bash
git add dystopia/*/release-please-config.json system-components/*/release-please-config.json .github
git commit -s -m "ci: release infrastructure chores and skip develop-only changes"
```

---

### Task 5: monolith の空の stack

**Files:**
- Create: `dystopia/monolith/infrastructure/aws/root.hcl`、`modules/terraform.tf`、`develop/{env.hcl,terragrunt.hcl}`、`production/{env.hcl,terragrunt.hcl}`
- Modify: `dystopia/monolith/.dockerignore`（`infrastructure/` を足す）

**Interfaces:**
- Consumes: Task 3 の paths（`{product}/{service}/infrastructure/aws/{environment}`）、Task 4 の `check-release-configs.sh`

- [ ] **Step 1: 既存の stack を読む**

`system-components/pennyworth/infrastructure/aws/` の `root.hcl`・`production/{env.hcl,terragrunt.hcl}`・`modules/terraform.tf` を読み、同じ構成にする。state key は `dystopia/monolith/<environment>/terraform.tfstate`。`modules/` はリソースを持たず、`terraform.tf` の `required_version` と provider は pennyworth と同じにする。

- [ ] **Step 2: 手元で plan する**

Run: `cd dystopia/monolith/infrastructure/aws/develop && AWS_PROFILE=develop terragrunt plan`
Expected: `No changes.`（リソースなし）。state bucket は既存（`terragrunt-state-270242382571`）。plan が state を作るかは terragrunt の挙動に従い、作られても空の state なので残してよい

- [ ] **Step 3: 検査を通す**

Run: `bash .github/scripts/terragrunt-release/check-release-configs.sh && bash .github/scripts/terragrunt-release/release-targets.sh monolith && bash .github/scripts/terragrunt-release/test.sh`
Expected: check は exit 0。`release-targets.sh monolith` は `[]`（production は exclude）。test は全 PASS

- [ ] **Step 4: commit する**

```bash
git add dystopia/monolith/infrastructure dystopia/monolith/.dockerignore
git commit -s -m "feat(dystopia/monolith): add an empty infrastructure stack"
```

---

### Task 6: release PR の plan と release 公開の apply

**Files:**
- Modify: `.github/workflows/reusable--terragrunt-executor.yaml`（任意の入力 `ref` と `github-environment` を足す。platform と同じ）
- Create: `.github/workflows/release--plan.yaml`（`name: 'Release - Plan'`）
- Create: `.github/workflows/release--deploy.yaml`（`name: 'Release - Deploy'`）
- Modify: `.github/scripts/terragrunt-release/test.sh`

**Interfaces:**
- Consumes: Task 2 の `release-service.sh`・`release-targets.sh`

- [ ] **Step 1: テストを書く**

```bash
test_release_workflows_skip_empty_targets()  # release--plan.yaml の jobs.plan.if と release--deploy.yaml の jobs.apply.if が "needs.resolve.outputs.targets != '[]'"
test_release_deploy_declares_environment()   # release--deploy.yaml の jobs.apply.with.github-environment が "${{ matrix.target.environment }}"、with.ref が "${{ needs.resolve.outputs.tag }}"
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `bash .github/scripts/terragrunt-release/test.sh`
Expected: 追加した 2 本が FAIL

- [ ] **Step 3: 実装する**

platform main の `release--plan.yaml` と `release--deploy.yaml` を写し、スクリプトのパスはそのまま、1 行目に説明コメント、concurrency group は `release-plan-…`・`release-deploy-…` にする。executor には platform と同じ `ref`（checkout に渡す）と `github-environment`（job の `environment:` に渡す）を足す。

Run: `bash .github/scripts/terragrunt-release/test.sh && actionlint`
Expected: test は全 PASS、actionlint は新しいエラーなし

- [ ] **Step 4: commit する**

```bash
git add .github
git commit -s -m "ci: plan release environments on release PRs and apply them on publish"
```

---

### Task 7: README

**Files:**
- Modify: `README.md`・`README-ja.md`（`## 🚢 Deployment`）

- [ ] **Step 1: Deployment を書き直す**

- `Mechanics` の `Trigger` を platform main の `### Trigger` と同じ構成にする（イベントの表 + `Targets` + `Releases`）。表の行：PR に `deploy:{service}` ラベルが付く（resolver・plan）、`main` への push（resolver・`apply_trigger: merge` を apply）、release PR の作成・更新（`Release - Plan`）、release の公開（`Release - Build` が image を build、`Release - Deploy` が `apply_trigger: release` を apply）
- `Releases` に、container だけの service は terragrunt の target がなく skip されること、`exclude` 中は plan も apply もされないこと、再実行の方法（`Release - Plan` の「Re-run all jobs」、`gh workflow run release--deploy.yaml --ref {service}-vX.Y.Z -f tag={service}-vX.Y.Z`）を書く
- `Stacks` の terragrunt の行を「PR で plan、main で `apply_trigger: merge` を apply、release で `apply_trigger: release` を apply」にする
- `Versioning` を新しいファイル名に直す
- Pipeline Flow の mermaid を新しい名前と release の流れに直す
- 本文のリンクをプレーンなリンク `[path](path)` にし、リンクになっていない実在のパスもリンクにする（`{service}` を含むパス・複数あるファイル名・コードブロックはコード表記のまま）

- [ ] **Step 2: リンクを検査する**

Run: README の相対リンクがすべて実在するパスを指すことを確かめるスクリプト（platform で使ったもの。`re.findall(r"\]\(([^)]+)\)")` の各 target を `os.path.exists`）
Expected: 壊れたリンクなし

- [ ] **Step 3: commit する**

```bash
git add README.md README-ja.md
git commit -s -m "docs: describe the release gate and link repository paths"
```

---

### Task 8: platform の GitHub environment policy

**Files（`/Users/takanokenichi/GitHub/panicboat/platform` の別 worktree・別 PR）:**
- Modify: `github/repository/master/monorepo.hcl`（`deployment_tag_patterns = ["*-v*"]`）
- Modify: platform の `README.md`・`README-ja.md`（monorepo の `production` の記述）

- [ ] **Step 1: 変更して tftest を通す**

Run: `cd github/repository/modules && tofu init -backend=false -input=false >/dev/null && tofu test`、`tofu fmt -check -recursive github/repository`
Expected: すべて成功

- [ ] **Step 2: commit し、Draft PR を作る（ユーザーと一緒に）**

```bash
git commit -s -m "chore(github/repository): open the monorepo production environment to release tags"
```

---

### Task 9: PR と E2E（ユーザーと一緒に）

- [ ] **Step 1: 全体の検証**

Run: `bash .github/scripts/terragrunt-release/test.sh && bash .github/scripts/terragrunt-release/validate-apply-trigger.sh && bash .github/scripts/terragrunt-release/check-release-configs.sh && actionlint`
Expected: すべて成功（actionlint は main と同じ件数）

- [ ] **Step 2: push して Draft PR を作る**

PR description に、merge で `deploy-dystopia-lambda.yaml` の production deploy が走ること（lambda は不可侵）を書く。

- [ ] **Step 3: PR と merge 後の確認**

spec の Verification の各項目を確かめる。
