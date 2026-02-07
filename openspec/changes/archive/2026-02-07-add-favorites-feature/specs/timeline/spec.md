# timeline Specification (Delta)

## MODIFIED Requirements

### Requirement: Guest Timeline View

ゲストは全キャストの公開タイムライン投稿を閲覧でき、Favorites タブでお気に入りキャストの投稿をサーバーサイドでフィルタリングできなければならない (MUST)。

#### Scenario: タイムラインのフィルタリング
- **GIVEN** 私はタイムラインを表示している
- **WHEN** 私が「Following」タブを選択する
- **THEN** フォロー中のキャストの投稿のみが表示される
- **WHEN** 私が「Favorites」タブを選択する
- **THEN** お気に入り登録したキャストの投稿のみがサーバーサイドでフィルタリングされて表示される

> **MODIFIED:** Favorites タブのフィルタリングがサーバーサイドで実行されるよう明記。
