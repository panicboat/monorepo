## ADDED Requirements

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
