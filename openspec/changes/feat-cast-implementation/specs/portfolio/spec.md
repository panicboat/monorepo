# Portfolio Spec Delta

## ADDED Requirements

### Requirement: Cast Profile Management (MUST)
キャストは自身のプロフィールを作成・管理できなければならない (MUST)。

#### Scenario: Create Profile
- **Given** 新規登録した直後のキャストユーザーであるとき
- **When** プロフィール作成画面で名前、自己紹介、画像を登録すると
- **Then** キャストプロフィールが作成され、公開状態（またはステータス設定）となる。

#### Scenario: View Profile
- **Given** 作成済みのキャストプロフィールがあるとき
- **When** ゲストがそのキャストのIDを指定してプロフィールを取得すると
- **Then** 名前、自己紹介、ステータスなどの基本情報が返される。
