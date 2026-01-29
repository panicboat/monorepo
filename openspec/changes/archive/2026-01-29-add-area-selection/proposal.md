# Change: Add Area Selection

## Why

キャストの活動エリアを自由入力から選択式に変更する。エリアマスターをDBで管理し、都道府県とエリア（地域）の2階層で管理する。キャストは複数のエリアを選択可能とする。これにより、ゲストのエリア検索精度が向上し、データの一貫性が保たれる。

## What Changes

- Portfolio ドメインに `areas` マスターテーブルを追加
- Portfolio ドメインに `cast_areas` 中間テーブルを追加（多対多）
- casts テーブルの `area` カラムを廃止（または互換性のため残す）
- オンボーディング・プロフィール編集でエリア選択UIを追加
- 初期データとして主要30エリアをseed

## Impact

- Affected specs: portfolio
- Affected code:
  - `services/monolith/workspace/slices/portfolio/` - DB, relations, repositories
  - `proto/portfolio/v1/service.proto` - areas field
  - `web/nyx/workspace/src/app/(cast)/cast/onboarding/` - area selection UI
  - `web/nyx/workspace/src/app/(cast)/cast/profile/` - area selection UI
  - Guest search/filter (future)

## Data Model

```
areas テーブル:
- id: UUID
- prefecture: string (都道府県)
- name: string (エリア名)
- code: string (URL用slug, unique)
- sort_order: integer
- active: boolean

cast_areas テーブル:
- cast_id: UUID (FK to casts)
- area_id: UUID (FK to areas)
```

## Initial Seed Data (~30 areas)

東京都: 渋谷, 新宿, 池袋, 品川, 六本木, 銀座, 上野, 錦糸町, 吉原, 五反田, 蒲田
大阪府: 難波, 梅田, 日本橋, 天王寺, 京橋
愛知県: 栄, 名駅, 金山
福岡県: 中洲, 博多, 天神
神奈川県: 横浜, 川崎
埼玉県: 大宮
