## ADDED Requirements

### Requirement: Genre Master (MUST)
システムはジャンルマスターを持たなければならない (MUST)。ジャンルはキャストの分類の軸となり、ゲスト検索の主要フィルタとして機能する。初期ジャンルはシードデータとして提供される。

#### Scenario: List genres
- **WHEN** キャストまたはゲストがジャンル一覧を取得するとき
- **THEN** アクティブなジャンルが表示順に返される

### Requirement: Cast Genre Selection (MUST)
キャストは登録時および編集時に1つ以上のジャンルを選択しなければならない (MUST)。

#### Scenario: Cast selects genres on registration
- **WHEN** キャストがオンボーディングを完了するとき
- **THEN** 最低1つのジャンルが選択されている必要がある

#### Scenario: Cast updates genres
- **WHEN** キャストがプロフィール編集でジャンルを変更するとき
- **THEN** 選択したジャンルが保存され、検索結果に反映される

### Requirement: Cast Free Tags (MUST)
キャストは自由にタグを追加できなければならない (MUST)。タグは検索補助として機能し、表記ゆれは許容される。

#### Scenario: Cast adds tags
- **WHEN** キャストがプロフィール編集でタグを追加するとき
- **THEN** タグがプロフィールに保存され、検索で使用可能になる

#### Scenario: Popular tags display
- **WHEN** ゲストが検索画面を表示したとき
- **THEN** 人気タグが使用頻度順に表示される

## MODIFIED Requirements

### Requirement: Rich Search Visualization (MUST)
検索結果画面は、単なるリストではなく、キャストの魅力や状態が直感的に伝わるビジュアル重視のレイアウトでなければならない (MUST)。検索結果はリアルタイムでバックエンドから取得され、ジャンル・ステータス・タグによる複合フィルタリングが可能である。

#### Scenario: View Search Grid
- **WHEN** ユーザーが検索画面を表示したとき
- **THEN** キャストが大きな写真付きのカード（グリッド形式）で表示され、ジャンル・ひとことコメント等が確認できる

#### Scenario: View Highlights
- **WHEN** 検索画面を表示したとき
- **THEN** リストの上部に、特定のステータス（Tonight OKや新人など）のキャストが特集された横スクロールエリアが表示される

#### Scenario: Filter by Genre
- **WHEN** ユーザーがジャンルフィルタを選択したとき
- **THEN** 選択したジャンルに属するキャストのみが表示される

#### Scenario: Filter by Status
- **WHEN** ユーザーがフィルタータブ（All/Online/New/Ranking）を選択したとき
- **THEN** 選択した条件に合致するキャストのみが表示される

#### Scenario: Filter by Tag
- **WHEN** ユーザーが人気タグをタップしたとき
- **THEN** そのタグを持つキャストのみが表示される

#### Scenario: Combined Filters
- **WHEN** ユーザーがジャンル・ステータス・タグを組み合わせてフィルタリングするとき
- **THEN** すべての条件に合致するキャストのみが表示される

#### Scenario: Empty Results
- **WHEN** 検索条件に合致するキャストが存在しないとき
- **THEN** 適切な空状態メッセージが表示され、フィルタ条件の緩和を促す
