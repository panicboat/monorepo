## ADDED Requirements

### Requirement: Guest Profile Data Model
システムはゲストプロフィールのデータを管理しなければならない (MUST)。`portfolio__guests` テーブルは `portfolio__casts` と同様のスキーマパターンを使用し、Identity ドメインの `users` テーブルと1対1で紐付く。

#### Scenario: Data Structure
- **WHEN** ゲストがプロフィールを作成する
- **THEN** 以下のデータ構造がサポートされる:
  - `id`: プライマリキー (UUID)
  - `user_id`: Identity との紐付け (UUID, 必須, ユニーク)
  - `name`: 表示名 (文字列, 必須, 1-20文字) ※キャストと同じフィールド名
  - `avatar_path`: アバター画像パス (文字列)
  - `created_at`: 作成日時
  - `updated_at`: 更新日時

### Requirement: Guest Onboarding Flow
システムはゲスト登録直後にプロフィール設定を強制しなければならない (MUST)。オンボーディング未完了のゲストは他の機能にアクセスできない。

#### Scenario: Redirect to Onboarding
- **GIVEN** プロフィール未設定のゲストユーザーがログインしている
- **WHEN** 認証が必要なページにアクセスする
- **THEN** `/onboarding` にリダイレクトされる

#### Scenario: Complete Onboarding
- **GIVEN** ゲストが `/onboarding` ページにいる
- **WHEN** 名前とアバター画像を設定して保存する
- **THEN** ゲストプロフィールが作成される
- **AND** ホーム画面（`/`）にリダイレクトされる

#### Scenario: Onboarding Validation
- **GIVEN** ゲストが `/onboarding` ページにいる
- **WHEN** 名前が空または20文字を超える場合
- **THEN** バリデーションエラーが表示される
- **AND** 保存は実行されない

### Requirement: Shared Media Uploader Components
システムはキャストとゲストで共通のメディアアップローダーコンポーネント群を提供しなければならない (MUST)。`AvatarUploader`（単一メディア用）と `GalleryUploader`（複数メディア用）を提供し、共通基盤として `MediaUploader` を使用する。

#### Scenario: Avatar Upload Flow
- **GIVEN** ユーザー（キャストまたはゲスト）がアバター設定画面にいる
- **WHEN** 画像ファイルを選択する
- **THEN** 円形にクロップされたプレビューが表示される
- **AND** `/api/{role}/upload-url` で署名付きURLを取得してアップロードする

#### Scenario: Gallery Upload Flow
- **GIVEN** キャストがギャラリー設定画面にいる
- **WHEN** 複数の画像または動画ファイルを選択する
- **THEN** グリッド形式でプレビューが表示される
- **AND** 最初のメディアがカバーとして使用される

#### Scenario: Local Storage Support
- **GIVEN** 開発環境でローカルストレージを使用している
- **WHEN** メディアをアップロードする
- **THEN** `/storage/upload?key=xxx` に PUT して `public/uploads/` に保存される
- **AND** 本番環境では S3 にアップロードされる

#### Scenario: Avatar Fallback
- **GIVEN** アバターが未設定のユーザーである
- **WHEN** アバターを表示する場面がある
- **THEN** システムデフォルトの画像が表示される

### Requirement: Guest Profile Management
ゲストはマイページから自身のプロフィールを閲覧・編集できなければならない (MUST)。

#### Scenario: View Profile in MyPage
- **GIVEN** ログイン済みのゲストユーザーである
- **WHEN** マイページにアクセスする
- **THEN** 現在の名前とアバターが表示される

#### Scenario: Edit Name
- **GIVEN** ゲストがマイページのプロフィール編集画面にいる
- **WHEN** 名前を変更して保存する
- **THEN** 新しい名前が永続化される
- **AND** マイページに反映される

#### Scenario: Edit Avatar
- **GIVEN** ゲストがマイページのプロフィール編集画面にいる
- **WHEN** 新しいアバター画像をアップロードして保存する
- **THEN** 新しいアバターが永続化される
- **AND** マイページに反映される

### Requirement: Guest Profile API
システムはゲストプロフィールを操作するための gRPC API を提供しなければならない (MUST)。`GuestService` として独立したサービスを定義し、`GetGuestProfile`、`SaveGuestProfile`、`GetUploadUrl` の3つの RPC を提供する。

#### Scenario: Get Guest Profile
- **GIVEN** 認証済みのゲストユーザーである
- **WHEN** `GetGuestProfile` を呼び出す
- **THEN** 現在のゲストプロフィールが返される
- **AND** プロフィールが存在しない場合は空のプロフィール（未設定状態）が返される

#### Scenario: Save Guest Profile
- **GIVEN** 認証済みのゲストユーザーである
- **WHEN** `SaveGuestProfile` を呼び出す
- **THEN** プロフィールが存在しない場合は新規作成される
- **AND** プロフィールが存在する場合は更新される
- **AND** 保存されたプロフィールが返される

### Requirement: Guest Profile Visibility to Cast
キャストはチャットや予約の際にゲストのプロフィール情報を閲覧できなければならない (MUST)。

#### Scenario: Display Guest Info in Chat
- **GIVEN** キャストがゲストとのチャット画面を開いている
- **WHEN** チャット一覧またはチャット詳細を表示する
- **THEN** ゲストの名前とアバターが表示される

#### Scenario: Display Guest Info in Reservation
- **GIVEN** キャストが予約一覧を閲覧している
- **WHEN** 予約詳細を表示する
- **THEN** 予約したゲストの名前とアバターが表示される
