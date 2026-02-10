# Trust Spec Delta

## REMOVED Requirements

### Requirement: Trust Visualization (MUST)
**Reason**: キャスト主体のSNSへの方針転換に伴い、Trust評価機能を削除。
**Migration**: 将来的に必要になった場合は新規設計・実装。

#### Scenario: Removal confirmation
- **WHEN** Trust可視化機能が削除されたとき
- **THEN** レーダーチャートおよび関連コードがすべて削除される

### Requirement: Guest Profile View (CRM)
**Reason**: CRM機能の削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** CRM機能が削除されたとき
- **THEN** 関連コードがすべて削除される
