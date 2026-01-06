# My Page Interactions Implementation

## Why
ゲストユーザー向けのマイページ（Dashboard）には「Likes」「Following」「Blocking」「Footprints」への導線が存在しますが、現在はクリックしても遷移先がなく、機能体験が分断されています。これらをモックとして実装し、アプリ全体の回遊性と信頼性（Privacy Control感）を向上させる必要があります。

## What Changes
ユーザーインタラクションに関連する4つのリスト画面をモックとして実装します。

### Identity Module
- 以下のページを新規作成します：
    - `/likes`: お気に入りキャスト一覧
    - `/following`: フォロー中キャスト一覧
    - `/blocking`: ブロック中キャスト一覧
    - `/footprints`: 足あと履歴一覧

これらの画面は既存の `CastList` コンポーネントや共通UIを流用し、それぞれ異なる静的ダミーデータを表示することで「それらしい」体験を提供します。

## Impact
- **Web Frontend**: `/apps/shell` 内に新規ルートとページコンポーネントが追加されます。
- **Spec**: `identity` および `discovery` の仕様に、ユーザー関係性管理（Relationship）に関する要件が追加されます。
