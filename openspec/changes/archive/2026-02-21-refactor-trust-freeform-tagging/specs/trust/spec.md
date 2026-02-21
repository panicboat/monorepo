## ADDED Requirements

### Requirement: Freeform Tagging

ユーザーはタグ名を直接指定して対象者にタグを付与できなければならない (MUST)。
タグマスタは存在せず、タグ名は `trust__taggings` テーブルに直接格納される。
Phase 1 では全方向のタグ付与が即時反映される（承認不要）。

#### Scenario: Cast tags a guest with a new tag name
- **WHEN** キャストがゲスト詳細ページでタグ名 "VIP" を入力して付与する
- **THEN** `trust__taggings` に `tag_name="VIP"`, `status="approved"` のレコードが作成される
- **AND** ゲスト詳細ページに `#VIP` タグが即座に表示される

#### Scenario: Guest tags a cast with a new tag name
- **WHEN** ゲストがキャスト詳細ページでタグ名 "優しい" を入力して付与する
- **THEN** `trust__taggings` に `tag_name="優しい"`, `status="approved"` のレコードが作成される
- **AND** キャスト詳細ページに `#優しい` タグが即座に表示される

#### Scenario: Duplicate tag name for same target by same tagger
- **WHEN** ユーザーが同じ対象者に同じタグ名を再度付与しようとする
- **THEN** エラー（409 Already Exists）が返される

### Requirement: Tag Name Suggestions

ユーザーが過去に使用したタグ名がサジェストとして表示されなければならない (MUST)。

#### Scenario: Suggest previously used tag names
- **WHEN** ユーザーがタグ付けセクションを表示する
- **THEN** 過去に自分が使用したタグ名の一覧がボタンとして表示される
- **AND** 対象者に既に適用済みのタグ名は disabled + チェック付きで表示される

### Requirement: Tag Removal

ユーザーは自分が付けたタグを削除できなければならない (MUST)。

#### Scenario: Tagger removes their own tag
- **WHEN** タグを付けたユーザーが削除操作を行う
- **THEN** 該当の tagging レコードが削除される
- **AND** UI から即座にタグが消える

#### Scenario: Cannot remove another user's tag
- **WHEN** 他のユーザーのタグを削除しようとする
- **THEN** 操作は失敗する（権限エラー）

## REMOVED Requirements

### Requirement: Per-User Tag Library
**Reason**: タグマスタ管理は不要な複雑性。フリーフォーム方式に置き換え。
**Migration**: `trust__tags` テーブルを削除。既存データは `trust__taggings.tag_name` に移行済み。

### Requirement: Tag Management Page
**Reason**: タグマスタ廃止に伴い、管理ページ (`/cast/trust/tags`) も不要。
**Migration**: MyPage からのリンクも削除。

### Requirement: Tag Approval Flow
**Reason**: Phase 2 でレビュー承認と統合して再設計。Phase 1 ではタグの承認フローを無効化。
**Migration**: 承認待ちページ (`/cast/trust/pending`) と Cast Home の承認セクションを削除。
