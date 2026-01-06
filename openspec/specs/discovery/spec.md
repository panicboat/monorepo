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

### Requirement: Timeline Filtering (MUST)
ユーザーは、タイムラインに表示される情報を自身の関心度に応じてフィルタリングできなければならない (MUST)。

#### Scenario: Filter by Following
- **WHEN** タイムラインで「Following」タブを選択したとき
- **THEN** フォローしているキャストの投稿のみが表示される。

#### Scenario: Filter by Favorites
- **WHEN** タイムラインで「Favorites」タブを選択したとき
- **THEN** お気に入りに登録しているキャストの投稿のみが表示される。

#### Scenario: Default View
- **WHEN** トップページを開いたとき
- **THEN** デフォルトでは「All（すべて/おすすめ）」が表示される。

### Requirement: Rich Search Visualization (MUST)
検索結果画面は、単なるリストではなく、キャストの魅力や状態（One-Liner等）が直感的に伝わるビジュアル重視のレイアウトでなければならない (MUST)。

#### Scenario: View Search Grid
- **WHEN** ユーザーが検索画面を表示したとき
- **THEN** キャストが大きな写真付きのカード（グリッド形式）で表示され、ひとことコメント等が確認できる。

#### Scenario: View Highlights
- **WHEN** 検索画面を表示したとき
- **THEN** リストの上部または途中に、特定のステータス（Tonight OKや新人など）のキャストが特集された横スクロールエリアが表示される。

### Requirement: Draggable Horizontal Scroll (MUST)
横スクロール可能なセクションは、マウスドラッグ（PC）およびタッチ（SP）の両方で直感的にスクロールできなければならない (MUST)。

#### Scenario: Drag on PC
- **WHEN** PCブラウザで横スクロール領域をマウスでドラッグしたとき
- **THEN** スムーズにスクロールし、慣性スクロールが効くこと。

### Requirement: Scroll Affordance (MUST)
横スクロール可能なセクションは、次項目の存在を視覚的に示唆（チラ見せ）しなければならない (MUST)。

#### Scenario: View Carousel
- **WHEN** カルーセルが表示されたとき
- **THEN** 右端のアイテムが完全には表示されず、一部が見切れている状態で表示され、続きがあることがわかる。

