# Implement Social Counts Display

## Why
キャストの人気度や信頼性を可視化し、ユーザーのアクション（フォローやいいね）を促進するため、ソーシャルカウント（フォロワー数、お気に入り数、いいね数）を表示します。

## What Changes
- **Profile UI**: キャスト詳細画面（`ProfileSpecs`）に、以下のカウントを表示するエリアを追加します。
    - **Followers**: フォロワー数
    - **Favorites**: お気に入り登録数
    - **Likes**: いいね（ハート）獲得数
- **Mock Data**: 各キャストのモックデータにランダムな数値を割り当てます。

## Impact
- **Web Frontend**: `ProfileSpecs.tsx` の更新。
- **Spec**: Portfolio仕様にソーシャルプルーフ表示の要件を追加。
