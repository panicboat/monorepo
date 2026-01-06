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

