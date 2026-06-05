# Profile P5e: public profile /u/[username] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開プロフィールページ `/u/[username]` を実装。P5a の `usePublicProfile` で取得し、P5c の `ProfileHeader` を**公開モード**（編集ボタンなし）で再利用する。

**Architecture:** **Additive**。新規 page のみ（+ dev/ui デモ）。`ProfileHeader` は無改変で再利用。閲覧対象の role は `ProfileView` に含まれないため、**cast データの有無から推定**して `ProfileHeader` に渡す（backend 変更を避ける）。

**Tech Stack:** Next.js 16（dynamic route, client）/ React 19 / TypeScript / SWR。

**Spec:** `docs/superpowers/specs/2026-06-05-profile-ui-design.md`（Surface 4）。前提: P5a・P5c 完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。frontend app root: `services/frontend/workspace`。branch `feat/profile-slice`。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。alias `@/` → `src/`。
- **テストランナー無し** → `pnpm exec tsc --noEmit` + `pnpm build`。視覚確認は `/dev/ui`（オーケストレータ）。**依存追加禁止**。
- **build-green / additive**: 既存改変は `src/app/dev/ui/page.tsx`（デモ追記）のみ。`ProfileHeader` は触らない。

### 既存パターン（確定）

- `usePublicProfile(username: string | null)`（P5a）= `{ profile: ProfileView | null, loading, error }`。SWR key は `token && username` のとき `/api/profile/by-username/${encodeURIComponent(username)}`（閲覧にはログイン必須＝backend が authenticate_user!）。
- `ProfileHeader`（P5c）= `{ profile: ProfileView, role: "cast"|"guest"|null, onEdit?: () => void }`。`onEdit` を渡さなければ編集ボタンは出ない（= 公開モード）。`role === "cast"` のとき セラピストバッジ + cast extras を表示。
- dynamic client route の param は `useParams`（`next/navigation`）で取得（client コンポーネントのため）。
- 既知トークン: `bg-bg`/`text-text-secondary` 等。

### role 推定（公開ビュー）

公開プロフィールは他人なので `useAuthStore` の role（＝閲覧者の role）は使えない。`ProfileView` に role が無いので、**cast 由来データの有無**で推定する:

```ts
const inferredRole = profile.industry || profile.age > 0 || profile.heightCm > 0 || profile.cupSize || profile.areas.length > 0 ? "cast" : "guest";
```

（将来 GetProfile が role を返すなら厳密化できる。本 increment は backend 不変で推定。）

## File Structure

- Create: `src/app/u/[username]/page.tsx`
- Modify: `src/app/dev/ui/page.tsx`（公開モード ProfileHeader デモ）

---

## Task 1: 公開プロフィールページ + dev/ui デモ

**Files:** Create `src/app/u/[username]/page.tsx`; Modify `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: `src/app/u/[username]/page.tsx`**

```tsx
"use client";

import { useParams } from "next/navigation";
import { usePublicProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error } = usePublicProfile(username || null);

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">プロフィールが見つかりませんでした。</main>;
  }

  const role =
    profile.industry || profile.age > 0 || profile.heightCm > 0 || profile.cupSize || profile.areas.length > 0
      ? "cast"
      : "guest";

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} />
    </main>
  );
}
```

- [ ] **Step 2: `src/app/dev/ui/page.tsx` に公開モード ProfileHeader デモを追記**

既に P5c で `ProfileHeader` import と `mockProfile` がある前提。`</main>` の直前にセクションを追加（`onEdit` を渡さない＝編集ボタン無し）:

```tsx
      <section className="border border-divider rounded-lg">
        <ProfileHeader profile={mockProfile} role="cast" />
      </section>
```

（`mockProfile` が P5c デモで宣言済のためそのまま使う。新たな import/state は不要。）

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: page + demo の型エラーなし。

---

## Task 2: ビルド検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -25`
Expected: 成功。`/u/[username]` と `/dev/ui` がビルド出力に存在、型エラーなし。

- [ ] **Step 2: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/frontend/workspace
git add src/app/u src/app/dev/ui/page.tsx
git commit -s -m "feat(profile): add public profile /u/[username]"
```
（push しない。視覚確認はオーケストレータが `/dev/ui` の公開モード ProfileHeader（編集ボタン無し）を確認。）

---

## Deferred（P5e では実施しない）

- フォローボタン / 鍵アカウントの follow-gate（relationship/social 未構築）。
- 画像アップロード（avatar/cover）→ **P5f**。
- GetProfile への role 同梱（厳密な role 判定）。
- 投稿/フィード タブ。

## Self-Review（作成者チェック済）

- **Spec coverage（P5e 範囲）**: Surface 4。`usePublicProfile` で取得、`ProfileHeader` を `onEdit` 無し（公開モード）で再利用。role は cast データ有無で推定。
- **Additive で build-green**: 既存改変は `dev/ui/page.tsx` のみ。`ProfileHeader` 無改変。依存追加なし。
- **Placeholder 無し**: page + demo 完全コード。
- **型整合**: `usePublicProfile(string|null)` / `ProfileHeader` props（profile/role/onEdit）一致。`useParams` の param 取得。
- **検証**: `tsc` + `pnpm build`。公開ページ実データはバックエンド要 → 型保証 + `/dev/ui` の公開モード ProfileHeader（編集ボタン無し）で視覚確認。
