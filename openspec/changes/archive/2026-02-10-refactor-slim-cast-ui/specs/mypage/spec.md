## MODIFIED Requirements

### Requirement: New MyPage Layout
`cast_mypage_demo.html` をベースにしたマイページを作成しなければならない (MUST)。

#### Scenario: Profile Header
1. マイページ上部にプロフィールヘッダーが表示されることを確認する。
2. アイコン、名前、バッジが表示されていること。

#### Scenario: Stats Display
1. フォロワー数 (Followers) が表示されることを確認する。

### Requirement: Management Menu
管理メニューの一覧を表示し、各機能へ遷移できなければならない (MUST)。

#### Scenario: Profile Edit Transition
1. "プロフィール編集" ボタンをタップする。
2. 現在のプロフィール編集画面 (`/cast/profile`) に遷移することを確認する。

#### Scenario: Plan Settings Transition
1. "招待状プラン設定" ボタンをタップする。
2. プラン設定画面 (`/cast/plans`) に遷移することを確認する。

#### Scenario: Follower List Transition
1. "フォロワーリスト" ボタンをタップする。
2. フォロワーリスト画面 (`/cast/followers`) に遷移することを確認する。

### Requirement: Account Menu
アカウント関連のメニューを表示しなければならない (MUST)。

#### Scenario: Block List
1. "ブロックリスト" ボタンが表示されていることを確認する。

#### Scenario: Logout
1. "ログアウト" ボタンが表示されていることを確認する。

## ADDED Requirements

### Requirement: Profile Edit Default Open State
プロフィール編集画面の各セクションは、デフォルトで開いた状態で表示されなければならない (MUST be expanded by default)。

#### Scenario: Sections expanded on load
- **WHEN** キャストがプロフィール編集画面にアクセスする
- **THEN** すべての編集セクション（アバター、写真、基本情報、など）が展開された状態で表示される
- **AND** ユーザーは即座に編集を開始できる

#### Scenario: Section can be collapsed
- **WHEN** キャストがセクションヘッダーをタップする
- **THEN** そのセクションが折りたたまれる
- **AND** 再度タップすると展開される

### Requirement: Follower List Page
キャストは、自分をフォローしているゲストの一覧を閲覧・管理できなければならない (MUST be able to view and manage followers).

#### Scenario: View follower list
- **WHEN** キャストがフォロワーリスト画面（`/cast/followers`）にアクセスする
- **THEN** フォロワーの一覧が表示される
- **AND** 各フォロワーのアバター、名前、フォロー日時が表示される

#### Scenario: Follower list pagination
- **WHEN** フォロワーが多数いる場合
- **THEN** 無限スクロールまたはページネーションで追加のフォロワーを読み込める

#### Scenario: Remove follower
- **WHEN** キャストがフォロワーの「削除」ボタンをタップする
- **THEN** 確認ダイアログが表示される
- **AND** 確認後、そのゲストがフォロワーから削除される

#### Scenario: Empty follower list
- **WHEN** キャストにフォロワーがいない
- **THEN** 「フォロワーはいません」という空状態メッセージが表示される

## REMOVED Requirements

### Requirement: Review Management Menu
**Reason**: レビュー管理は Trust ドメインに属するため、3ドメイン構成では不要。
**Migration**: 将来 Trust ドメイン実装時に復活予定。マイページのメニューから削除。

### Requirement: History Sales Menu
**Reason**: 履歴・売上は Trust/Ritual ドメインに属するため、3ドメイン構成では不要。
**Migration**: 将来 Ritual/Trust ドメイン実装時に復活予定。マイページのメニューから削除。
