# Portfolio Spec Delta

## ADDED Requirements

### Requirement: Cast URL Structure (MUST)
キャスト向け機能の URL は、一貫して `/cast` をプレフィックスとしなければならない (MUST)。

#### Scenario: Access Dashboard
- **Given** ログイン済みのキャストユーザーであるとき
- **When** URL `/cast/home` にアクセスすると
- **Then** キャスト用ダッシュボードが表示される。

#### Scenario: Access Onboarding
- **Given** 未完了のキャストユーザーであるとき
- **When** URL `/cast/onboarding` にアクセスすると
- **Then** オンボーディング画面が表示される。
