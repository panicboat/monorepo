## ADDED Requirements

### Requirement: Post Visibility Status Indicator (MUST)
非表示に設定された投稿は、キャストの管理画面上で明確に「非公開」であることが視覚的に示されなければならない (MUST)。

#### Scenario: Hidden post displays badge
- **GIVEN** 私はキャストのタイムライン管理ページにいる
- **AND** 非表示に設定された投稿がある
- **WHEN** その投稿が画面に表示される
- **THEN** 投稿に「非公開」バッジが表示される
- **AND** 投稿の視覚的スタイルが公開投稿と明確に区別される

#### Scenario: Visibility toggle shows label
- **GIVEN** 私はキャストのタイムライン管理ページにいる
- **WHEN** 投稿の表示/非表示トグルボタンを確認する
- **THEN** ボタンにテキストラベル（「公開中」/「非公開」）が表示される
- **AND** ホバー時にツールチップで操作内容が説明される

#### Scenario: Toast notification on toggle
- **GIVEN** 私はキャストのタイムライン管理ページにいる
- **WHEN** 投稿の表示/非表示を切り替える
- **THEN** 切り替え結果を通知する Toast が表示される（例：「投稿を非公開にしました」）
