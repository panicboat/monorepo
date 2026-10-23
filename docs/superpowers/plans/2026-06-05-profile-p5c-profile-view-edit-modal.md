# Profile P5c: /profile view + edit modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自分のプロフィール表示ページ `/profile`（`ProfileHeader`）と、そこから開く**プロフィール編集モーダル**（`EditProfileModal`、role-aware、テキスト/セレクト項目）を実装し、P5a の `useProfile` で取得・保存する。

**Architecture:** **Additive**。新規 page + components のみ。保存は **full-payload read-modify-write**（現在の `ProfileView` ＋ 編集を全フィールドで `SaveProfile`）で `is_private`/`area_ids`/`username` を clobber しない。画像（avatar/cover）アップロードは P5f、設定タブ（エリア/プライバシー/アカウント）は P5d。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / `@radix-ui/react-dialog`（導入済）/ Zustand authStore / SWR。P5b の form 部品 + 既存 Avatar/Button を使用。

**Spec:** `docs/superpowers/specs/2026-06-05-profile-ui-design.md`（Surface 1 / 2、Data strategy）。前提: P5a・P5b 完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。frontend app root: `services/frontend/workspace`。branch `feat/profile-slice`。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。alias `@/` → `src/`。
- **テストランナー無し** → 検証は `pnpm exec tsc --noEmit`（各タスク）+ `pnpm build`（最終）。視覚確認は `/dev/ui`（オーケストレータがブラウザ実施）。**依存追加禁止**。
- **build-green / additive**: 既存改変は `src/app/dev/ui/page.tsx`（デモ追記）のみ。他は新規。

### 既存パターン（確定）

- **data 層（P5a）**: `useProfile()` = `{ profile: ProfileView | null, loading, error, saveProfile(payload), saveMedia(payload), mutate }`。`saveProfile` は PUT `/api/profile`。型 `ProfileView` / `SaveProfilePayload` は `@/modules/profile/types`。
- **form 部品（P5b）**: `@/components/ui/{textarea,select,form-field,label}` + 既存 `input`/`button`。
- **Avatar**: `@/components/ui/avatar` = `{ src?, alt?, fallback, size?: "sm"|"md"|"lg", className? }`（size は className で上書き可）。
- **role**: `useAuthStore(selectRole)` → `Role = "guest" | "cast"`（`@/stores/authStore` の `selectRole` / `selectIsHydrated`）。authStore は localStorage から非同期 hydrate されるので `selectIsHydrated` でガードする。
- **Radix Dialog**: 既存利用箇所は無い。`import * as Dialog from "@radix-ui/react-dialog"` を直接使う。

### full-payload の規律

各編集面は profile ロード完了まで保存しない。保存ペイロードは「現在 `ProfileView` の全フィールド ＋ 当該面の編集」。本面（モーダル）が編集しない `username`/`isPrivate`/`areaIds`/`shopId` は**現在値をそのまま載せる**（clobber 回避）。

## File Structure

- Create: `src/modules/profile/lib/constants.ts`（都道府県/カップ/業種の選択肢）
- Create: `src/modules/profile/components/ProfileHeader.tsx`
- Create: `src/modules/profile/components/EditProfileModal.tsx`
- Create: `src/app/profile/page.tsx`
- Modify: `src/app/dev/ui/page.tsx`（mock データで ProfileHeader + EditProfileModal をデモ）

---

## Task 1: constants + ProfileHeader

**Files:** Create `src/modules/profile/lib/constants.ts`, `src/modules/profile/components/ProfileHeader.tsx`。

- [ ] **Step 1: `src/modules/profile/lib/constants.ts`**

```ts
// 都道府県（場所 select）。
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

// カップサイズ select。canonical な値域は §10 で確定（暫定）。
export const CUP_SIZES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;

// 業種 select。canonical enum は §10 service-category spec で確定（暫定値）。
export const INDUSTRIES = ["デリヘル", "ホテヘル", "店舗型", "ソープ", "エステ", "メンズエステ", "個人"] as const;
```

- [ ] **Step 2: `src/modules/profile/components/ProfileHeader.tsx`**

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ProfileView } from "@/modules/profile/types";

const SNS_LABELS: { key: keyof ProfileView["snsLinks"]; label: string }[] = [
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "bluesky", label: "Bluesky" },
  { key: "line", label: "LINE" },
];

interface ProfileHeaderProps {
  profile: ProfileView;
  role: "cast" | "guest" | null;
  onEdit?: () => void;
}

export function ProfileHeader({ profile, role, onEdit }: ProfileHeaderProps) {
  const isCast = role === "cast";
  const sns = SNS_LABELS.filter(({ key }) => profile.snsLinks[key]);

  return (
    <div className="flex flex-col">
      <div
        className="h-40 w-full bg-gradient-brand"
        style={
          profile.coverUrl
            ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      />
      <div className="flex items-start justify-between px-4">
        <div className="-mt-10">
          <Avatar
            src={profile.avatarUrl || undefined}
            fallback={profile.displayName.slice(0, 1) || "?"}
            size="lg"
            className="h-20 w-20 text-2xl ring-4 ring-bg"
          />
        </div>
        {onEdit && (
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              プロフィールを編集
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-4 pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-text-primary">{profile.displayName}</h1>
          {isCast && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">セラピスト</span>
          )}
        </div>
        <p className="text-sm text-text-secondary">@{profile.username || "—"}</p>
        {profile.prefecture && <p className="text-sm text-text-secondary">📍 {profile.prefecture}</p>}
        {profile.bio && <p className="whitespace-pre-wrap pt-1 text-sm text-text-primary">{profile.bio}</p>}
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {profile.website}
          </a>
        )}
        {sns.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {sns.map(({ key, label }) => (
              <a
                key={key}
                href={profile.snsLinks[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline"
              >
                {label}
              </a>
            ))}
          </div>
        )}
        {isCast && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm text-text-secondary">
            {profile.age > 0 && <span>{profile.age}歳</span>}
            {profile.heightCm > 0 && <span>{profile.heightCm}cm</span>}
            {profile.cupSize && <span>{profile.cupSize}カップ</span>}
            {profile.industry && <span>{profile.industry}</span>}
            {profile.areas.length > 0 && <span>{profile.areas.map((a) => a.name).join(" / ")}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 新規ファイルの型エラーなし。

---

## Task 2: EditProfileModal

**Files:** Create `src/modules/profile/components/EditProfileModal.tsx`。

- [ ] **Step 1: コンポーネントを実装**

```tsx
"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { PREFECTURES, CUP_SIZES, INDUSTRIES } from "@/modules/profile/lib/constants";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileView;
  isCast: boolean;
  onSave: (payload: SaveProfilePayload) => Promise<void>;
}

interface FormState {
  displayName: string;
  bio: string;
  prefecture: string;
  website: string;
  age: string;
  heightCm: string;
  cupSize: string;
  industry: string;
  snsX: string;
  snsInstagram: string;
  snsTiktok: string;
  snsBluesky: string;
  snsLine: string;
}

function toForm(p: ProfileView): FormState {
  return {
    displayName: p.displayName,
    bio: p.bio,
    prefecture: p.prefecture,
    website: p.website,
    age: p.age ? String(p.age) : "",
    heightCm: p.heightCm ? String(p.heightCm) : "",
    cupSize: p.cupSize,
    industry: p.industry,
    snsX: p.snsLinks.x,
    snsInstagram: p.snsLinks.instagram,
    snsTiktok: p.snsLinks.tiktok,
    snsBluesky: p.snsLinks.bluesky,
    snsLine: p.snsLinks.line,
  };
}

// full-payload: 現在値 + 編集。モーダルが扱わない username/isPrivate/areaIds/shopId は現在値を維持。
function buildPayload(current: ProfileView, f: FormState, isCast: boolean): SaveProfilePayload {
  return {
    username: current.username,
    displayName: f.displayName,
    bio: f.bio,
    website: f.website,
    snsLinks: {
      x: f.snsX,
      instagram: f.snsInstagram,
      tiktok: f.snsTiktok,
      bluesky: f.snsBluesky,
      line: f.snsLine,
    },
    prefecture: f.prefecture,
    isPrivate: current.isPrivate,
    age: isCast ? Number(f.age) || 0 : 0,
    heightCm: isCast ? Number(f.heightCm) || 0 : 0,
    cupSize: isCast ? f.cupSize : "",
    industry: isCast ? f.industry : "",
    areaIds: current.areas.map((a) => a.id),
    shopId: current.shopId,
  };
}

export function EditProfileModal({ open, onOpenChange, profile, isCast, onSave }: EditProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(buildPayload(profile, form, isCast));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <Dialog.Title className="text-base font-bold text-text-primary">プロフィールを編集</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text-primary" aria-label="閉じる">
              ✕
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
            <FormField label="表示名" htmlFor="displayName" required>
              <Input id="displayName" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
            </FormField>

            <FormField label="自己紹介" htmlFor="bio" hint={`${form.bio.length}/160`}>
              <Textarea
                id="bio"
                maxLength={160}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="自己紹介を入力"
              />
            </FormField>

            <FormField label="場所" htmlFor="prefecture">
              <Select id="prefecture" value={form.prefecture} onChange={(e) => set("prefecture", e.target.value)}>
                <option value="">未選択</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="ウェブサイト" htmlFor="website">
              <Input
                id="website"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
              />
            </FormField>

            {isCast && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="年齢" htmlFor="age">
                    <Input id="age" type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
                  </FormField>
                  <FormField label="身長(cm)" htmlFor="height">
                    <Input id="height" type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="カップ" htmlFor="cup">
                    <Select id="cup" value={form.cupSize} onChange={(e) => set("cupSize", e.target.value)}>
                      <option value="">未選択</option>
                      {CUP_SIZES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="業種" htmlFor="industry">
                    <Select id="industry" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                      <option value="">未選択</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">SNS リンク</p>
              <Input value={form.snsX} onChange={(e) => set("snsX", e.target.value)} placeholder="X (https://x.com/...)" />
              <Input value={form.snsInstagram} onChange={(e) => set("snsInstagram", e.target.value)} placeholder="Instagram" />
              <Input value={form.snsTiktok} onChange={(e) => set("snsTiktok", e.target.value)} placeholder="TikTok" />
              <Input value={form.snsBluesky} onChange={(e) => set("snsBluesky", e.target.value)} placeholder="Bluesky" />
              <Input value={form.snsLine} onChange={(e) => set("snsLine", e.target.value)} placeholder="LINE" />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-divider px-4 py-3">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 新規ファイルの型エラーなし。

---

## Task 3: `/profile` ページ + dev/ui デモ

**Files:** Create `src/app/profile/page.tsx`; Modify `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: `src/app/profile/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectRole, selectIsHydrated } from "@/stores/authStore";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileModal } from "@/modules/profile/components/EditProfileModal";

export default function ProfilePage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { profile, loading, error, saveProfile } = useProfile();
  const [editing, setEditing] = useState(false);

  if (!isHydrated || loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return (
      <main className="mx-auto max-w-xl p-6 text-text-secondary">
        プロフィールを表示できませんでした。ログインが必要です。
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} onEdit={() => setEditing(true)} />
      <EditProfileModal
        open={editing}
        onOpenChange={setEditing}
        profile={profile}
        isCast={role === "cast"}
        onSave={async (payload) => {
          await saveProfile(payload);
        }}
      />
    </main>
  );
}
```

- [ ] **Step 2: `src/app/dev/ui/page.tsx` に mock デモを追記**

import 群に追加:

```tsx
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileModal } from "@/modules/profile/components/EditProfileModal";
import type { ProfileView } from "@/modules/profile/types";
```

`DevUiPage` 関数の先頭（既存 `useState` 群の近く）にモックと state を追加:

```tsx
  const [editOpen, setEditOpen] = useState(false);
  const mockProfile: ProfileView = {
    accountId: "demo",
    username: "yuna",
    displayName: "ゆな",
    bio: "はじめまして、ゆなです。\nよろしくお願いします。",
    avatarMediaId: "",
    avatarUrl: "",
    coverMediaId: "",
    coverUrl: "",
    website: "https://example.com",
    snsLinks: { x: "https://x.com/yuna", instagram: "", tiktok: "", bluesky: "", line: "" },
    prefecture: "東京都",
    isPrivate: false,
    registeredAt: "",
    age: 23,
    heightCm: 158,
    cupSize: "D",
    industry: "デリヘル",
    areas: [{ id: "a1", region: "関東", prefecture: "東京都", name: "渋谷", code: "shibuya" }],
    shopId: "",
  };
```

`</main>` の直前にセクションを追加:

```tsx
      <section className="flex flex-col gap-3 border border-divider rounded-lg">
        <ProfileHeader profile={mockProfile} role="cast" onEdit={() => setEditOpen(true)} />
        <EditProfileModal
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={mockProfile}
          isCast
          onSave={async () => {}}
        />
      </section>
```

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 新規ページ/デモの型エラーなし。

---

## Task 4: ビルド検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -25`
Expected: 成功。`/profile` と `/dev/ui` がビルド出力に存在、型エラーなし。

- [ ] **Step 2: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/frontend/workspace
git add src/modules/profile/lib/constants.ts src/modules/profile/components src/app/profile src/app/dev/ui/page.tsx
git commit -s -m "feat(profile): add /profile view and edit modal (text fields)"
```
（push しない。視覚確認はオーケストレータが `/dev/ui` を dev サーバ + ブラウザで実施する: ProfileHeader 表示 + 「プロフィールを編集」クリックでモーダル表示を screenshot。）

---

## Deferred（P5c では実施しない）

- 画像（avatar/cover）アップロード（media flow）→ **P5f**。
- 設定（エリア / プライバシー / アカウント username）→ **P5d**。
- 公開 `/u/[username]`（ProfileHeader 再利用、editable=false）→ **P5e**。
- 投稿/フィードタブ・出勤予定・フォロー数（他スライス未）。
- username/業種/カップの canonical 値域（§10）。

## Self-Review（作成者チェック済）

- **Spec coverage（P5c 範囲）**: Surface 1（`/profile` の `ProfileHeader` 最小版: cover/avatar/表示名/ロールバッジ/@username/場所/bio/website/SNS + cast extras）+ Surface 2（編集モーダル: 共通 + cast extras のテキスト/セレクト、画像なし）。Data strategy の full-payload（`buildPayload` が username/isPrivate/areaIds/shopId を現在値維持）。role は `selectRole`、hydrate を `selectIsHydrated` でガード。
- **Additive で build-green**: 既存改変は `dev/ui/page.tsx` のみ。依存追加なし（Radix Dialog は導入済）。
- **Placeholder 無し**: constants / ProfileHeader / EditProfileModal / page / demo すべて完全コード。
- **型整合**: `SaveProfilePayload`（P5a）に一致する `buildPayload` 戻り。`ProfileView` のフィールド名（camelCase）一致。`Avatar` props（src/fallback/size/className）一致。`Role = "guest"|"cast"`。
- **検証**: `tsc` + `pnpm build`。`/profile` 実データはバックエンド要のため型保証＋`/dev/ui` mock で視覚確認（ブラウザはオーケストレータ）。
