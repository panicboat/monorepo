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

### Requirement: Timeline Post Data Model
タイムライン投稿データに `liked` フラグを追加しなければならない (MUST)。

#### Scenario: 投稿表示時にいいね状態を含める
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** 投稿一覧を取得する
- **THEN** 各投稿に `likes_count` が含まれる
- **AND** 各投稿に自分がいいね済みかどうかの `liked` フラグが含まれる

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

### Requirement: Guest Timeline View

ゲストは全キャストの公開タイムライン投稿を閲覧でき、Favorites タブでお気に入りキャストの投稿をサーバーサイドでフィルタリングできなければならない (MUST)。

#### Scenario: タイムラインのフィルタリング
- **GIVEN** 私はタイムラインを表示している
- **WHEN** 私が「Following」タブを選択する
- **THEN** フォロー中のキャストの投稿のみが表示される
- **WHEN** 私が「Favorites」タブを選択する
- **THEN** お気に入り登録したキャストの投稿のみがサーバーサイドでフィルタリングされて表示される

> **MODIFIED:** Favorites タブのフィルタリングがサーバーサイドで実行されるよう明記。

### Requirement: Guest Timeline API
ゲスト向けタイムライン API は公開投稿を提供しなければならない (MUST)。

#### Scenario: 公開投稿一覧の取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/timeline?limit=20` を呼び出す
- **THEN** 全キャストの公開投稿が最新20件返される
- **AND** `next_cursor` と `has_more` が返される
- **AND** 非公開投稿は含まれない

#### Scenario: キャスト別投稿一覧の取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/timeline?cast_id={castId}&limit=20` を呼び出す
- **THEN** 指定したキャストの公開投稿のみが返される

#### Scenario: 投稿詳細の取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/timeline/{postId}` を呼び出す
- **THEN** 指定した投稿の詳細が返される
- **AND** 非公開投稿の場合は 404 が返される

### Requirement: Cast Profile Timeline Tab
ゲストはキャスト詳細ページでそのキャストの投稿一覧を閲覧できなければならない (MUST)。

#### Scenario: キャスト詳細ページでタイムラインを表示する
- **GIVEN** 私はキャスト詳細ページを表示している
- **WHEN** 私が「タイムライン」タブを選択する
- **THEN** そのキャストの公開投稿のみが表示される

#### Scenario: メディアのみ表示
- **GIVEN** 私はキャスト詳細ページのタイムラインタブを表示している
- **WHEN** 私が「Media」フィルタを選択する
- **THEN** メディアが添付された投稿のみがグリッド形式で表示される

### Requirement: Post Detail Page
ゲストは投稿詳細ページで投稿の全情報を閲覧できなければならない (MUST)。

#### Scenario: 投稿詳細ページを表示する
- **GIVEN** 私はタイムライン上の投稿をタップした
- **WHEN** 投稿詳細ページが表示される
- **THEN** 投稿のテキスト、メディア、ハッシュタグが表示される
- **AND** 投稿者のキャスト情報が表示される
- **AND** 動画の場合は再生コントロール付きで表示される

#### Scenario: 投稿からキャスト詳細へ遷移
- **GIVEN** 私は投稿詳細ページを表示している
- **WHEN** 私がキャストの名前またはアバターをタップする
- **THEN** そのキャストの詳細ページに遷移する

### Requirement: Post Like Feature
ゲストはタイムライン投稿にいいねできなければならない (MUST)。いいねはゲストごとに1投稿に対して1回のみ可能。

#### Scenario: ゲストが投稿にいいねする
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はまだいいねしていない投稿を見ている
- **WHEN** 私がいいねボタンをタップする
- **THEN** いいねがバックエンドに保存される
- **AND** いいね数が +1 される
- **AND** いいねボタンがいいね済み状態に変わる

#### Scenario: ゲストがいいねを取り消す
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は既にいいね済みの投稿を見ている
- **WHEN** 私がいいねボタンをタップする
- **THEN** いいねがバックエンドから削除される
- **AND** いいね数が -1 される
- **AND** いいねボタンが未いいね状態に変わる

#### Scenario: いいね状態の読み込み
- **GIVEN** 私はログイン済みのゲストである
- **WHEN** 私がタイムラインを表示する
- **THEN** 各投稿のいいね済み状態が表示される
- **AND** 自分がいいねした投稿はいいねボタンがいいね済み状態で表示される

#### Scenario: いいね数のリアルタイム表示
- **GIVEN** 投稿がタイムラインに表示されている
- **WHEN** いいね数を確認する
- **THEN** 実際のいいね数がバックエンドから取得されて表示される

### Requirement: Like API
いいね機能は API を通じて操作できなければならない (MUST)。

#### Scenario: いいねの追加
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** POST `/api/guest/likes` を post_id を指定して呼び出す
- **THEN** いいねが保存され、最新の likes_count が返される
- **AND** 既にいいね済みの場合は変更なしで現在の likes_count が返される

#### Scenario: いいねの取り消し
- **GIVEN** 認証済みのゲストユーザー
- **AND** 対象投稿にいいね済みである
- **WHEN** DELETE `/api/guest/likes?post_id={postId}` を呼び出す
- **THEN** いいねが削除され、最新の likes_count が返される

#### Scenario: いいね状態の一括取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/likes/status?post_ids={id1,id2,...}` を呼び出す
- **THEN** 各投稿のいいね済み状態がマップ形式で返される

### Requirement: Cast Follow Feature
ゲストはキャストをフォローできなければならない (MUST)。フォローはバックエンドに永続化され、デバイス間で同期される。

#### Scenario: ゲストがキャストをフォローする
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はまだフォローしていないキャストの詳細ページを見ている
- **WHEN** 私がフォローボタンをタップする
- **THEN** フォローがバックエンドに保存される
- **AND** フォローボタンがフォロー中状態に変わる

#### Scenario: ゲストがフォローを解除する
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は既にフォロー中のキャストの詳細ページを見ている
- **WHEN** 私がフォローボタンをタップする
- **THEN** フォローがバックエンドから削除される
- **AND** フォローボタンが未フォロー状態に変わる

#### Scenario: フォロー状態の読み込み
- **GIVEN** 私はログイン済みのゲストである
- **WHEN** 私がキャスト詳細ページを表示する
- **THEN** フォロー済み状態がバックエンドから取得されて表示される

#### Scenario: フォロー中キャストのタイムライン表示
- **GIVEN** 私はログイン済みのゲストである
- **AND** 私は複数のキャストをフォローしている
- **WHEN** 私がタイムラインの Following タブを選択する
- **THEN** フォロー中のキャストの投稿のみが表示される
- **AND** フィルタリングはサーバーサイドで実行される

### Requirement: Follow API
フォロー機能は API を通じて操作できなければならない (MUST)。

#### Scenario: フォローの追加
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** POST `/api/guest/following` を cast_id を指定して呼び出す
- **THEN** フォローが保存され、成功フラグが返される
- **AND** 既にフォロー済みの場合は変更なしで成功が返される

#### Scenario: フォローの解除
- **GIVEN** 認証済みのゲストユーザー
- **AND** 対象キャストをフォロー中である
- **WHEN** DELETE `/api/guest/following?cast_id={castId}` を呼び出す
- **THEN** フォローが削除され、成功フラグが返される

#### Scenario: フォロー中リストの取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/following?limit=100` を呼び出す
- **THEN** フォロー中の cast_id リストが返される
- **AND** ページネーションに対応している

#### Scenario: フォロー状態の一括取得
- **GIVEN** 認証済みのゲストユーザー
- **WHEN** GET `/api/guest/following/status?cast_ids={id1,id2,...}` を呼び出す
- **THEN** 各キャストのフォロー状態がマップ形式で返される

### Requirement: User Block Feature

ユーザーは他のユーザーをブロックできなければならない (MUST)。ブロックはバックエンドに永続化され、デバイス間で同期される。ブロックされたユーザーのコンテンツは表示されなくなる。

#### Scenario: ゲストがキャストをブロックする

- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はブロックしていないキャストの詳細ページを見ている
- **WHEN** 私がブロックボタンをタップする
- **THEN** ブロックがバックエンドに保存される
- **AND** そのキャストの投稿がタイムラインから非表示になる
- **AND** 確認のトーストメッセージが表示される

#### Scenario: ゲストがキャストのブロックを解除する

- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はブロック中のキャストがいる
- **WHEN** 私がブロック管理画面でブロック解除ボタンをタップする
- **THEN** ブロックがバックエンドから削除される
- **AND** そのキャストの投稿が再びタイムラインに表示される

#### Scenario: キャストがゲストをブロックする

- **GIVEN** 私はログイン済みのキャストである
- **AND** 私の投稿にコメントしたゲストがいる
- **WHEN** 私がそのゲストをブロックする
- **THEN** ブロックがバックエンドに保存される
- **AND** そのゲストからのコメントが非表示になる
- **AND** そのゲストは私の投稿にいいね・コメントできなくなる

#### Scenario: ブロックしたユーザーの投稿が非表示になる

- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はキャスト A をブロックしている
- **WHEN** 私がタイムラインを表示する
- **THEN** キャスト A の投稿は表示されない
- **AND** 他のキャストの投稿は通常通り表示される

#### Scenario: ブロックしたユーザーのコメントが非表示になる

- **GIVEN** 私はログイン済みのゲストである
- **AND** 私はユーザー B をブロックしている
- **WHEN** 私が投稿のコメント欄を表示する
- **THEN** ユーザー B のコメントは表示されない

### Requirement: Block API

ブロック機能は API を通じて操作できなければならない (MUST)。

#### Scenario: ブロックの追加

- **GIVEN** 認証済みのユーザー
- **WHEN** POST `/api/{user_type}/blocks` を blocked_id と blocked_type を指定して呼び出す
- **THEN** ブロックが保存され、成功フラグが返される
- **AND** 既にブロック済みの場合は変更なしで成功が返される

#### Scenario: ブロックの解除

- **GIVEN** 認証済みのユーザー
- **AND** 対象ユーザーをブロック中である
- **WHEN** DELETE `/api/{user_type}/blocks?blocked_id={id}` を呼び出す
- **THEN** ブロックが削除され、成功フラグが返される

#### Scenario: ブロックリストの取得

- **GIVEN** 認証済みのユーザー
- **WHEN** GET `/api/{user_type}/blocks?limit=50` を呼び出す
- **THEN** ブロック中のユーザーリストが返される
- **AND** ページネーションに対応している

#### Scenario: ブロック状態の一括取得

- **GIVEN** 認証済みのユーザー
- **WHEN** GET `/api/{user_type}/blocks/status?user_ids={id1,id2,...}` を呼び出す
- **THEN** 各ユーザーのブロック状態がマップ形式で返される

### Requirement: Block Management UI

ユーザーは設定画面からブロックリストを管理できなければならない (MUST)。

#### Scenario: ブロックリストを表示する

- **GIVEN** 私はログイン済みのユーザーである
- **WHEN** 私が設定画面の「ブロックリスト」を開く
- **THEN** ブロック中のユーザー一覧が表示される
- **AND** 各ユーザーの名前とアバターが表示される

#### Scenario: ブロックリストからブロック解除する

- **GIVEN** 私はブロックリストを表示している
- **AND** ブロック中のユーザーがいる
- **WHEN** 私がユーザーの「ブロック解除」ボタンをタップする
- **THEN** 確認ダイアログが表示される
- **AND** 確認後、ブロックが解除される
- **AND** そのユーザーがリストから消える

### Requirement: Follow Approval Workflow (MUST)
private キャストへのフォローは承認制でなければならない (MUST)。public キャストは即時フォローが成立する。

#### Scenario: Follow Public Cast
- **Given** visibility が "public" のキャストがいるとき
- **When** ゲストがフォローボタンを押すと
- **Then** 即座にフォロー関係が成立する（status: approved）
- **And** ゲストのタイムラインにキャストの投稿が表示される

#### Scenario: Request Follow Private Cast
- **Given** visibility が "private" のキャストがいるとき
- **When** ゲストがフォローリクエストを送ると
- **Then** フォローリクエストが作成される（status: pending）
- **And** キャストの承認待ち一覧に表示される

#### Scenario: Approve Follow Request
- **Given** pending 状態のフォローリクエストがあるとき
- **When** キャストが承認すると
- **Then** status が "approved" に更新される
- **And** ゲストのタイムラインにキャストの投稿が表示される

#### Scenario: Reject Follow Request
- **Given** pending 状態のフォローリクエストがあるとき
- **When** キャストが拒否すると
- **Then** フォローリクエストが削除される
- **And** ゲストは再度フォローリクエストを送れる

#### Scenario: Cancel Follow Request
- **Given** pending 状態のフォローリクエストがあるとき
- **When** ゲストがリクエストをキャンセルすると
- **Then** フォローリクエストが削除される

#### Scenario: Change to Private
- **Given** public キャストが private に変更したとき
- **Then** 既存の approved フォローは維持される
- **And** 新規フォローは承認制になる

#### Scenario: Change to Public
- **Given** private キャストが public に変更したとき
- **Then** 既存の approved フォローは維持される
- **And** pending 状態のフォローリクエストは全て approved に自動昇格される
- **And** 新規フォローは即時フォローになる

