# timeline Specification

## Purpose
TBD - created by archiving change feat-add-engagement. Update Purpose after archive.
## Requirements
### Requirement: Cast Timeline Management
キャストは自身のタイムライン投稿を管理できなければならない (MUST)。データはバックエンド（Social ドメイン）に永続化される。1投稿あたり最大10枚のメディア（画像/動画）を添付できる。

#### Scenario: キャストが自分の投稿一覧を表示する
- **GIVEN** 私はログイン済みのキャストである
- **WHEN** 私がタイムライン管理ページにアクセスする
- **THEN** バックエンドから取得した私の投稿一覧が表示される
- **AND** 投稿がない場合は空の状態で表示される

#### Scenario: キャストが複数メディア付きの投稿を行う
- **GIVEN** 私はログイン済みのキャストである
- **WHEN** 私がタイムライン管理ページでテキストを入力し、複数の画像/動画ファイルを選択して「Post」をクリックする
- **THEN** 全てのメディアファイルがアップロードされ、投稿がバックエンドに永続化される
- **AND** 新しい投稿が複数メディアとともにタイムラインに表示される

#### Scenario: メディア上限の制御
- **GIVEN** 私は投稿フォームでメディアを添付している
- **WHEN** 添付メディアが10枚を超えようとする
- **THEN** 追加のメディア選択が拒否され、上限に達していることが表示される

#### Scenario: キャストが投稿を削除する
- **GIVEN** 私はログイン済みのキャストである
- **AND** 私には既存の投稿がある
- **WHEN** 私が投稿の「Delete」をクリックする
- **THEN** その投稿がバックエンドから削除される
- **AND** 投稿一覧から消える

### Requirement: Video Post Support
キャストは動画を投稿できなければならない (MUST be able to post videos).
#### Scenario: 動画を投稿する
- **Given** 私はタイムライン管理画面にいる
- **When** 動画ファイルを選択して投稿する
- **Then** タイムライン一覧ではGIFまたは自動再生（ミュート）でプレビュー表示される
- **When** その投稿の詳細ページ（個別ページ）に遷移する
- **Then** 動画プレイヤーが表示され、再生コントロールが使用できる

### Requirement: Timeline Post Data Model
タイムライン投稿は以下のデータを持たなければならない (MUST have the following data)。

#### Scenario: 投稿データの保存
- **GIVEN** キャストが投稿を作成する
- **WHEN** 投稿が保存される
- **THEN** 以下のデータが永続化される:
  - id: 一意の識別子
  - cast_id: 投稿者のキャストID
  - content: テキスト内容
  - created_at: 作成日時
  - updated_at: 更新日時
- **AND** 投稿にはオプションでメディア（画像/動画）を添付できる

#### Scenario: 投稿表示時にキャスト情報を含める
- **GIVEN** 投稿一覧を取得する
- **WHEN** 投稿データがレスポンスされる
- **THEN** 各投稿にキャストの author 情報（id, name, image_url）が含まれる
- **AND** author 情報は casts テーブルから JOIN して取得される

#### Scenario: いいね・コメント機能はスコープ外
- **GIVEN** 投稿が表示される
- **WHEN** いいね数・コメント数が必要な場合
- **THEN** 常に 0 が返される（機能は別提案で実装予定）

### Requirement: Timeline API
フロントエンドはタイムライン API を通じて投稿を管理できなければならない (MUST be able to manage posts through Timeline API)。

#### Scenario: 投稿一覧の取得
- **GIVEN** 認証済みのキャストユーザー
- **WHEN** GET `/api/cast/timeline?limit=20` を呼び出す
- **THEN** そのキャストの最新20件の投稿が返される
- **AND** `next_cursor` と `has_more` が返される

#### Scenario: 投稿一覧の続きを取得
- **GIVEN** 認証済みのキャストユーザー
- **AND** 20件以上の投稿がある
- **WHEN** GET `/api/cast/timeline?limit=20&cursor={next_cursor}` を呼び出す
- **THEN** カーソル以降の投稿が返される

#### Scenario: 新規投稿の保存
- **GIVEN** 認証済みのキャストユーザー
- **WHEN** PUT `/api/cast/timeline` を id なし、content と任意の media で呼び出す
- **THEN** 投稿が新規作成され、作成された投稿が返される

#### Scenario: 投稿の削除
- **GIVEN** 認証済みのキャストユーザー
- **AND** 自分が作成した投稿がある
- **WHEN** DELETE `/api/cast/timeline?id={postId}` を呼び出す
- **THEN** 投稿が削除される

### Requirement: Post Visibility Status Indicator (MUST)
非表示に設定された投稿は、キャストの管理画面上で明確に「非公開」であることが視覚的に示されなければならない (MUST)。

#### Scenario: Hidden post displays badge
- **GIVEN** 私はキャストのタイムライン管理ページにいる
- **AND** 非表示に設定された投稿がある
- **WHEN** その投稿が画面に表示される
- **THEN** 投稿に「非公開」バッジが表示される
- **AND** 投稿の視覚的スタイルが公開投稿と明確に区別される

#### Scenario: Visibility toggle shows label
- **GIVEN** 私はキャストのタイムライン管理ページにいる
- **WHEN** 投稿の表示/非表示トグルボタンを確認する
- **THEN** ボタンにテキストラベル（「公開中」/「非公開」）が表示される
- **AND** ホバー時にツールチップで操作内容が説明される

#### Scenario: Toast notification on toggle
- **GIVEN** 私はキャストのタイムライン管理ページにいる
- **WHEN** 投稿の表示/非表示を切り替える
- **THEN** 切り替え結果を通知する Toast が表示される（例：「投稿を非公開にしました」）

### Requirement: Multi-Media Post Display (MUST)
複数メディアが添付された投稿は、カルーセル形式で表示されなければならない (MUST)。

#### Scenario: Carousel display on timeline
- **GIVEN** 複数メディアが添付された投稿がある
- **WHEN** タイムライン上でその投稿を表示する
- **THEN** メディアがカルーセル形式で表示される
- **AND** インジケーター（ドット）で現在の位置と総数が分かる
- **AND** スワイプまたはタップで次/前のメディアに切り替えられる

#### Scenario: Grid view shows all media
- **GIVEN** 複数メディアが添付された投稿がある
- **WHEN** タイムラインをグリッドビューで表示する
- **THEN** 投稿の全メディアがグリッドに展開表示される

#### Scenario: Media upload progress
- **GIVEN** 複数メディアを添付して投稿しようとしている
- **WHEN** 「Post」ボタンをクリックする
- **THEN** アップロードの進捗状況が表示される

