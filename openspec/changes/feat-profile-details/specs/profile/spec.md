# Profile Details Specs

## ADDED Requirements

### Requirement: Physical Information Input
システムは、キャストがゲストに詳細情報を提供するために、自身の身体的特徴を入力・保存できるようにしなければならない。

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
システムは、キャストが自身の特徴を表すタグを管理できるようにしなければならない。

#### Scenario: Adding a tag
Given プロフィール編集ページにいる
When タグセレクタに "英語OK" と入力して Enter を押すと
Then "#英語OK" が選択済みタグに追加され
And プロフィールを保存すると、このタグが永続化されること

#### Scenario: Removing a tag
Given 既存のタグがある
When タグチップの削除ボタン (x) をクリックすると
Then そのタグがリストから削除されること
