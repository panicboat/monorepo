# 検索フィルター改善デザイン

## 概要

検索・発見機能の改善として、以下の2点を同時に実施する：

1. **ランキング機能の完全削除** — スタブ状態の `CAST_STATUS_FILTER_RANKING` を全レイヤーから除去
2. **エリアフィルターの追加** — バックエンド対応済みの `area_id` フィルターをフロントエンド UI に追加

## 1. ランキング機能の削除

### Proto

- `proto/portfolio/v1/cast_service.proto` から `CAST_STATUS_FILTER_RANKING = 3` enum 値を削除
- Proto 再生成（Ruby / TypeScript）

### Backend

- `slices/portfolio/` のリスト処理で `:ranking` ケース分岐を削除
- 関連テストの修正

### Frontend

- `StatusFilter` 型から `"ranking"` を削除
- `SearchFilterOverlay.tsx` のステータス選択 UI からランキングボタンを削除
- `search/page.tsx` や関連コンポーネントからランキング関連コードを除去

## 2. エリアフィルターの追加

バックエンドは `area_id` フィルターに対応済み。変更はフロントエンド中心。

### FilterState の拡張

`search/page.tsx` の `FilterState` に `areaId: string` を追加。

### useInfiniteCasts の拡張

`UseInfiniteCastsOptions` に `areaId?: string` を追加し、API リクエストのクエリパラメータに `areaId` を含める。

### SearchFilterOverlay にエリア選択セクションを追加

- 既存のジャンル・ステータス選択の後にエリア選択セクションを追加
- `useAreas()` フックで既存のエリアマスターデータを取得（SWR キャッシュ済み）
- 都道府県ごとにグルーピングして表示（例: 「東京都」→「渋谷」「新宿」…）
- ジャンルと同様のボタングリッド形式、単一選択
- 都道府県はアコーディオン（折りたたみ）で開閉

### アクティブフィルターバッジ

検索結果上部の既存フィルターバッジエリアに、選択中のエリア名を表示（×で解除可能）。

### UI レイアウト（フィルターオーバーレイ内）

```
┌─────────────────────────────┐
│ キーワード検索               │
│ [___________________]       │
│                             │
│ ジャンル                     │
│ [ボタン] [ボタン] [ボタン]    │
│                             │
│ ステータス                   │
│ [すべて] [今スグ] [NEW]      │
│                             │
│ エリア                       │
│ ▼ 東京都                    │
│ [渋谷] [新宿] [六本木] ...   │
│ ▼ 大阪府                    │
│ [梅田] [心斎橋] ...          │
│                             │
│ [結果を見る (N件)]           │
└─────────────────────────────┘
```

## 影響範囲

| レイヤー | ランキング削除 | エリアフィルター追加 |
|---------|--------------|-------------------|
| Proto | `cast_service.proto` | 変更なし |
| Backend | リスト処理のケース分岐 | 変更なし（対応済み） |
| Frontend | `StatusFilter` 型、`SearchFilterOverlay`、`search/page.tsx` | `FilterState`、`useInfiniteCasts`、`SearchFilterOverlay`、`search/page.tsx` |
