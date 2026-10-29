# Release Gated Kubernetes Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monorepo の各サービスの k8s マニフェストをリリースタグから反映し、terragrunt の適用タイミングを `apply_trigger` から「production はリリース、それ以外は merge」の規則に置き換える。

**Architecture:** panicboat/.github の shared workflow を規則ベースにし、リリースのイメージにリリースタグと同じタグを付ける。monorepo は各サービスに GitRepository（`ref.tag`）を置き、ImageUpdateAutomation が `ref.tag` を書き換える。overlay の `image:` は release-please が release PR で書き換える。

**Tech Stack:** GitHub Actions（reusable workflows）、bash / jq / yq、Flux v2.9.6（source / kustomize / image-reflector / image-automation）、kustomize v5.8.3、release-please（`googleapis/release-please-action@v5`）

**Spec:**
- `docs/superpowers/specs/2026-10-28-release-gated-k8s-manifests-design.md`（以下 spec ①）
- `docs/superpowers/specs/2026-10-28-release-environment-rule-design.md`（以下 spec ②）

## Global Constraints

- AGENTS.md（`/Users/takanokenichi/GitHub/panicboat/dotfiles/AGENTS.md`）に従う。コメント・commit message は英語、コメントは 1 行で、タスクや修正への言及を書かない
- commit は `git commit -s`。`Co-Authored-By` を付けない
- GitHub Actions は SHA 固定（各リポジトリの `lint-actions`）
- PR は `gh pr create --draft`。タイトルは英語の Conventional Commits。本文は panicboat/.github の `.github/pull_request_template.md` の構成で、1 文 1 行
- 新規ブランチの初回 push は `git push -u origin HEAD`
- リリースタグの形式は `<service>-vX.Y.Z`。既存のイメージタグ `vX.Y.Z` は変えない
- 規則の環境名は `production`（spec ②）
- monorepo と platform の `exclude: [{environment: production}]` は残す（spec ②）
- `deploy-dystopia-lambda.yaml` は変えない
- PR の merge・release PR の merge はユーザーが行う。plan の実行者は merge しない

## Review Focus

- `apply_trigger` を消した config で、production 以外の環境（develop・master・staging）が main への push で apply され続けること → Task 1 の `test_release_targets_treats_only_production_as_release`、Task 2 の resolver の式のテスト、Task 9・10 の `release-targets.sh --all` の前後比較
- `apply_trigger` が残った config（移行の途中）でも、新しい shared workflow が失敗しないこと → Task 1 の `test_release_targets_ignores_leftover_apply_trigger`
- release-please が overlay の `image:` 行を書き換えるとき、`v` とレジストリのパスが残り、同じファイルの他の行（コメント・別の数字）を変えないこと → Task 6 の dry-run
- `workflow_dispatch` でタグを渡して再 build したときも、リリースタグのイメージタグが付くこと → Task 3 のテスト
- `clusters/production/` の kustomize build が、追加した GitRepository と変えた `sourceRef` 以外で今と同じリソースを出すこと → Task 5 の差分比較

---

## Part 1: panicboat/.github

作業場所: `/Users/takanokenichi/GitHub/panicboat/.github` に worktree `.worktrees/feat-release-environment-rule`（branch `feat/release-environment-rule`、base `origin/main`）を作る。`.git/info/exclude` に `/.worktrees/` がなければ足す。

### Task 1: Release scripts follow the production rule

**Files:**
- Modify: `scripts/terragrunt-release/release-targets.sh`（`select(.value.apply_trigger == "release")` の行）
- Modify: `scripts/terragrunt-release/check-release-configs.sh`（`select(.value.apply_trigger != "release")` の行）
- Delete: `scripts/terragrunt-release/validate-apply-trigger.sh`
- Test: `scripts/terragrunt-release/test.sh`

**Interfaces:**
- Produces: `release-targets.sh <service>|--all [config_path]` と `check-release-configs.sh` は、引数と出力の形を変えずに、環境名 `production` だけをリリースの環境として扱う

- [ ] **Step 1: テストを書き換える**
  - `write_release_config` と各テストの fixture から `apply_trigger:` の行を全部消す
  - `test_validate_*`（4 件）と `test_validate_apply_trigger_rejects_merge_production` を消す
  - 次の 2 件を足す

```bash
test_release_targets_treats_only_production_as_release() {
    write_release_config
    yq -i '(.stacks[] | select(.name == "terragrunt") | .environments.staging) = {"aws_region": "ap-northeast-1"}' workflow-config.yaml
    mkdir -p dystopia/monolith/infrastructure/aws/{develop,staging,production}
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" monolith)"
    assert_eq "production" "$(jq -r 'map(.environment) | join(" ")' <<<"${targets}")"
}

test_release_targets_ignores_leftover_apply_trigger() {
    write_release_config
    yq -i '(.stacks[] | select(.name == "terragrunt") | .environments.develop.apply_trigger) = "release"' workflow-config.yaml
    mkdir -p dystopia/monolith/infrastructure/aws/{develop,production}
    local targets
    targets="$(bash "${script_dir}/release-targets.sh" monolith)"
    assert_eq "production" "$(jq -r 'map(.environment) | join(" ")' <<<"${targets}")"
}
```

  - `check-release-configs.sh` の `exclude-paths` が `production` 以外の環境（staging を足した config で `.../develop` と `.../staging`）になることを、`test_check_configs_accepts_exclude_paths_in_any_order` と同じ書き方で 1 件足す（`test_check_configs_derives_exclude_paths_from_non_production_envs`）

- [ ] **Step 2: テストが落ちることを確認する**

Run: `bash scripts/terragrunt-release/test.sh`
Expected: `FAIL: test_release_targets_lists_release_envs` など、`apply_trigger` を消した fixture を使うテストが FAIL する

- [ ] **Step 3: 2 つのスクリプトの選択条件を環境名にする**
  - `release-targets.sh`: `select(.key == "production")`
  - `check-release-configs.sh`: `select(.key != "production")`
  - `validate-apply-trigger.sh` を `git rm` する
  - 環境名はスクリプトごとに literal で書く（resolver の式はシェルの定数を読めないため、1 か所にまとめない。spec ② の Left to the builder に対する判断）

- [ ] **Step 4: テストが通ることを確認する**

Run: `bash scripts/terragrunt-release/test.sh`
Expected: 全件 `PASS:`、exit 0

- [ ] **Step 5: Commit**

```bash
git add -A scripts/terragrunt-release
git commit -s -m "feat: treat the production environment as the release environment"
```

### Task 2: Workflows follow the production rule

**Files:**
- Modify: `.github/workflows/reusable--label-base-deploy--resolver.yaml`（`Validate apply_trigger` の step と `deploy-terragrunt` の `action-type`、1 行目のコメント）
- Modify: `.github/workflows/reusable--test-terragrunt-release.yaml`（`Validate apply_trigger` の step と 1 行目のコメント）
- Modify: `.github/workflows/reusable--release--plan.yaml`・`reusable--release--deploy.yaml`（1 行目のコメント）
- Test: `scripts/workflows/test.sh`

**Interfaces:**
- Consumes: Task 1 で `validate-apply-trigger.sh` が消えていること

- [ ] **Step 1: テストを書き換える**
  - `test_resolver_applies_only_merge_targets` を `test_resolver_applies_only_non_production_targets` に改名し、期待値を次にする

```bash
local expected="\${{ matrix.target.stack == 'terragrunt' && (github.event_name == 'pull_request' && 'plan' || (matrix.target.environment != 'production' && 'apply' || '')) || '' }}"
```

  - 次を足す

```bash
test_workflows_do_not_read_apply_trigger() {
    assert_eq "" "$(grep -rl 'apply_trigger\|validate-apply-trigger' "${workflows_dir}" "${repo_root}/scripts" || true)"
}
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `bash scripts/workflows/test.sh`
Expected: `test_resolver_applies_only_non_production_targets` と `test_workflows_do_not_read_apply_trigger` が FAIL

- [ ] **Step 3: workflow を書き換える**
  - resolver の `action-type` を Step 1 の式にし、`Validate apply_trigger` の step を消す
  - `reusable--test-terragrunt-release.yaml` の `Validate apply_trigger` の step を消す
  - 4 ファイルの 1 行目のコメントから `apply_trigger: merge` / `apply_trigger: release` をなくし、「production」「non-production」の言葉で書き直す（例: `# Plans a service's production environment on its release-please pull request.`）

- [ ] **Step 4: テストと lint が通ることを確認する**

Run: `bash scripts/workflows/test.sh && bash scripts/terragrunt-release/test.sh && actionlint`
Expected: 全件 `PASS:`、actionlint の出力なし

- [ ] **Step 5: Commit**

```bash
git add .github/workflows scripts/workflows/test.sh
git commit -s -m "feat: apply non-production terragrunt targets on push without apply_trigger"
```

### Task 3: Tag release images with the release tag

**Files:**
- Modify: `.github/workflows/internal--image-builder.yaml`（input と `docker/metadata-action` の `tags`）
- Modify: `.github/workflows/reusable--release--build.yaml`（`detect-component` の output と `container-build` の `with`、1 行目のコメント）
- Test: `scripts/workflows/test.sh`

**Interfaces:**
- Produces: `internal--image-builder.yaml` の input `release-tag`（string、default `''`）。値があると、イメージにその文字列そのままのタグを付ける
- Produces: `reusable--release--build.yaml` の `detect-component` の output `tag`（`<service>-vX.Y.Z`）

- [ ] **Step 1: テストを書く**

```bash
test_release_build_tags_the_release_tag() {
    local build="${workflows_dir}/reusable--release--build.yaml"
    local builder="${workflows_dir}/internal--image-builder.yaml"
    assert_eq '${{ needs.detect-component.outputs.tag }}' "$(yq '.jobs["container-build"].with["release-tag"]' "${build}")"
    assert_eq '${{ steps.parse.outputs.tag }}' "$(yq '.jobs["detect-component"].outputs.tag' "${build}")"
    assert_eq "" "$(yq '.on.workflow_call.inputs["release-tag"].default' "${builder}")"
    grep -qF "type=raw,value=\${{ inputs.release-tag }},enable=\${{ inputs.release-tag != '' }}" "${builder}"
}
```

- [ ] **Step 2: テストが落ちることを確認する**

Run: `bash scripts/workflows/test.sh`
Expected: `FAIL: test_release_build_tags_the_release_tag`

- [ ] **Step 3: 実装する**
  - `internal--image-builder.yaml`: input `release-tag`（`required: false`、`type: string`、`default: ''`）を足し、`tags` の最後に Step 1 の `type=raw` 行を足す
  - `reusable--release--build.yaml`: `Parse tag` step で `tag=$TAG` も `GITHUB_OUTPUT` に出し、`detect-component.outputs.tag` と `container-build.with.release-tag` に渡す
  - 1 行目のコメントを、リリースの版とリリースタグの両方でタグ付けする内容にする

- [ ] **Step 4: テストと lint が通ることを確認する**

Run: `bash scripts/workflows/test.sh && actionlint`
Expected: 全件 `PASS:`、actionlint の出力なし

- [ ] **Step 5: Commit**

```bash
git add .github/workflows scripts/workflows/test.sh
git commit -s -m "feat: tag release images with the release tag"
```

### Task 4: Publish panicboat/.github

- [ ] **Step 1: README・docs に `apply_trigger` の説明が残っていないか確認し、あれば規則の説明に直して commit する**

Run: `grep -rn "apply_trigger" README.md .github scripts`
Expected: 出力なし（`docs/superpowers/` の過去の spec / plan は履歴なので触らない）

- [ ] **Step 2: push して Draft PR を作る**
  - `git push -u origin HEAD`、`gh pr create --draft`（タイトル例: `feat: decide release environments by name and tag release images with the release tag`）
  - 本文の Systems & Operations に、monorepo と platform が参照を更新して `apply_trigger` を消すこと、`apply_trigger` が残っていても動くことを書く

- [ ] **Step 3: ユーザーに PR と release PR の merge を依頼し、リリースを待つ**
  - 完了条件: `gh release view --repo panicboat/.github` で新しい版（例: `v3.2.0`）が出ている
  - その版の commit SHA を `gh api repos/panicboat/.github/git/ref/tags/<version> --jq .object.sha` で取り、以降のタスクで `<NEW_SHA>` / `<NEW_VERSION>` として使う

---

## Part 2: monorepo ①（branch `feat/release-gated-k8s-manifests`、PR #1835）

作業場所: `/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/feat-release-gated-k8s-manifests`

### Task 5: Read each service from its release tag

**Files（3 サービス: `dystopia/monolith`・`dystopia/frontend`・`system-components/pennyworth`）:**
- Modify: `clusters/production/<product>/<service>/service.yaml`
- Modify: `clusters/production/<product>/<service>/image-policy.yaml`
- Modify: `clusters/production/<product>/<service>/image-automation.yaml`

**Interfaces:**
- Produces: GitRepository `monorepo-<service>`（namespace `flux-system`）。`spec.ref.tag` の行に `# {"$imagepolicy": "flux-system:<service>:tag"}`
- Produces: ImageUpdateAutomation の `update.path` は `./clusters/production/<product>/<service>`

- [ ] **Step 1: 変更前の build 結果を保存する**

Run: `kubectl kustomize clusters/production > <scratchpad>/before.yaml`
Expected: exit 0

- [ ] **Step 2: 3 サービスの `service.yaml` を書き換える**
  - spec ① の Flux sources の形で GitRepository を先頭に足す（`interval: 5m`、`url`・`provider`・`secretRef` は platform の `kubernetes/clusters/production/repositories/monorepo.yaml` の GitRepository `monorepo` と同じ値）
  - `ref.tag` の初期値は各サービスの最新のリリースタグ（`git tag -l '<service>-v*' --sort=-v:refname | head -1`。作成時点で `monolith-v0.8.0`・`frontend-v0.10.0`・`pennyworth-v1.1.0`）
  - Kustomization の `sourceRef.name` を `monorepo-<service>` にする

- [ ] **Step 3: image-policy と image-automation を書き換える**
  - `filterTags.pattern`: `'^<service>-v(?P<version>\d+\.\d+\.\d+)$'`（`extract: '$version'` と semver の policy は今のまま）
  - `update.path`: `./clusters/production/<product>/<service>`
  - `messageTemplate`: `chore(<service>): deploy {{range .Changed.Changes}}{{ println .NewValue }}{{end}}`

- [ ] **Step 4: build 結果を比べる**

Run: `kubectl kustomize clusters/production > <scratchpad>/after.yaml && diff <scratchpad>/before.yaml <scratchpad>/after.yaml`
Expected: 差分は、GitRepository 3 件の追加、Kustomization 3 件の `sourceRef.name`、ImagePolicy 3 件の `pattern`、ImageUpdateAutomation 3 件の `update.path` と `messageTemplate` だけ

- [ ] **Step 5: 目印の位置を確かめる**

Run: `grep -rn 'imagepolicy' clusters/production/{dystopia/monolith,dystopia/frontend,system-components/pennyworth}`
Expected: 3 件で、どれも `tag: <service>-vX.Y.Z # {"$imagepolicy": "flux-system:<service>:tag"}` の行

- [ ] **Step 6: Commit**

```bash
git add clusters/production
git commit -s -m "feat: deploy each service from its release tag"
```

### Task 6: Let release-please bump the overlay images

**Files:**
- Modify: `dystopia/monolith/kubernetes/overlays/production/{deployment,migrate-job,purge-deactivated-cronjob}.yaml`
- Modify: `dystopia/frontend/kubernetes/overlays/production/deployment.yaml`
- Modify: `system-components/pennyworth/kubernetes/overlays/production/deployment.yaml`（`image:` 行 2 つ）
- Modify: `dystopia/monolith/release-please-config.json`・`dystopia/frontend/release-please-config.json`・`system-components/pennyworth/release-please-config.json`

- [ ] **Step 1: `image:` 行の目印を置き換える**
  - `# {"$imagepolicy": "flux-system:<service>"}` → `# x-release-please-version`（6 行）

- [ ] **Step 2: `extra-files` を足す**
  - 各 package に `"extra-files": [{"type": "generic", "path": "kubernetes/overlays/production/<file>"}, ...]`（パスは package からの相対。上の Files の overlay を全部）

- [ ] **Step 3: 目印が残っていないことを確かめる**

Run: `grep -rn 'imagepolicy' dystopia/*/kubernetes system-components/*/kubernetes; grep -rc 'x-release-please-version' dystopia/*/kubernetes/overlays/production system-components/*/kubernetes/overlays/production | grep -v ':0'`
Expected: 1 つ目は出力なし。2 つ目は monolith の 3 ファイルが各 1、frontend が 1、pennyworth が 2

- [ ] **Step 4: Commit して push する**

```bash
git add dystopia system-components
git commit -s -m "feat: bump the overlay images in the release pull requests"
git push --force-with-lease
```

- [ ] **Step 5: release-please の dry-run で書き換えを確かめる**

Run（3 サービスそれぞれ）:
`npx -y release-please@17 release-pr --dry-run --token "$(gh auth token)" --repo-url panicboat/monorepo --target-branch feat/release-gated-k8s-manifests --config-file <package>/release-please-config.json --manifest-file <package>/release-please-manifest.json`
Expected: 出力の更新ファイルに overlay のファイルが入り、`image:` 行が `ghcr.io/panicboat/monorepo/<service>:v<次の版> # x-release-please-version` になる。他の行は変わらない
（release-please の版は `googleapis/release-please-action@v5` が使う版に合わせる。dry-run が使えない場合は、その旨と理由を報告して次に進む）

### Task 7: Describe the release gated deploy in the README

**Files:**
- Modify: `README.md`（`## 🚢 Deployment` の Pipeline Flow の図、Trigger の表の `Release - Build` の行、Stacks の表の `kustomize` 行、Versioning、GitOps）

- [ ] **Step 1: 書き換える**
  - Pipeline Flow: `Main --> Flux` を残し、Flux がサービスの overlay をリリースタグから読むことが分かる辺にする（例: `Published -->|tag| Flux`）
  - Trigger / Stacks / Versioning: Release - Build がイメージに `vX.Y.Z` と `{service}-vX.Y.Z` のタグを付けること。`kustomize` の On release published を「Flux applies the overlay at the release tag」にする
  - GitOps: image-policy が `{service}-vX.Y.Z` の最新を選び、image-automation が `service.yaml` の `ref.tag` に書くこと。overlay の `image:` は release PR で release-please が書き換えること。ロールバックの手順（`ref.tag` を戻す PR と image-automation の `suspend: true`）
- 既存の README の書き方（英語、相対リンク）に合わせる

- [ ] **Step 2: 確かめる**

Run: `grep -n 'commits that tag into the service' README.md; npx -y @mermaid-js/mermaid-cli@11.4.2 -p <puppeteer config> -i README.md -o <scratchpad>/readme.md`
Expected: 1 つ目は出力なし。2 つ目は図がエラーなく描画される（puppeteer config は `{"executablePath":"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome","headless":"new"}`）

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -s -m "docs: describe the release gated kubernetes deploy"
```

### Task 8: Use the new shared workflows

**Files:**
- Modify: `.github/workflows/*.yaml` と `*.yml` の `panicboat/.github/.github/workflows/...@<sha> # vX.Y.Z`（全件）

**Interfaces:**
- Consumes: Task 4 の `<NEW_SHA>`・`<NEW_VERSION>`

- [ ] **Step 1: 参照を置き換える**

Run: `grep -rl 'panicboat/.github/.github/workflows/' .github/workflows | xargs sed -i '' -E 's#(panicboat/\.github/\.github/workflows/[^@]+)@[0-9a-f]{40} \# v[0-9.]+#\1@<NEW_SHA> \# <NEW_VERSION>#'`

- [ ] **Step 2: 確かめる**

Run: `grep -rh 'panicboat/.github/.github/workflows/' .github/workflows | sed 's/.*@//' | sort | uniq -c && actionlint`
Expected: 1 種類（`<NEW_SHA> # <NEW_VERSION>`）だけ。actionlint の出力なし

- [ ] **Step 3: Commit して push し、PR #1835 の本文を実装に合わせて更新する**

```bash
git add .github/workflows
git commit -s -m "ci: use the shared workflows that tag release images with the release tag"
git push --force-with-lease
```

  - 本文の Summary から「設計書だけ」の記述を外し、Verification に Task 5〜8 の結果を書く

---

## Part 3: monorepo ②（PR #1835 の上に積む）

作業場所: 同じ worktree。`gh stack` で `feat/release-environment-rule` を `feat/release-gated-k8s-manifests` の上に作る（branch ごとの worktree は作らない）。

### Task 9: Drop apply_trigger from monorepo

**Files:**
- Modify: `workflow-config.yaml`（terragrunt stack の `apply_trigger` 2 行）
- Modify: `.github/workflows/label-base-deploy--resolver.yaml`・`test-terragrunt-release.yaml`・`release--plan.yaml`・`release--deploy.yaml`（1 行目のコメント）
- Modify: `README.md`（`apply_trigger` を含む行）

- [ ] **Step 1: 変更前の target を保存する**

Run: `bash <.github の worktree>/scripts/terragrunt-release/release-targets.sh --all > <scratchpad>/monorepo-before.json`
（Task 1 の変更を含む `.github` の worktree のスクリプトを使う）

- [ ] **Step 2: `apply_trigger` を消し、コメントと README を規則の説明にする**
  - README の `apply_trigger: merge` / `apply_trigger: release` は「non-production environments」/「the production environment」の言い方にし、Stacks の表の下の `apply_trigger` の段落は規則の説明 1 文にする

- [ ] **Step 3: 確かめる**

Run: `bash <.github worktree>/scripts/terragrunt-release/release-targets.sh --all | diff <scratchpad>/monorepo-before.json - && bash <.github worktree>/scripts/terragrunt-release/check-release-configs.sh && grep -rn apply_trigger workflow-config.yaml README.md .github`
Expected: diff の出力なし、check は exit 0、grep の出力なし

- [ ] **Step 4: Commit・push して、stack の上段の Draft PR を作る**

```bash
git add workflow-config.yaml README.md .github/workflows
git commit -s -m "ci: decide terragrunt release environments by name"
```

  - `gh stack` で push し、Draft PR を作る（タイトル例: `ci: decide terragrunt release environments by name`）

---

## Part 4: platform ②

作業場所: `/Users/takanokenichi/GitHub/panicboat/platform` に worktree `.worktrees/ci-release-environment-rule`（branch `ci/release-environment-rule`、base `origin/main`）

### Task 10: Drop apply_trigger from platform

**Files:**
- Modify: `workflow-config.yaml`（terragrunt stack の `apply_trigger` 3 行）
- Modify: `.github/workflows/label-base-deploy--resolver.yaml`・`test-terragrunt-release.yaml`・`release--plan.yaml`・`release--deploy.yaml`（1 行目のコメント）と、`panicboat/.github` の参照全件
- Modify: `README.md`（`apply_trigger` を含む行）

- [ ] **Step 1: Task 9 の Step 1〜3 と同じ手順を platform で行う**
  - 参照の置き換えは Task 8 の Step 1〜2 と同じコマンド
  - Expected も Task 9 と同じ（`release-targets.sh --all` の前後で差分なし、check は exit 0、`apply_trigger` の grep は出力なし）

- [ ] **Step 2: Commit・push して Draft PR を作る**

```bash
git add workflow-config.yaml README.md .github/workflows
git commit -s -m "ci: decide terragrunt release environments by name"
git push -u origin HEAD
```

---

## Part 5: Cutover（PR の merge 後）

前提: Task 4 のリリース、PR #1835 と Task 9・10 の PR が merge されている。

### Task 11: Release each service with the new layout

- [ ] **Step 1: 3 サービスの release PR が開いていることを確かめ、ユーザーに merge を依頼する**

Run: `gh pr list --repo panicboat/monorepo --label 'autorelease: pending' --json number,title`
Expected: monolith・frontend・pennyworth の release PR がある（ない場合は、どの package に release 対象の commit が入っていないかを報告する）

- [ ] **Step 2: 各リリースタグの snapshot とイメージを確かめる**

Run（各サービス）: `git fetch --tags && git show <service>-vX.Y.Z:<package>/kubernetes/overlays/production/deployment.yaml | grep image:`
Expected: `image: ghcr.io/panicboat/monorepo/<service>:vX.Y.Z # x-release-please-version`（タグと同じ版）

Run: `gh api "/users/panicboat/packages/container/monorepo%2F<service>/versions" --jq '.[0].metadata.container.tags'`
Expected: `vX.Y.Z` と `<service>-vX.Y.Z` の両方を含む

### Task 12: Point each service at its new release

- [ ] **Step 1: origin/main から branch を切り、3 サービスの `service.yaml` の `ref.tag` を Task 11 のリリースタグにする**

- [ ] **Step 2: 確かめる**

Run: `kubectl kustomize clusters/production | yq 'select(.kind == "GitRepository") | .metadata.name + " " + .spec.ref.tag'`
Expected: `monorepo-monolith monolith-vX.Y.Z` など 3 行が Task 11 のタグと一致

- [ ] **Step 3: Commit・push して Draft PR を作る**

```bash
git commit -s -am "chore: deploy the first releases built for the release tag layout"
git push -u origin HEAD
```

  - 一時 cluster での確認（spec ① の Verification の一時 cluster の項目）は、この plan の範囲外。確認に入るときに cluster の作り方を決める
