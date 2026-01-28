## ADDED Requirements

### Requirement: Post Hashtags (MUST)
タイムライン投稿にはハッシュタグを付与できなければならない (MUST)。ハッシュタグは投稿テキストとは別の入力欄で管理される。

#### Scenario: Add hashtags to new post
- **GIVEN** キャストがタイムライン投稿フォームを開いている
- **WHEN** テキストを入力し、ハッシュタグ入力欄に「今日の出勤」「渋谷」と入力して投稿する
- **THEN** 投稿がハッシュタグとともに保存される
- **AND** 投稿表示時にハッシュタグが表示される

#### Scenario: Display hashtags on post
- **GIVEN** ハッシュタグ付きの投稿がある
- **WHEN** タイムラインでその投稿を表示する
- **THEN** 投稿コンテンツの下にハッシュタグがタグ形式で表示される

#### Scenario: Edit hashtags
- **GIVEN** 既存のハッシュタグ付き投稿がある
- **WHEN** キャストがその投稿を編集する
- **THEN** 既存のハッシュタグが入力欄に表示される
- **AND** ハッシュタグを追加・削除して保存できる

#### Scenario: Post without hashtags
- **GIVEN** キャストがタイムライン投稿フォームを開いている
- **WHEN** ハッシュタグを入力せずに投稿する
- **THEN** ハッシュタグなしで投稿が保存される
- **AND** 投稿表示時にハッシュタグ欄は表示されない

## MODIFIED Requirements

### Requirement: Timeline Post Data Model
タイムライン投稿は以下のデータを持たなければならない (MUST have the following data)。

#### Scenario: 投稿データの保存
- **GIVEN** キャストが投稿を作成する
- **WHEN** 投稿が保存される
- **THEN** 以下のデータが永続化される:
  - id: 一意の識別子
  - cast_id: 投稿者のキャストID
  - content: テキスト内容
  - hashtags: ハッシュタグの配列
  - created_at: 作成日時
  - updated_at: 更新日時
- **AND** 投稿にはオプションでメディア（画像/動画）を添付できる

#### Scenario: 投稿表示時にキャスト情報を含める
- **GIVEN** 投稿一覧を取得する
- **WHEN** 投稿データがレスポンスされる
- **THEN** 各投稿にキャストの author 情報（id, name, image_url）が含まれる
- **AND** 各投稿にハッシュタグの配列が含まれる
- **AND** author 情報は casts テーブルから JOIN して取得される

#### Scenario: いいね・コメント機能はスコープ外
- **GIVEN** 投稿が表示される
- **WHEN** いいね数・コメント数が必要な場合
- **THEN** 常に 0 が返される（機能は別提案で実装予定）
