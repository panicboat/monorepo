# release-please Phase 2 Infra Deploy Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monorepo の infrastructure(terragrunt: aws / stripe)への production deploy を、panicboat/platform#886 で確立した「release published が唯一の起点」という設計に揃え、あわせて #1054 以降ライブになっている継続的パイプラインの production 誤爆リスクを止める。

**Architecture:** 既存の `auto-label--deploy-trigger.yaml`(継続的パイプライン)から production を確実に除外し、既存の `auto-release--trigger.yaml`(release published 起点、tag パース済み)を拡張して production への terragrunt apply を追加する。新規 workflow は作らない。root/component の解決は `.github/release-please-config.json` の直接引きとディレクトリ実在チェックのみで行い、hardcode した一覧は一切使わない。

**Tech Stack:**
- 既存 `reusable--terragrunt-executor.yaml`(無変更で再利用)
- `yq`(既に `auto-release--trigger.yaml` で使用中、追加インストール不要)
- `jq`(ubuntu-latest に標準搭載)

**Spec:** `docs/superpowers/specs/2026-09-06-release-please-phase2-deploy-design.md`

## Global Constraints

- production 環境のみが対象。develop は out of scope(未整備のため)
- container(Docker image)deploy の経路、kubernetes stack(Flux image automation)は無変更
- root パターン・component 名・service 名を hardcode した `case` 文や固定一覧は一切使わない。すべて `workflow-config.yaml` / `.github/release-please-config.json` / 実ディレクトリ存在から動的に導出する
- commit は Conventional Commits + `-s`(sign-off)、`Co-Authored-By` は付けない
- worktree: `.claude/worktrees/feat-release-please-phase2-deploy`(作成済み)、branch: `feat/release-please-phase2-deploy`(作成済み、`origin/main` から分岐)
- actionlint は `docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color <file>` で実行する。`auto-label--deploy-trigger.yaml` には無関係な pre-existing diagnostic(`deployment-summary` job の `target-environment` 未定義、127行目付近)が既に存在する — 新規に追加された診断でなければ無視してよい

---

## File Structure

| File | 種別 | 役割 |
|---|---|---|
| `.github/workflows/auto-label--deploy-trigger.yaml` | Modify | `deploy-trigger` job に production 除外フィルタを追加 |
| `.github/workflows/auto-release--trigger.yaml` | Modify | `detect-component` の working-directory 解決を release-please-config.json 直接引きに置き換え、production terragrunt apply の新規 job を追加 |

既存ファイルへの変更はなし(`workflow-config.yaml` の `production` エントリは #1054 で既に有効化済み)。

---

## Task 1: 継続的パイプラインから production を除外する(最優先)

**Files:**
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml`

**Interfaces:**
- 変更なし(既存の `deploy-trigger` job の output を差し替えるのみ、`needs.deploy-trigger.outputs.*` を参照する他 job はそのまま動く)

### Setup

- [ ] **Step 1.1: 現状を確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
grep -n "Filter out production" .github/workflows/auto-label--deploy-trigger.yaml
```

Expected: no output(フィルタステップがまだ存在しないことを確認)

### Implementation

- [ ] **Step 1.2: `deploy-trigger` job に Filter ステップを追加**

`.github/workflows/auto-label--deploy-trigger.yaml` の `deploy-trigger` job を以下のように変更する。

変更前:
```yaml
  deploy-trigger:
    name: 'Deployment Trigger'
    runs-on: ubuntu-latest
    outputs:
      targets: ${{ steps.resolver.outputs.targets }}
      has-targets: ${{ steps.resolver.outputs.has-targets }}
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.0
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - name: Get PR information
        id: pr-info
        uses: jwalton/gh-find-current-pr@f3d61b485d2801773f7a07b2aaa3306bd8f8e653 # v1.3.5
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          state: all
        continue-on-error: true

      - name: Label Resolver
        id: resolver
        uses: panicboat/deploy-actions/label-resolver@0f0a02d87678cf779217ca2056218e2315bc1c61 # refactor/infrastructure-layout (panicboat/deploy-actions#307) — re-point to the v1.3.0 release SHA before merge
        with:
          repository: ${{ github.repository }}
          pr-number: ${{ steps.pr-info.outputs.number }}
          github-token: ${{ steps.app-token.outputs.token }}
          config-path: 'workflow-config.yaml'
```

変更後:
```yaml
  deploy-trigger:
    name: 'Deployment Trigger'
    runs-on: ubuntu-latest
    outputs:
      targets: ${{ steps.filter.outputs.targets }}
      has-targets: ${{ steps.filter.outputs.has-targets }}
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.0
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - name: Get PR information
        id: pr-info
        uses: jwalton/gh-find-current-pr@f3d61b485d2801773f7a07b2aaa3306bd8f8e653 # v1.3.5
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          state: all
        continue-on-error: true

      - name: Label Resolver
        id: resolver
        uses: panicboat/deploy-actions/label-resolver@0f0a02d87678cf779217ca2056218e2315bc1c61 # refactor/infrastructure-layout (panicboat/deploy-actions#307) — re-point to the v1.3.0 release SHA before merge
        with:
          repository: ${{ github.repository }}
          pr-number: ${{ steps.pr-info.outputs.number }}
          github-token: ${{ steps.app-token.outputs.token }}
          config-path: 'workflow-config.yaml'

      - name: Filter out production targets
        id: filter
        env:
          TARGETS: ${{ steps.resolver.outputs.targets }}
        run: |
          set -euo pipefail
          filtered=$(echo "$TARGETS" | jq -c '[.[] | select(.environment != "production")]')
          if [ "$(echo "$filtered" | jq 'length')" -gt 0 ]; then
            echo "has-targets=true" >> "$GITHUB_OUTPUT"
          else
            echo "has-targets=false" >> "$GITHUB_OUTPUT"
          fi
          echo "targets=$filtered" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 1.3: actionlint で検証**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/auto-label--deploy-trigger.yaml
```

Expected: `deployment-summary` job の `target-environment` 未定義(pre-existing、Global Constraints 参照)以外の診断が出ないこと

### Commit

- [ ] **Step 1.4: commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
git add .github/workflows/auto-label--deploy-trigger.yaml
git commit -s -m "$(cat <<'EOF'
fix(ci): exclude production from continuous deploy pipeline

#1054 で workflow-config.yaml の production を有効化したが、
label-resolver は environment を区別しないため、infrastructure/{aws,stripe}
を触る PR が merge されるだけで即座に production へ terragrunt apply が
走る状態になっていた。monorepo は production 以外の environment を持たない
ため、これは platform の github-oidc-auth のような稀な混入ではなく唯一の
デフォルト挙動であり、より緊急度が高い。

panicboat/platform#886 で採用したのと同じ方式(resolver の結果から
production を除外するフィルタ)を適用する。

Spec: docs/superpowers/specs/2026-09-06-release-please-phase2-deploy-design.md
EOF
)"
```

Expected: 1 file changed

> **Note:** この Task は独立して安全にマージ可能。#1054 由来の誤爆リスクを早く止めたい場合は Task 1 単体を先に PR 化してよい。

---

## Task 2: detect-component の working-directory 解決を release-please-config.json 直接引きに置き換える

**Files:**
- Modify: `.github/workflows/auto-release--trigger.yaml`(`detect-component` job のみ)

**Interfaces:**
- Consumes: `.github/release-please-config.json` の `packages` map(既存ファイル、無変更)
- Produces: `detect-component` job の `outputs.working-directory` は変更なし(内部実装だけが変わる。Task 3 はこの output をそのまま使う)

### Setup

- [ ] **Step 2.1: 現状の resolve-dir ステップを確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
grep -n "stack_conventions\[\].root" .github/workflows/auto-release--trigger.yaml
```

Expected: 1行マッチ(現行のディレクトリ probe ループ)

### Implementation

- [ ] **Step 2.2: `resolve-dir` ステップを release-please-config.json 直接引きに置き換え**

`.github/workflows/auto-release--trigger.yaml` の `detect-component` job 内、`Resolve working directory` ステップを以下のように変更する。

変更前:
```yaml
      - name: Resolve working directory
        id: resolve-dir
        env:
          SERVICE: ${{ steps.parse.outputs.service }}
        run: |
          set -euo pipefail
          # workflow-config.yaml が stack convention の source of truth。
          # root を列挙して {service} を展開し、実在するものを採用する。
          while IFS= read -r root_pattern; do
            dir="${root_pattern//\{service\}/$SERVICE}"
            if [ -d "$dir" ]; then
              echo "working-directory=$dir" >> "$GITHUB_OUTPUT"
              exit 0
            fi
          done < <(yq -r '.stack_conventions[].root' workflow-config.yaml)
          echo "::error::No directory found for service '$SERVICE' under any stack_conventions root in workflow-config.yaml"
          exit 1
```

変更後:
```yaml
      - name: Resolve working directory
        id: resolve-dir
        env:
          SERVICE: ${{ steps.parse.outputs.service }}
        run: |
          set -euo pipefail
          # .github/release-please-config.json の packages が component -> path
          # の一次情報(release-please 自身が tag/release 名の生成に使っている)。
          # ディレクトリを probe するより単純かつ確実。
          path=$(yq -r --arg component "$SERVICE" \
            '.packages | to_entries[] | select(.value.component == $component) | .key' \
            .github/release-please-config.json)
          if [ -z "$path" ]; then
            echo "::error::No release-please package found with component '$SERVICE'"
            exit 1
          fi
          echo "working-directory=$path" >> "$GITHUB_OUTPUT"
```

(`detect-component` job の `outputs:` ブロックは変更しない。`working-directory` という output 名・意味は同じまま。)

- [ ] **Step 2.3: actionlint で検証**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/auto-release--trigger.yaml
```

Expected: no output(exit 0)

- [ ] **Step 2.4: 3 component すべてで実際に解決できることを手元で確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
for c in monolith frontend pennyworth; do
  path=$(yq -r --arg component "$c" '.packages | to_entries[] | select(.value.component == $component) | .key' .github/release-please-config.json)
  echo "$c -> $path"
  [ -d "$path" ] && echo "  exists: OK" || echo "  exists: MISSING"
done
```

Expected:
```
monolith -> dystopia/monolith
  exists: OK
frontend -> dystopia/frontend
  exists: OK
pennyworth -> system-components/pennyworth
  exists: OK
```

### Commit

- [ ] **Step 2.5: commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
git add .github/workflows/auto-release--trigger.yaml
git commit -s -m "$(cat <<'EOF'
refactor(ci): resolve component working directory from release-please config

directory probe ループ(stack_conventions.root を1つずつ試して実在確認)
を、.github/release-please-config.json の packages 直接引きに置き換える。
release-please 自身が component -> path の対応として使っている一次情報を
使う方が、実行時のディレクトリ探索より単純かつ確実(同名 service が
複数 root に存在する場合の取り違えも起き得ない)。

Spec: docs/superpowers/specs/2026-09-06-release-please-phase2-deploy-design.md
EOF
)"
```

Expected: 1 file changed

---

## Task 3: release published で production infra へ terragrunt apply する

**Files:**
- Modify: `.github/workflows/auto-release--trigger.yaml`(`resolve-infra-targets` / `deploy-infra` job を追加)

**Interfaces:**
- Consumes: Task 2 で確立した `detect-component` job の `outputs.service` / `outputs.working-directory`
- Produces: `resolve-infra-targets` job の `outputs.targets`(JSON 配列、各要素は `{service, stack_id, working_directory, aws_region, iam_role_apply}`)/ `outputs.has-targets`

### Implementation

- [ ] **Step 3.1: workflow-level permissions に `id-token: write` を追加**

`reusable--terragrunt-executor.yaml`(内部で AWS OIDC role assumption を行う)を呼び出すには `id-token: write` が要る。現状の `auto-release--trigger.yaml` は `contents: read` / `packages: write` のみで、AWS への OIDC 認証権限を持たない(container-build は ghcr.io への push だけなので今まで不要だった)。

変更前:
```yaml
permissions:
  contents: read
  packages: write
```

変更後:
```yaml
permissions:
  contents: read
  packages: write
  id-token: write
```

- [ ] **Step 3.2: `resolve-infra-targets` job を追加**

`.github/workflows/auto-release--trigger.yaml` の `container-build` job の後に、以下を追加する。

```yaml

  resolve-infra-targets:
    name: 'Resolve Production Infra Targets'
    needs: detect-component
    runs-on: ubuntu-latest
    outputs:
      targets: ${{ steps.resolve.outputs.targets }}
      has-targets: ${{ steps.resolve.outputs.has-targets }}
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Resolve
        id: resolve
        env:
          SERVICE: ${{ needs.detect-component.outputs.service }}
          ROOT: ${{ needs.detect-component.outputs.working-directory }}
        run: |
          set -euo pipefail
          aws_region=$(yq '.environments[] | select(.environment == "production") | .stacks.terragrunt.aws_region' workflow-config.yaml)
          iam_role_apply=$(yq '.environments[] | select(.environment == "production") | .stacks.terragrunt.iam_role_apply' workflow-config.yaml)

          # ROOT (例: "dystopia/monolith") の末尾の service 名を "{service}" に
          # 戻して stack_conventions.root のテンプレート形にする。
          root_pattern="${ROOT%"$SERVICE"}{service}"

          targets='[]'
          while IFS=$'\t' read -r stack_name stack_id directory; do
            [ "$stack_name" = "terragrunt" ] || continue
            dir="${directory//\{environment\}/production}"
            full_dir="${ROOT}/${dir}"
            [ -d "$full_dir" ] || continue
            id="${stack_id:-terragrunt}"
            targets=$(echo "$targets" | jq -c \
              --arg service "$SERVICE" \
              --arg stack_id "$id" \
              --arg dir "$full_dir" \
              --arg region "$aws_region" \
              --arg role "$iam_role_apply" \
              '. + [{"service":$service,"stack_id":$stack_id,"working_directory":$dir,"aws_region":$region,"iam_role_apply":$role}]')
          done < <(yq -r --arg root "$root_pattern" '
            .stack_conventions[] | select(.root == $root) | .stacks[] |
            [.name, (.id // ""), .directory] | @tsv
          ' workflow-config.yaml)

          echo "targets=$targets" >> "$GITHUB_OUTPUT"
          if [ "$(echo "$targets" | jq 'length')" -gt 0 ]; then
            echo "has-targets=true" >> "$GITHUB_OUTPUT"
          else
            echo "has-targets=false" >> "$GITHUB_OUTPUT"
          fi

  deploy-infra:
    name: 'Deploy Infra (${{ matrix.target.service }}:${{ matrix.target.stack_id }})'
    needs: resolve-infra-targets
    if: needs.resolve-infra-targets.outputs.has-targets == 'true'
    strategy:
      matrix:
        target: ${{ fromJson(needs.resolve-infra-targets.outputs.targets) }}
      fail-fast: false
    uses: ./.github/workflows/reusable--terragrunt-executor.yaml
    with:
      service-name: ${{ matrix.target.service }}
      environment: production
      action-type: apply
      iam-role: ${{ matrix.target.iam_role_apply }}
      aws-region: ${{ matrix.target.aws_region }}
      working-directory: ${{ matrix.target.working_directory }}
      app-id: ${{ vars.APP_ID }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

- [ ] **Step 3.3: actionlint で検証**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/auto-release--trigger.yaml
```

Expected: no output(exit 0)

- [ ] **Step 3.4: `resolve` ステップのロジックを3 component すべてでローカル実行して検証**

`workflow_dispatch` を実際に起動せず、シェルロジックだけを手元で再現して検証する(GITHUB_OUTPUT の代わりに標準出力へ書く)。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
for entry in "monolith:dystopia/monolith" "frontend:dystopia/frontend" "pennyworth:system-components/pennyworth"; do
  SERVICE="${entry%%:*}"
  ROOT="${entry#*:}"
  echo "=== $SERVICE ($ROOT) ==="
  aws_region=$(yq '.environments[] | select(.environment == "production") | .stacks.terragrunt.aws_region' workflow-config.yaml)
  iam_role_apply=$(yq '.environments[] | select(.environment == "production") | .stacks.terragrunt.iam_role_apply' workflow-config.yaml)
  root_pattern="${ROOT%"$SERVICE"}{service}"
  targets='[]'
  while IFS=$'\t' read -r stack_name stack_id directory; do
    [ "$stack_name" = "terragrunt" ] || continue
    dir="${directory//\{environment\}/production}"
    full_dir="${ROOT}/${dir}"
    [ -d "$full_dir" ] || continue
    id="${stack_id:-terragrunt}"
    targets=$(echo "$targets" | jq -c \
      --arg service "$SERVICE" --arg stack_id "$id" --arg dir "$full_dir" \
      --arg region "$aws_region" --arg role "$iam_role_apply" \
      '. + [{"service":$service,"stack_id":$stack_id,"working_directory":$dir,"aws_region":$region,"iam_role_apply":$role}]')
  done < <(yq -r --arg root "$root_pattern" '
    .stack_conventions[] | select(.root == $root) | .stacks[] |
    [.name, (.id // ""), .directory] | @tsv
  ' workflow-config.yaml)
  echo "$targets" | jq .
done
```

Expected:
- `monolith` → 2要素(`stack_id: "aws"` と `stack_id: "stripe"`、working_directory はそれぞれ `dystopia/monolith/infrastructure/aws/production` と `dystopia/monolith/infrastructure/stripe/production`)
- `frontend` → 1要素(`stack_id: "aws"`、`dystopia/frontend/infrastructure/aws/production`)
- `pennyworth` → 1要素(`stack_id: "terragrunt"`、`system-components/pennyworth/infrastructure/aws/production`)

いずれかが異なれば、`root_pattern` の導出または `workflow-config.yaml` の `stack_conventions` 参照が誤っている。原因を特定してから先に進む。

### Commit

- [ ] **Step 3.5: commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
git add .github/workflows/auto-release--trigger.yaml
git commit -s -m "$(cat <<'EOF'
feat(ci): deploy production infra on release published

release published イベントで、component の production terragrunt
(monolith は aws + stripe、frontend/pennyworth は aws のみ)を apply する。
root/stack の解決は release-please-config.json とディレクトリ実在確認
だけで行い、component や root を hardcode した一覧は持たない。

terragrunt-executor が AWS OIDC role assumption を行うため、workflow-level
permissions に id-token: write を追加した(container-build は ghcr.io
push のみだったため今まで不要だった)。

label-resolver / label-dispatcher は経由しない。同じ理由(deploy:{service}
ラベルが environment を持たず production を意図せず巻き込みうる)で
platform#886 でも同じ判断をした。

Spec: docs/superpowers/specs/2026-09-06-release-please-phase2-deploy-design.md
EOF
)"
```

Expected: 1 file changed

---

## Merge and Verification

- [ ] **Step 4.1: push と PR(draft)作成**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-please-phase2-deploy
git push -u origin HEAD
gh pr create --draft --title "feat(ci): release-please phase 2 — infra production deploy trigger" --body "$(cat <<'EOF'
## Summary

- `auto-label--deploy-trigger.yaml` の継続的パイプラインから production を除外(#1054 以降ライブになっていた誤爆リスクを解消)
- `auto-release--trigger.yaml` の working-directory 解決を release-please-config.json 直接引きに置き換え(ディレクトリ probe を廃止)
- release published イベントで production の terragrunt(aws、monolith のみ stripe も)apply する新規 job を追加
- root/component の解決は hardcode した一覧を使わず、workflow-config.yaml / release-please-config.json / 実ディレクトリ存在のみから動的に導出

## Spec

`docs/superpowers/specs/2026-09-06-release-please-phase2-deploy-design.md`

## Test plan

- [ ] CI(lint-actions / semantic-pull-request)が通る
- [ ] マージ後、infrastructure/{aws,stripe} を触る PR を merge しても production に apply されないことを確認
- [ ] monolith/frontend/pennyworth いずれかの release PR をマージし release published すると、対応する production terragrunt が apply される(monolith は aws + stripe の両方)
- [ ] container build(既存経路)に影響がないことを確認する
EOF
)"
```

Expected: PR URL が出力される

- [ ] **Step 4.2: PR をマージ(ユーザー操作)**

完了の判断: `gh pr view --json state -q .state` が `MERGED` を返す。

- [ ] **Step 4.3: production 誤爆リスクが解消したことを確認**

適当な `infrastructure/` 配下のファイル(例: コメント1行)を変更する PR を作成・マージし、`auto-label--deploy-trigger.yaml` の実行結果で production への apply が発生しないことを確認する。

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh run list --workflow=auto-label--deploy-trigger.yaml --limit 3
```

Expected: 実行された場合でも `deploy-terragrunt` の matrix に `environment: production` が含まれない

- [ ] **Step 4.4: release published からの infra deploy を検証(ユーザー操作、任意タイミング)**

いずれかの component の release PR をマージし release published を待つ:

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh run list --workflow=auto-release--trigger.yaml --limit 3
```

Expected: `resolve-infra-targets` / `deploy-infra` job が成功し、対象 component の production terragrunt が apply される

---

## Notes

- Task 1 は他の Task と独立してマージ可能。#1054 由来の誤爆リスクを早く止めたい場合は Task 1 単体を先に PR 化してよい
- Step 4.2(PR マージ)と Step 4.4(release PR マージ)はユーザー操作
- release-please-config.json の置き場所(monorepo は `.github/` 配下、platform はリポジトリ直下)が2リポジトリで揃っていない点は、本 plan の完了後に別課題として扱う(ユーザーより指摘済み)
