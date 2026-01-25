## MODIFIED Requirements

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
