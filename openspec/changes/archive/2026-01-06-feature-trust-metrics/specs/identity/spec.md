## ADDED Requirements

### Requirement: User Trust Visualization (MUST)
ユーザー（ゲスト）は、自身のマイページで「誓約履行率（Vow Completion Rate）」を確認できなければならない (MUST)。これにより、ドタキャン等の少なさを証明できる。

#### Scenario: View My Stats
- **WHEN** ゲストがマイページ（GuestDashboard）を表示したとき
- **THEN** 誓約の完了率と回数が表示される。

### Requirement: Cast Trust Visualization (MUST)
キャストプロフィールにおいても、誓約履行率を表示できる機能を実装しなければならない (MUST)。ただし、表示のON/OFFは将来的に検討する。

#### Scenario: View Cast Profile
- **WHEN** キャスト詳細画面を表示したとき
- **THEN** ソーシャルカウントの並びなどの適切な場所に、誓約履行率が表示される。
