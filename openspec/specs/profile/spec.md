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

