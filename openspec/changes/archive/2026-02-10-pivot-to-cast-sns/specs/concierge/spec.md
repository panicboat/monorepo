# Concierge Spec Delta

## REMOVED Requirements

### Requirement: Smart Concierge (MUST)
**Reason**: キャスト主体のSNSへの方針転換に伴い、チャット機能を削除。
**Migration**: 将来的に必要になった場合は新規設計・実装。

#### Scenario: Removal confirmation
- **WHEN** Concierge機能が削除されたとき
- **THEN** 関連するUI、API、バックエンドコードがすべて削除される

### Requirement: Smart Invitation
**Reason**: チャット機能の削除に伴い、招待状機能も削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** 招待状機能が削除されたとき
- **THEN** 関連コードがすべて削除される

### Requirement: Display Guest Profile
**Reason**: CRMビューはConcierge/Trustドメインの削除に伴い削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** ゲストプロフィール表示機能が削除されたとき
- **THEN** 関連コードがすべて削除される

### Requirement: Deep CRM (Notes)
**Reason**: CRM機能はTrustドメインの削除に伴い削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** CRMメモ機能が削除されたとき
- **THEN** 関連コードがすべて削除される

### Requirement: Concierge Chat Interface
**Reason**: チャット機能の削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** チャットインターフェースが削除されたとき
- **THEN** 関連コードがすべて削除される

### Requirement: Smart Suggestions
**Reason**: 招待状機能の削除に伴い、日時提案機能も削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** 日時提案機能が削除されたとき
- **THEN** 関連コードがすべて削除される
