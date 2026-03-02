# Search Filter Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ランキングフィルターのスタブを全レイヤーから削除し、エリアフィルターをフロントエンド検索UIに追加する。

**Architecture:** バックエンドは `area_id` フィルターに既に対応済みなので、エリアフィルターはフロントエンドのみの変更。ランキング削除は Proto → Backend → Frontend の全レイヤーを通過する。Proto 変更後は Ruby / TypeScript の再生成が必要。

**Tech Stack:** Protocol Buffers, Ruby (Hanami/gRPC), Next.js (React 19), TypeScript

---

## Task 1: Proto からランキング enum を削除

**Files:**
- Modify: `proto/portfolio/v1/cast_service.proto:170-175`

**Step 1: Proto の enum から RANKING を削除**

`proto/portfolio/v1/cast_service.proto` の `CastStatusFilter` enum を以下に変更:

```proto
enum CastStatusFilter {
  CAST_STATUS_FILTER_UNSPECIFIED = 0;
  CAST_STATUS_FILTER_ONLINE = 1;      // Has active schedule today
  CAST_STATUS_FILTER_NEW = 2;         // Created within 7 days
}
```

同ファイルの `ListCastsRequest` のコメント (line 184) も更新:

```proto
  // Filter by status (online, new)
  CastStatusFilter status_filter = 4;
```

**Step 2: コミット**

```bash
git add proto/portfolio/v1/cast_service.proto
git commit -m "chore(proto): remove CAST_STATUS_FILTER_RANKING enum value"
```

---

## Task 2: Ruby の Proto スタブを再生成

**Files:**
- Regenerate: `services/monolith/workspace/stubs/portfolio/v1/cast_service_pb.rb`

**Step 1: Ruby Proto スタブを再生成**

```bash
cd services/monolith/workspace && bundle exec ruby bin/codegen
```

Expected: `✅ Done.` が表示される

**Step 2: 再生成されたファイルに RANKING が含まれないことを確認**

```bash
grep -i "ranking" services/monolith/workspace/stubs/portfolio/v1/cast_service_pb.rb
```

Expected: マッチなし (exit code 1)

**Step 3: コミット**

```bash
git add services/monolith/workspace/stubs/
git commit -m "chore(monolith): regenerate proto stubs after ranking removal"
```

---

## Task 3: Backend からランキング分岐を削除

**Files:**
- Modify: `services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb:267-272`
- Modify: `services/monolith/workspace/slices/portfolio/repositories/cast_repository.rb:181-183`

**Step 1: gRPC ハンドラーから `:CAST_STATUS_FILTER_RANKING` の case 分岐を削除**

`services/monolith/workspace/slices/portfolio/grpc/cast_handler.rb` の status_filter マッピング (line 267-272) を以下に変更:

```ruby
        status_filter = case request.message.status_filter
        when :CAST_STATUS_FILTER_ONLINE then :online
        when :CAST_STATUS_FILTER_NEW then :new
        else nil
        end
```

**Step 2: リポジトリからランキング case を削除**

`services/monolith/workspace/slices/portfolio/repositories/cast_repository.rb` の status_filter case 文 (line 164-183) を以下に変更:

```ruby
        # Status filter
        case status_filter
        when :online
          # Has schedule today and current time is within the schedule time range
          today = Date.today.to_s
          now = Time.now.strftime("%H:%M")
          cast_user_ids_online = schedules
            .where(date: today)
            .where { start_time <= now }
            .where { end_time >= now }
            .pluck(:cast_user_id)
            .uniq
          scope = scope.where(user_id: cast_user_ids_online)
        when :new
          # Created within 7 days
          seven_days_ago = (Date.today - 7).to_datetime
          scope = scope.where { created_at >= seven_days_ago }
        end
```

**Step 3: テストを実行して既存テストが通ることを確認**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/ --format progress
```

Expected: All examples pass (0 failures)

**Step 4: コミット**

```bash
git add services/monolith/workspace/slices/portfolio/
git commit -m "feat(monolith): remove ranking status filter stub from cast listing"
```

---

## Task 4: TypeScript の Proto スタブを再生成

**Files:**
- Regenerate: `services/nyx/workspace/src/stub/portfolio/v1/cast_service_pb.ts`

**Step 1: TypeScript Proto スタブを再生成**

```bash
cd services/nyx/workspace && pnpm proto:gen
```

**Step 2: 再生成されたファイルに RANKING が含まれないことを確認**

```bash
grep -i "RANKING" services/nyx/workspace/src/stub/portfolio/v1/cast_service_pb.ts
```

Expected: マッチなし (exit code 1)

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/stub/
git commit -m "chore(nyx): regenerate proto stubs after ranking removal"
```

---

## Task 5: API Route からランキングの case を削除

**Files:**
- Modify: `services/nyx/workspace/src/app/api/guest/search/route.ts:11-22`

**Step 1: `parseStatusFilter` 関数からランキング case を削除**

`services/nyx/workspace/src/app/api/guest/search/route.ts` の `parseStatusFilter` 関数を以下に変更:

```typescript
function parseStatusFilter(status: string | null): CastStatusFilter {
  switch (status?.toLowerCase()) {
    case "online":
      return CastStatusFilter.ONLINE;
    case "new":
      return CastStatusFilter.NEW;
    default:
      return CastStatusFilter.UNSPECIFIED;
  }
}
```

**Step 2: コミット**

```bash
git add services/nyx/workspace/src/app/api/guest/search/route.ts
git commit -m "feat(nyx): remove ranking case from search API route"
```

---

## Task 6: `useInfiniteCasts` から ranking を削除し areaId を追加

**Files:**
- Modify: `services/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts`

**Step 1: `StatusFilter` 型と `UseInfiniteCastsOptions` を更新**

`services/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts` を以下のように変更:

Line 6 — `StatusFilter` 型から `ranking` を削除:

```typescript
type StatusFilter = "all" | "online" | "new";
```

Lines 36-41 — `UseInfiniteCastsOptions` に `areaId` を追加:

```typescript
interface UseInfiniteCastsOptions {
  genreId?: string;
  tag?: string;
  status?: StatusFilter;
  query?: string;
  areaId?: string;
}
```

**Step 2: `buildParams` に `areaId` パラメータを追加**

Lines 44-61 の `buildParams` コールバック内に `areaId` を追加:

```typescript
  const buildParams = useCallback(
    (params: URLSearchParams) => {
      params.set("limit", String(PAGE_SIZE));
      if (options.status && options.status !== "all") {
        params.set("status", options.status);
      }
      if (options.genreId) {
        params.set("genreId", options.genreId);
      }
      if (options.query?.trim()) {
        params.set("query", options.query.trim());
      }
      if (options.tag) {
        params.set("tag", options.tag);
      }
      if (options.areaId) {
        params.set("areaId", options.areaId);
      }
    },
    [options.genreId, options.tag, options.status, options.query, options.areaId]
  );
```

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/modules/portfolio/hooks/useInfiniteCasts.ts
git commit -m "feat(nyx): remove ranking from StatusFilter and add areaId to useInfiniteCasts"
```

---

## Task 7: `SearchFilterOverlay` から ranking を削除し area セクションを追加

**Files:**
- Modify: `services/nyx/workspace/src/app/(guest)/search/SearchFilterOverlay.tsx`

**Step 1: 型定義を更新し area 関連の型・props・state を追加**

ファイル冒頭を更新。`ChevronDown` アイコンのインポートを追加し、型定義を変更:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, RotateCcw, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { fadeVariants, slideUpVariants, springTransition } from "@/lib/motion";

type Genre = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
};

type Area = {
  id: string;
  prefecture: string;
  name: string;
  code: string;
};

type StatusFilter = "all" | "online" | "new";

type FilterState = {
  query: string;
  genreId: string;
  status: StatusFilter;
  areaId: string;
};

type SearchFilterOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  genres: Genre[];
  areas: Area[];
  areasByPrefecture: Map<string, Area[]>;
  prefectures: string[];
  initialFilters: FilterState;
};
```

**Step 2: コンポーネント本体に area state とロジックを追加**

```typescript
export function SearchFilterOverlay({
  isOpen,
  onClose,
  onApply,
  genres,
  areas,
  areasByPrefecture,
  prefectures,
  initialFilters,
}: SearchFilterOverlayProps) {
  const [query, setQuery] = useState(initialFilters.query);
  const [genreId, setGenreId] = useState(initialFilters.genreId);
  const [status, setStatus] = useState<StatusFilter>(initialFilters.status);
  const [areaId, setAreaId] = useState(initialFilters.areaId);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [expandedPrefectures, setExpandedPrefectures] = useState<Set<string>>(new Set());

  const togglePrefecture = (prefecture: string) => {
    setExpandedPrefectures((prev) => {
      const next = new Set(prev);
      if (next.has(prefecture)) {
        next.delete(prefecture);
      } else {
        next.add(prefecture);
      }
      return next;
    });
  };

  // Fetch result count when filters change
  const fetchResultCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (genreId) params.set("genreId", genreId);
      if (status !== "all") params.set("status", status);
      if (areaId) params.set("areaId", areaId);
      params.set("limit", "1");

      const res = await fetch(`/api/guest/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResultCount(data.items?.length >= 1 ? null : 0);
      }
    } catch {
      setResultCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [query, genreId, status, areaId]);

  useEffect(() => {
    if (isOpen) {
      const debounce = setTimeout(fetchResultCount, 300);
      return () => clearTimeout(debounce);
    }
  }, [isOpen, query, genreId, status, areaId, fetchResultCount]);

  // Reset local state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialFilters.query);
      setGenreId(initialFilters.genreId);
      setStatus(initialFilters.status);
      setAreaId(initialFilters.areaId);
    }
  }, [isOpen, initialFilters]);

  const handleReset = () => {
    setQuery("");
    setGenreId("");
    setStatus("all");
    setAreaId("");
  };

  const handleApply = () => {
    onApply({ query, genreId, status, areaId });
    onClose();
  };

  const activeFilterCount =
    (query.trim() ? 1 : 0) + (genreId ? 1 : 0) + (status !== "all" ? 1 : 0) + (areaId ? 1 : 0);
```

**Step 3: ステータス選択セクションからランキングを削除し、エリア選択セクションを追加**

ステータスのボタン配列を更新 (ranking 行を削除):

```typescript
                  {(
                    [
                      { key: "all", label: "すべて" },
                      { key: "online", label: "オンライン" },
                      { key: "new", label: "新着" },
                    ] as const
                  ).map((item) => (
```

ステータスセクション (`</div>`) のすぐ後、`</div>` (Scrollable content 閉じ) の前に、エリア選択セクションを追加:

```tsx
              {/* Area Selection */}
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-3">
                  エリア
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setAreaId("")}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors border text-left
                      ${
                        areaId === ""
                          ? "bg-info text-white border-info"
                          : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                      }`}
                  >
                    すべてのエリア
                  </button>
                  {prefectures.map((prefecture) => (
                    <div key={prefecture}>
                      <button
                        onClick={() => togglePrefecture(prefecture)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary rounded-lg transition-colors"
                      >
                        <span>{prefecture}</span>
                        <ChevronDown
                          size={16}
                          className={`text-text-muted transition-transform ${
                            expandedPrefectures.has(prefecture) ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {expandedPrefectures.has(prefecture) && (
                        <div className="grid grid-cols-3 gap-2 mt-1 ml-2">
                          {(areasByPrefecture.get(prefecture) || []).map((area) => (
                            <button
                              key={area.id}
                              onClick={() => setAreaId(area.id)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border
                                ${
                                  areaId === area.id
                                    ? "bg-info text-white border-info"
                                    : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                                }`}
                            >
                              {area.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
```

**Step 4: ビルド確認**

```bash
cd services/nyx/workspace && pnpm build 2>&1 | tail -20
```

Expected: ビルドエラーなし（この時点では search/page.tsx が未更新のため型エラーの可能性あり。Task 8 で解消する）

**Step 5: コミット**

```bash
git add services/nyx/workspace/src/app/\(guest\)/search/SearchFilterOverlay.tsx
git commit -m "feat(nyx): remove ranking from overlay and add area filter section"
```

---

## Task 8: `search/page.tsx` の FilterState を更新しエリアチップを追加

**Files:**
- Modify: `services/nyx/workspace/src/app/(guest)/search/page.tsx`

**Step 1: `useAreas` フックをインポート**

Line 18 の `useInfiniteCasts` インポートの後に追加:

```typescript
import { useInfiniteCasts, useAreas } from "@/modules/portfolio/hooks";
```

**Step 2: `StatusFilter` と `FilterState` 型を更新**

Line 54 の `StatusFilter` を変更:

```typescript
type StatusFilter = "all" | "online" | "new";
```

Lines 56-60 の `FilterState` に `areaId` を追加:

```typescript
type FilterState = {
  query: string;
  genreId: string;
  status: StatusFilter;
  areaId: string;
};
```

**Step 3: 初期 state に `areaId` を追加し `useAreas` を呼び出す**

Lines 64-68 の `useState<FilterState>` を変更:

```typescript
  const [filters, setFilters] = useState<FilterState>({
    query: "",
    genreId: "",
    status: "all",
    areaId: "",
  });
```

`const [loading, setLoading] = useState(true);` (line 77) の後に `useAreas` の呼び出しを追加:

```typescript
  const { areas, areasByPrefecture, prefectures } = useAreas();
```

**Step 4: `useInfiniteCasts` に `areaId` を渡す**

Lines 89-94 に `areaId` を追加:

```typescript
  } = useInfiniteCasts({
    genreId: filters.genreId,
    tag: activeTag,
    status: filters.status,
    query: filters.query,
    areaId: filters.areaId,
  });
```

**Step 5: `activeFilterCount` に `areaId` を追加**

Lines 156-159 を変更:

```typescript
  const activeFilterCount =
    (filters.query.trim() ? 1 : 0) +
    (filters.genreId ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.areaId ? 1 : 0);
```

**Step 6: Active Filters Display にエリアチップを追加**

Lines 220-254 の Active Filters Display セクション全体を変更:

```tsx
      {/* Active Filters Display */}
      {(filters.genreId || filters.status !== "all" || filters.query || filters.areaId) && (
        <div className="px-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {filters.query && (
              <span className="px-3 py-1 bg-border text-text-secondary rounded-full text-xs font-medium">
                &quot;{filters.query}&quot;
              </span>
            )}
            {filters.genreId && (
              <span className="px-3 py-1 bg-info text-white rounded-full text-xs font-medium">
                {genres.find((g) => g.id === filters.genreId)?.name}
              </span>
            )}
            {filters.status !== "all" && (
              <span className="px-3 py-1 bg-info text-white rounded-full text-xs font-medium">
                {filters.status === "online"
                  ? "オンライン"
                  : "新着"}
              </span>
            )}
            {filters.areaId && (
              <span className="px-3 py-1 bg-info text-white rounded-full text-xs font-medium">
                {areas.find((a) => a.id === filters.areaId)?.name}
              </span>
            )}
            <button
              onClick={() => {
                setFilters({ query: "", genreId: "", status: "all", areaId: "" });
                setSearchInput("");
              }}
              className="px-3 py-1 bg-surface-secondary text-text-secondary rounded-full text-xs font-medium hover:bg-border"
            >
              クリア
            </button>
          </div>
        </div>
      )}
```

**Step 7: `SearchFilterOverlay` に area props を渡す**

Lines 349-355 の `<SearchFilterOverlay>` を変更:

```tsx
      <SearchFilterOverlay
        isOpen={filterOverlayOpen}
        onClose={() => setFilterOverlayOpen(false)}
        onApply={handleFilterApply}
        genres={genres}
        areas={areas}
        areasByPrefecture={areasByPrefecture}
        prefectures={prefectures}
        initialFilters={filters}
      />
```

**Step 8: ビルドして全体の型チェックを通す**

```bash
cd services/nyx/workspace && pnpm build 2>&1 | tail -20
```

Expected: ビルド成功

**Step 9: コミット**

```bash
git add services/nyx/workspace/src/app/\(guest\)/search/page.tsx
git commit -m "feat(nyx): add area filter to search page and remove ranking from filter chips"
```

---

## Task 9: `useAreas` が hooks index からエクスポートされていることを確認

**Files:**
- Check: `services/nyx/workspace/src/modules/portfolio/hooks/index.ts`

**Step 1: hooks index で `useAreas` がエクスポートされているか確認**

`services/nyx/workspace/src/modules/portfolio/hooks/index.ts` を確認し、`useAreas` のエクスポートがなければ追加:

```typescript
export { useAreas } from "./useAreas";
```

**Step 2: 必要に応じてコミット**

```bash
git add services/nyx/workspace/src/modules/portfolio/hooks/index.ts
git commit -m "chore(nyx): ensure useAreas is exported from hooks index"
```

---

## Task 10: 最終ビルド確認

**Step 1: フロントエンドのビルド確認**

```bash
cd services/nyx/workspace && pnpm build
```

Expected: ビルド成功

**Step 2: バックエンドのテスト確認**

```bash
cd services/monolith/workspace && bundle exec rspec spec/slices/portfolio/ --format progress
```

Expected: All examples pass

**Step 3: 変更差分の最終確認**

```bash
git log --oneline -10
```

Expected: 各タスクのコミットが並んでいる
