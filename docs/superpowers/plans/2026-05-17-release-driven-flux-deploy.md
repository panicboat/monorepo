# Release-Driven Flux Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** release-please tag (`monolith-vX.Y.Z` / `frontend-vX.Y.Z`) を起点に semver image (`ghcr.io/.../monolith:vX.Y.Z`) を build/push し、Flux ImageUpdateAutomation で monorepo の production deploy を自動化する。

**Architecture:** 2 PR 構成。PR 1 で release event 対応の image build workflow を追加し、既存 release tag (`v0.1.0`) を `workflow_dispatch` で再 build して ghcr に semver image を準備する。PR 2 で Flux ImagePolicy を semver filter に切替、`base/deployment.yaml` の Setters annotation を `overlays/production/deployment.yaml` に移動する cutover を行う。PR 順で進めることで `:latest` → `:vX.Y.Z` 切替時の ImagePullBackOff を回避する。

**Tech Stack:**
- GitHub Actions (workflow_call, release event, workflow_dispatch)
- docker/metadata-action@v6.0.0 (`type=semver` with conditional enable)
- Flux v1.x (ImagePolicy semver policy + ImageUpdateAutomation Setters strategy)
- kustomize (base + overlays/production strategic merge patch)

**Reference:**
- Spec: `docs/superpowers/specs/2026-05-17-release-driven-flux-deploy-design.md`

---

## File Structure

| File | Action | Role |
|---|---|---|
| `.github/workflows/auto-release--trigger.yaml` | Create | release event + workflow_dispatch で tag を分解し container-build を call |
| `.github/workflows/reusable--container-builder.yaml` | Modify | `inputs.semver-tag` を追加、`tags:` に `type=semver` 行を追加 (input 非空時のみ enable) |
| `clusters/production/services/monolith/image-policy.yaml` | Modify | `^latest$` filter + digest reflection を semver filter + semver policy に置換 |
| `clusters/production/services/frontend/image-policy.yaml` | Modify | 同上 |
| `clusters/production/services/monolith/image-automation.yaml` | Modify | `update.path` を `./services/monolith/kubernetes/overlays/production` に変更 |
| `clusters/production/services/frontend/image-automation.yaml` | Modify | 同上 (frontend) |
| `services/monolith/kubernetes/base/deployment.yaml` | Modify | Setters annotation を削除 (`:latest` は維持) |
| `services/frontend/kubernetes/base/deployment.yaml` | Modify | 同上 |
| `services/monolith/kubernetes/overlays/production/deployment.yaml` | Create | image: `v0.1.0` + Setters annotation を持つ strategic merge patch |
| `services/frontend/kubernetes/overlays/production/deployment.yaml` | Create | 同上 (frontend) |
| `services/monolith/kubernetes/overlays/production/kustomization.yaml` | Modify | `patches:` に上記 deployment patch を追加 |
| `services/frontend/kubernetes/overlays/production/kustomization.yaml` | Modify | 同上 |

## Common Conventions

- worktree は `monorepo/.claude/worktrees/feat-release-driven-flux-deploy/` (既存、spec / plan の commit が乗っている)
- ブランチ名は `feat/release-driven-flux-deploy` (PR 1 用)、PR 2 用には別 worktree + 別 branch を作成 (Common Conventions A 参照)
- commit メッセージは Conventional Commits + `-s` (sign-off)
- `Co-Authored-By` は付けない
- 初回 push は `git push -u origin HEAD`
- PR は必ず `gh pr create --draft`、タイトルは英語

### A. PR 1 / PR 2 を別 branch / worktree に分ける理由

PR 1 (workflow 追加) と PR 2 (Flux + kustomize cutover) は独立した変更で、レビュー単位を分けたい。spec / plan の commit は PR 1 と同じ branch (`feat/release-driven-flux-deploy`) に乗っているので、これを PR 1 として進める。PR 2 は別 branch (`feat/release-driven-flux-cutover`) を `origin/main` から切る。

---

## PR 1: Image Build Workflow

### Task 1: `reusable--container-builder.yaml` に `semver-tag` input を追加

**Files:**
- Modify: `monorepo/.claude/worktrees/feat-release-driven-flux-deploy/.github/workflows/reusable--container-builder.yaml`

- [ ] **Step 1.1: 既存ファイルを開いて inputs セクションを確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-driven-flux-deploy
head -25 .github/workflows/reusable--container-builder.yaml
```

Expected: `inputs:` セクションに `image-name` / `working-directory` / `app-id` の 3 つが存在。

- [ ] **Step 1.2: `inputs.semver-tag` を追加**

`.github/workflows/reusable--container-builder.yaml` の `inputs:` セクションの末尾 (`app-id` の後) に以下を追加:

```yaml
      semver-tag:
        required: false
        type: string
        default: ''
        description: 'Optional semver tag (e.g. v0.1.0) to add to the built image. Only set when called from release event flow.'
```

- [ ] **Step 1.3: `tags:` セクションに semver 行を追加**

同ファイル中の `Extract metadata` step の `tags:` 末尾に以下を追加:

```yaml
            type=semver,pattern={{raw}},value=${{ inputs.semver-tag }},enable=${{ inputs.semver-tag != '' }}
```

最終形 (該当箇所のみ):

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
            type=semver,pattern={{raw}},value=${{ inputs.semver-tag }},enable=${{ inputs.semver-tag != '' }}
```

- [ ] **Step 1.4: actionlint で workflow を静的検証**

Run:
```bash
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/reusable--container-builder.yaml
```

Expected: no output (exit 0)

docker が使えなければ `actionlint .github/workflows/reusable--container-builder.yaml` (homebrew/aqua 経由) で代替。両方利用不可ならスキップして Step 4.1 (PR 後のレビュー時) で確認。

### Task 2: `auto-release--trigger.yaml` 新規作成

**Files:**
- Create: `monorepo/.claude/worktrees/feat-release-driven-flux-deploy/.github/workflows/auto-release--trigger.yaml`

- [ ] **Step 2.1: ファイル新規作成**

Files: `.github/workflows/auto-release--trigger.yaml`

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
      - name: Parse tag
        id: parse
        env:
          TAG: ${{ github.event.release.tag_name || inputs.tag }}
        run: |
          set -euo pipefail
          if [[ ! "$TAG" =~ ^([a-z-]+)-v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
            echo "::error::Tag '$TAG' does not match expected pattern <service>-v<X.Y.Z>"
            exit 1
          fi
          SERVICE="${BASH_REMATCH[1]}"
          VERSION="v${BASH_REMATCH[2]}"
          echo "service=$SERVICE" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

  container-build:
    needs: detect-component
    uses: ./.github/workflows/reusable--container-builder.yaml
    with:
      image-name: ${{ needs.detect-component.outputs.service }}
      working-directory: services/${{ needs.detect-component.outputs.service }}/workspace
      app-id: ${{ vars.APP_ID }}
      semver-tag: ${{ needs.detect-component.outputs.version }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

- [ ] **Step 2.2: actionlint で workflow を静的検証**

Run:
```bash
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/auto-release--trigger.yaml
```

Expected: no output (exit 0)

docker / homebrew actionlint が使えない場合はスキップ + 報告。

- [ ] **Step 2.3: tag parse ロジックをローカル検証**

Run:
```bash
for TAG in "monolith-v0.1.0" "frontend-v0.1.0" "monolith-v10.20.30" "invalid-tag" "monolith-v1.2"; do
  if [[ "$TAG" =~ ^([a-z-]+)-v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
    echo "$TAG → service=${BASH_REMATCH[1]} version=v${BASH_REMATCH[2]}"
  else
    echo "$TAG → REJECTED"
  fi
done
```

Expected:
```
monolith-v0.1.0 → service=monolith version=v0.1.0
frontend-v0.1.0 → service=frontend version=v0.1.0
monolith-v10.20.30 → service=monolith version=v10.20.30
invalid-tag → REJECTED
monolith-v1.2 → REJECTED
```

### Task 3: PR 1 commit + push + draft PR 作成

- [ ] **Step 3.1: 変更ファイル確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-driven-flux-deploy
git status --short
```

Expected:
```
 M .github/workflows/reusable--container-builder.yaml
?? .github/workflows/auto-release--trigger.yaml
```

(`.github/workflows/auto-release--trigger.yaml` は新規、`reusable--container-builder.yaml` は modify)

- [ ] **Step 3.2: commit**

Run:
```bash
git add .github/workflows/reusable--container-builder.yaml .github/workflows/auto-release--trigger.yaml
git commit -s -m "$(cat <<'EOF'
feat(ci): add release event flow for semver image build

- reusable--container-builder.yaml: add optional 'semver-tag' input and a
  conditional `type=semver` entry that only emits the semver image tag
  when the input is non-empty. main-push callers (no input) keep their
  existing tag set (latest / sha / pr / actor).
- auto-release--trigger.yaml: new workflow fired by `release: published`
  and `workflow_dispatch`. Parses tags like `<service>-v<X.Y.Z>` into
  service + version, then calls reusable--container-builder.yaml with
  the extracted version as 'semver-tag'.

This is PR 1 of the release-driven Flux deploy rollout. PR 2 will switch
Flux ImagePolicy to semver filter and migrate the Setters annotation
from base to overlays/production.

Spec: docs/superpowers/specs/2026-05-17-release-driven-flux-deploy-design.md
EOF
)"
```

Expected: 2 files changed (1 modified, 1 created), commit が作成される

- [ ] **Step 3.3: push と draft PR 作成**

Run:
```bash
git push -u origin HEAD
gh pr create --draft --title "feat(ci): add release event flow for semver image build" --body "$(cat <<'EOF'
## Summary

PR 1 of 2 for the release-driven Flux deploy rollout (spec: \`docs/superpowers/specs/2026-05-17-release-driven-flux-deploy-design.md\`).

- \`reusable--container-builder.yaml\`: add optional \`semver-tag\` input and a conditional \`type=semver\` entry.
- \`auto-release--trigger.yaml\`: new workflow fired by release event and workflow_dispatch. Parses \`<service>-v<X.Y.Z>\` tags and calls the reusable container builder with the extracted version.

This PR does **not** change Flux / kustomize. Production deploy continues to use \`latest\` tag + digest reflection until PR 2 is merged.

## Why this is split into 2 PRs

If Flux ImagePolicy is switched to semver filter before any \`vX.Y.Z\` image exists in ghcr, the ImageUpdateAutomation could rewrite the deployment manifest to an empty / invalid image. PR 1 produces the semver images first via \`workflow_dispatch\`, then PR 2 cuts over Flux + kustomize.

## Test plan

- [ ] CI (lint-actions / semantic-pull-request / CI Gatekeeper) passes
- [ ] After merge, run \`gh workflow run auto-release--trigger.yaml --field tag=monolith-v0.1.0\` and verify \`ghcr.io/panicboat/monorepo/monolith:v0.1.0\` is pushed
- [ ] Same for \`frontend-v0.1.0\`
- [ ] Existing main-push builds still produce \`latest\` / \`sha-xxx\` tags only (no semver tag)

## Spec

\`docs/superpowers/specs/2026-05-17-release-driven-flux-deploy-design.md\`
EOF
)"
```

Expected: PR URL が出力される

### Task 4: PR 1 マージ + workflow_dispatch 検証 (monolith)

- [ ] **Step 4.1: PR 1 マージ (ユーザー操作)**

ユーザーが PR 1 をレビュー & マージする。

完了の判断: `gh pr view <PR番号> --json state -q .state` が `MERGED`。

- [ ] **Step 4.2: workflow_dispatch で `monolith-v0.1.0` を build**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh workflow run auto-release--trigger.yaml --field tag=monolith-v0.1.0
```

Expected: 即時 return (workflow がキュー追加されただけ、結果は別途)。

- [ ] **Step 4.3: workflow 完了を待つ**

Run:
```bash
sleep 30
gh run list --workflow=auto-release--trigger.yaml --limit 1 --json status,conclusion,databaseId --jq '.[]'
```

Expected: `status: completed`, `conclusion: success`

`status: in_progress` の場合はさらに数十秒待って再実行。failure の場合は `gh run view <databaseId> --log-failed` で原因確認。

- [ ] **Step 4.4: ghcr に `monolith:v0.1.0` が push されたか確認**

Run:
```bash
gh api /users/panicboat/packages/container/monorepo%2Fmonolith/versions \
  --jq '.[].metadata.container.tags[]' | grep -E '^v0\.1\.0$' && echo OK || echo MISSING
```

Expected: `OK`

`MISSING` の場合は workflow log を再確認 (Step 4.3 と同じ手順)。

### Task 5: workflow_dispatch 検証 (frontend)

- [ ] **Step 5.1: workflow_dispatch で `frontend-v0.1.0` を build**

Run:
```bash
gh workflow run auto-release--trigger.yaml --field tag=frontend-v0.1.0
```

Expected: 即時 return

- [ ] **Step 5.2: workflow 完了を待つ**

Run:
```bash
sleep 30
gh run list --workflow=auto-release--trigger.yaml --limit 1 --json status,conclusion,databaseId --jq '.[]'
```

Expected: `status: completed`, `conclusion: success`

- [ ] **Step 5.3: ghcr に `frontend:v0.1.0` が push されたか確認**

Run:
```bash
gh api /users/panicboat/packages/container/monorepo%2Ffrontend/versions \
  --jq '.[].metadata.container.tags[]' | grep -E '^v0\.1\.0$' && echo OK || echo MISSING
```

Expected: `OK`

両方 OK なら PR 2 に進む。どちらかが MISSING の場合は原因解消まで PR 2 着手禁止 (semver image が ghcr にない状態で Flux semver filter に切替えると ImagePullBackOff のリスク)。

---

## PR 2: Flux + Kustomize Cutover

### Task 6: PR 2 用 worktree 準備

- [ ] **Step 6.1: monorepo の最新 main を fetch**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git fetch origin main --quiet
```

Expected: no output

- [ ] **Step 6.2: 新 worktree + 新 branch を origin/main から切る**

Run:
```bash
git worktree add -b feat/release-driven-flux-cutover .claude/worktrees/feat-release-driven-flux-cutover origin/main
```

Expected: `Preparing worktree (new branch 'feat/release-driven-flux-cutover')` + `branch ... set up to track 'origin/main'.`

### Task 7: ImagePolicy 修正 (monolith + frontend)

**Files:**
- Modify: `clusters/production/services/monolith/image-policy.yaml`
- Modify: `clusters/production/services/frontend/image-policy.yaml`

- [ ] **Step 7.1: monolith ImagePolicy を semver filter に置換**

`clusters/production/services/monolith/image-policy.yaml` を以下の内容で完全に置き換え:

```yaml
# =============================================================================
# ImagePolicy for monolith (= semver tag pattern)
# =============================================================================
# release-please tag (monolith-vX.Y.Z) を起点に build される ghcr semver tag
# (vX.Y.Z) を Flux が pickup する。 main push 由来の latest / sha tag は
# filterTags pattern で除外される (= Flux が見るのは semver のみ)。
# =============================================================================
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

- [ ] **Step 7.2: frontend ImagePolicy を semver filter に置換**

`clusters/production/services/frontend/image-policy.yaml` を以下の内容で完全に置き換え:

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: frontend
  namespace: flux-system
  labels:
    service: frontend
spec:
  imageRepositoryRef:
    name: frontend
  interval: 10m
  filterTags:
    pattern: '^v(?P<version>\d+\.\d+\.\d+)$'
    extract: '$version'
  policy:
    semver:
      range: '>=0.0.0'
```

### Task 8: ImageUpdateAutomation 修正 (monolith + frontend)

**Files:**
- Modify: `clusters/production/services/monolith/image-automation.yaml`
- Modify: `clusters/production/services/frontend/image-automation.yaml`

- [ ] **Step 8.1: monolith ImageUpdateAutomation の `update.path` を overlay 限定に変更**

`clusters/production/services/monolith/image-automation.yaml` の `update` セクションを以下に置換 (他のセクションは保持):

```yaml
  update:
    path: ./services/monolith/kubernetes/overlays/production
    strategy: Setters
```

(`path` の値が `./services/monolith/kubernetes` から `./services/monolith/kubernetes/overlays/production` に変更される。)

- [ ] **Step 8.2: frontend ImageUpdateAutomation の `update.path` を overlay 限定に変更**

`clusters/production/services/frontend/image-automation.yaml` の `update` セクションを以下に置換:

```yaml
  update:
    path: ./services/frontend/kubernetes/overlays/production
    strategy: Setters
```

### Task 9: base/deployment.yaml の Setters annotation 削除 (monolith + frontend)

**Files:**
- Modify: `services/monolith/kubernetes/base/deployment.yaml`
- Modify: `services/frontend/kubernetes/base/deployment.yaml`

- [ ] **Step 9.1: monolith base/deployment.yaml の image 行を修正**

`services/monolith/kubernetes/base/deployment.yaml` の以下の行:

```yaml
          image: ghcr.io/panicboat/monorepo/monolith:latest # {"$imagepolicy": "flux-system:monolith"}
```

を以下に置換 (Setters annotation コメントのみ削除、`:latest` は維持):

```yaml
          image: ghcr.io/panicboat/monorepo/monolith:latest
```

- [ ] **Step 9.2: frontend base/deployment.yaml の image 行を修正**

`services/frontend/kubernetes/base/deployment.yaml` の以下の行:

```yaml
          image: ghcr.io/panicboat/monorepo/frontend:latest # {"$imagepolicy": "flux-system:frontend"}
```

を以下に置換:

```yaml
          image: ghcr.io/panicboat/monorepo/frontend:latest
```

### Task 10: overlays/production/deployment.yaml 新規作成 (monolith + frontend)

**Files:**
- Create: `services/monolith/kubernetes/overlays/production/deployment.yaml`
- Create: `services/frontend/kubernetes/overlays/production/deployment.yaml`

- [ ] **Step 10.1: monolith overlay deployment patch を作成**

`services/monolith/kubernetes/overlays/production/deployment.yaml` を以下の内容で新規作成:

```yaml
# =============================================================================
# Deployment patch for monolith (production overlay)
# =============================================================================
# Flux ImageUpdateAutomation (= Setters strategy) が image 行を semver tag に
# 書き換える対象。 base/deployment.yaml は :latest を保持するが、 production
# cluster では本 patch で必ず上書きされる。
# =============================================================================
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

- [ ] **Step 10.2: frontend overlay deployment patch を作成**

`services/frontend/kubernetes/overlays/production/deployment.yaml` を以下の内容で新規作成:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    spec:
      containers:
        - name: frontend
          image: ghcr.io/panicboat/monorepo/frontend:v0.1.0 # {"$imagepolicy": "flux-system:frontend"}
```

### Task 11: overlays/production/kustomization.yaml に patch を追加 (monolith + frontend)

**Files:**
- Modify: `services/monolith/kubernetes/overlays/production/kustomization.yaml`
- Modify: `services/frontend/kubernetes/overlays/production/kustomization.yaml`

- [ ] **Step 11.1: monolith overlay kustomization.yaml に deployment patch を追加**

現状:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - external-secret.yaml
patches:
  - path: configmap.yaml
```

を以下に修正 (patches に deployment.yaml を追加):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - external-secret.yaml
patches:
  - path: configmap.yaml
  - path: deployment.yaml
```

- [ ] **Step 11.2: frontend overlay kustomization.yaml も同様に修正**

現状の `services/frontend/kubernetes/overlays/production/kustomization.yaml` を確認:

Run:
```bash
cat services/frontend/kubernetes/overlays/production/kustomization.yaml
```

Expected: `patches:` セクションに `- path: configmap.yaml` がある (monolith と同形)。

その `patches:` セクションに `- path: deployment.yaml` を追記 (Step 11.1 と同じパターン)。

### Task 12: kustomize build で sanity check

- [ ] **Step 12.1: monolith production overlay の build 結果を確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-driven-flux-cutover
kustomize build services/monolith/kubernetes/overlays/production | grep -E "image:|imagepolicy" | head -5
```

Expected: `image: ghcr.io/panicboat/monorepo/monolith:v0.1.0` が出力される (`:latest` でない)。kustomize は YAML コメントを drop するため、apply 後の manifest に annotation 自体は残らないが、git 上の YAML ファイルには Setters annotation が残り、Flux はそれを見て書き換える。

kustomize が手元になければ `brew install kustomize` で導入、または `kubectl kustomize` でも代替可。両方利用不可ならスキップして PR レビュー時に CI 経由で確認。

- [ ] **Step 12.2: frontend production overlay の build 結果を確認**

Run:
```bash
kustomize build services/frontend/kubernetes/overlays/production | grep -E "image:" | head -3
```

Expected: `image: ghcr.io/panicboat/monorepo/frontend:v0.1.0`

### Task 13: PR 2 commit + push + draft PR 作成

- [ ] **Step 13.1: 変更ファイル確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-release-driven-flux-cutover
git status --short
```

Expected:
```
 M clusters/production/services/frontend/image-automation.yaml
 M clusters/production/services/frontend/image-policy.yaml
 M clusters/production/services/monolith/image-automation.yaml
 M clusters/production/services/monolith/image-policy.yaml
 M services/frontend/kubernetes/base/deployment.yaml
?? services/frontend/kubernetes/overlays/production/deployment.yaml
 M services/frontend/kubernetes/overlays/production/kustomization.yaml
 M services/monolith/kubernetes/base/deployment.yaml
?? services/monolith/kubernetes/overlays/production/deployment.yaml
 M services/monolith/kubernetes/overlays/production/kustomization.yaml
```

(8 modified + 2 created = 10 files)

- [ ] **Step 13.2: commit**

Run:
```bash
git add \
  clusters/production/services/monolith/image-policy.yaml \
  clusters/production/services/frontend/image-policy.yaml \
  clusters/production/services/monolith/image-automation.yaml \
  clusters/production/services/frontend/image-automation.yaml \
  services/monolith/kubernetes/base/deployment.yaml \
  services/frontend/kubernetes/base/deployment.yaml \
  services/monolith/kubernetes/overlays/production/deployment.yaml \
  services/frontend/kubernetes/overlays/production/deployment.yaml \
  services/monolith/kubernetes/overlays/production/kustomization.yaml \
  services/frontend/kubernetes/overlays/production/kustomization.yaml
git commit -s -m "$(cat <<'EOF'
feat(flux): cut over production deploy to semver image tags

Switch Flux to pick up release-please-driven semver tags and move the
Setters annotation from base/deployment.yaml to overlays/production/
deployment.yaml.

Flux side (clusters/production/services/{monolith,frontend}/):
- image-policy.yaml: replace `^latest$` filter + digestReflectionPolicy
  with semver filter (`^v(?P<version>\d+\.\d+\.\d+)$`) + semver policy
  (range >=0.0.0).
- image-automation.yaml: narrow update.path to overlays/production so
  Flux only walks the file containing the new Setters annotation.

Kustomize side (services/{monolith,frontend}/kubernetes/):
- base/deployment.yaml: keep `:latest` but drop the Setters annotation
  comment (base is no longer a Flux rewrite target).
- overlays/production/deployment.yaml (new): strategic merge patch that
  pins image to `:v0.1.0` and carries the Setters annotation.
- overlays/production/kustomization.yaml: add the new deployment.yaml
  to `patches:`.

Prerequisite: PR 1 has been merged and ghcr.io contains
ghcr.io/panicboat/monorepo/monolith:v0.1.0 and frontend:v0.1.0.

Spec: docs/superpowers/specs/2026-05-17-release-driven-flux-deploy-design.md
EOF
)"
```

Expected: 10 files changed, commit が作成される

- [ ] **Step 13.3: push と draft PR 作成**

Run:
```bash
git push -u origin HEAD
gh pr create --draft --title "feat(flux): cut over production deploy to semver image tags" --body "$(cat <<'EOF'
## Summary

PR 2 of 2 for the release-driven Flux deploy rollout (spec: \`docs/superpowers/specs/2026-05-17-release-driven-flux-deploy-design.md\`).

Cutover from \`:latest\` + digest reflection to semver tag deploy:

- **Flux** (\`clusters/production/services/{monolith,frontend}/\`):
  - \`image-policy.yaml\`: replace latest filter with semver filter + semver policy
  - \`image-automation.yaml\`: narrow \`update.path\` to \`overlays/production\`
- **Kustomize** (\`services/{monolith,frontend}/kubernetes/\`):
  - \`base/deployment.yaml\`: drop Setters annotation (\`:latest\` is kept)
  - \`overlays/production/deployment.yaml\` (new): strategic merge patch pinning \`:v0.1.0\` + Setters annotation
  - \`overlays/production/kustomization.yaml\`: add the new deployment patch

## Prerequisite

PR 1 must be merged and \`ghcr.io/panicboat/monorepo/{monolith,frontend}:v0.1.0\` must exist. Otherwise Flux ImagePolicy will match 0 images and ImageUpdateAutomation could rewrite the manifest to an empty image.

## Test plan

- [ ] CI (lint-actions / semantic-pull-request / CI Gatekeeper) passes
- [ ] \`kubectl get imagepolicy -n flux-system monolith -o jsonpath='{.status.latestImage}'\` returns \`ghcr.io/panicboat/monorepo/monolith:v0.1.0\` (same for frontend)
- [ ] Flux ImageUpdateAutomation commits to main if needed and \`overlays/production/deployment.yaml\` ends up at the latest semver
- [ ] \`kubectl rollout status deployment/monolith\` (and frontend) completes
- [ ] Next release-please cycle (e.g. monolith-v0.2.0) triggers PR 1's auto-release--trigger.yaml, builds \`monolith:v0.2.0\`, Flux picks it up, and the production rollout completes end-to-end
EOF
)"
```

Expected: PR URL が出力される

### Task 14: PR 2 マージ + Flux 動作検証

- [ ] **Step 14.1: PR 2 マージ (ユーザー操作)**

ユーザーが PR 2 をレビュー & マージする。

完了の判断: `gh pr view <PR番号> --json state -q .state` が `MERGED`。

- [ ] **Step 14.2: Flux ImagePolicy の `status.latestImage` を確認**

Flux が新 ImagePolicy spec を reconcile する時間 (~10m) を待ってから:

```bash
kubectl get imagepolicy -n flux-system monolith -o jsonpath='{.status.latestImage}'
kubectl get imagepolicy -n flux-system frontend -o jsonpath='{.status.latestImage}'
```

Expected: それぞれ `ghcr.io/panicboat/monorepo/monolith:v0.1.0` と `ghcr.io/panicboat/monorepo/frontend:v0.1.0` を出力。

kubectl が手元になければ kubeconfig をセットアップ。SSH 経由で cluster admin pod から確認しても可。

- [ ] **Step 14.3: overlays/production/deployment.yaml の image が最新 semver であることを確認**

ImageUpdateAutomation が走った後 (~30m):

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git fetch origin main --quiet
git show origin/main:services/monolith/kubernetes/overlays/production/deployment.yaml | grep image:
git show origin/main:services/frontend/kubernetes/overlays/production/deployment.yaml | grep image:
```

Expected: それぞれ最新 semver tag (現時点は `v0.1.0`)。Flux が新 image を見つけて書き換えた場合は新 tag に変わる (例: 後続 release で `v0.2.0` 等)。

- [ ] **Step 14.4: production rollout の確認**

Run:
```bash
kubectl rollout status deployment/monolith
kubectl rollout status deployment/frontend
```

Expected: 両方 `deployment "X" successfully rolled out`

`ImagePullBackOff` が出たら ghcr に該当 semver tag が存在するか再確認 (Step 4.4 / 5.3 と同じコマンド)。

### Task 15: worktree cleanup

- [ ] **Step 15.1: PR 1 worktree を cleanup**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git worktree remove .claude/worktrees/feat-release-driven-flux-deploy
git worktree prune
```

Expected: no error

- [ ] **Step 15.2: PR 2 worktree を cleanup**

Run:
```bash
git worktree remove .claude/worktrees/feat-release-driven-flux-cutover
git worktree prune
```

Expected: no error

---

## Post-Implementation Verification

### Task 16: 次の release-please cycle で end-to-end 動作を確認

これは「Phase 2 完了の定義」を満たす最終確認。実装計画の他 Task と異なり、自然な開発フロー (= 次の機能 PR をマージ → release-please PR をマージ) で検証する。

- [ ] **Step 16.1: 次の `feat:` / `fix:` commit が main に入るのを待つ**

通常の開発フローで、`services/monolith/` or `services/frontend/` 配下に `feat:` か `fix:` の commit が main にマージされる。

- [ ] **Step 16.2: release-please PR が出ることを確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh pr list --state open --search "in:title chore(main): release"
```

Expected: `chore(main): release monolith X.Y.Z` (or frontend) が出ている。

- [ ] **Step 16.3: release-please PR をマージ (ユーザー操作)**

ユーザーがマージ。

- [ ] **Step 16.4: `auto-release--trigger.yaml` が release event で起動したことを確認**

Run:
```bash
sleep 60
gh run list --workflow=auto-release--trigger.yaml --limit 1 --json status,conclusion,event --jq '.[]'
```

Expected: `event: release`, `conclusion: success`

- [ ] **Step 16.5: ghcr に新 semver tag が push されたことを確認**

Run (該当 service / version に応じて):
```bash
gh api /users/panicboat/packages/container/monorepo%2F<service>/versions \
  --jq '.[].metadata.container.tags[]' | grep -E '^v<X\.Y\.Z>$' && echo OK || echo MISSING
```

- [ ] **Step 16.6: Flux pickup + production rollout の自動完了を待つ**

最大 ~45m 待ってから:

```bash
kubectl get imagepolicy -n flux-system <service> -o jsonpath='{.status.latestImage}'
# 期待: ghcr.io/panicboat/monorepo/<service>:v<X.Y.Z>

git fetch origin main --quiet
git show origin/main:services/<service>/kubernetes/overlays/production/deployment.yaml | grep image:
# 期待: image 行が v<X.Y.Z> に書き換わっている、Flux からの commit が main に乗っている

kubectl rollout status deployment/<service>
# 期待: successfully rolled out
```

すべて期待通りなら **Phase 2 monorepo 編は完了**。

---

## Notes

- PR 1 と PR 2 はそれぞれ独立した worktree / branch で進める。PR 1 にはこの plan + spec の commit が既に乗っているので、Task 3 の `git status` 時点では plan / spec も staged 候補に出る (`git status` の `??` ではなく既に commit 済みなので問題なし)。
- 各 Task の "PR 操作" Step (3.3, 4.1, 13.3, 14.1, 16.3) はユーザーが行う。実装エージェントは PR 作成 / 結果検証 / verification を担当する。
- Flux の reconcile interval が長い (ImageRepository: 5m, ImagePolicy: 10m, ImageUpdateAutomation: 30m) ため、検証ステップは時間がかかる。`flux reconcile` コマンドで強制 reconcile も可能 (`flux reconcile image repository monolith -n flux-system` 等)。
- `kustomize build` の sanity check は手元環境依存。CI 側でも kustomize build を走らせる workflow があるか確認、なければ別途追加検討 (本 plan では Scope 外)。
- 既存 release `monolith-v0.1.0` / `frontend-v0.1.0` を `workflow_dispatch` で再 build する Task 4 / 5 が**唯一** PR 1 マージから PR 2 着手までに必須の中間作業。これを忘れると PR 2 マージ後に Flux が match 0 で stale 状態になる。
