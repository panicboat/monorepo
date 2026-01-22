# Profile Spec Delta

## MODIFIED Requirements

### Requirement: Profile Management

システムは、キャストが自身の公開プロフィール情報を閲覧および編集するためのインターフェースを提供しなければならない (SHALL)。

#### Scenario: View Profile

- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** プロフィール編集ページ (`/cast/profile`) に遷移したとき
- **THEN** オンボーディングで登録した全てのプロフィール情報が表示される
- **AND** 表示される情報には以下が含まれる:
  - 名前 (name)
  - タグライン (tagline)
  - 自己紹介 (bio)
  - サービスカテゴリ (serviceCategory)
  - 出張タイプ (locationType)
  - エリア (area)
  - デフォルトシフト時間 (defaultShiftStart, defaultShiftEnd)
  - SNSリンク (socialLinks)
  - プロフィール画像・ギャラリー画像

#### Scenario: Authenticated API Request

- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** プロフィール編集ページがデータを取得するとき
- **THEN** API リクエストには認証ヘッダー (`Authorization: Bearer {token}`) が含まれなければならない (MUST)
- **AND** トークンが存在しない場合はログインページにリダイレクトされる

#### Scenario: Update Basic Info

- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** プロフィール情報を更新し、保存したとき
- **THEN** 変更内容がバックエンドに永続化される
- **AND** 画面に保存完了が反映される
