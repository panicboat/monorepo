# Profile Enhance Specs

## ADDED Requirements

### Requirement: Section Collapsing
ユーザーは、編集頻度の低いセクションを折りたたんで、画面の表示領域を節約できるべきである (MUST)。
デフォルトでは、全ての主要セクションは折りたたまれているべきである。

#### Scenario: Expanding a section
Given プロフィール編集ページにいる
And 全てのセクションが折りたたまれている
When 「Basic Info」セクションのヘッダーをクリックすると
Then そのセクションが展開され、詳細な入力項目が表示されること
