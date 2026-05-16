# Release-Driven Flux Deploy Design

## Overview

monorepo の monolith / frontend の production deploy を、現状の「main push → `latest` tag + digest reflection で Flux auto-bump」から、**release-please tag (`monolith-vX.Y.Z` / `frontend-vX.Y.Z`) を起点に semver image を build/push し、Flux ImageUpdateAutomation で production cluster に反映する semver-driven deploy** に切り替える。

panicboat 全体の Phase 2 (Release published 起動の production deploy) のうち、monorepo 編。platform 編は保留中。

## Goal

release-please workflow が tag `monolith-v0.X.Y` / `frontend-v0.X.Y` を発行した瞬間を「production リリース意思決定」の確定点とし、その tag に対応する Docker image (`ghcr.io/panicboat/monorepo/{monolith,frontend}:v0.X.Y`) を build → push → Flux pickup → production rollout、までを自動化する。

## Scope

### In scope

- `.github/workflows/auto-release--trigger.yaml` (新規): release event + workflow_dispatch で起動、tag をパースして service / version を出力、container-build を呼び出す
- `.github/workflows/reusable--container-builder.yaml` (修正): release event 時に semver tag (`vX.Y.Z`) を生成する `type=semver` を tags に追加
- `clusters/production/services/{monolith,frontend}/image-policy.yaml` (修正): `^latest$` filter + digest reflection を semver filter + semver policy に置換
- `clusters/production/services/{monolith,frontend}/image-automation.yaml` (修正): `update.path` を overlay 限定に変更
- `services/{monolith,frontend}/kubernetes/base/deployment.yaml` (修正): `:latest` と Setters annotation を削除、image 行はタグなしのベース値に
- `services/{monolith,frontend}/kubernetes/overlays/production/deployment.yaml` (新規): image tag (`v0.1.0` 初期値) + Setters annotation を持つ strategic merge patch
- `services/{monolith,frontend}/kubernetes/overlays/production/kustomization.yaml` (修正): patches に上記 deployment patch を追加

### Out of scope

- production EKS cluster の構築 / 設定 (`platform` リポで別途進行中)
- monolith terragrunt の Release tag 連動 (= app + infra を 1 release で揃える話。Phase 2.5 等で別 spec)
- platform の Release published 起動 production deploy (Phase 2 platform 編、保留中)
- staging / develop 環境 (現状存在しない、将来追加する際は同パターンで拡張可能な設計)
- Flux GitRepository / Kustomization 等のソース管理基盤 (既存を流用)

## Current State

- monorepo の cluster 構成は `clusters/production/` 一本 (PR #621 で develop / staging を collapse 済)
- `clusters/production/services/{monolith,frontend}/` に ImageRepository / ImagePolicy / ImageUpdateAutomation が配置済 (PR #621 で develop から移行)
- ImagePolicy は `filterTags.pattern: '^latest$'` + `digestReflectionPolicy: Always` で、`latest` tag の digest 変化を継続的に追跡
- `base/deployment.yaml` の image 行は `:latest # {"$imagepolicy": "flux-system:monolith"}` で Setters annotation を持つ
- `overlays/production/` は configmap / external-secret / kustomization のみで、deployment patch は持たない
- release-please は稼働済、`monolith-v0.1.0` / `frontend-v0.1.0` tag + GitHub Release (published) を Phase 1 で発行済

## Target Architecture

```
1. Developer merges feat/fix PR to main
2. release-please workflow creates per-component release PR (monolith / frontend 別)
3. Developer merges release-please PR
4. release-please tags monolith-vX.Y.Z (+ frontend) + publishes GitHub Release
5. auto-release--trigger.yaml fires on release: published
   - detect-component job: tag を分解 (monolith-v0.1.0 → service=monolith, version=v0.1.0)
   - container-build job: reusable--container-builder.yaml を call
6. reusable--container-builder.yaml が docker build + push
   - tags: latest / sha / pr / actor (既存) + vX.Y.Z (release event 時のみ、新規)
7. Flux ImageRepository が ghcr.io をスキャン (interval: 5m)
8. Flux ImagePolicy が semver filter (`^v\d+\.\d+\.\d+$`) で最新を pickup (policy: semver, range: >=0.0.0)
9. Flux ImageUpdateAutomation が overlays/production/deployment.yaml の image tag 行を新 semver に書き換え、main に commit/push
10. Flux Kustomization が production cluster に apply → kubelet pull → rollout
```

主要ポイント:

- 1-4 は既存 (release-please workflow)、変更なし
- 5 は **新規** (`auto-release--trigger.yaml`)
- 6 は **修正** (`reusable--container-builder.yaml` の tags 拡張)
- 7 は既存 (ImageRepository は変更なし)
- 8 は **修正** (ImagePolicy の filter + policy 切替)
- 9 は **修正** (ImageUpdateAutomation の `update.path` を overlay 限定に + Setters annotation の所在を base から overlay に移動)
- 10 は既存

並行する既存フロー (維持):

- main push → reusable--container-builder.yaml で `latest` tag + commit SHA tag を build/push
- これらは Flux からは見えない (semver filter で除外される)
- 開発者の手動 pull / ローカル検証用に残す

## Delay Characteristics

Release published から production rollout までの最悪遅延:

- ghcr.io push: 数分 (container-build job の所要時間に依存)
- Flux ImageRepository scan: 最大 5m (`interval: 5m`)
- Flux ImagePolicy resolve: ImageRepository 更新と同期 (ms オーダー)
- Flux ImageUpdateAutomation rewrite: 最大 30m (`interval: 30m`)
- Flux Kustomization apply: Flux Kustomization controller の interval (通常 1-10m)

合計で最悪 ~45 分の遅延が発生し得る。許容範囲とする (= ひとり運用、緊急性の高い変更は緊急 hotfix の別経路で対応)。

## Component Design

### A. `.github/workflows/auto-release--trigger.yaml` (新規)

汎用 release event trigger。当面は container-build のみだが、将来 terragrunt 等を同 file に追加するか別 workflow にするかは Phase 2.5 で判断 (= 設計を妨げない方向で job を増やす形)。

```yaml
name: 'Auto Release - Trigger'

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag to (re-)build (e.g. monolith-v0.1.0)'
        required: true
        type: string

permissions:
  contents: read
  packages: write

concurrency:
  group: auto-release-trigger-${{ github.event.release.tag_name || inputs.tag }}
  cancel-in-progress: false

jobs:
  detect-component:
    runs-on: ubuntu-latest
    outputs:
      service: ${{ steps.parse.outputs.service }}
      version: ${{ steps.parse.outputs.version }}
    steps:
      - id: parse
        env:
          TAG: ${{ github.event.release.tag_name || inputs.tag }}
        run: |
          # monolith-v0.1.0 → service=monolith, version=v0.1.0
          if [[ ! "$TAG" =~ ^([a-z-]+)-v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
            echo "::error::Tag '$TAG' does not match expected pattern <service>-v<X.Y.Z>"
            exit 1
          fi
          SERVICE="${BASH_REMATCH[1]}"
          VERSION="v${BASH_REMATCH[2]}"
          echo "service=$SERVICE" >> $GITHUB_OUTPUT
          echo "version=$VERSION" >> $GITHUB_OUTPUT

  container-build:
    needs: detect-component
    uses: ./.github/workflows/reusable--container-builder.yaml
    with:
      image-name: ${{ needs.detect-component.outputs.service }}
      working-directory: services/${{ needs.detect-component.outputs.service }}/workspace
      app-id: ${{ vars.APP_ID }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

注: `workflow_dispatch` 経由でも release event 相当の semver tag を生成するために、`reusable--container-builder.yaml` に `inputs.semver-tag` を追加し、`detect-component` job が抽出した `version` をこの input に渡す。`reusable--container-builder.yaml` の `type=semver` は input が非空のときのみ tag を生成する (= main push 経由の呼び出し時は input 未指定で semver tag なし)。

### B. `.github/workflows/reusable--container-builder.yaml` (修正)

`docker/metadata-action` の `tags:` に semver を追加:

```yaml
- name: Extract metadata (tags, labels) for Docker
  id: meta
  uses: docker/metadata-action@030e881283bb7a6894de51c315a6bfe6a94e05cf # v6.0.0
  with:
    images: ghcr.io/${{ github.repository }}/${{ inputs.image-name }}
    tags: |
      type=sha
      type=ref,event=pr
      type=raw,value=latest,enable={{is_default_branch}}
      type=raw,value=${{ github.actor }}
      type=semver,pattern={{raw}},value=${{ inputs.semver-tag }}
```

実装メモ:

- `docker/metadata-action` の `type=semver,event=release` は `github.event.release.tag_name` を自動で読むが、`monolith-v0.1.0` のような component-prefixed tag からは `v0.1.0` を正しく抽出できない (semver パーサが prefix を理解しない)
- そのため `auto-release--trigger.yaml` 側で先に `version` を抽出し、`reusable--container-builder.yaml` の input (`semver-tag`) として渡す
- `reusable--container-builder.yaml` に input `semver-tag` (optional, デフォルト空) を追加。空なら semver tag は生成しない (= main push のときは既存挙動)
- `type=semver,pattern={{raw}},value=${{ inputs.semver-tag }}` で input が空でない時のみ semver tag を生成

### C. `clusters/production/services/{monolith,frontend}/image-policy.yaml` (修正)

monolith (frontend も同様):

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: monolith
  namespace: flux-system
  labels:
    service: monolith
spec:
  imageRepositoryRef:
    name: monolith
  interval: 10m
  filterTags:
    pattern: '^v(?P<version>\d+\.\d+\.\d+)$'
    extract: '$version'
  policy:
    semver:
      range: '>=0.0.0'
```

変更点:

- `digestReflectionPolicy: Always` を削除 (semver tag は immutable、digest 追跡不要)
- `filterTags.pattern` を `^latest$` → `^v(?P<version>\d+\.\d+\.\d+)$` (semver tag のみ match、latest を除外)
- `filterTags.extract: '$version'` を追加 (Flux semver policy は extract された値で比較するため)
- `policy.alphabetical` を `policy.semver.range: '>=0.0.0'` に置換 (semver で最大を pickup、v0 系も拾う)
- コメントは「digest reflection pattern」から「semver tag pattern」に書き換え

### D. `services/{monolith,frontend}/kubernetes/base/deployment.yaml` (修正)

```diff
-          image: ghcr.io/panicboat/monorepo/monolith:latest # {"$imagepolicy": "flux-system:monolith"}
+          image: ghcr.io/panicboat/monorepo/monolith
```

base は環境非依存に保つため、image tag と Setters annotation を削除する。タグなし image 行はそのままだと kustomize build 結果が `:latest` 相当になるが、overlay 側で必ず patch されるため問題ない。

### E. `services/{monolith,frontend}/kubernetes/overlays/production/deployment.yaml` (新規)

strategic merge patch として deployment を上書き、image + Setters annotation を持つ:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monolith
spec:
  template:
    spec:
      containers:
        - name: monolith
          image: ghcr.io/panicboat/monorepo/monolith:v0.1.0 # {"$imagepolicy": "flux-system:monolith"}
```

初期値の `v0.1.0` は Phase 1 で発行済の最新 release tag。以降は Flux ImageUpdateAutomation が新 semver tag に書き換える。

### F. `services/{monolith,frontend}/kubernetes/overlays/production/kustomization.yaml` (修正)

既存 kustomization.yaml に `patches:` セクションを追加 (= deployment.yaml を strategic merge patch として適用):

```yaml
patches:
  - path: deployment.yaml
```

(既存セクションは保持)

### G. `clusters/production/services/{monolith,frontend}/image-automation.yaml` (修正)

```diff
   update:
-    path: ./services/monolith/kubernetes
+    path: ./services/monolith/kubernetes/overlays/production
     strategy: Setters
```

Setters annotation の所在を overlay に移したので、Flux が走査する path も overlay 限定に絞る。base/deployment.yaml に annotation が残らないことが前提。

## Implementation Order

ダウンタイム / ImagePullBackOff を回避するため、2 PR 構成で進める。

### PR 1: workflow 追加 + 検証 (production 挙動には影響なし)

- `reusable--container-builder.yaml` に `inputs.semver-tag` 追加 + `type=semver` 行追加
- `auto-release--trigger.yaml` 新規追加 (release event + workflow_dispatch)
- マージ後、workflow_dispatch で `monolith-v0.1.0` / `frontend-v0.1.0` を input に渡して手動 trigger
- ghcr.io に `ghcr.io/panicboat/monorepo/monolith:v0.1.0` / `frontend:v0.1.0` が push されることを検証

### PR 2: Flux + kustomize の cutover

- `clusters/production/services/{monolith,frontend}/image-policy.yaml` を semver filter + semver policy に変更
- `clusters/production/services/{monolith,frontend}/image-automation.yaml` の `update.path` を overlay 限定に変更
- `services/{monolith,frontend}/kubernetes/base/deployment.yaml` の `:latest` と Setters annotation を削除
- `services/{monolith,frontend}/kubernetes/overlays/production/deployment.yaml` を新規追加 (image: `v0.1.0` + Setters annotation)
- `services/{monolith,frontend}/kubernetes/overlays/production/kustomization.yaml` の patches に追加
- マージ後、Flux ImagePolicy が `v0.1.0` を pickup → ImageUpdateAutomation が overlay の deployment.yaml に最新 semver を書き込み → production rollout を確認

PR を分ける理由: PR 2 を単独でマージすると、ghcr に semver image が無い瞬間に Flux ImagePolicy が match 0 となり、Setters strategy が overlay の image を「タグなし」相当に書き換える事故が発生し得る。PR 1 で先に semver image を ghcr に存在させてから PR 2 で切替える。

## Risks and Mitigations

| Risk | 緩和策 |
|---|---|
| `auto-release--trigger.yaml` の tag パースが component-prefixed tag に対応していない / バグる | PR 1 で workflow_dispatch input を使って動作検証 |
| Flux ImagePolicy の semver filter / extract が期待通り動作しない | PR 2 マージ前に `kubectl get imagepolicy -n flux-system monolith -o yaml` で `status.latestImage` を確認 (semver picked) |
| `:latest` を pull していた kubelet が `:vX.Y.Z` 切替で短時間 ImagePullBackOff | PR 1 完了 (= ghcr に `v0.1.0` 存在) してから PR 2 を出すことで回避 |
| `base/deployment.yaml` のタグなし image 行が kustomize build 結果でデフォルト `latest` に展開され、Setters annotation 不在で Flux が触らない | overlay 側で必ず patch されるため最終 manifest には影響しない。base はあくまで「環境非依存ベース」として保つ |
| ghcr の semver tag を手動削除した場合の挙動 | semver tag は immutable 運用、削除しない (Renovate / 手動とも) |
| workflow_dispatch の input bypass で誤った tag (例: 存在しない release tag) が build される | tag パターン検証 (regex match) を `detect-component` job で実装、不一致なら `::error::` で fail |

## Verification

### PR 1 マージ後

```bash
# workflow_dispatch で過去 release tag を input に渡して手動 trigger
gh workflow run auto-release--trigger.yaml --field tag=monolith-v0.1.0
gh workflow run auto-release--trigger.yaml --field tag=frontend-v0.1.0

# 数分待って、ghcr に semver image が push されたか確認
gh api /users/panicboat/packages/container/monorepo%2Fmonolith/versions \
  --jq '.[].metadata.container.tags[]' | grep '^v0\.1\.0$'
gh api /users/panicboat/packages/container/monorepo%2Ffrontend/versions \
  --jq '.[].metadata.container.tags[]' | grep '^v0\.1\.0$'
```

両方 hit すれば PR 2 に進む。

### PR 2 マージ後

```bash
# 1. Flux ImagePolicy が semver tag を pickup
kubectl get imagepolicy -n flux-system monolith -o jsonpath='{.status.latestImage}'
# 期待: ghcr.io/panicboat/monorepo/monolith:v0.1.0

kubectl get imagepolicy -n flux-system frontend -o jsonpath='{.status.latestImage}'
# 期待: ghcr.io/panicboat/monorepo/frontend:v0.1.0

# 2. overlay の deployment.yaml が image tag を保持 (Setters annotation 通り)
git show origin/main:services/monolith/kubernetes/overlays/production/deployment.yaml | grep image:
# 期待: image: ghcr.io/panicboat/monorepo/monolith:v0.1.0 # {"$imagepolicy": "flux-system:monolith"}

# 3. production cluster の rollout 完了
kubectl rollout status deployment/monolith
kubectl rollout status deployment/frontend
```

### Phase 2 完了の定義

次の release-please cycle で `monolith-v0.2.0` (または `frontend-v0.2.0`) を発行 → `auto-release--trigger.yaml` が release event で自動起動 → ghcr に `v0.2.0` push → Flux pickup → production cluster が `v0.2.0` で動く、を 1 サイクル確認できた時点で完了。

## Future Work (Out of Scope)

- monolith terragrunt の Release tag 連動 (`auto-release--trigger.yaml` に terragrunt job を追加するか別 workflow にするか、Phase 2.5)
- staging 環境を追加する場合の semver tag 戦略 (= pre-release tag `v0.X.Y-rc.N` を staging 向け、`v0.X.Y` を production 向け、など)
- ImageUpdateAutomation の interval 短縮 (現状 30m、もっと早くしたいなら 5m などに)
- platform の Release published 起動 production deploy (Phase 2 platform 編)
