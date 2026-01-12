# Spec: Timeline

## ADDED Requirements

### Requirement: Cast Timeline Management
キャストは自信のタイムライン投稿を管理できなければならない (MUST be able to manage their timeline posts).
#### Scenario: キャストが新しいタイムライン投稿を行う
- **Given** 私はログイン済みのキャストである
- **When** 私がタイムライン管理ページにアクセスする
- **And** 私がテキスト「Hello World」を入力し、任意で画像をアップロードする
- **And** 私が「Post」ボタンをクリックする
- **Then** 新しい投稿が私のタイムラインリストに表示される
- **And** それがゲスト側の私のプロフィール/フィードに表示される

#### Scenario: キャストが投稿を削除する
- **Given** 私はログイン済みのキャストである
- **And** 私には既存の投稿がある
- **When** 私が投稿の「Delete」をクリックする
- **Then** その投稿がシステムから削除される

### Requirement: Video Post Support
キャストは動画を投稿できなければならない (MUST be able to post videos).
#### Scenario: 動画を投稿する
- **Given** 私はタイムライン管理画面にいる
- **When** 動画ファイルを選択して投稿する
- **Then** タイムライン一覧ではGIFまたは自動再生（ミュート）でプレビュー表示される
- **When** その投稿の詳細ページ（個別ページ）に遷移する
- **Then** 動画プレイヤーが表示され、再生コントロールが使用できる
