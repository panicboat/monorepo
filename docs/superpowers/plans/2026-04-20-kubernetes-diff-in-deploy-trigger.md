# Kubernetes Diff in Deploy Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `auto-label--deploy-trigger.yaml` に `deploy-kubernetes` ジョブを追加し、PR ブランチ vs base ブランチの kustomize build 出力差分を `dyff between` で生成して PR に sticky comment で表示する。

**Architecture:** caller の `auto-label--deploy-trigger.yaml` が matrix を展開し、各 (service × environment) ごとに新規 reusable workflow `reusable--kubernetes-executor.yaml` を呼び出す。reusable 側で base/head を別ディレクトリに checkout → kustomize build → dyff between → sticky comment 投稿。`pull_request` イベントのみ。

**Tech Stack:** GitHub Actions (reusable workflow / matrix), kustomize, [homeport/dyff](https://github.com/homeport/dyff) v1.11.3, [marocchino/sticky-pull-request-comment](https://github.com/marocchino/sticky-pull-request-comment) v3.0.4, [actions/create-github-app-token](https://github.com/actions/create-github-app-token) v3.1.1.

**Spec:** [docs/superpowers/specs/2026-04-19-kubernetes-diff-in-deploy-trigger-design.md](../specs/2026-04-19-kubernetes-diff-in-deploy-trigger-design.md)

**Testing notes:** GitHub Actions workflow に unit test は無い。検証手段は次の 2 段:
1. **構文検証** — actionlint を docker 経由で実行 (`docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/<file>`)
2. **動作検証** — 本 PR を push して、kubernetes overlay に小さな差分を加え、`deploy-kubernetes` ジョブが期待通り発火し sticky comment が投稿されることを目視確認

## File Structure

| Path | 役割 |
|---|---|
| `.github/workflows/reusable--kubernetes-executor.yaml` (新規) | (service, environment) を受け取り、kustomize build → dyff between → PR コメントを実行する reusable workflow |
| `.github/workflows/auto-label--deploy-trigger.yaml` (変更) | `deploy-kubernetes` ジョブの追加と `deployment-summary` ジョブの `needs` / ログ更新 |

---

### Task 1: reusable workflow のスケルトン作成

inputs / secrets / no-op guard だけを持つ最小の workflow_call ファイルを作る。空 YAML を一度 actionlint で通してから、後続タスクでステップを足していく。

**Files:**
- Create: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: ファイルを作成し以下の内容で書き込む**

```yaml
name: 'Reusable - Kubernetes Executor'

on:
  workflow_call:
    inputs:
      service-name:
        required: true
        type: string
        description: 'Service name (e.g. monolith)'
      environment:
        required: true
        type: string
        description: 'Environment name (develop, staging, production, etc.)'
      working-directory:
        required: true
        type: string
        description: 'Path to kustomize overlay (e.g. services/monolith/kubernetes/overlays/develop)'
      app-id:
        required: true
        type: string
        description: 'GitHub App ID for authentication'
    secrets:
      private-key:
        required: true
        description: 'GitHub App private key for authentication'

jobs:
  kubernetes-diff:
    name: 'Kubernetes Diff'
    if: inputs.working-directory != ''
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Placeholder
        run: echo "kubernetes-diff for ${{ inputs.service-name }}:${{ inputs.environment }}"
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0、エラー出力なし

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): add reusable kubernetes executor skeleton"
```

---

### Task 2: GitHub App トークン生成と base/head の checkout を追加

PR HEAD と PR BASE をそれぞれ `head/`, `base/` ディレクトリに checkout する。Token は `actions/create-github-app-token@v3.1.1` で生成（既存 reusable と同じバージョン）。

**Files:**
- Modify: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: Placeholder ステップを下記で置き換える**

```yaml
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v3.1.1
        with:
          app-id: ${{ inputs.app-id }}
          private-key: ${{ secrets.private-key }}
          owner: ${{ github.repository_owner }}

      - name: Checkout PR head
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          path: head
          token: ${{ steps.app-token.outputs.token }}

      - name: Checkout PR base
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.sha }}
          path: base
          token: ${{ steps.app-token.outputs.token }}
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): checkout PR head and base in kubernetes executor"
```

---

### Task 3: kustomize と dyff のインストールステップを追加

両ツールとも公式 release バイナリを `/usr/local/bin` に配置する。バージョンは plan 作成時点の最新を pin する（renovate 配下の更新は対象外でよい — GitHub Actions YAML 内の bash でのバイナリインストールなので）。

**Files:**
- Modify: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: checkout の後に kustomize / dyff インストールステップを追加**

`Checkout PR base` ステップの後に以下を追記する:

```yaml
      - name: Install kustomize
        run: |
          curl -sSL "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash -s 5.4.3 /usr/local/bin
          kustomize version

      - name: Install dyff
        env:
          DYFF_VERSION: '1.11.3'
        run: |
          curl -sSL "https://github.com/homeport/dyff/releases/download/v${DYFF_VERSION}/dyff_${DYFF_VERSION}_linux_amd64.tar.gz" | sudo tar -xz -C /usr/local/bin dyff
          sudo chmod +x /usr/local/bin/dyff
          dyff version
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): install kustomize and dyff in kubernetes executor"
```

---

### Task 4: kustomize build を base/head それぞれで実行

overlay 不在時（新規追加 PR で base 側に存在しない、削除 PR で head 側に存在しない）は空ファイルを生成する。エラー出力は `_kustomize_*.log` に保存して後続のエラーコメント用に保持する。

**Files:**
- Modify: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: dyff インストールステップの後に kustomize build ステップを追加**

```yaml
      - name: Build kustomize manifests (base)
        id: build-base
        run: |
          if [ -d "base/${{ inputs.working-directory }}" ]; then
            if ! kustomize build "base/${{ inputs.working-directory }}" > base.yaml 2> _kustomize_base.log; then
              echo "build-failed=true" >> "$GITHUB_OUTPUT"
              cat _kustomize_base.log
              exit 1
            fi
          else
            echo "Overlay not present in base ref; treating as empty."
            : > base.yaml
          fi

      - name: Build kustomize manifests (head)
        id: build-head
        run: |
          if [ -d "head/${{ inputs.working-directory }}" ]; then
            if ! kustomize build "head/${{ inputs.working-directory }}" > head.yaml 2> _kustomize_head.log; then
              echo "build-failed=true" >> "$GITHUB_OUTPUT"
              cat _kustomize_head.log
              exit 1
            fi
          else
            echo "Overlay not present in head ref; treating as empty."
            : > head.yaml
          fi
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): run kustomize build for base and head refs"
```

---

### Task 5: dyff between を実行して diff.txt を生成

差分が無いケースを `_no_diff` フラグで検出し、後続のコメント整形で分岐できるようにする。`dyff between --omit-header --no-table-style` でヘッダ行を抑制（PR コメント整形時にこちら側でヘッダを書く）。

**Files:**
- Modify: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: kustomize build ステップの後に dyff ステップを追加**

```yaml
      - name: Run dyff between
        id: dyff
        run: |
          set +e
          dyff between --omit-header --color off base.yaml head.yaml > diff.txt 2> _dyff.log
          status=$?
          set -e
          if [ "$status" -ne 0 ]; then
            echo "dyff-failed=true" >> "$GITHUB_OUTPUT"
            cat _dyff.log
            exit "$status"
          fi
          if [ ! -s diff.txt ]; then
            echo "no-diff=true" >> "$GITHUB_OUTPUT"
          else
            echo "no-diff=false" >> "$GITHUB_OUTPUT"
          fi
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): run dyff between base and head manifests"
```

---

### Task 6: 成功時の sticky PR コメント投稿

差分の有無で本文を分岐:
- 差分あり: `<details>` で折りたたんだ code block の中に diff を埋め込む
- 差分なし: `差分なし` と表記

header は `kubernetes-diff-{service}-{environment}` でジョブ間衝突を防ぐ。

**Files:**
- Modify: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: dyff ステップの後にコメント整形と投稿ステップを追加**

```yaml
      - name: Compose diff comment
        id: compose
        env:
          NO_DIFF: ${{ steps.dyff.outputs.no-diff }}
          SERVICE: ${{ inputs.service-name }}
          ENVIRONMENT: ${{ inputs.environment }}
          WORKING_DIR: ${{ inputs.working-directory }}
        run: |
          {
            echo "### Kubernetes Diff: \`${SERVICE}\` (\`${ENVIRONMENT}\`)"
            echo ""
            echo "Overlay: \`${WORKING_DIR}\`"
            echo ""
            if [ "$NO_DIFF" = "true" ]; then
              echo "差分なし"
            else
              echo "<details><summary>kustomize build diff (dyff between)</summary>"
              echo ""
              echo '```diff'
              cat diff.txt
              echo '```'
              echo ""
              echo "</details>"
            fi
          } > comment.md

      - name: Post sticky comment
        uses: marocchino/sticky-pull-request-comment@v3.0.4
        with:
          header: kubernetes-diff-${{ inputs.service-name }}-${{ inputs.environment }}
          path: comment.md
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): post sticky comment with kubernetes diff"
```

---

### Task 7: 失敗時のエラーコメント投稿

kustomize / dyff のいずれかが失敗した場合、ジョブは失敗扱いにしつつ、エラー内容を sticky comment にも反映する。`if: failure()` ステップで対応する。

**Files:**
- Modify: `.github/workflows/reusable--kubernetes-executor.yaml`

- [ ] **Step 1: 既存の `Post sticky comment` ステップの後にエラーコメントステップを追加**

```yaml
      - name: Post failure comment
        if: failure() && (steps.build-base.outputs.build-failed == 'true' || steps.build-head.outputs.build-failed == 'true' || steps.dyff.outputs.dyff-failed == 'true')
        uses: marocchino/sticky-pull-request-comment@v3.0.4
        with:
          header: kubernetes-diff-${{ inputs.service-name }}-${{ inputs.environment }}
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
          message: |
            ### Kubernetes Diff: `${{ inputs.service-name }}` (`${{ inputs.environment }}`)

            Overlay: `${{ inputs.working-directory }}`

            kustomize build または dyff の実行に失敗しました。Actions ログで詳細を確認してください: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/reusable--kubernetes-executor.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/reusable--kubernetes-executor.yaml
git commit -s -m "feat(ci): post failure comment when kustomize or dyff fails"
```

---

### Task 8: `auto-label--deploy-trigger.yaml` に `deploy-kubernetes` ジョブを追加

既存 `deploy-container` ジョブの後ろに、kubernetes stack 用 matrix ジョブを挿入する。`deploy-terragrunt` と同形だが apply の概念がないため `event_name == 'pull_request'` ガードを追加する。

**Files:**
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml:77-93` (`deploy-container` ジョブ末尾の直後に挿入)

- [ ] **Step 1: `deploy-container` ジョブと `cleanup-container` のコメント行の間に新規ジョブを挿入**

`auto-label--deploy-trigger.yaml` の `deploy-container` ジョブの末尾（93 行目: `private-key: ${{ secrets.APP_PRIVATE_KEY }}`）と、コメントアウトされた `cleanup-container` ブロックの間に以下を挿入する:

```yaml
  deploy-kubernetes:
    name: 'Deploy Kubernetes (${{ matrix.target.service }}:${{ matrix.target.environment }})'
    needs: deploy-trigger
    if: |
      github.event_name == 'pull_request' &&
      needs.deploy-trigger.outputs.has-targets == 'true' &&
      contains(needs.deploy-trigger.outputs.targets, '"stack":"kubernetes"')
    strategy:
      matrix:
        target: ${{ fromJson(needs.deploy-trigger.outputs.targets) }}
      fail-fast: false
    uses: ./.github/workflows/reusable--kubernetes-executor.yaml
    with:
      service-name: ${{ matrix.target.service }}
      environment: ${{ matrix.target.environment }}
      working-directory: ${{ matrix.target.stack == 'kubernetes' && matrix.target.working_directory || '' }}
      app-id: ${{ vars.APP_ID }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

- [ ] **Step 2: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/auto-label--deploy-trigger.yaml`
Expected: 終了コード 0

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/auto-label--deploy-trigger.yaml
git commit -s -m "feat(ci): add deploy-kubernetes job to deploy-trigger workflow"
```

---

### Task 9: `deployment-summary` ジョブの更新

`needs` に `deploy-kubernetes` を追加し、サマリログに kubernetes ジョブの結果を出力する。

**Files:**
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml:114-131` (`deployment-summary` ジョブ全体)

- [ ] **Step 1: `deployment-summary` の `needs` 行を更新**

旧:
```yaml
    needs: [deploy-trigger, deploy-terragrunt, deploy-container]
```

新:
```yaml
    needs: [deploy-trigger, deploy-terragrunt, deploy-container, deploy-kubernetes]
```

- [ ] **Step 2: サマリログ出力に kubernetes 行を追加**

旧:
```yaml
          echo "Terragrunt Job Status: ${{ needs.deploy-terragrunt.result }}"
          echo "Container Job Status: ${{ needs.deploy-container.result }}"
          echo "Cleanup Job Status: ${{ needs.cleanup-container.result }}"
```

新:
```yaml
          echo "Terragrunt Job Status: ${{ needs.deploy-terragrunt.result }}"
          echo "Container Job Status: ${{ needs.deploy-container.result }}"
          echo "Kubernetes Job Status: ${{ needs.deploy-kubernetes.result }}"
          echo "Cleanup Job Status: ${{ needs.cleanup-container.result }}"
```

- [ ] **Step 3: actionlint で構文検証**

Run: `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest .github/workflows/auto-label--deploy-trigger.yaml`
Expected: 終了コード 0

- [ ] **Step 4: コミット**

```bash
git add .github/workflows/auto-label--deploy-trigger.yaml
git commit -s -m "feat(ci): include deploy-kubernetes in deployment summary"
```

---

### Task 10: 動作検証（test PR で発火させる）

実装 PR を push し、kubernetes overlay に小さな差分（コメント追加など）を加えて `deploy-kubernetes` ジョブの発火と sticky comment の投稿を目視で確認する。

**Files:** （検証専用の一時的な編集 — 検証完了後に revert する）
- Modify: `services/monolith/kubernetes/overlays/develop/kustomization.yaml`

- [ ] **Step 1: 検証用の差分を作る**

```bash
# 例: 末尾にコメント追加
echo "# Test diff for deploy-kubernetes verification" >> services/monolith/kubernetes/overlays/develop/kustomization.yaml
git add services/monolith/kubernetes/overlays/develop/kustomization.yaml
git commit -s -m "test(ci): trigger deploy-kubernetes for verification"
git push
```

- [ ] **Step 2: GitHub Actions の挙動確認**

Run: `gh run list --workflow=auto-label--deploy-trigger.yaml --branch claude/naughty-lewin-746ccf --limit 3`

確認:
- `deploy-kubernetes (monolith:develop)` ジョブが起動している
- 他の matrix ペア（kubernetes 以外）は no-op で skip されている
- ジョブ全体が success で終わっている

- [ ] **Step 3: PR 上で sticky comment を確認**

`gh pr view 525 --comments` または GitHub UI で:
- `### Kubernetes Diff: monolith (develop)` を含む sticky comment が投稿されている
- diff 内容が `<details>` 折りたたみ内に表示されている
- 再 push 後はコメントが上書き更新される（複数コメントが並ばない）

- [ ] **Step 4: 検証用差分を revert**

```bash
git revert HEAD --no-edit
git push
```

revert 後の PR コメントが「差分なし」（または overlay 全体の add/del 状態に応じた表示）に sticky 更新されることを確認する。

- [ ] **Step 5: 検証完了をコミット履歴で確認**

Run: `git log --oneline -10`
Expected: feat(ci) コミット 7 つ + test(ci) と revert の 2 つが並んでいる
