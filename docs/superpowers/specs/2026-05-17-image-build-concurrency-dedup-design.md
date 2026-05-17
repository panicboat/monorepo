# Image Build Concurrency Deduplication Design

## Overview

release-please PR をマージした瞬間、main push event と release event がほぼ同時に発火し、`auto-label--deploy-trigger.yaml` の Deploy Container job と `auto-release--trigger.yaml` の container-build job が **同一 commit / 同一 service の Docker image を並列ビルド** する。GHA cache (`cache-to: type=gha,mode=max`) は時間差なしの並列 push で衝突 / race し、両 build が cold cache 相当のまま完了する。結果、PR #627 で導入した BuildKit cache mounts (apt + bundle) が本来の効果を発揮できない。

本 spec は GitHub Actions の `concurrency` 機能で同 commit / 同 service の image build job を直列化し、先発の build が GHA cache に push してから後発が pull する形にして cache hit を成立させる。

## Goal

- 並列 build を解消し、release-please PR マージ時の build シナリオで:
  - 1 つ目 (先発、典型的には main push 経由): cold cache 相当 (~13 分)
  - 2 つ目 (後発、典型的には release event 経由): **warm cache** で 1-3 分
- 合計 build 時間 (壁時計): 26 分並列 → 14-16 分直列 に短縮
- ARM runner 利用時間: 同 build を 2 回走らせる重複を排除しないが、後発が cache hit で短縮される分だけ削減

## Scope

### In scope

- `.github/workflows/auto-label--deploy-trigger.yaml` の `deploy-container` job に `concurrency` block 追加
- `.github/workflows/auto-release--trigger.yaml` の `container-build` job 経由で渡される `concurrency` を `reusable--container-builder.yaml` 側で受けるか、caller 側で適用するかの判断
- `concurrency` group key の設計: `image-build-${service}-${sha}`

### Out of scope

- 並列 build 自体の根本廃止 (= 改善案 B1: `auto-release--trigger.yaml` に main push tag 生成も統合) — 設計複雑度が高く、本 spec の範囲では小さく確実な変更に留める
- 並列 build を活かしたまま cache を共有する別 backend (例: `cache-to: type=registry,ref=ghcr.io/.../buildcache`) — GHA cache backend は維持
- self-hosted runner / buildjet 等 runner 変更
- `auto-label--deploy-trigger.yaml` の terragrunt / kubernetes job への concurrency 設定 (image build とは独立で並列維持してよい)

## Current State

### 観測 (2026-05-17 の release-please PR #625 / #626 マージ時)

| Build | Workflow | Event | Duration |
|---|---|---|---|
| run 25988472145 | `auto-label--deploy-trigger.yaml` Deploy Container (monolith) | push (main) | 13m16s |
| run 25988475429 | `auto-release--trigger.yaml` container-build | release (monolith) | 13m08s |

両者とも同 commit `a71ec202` の同 Dockerfile を build。並列実行で GHA cache が race し、cold cache 相当のまま完了。改修後の BuildKit cache mounts は機能しなかった。

参考: PR #627 単独 CI build (single run): 13m03s。並列 build と同等。

### 並列 build が起きる契機

`release-please` が `chore(main): release ...` PR をマージすると:

1. main に **push event** 発火 → `auto-label--deploy-trigger.yaml` 起動 → Deploy Container job
2. release-please workflow が tag + GitHub Release を作成 → **release event** 発火 → `auto-release--trigger.yaml` 起動 → container-build job

これらが同一 commit (= release-please PR のマージ commit) を対象に並列で走る。通常の main commit (release-please PR でないもの) は 1 のみ起動するため並列にはならない。

## Target Architecture

### `concurrency` block の追加

両 workflow の image build job に同一 group key を設定し、`cancel-in-progress: false` で queueing。

```yaml
# .github/workflows/auto-label--deploy-trigger.yaml の deploy-container job
jobs:
  deploy-container:
    name: 'Deploy Container (${{ matrix.target.service }})'
    needs: deploy-trigger
    if: ${{ ...既存条件... }}
    strategy:
      matrix:
        target: ${{ fromJson(needs.deploy-trigger.outputs.targets) }}
    concurrency:
      group: image-build-${{ matrix.target.service }}-${{ github.sha }}
      cancel-in-progress: false
    uses: ./.github/workflows/reusable--container-builder.yaml
    with: { ... }
    secrets: { ... }
```

```yaml
# .github/workflows/auto-release--trigger.yaml の container-build job
jobs:
  container-build:
    needs: detect-component
    concurrency:
      group: image-build-${{ needs.detect-component.outputs.service }}-${{ github.sha }}
      cancel-in-progress: false
    uses: ./.github/workflows/reusable--container-builder.yaml
    with: { ... }
    secrets: { ... }
```

### Group key 設計

`image-build-${service}-${sha}`

- `service` 単位で隔離: monolith と frontend の build は独立に並列可能 (= 異なる group なので互いに block しない)
- `sha` (commit SHA) 単位で隔離: 別 commit の build は別 group なので並列可能 (= 連続する main push の build が直列化されると throughput が落ちる、これを防ぐ)
- 同 commit / 同 service の build のみ直列化 (= 今回の問題ケース、release-please PR マージ時の重複)

### `cancel-in-progress: false`

queueing する (= 後発を cancel しない、待たせる)。release event の build を cancel すると semver tag が生成されないため、必ず待つ。

### 動作シナリオ (release-please PR マージ時)

1. main push 発火 → Deploy Container job 起動 (latest / sha / actor tag を生成)
2. release event 発火 → container-build job が起動するが、concurrency group 衝突で **queued**
3. 1 完了 → GHA cache push 完了
4. 2 開始 → GHA cache pull → BuildKit cache mounts が warm hit → 1-3 分で完了 + semver tag 生成

通常の main commit (release event なし) では Deploy Container job のみ起動し、concurrency による待ち合わせは発生しない (= group が単独)。

## Component Design

### A. `auto-label--deploy-trigger.yaml` の修正

`deploy-container` job (matrix で `Deploy Container (${{ matrix.target.service }})` を起動する) に `concurrency` block を追加。

該当箇所のみの diff:

```diff
   deploy-container:
     name: 'Deploy Container (${{ matrix.target.service }})'
     needs: deploy-trigger
     if: |
       needs.deploy-trigger.outputs.has-targets == 'true' &&
       contains(needs.deploy-trigger.outputs.targets, '"stack":"docker"')
     strategy:
       matrix:
         target: ${{ fromJson(needs.deploy-trigger.outputs.targets) }}
+    concurrency:
+      group: image-build-${{ matrix.target.service }}-${{ github.sha }}
+      cancel-in-progress: false
     uses: ./.github/workflows/reusable--container-builder.yaml
     with:
       image-name: ${{ matrix.target.service }}
       working-directory: services/${{ matrix.target.service }}/workspace
       app-id: ${{ vars.APP_ID }}
     secrets:
       private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

(`if:` 条件と `strategy.matrix` の現状は既存通り保持)

### B. `auto-release--trigger.yaml` の修正

`container-build` job に同 group key で `concurrency` block を追加。

```diff
   container-build:
     needs: detect-component
+    concurrency:
+      group: image-build-${{ needs.detect-component.outputs.service }}-${{ github.sha }}
+      cancel-in-progress: false
     uses: ./.github/workflows/reusable--container-builder.yaml
     with:
       image-name: ${{ needs.detect-component.outputs.service }}
       working-directory: services/${{ needs.detect-component.outputs.service }}/workspace
       app-id: ${{ vars.APP_ID }}
       semver-tag: ${{ needs.detect-component.outputs.version }}
     secrets:
       private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

### C. `reusable--container-builder.yaml` は変更なし

reusable workflow 自体は concurrency を持たず、caller の job 単位で concurrency が効く。reusable workflow を call する job が異なる workflow 由来でも、同一 group なら直列化される (GitHub Actions の concurrency 仕様)。

## Risks and Mitigations

| Risk | 緩和策 |
|---|---|
| `cancel-in-progress: false` で queueing するが、release event の build が長時間 (= 先発が遅い場合) 待たされて user 体感が悪化 | 通常 build は 13 分以内に完了。release event の build は warm cache で 1-3 分なので、最悪 13+1=14 分の合計時間 (現状の並列 13 分より長いが、再現性のある cache hit と引き換え) |
| concurrency group key の `service` が matrix の `${{ matrix.target.service }}` で取れない場合 | matrix context の参照は GitHub Actions で deeply supported。`needs.deploy-trigger.outputs.targets` が JSON array で各要素に `service` を含んでいる前提を維持 |
| 別 commit の build が後から来ても並列実行できる (= group key に sha 含む) ため、release event flow と通常 main push が干渉しない | 設計通り。リスクなし |
| 既存の concurrency block (`group: deploy-trigger-${{ ... }}`) と衝突 | 既存 concurrency は workflow level で `deploy-trigger-${event}-${PR}` という別 group。新規 job level concurrency は別。GitHub Actions では workflow level と job level の concurrency は両立 (= AND 条件) |
| terragrunt / kubernetes job が image build に依存していて、image build が queued の間 block される | 現状の deploy-container job は terragrunt / kubernetes と独立 (依存関係なし、matrix 並列)。image build の queueing は他 job に影響しない |
| 仮に並列 build が必要な将来シナリオ (例: 同 commit で複数 image を別々に build したい) | group key に `${{ matrix.target.service }}` を含むので service ごとに独立。同 service の build のみ直列化される |

## Verification

### 期待 (PR マージ後の次回 release-please PR マージ時)

1. release-please PR (例: `monolith-v0.3.0`) のマージ commit が main に push
2. `auto-label--deploy-trigger.yaml` Deploy Container (monolith) job が先に起動 (~ 開始)
3. `auto-release--trigger.yaml` container-build job が次に起動 → concurrency 衝突で `queued` 表示
4. 2 が完了 (~13 分後)
5. 3 が開始 → GHA cache pull → cache mounts hit → 1-3 分で完了 + `:v0.3.0` tag 生成

### 計測コマンド

```bash
# 直近の auto-label--deploy-trigger.yaml と auto-release--trigger.yaml の同 commit run を取得
COMMIT=<release-please マージ commit SHA>
gh api repos/panicboat/monorepo/actions/runs?head_sha=${COMMIT} \
  --jq '.workflow_runs[] | select(.name | test("Auto Label - Deploy Trigger|Auto Release - Trigger")) | {id, name, event, status, conclusion, created_at}'

# それぞれの container-build job の Build and push Docker image step の timing
gh api repos/panicboat/monorepo/actions/runs/<run_id>/jobs \
  --jq '.jobs[] | select(.name | contains("container-build") or contains("Deploy Container")) | .steps[] | select(.name == "Build and push Docker image") | {started_at, completed_at, conclusion}'
```

期待値:
- 先発 build: 13 分前後 (cold)
- 後発 build: **1-3 分** (warm cache hit)

両方が 13 分なら本 spec の効果が出ていない (= concurrency group 設計または cache 機構の別問題)。

## Implementation Order

1 PR で完結:

1. `.github/workflows/auto-label--deploy-trigger.yaml` の `deploy-container` job に `concurrency` block 追加
2. `.github/workflows/auto-release--trigger.yaml` の `container-build` job に `concurrency` block 追加
3. actionlint で両 workflow を静的検証
4. `chore(ci):` で commit、draft PR 作成
5. PR の CI で 1 つの build が走ることを確認 (release event はないので並列にはならない)
6. PR を Ready & マージ
7. **本 PR のマージ自体では効果検証できない** (= release-please PR でないため release event が発火しない)。次回の release-please PR マージで初めて検証可能
8. 次回 release-please PR マージで上記 Verification のコマンドで build 時間を計測

## Notes

- `concurrency` は GitHub Actions の標準機能で、追加コスト / dependency なし
- 本 spec の効果は次回の release-please PR マージで初めて観測される (= 単独 PR では並列が起きない)
- 本 spec の変更で `auto-release--trigger.yaml` 単独の release event 起動 (= 通常のリリースフロー) には影響なし (= 並列が起きない場合は concurrency 衝突しない)
