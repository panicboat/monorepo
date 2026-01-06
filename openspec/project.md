# Project Definition

## 1. Project Overview
- **Name:** Nyx.PLACE
- **Concept:** "Sovereignty of the Goddess" (女神の主権)
- **Vision:** 既存の「店舗主導型」の風俗産業構造を破壊し、キャスト個人が自身の「時間」「信頼」「顧客」を資産として管理・運用できるCtoCプラットフォームを構築する。
- **Reference:** `https://hime-channel.com` (UI/UXの密度や一覧性を参考にするが、**店舗概念は完全に排除する**)

## 2. Core Philosophy: "No Shop, Just Casts"
システム設計における絶対的なルール：
1.  **No Shop Entity:** データベースに `shops` テーブルは存在しない。料金、エリア、スケジュールは全て `casts` 個人に紐づく。
2.  **Discovery:** ユーザーは「店」を探すのではなく、「運命の相手（Cast）」を直接検索する。
3.  **Asset Ownership:** 顧客リスト（CRM）や評価（Review）は、店の持ち物ではなくキャスト個人の資産とする。

## 3. The Ritual (User Experience)
単なる予約ツールではなく、情緒的な「儀式」を提供する。
- **The Pledge (誓約):** 予約は事務処理ではない。「招待状」を受け取り、ボタンを「長押し(Long Press)」して誓いを立て、「封蝋(Sealed)」アニメーションで確定する。
- **Living Portfolio:** 静的なプロフィールではなく、「今夜空いているか(Tonight)」「即レス可能か(Online)」というリアルタイムな生命感を重視する。
- **Sanctuary (秩序):** 無断キャンセル(No Show)はシステムレベルで厳罰化し、キャストの時間を守る。

## 4. Monetization Strategy (SaaS for Casts)
「中抜き」ではなく「ツール利用料」で収益化する。
- **Cast Subscription (Business Tools):**
  - **Free:** 基本的なプロフィール公開、チャット、手動予約管理。
  - **Pro (Monthly Fee):** - **Google Calendar Sync:** プライベートの予定と連動した自動空き枠管理。
    - **Deep CRM:** 過去の全顧客メモの閲覧・検索。
    - **Priority Push:** "Tonight" ステータス変更時のフォロワーへのプッシュ通知。

## 5. Domain Architecture (Modular Monolith)
将来的なマイクロサービス化を見据え、以下のドメイン境界を意識してモジュール分割を行う。

### A. Identity Domain
- **Role:** 認証・認可。Cast(Goddess)とGuest(Gentleman)の分岐。

### B. Portfolio Domain
- **Role:** カタログ、検索、プロフィール。
- **Data:** `casts`, `tags`, `follows`
- **Logic:** Hime-Channel的な写真メインのグリッド表示、リアルタイムステータスの反映。

### C. Concierge Domain
- **Role:** チャット、リアルタイム通信、スマート招待状。
- **Data:** `rooms`, `messages`, `web_push`
- **Logic:** - **Smart Drawer:** キャストの空き枠(`cast_availabilities`)を参照し、チャット内で最適な日時をサジェストする。

### D. Ritual Domain (The Core)
- **Role:** スケジュール管理、予約トランザクション、在庫管理。
- **Data:** `reservations`, `cast_availabilities`, `cast_plans`
- **Logic:**
  - **Inventory:** 在庫(空き枠)と販売(予約)の整合性を担保する。
  - **Google Calendar Sync:** 外部カレンダーの予定を「在庫なし」として取り込む(Pro機能)。

### E. Trust Domain
- **Role:** 評価、CRM、分析。
- **Data:** `reviews`, `radar_stats`, `customers`, `customer_memos`
- **Logic:**
  - **Review Ritual:** 5角形パラメータ(Looks/Charm/Tech等)による定量的評価。
  - **Asset Dashboard:** 売上、フォロワー数、約束履行率の可視化。

## 6. Technical Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS (Dark Mode default: `slate-950`)
- **Animation:** Framer Motion (必須: 物理挙動のあるリッチなアニメーション)
- **Database:** PostgreSQL
- **Infrastructure:** AWS

## 7. UI/UX Guidelines (Clone Strategy)

**Phase 1 (Current): Structural Implementation**
開発初期段階においては、デザインの試行錯誤を排除し、機能実装に集中するため以下の戦略をとる。

### A. The "Clone" Directive
- **Reference:** `https://hime-channel.com`
- **Rule:** 配色、フォント、余白、ボタンの形状に至るまで、まずは **Hime-Channel の CSS/デザインをそのまま模倣して実装する**。
    - ダークモード（黒/金）への変更は **行わない**。
    - Hime-Channel 特有の「白ベース」「ピンク/黒のアクセント」で実装して構わない。
- **Why:** 既存の完成されたUIパターンを流用することで、実装スピードを最大化するため。

### B. Exception (Unique Features)
Hime-Channel に存在しない独自の機能（儀式・機能）については、提供された HTMLデモ のレイアウトを使用するが、**配色は Hime-Channel のトーンに合わせる（白ベースにする）** こと。
- **対象:**
    - スマート招待状ドロワー (`chat_smart_invite_demo.html`)
    - レーダーチャート入力 (`user_history_demo.html`)
    - スケジュール管理 (`cast_schedule_demo.html`)

### C. The "No Shop" Constraint (Reminder)
**見た目は Hime-Channel だが、構造は Nyx.PLACE であること。**
- Hime-Channel の画面にある「店舗ロゴ」「店舗地図」「店舗詳細」などの要素は **UIから削除** する。
- 「店舗一覧」画面は作らず、「キャスト一覧」をトップ画面とする。

**Phase 2 (Pre-Launch): Rebranding**
- 機能実装完了後、Tailwind の設定ファイルを変更し、全ページの配色を「Dark/Gold」テーマへ一括変換する（今回は考慮しなくて良い）。
