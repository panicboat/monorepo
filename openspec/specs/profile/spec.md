# profile Specification

## Purpose
TBD - created by archiving change feat-cast-onboarding. Update Purpose after archive.
## Requirements
### Requirement: Cast Profile Data Model
The system SHALL support the storage and management of Cast Profiles with the following structure.

#### Scenario: Data Definition
- **WHEN** a cast registers
- **THEN** the following data structure is supported

# Cast Profile Specification

### Requirement: Profile Management
システムは、キャストが自身の公開プロフィール情報を閲覧および編集するためのインターフェースを提供しなければならない (SHALL)。

#### Scenario: View Profile
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** プロフィール編集ページに遷移したとき
- **THEN** 現在のプロフィール情報（写真、テキスト、タグ、プラン）が表示される。

#### Scenario: Update Basic Info
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** メッセージや基本ステータスを更新し、保存したとき
- **THEN** 変更内容が永続化され、プレビューに即座に反映される。

#### Scenario: Update Photos
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** 新しい写真をアップロード、または既存の写真を並び替えたとき
- **THEN** 変更内容が永続化される。

#### Scenario: Update Plans
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** 料金プランを追加、編集、または削除したとき
- **THEN** 変更内容が永続化される。

#### Scenario: Update Default Shifts
- **GIVEN** ログイン済みのキャストユーザーが
- **WHEN** 基本シフト（テンプレート）を更新したとき
- **THEN** 将来の予約枠生成のためのデフォルト値として保存される（ゲストには即座に公開されない）。

### Requirement: Physical Information Input
システムは、キャストがゲストに詳細情報を提供するために、自身の身体的特徴を入力・保存できるようにしなければならない (MUST)。

#### Scenario: Entering physical stats
Given プロフィール編集ページにいる
When 身長 "160"、年齢 "20"、血液型 "A" を入力し
And プロフィールを保存すると
Then これらの値が永続化され、再読み込み時に表示されること

#### Scenario: Entering measurements
Given プロフィール編集ページにいる
When スリーサイズ (B:80, W:58, H:82) とカップ "C" を入力し
And プロフィールを保存すると
Then これらの値が永続化されること

### Requirement: Tag Management
システムは、キャストが自身の特徴を表すタグを管理できるようにしなければならない (MUST)。

#### Scenario: Adding a tag
Given プロフィール編集ページにいる
When タグセレクタに "英語OK" と入力して Enter を押すと
Then "#英語OK" が選択済みタグに追加され
And プロフィールを保存すると、このタグが永続化されること

#### Scenario: Removing a tag
Given 既存のタグがある
When タグチップの削除ボタン (x) をクリックすると
Then そのタグがリストから削除されること

### Requirement: Profile Preview Capability
システムは、キャストがデータをバックエンドに保存する前に、変更内容をシミュレートされたゲストビューでプレビューできるようにしなければならない (MUST)。プレビューは編集可能な全フィールドを表示し、ハードコードされた値を含んではならない (MUST NOT)。

#### Scenario: Previewing unsaved changes
Given プロフィール編集ページにいる
And ニックネームを "New Name" に変更し
And 変更をまだ保存していない
When "プレビュー" ボタンをクリックすると
Then ゲスト詳細ビューを表示するモーダルが開くこと
And 表示されるニックネームが "New Name" であること
And 「プレビュー中」であることが視覚的に示されること

#### Scenario: Previewing all editable fields
Given プロフィール編集ページにいる
And 以下のフィールドを入力している：
  - nickname, tagline, bio
  - service category, location type, area
  - age, height, blood type, three sizes
  - tags
  - social links
When "プレビュー" ボタンをクリックすると
Then これらの全フィールドがプレビューモーダルに表示されること

#### Scenario: No hardcoded mock data in preview
Given プロフィール編集ページにいる
When "プレビュー" ボタンをクリックすると
Then ハードコードされた occupation, charm point, personality は表示されないこと
And social metrics（followers, favorites, likes）は表示されないこと

#### Scenario: Closing preview
Given プレビューモーダルが開いている
When 閉じるボタンまたはモーダル外をクリックすると
Then モーダルが閉じること
And 未保存の変更内容がそのままでプロフィール編集ページに戻ること

#### Scenario: Preview matches guest view
Given プロフィール編集ページでデータを入力している
When プレビューを表示したとき
Then ゲスト詳細ページ `/casts/{id}` と同じレイアウト・コンポーネントで表示されること

### Requirement: Section Collapsing
ユーザーは、編集頻度の低いセクションを折りたたんで、画面の表示領域を節約できるべきである (MUST)。
デフォルトでは、全ての主要セクションは折りたたまれているべきである。

#### Scenario: Expanding a section
Given プロフィール編集ページにいる
And 全てのセクションが折りたたまれている
When 「Basic Info」セクションのヘッダーをクリックすると
Then そのセクションが展開され、詳細な入力項目が表示されること

