# Ritual Spec Delta

## REMOVED Requirements

### Requirement: Reservation Detail View
**Reason**: キャスト主体のSNSへの方針転換に伴い、予約機能を削除。
**Migration**: 将来的に必要になった場合は新規設計・実装。

#### Scenario: Removal confirmation
- **WHEN** 予約詳細表示機能が削除されたとき
- **THEN** 関連するUI、API、バックエンドコードがすべて削除される

### Requirement: Reject/Cancel Action
**Reason**: 予約機能の削除に伴い、キャンセル機能も削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** 予約キャンセル機能が削除されたとき
- **THEN** 関連コードがすべて削除される
