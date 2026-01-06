# Project Definition

## 1. Project Overview
- **Name:** Nyx.PLACE
- **Concept:** "Sovereignty of the Goddess" (女神の主権)
- **Vision:** 既存の「店舗主導型」の風俗産業構造を破壊し、キャスト個人が自身の「時間」「信頼」「顧客」を資産として管理・運用できるCtoCプラットフォームを構築する。
- **Reference:** `https://hime-channel.com` (UI/UXの密度や一覧性を参考にするが、**店舗概念は完全に排除する**)
- **Architecture:** Modular Monolith (Future Microservices Strategy)

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
  - **Pro (Monthly Fee):**
    - **Google Calendar Sync:** プライベートの予定と連動した自動空き枠管理。
    - **Deep CRM:** 過去の全顧客メモの閲覧・検索。
    - **Priority Push:** "Tonight" ステータス変更時のフォロワーへのプッシュ通知。

## 5. Domain Architecture
本プロジェクトは **Modular Monolith** として構築されていますが、将来的な分割を見据えて以下の5つのドメインに明確に分離して実装します。
詳細な定義は `services/docs/workspace/docs/分散システム設計/MICROSERVICE.md` を参照してください。

### A. Identity Domain
- **Role:** 認証・認可 (Cast/Guest分岐)。
- **Implementation:** `services/monolith/slices/identity`

### B. Portfolio Domain
- **Role:** カタログ、検索、プロフィール管理。
- **Implementation:** `services/monolith/slices/cast` (一部), `web/nyx/src/modules/portfolio`

### C. Concierge Domain
- **Role:** チャット、リアルタイム通信、スマート招待状。
- **Implementation:** `web/nyx/src/modules/concierge`

### D. Ritual Domain
- **Role:** スケジュール、予約トランザクション、誓約（Pledge）。
- **Implementation:** `services/monolith/slices/cast` (予約ロジック), `web/nyx/src/modules/ritual`

### E. Trust Domain
- **Role:** 評価、CRM、分析。
- **Implementation:** `web/nyx/src/modules/trust`

## 6. Technical Stack

### Codebase Structure
- **Monorepo Root:** `panicboat/monorepo`
- **Backend:** `services/monolith` (Ruby / Hanami Framework)
- **Frontend:** `web/nyx` (TypeScript / Next.js)

### Core Technologies
- **Framework:**
    - **Backend:** Hanami 2.x (Modular Monolith architecture)
    - **Frontend:** Next.js 14+ (App Router)
- **Communication:**
    - **RPC:** ConnectRPC / gRPC
    - **Protocol:** HTTP/2
- **Database:** PostgreSQL
- **Infrastructure:** Kubernetes (k3d for local)

### Frontend Details
- **Styling:** Tailwind CSS v4 (Light Mode default: `#ffffff`)
- **Animation:** Framer Motion (必須: 物理挙動のあるリッチなアニメーション)

## 7. UI/UX Guidelines (Clone Strategy)

**Phase 1 (Current): Structural Implementation**
開発初期段階においては、デザインの試行錯誤を排除し、機能実装に集中するため以下の戦略をとる。

### A. The "Clone" Directive
- **Reference:** `https://hime-channel.com`
- **Rule:** 配色、フォント、余白、ボタンの形状に至るまで、まずは **Hime-Channel の CSS/デザインをそのまま模倣して実装する**。
- **Color Scheme:** Hime-Channel 同様、**「白ベース (#ffffff)」** を基本通する。ダークモードは現状考慮しない。

### B. Exception (Unique Features)
Hime-Channel に存在しない独自の機能（儀式・機能）については、別途検討する。

### C. The "No Shop" Constraint
**見た目は Hime-Channel だが、構造は Nyx.PLACE であること。**
- 「店舗」に関するUI要素は全て排除する。
