# discovery Specification

## Purpose
TBD - created by archiving change implement-full-mock. Update Purpose after archive.
## Requirements
### Requirement: Cast Discovery (MUST)
ユーザーは、様々な切り口（ランキング、タイムライン、イベント）でキャストを発見できなければならない (MUST)。

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

