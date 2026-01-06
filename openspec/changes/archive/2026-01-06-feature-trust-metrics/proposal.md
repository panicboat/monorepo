# Implement Trust Metrics (Vow Completion Rate)

## Why
「誓約（Vow）」の履行率を可視化することで、プラットフォーム内の信頼性（Trust）を向上させるため。
特にゲスト（男性ユーザー）にとっては、自身の信頼性を示す重要なステータスとなります。キャスト側にも実装しますが、こちらは将来的なON/OFFを考慮します。

## What Changes
- **Guest Dashboard (My Page)**:
    - 自身の「誓約履行率（Completion Rate）」を表示するセクションを追加。
    - 例: "Vow Completion: 98% (49/50)"
- **Cast Profile**:
    - `ProfileSpecs` のソーシャルカウント（Followers/Favorites/Likes）の並び、またはその付近に「Completion Rate」を追加。

## Impact
- **Modules**: `identity` (GuestDashboard), `portfolio` (ProfileSpecs)
- **Spec**: Identity & Portfolio specs update.
