# Project Definition

## Project Overview
- **Name:** 未定
- **Vision:** "店舗"から"個"へ。流動する資産を、確固たる価値へ。
- **Mission:** キャスト個人の「信用」と「魅力」を資産化し、予約プロセスを「情緒的な儀式」へ昇華させる。

## Core Concepts (The Heart of Service)
### 1. The Premium Promise (Ritual over Transaction)
- 予約は事務処理ではなく「誓約」である。
- **Experience:** 「空き枠ポチり」ではなく、「招待状(Invitation)」を受け取り、「長押し(Long Press)」で誓う。
- **Sealed:** 確定後は「封蝋」され、安易なキャンセルを許さない心理的拘束力を持たせる。

### 2. Living Portfolio
- 静的なカタログではなく、リアルタイムな「状態」を売る。
- **No Calendar:** 事務的なカレンダーは排除。
- **Status Signal:** `🟢 Online`, `🟡 Tonight` などのリアルタイムステータスで可視化。
- **Trust Score:** 指名本数ではなく「約束履行率(Promise Rate)」を指標とする。

### 3. Sanctuary (Order)
- 無法地帯を許さない。No Show（無断キャンセル）はシステムレベルでペナルティ(Count)を付与し共有する。

## Architecture Guidelines
### One Screen Policy
- **原則:** チャット画面等のコア体験において、ページ遷移(Router Push)は極力行わない。
- **実装:**
  - 招待状作成 -> Bottom Sheet (Drawer)
  - 招待状開封 -> Full Screen Overlay
  - 設定/詳細 -> Modal / Slide-in
- ユーザーの「文脈」と「没入感」を途切れさせない。
