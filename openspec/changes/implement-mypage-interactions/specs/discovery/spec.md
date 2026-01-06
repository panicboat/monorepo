## ADDED Requirements

### Requirement: Access History (Footprints) (MUST)
ユーザーは、自身のプロフィールを閲覧したキャスト（足あと）を確認できなければならない。

#### Scenario: View Footprints
- **WHEN** ユーザーが足あとリストを開いたとき
- **THEN** 自分のプロフィールを訪問したキャストが時系列で表示される（相互インタラクションのきっかけとなる）。

### Requirement: Timeline Interaction (MUST)
ユーザーは、キャストの投稿に対してリアクション（Like）できなければならない。

#### Scenario: Like Post
- **WHEN** タイムライン上の投稿にある「ハートマーク」をタップしたとき
- **THEN** Like数がカウントアップされ、既読/好意の意思表示ができる。
