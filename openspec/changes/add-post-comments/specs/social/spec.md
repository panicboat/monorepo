## ADDED Requirements

### Requirement: Post Comment Creation (MUST)
認証済みユーザー（ゲスト・キャスト）は、タイムラインのポストにコメントを投稿できなければならない (MUST)。

#### Scenario: Guest comments on a post
- **GIVEN** 私はログイン済みのゲストユーザーである
- **AND** タイムラインにキャストのポストが表示されている
- **WHEN** そのポストのコメント欄にテキストを入力し、送信ボタンをクリックする
- **THEN** コメントがバックエンドに保存される
- **AND** コメント一覧に即座に表示される
- **AND** ポストの `comments_count` が増加する

#### Scenario: Cast replies to a comment
- **GIVEN** 私はログイン済みのキャストである
- **AND** 私のポストにゲストからのコメントがある
- **WHEN** そのコメントの「返信」ボタンをクリックし、返信テキストを入力して送信する
- **THEN** 返信が元のコメントの下にネストされて表示される
- **AND** 返信は `parent_id` で元のコメントに紐づけられる

#### Scenario: Comment content validation
- **GIVEN** 私はコメントを投稿しようとしている
- **WHEN** 空のテキストで送信しようとする
- **THEN** 送信が拒否される
- **AND** テキスト入力が必須であることが示される

#### Scenario: Comment length limit
- **GIVEN** 私はコメントを投稿しようとしている
- **WHEN** 1000文字を超えるテキストを入力する
- **THEN** 文字数超過であることが警告される

### Requirement: Post Comment Listing (MUST)
ポストのコメントは、親子関係を含む形でスレッド表示されなければならない (MUST)。

#### Scenario: View comments on a post
- **GIVEN** コメントが付いたポストがある
- **WHEN** そのポストのコメントセクションを表示する
- **THEN** トップレベルのコメントが時系列順に表示される
- **AND** 各コメントに対する返信（子コメント）がネストされて表示される
- **AND** コメント投稿者の名前とアバターが表示される

#### Scenario: Comments thread structure
- **GIVEN** あるコメントに対して返信が存在する
- **WHEN** コメント一覧を表示する
- **THEN** 返信は親コメントの直下にインデント付きで表示される
- **AND** スレッドは1階層のネストまでサポートされる（返信の返信は不可）

### Requirement: Post Comment Deletion (MUST)
コメント投稿者またはポストのキャスト（オーナー）は、コメントを削除できなければならない (MUST)。

#### Scenario: Comment author deletes own comment
- **GIVEN** 私はコメントを投稿したユーザーである
- **WHEN** そのコメントの削除ボタンをクリックする
- **THEN** コメントが削除される
- **AND** ポストの `comments_count` が減少する

#### Scenario: Cast deletes comment on own post
- **GIVEN** 私はポストを投稿したキャストである
- **AND** 私のポストに他ユーザーのコメントがある
- **WHEN** そのコメントの削除ボタンをクリックする
- **THEN** コメントが削除される（モデレーション権限）

#### Scenario: Unauthorized deletion attempt
- **GIVEN** 私はコメントの投稿者でもポストのキャストでもないユーザーである
- **WHEN** コメントを削除しようとする
- **THEN** 削除ボタンが表示されない
- **AND** API レベルでも権限エラーが返される

### Requirement: Post Comment Data Model (MUST)
コメントは以下のデータを持たなければならない (MUST)。

#### Scenario: Comment data persistence
- **GIVEN** コメントが作成される
- **WHEN** データが保存される
- **THEN** 以下のフィールドが永続化される:
  - id: 一意の識別子（UUID）
  - post_id: 対象ポストのID
  - user_id: コメント投稿者のユーザーID
  - parent_id: 返信先コメントのID（トップレベルの場合は NULL）
  - content: テキスト内容（最大1000文字）
  - created_at: 作成日時
