# identity Specification

## Purpose
TBD - created by archiving change feat-service-identity. Update Purpose after archive.
## Requirements
### Requirement: User Management
- **Description:** システムはユーザー (Cast および Guest) の登録と管理を行わなければならない (MUST manage user registration and data)。
- **Why:** 本システムを利用するすべてのアクターのID管理を行うため。
#### Scenario: User Registration
    - Given 未登録のユーザー
    - When 登録リクエストを送信する時
    - Then 新しいユーザーIDが発行され、`users` テーブルにレコードが作成される

### Requirement: Authentication Logging
- **Description:** 認証の試行はログとして記録されなければならない (MUST be logged)。
- **Why:** セキュリティ監査および不正アクセスの検知のため。
#### Scenario: Login Attempt
    - Given ユーザーがログインしようとした時
    - When 認証が成功または失敗した時
    - Then その結果と日時が `auth_logs` に記録される

### Requirement: Role Based Access Control
- **Description:** ユーザーはロール (Guest/Cast/Admin) を持ち、それに基づいて権限が制御されなければならない (MUST enforce RBAC)。
- **Why:** キャスト向け機能とゲスト向け機能を明確に分離するため。
#### Scenario: Role Assignment
    - Given ユーザー登録時
    - When ユーザータイプを指定する時
    - Then 適切なロールがユーザーに付与される

