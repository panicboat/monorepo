# Design: Offer Domain

## Context

Portfolio ドメインは現在、キャストの「発見」と「提供情報」の両方を管理している。これらは異なる責務であり、将来の予約機能との統合を考慮すると、分離が望ましい。

### Stakeholders

- Cast: プランとスケジュールを管理する
- Guest: キャストの提供情報を閲覧する

## Goals / Non-Goals

### Goals

- Plan と Schedule を独立したドメインに分離
- 将来の予約機能との統合を容易にする
- 責務の明確化による保守性向上

### Non-Goals

- 予約機能の実装（将来のスコープ）
- 既存 API の完全な互換性維持（破壊的変更を許容）

## Decisions

### Domain Boundary

Offer ドメインは「キャストが提供するもの」を管理する。

```
Offer Domain Responsibilities:
├── Plan: 料金プラン（何を・いくらで）
├── Schedule: 提供可能日時（いつ）
└── Availability: 予約可能な枠の計算（将来）
```

### Data Model

既存のテーブル構造を維持し、所属スライスのみ変更:

```
cast_plans (Offer)
├── id: UUID
├── cast_id: UUID (FK → casts)
├── name: String
├── duration_minutes: Integer
├── price: Integer (nullable, null = "Ask")
└── timestamps

cast_schedules (Offer)
├── id: UUID
├── cast_id: UUID (FK → casts)
├── date: Date
├── start_time: Time
├── end_time: Time
└── timestamps
```

### API Design

新しい `OfferService` を作成:

```protobuf
service OfferService {
  // Plan APIs
  rpc GetPlans(GetPlansRequest) returns (GetPlansResponse);
  rpc SavePlans(SavePlansRequest) returns (SavePlansResponse);

  // Schedule APIs
  rpc GetSchedules(GetSchedulesRequest) returns (GetSchedulesResponse);
  rpc SaveSchedules(SaveSchedulesRequest) returns (SaveSchedulesResponse);
}
```

### Cross-Domain Reference

`casts` テーブルは Portfolio に残るため、Offer から Portfolio への参照が発生する。

**Adapter パターンを採用:**

```
Offer::Adapters::PortfolioAdapter
  └── wraps → Portfolio::CastRepository

Offer::PlanRepository
  └── uses → Offer::Adapters::PortfolioAdapter (cast_id validation)
```

Adapter を介することで:
- ドメイン境界を明確に維持
- Portfolio の内部実装変更から Offer を保護
- テスト時のモック化が容易

### BFF Implementation

キャスト詳細画面では Portfolio（プロフィール）と Offer（プラン・スケジュール）の両方を取得する必要がある。

**現状の実装（参考）:**

```
/api/guest/casts/[id]/route.ts
├── castClient.getCastProfile()      # Portfolio
├── followClient.getFollowStatus()   # Social（プライベート制御）
└── レスポンスに plans, schedules を含む
```

**Offer ドメイン導入後:**

```
/api/guest/casts/[id]/route.ts
├── castClient.getCastProfile()      # Portfolio（プロフィールのみ）
├── offerClient.getPlans()           # Offer（プラン）
├── offerClient.getSchedules()       # Offer（スケジュール）
├── followClient.getFollowStatus()   # Social（プライベート制御）
└── 統合レスポンス
```

**実装パターン: 並列呼び出し + 統合**

```typescript
// /api/guest/casts/[id]/route.ts
const [profileResponse, plansResponse, schedulesResponse] = await Promise.all([
  castClient.getCastProfile({ userId: id }, headers),
  offerClient.getPlans({ castId: id }, headers),
  offerClient.getSchedules({ castId: id, startDate, endDate }, headers),
]);

// プライベートキャストの場合、フォロー状態で詳細表示を制御
let canViewDetails = true;
if (profileResponse.profile.visibility === CastVisibility.PRIVATE) {
  const followResponse = await followClient.getFollowStatus({ castIds: [id] }, headers);
  canViewDetails = followResponse.statuses[0]?.isFollowing ?? false;
}

return NextResponse.json({
  profile: mapCastProfileToFrontend(profileResponse.profile),
  plans: canViewDetails ? mapPlansToFrontend(plansResponse.plans) : [],
  schedules: canViewDetails ? mapSchedulesToFrontend(schedulesResponse.schedules) : [],
});
```

**キャスト管理画面（自分のプラン・スケジュール編集）:**

```
/api/cast/plans/route.ts     → offerClient.getPlans() / savePlans()
/api/cast/schedules/route.ts → offerClient.getSchedules() / saveSchedules()
```

既存の API Route 構造を維持し、呼び出し先を castClient から offerClient に変更。

**gRPC クライアント追加:**

```typescript
// lib/grpc.ts
import { OfferService } from "@/stub/offer/v1/service_pb";

export const offerClient = createClient(OfferService, transport);
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| API 呼び出し先の変更 | フロントエンドの段階的移行 |
| ドメイン間の依存 | cast_id の参照整合性は DB 制約で保証 |
| 一時的な重複実装 | 移行完了後に Portfolio から削除 |

## Migration Plan

### Phase 1: Infrastructure

1. `slices/offer/` ディレクトリ作成
2. `proto/offer/v1/service.proto` 定義
3. 基本的な gRPC ハンドラ作成

### Phase 2: Dual-Write

1. Offer に新しい API を実装
2. フロントエンドを新しい API に移行
3. Portfolio の API を非推奨化

### Phase 3: Cleanup

1. Portfolio から Plan/Schedule 関連コードを削除
2. ドキュメント更新

### Rollback

- フロントエンドを元の Portfolio API に戻す
- Offer スライスを削除

## Open Questions

- [x] `casts` テーブルへの参照をどう扱うか → **Adapter パターンを採用**
- [x] キャスト詳細画面で複数ドメインを呼び出す場合の BFF 実装 → **並列呼び出し + 統合パターンを採用**
