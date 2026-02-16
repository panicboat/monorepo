# Project Definition

## Purpose

- **Name:** Nyx.PLACE
- **Concept:** "Sovereignty of the Goddess" (女神の主権)
- **Vision:** 既存の「店舗主導型」の風俗産業構造を破壊し、キャスト個人が自身の「時間」「信頼」「顧客」を資産として管理・運用できるCtoCプラットフォームを構築する。
- **Reference:** `https://hime-channel.com` (UI/UXの密度や一覧性を参考にするが、**店舗概念は完全に排除する**)

## Domain Context

### Core Philosophy: "No Shop, Just Casts"

システム設計における絶対的なルール：

1. **No Shop Entity:** データベースに `shops` テーブルは存在しない。料金、エリア、スケジュールは全て `casts` 個人に紐づく。
2. **Discovery:** ユーザーは「店」を探すのではなく、「運命の相手（Cast）」を直接検索する。
3. **Asset Ownership:** 顧客リスト（CRM）や評価（Review）は、店の持ち物ではなくキャスト個人の資産とする。

### The Ritual (User Experience)

単なる予約ツールではなく、情緒的な「儀式」を提供する。

- **The Pledge (誓約):** 予約は事務処理ではない。「招待状」を受け取り、ボタンを「長押し(Long Press)」して誓いを立て、「封蝋(Sealed)」アニメーションで確定する。
- **Living Portfolio:** 静的なプロフィールではなく、「今夜空いているか(Tonight)」「即レス可能か(Online)」というリアルタイムな生命感を重視する。
- **Sanctuary (秩序):** 無断キャンセル(No Show)はシステムレベルで厳罰化し、キャストの時間を守る。

### Domain Architecture

本プロジェクトは **Modular Monolith** として構築されていますが、将来的な分割を見据えてドメインに明確に分離して実装します。

**現在は 7 ドメイン構成でコア機能の完成度を高めています。**

**詳細なドメイン定義は [`services/handbooks/workspace/docs/domains/`](../services/handbooks/workspace/docs/domains/README.md) を参照してください。**

| Domain | Role | Status |
|--------|------|--------|
| [Identity](../services/handbooks/workspace/docs/domains/identity.md) | 認証・認可 (Cast/Guest分岐) | ✓ Active |
| [Offer](../services/handbooks/workspace/docs/domains/offer.md) | スケジュール・料金プラン管理 | ✓ Active |
| [Portfolio](../services/handbooks/workspace/docs/domains/portfolio.md) | カタログ、検索、プロフィール管理 | ✓ Active |
| [Media](../services/handbooks/workspace/docs/domains/media.md) | メディアファイル統一管理 | ✓ Active |
| [Post](../services/handbooks/workspace/docs/domains/post.md) | 投稿、いいね、コメント | ✓ Active |
| [Relationship](../services/handbooks/workspace/docs/domains/relationship.md) | フォロー、ブロック、お気に入り | ✓ Active |
| [Feed](../services/handbooks/workspace/docs/domains/feed.md) | フィード集約 | ✓ Active |

**将来実装予定のドメイン:**

| Domain | Role | Status |
|--------|------|--------|
| Concierge | チャット、リアルタイム通信 | Planned |
| Trust | 評価、CRM、分析 | Planned |

## Important Constraints

### UI/UX Guidelines (Clone Strategy)

**Phase 1 (Current): Structural Implementation**

開発初期段階においては、デザインの試行錯誤を排除し、機能実装に集中するため以下の戦略をとる。

#### A. The "Clone" Directive

- **Reference:** `https://hime-channel.com`
- **Rule:** 配色、フォント、余白、ボタンの形状に至るまで、まずは **Hime-Channel の CSS/デザインをそのまま模倣して実装する**。
- **Color Scheme:** Hime-Channel 同様、**「白ベース (#ffffff)」** を基本とする。ダークモードは現状考慮しない。

#### B. Exception (Unique Features)

Hime-Channel に存在しない独自の機能（儀式・機能）については、別途検討する。

#### C. The "No Shop" Constraint

**見た目は Hime-Channel だが、構造は Nyx.PLACE であること。**

- 「店舗」に関するUI要素は全て排除する。

### Frontend Details

- **Styling:** Tailwind CSS v4 (Light Mode default: `#ffffff`)
- **Animation:** Framer Motion (必須: 物理挙動のあるリッチなアニメーション)

### Monetization Strategy

機能開放による Monthly Subscription で収益化する。

#### For Casts

現在検討中です。

- **Deep CRM:** 過去の全顧客メモの閲覧・検索。

#### For Guests

現在検討中です。
