# Change: Trust ドメインのタグマスタ廃止とフリーフォーム tagging への移行

## Why

現在の Trust タグ機能はユーザーごとの「タグマスタ」（`trust__tags` テーブル）を経由する二段階の操作が必要（タグ作成 → タグ付与）。
利用を続けるとタグは自然に増加するため、マスタ管理と50個上限は不要な制約であり、UX を阻害している。
フリーフォーム（名前直接入力 → 即付与）に変更することで、操作ステップを半減し、管理ページも不要になる。

また、タグの承認 UI は Phase 2 のレビュー承認と統合して設計する方針とし、Phase 1 ではタグの承認フロー自体を無効化する（全方向で即時反映）。
これによりキャストの承認負荷が Phase 1 で発生しなくなる。

## What Changes

- **BREAKING**: `trust__tags` テーブルを廃止し、`trust__taggings` に `tag_name` カラムを直接持たせる
- **BREAKING**: Proto 定義から `ListTags`, `CreateTag`, `DeleteTag` RPC を削除
- **BREAKING**: `AddTagging` の引数を `tag_id` から `tag_name` に変更
- **BREAKING**: Proto 定義から `ApproveTagging`, `RejectTagging`, `ListPendingTaggings` RPC を削除（Phase 2 で再設計）
- タグの承認フローを無効化: ゲスト→キャスト方向も即時反映（`status` は常に `approved`）
- タグ管理ページ (`/cast/trust/tags`) を削除
- 承認待ちページ (`/cast/trust/pending`) と Cast Home の承認セクションを削除
- TagSelector を「名前入力 → 即付与」のインライン UI に簡素化
- サジェスト機能: 過去に自分が使ったタグ名を `trust__taggings` から取得
- 同一ターゲットへの同名タグ重複問題を解消（unique 制約を `(tag_name, target_id, tagger_id)` に変更）

## Impact

- Affected specs: `trust`（新規作成）
- Affected code:
  - **Proto**: `proto/trust/v1/service.proto`
  - **DB**: `trust__tags` テーブル削除、`trust__taggings` スキーマ変更
  - **Backend**: Repository, Use Cases, gRPC Handler
  - **Frontend**: hooks, components, API routes, pages
