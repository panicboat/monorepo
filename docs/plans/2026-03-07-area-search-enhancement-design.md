# Area Search Enhancement Design

エリア検索の拡張設計。都道府県レベルの選択、ゲストのエリア情報、件数表示、Timeline のエリアフィルターを追加する。

## Requirements

| # | Feature | Summary |
|---|---------|---------|
| 1 | Prefecture selection | 検索フィルターで都道府県を選ぶと配下の全地区が対象。地区を選べば1地区に絞れる |
| 2 | Guest area info | 新規登録時に都道府県を必須選択。既存ゲストは任意設定。検索・Timeline のデフォルトフィルターになる |
| 3 | Count display | エリア選択後、適用ボタンに該当キャスト件数を表示 |
| 4 | Timeline All area filter | All タブはゲストの都道府県で自動フィルター。Following はフィルターなし |

## Data Model

### New Table: `portfolio__guest_prefectures`

| Column | Type | Constraint |
|--------|------|------------|
| `guest_user_id` | uuid | FK → portfolio__guests.user_id, NOT NULL |
| `prefecture` | varchar(50) | NOT NULL |

- UNIQUE constraint: `(guest_user_id, prefecture)`
- 現時点では1ゲスト1都道府県。スキーマ上は複数対応可能

### Proto Changes

**`guest_service.proto`:**

```proto
message GuestProfile {
  // existing fields...
  string prefecture = 7;
}

message SaveGuestProfileRequest {
  // existing fields...
  string prefecture = 5;
}
```

**`service.proto` (CastService):**

```proto
message ListCastsRequest {
  // existing: area_id
  string prefecture = 6;  // 都道府県フィルター（area_id より広い）
}

message CastCount {
  int32 count = 1;
}

message GetCastCountRequest {
  string prefecture = 1;
  string area_id = 2;
  CastStatusFilter status_filter = 3;
}

rpc GetCastCount (GetCastCountRequest) returns (CastCount);
```

**`feed_service.proto`:**

```proto
message ListGuestFeedRequest {
  FeedFilter filter = 1;
  int32 limit = 2;
  string cursor = 3;
  string prefecture = 4;  // All タブ用
}
```

## Backend Logic

### Cast Search Filtering

`cast_repository` のフィルタリングを2段階に拡張：

```
prefecture="東京都", area_id=nil
  → areas テーブルから東京都の全 area_id を取得
  → cast_areas テーブルでフィルター

prefecture=nil, area_id="xxx"
  → 既存ロジック（1エリアで絞り込み）

prefecture + area_id 両方指定
  → area_id を優先（より具体的）
```

### GetCastCount

新規 use case。`prefecture` / `area_id` / `status_filter` を受け取り、マッチするキャスト数を `COUNT(*)` で返す。検索ロジックと同じクエリベース。

### Feed Area Filtering

`list_guest_feed` use case を拡張：

- `prefecture` が指定された場合、投稿者（キャスト）のエリアで絞り込む
- ロジック: `prefecture` → 該当 area_ids → cast_areas → 対象 cast_user_ids → 投稿フィルター
- `filter = "following"` の場合は `prefecture` を無視

### Guest Profile

- `save_profile`: `prefecture` を受け取り `guest_prefectures` テーブルに upsert
- `get_profile`: `guest_prefectures` を JOIN して返す

## Frontend

### Search Filter UI

現在: アコーディオンで都道府県を展開 → 地区を1つ選択

変更後:
1. **都道府県名をタップ** → その都道府県全体を選択（展開しない）
2. **展開ボタン（▶）をタップ** → 地区リストが展開、特定地区を選択可能
3. **適用ボタンに件数表示** → エリア選択後「適用 (23件)」のように動的表示（`GetCastCount` API 呼び出し）

### Guest Onboarding

`GuestProfileForm` に都道府県セレクトを追加：
- 新規登録時: 必須
- プロフィール編集時: 変更可能

### Timeline

- "All" タブ選択時にゲストの `prefecture` を API リクエストに自動付与
- `prefecture` 未設定のゲストはフィルターなし（全件表示）

## Migration Strategy

- 既存ゲストは `prefecture` 未設定のまま（`guest_prefectures` にレコードなし）
- 未設定の場合、検索・Timeline は全件表示にフォールバック
- プロフィール編集で任意に設定可能
