## 1. Database Schema Migration

- [ ] 1.1 `trust__taggings` に `tag_name VARCHAR(100)` カラムを追加するマイグレーションを作成
- [ ] 1.2 既存データの `tag_id` → `tag_name` 変換マイグレーションを作成（`trust__tags` から JOIN で名前を取得）
- [ ] 1.3 `tag_id` カラムを削除し、`trust__tags` テーブルを DROP するマイグレーションを作成
- [ ] 1.4 新しい unique 制約 `(tag_name, target_id, tagger_id)` を追加
- [ ] 1.5 ROM relation を更新（`tags` relation 削除、`taggings` relation の属性更新）

## 2. Proto Definition Update

- [ ] 2.1 `ListTags`, `CreateTag`, `DeleteTag` RPC とメッセージを削除
- [ ] 2.2 `ApproveTagging`, `RejectTagging`, `ListPendingTaggings` RPC とメッセージを削除
- [ ] 2.3 `AddTaggingRequest.tag_id` → `AddTaggingRequest.tag_name` に変更
- [ ] 2.4 `ListMyTagNames` RPC を追加（サジェスト用）
- [ ] 2.5 `AddTaggingResponse.status` を削除（常に approved のため不要）
- [ ] 2.6 `buf generate` でスタブ再生成

## 3. Backend Implementation

- [ ] 3.1 `TagRepository` を削除
- [ ] 3.2 `TaggingRepository` を更新: `tag_id` 参照 → `tag_name` 直接格納に変更
- [ ] 3.3 `TaggingRepository` に `list_tagger_tag_names(tagger_id:)` メソッドを追加
- [ ] 3.4 `TaggingRepository` から承認関連メソッドを削除 (`approve`, `reject`, `list_pending_by_target`)
- [ ] 3.5 Use Cases: `CreateTag`, `ListTags`, `DeleteTag` を削除
- [ ] 3.6 Use Cases: `ApproveTagging`, `RejectTagging`, `ListPendingTaggings` を削除
- [ ] 3.7 Use Cases: `AddTagging` を `tag_name` ベースに変更（role チェック削除、常に approved）
- [ ] 3.8 Use Cases: `ListMyTagNames` を作成
- [ ] 3.9 Use Cases: `ListTargetTags` を更新（`tag_repo.find_by_id` が不要に）
- [ ] 3.10 gRPC Handler を更新（新しい RPC 構成に合わせる）
- [ ] 3.11 バックエンドテストを更新

## 4. Frontend API Routes

- [ ] 4.1 `/api/me/trust/tags` route を削除（ディレクトリごと）
- [ ] 4.2 `/api/cast/trust/taggings/pending` route を削除
- [ ] 4.3 `/api/cast/trust/taggings/[id]/approve` route を削除
- [ ] 4.4 `/api/cast/trust/taggings/[id]/reject` route を削除
- [ ] 4.5 `/api/me/trust/taggings` POST を `tag_name` ベースに変更
- [ ] 4.6 `/api/me/trust/tag-names` GET route を追加（サジェスト用）

## 5. Frontend Hooks & Types

- [ ] 5.1 `useTags` hook を削除
- [ ] 5.2 `usePendingTaggings` hook を削除
- [ ] 5.3 `useTaggings` hook を更新: `addTagging` の引数を `tag_name` に変更、承認関連メソッド削除
- [ ] 5.4 `useMyTagNames` SWR hook を追加（サジェスト用）
- [ ] 5.5 types.ts を更新: `Tag`, `PendingTagging` 型を削除、`TaggingStatus` を削除

## 6. Frontend Components & Pages

- [ ] 6.1 `TagSelector` を簡素化: タグ名入力 → 即付与 + サジェスト表示
- [ ] 6.2 `TrustTagsSection` を更新: `useTags` → `useMyTagNames`、承認関連の表示ロジック削除
- [ ] 6.3 `PendingTagItem` コンポーネントを削除
- [ ] 6.4 タグ管理ページ (`/cast/trust/tags/page.tsx`) を削除
- [ ] 6.5 承認待ちページ (`/cast/trust/pending/page.tsx`) を削除
- [ ] 6.6 Cast Home から承認セクションを削除
- [ ] 6.7 MyPage からタグ管理リンクを削除
- [ ] 6.8 TagPill から `pending` variant を削除
- [ ] 6.9 components/index.ts と trust/index.ts の export を更新

## 7. Seed Data & Cleanup

- [ ] 7.1 シードデータを更新（`trust__taggings` に直接 `tag_name` で挿入）
- [ ] 7.2 design document (`docs/plans/2026-02-19-trust-domain-design.md`) を更新

## 8. Verification

- [ ] 8.1 `bundle exec rspec spec/slices/trust/` — バックエンドテスト全パス
- [ ] 8.2 `npx tsc --noEmit` — TypeScript コンパイルチェック
- [ ] 8.3 手動テスト: キャスト → ゲスト タグ付け（即時反映）
- [ ] 8.4 手動テスト: ゲスト → キャスト タグ付け（即時反映）
- [ ] 8.5 手動テスト: サジェストから既存タグ名を選択して付与
- [ ] 8.6 手動テスト: 自分が付けたタグの削除
