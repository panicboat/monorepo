# Kubernetes Diff in Deploy Trigger

## Goal

`auto-label--deploy-trigger.yaml` に Kubernetes 用ジョブを追加し、PR 上で kustomize マニフェストの差分を表示する。terragrunt plan と同等の「変更前後の確認手段」を kubernetes overlay にも提供する。

## Scope

- **対象**: `pull_request` イベントのみ。`push to main` 時は何もしない。
- **比較**: PR ブランチの `kustomize build` 出力 vs base ブランチの `kustomize build` 出力（テキスト差分）。
- **クラスタアクセス不要**: 実クラスタへの apply / `kubectl diff` は行わない。
- **コメント粒度**: 1 PR コメント = 1 (service × environment)。
- **コメント方式**: Sticky comment（同 key で上書き）。
- **実装場所**: 当面このリポジトリ内の reusable workflow に inline 実装。`panicboat/deploy-actions` への切り出しは将来の課題。

## Non-Goals

- 実クラスタへの apply / sync 自動化
- ArgoCD 等 GitOps ツールとの連携
- Helm / kustomize plugin のサポート（現状の overlay は plain kustomize のみ）
- `panicboat/deploy-actions` への action 追加

## Architecture

```
auto-label--deploy-trigger.yaml
├── deploy-trigger    (既存) — label-resolver で targets 算出
├── deploy-terragrunt (既存) → reusable--terragrunt-executor.yaml
├── deploy-container  (既存) → reusable--container-builder.yaml
├── deploy-kubernetes (新規) → reusable--kubernetes-executor.yaml
└── deployment-summary (更新) — deploy-kubernetes も needs に追加
```

既存 3 ジョブと対称な構造を採る。matrix 展開は caller (`auto-label--deploy-trigger.yaml`) 側で行い、reusable workflow は単一の `(service, environment)` を受け取る。

## Components

### 1. `auto-label--deploy-trigger.yaml` の `deploy-kubernetes` ジョブ（新規）

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

`working-directory` が空文字列の場合 reusable 側で no-op となるガードを設ける（`deploy-container` の `image-name` 空文字列ガードと同パターン）。

### 2. `reusable--kubernetes-executor.yaml`（新規）

#### Inputs

| input | type | required | 説明 |
|---|---|---|---|
| `service-name` | string | yes | 例: `monolith` |
| `environment` | string | yes | 例: `develop` |
| `working-directory` | string | yes | 例: `services/monolith/kubernetes/overlays/develop` |
| `app-id` | string | yes | GitHub App ID |

#### Secrets

| secret | required | 説明 |
|---|---|---|
| `private-key` | yes | GitHub App private key |

#### ジョブステップ

1. **GitHub App トークン生成** — `actions/create-github-app-token@v3.1.1`
2. **PR 情報取得** — `jwalton/gh-find-current-pr@v1`
3. **PR HEAD checkout** — `actions/checkout@v4` を `path: head` で実行（`ref: ${{ github.event.pull_request.head.sha }}`）
4. **base ref checkout** — `actions/checkout@v4` を `path: base` で実行（`ref: ${{ github.event.pull_request.base.sha }}`）
5. **kustomize インストール** — 公式インストールスクリプトまたは `setup-kustomize` action
6. **dyff インストール** — `homeport/dyff` の release バイナリをダウンロード
7. **base マニフェスト生成** — `kustomize build base/{working-directory} > base.yaml`。overlay 不在時は空ファイル化
8. **head マニフェスト生成** — `kustomize build head/{working-directory} > head.yaml`。overlay 不在時は空ファイル化
9. **dyff 実行** — `dyff between --omit-header base.yaml head.yaml > diff.txt`
10. **PR コメント投稿** — `marocchino/sticky-pull-request-comment@v2`
    - `header: kubernetes-diff-{service-name}-{environment}`
    - `message`: diff 内容を `<details>` 折りたたみ込みの Markdown で整形

#### `working-directory == ''` の no-op

ジョブレベル `if: inputs.working-directory != ''` を付与し、空入力時は何もしない。

## Data Flow

```
PR push
  → label-dispatcher が stack ラベルを付与
  → deploy-trigger が label-resolver で targets JSON を生成
  → deploy-kubernetes ジョブが matrix 展開（kubernetes 以外は no-op）
  → reusable--kubernetes-executor.yaml が
      base/head の kustomize build を実行
      → dyff between で意味的差分を抽出
      → PR にコメント投稿（sticky）
```

## Error Handling

| ケース | 挙動 |
|---|---|
| base に overlay 不在（新規追加 PR） | `base.yaml` を空にし、全リソースが追加扱いの diff |
| head に overlay 不在（削除 PR） | `head.yaml` を空にし、全リソースが削除扱いの diff |
| 差分ゼロ | "差分なし" の旨を sticky comment に投稿（履歴可視化のため） |
| `kustomize build` がエラー | ジョブを失敗させ、エラー出力を sticky comment に投稿 |
| `dyff` がエラー | ジョブを失敗させ、stderr を sticky comment に投稿 |

`fail-fast: false` により他 (service × env) の diff は止まらず継続する。

## `deployment-summary` の変更

- `needs` に `deploy-kubernetes` を追加
- ログ行に `Kubernetes Job Status: ${{ needs.deploy-kubernetes.result }}` を追加

## Future Work

- `panicboat/deploy-actions/kubernetes-executor` action として切り出し、reusable workflow から呼び出す形にリファクタ
- 実クラスタへの `kubectl apply` / `kubectl diff` 連携（push to main 時の自動 sync）
- helm chart や kustomize plugin を使う overlay への対応
