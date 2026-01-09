# Design: Profile Enhance UI

## Layout Strategy

### Card Layout
現在のフラットなリスト形式から、セクションごとのカードレイアウトに変更します。
背景色 (`bg-slate-50`) に対し、各セクションを白背景 (`bg-white`) のカードとし、シャドウと角丸 (`rounded-2xl`, `shadow-sm`) を適用します。

### Sections Grouping
1. **Media Section**: 写真アップロード（最重要）
2. **Identity Section**: ニックネーム、タグライン、自己紹介
3. **Basic Specs**: 年齢、身長、血液型、属性（Tags）
4. **Physical Specs**: 3サイズ、カップ数（折りたたみ可能、または「詳細」として分離）
5. **Work Style**: 出勤スタイル、エリア、時間
6. **Social**: SNSリンク

### Components
- `SectionCard`: タイトルとコンテンツ領域を持つ共通コンポーネント。collapsible（折りたたみ）機能をオプションで持つ。
- `SectionNav`: ページ上部に各セクションへのアンカーリンクを配置（チップ形式）。

## Mobile Optimization
モバイルではカードのマージンを調整し、画面幅を有効活用します。
「保存」ボタンは引き続き画面下部に配置するか、フローティングアクションボタン（FAB）を検討します。
