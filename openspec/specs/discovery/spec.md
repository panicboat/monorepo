# discovery Specification

## Purpose
TBD - created by archiving change implement-full-mock. Update Purpose after archive.
## Requirements
### Requirement: Cast Discovery (MUST)
ユーザーは、様々な切り口（ランキング、タイムライン、イベント）でキャストを発見できなければならない。

#### Scenario: View Ranking
- **WHEN** ユーザーがトップページにアクセスしたとき
- **THEN** 「約束履行率（Trust）」や「アクセス数」に基づいたランキングが表示される。

#### Scenario: View Timeline
- **WHEN** ユーザーがタイムラインタブを選択したとき
- **THEN** キャストのリアルタイムな投稿画像とテキストがフィード形式で表示される。

#### Scenario: View Events
- **WHEN** ユーザーがイベントセクションを参照したとき
- **THEN** キャストが主催するキャンペーン情報（割引、バースデー等）が一覧表示される。

### Requirement: Access History (Footprints) (MUST)
ユーザーは、自身のプロフィールを閲覧したキャスト（足あと）を確認できなければならない (MUST)。

#### Scenario: View Footprints
- **WHEN** ユーザーが足あとリストを開いたとき
- **THEN** 自分のプロフィールを訪問したキャストが時系列で表示される（相互インタラクションのきっかけとなる）。

### Requirement: Timeline Interaction (MUST)
ユーザーは、キャストの投稿に対してリアクション（Like）できなければならない (MUST)。

#### Scenario: Like Post
- **WHEN** タイムライン上の投稿にある「ハートマーク」をタップしたとき
- **THEN** Like数がカウントアップされ、既読/好意の意思表示ができる。

