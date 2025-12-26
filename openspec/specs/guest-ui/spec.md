# Guest UI 仕様

## Purpose
ゲストユーザー向けのメインインターフェース仕様。
「Private Heaven」の世界観を維持しつつ、Next.js App Router 上で実装する。

## Requirements
### Requirement: Global Navigation
アプリケーションは画面下部にグローバルナビゲーションバーを提供しなければならない (MUST)。

#### Scenario: Display Logic
- ナビゲーションバーは画面下部に固定されなければならない (MUST)。
- `Home`, `Talk` (Chats), `History` へのリンクを含まなければならない (MUST)。
- 現在のページのアイコンはハイライトされなければならない (MUST)。

### Requirement: Home Screen
アプリケーションは `/home` に発見機能を持つホーム画面を表示しなければならない (MUST)。

#### Scenario: Home Layout
- **Header**: "PrivateHeaven" ロゴを表示しなければならない (MUST)。
- **Tabs**: `Discover` と `Following` の切り替えができなければならない (MUST)。
- **List**: キャストのアップデートフィード（モックデータ）を表示しなければならない (MUST)。

### Requirement: Chat List Screen
アプリケーションは `/chats` にチャットリストを表示しなければならない (MUST)。

#### Scenario: Chat List Layout
- **Header**: "Messages" を表示しなければならない (MUST)。
- **Tabs**: `All`, `Invitations`, `Unread` を含まなければならない (MUST)。
- **Invitations**: 特徴的な金色のボーダーデザインで表示されなければならない (MUST)。
- **Badge**: 未読数を表示しなければならない (MUST)。
