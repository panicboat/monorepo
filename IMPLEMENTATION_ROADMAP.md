# Implementation Roadmap

Nyx.PLACE をプロダクションレディにするための実装計画。

---

## Current Status

### Implementation Status by Domain

| Domain | Backend | Frontend | Proto | API 接続 | Notes |
|--------|:-------:|:--------:|:-----:|:--------:|-------|
| Identity | ✓ | ✓ | ✓ | ✓ | SMS 認証は未対応 |
| Portfolio | ✓ | ✓ | ✓ | ✓ | オンボーディング、プロフィール、検索 |
| Social | ✓ | △ | ✓ | △ | キャスト投稿は完了、ゲスト側はモック |
| Concierge | - | △ | - | - | UI のみモック |
| Ritual | - | △ | - | - | UI のみモック |
| Trust | - | △ | - | - | UI のみモック |

### Completed Features

**Identity Service**
- ユーザー登録（Cast/Guest）
- ログイン / ログアウト
- JWT によるセッション管理（Access Token + Refresh Token）
- トークンリフレッシュ

**Portfolio Service**
- キャストのオンボーディングフロー
- プロフィール管理（基本情報、画像、料金プラン、スケジュール）
- キャスト検索（ジャンル、ステータス、タグ）
- ゲストプロフィール管理
- 画像アップロード（Presigned URL）

**Social Service**
- キャストのタイムライン投稿（CRUD）
- 複数メディア対応（画像/動画、最大10枚）
- ハッシュタグ
- 投稿の公開/非公開切り替え

---

## Phase 1: Social Domain Completion

ゲスト側のタイムライン機能を完成させ、ソーシャル機能の基盤を整える。

### 1.1 Guest Timeline API Connection

**Priority: HIGH**

ゲスト側のタイムライン表示をモックデータから API 接続に移行する。

**Tasks:**
- [ ] `GET /api/guest/timeline` API Route 作成
  - 全キャストの公開投稿を取得
  - Cursor-based pagination 対応
- [ ] `TimelineFeed.tsx` を API 接続に更新
- [ ] `useSocial` hook を API 対応に拡張
- [ ] 投稿詳細ページ（`/timeline/[id]`）の API 接続

**Files:**
- `web/nyx/workspace/src/app/api/guest/timeline/route.ts` (new)
- `web/nyx/workspace/src/modules/social/components/guest/TimelineFeed.tsx`
- `web/nyx/workspace/src/modules/social/hooks/useSocial.ts`

### 1.2 Like Feature

**Priority: MEDIUM**

投稿へのいいね機能を実装する。

**Tasks:**
- [ ] `likes` テーブル作成（migration）
- [ ] Proto 定義追加（`LikeCastPost`, `UnlikeCastPost`）
- [ ] Backend UseCase 実装
- [ ] Frontend API Route 作成
- [ ] `TimelineFeed` にいいね機能統合

**Backend:**
- `slices/social/repositories/like_repository.rb` (new)
- `slices/social/use_cases/likes/` (new)
- `proto/social/v1/service.proto` (update)

### 1.3 Follow Feature

**Priority: MEDIUM**

キャストのフォロー機能を実装する（現在は localStorage のみ）。

**Tasks:**
- [ ] `follows` テーブル作成（migration）
- [ ] Proto 定義追加（`FollowCast`, `UnfollowCast`, `ListFollowing`）
- [ ] Backend UseCase 実装
- [ ] Frontend API Route 作成
- [ ] `useSocial` hook を API 対応に拡張
- [ ] Following タブのフィルタリングを API 連携

---

## Phase 2: Discovery Enhancement

キャスト発見機能を強化する。

### 2.1 Ranking Feature

**Priority: MEDIUM**

ランキング表示を API 接続する。

**Tasks:**
- [ ] `GET /api/guest/ranking` API Route 作成
- [ ] Backend でランキングロジック実装（アクセス数、予約率など）
- [ ] `RankingWidget` を API 接続

### 2.2 Footprints (Access History)

**Priority: LOW**

足あと機能（誰がプロフィールを見たか）を実装する。

**Tasks:**
- [ ] `footprints` テーブル作成
- [ ] Backend UseCase 実装
- [ ] Frontend 実装

---

## Phase 3: Concierge Domain

チャット機能を実装する。リアルタイム通信のため、慎重な設計が必要。

### 3.1 Basic Chat

**Priority: HIGH (after Phase 1)**

基本的なチャット機能を実装する。

**Tasks:**
- [ ] Proto 定義作成 (`proto/concierge/v1/service.proto`)
- [ ] Database schema 設計（`rooms`, `messages`）
- [ ] Backend slice 作成 (`slices/concierge/`)
- [ ] Frontend API Routes 作成
- [ ] チャット UI を API 接続

**Technical Decisions:**
- リアルタイム通信: **WebSocket**（双方向通信が必要なため）
- メッセージ永続化: PostgreSQL（将来的に DynamoDB 検討）

### 3.2 Smart Invitation

**Priority: MEDIUM**

チャットから招待状を送信する機能。

---

## Phase 4: Ritual Domain

予約機能を実装する。ビジネスの核となる機能。

### 4.1 Reservation Flow

**Priority: HIGH (after Phase 3)**

**Tasks:**
- [ ] Proto 定義作成 (`proto/ritual/v1/service.proto`)
- [ ] Database schema 設計（`reservations`）
- [ ] Backend slice 作成 (`slices/ritual/`)
- [ ] 予約ステータス管理（Pending → Sealed → Completed）
- [ ] Frontend 実装

### 4.2 The Pledge UX

**Priority: MEDIUM**

長押しによる予約確定 UX を実装する。

---

## Phase 5: Trust Domain

評価・CRM 機能を実装する。

### 5.1 Review System

**Priority: MEDIUM**

**Tasks:**
- [ ] レビュー投稿機能
- [ ] レーダーチャート（5軸評価）
- [ ] 集計ロジック

### 5.2 CRM (Customer Notes)

**Priority: LOW**

キャスト用の顧客メモ機能。

---

## Phase 6: Infrastructure & Quality

### 6.1 SMS Authentication

**Priority: HIGH**

**Provider:** AWS SNS

**Tasks:**
- [ ] AWS SNS 設定
- [ ] Backend 実装（`SendSms`, `VerifySms`）
- [ ] Frontend 実装

### 6.2 Error Handling & Validation

**Priority: MEDIUM**

**Tasks:**
- [ ] エラーメッセージの統一
- [ ] バリデーションの強化
- [ ] 多言語対応の準備

### 6.3 Deployment Pipeline

**Priority: HIGH**

**Target:** AWS EKS

**Tasks:**
- [ ] Docker 設定の整備
- [ ] Kubernetes manifests の整備（EKS 対応）
- [ ] CI/CD パイプライン構築（GitHub Actions → ECR → EKS）
- [ ] AWS Secrets Manager / Parameter Store による環境変数管理
- [ ] CloudWatch によるログ・監視の設定
- [ ] ALB Ingress Controller 設定

---

## Implementation Patterns

### Backend Pattern

```ruby
# slices/{domain}/grpc/handler.rb
module Domain
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::Grpc::Authenticatable

      include Domain::Deps[
        use_case: "use_cases.feature.action"
      ]

      def rpc_method
        authenticate_user!
        result = use_case.call(...)
        Presenter.to_proto(result)
      end
    end
  end
end
```

### Frontend Pattern

```typescript
// modules/{domain}/hooks/useFeature.ts
export function useFeature() {
  const fetchData = useCallback(async () => {
    const token = getToken();
    const res = await fetch('/api/{domain}/feature', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // ...
  }, []);

  return { data, loading, error, fetchData };
}
```

### API Route Pattern

```typescript
// app/api/{domain}/feature/route.ts
export async function GET(request: Request) {
  const token = extractToken(request);
  const client = createGrpcClient();
  const response = await client.method(request, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(response);
}
```

---

## Next Steps

1. **Phase 1.1** から着手 - ゲスト側タイムラインの API 接続
2. 各フェーズの開始前に `/openspec:proposal` で提案を作成
3. 提案承認後に実装開始

---

## Notes

- 各フェーズは並行して進められる部分もあるが、依存関係に注意
- Phase 3（Concierge）は Phase 4（Ritual）の前提となる
- インフラ整備（Phase 6）は他のフェーズと並行して進めることを推奨
- SMS 認証は本番リリース前に必須
