# Profile Preview Specs

## ADDED Requirements

### Requirement: Profile Preview Capability
システムは、キャストがデータをバックエンドに保存する前に、変更内容をシミュレートされたゲストビューでプレビューできるようにしなければならない (MUST)。

#### Scenario: Previewing unsaved changes
Given プロフィール編集ページにいる
And ニックネームを "New Name" に変更し
And 変更をまだ保存していない
When "プレビュー" ボタンをクリックすると
Then ゲスト詳細ビューを表示するモーダルが開くこと
And 表示されるニックネームが "New Name" であること

#### Scenario: Previewing without changes
Given プロフィール編集ページにいる
And 変更を行っていない
When "プレビュー" ボタンをクリックすると
Then 現在のプロフィールデータを表示するモーダルが開くこと

#### Scenario: Closing preview
Given プレビューモーダルが開いている
When 閉じるボタンまたはモーダル外をクリックすると
Then モーダルが閉じること
And 未保存の変更内容がそのままでプロフィール編集ページに戻ること
