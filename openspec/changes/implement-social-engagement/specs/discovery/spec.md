## ADDED Requirements

### Requirement: Follow Cast (MUST)
ゲストは、お気に入りのキャストをフォローして、新着投稿を追いかけられなければならない (MUST)。

#### Scenario: Follow Cast
- **WHEN** ゲストがキャスト詳細ページでフォローボタンをタップしたとき
- **THEN** そのキャストがフォローリストに追加される
- **AND** フォローボタンがフォロー中状態に変わる

#### Scenario: Unfollow Cast
- **WHEN** ゲストがフォロー中のキャストのフォロー解除ボタンをタップしたとき
- **THEN** そのキャストがフォローリストから削除される

#### Scenario: View Following List
- **WHEN** ゲストがフォローリストページを開いたとき
- **THEN** フォロー中のキャスト一覧が表示される

### Requirement: Favorite Cast (MUST)
ゲストは、特に気になるキャストをお気に入りに登録できなければならない (MUST)。

#### Scenario: Add to Favorites
- **WHEN** ゲストがキャストカードまたは詳細ページでハートアイコンをタップしたとき
- **THEN** そのキャストがお気に入りリストに追加される

#### Scenario: Remove from Favorites
- **WHEN** ゲストがお気に入り登録済みのハートアイコンを再度タップしたとき
- **THEN** そのキャストがお気に入りリストから削除される

#### Scenario: View Favorites List
- **WHEN** ゲストがお気に入りリストページを開いたとき
- **THEN** お気に入り登録済みのキャスト一覧が表示される

### Requirement: Block Cast (MUST)
ゲストは、特定のキャストをブロックして、表示から除外できなければならない (MUST)。

#### Scenario: Block Cast
- **WHEN** ゲストがキャスト詳細ページでブロックボタンをタップしたとき
- **THEN** そのキャストがブロックリストに追加される
- **AND** 検索結果やタイムラインからそのキャストが非表示になる

#### Scenario: Unblock Cast
- **WHEN** ゲストがブロックリストでブロック解除ボタンをタップしたとき
- **THEN** そのキャストがブロックリストから削除される

#### Scenario: View Blocked List
- **WHEN** ゲストがブロックリストページを開いたとき
- **THEN** ブロック中のキャスト一覧が表示される

### Requirement: Record Footprints (MUST)
システムは、ゲストがキャストのプロフィールを閲覧した記録（足あと）を保存しなければならない (MUST)。

#### Scenario: Record Profile Visit
- **WHEN** ゲストがキャスト詳細ページを表示したとき
- **THEN** そのキャストの足あとリストにゲストの訪問が記録される

#### Scenario: Cast Views Footprints
- **WHEN** キャストが足あとリストを開いたとき
- **THEN** 自分のプロフィールを訪問したゲストの一覧が時系列で表示される
