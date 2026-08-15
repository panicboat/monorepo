# holmes Flux Registration

## Background

`system-components/holmes/`（旧 `services/holmes-relay/`）は3つのPR（#962〜#964）を経て main にマージ済みだが、実際にはクラスタに一度もデプロイされていない（`kubectl get deployment holmes` → NotFound）。原因を特定した: `clusters/production/kustomization.yaml` → `clusters/production/services/kustomization.yaml` → `monolith`/`frontend` という Flux CD 登録チェーンに `holmes` が一度も追加されていない。`clusters/production/` 配下は `services/` サブディレクトリしか参照しておらず、`system-components/` に相当する登録先が存在しない。

git history 確認済み: `clusters/` 配下に holmes 関連ファイルが作られたことは一度もない。holmes-relay の最初の実装 plan（PR #962）に Flux 登録タスクが含まれていなかったのが根本原因。

## Goal

`holmes` を `frontend`/`monolith` と同じ方法で Flux に登録し、実際にクラスタへデプロイされる状態にする。

## Design

### 1. `clusters/production/system-components/holmes/` を新設

`frontend`/`monolith`（`clusters/production/services/<name>/`）と同一構成の4ファイル + kustomization:

- `service.yaml`: Flux `Kustomization`（名前 `holmes`、`path: ./system-components/holmes/kubernetes/overlays/production`、`sourceRef: GitRepository/monorepo`、`targetNamespace: default`、`postBuild.substitute.service_name: holmes`）
- `image-repository.yaml`: `ImageRepository`（`image: ghcr.io/panicboat/monorepo/holmes`）
- `image-policy.yaml`: `ImagePolicy`（`<service>-vX.Y.Z` タグの semver 抽出パターン、monolith と同一）
- `image-automation.yaml`: `ImageUpdateAutomation`（`update.path: ./system-components/holmes/kubernetes/overlays/production`、main へ直接 commit push、`chore(holmes): bump image to ...`）
- `kustomization.yaml`: 上記4ファイルをまとめる

内容は `clusters/production/services/monolith/*` を一字一句ベースにし、`monolith` → `holmes`、path を `services/monolith` → `system-components/holmes` に置換するだけ（新しい設計判断は無い、純粋な既存パターンの踏襲）。

### 2. `clusters/production/` に `system-components` を登録

- 新規: `clusters/production/system-components/kustomization.yaml`（`resources: [holmes]`、既存の `services/kustomization.yaml` と同型）
- 変更: `clusters/production/kustomization.yaml` の `resources` に `system-components` を追加

### 3. 初回リリースの発行 (手動作業、コードでは自動化できない)

`auto-release--trigger.yaml` は `release: published` イベント駆動のため、`holmes-v0.1.0` のような GitHub Release を手動で作成しないと初回イメージビルドが走らない。この plan のスコープ外（デプロイ後の手動ステップとして README/PR に明記する）。

## Out of Scope

- `holmes-v0.1.0` の Release 作成自体（このリポジトリの通常運用フローに従い、plan 完了後にユーザーが実施）。
- `system-components/` に将来追加される他サービスの登録（今回は `holmes` のみ）。
