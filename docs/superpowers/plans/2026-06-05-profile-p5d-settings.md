# Profile P5d: /settings (area / privacy / account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定ページ `/settings`（Tabs: エリア / プライバシー / アカウント）を実装。エリア = 地方アコーディオン（最大2）、プライバシー = 鍵アカウント Toggle、アカウント = username + 空き確認。各タブは full-payload で `SaveProfile`。

**Architecture:** **Additive**。新規 page + components + 共有ヘルパー。各タブの保存は **full-payload**（現在 `ProfileView` 全フィールド ＋ 当該タブの編集）で他面の値を clobber しない。エリアタブは role=cast のみ。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / 既存 `Tabs`/`Toggle`/`Input`/`Button`/`FormField` + P5a hooks。アコーディオンは依存追加せず自作。

**Spec:** `docs/superpowers/specs/2026-06-05-profile-ui-design.md`（Surface 3）。前提: P5a・P5b・P5c 完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。frontend app root: `services/frontend/workspace`。branch `feat/profile-slice`。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。alias `@/` → `src/`。
- **テストランナー無し** → `pnpm exec tsc --noEmit`（各タスク）+ `pnpm build`（最終）。視覚確認は `/dev/ui`（オーケストレータがブラウザ実施）。**依存追加禁止**。
- **build-green / additive**: 既存改変は `src/modules/profile/lib/mappers.ts`（export 追記）と `src/app/dev/ui/page.tsx`（デモ追記）のみ。他は新規。

### 既存パターン（確定）

- `Tabs`（`@/components/ui/tab`）= `{ items: {id,label}[], value, onValueChange }`。**tablist のみ**描画（パネルは自分で出し分け）。
- `Toggle` = `{ checked, onCheckedChange, aria-label }`。`Input` / `Button`（variant/size）/ `FormField`（label/htmlFor/error/hint/required）。
- P5a hooks: `useProfile()` = `{ profile, loading, error, saveProfile, mutate }`、`useAreas()` = `{ areas: AreaView[], loading, error }`、`checkUsernameAvailability(username)` → `{ available, message }`。
- `AreaView` = `{ id, region, prefecture, name, code }`（P4 seed で region 投入済）。
- role: `useAuthStore(selectRole)`（`"guest"|"cast"`）、hydrate ガード `selectIsHydrated`。
- 既知トークン（確実に存在）: `bg-bg`/`bg-surface`/`border-border`/`border-divider`/`text-text-primary|secondary|muted`/`text-accent`/`text-error`/`bg-accent/15`/`bg-gradient-brand`。「保存しました」は `text-accent` を使う（success トークンは未確定のため使わない）。

### full-payload の規律

各タブは profile ロード完了まで保存しない。保存ペイロード = `profileViewToSavePayload(profile)`（現在の全フィールド）＋ 当該タブの override（area: `areaIds` / privacy: `isPrivate` / account: `username`）。

## File Structure

- Modify: `src/modules/profile/lib/mappers.ts`（`profileViewToSavePayload` を追記）
- Create: `src/modules/profile/components/AreaAccordion.tsx`
- Create: `src/modules/profile/components/AreaSettings.tsx`
- Create: `src/modules/profile/components/PrivacySettings.tsx`
- Create: `src/modules/profile/components/AccountSettings.tsx`
- Create: `src/app/settings/page.tsx`
- Modify: `src/app/dev/ui/page.tsx`（AreaAccordion を mock データでデモ）

---

## Task 1: 共有ヘルパー + AreaAccordion

**Files:** Modify `src/modules/profile/lib/mappers.ts`; Create `src/modules/profile/components/AreaAccordion.tsx`。

- [ ] **Step 1: `src/modules/profile/lib/mappers.ts` に `profileViewToSavePayload` を追記**

ファイル末尾に追加（既存の import に `ProfileView` を含める。既存は `SaveProfilePayload`/`SnsLinksView` 等を import 済なので `ProfileView` が無ければ型 import に足す）:

```ts
export function profileViewToSavePayload(p: ProfileView): SaveProfilePayload {
  return {
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    website: p.website,
    snsLinks: { ...p.snsLinks },
    prefecture: p.prefecture,
    isPrivate: p.isPrivate,
    age: p.age,
    heightCm: p.heightCm,
    cupSize: p.cupSize,
    industry: p.industry,
    areaIds: p.areas.map((a) => a.id),
    shopId: p.shopId,
  };
}
```

（`mappers.ts` 冒頭の型 import 行に `ProfileView` が無ければ追加: `import type { AreaView, ProfileView, SaveProfilePayload, SnsLinksView } from "@/modules/profile/types";`）

- [ ] **Step 2: `src/modules/profile/components/AreaAccordion.tsx`**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AreaView } from "@/modules/profile/types";

interface AreaAccordionProps {
  areas: AreaView[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}

// spec の 8 地方順
const REGION_ORDER = [
  "北海道・東北", "関東", "甲信越・北陸", "東海", "関西", "中国", "四国", "九州・沖縄",
];

export function AreaAccordion({ areas, selectedIds, onChange, max = 2 }: AreaAccordionProps) {
  const [openRegion, setOpenRegion] = useState<string | null>(null);

  const byRegion = new Map<string, Map<string, AreaView[]>>();
  for (const a of areas) {
    const region = a.region || "その他";
    if (!byRegion.has(region)) byRegion.set(region, new Map());
    const byPref = byRegion.get(region)!;
    if (!byPref.has(a.prefecture)) byPref.set(a.prefecture, []);
    byPref.get(a.prefecture)!.push(a);
  }

  const regions = REGION_ORDER.filter((r) => byRegion.has(r)).concat(
    [...byRegion.keys()].filter((r) => !REGION_ORDER.includes(r))
  );

  const selected = new Set(selectedIds);
  const atMax = selected.size >= max;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < max) next.add(id);
    onChange([...next]);
  };

  const regionCount = (region: string) => {
    let n = 0;
    for (const list of byRegion.get(region)!.values()) {
      for (const a of list) if (selected.has(a.id)) n++;
    }
    return n;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">最大{max}エリアまで選択できます</p>
        <p className="text-sm text-accent">
          {selected.size}/{max}件選択中
        </p>
      </div>
      <div className="flex flex-col rounded-md border border-border">
        {regions.map((region) => {
          const open = openRegion === region;
          const count = regionCount(region);
          return (
            <div key={region} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenRegion(open ? null : region)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-text-primary"
              >
                <span>
                  {region}
                  {count > 0 && <span className="ml-1 text-accent">({count})</span>}
                </span>
                <svg
                  className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {open && (
                <div className="flex flex-col gap-3 px-4 pb-3">
                  {[...byRegion.get(region)!.entries()].map(([pref, list]) => (
                    <div key={pref} className="flex flex-col gap-1.5">
                      <p className="text-xs text-text-muted">{pref}</p>
                      <div className="flex flex-wrap gap-2">
                        {list.map((a) => {
                          const on = selected.has(a.id);
                          const disabled = !on && atMax;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggle(a.id)}
                              disabled={disabled}
                              className={cn(
                                "rounded-full border px-3 py-1 text-sm transition-colors",
                                on
                                  ? "border-accent bg-accent/15 text-accent"
                                  : "border-border text-text-secondary hover:text-text-primary",
                                disabled && "opacity-40"
                              )}
                            >
                              {a.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 新規ファイル + mappers の型エラーなし。

---

## Task 2: 3 つの設定パネル

**Files:** Create `AreaSettings.tsx`, `PrivacySettings.tsx`, `AccountSettings.tsx`（`src/modules/profile/components/`）。

- [ ] **Step 1: `src/modules/profile/components/AreaSettings.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AreaAccordion } from "@/modules/profile/components/AreaAccordion";
import { useAreas } from "@/modules/profile/hooks";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function AreaSettings({ profile, save }: PanelProps) {
  const { areas, loading } = useAreas();
  const [selectedIds, setSelectedIds] = useState<string[]>(profile.areas.map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await save({ ...profileViewToSavePayload(profile), areaIds: selectedIds });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <p className="text-sm text-text-secondary">活動エリアを設定してください</p>
      {loading ? (
        <p className="text-sm text-text-muted">読み込み中…</p>
      ) : (
        <AreaAccordion areas={areas} selectedIds={selectedIds} onChange={setSelectedIds} max={2} />
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/modules/profile/components/PrivacySettings.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function PrivacySettings({ profile, save }: PanelProps) {
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await save({ ...profileViewToSavePayload(profile), isPrivate });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">鍵アカウント</span>
          <span className="text-xs text-text-muted">フォローを承認した人だけが閲覧できます</span>
        </div>
        <Toggle checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="鍵アカウント" />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/modules/profile/components/AccountSettings.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { checkUsernameAvailability } from "@/modules/profile/hooks";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function AccountSettings({ profile, save }: PanelProps) {
  const [username, setUsername] = useState(profile.username);
  const [status, setStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
    if (!username || username === profile.username) {
      setStatus(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setStatus(await checkUsernameAvailability(username));
      } catch {
        setStatus(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, profile.username]);

  const blocked = !!username && username !== profile.username && status !== null && !status.available;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ ...profileViewToSavePayload(profile), username });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <FormField
        label="ユーザー名"
        htmlFor="username"
        error={blocked ? status?.message : undefined}
        hint={status?.available ? "使用できます" : undefined}
      >
        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      </FormField>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || blocked}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 3 パネルの型エラーなし。

---

## Task 3: `/settings` ページ + dev/ui デモ

**Files:** Create `src/app/settings/page.tsx`; Modify `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: `src/app/settings/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectRole, selectIsHydrated } from "@/stores/authStore";
import { Tabs } from "@/components/ui/tab";
import { AreaSettings } from "@/modules/profile/components/AreaSettings";
import { PrivacySettings } from "@/modules/profile/components/PrivacySettings";
import { AccountSettings } from "@/modules/profile/components/AccountSettings";

export default function SettingsPage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { profile, loading, error, saveProfile } = useProfile();

  const items = [
    ...(role === "cast" ? [{ id: "area", label: "エリア" }] : []),
    { id: "privacy", label: "プライバシー" },
    { id: "account", label: "アカウント" },
  ];
  const [tab, setTab] = useState(role === "cast" ? "area" : "privacy");

  if (!isHydrated || loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return (
      <main className="mx-auto max-w-xl p-6 text-text-secondary">
        設定を表示できませんでした。ログインが必要です。
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <h1 className="px-4 py-4 text-lg font-bold">設定</h1>
      <Tabs items={items} value={tab} onValueChange={setTab} />
      <div className="px-4">
        {tab === "area" && role === "cast" && <AreaSettings profile={profile} save={saveProfile} />}
        {tab === "privacy" && <PrivacySettings profile={profile} save={saveProfile} />}
        {tab === "account" && <AccountSettings profile={profile} save={saveProfile} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: `src/app/dev/ui/page.tsx` に AreaAccordion デモを追記**

import 群に追加:

```tsx
import { AreaAccordion } from "@/modules/profile/components/AreaAccordion";
import type { AreaView } from "@/modules/profile/types";
```

`DevUiPage` 関数の先頭付近に追加:

```tsx
  const [areaSel, setAreaSel] = useState<string[]>(["1"]);
  const mockAreas: AreaView[] = [
    { id: "1", region: "関東", prefecture: "東京都", name: "渋谷", code: "shibuya" },
    { id: "2", region: "関東", prefecture: "東京都", name: "新宿", code: "shinjuku" },
    { id: "3", region: "関東", prefecture: "神奈川県", name: "横浜", code: "yokohama" },
    { id: "4", region: "関西", prefecture: "大阪府", name: "難波", code: "namba" },
    { id: "5", region: "九州・沖縄", prefecture: "福岡県", name: "中洲", code: "nakasu" },
  ];
```

`</main>` の直前にセクションを追加:

```tsx
      <section>
        <AreaAccordion areas={mockAreas} selectedIds={areaSel} onChange={setAreaSel} max={2} />
      </section>
```

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: page + demo の型エラーなし。

---

## Task 4: ビルド検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -25`
Expected: 成功。`/settings` と `/dev/ui` がビルド出力に存在、型エラーなし。

- [ ] **Step 2: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/frontend/workspace
git add src/modules/profile/lib/mappers.ts src/modules/profile/components src/app/settings src/app/dev/ui/page.tsx
git commit -s -m "feat(profile): add /settings (area, privacy, account)"
```
（push しない。視覚確認はオーケストレータが `/dev/ui` の AreaAccordion を dev サーバ + ブラウザで実施: 地方アコーディオン展開 + チップ選択 + 最大2カウンタ。）

---

## Deferred（P5d では実施しない）

- 公開 `/u/[username]`（ProfileHeader 再利用）→ **P5e**。
- 画像アップロード（avatar/cover）→ **P5f**。
- 通知設定 / 外観 タブ（backend 無し）、email/password 編集（identity）。
- area マスタの rx-sns 全国フル投入（現状 seed の region 分のみ表示）。

## Self-Review（作成者チェック済）

- **Spec coverage（P5d 範囲）**: Surface 3 の 3 タブ。エリア = 地方アコーディオン（最大2・「N/2件選択中」・region 内 prefecture グルーピング・チップ選択）→ `area_ids`。プライバシー = 鍵アカウント Toggle → `is_private`。アカウント = username + debounce 空き確認 → `username`。全タブ full-payload（`profileViewToSavePayload` ＋ override）。エリアは role=cast のみ。
- **Additive で build-green**: 既存改変は `mappers.ts`（export 追記）と `dev/ui/page.tsx`（デモ）。依存追加なし（アコーディオン自作 + inline SVG）。
- **Placeholder 無し**: helper / AreaAccordion / 3 panels / page / demo すべて完全コード。
- **型整合**: `profileViewToSavePayload` 戻りは `SaveProfilePayload`。`useAreas`/`checkUsernameAvailability`/`useProfile` の戻り型一致。`Tabs`/`Toggle`/`FormField` props 一致。`AreaView` フィールド一致。「保存しました」は `text-accent`（確実トークン）。
- **検証**: `tsc` + `pnpm build`。`/settings` 実データはバックエンド要 → 型保証 + `/dev/ui` の AreaAccordion mock で視覚確認（ブラウザはオーケストレータ）。
