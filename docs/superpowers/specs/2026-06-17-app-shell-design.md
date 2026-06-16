# App Shell Design — Phase 1b (mobile-first bottom-tab + drawer)

Date: 2026-06-17
Status: Design spec (implementation-ready)
Scope: Phase 1b (統合 shell + nav)。Phase 1a (#647) で presentation 一掃 + 共通 component vocabulary 構築済の上に、rx-sns 実機準拠の mobile-first 二層 nav (Bottom-tab + Drawer) を立てる。desktop は同 layout を centered max-width で受ける (専用 3-col layout は Phase 2 以降に defer)。

Related:
- `2026-05-29-design-system-design.md` §4-5 (desktop 3-col / mobile bottom-tab + drawer)、§9 (nav 項目)
- `2026-05-30-frontend-rebuild-roadmap.md` Phase 1b
- `2026-05-31-domain-context-map-design.md` (ubiquitous language、商取引次元 drop)
- `2026-06-16-notifications-slice-design.md` (NotificationBell badge は本 shell の bottom-tab に移管)
- [[reference-rx-sns-jp]] (capture + memory、Bottom-tab + avatar→drawer pattern の grounded reference)

## Grounding

- Phase 1a (PR #647 系) で旧 (cast)/(guest) ルートグループ + 旧 shell は一掃済、root layout は `AuthProvider` + `SWRProvider` ラッパだけのプレースホルダ状態。
- spec §5 line 153-158 で **モバイル 2 層 nav** (Bottom-tab = 高頻度サブセット、Drawer = avatar タップで full nav) が rx-sns 実機検証済として明記。
- memory `project-redesign-2026-05` で `出勤管理 / カルテ / 商取引次元` (offer / plans / schedules / 予約) は **drop 済**、nav 項目から除外。

## Goal

mobile-first の **AppShell** を `src/app/layout.tsx` の AuthProvider/SWRProvider 内側に挿入。認証時のみ shell (top bar + bottom-tab + drawer) を展開、未認証時は素通り (login/register page を将来追加するため bypass パス確保)。実装済 5 route と未実装 4 stub route を drawer に整列、bottom-tab は rx-sns 同形の 5 slot (中央 = 投稿 FAB プレースホルダ)。`/u/[username]` の NotificationBell は本 shell の bottom-tab badge へ集約 (重複表示防止)。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| scope | Mobile-first 2 層 nav (bottom-tab + drawer)、desktop は同 layout 拡幅、専用 3-col は Phase 2 以降 |
| bottom-tab | 5 slot: フィード / 検索 (stub) / [+ FAB placeholder] / 通知 (badge) / 推し |
| top bar | avatar (= drawer trigger、hamburger ではない) + 中央 logo |
| drawer | 9 nav 項目 + ログアウト (実装済 5 + 準備中 4 + action 1) |
| 中央 FAB | プレースホルダ (click で alert "投稿は近日対応")。composer 実装は別 PR (Posts module 系) |
| NotificationBell の場所 | bottom-tab 通知 slot の badge に統合、`/u/[username]` からは削除 (重複防止) |
| 未認証 bypass | shell は AuthStore の `userId` で判定、未認証時は children を素通り (将来 login page 用) |

## Architecture

### root layout

```
RootLayout
  └─ AuthProvider
      └─ SWRProvider
          └─ AppShell  ← 新規
              └─ TopBar (sticky top)
              └─ <main>{children}</main>
              └─ BottomTab (sticky bottom、md:hidden で desktop 非表示)
              └─ Drawer (overlay、avatar tap で open)
```

`AppShell` 内で `useAuthStore(selectUserId)` を見て、`userId` が null の場合は `children` のみ render (shell 非表示)。

### Top bar

mobile 表示 (md: 以上は max-width 拡幅して同一 layout を維持):

```
┌───────────────────────────────────┐
│ [Avatar]   dystopia.city          │
└───────────────────────────────────┘
```

- 左: viewer の avatar (sm size、click で Drawer 開く)
- 中央: ロゴ (text "dystopia.city" or サービス名)
- 右: 空 (将来検索アイコン / ロゴカスタムなど拡張余地)

未認証 (avatar 表示できない) 時は、shell 自体 bypass のため top bar も非表示。

### Bottom-tab

mobile only (`md:hidden`):

| slot | label | route | icon | badge |
|---|---|---|---|---|
| 1 | フィード | `/` | 🏠 | - |
| 2 | 検索 | `/search` | 🔍 | - |
| 3 | + 投稿 | (FAB、modal) | ＋ (中央凸) | - |
| 4 | 通知 | `/notifications` | 🔔 | `useUnreadCount` |
| 5 | 推し | `/oshi` | ⭐ | - |

- 中央 FAB は他 4 slot より一段大きい円形 button、click で `alert("投稿機能は近日対応です")`
- active state: 現在 pathname と一致する slot を accent color highlight
- 通知 slot badge は `useUnreadCount.count > 0` の時のみ表示、`99+` でクリップ

### Drawer (overlay)

avatar tap で左から slide-in。半透明 overlay で背景を dim、外側 tap で close。

memory `project-redesign-2026-05` の決定 (`商取引次元 / カルテ drop`) を反映:

```
┌──── (overlay) ────┐
│  プロフィール       │ → /profile
│  検索 (準備中)      │ → /search (stub)
│  通知 [N]           │ → /notifications
│  メッセージ (準備中) │ → /messages (stub)
│  ブックマーク (準備中)│ → /bookmarks (stub)
│  推し               │ → /oshi
│  ランキング (準備中)  │ → /ranking (stub)
│  設定               │ → /settings
│  ──────             │
│  ログアウト          │ (action)
└──────────────────┘
```

- 「準備中」項目は disabled 表示 + opacity 50%
- ログアウトは `useAuthStore.clearTokens()` + `/` へ navigate

## Stub pages (4 file)

各 stub page は単純な「{機能} は準備中です」表示のみ:

```tsx
"use client";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-xl p-6 text-center text-text-secondary">
      検索機能は準備中です。
    </main>
  );
}
```

対象 path: `/search`、`/messages`、`/bookmarks`、`/ranking`。

## Existing UI side effects

- `src/app/u/[username]/page.tsx`: NotificationBell の import + 配置を削除 (重複表示防止)
- 既存 page の `<main className="mx-auto max-w-xl ...">` は据置、AppShell が外側で wrap、bottom-tab 分の `pb-20` 等を AppShell 側で main wrapper に注入
- `/dev/ui` page に AppShell 視覚 mock section 追加 (top bar / bottom-tab / drawer 開閉状態のスタイル展示)

## Decomposition (3 PR 想定)

- **1b-A**: AppShell + TopBar + BottomTab + Drawer 部品 + layout 統合 + NotificationBell 移管。stub pages はリンクのみ存在 (404 容認)、本 PR では作らない。`/dev/ui` mock 追記まで。**[本 spec → 直後の最大物]**
- **1b-B**: 4 stub pages 新規 (/search、/messages、/bookmarks、/ranking)。drawer の disabled 解除。スコープ最小、独立 mergeable。
- **1b-C** (defer 可): composer modal 実装 (FAB の alert → 実 modal)。Post module の P5 系として別軌道で進めても可。本 spec では FAB は alert 止まり。

## Deferred / out of scope

- **desktop 3-col layout** (left nav 240 + center + right panel 320): Phase 2 以降、右 panel コンテンツも未定義
- **composer modal / `/posts/new`**: Post module 拡張、別 PR
- **検索 / メッセージ / ブックマーク / ランキング の実機能**: 各自 brainstorming + 縦実装、別 spec
- **足跡(Cast)**: cast 専用 nav 項目は memory の「ロール差分は属性化」方針で nav 除外、機能必要なら別 spec
- **カルテ(Cast)**: 法務 hard gate
- **キーボード a11y の完全 ARIA tab nav**: 1a で見送り済、本 PR でも継続 defer

## Verification

- **1b-A**: `pnpm exec tsc --noEmit` 緑、`pnpm build` 緑、`pnpm lint` baseline 維持、`/u/[username]` から NotificationBell が削除されているか grep 確認、bottom-tab badge が `useUnreadCount` を消費しているか hook 解決 trace
- **1b-B**: tsc / build 緑、新 4 stub route が build 出力に登場 (`/search`、`/messages`、`/bookmarks`、`/ranking`)
- 任意で local e2e でドロワー開閉 + active tab highlight + bell badge 表示確認

全 PR additive / build-green / auto-merge 運用。
