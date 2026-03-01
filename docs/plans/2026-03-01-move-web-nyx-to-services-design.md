# Design: services/nyx → services/nyx 移動

## 概要

`services/nyx` を `services/nyx` に移動し、`web/` convention を廃止して全サービスを `services/` に統一する。

## 方針

- `web/` convention を完全廃止
- 全ドキュメント（過去の plans 含む）の参照を `services/nyx` に更新
- アプリケーションコード内は相対パスのため変更不要

## 変更内容

### 1. ディレクトリ移動

- `services/nyx/` → `services/nyx/`
- `web/` ディレクトリ削除（空になるため）

### 2. FluxCD / Clusters

- `clusters/develop/services/nyx/` → `clusters/develop/services/nyx/` に統合
- `clusters/develop/web/` ディレクトリ削除
- `clusters/develop/kustomization.yaml` から `web` リソース削除
- `clusters/develop/services/kustomization.yaml` に `nyx` 追加
- `service.yaml` 内のパス更新

### 3. 設定ファイル

- `workflow-config.yaml` — `web/{service}` convention 削除
- `local-run.sh` — パス修正（cd の連鎖に注意）
- `local-apply.sh` — パス更新

### 4. Claude 設定

- `CLAUDE.md` — アーキテクチャ記載の更新
- `.claude/hooks/check-ui-changes.sh` — git diff パターン更新
- `.claude/skills/record-demo/SKILL.md` — パスパターン更新

### 5. ドキュメント一括置換

- README, ARCHITECTURE, ドメイン定義, plans 配下 — `services/nyx` → `services/nyx`

### 影響なし

- `services/nyx/workspace/` 内のソースコード（相対パスのため）
- `buf.gen.yaml` の proto パス（同じ階層構造のため）
- Dockerfile, docker-compose.yaml（内部完結のため）
