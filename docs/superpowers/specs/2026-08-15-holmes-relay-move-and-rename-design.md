# Move holmes-relay to system-components/ and Rename to holmes

## Background

`holmes-relay`（Slack mention / Alertmanager critical alert を HolmesGPT の調査に中継する service）は `services/holmes-relay/` に実装済み・main にマージ済みだが、以下2点の見直しが決まった。

1. **配置場所**: `services/` は toC サービス（frontend, monolith）向けの分類であり、holmes-relay のような内部運用ツールは同じ分類に属さない。新しいトップレベルディレクトリ `system-components/` を導入する。
2. **サービス名**: `holmes-relay` は現在の投資先である HolmesGPT という特定製品名に強く紐づく。名探偵シャーロック・ホームズ（＝探偵に調査を依頼する、というメタファー）から採用した `holmes` に短縮する。「relay」は frontend/monolith と同じ単語1つの命名慣習に合わせるため落とす。

これは holmes-relay 内部のパッケージ構成リファクタ（別 spec: `docs/superpowers/specs/2026-08-15-holmes-relay-packages-design.md`、`services/holmes-relay/workspace/...` を前提に書かれている）とは独立した作業であり、このディレクトリ移動・リネームを先に完了させてから内部構成リファクタに進む。

## Verified Findings

- **`panicboat/deploy-actions` の `stack_conventions` は複数 `root` エントリを前提にした汎用実装**（`workflow_config.rb`: `stack_conventions_config.each do |convention| ... end`、`DeploymentTarget` entity が `stack_convention_root`/`working_directory` を汎用的に保持）。`workflow-config.yaml` に `- root: system-components/{service}` を1エントリ追加するだけで、ラベル自動付与・deploy matrix 生成のコアロジックは対応可能。
- **例外1箇所**: `.github/workflows/auto-release--trigger.yaml:51` が `working-directory: services/${{ needs.detect-component.outputs.service }}/workspace` を決め打ちしている。この workflow は「`<service>-vX.Y.Z` タグの release publish → バージョン付き container image を build」する汎用の release trigger で、toC 限定ではない（holmes 自身も Flux ImagePolicy による semver tag 運用を前提にしており、この workflow が必要）。修正が要る。

## Naming Map

| 現在 (holmes-relay) | 変更後 (holmes) |
|---|---|
| ディレクトリ `services/holmes-relay/` | `system-components/holmes/` |
| Go module `github.com/panicboat/monorepo/services/holmes-relay` | `github.com/panicboat/monorepo/system-components/holmes` |
| Docker image `ghcr.io/panicboat/monorepo/holmes-relay` | `ghcr.io/panicboat/monorepo/holmes` |
| K8s Deployment/Service/ConfigMap/コンテナ名 `holmes-relay` | `holmes` |
| K8s Secret `holmes-relay-slack` / `holmes-relay-alertmanager` | `holmes-slack` / `holmes-alertmanager` |
| AWS Secrets Manager `panicboat/holmes-relay/slack` / `panicboat/holmes-relay/alertmanager` | `panicboat/holmes/slack` / `panicboat/holmes/alertmanager` |
| Flux ImagePolicy `flux-system:holmes-relay` | `flux-system:holmes` |
| HTTPRoute hostname `holmes-relay.dystopia.city` | `holmes.dystopia.city` |
| Terragrunt state key `services/holmes-relay/production/terraform.tfstate` | `system-components/holmes/production/terraform.tfstate` |

**注意**: HolmesGPT 本体（`panicboat/platform` repo の `kubernetes/components/holmesgpt/`、namespace `holmesgpt`、Service `holmesgpt-holmes`）は今回の対象外。あちらは HolmesGPT chart そのものであり、今回リネームするのは中継 service（旧 holmes-relay）のみ。両者が同じ `holmes` という語を含むが、指すものが違う（中継 service の内部パッケージ `internal/clients/holmes` は HolmesGPT API を呼ぶクライアントを指し、これも同様に別物）。この重複は意図的に許容する — spec/README で明示する。

## Changes

### 1. `system-components/holmes/` へのファイル移動 + リネーム

`git mv services/holmes-relay system-components/holmes` の後、以下のファイル内の文字列を上記 Naming Map に従って置換する:

- `system-components/holmes/workspace/go.mod`（module path）
- `system-components/holmes/workspace/Dockerfile`（変更不要 — image name は外部の workflow 側で指定されるため Dockerfile 自体に service 名の記載はない）
- `system-components/holmes/kubernetes/base/*.yaml`（Deployment/Service/ConfigMap の `metadata.name`, `spec.selector`, コンテナ名、`envFrom.secretRef.name`）
- `system-components/holmes/kubernetes/base/httproute.yaml`（`hostnames`）
- `system-components/holmes/kubernetes/overlays/production/deployment.yaml`（image 名、`$imagepolicy` annotation）
- `system-components/holmes/kubernetes/overlays/production/external-secret.yaml`（`metadata.name`, `target.name`, `remoteRef.key`）
- `system-components/holmes/terragrunt/modules/main.tf`（`aws_secretsmanager_secret` の `name`）
- `system-components/holmes/terragrunt/envs/production/terragrunt.hcl`（`remote_state.config.key`）
- `system-components/holmes/README.md`（本文中の service 名・URL・Secrets Manager path 参照）

### 2. `workflow-config.yaml` に system-components 用の stack_conventions を追加

```yaml
stack_conventions:
  - root: services/{service}
    stacks:
      - name: docker
        directory: workspace
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
  - root: system-components/{service}
    stacks:
      - name: docker
        directory: workspace
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
```

（Terragrunt stack は monorepo 全体で現状コメントアウトのままなので今回は追加しない。holmes の terragrunt はこれまで通り手動 `terragrunt plan/apply` 運用。）

### 3. `auto-release--trigger.yaml` の `services/` 決め打ちを解消

`detect-component` ジョブの後、`container-build` を呼ぶ前に working-directory を解決するステップを追加する。`workflow-config.yaml` の `stack_conventions` を読み、`services/<service>/workspace` と `system-components/<service>/workspace` のうち実際にリポジトリ上に存在する方を採用する（`test -d` で判定。Ruby 製 `config-manager` CLI を CI 内で呼ぶよりシンプルで、この workflow は他に外部ツール依存が無いため一貫性がある）。

```yaml
  detect-component:
    runs-on: ubuntu-latest
    outputs:
      service: ${{ steps.parse.outputs.service }}
      version: ${{ steps.parse.outputs.version }}
      working-directory: ${{ steps.resolve-dir.outputs.working-directory }}
    steps:
      - name: Parse tag
        id: parse
        # (既存のまま)
      - uses: actions/checkout@<pinned-sha>
      - name: Resolve working directory
        id: resolve-dir
        env:
          SERVICE: ${{ steps.parse.outputs.service }}
        run: |
          set -euo pipefail
          for root in services system-components; do
            if [ -d "$root/$SERVICE/workspace" ]; then
              echo "working-directory=$root/$SERVICE/workspace" >> "$GITHUB_OUTPUT"
              exit 0
            fi
          done
          echo "::error::No workspace directory found for service '$SERVICE' under services/ or system-components/"
          exit 1
```

`container-build` job の `working-directory` 入力を `${{ needs.detect-component.outputs.working-directory }}` に変更する。

## Testing

- `workflow-config.yaml` 変更後、`cd deploy-actions/action-scripts/config-manager && bin/config-manager validate`（`panicboat/deploy-actions` 側の CLI、ローカルに clone 済みなら実行可能）で config の構文・スキーマが妥当か確認する。ローカルで実行できない場合は PR 上の実際の Actions 実行結果で確認する。
- `auto-release--trigger.yaml` の `resolve-dir` ステップはこの PR だけではトリガーされない（`release: published` イベント駆動のため）。ロジックの妥当性は `working-directory` のディレクトリ判定を手元の shell で再現して確認する（`ls system-components/holmes/workspace` と `ls services/monolith/workspace` の両方が期待通り解決されることを確認）。
- 移動後の holmes 側: `go build ./... && go test ./... -v -race -count=1`（新しい module path で解決すること）、`kustomize build` を base/production overlay 両方で実行、`terragrunt plan` を実行（新しい state key で新規 backend 初期化になる点に注意 — 旧 state は空のまま残る。旧 state の破棄/移行は本 spec のスコープ外とする。まだ `terragrunt apply` していない — Secrets Manager の実 secret は未作成のため、旧 state に実リソースは存在しない）。

## Out of Scope

- 内部パッケージ構成のリファクタ（`internal/config`, `internal/clients/*`, `internal/handlers/*` への分割）は別 spec/plan で扱う。本 spec の変更が完了した後に着手する。
- HolmesGPT 本体（`panicboat/platform` repo）側の変更は無い。
- `panicboat/platform` repo 側の Alertmanager route plan（`docs/superpowers/plans/2026-08-14-holmes-relay-alertmanager-route.md`）は、hostname が `holmes-relay.dystopia.city` → `holmes.dystopia.city` に変わる影響を受けるが、まだ実行前のため、実行時に該当箇所を更新すればよい。本 spec では platform repo 側のファイルは変更しない。
- frontend/monolith の `services/` からの移動は行わない。
