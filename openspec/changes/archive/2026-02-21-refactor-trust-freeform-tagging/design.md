## Context

Trust ドメインの Phase 1 タグ機能が実装済み。現在のデータモデルは `tags`（マスタ）→ `taggings`（付与記録）の二段構成。
ユーザーフィードバックにより、マスタ管理が不要と判断。フリーフォーム方式に移行する。
また、タグの承認フローは Phase 2 のレビュー承認 UI と統合して設計するため、Phase 1 では無効化する。

## Goals / Non-Goals

- Goals:
  - タグ付け操作を1ステップに簡素化する
  - タグ管理ページを不要にする
  - 同名タグの重複表示問題を解消する
  - タグの承認フローを Phase 1 から除外し、Phase 2 で統合承認 UI として再設計する
- Non-Goals:
  - Phase 2（レビュー機能）の設計変更
  - システム定義タグの導入
  - タグの統計・分析機能
  - 統合承認 UI の設計（Phase 2 スコープ）

## Decisions

### Decision 1: `tag_name` を `taggings` テーブルに直接格納

`trust__tags` テーブルを廃止し、`trust__taggings.tag_name` カラムに名前を直接持たせる。

**Alternatives considered:**
- `tags` テーブルを内部キャッシュとして残す → 不要な複雑性。taggings から distinct で取得すれば十分
- グローバルタグマスタに変更 → ユーザー間でタグ名を共有する意味がない

### Decision 2: Unique 制約を `(tag_name, target_id, tagger_id)` に変更

現在: `(tag_id, target_id, tagger_id)` — tag_id ベース
変更後: `(tag_name, target_id, tagger_id)` — 同じ人が同じ対象に同じ名前のタグを2回付けられない

### Decision 3: サジェストは `taggings` テーブルから取得

新しい RPC `ListMyTagNames` で、自分が過去に使ったタグ名の一覧を返す。

```sql
SELECT DISTINCT tag_name FROM trust__taggings WHERE tagger_id = $1 ORDER BY tag_name
```

### Decision 4: Phase 1 ではタグの承認フローを無効化

全方向（キャスト→ゲスト、ゲスト→キャスト）のタグ付与を即時反映（`status = 'approved'`）とする。
`status` カラムは残すが、Phase 1 では常に `approved` が入る。

**Rationale:**
- タグは短い単語で攻撃性が低い
- 承認 UI は Phase 2 でレビュー承認と統合して設計する方が、キャストの承認体験を最適化できる
- `status` カラムを残すことで、Phase 2 で承認制に戻す選択肢を維持する

**Proto への影響:**
- `ApproveTagging`, `RejectTagging`, `ListPendingTaggings` RPC を Phase 1 では削除
- Phase 2 で統合承認 RPC として再設計

### Decision 5: マイグレーション戦略

1. `trust__taggings` に `tag_name` カラムを追加
2. 既存データのマイグレーション: `tag_id` → `tag_name` への変換
3. `tag_id` カラムと `trust__tags` テーブルを削除
4. 新しい unique 制約を追加

## New Schema

```sql
-- trust__taggings: タグの付与記録（tag_name 直接格納）
CREATE TABLE trust__taggings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name VARCHAR(100) NOT NULL,
    tagger_id UUID NOT NULL,
    target_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tag_name, target_id, tagger_id)
);

CREATE INDEX idx_taggings_tagger ON trust__taggings (tagger_id);
CREATE INDEX idx_taggings_target ON trust__taggings (target_id);
CREATE INDEX idx_taggings_target_status ON trust__taggings (target_id, status);
```

## New Proto (Phase 1)

```protobuf
service TrustService {
  rpc AddTagging(AddTaggingRequest) returns (AddTaggingResponse);
  rpc RemoveTagging(RemoveTaggingRequest) returns (RemoveTaggingResponse);
  rpc ListTargetTags(ListTargetTagsRequest) returns (ListTargetTagsResponse);
  rpc ListMyTagNames(ListMyTagNamesRequest) returns (ListMyTagNamesResponse);
}

message AddTaggingRequest {
  string tag_name = 1;
  string target_id = 2;
}

message ListMyTagNamesRequest {}
message ListMyTagNamesResponse {
  repeated string tag_names = 1;
}
```

## Risks / Trade-offs

- **データマイグレーション**: 既存の taggings データを tag_id → tag_name に変換する必要がある。`tags` テーブルが残っている間に実行する
  → Mitigation: マイグレーションを2段階に分け、まず `tag_name` を追加してデータ移行、その後 `tag_id` と `tags` を削除

- **タグ名の正規化**: フリーフォームだと表記揺れが発生しやすい（"VIP" vs "vip" vs "ＶＩＰ"）
  → Mitigation: Phase 1 では strip のみ。大文字小文字は区別する（ユーザーの意図を尊重）

- **承認なしの不正タグ**: ゲストが不適切なタグを付ける可能性がある
  → Mitigation: Phase 2 で承認制を再導入。Phase 1 ではタグが短い単語であるため低リスク

## Open Questions

- なし（ユーザーとの議論で方針確定済み）
