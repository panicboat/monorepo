# Discovery Spec Delta

## MODIFIED Requirements

### Requirement: Cast Discovery (MUST)
ユーザーは、タイムラインを通じてキャストの投稿を発見できなければならない (MUST)。

**Note**: ランキング、イベントセクションは削除。タイムラインのみに集中。

#### Scenario: View Timeline
- **WHEN** ユーザーがホーム画面にアクセスしたとき
- **THEN** キャストのリアルタイムな投稿画像とテキストがフィード形式で表示される

### Requirement: Rich Search Visualization (MUST)
検索結果画面は、単なるリストではなく、キャストの魅力が直感的に伝わるビジュアル重視のレイアウトでなければならない (MUST)。検索結果はリアルタイムでバックエンドから取得され、ジャンルによるフィルタリングが可能である。

**Note**: Tonight ステータスフィルタは削除。

#### Scenario: View Search Grid
- **WHEN** ユーザーが検索画面を表示したとき
- **THEN** キャストが大きな写真付きのカード（グリッド形式）で表示され、ジャンル・ひとことコメント等が確認できる

#### Scenario: Filter by Genre
- **WHEN** ユーザーがジャンルフィルタを選択したとき
- **THEN** 選択したジャンルに属するキャストのみが表示される

#### Scenario: Filter by Status
- **WHEN** ユーザーがフィルタータブ（All/Online/New）を選択したとき
- **THEN** 選択した条件に合致するキャストのみが表示される

#### Scenario: Empty Results
- **WHEN** 検索条件に合致するキャストが存在しないとき
- **THEN** 適切な空状態メッセージが表示され、フィルタ条件の緩和を促す

## REMOVED Requirements

### Requirement: View Ranking (part of Cast Discovery)
**Reason**: SNSへの方針転換に伴い、ランキング機能を削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** ランキング機能が削除されたとき
- **THEN** 関連コードがすべて削除される

### Requirement: View Events (part of Cast Discovery)
**Reason**: イベント機能はSNSフェーズでは不要。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** イベント機能が削除されたとき
- **THEN** 関連コードがすべて削除される

### Requirement: View Highlights (part of Rich Search)
**Reason**: Tonight OK や新人特集の横スクロールエリアは削除。
**Migration**: なし。

#### Scenario: Removal confirmation
- **WHEN** ハイライトセクションが削除されたとき
- **THEN** 関連コードがすべて削除される
