# profile Specification Deltas

## ADDED Requirements

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
