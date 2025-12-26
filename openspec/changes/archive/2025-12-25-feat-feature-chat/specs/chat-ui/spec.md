# Spec: Chat UI

## ADDED Requirements

### Requirement: Chat Room Page
アプリケーションは `/chats/[id]` にチャットルームインターフェースを提供しなければならない (MUST)。

#### Scenario: Header Layout
- **Cast Info**: キャストのアバターと名前を表示しなければならない (MUST)。
- **Call Action**: 通話ボタン（モック）を提供しなければならない (MUST)。

#### Scenario: Message List
- **Bubbles**: 自分（右）とキャスト（左）のメッセージを区別しなければならない (MUST)。
- **Content**: テキスト、画像、スタンプをサポートしなければならない (MUST)。
- **Timestamp**: メッセージの時間を表示しなければならない (MUST)。

### Requirement: Input Area
アプリケーションはチャットルーム下部に入力エリアを提供しなければならない (MUST)。

#### Scenario: Input Layout
- **Text Entry**: メッセージ入力と送信ができなければならない (MUST)。
- **Actions**: スタンプとチップ（Gift）のボタンを提供しなければならない (MUST)。

## Technical Specifications
- **Styling**: Tailwind CSS v4.
- **Animation**: Framer Motion (メッセージ追加時のアニメーション).
- **Data**: MSW (`/api/chats/:id/messages`).
