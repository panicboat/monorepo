## MODIFIED Requirements

### Requirement: Rich Search Visualization (MUST)
検索結果画面は、単なるリストではなく、キャストの魅力や状態（One-Liner等）が直感的に伝わるビジュアル重視のレイアウトでなければならない (MUST)。検索結果はリアルタイムでバックエンドから取得される。

#### Scenario: View Search Grid
- **WHEN** ユーザーが検索画面を表示したとき
- **THEN** キャストが大きな写真付きのカード（グリッド形式）で表示され、ひとことコメント等が確認できる。

#### Scenario: View Highlights
- **WHEN** 検索画面を表示したとき
- **THEN** リストの上部または途中に、特定のステータス（Tonight OKや新人など）のキャストが特集された横スクロールエリアが表示される。

#### Scenario: Filter by Status
- **WHEN** ユーザーがフィルタータブ（All/Online/New/Ranking）を選択したとき
- **THEN** 選択した条件に合致するキャストのみが表示される。

#### Scenario: Filter by Tag
- **WHEN** ユーザーが人気タグをタップしたとき
- **THEN** そのタグを持つキャストのみが表示される。

#### Scenario: Empty Results
- **WHEN** 検索条件に合致するキャストが存在しないとき
- **THEN** 適切な空状態メッセージが表示される。
