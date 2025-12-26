# shell Specification

## Purpose
TBD - created by archiving change feat-app-shell. Update Purpose after archive.
## Requirements
### Requirement: Host Application
- **Description:** システムは単一のエントリーポイントとなるホストアプリケーション (Shell) を持たなければならない (MUST provide a Host Application)。
- **Why:** ユーザー認証状態やルーティングを一元管理するため。
#### Scenario: Application Access
    - Given ユーザーがサイトにアクセスした時
    - When URL がルート (`/`) の時
    - Then Shell アプリケーションがロードされる

### Requirement: API Mocking
- **Description:** 開発環境において、未実装のバックエンド API は MSW によってモックされなければならない (MUST be mocked by MSW in dev)。
- **Why:** バックエンドの実装完了を待たずにフロントエンド開発を進めるため、および不安定なテストを防ぐため。
#### Scenario: Mocked Identity Response
    - Given ローカル開発環境で Shell アプリを起動中
    - When Identity Service の API (`/SignUp` 等) をコールした時
    - Then 実際のサーバーではなく、MSW ハンドラから定義済みのレスポンスが返る

