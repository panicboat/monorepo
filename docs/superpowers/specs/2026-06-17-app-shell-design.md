# App Shell Design — Phase 1b (mobile-first bottom-tab + drawer、rx-sns 完全準拠)

Date: 2026-06-17 (rev2)
Status: Design spec (implementation-ready)
Scope: Phase 1b (統合 shell + nav)。Phase 1a (#647) で presentation 一掃 + 共通 component vocabulary 構築済の上に、rx-sns 実機準拠の mobile-first 二層 nav (Bottom-tab 4 + 右下 corner FAB + Drawer full nav) を立てる。desktop は同 layout を centered max-width で受ける (専用 3-col layout は Phase 2 以降に defer)。

Related:
- `2026-05-29-design-system-design.md` §4-5 (mobile bottom-tab 4 + FAB、avatar→drawer)、§9 (nav 項目)
- `2026-05-30-frontend-rebuild-roadmap.md` Phase 1b
- `2026-05-31-domain-context-map-design.md` (ubiquitous language、商取引次元 drop)
- `2026-06-16-notifications-slice-design.md` (NotificationBell badge は本 shell の bottom-tab 通知 slot に移管)
- [[reference-rx-sns-jp]] (`.superpowers/rx-sns-render/cast-mobile-{drawer,home-2}.png` / `guest-home-mobile.png` 等で実機 grounded)

## Grounding

- Phase 1a (PR #647 系) で旧 (cast)/(guest) ルートグループ + 旧 shell は一掃済、root layout は `AuthProvider` + `SWRProvider` ラッパだけのプレースホルダ状態。
- `design-system-design.md` §4 line 156 で **bottom tab bar(4 + FAB)**: ホーム / 検索 / 通知 / メッセージ + 右下 投稿 FAB と明記、§4 line 158 で drawer 内訳が列挙、§4 line 159 で「rx-sns 実機検証済」と grounded。
- 実 capture `.superpowers/rx-sns-render/cast-mobile-home-2.png`: 上 = avatar (左) + ロゴ (中央)、下 = bottom-tab 4 アイコン + 右下 pink gradient 円 FAB。
- 実 capture `.superpowers/rx-sns-render/cast-mobile-drawer.png`: avatar tap で左 slide-in、上 = avatar + display name + handle + フォロー中/フォロワー count、続けて 9 nav item + 最下部 ログアウト (avatar + 矢印アイコン)。
- memory `project-redesign-2026-05` で `出勤管理 / カルテ / 商取引次元` は **drop 済**、rx-sns drawer の「出勤管理」「カルテ(Cast)」は本プロダクトでは適用しない (memory が後発の決定で勝つ)。

## Goal

mobile-first の **AppShell** を `src/app/layout.tsx` の AuthProvider/SWRProvider 内側に挿入。認証時のみ shell (top bar + bottom-tab + drawer + corner FAB) を展開、未認証時は素通り (login/register page を将来追加するため bypass パス確保)。実装済 5 route と未実装 5 stub route (`/search`、`/messages`、`/footprints`、`/bookmarks`、`/ranking`) を drawer に全 surface、bottom-tab の 4 slot + 右下 FAB は rx-sns 同形。`/u/[username]` の NotificationBell は本 shell の bottom-tab 通知 slot badge に集約 (重複表示防止)。

## Decisions (brainstorming 確定済)

| 項目 | 決定 |
|---|---|
| scope | Mobile-first 2 層 nav (bottom-tab + drawer + 右下 FAB)、desktop は同 layout 拡幅、専用 3-col は Phase 2 以降 |
| bottom-tab | **4 slot**: ホーム (`/`) / 検索 (`/search`) / 通知 (`/notifications`、badge) / メッセージ (`/messages`) |
| 投稿 FAB | **右下 corner overlay**、brand gradient 円、bottom-tab とは独立 layer。click で `alert("投稿は近日対応です")` (composer 実装は別 PR) |
| top bar | mobile = アバター(左) + ロゴ(中央) + 右空。アバター tap で drawer 開く |
| drawer (full nav) | 9 nav 項目 + ログアウト: **プロフィール / 検索 / 通知(badge) / 足跡 / メッセージ / ブックマーク / 推し！/ ランキング / 設定 + ログアウト**。順序は spec §4 line 158 + capture 通り。出勤管理 / カルテは memory の「商取引次元 drop / カルテ Phase 3 defer」方針で除外。 |
| ロール差分 | 単一 nav (cast/guest 共通)、`足跡` は本プロダクトでは memory の「ロール差分 = 属性化」方針で全員 surface (cast 専用フラグ無し)。実機能は未実装 stub。 |
| stub pages | 5 件 (`/search`、`/messages`、`/footprints`、`/bookmarks`、`/ranking`) を本 spec 直後の 1b-A PR で同梱、シンプルに「{機能名} は準備中です」表示のみ。`disabled` 表示はしない (全 nav 項目が tap 可能)。 |
| NotificationBell の場所 | bottom-tab 通知 slot の badge と drawer 通知 slot の badge に集約。`/u/[username]` からは削除 (重複防止)。 |
| 未認証 bypass | AppShell が `useAuthStore(selectUserId)` を見て null なら children のみ render (将来 login page 用)。 |

## Architecture

### root layout

```
RootLayout
  └─ AuthProvider
      └─ SWRProvider
          └─ AppShell  ← 新規
              ├─ TopBar (sticky top)
              ├─ <main className="pb-20 …">{children}</main>
              ├─ BottomTab (sticky bottom、md:hidden)
              ├─ ComposerFAB (fixed bottom-right、md:hidden)
              └─ Drawer (overlay、avatar tap で open)
```

`AppShell` 内で `useAuthStore(selectUserId)` を見て、`userId` が null の場合は `children` のみ render (shell 非表示)。

### Top bar

mobile 表示 (`md:` 以上は max-width 拡幅して同一 layout を維持):

```
┌───────────────────────────────────┐
│ [Avatar]      dystopia.city       │
└───────────────────────────────────┘
```

- 左: viewer の avatar (sm size、click で Drawer 開く)
- 中央: テキストロゴ "dystopia.city" (本プロダクト固有、rx-sns の "rx" アイコンに相当)
- 右: 空 (将来拡張用)

未認証 (avatar 表示できない) 時は shell 自体 bypass のため top bar も非表示。

### Bottom-tab + 右下 FAB

mobile only (`md:hidden`):

| slot | label | route | icon | badge |
|---|---|---|---|---|
| 1 | ホーム | `/` | 🏠 (or home outline svg) | - |
| 2 | 検索 | `/search` | 🔍 | - |
| 3 | 通知 | `/notifications` | 🔔 | `useUnreadCount` |
| 4 | メッセージ | `/messages` | 💬 | - |
| **FAB** | 投稿 | (alert) | ＋ | - |

- 4 slot は均等幅。icon + ラベル小、active state = 現在 pathname の slot を accent color highlight。
- **FAB は bottom-tab とは独立 layer**: `position: fixed; right: 1rem; bottom: 5rem;` (bottom-tab 上 + 右端)。brand gradient 円形、影 (brand glow)、tap で `alert("投稿は近日対応です")`。
- 通知 slot badge は `useUnreadCount.count > 0` の時のみ表示、99+ クリップ。

### Drawer (overlay)

avatar tap で左から slide-in。半透明 overlay で背景を dim、外側 tap or ESC で close。

```
┌──── (overlay) ────────────────┐
│  [Avatar L]                    │
│  ひめ (display name)            │
│  @hime_kawaii                   │
│  0 フォロー中  2 フォロワー       │
│  ─────────────────              │
│  👤 プロフィール       → /profile        │
│  🔍 検索              → /search         │
│  🔔 通知 [N]          → /notifications  │
│  👣 足跡              → /footprints    │
│  💬 メッセージ        → /messages       │
│  🔖 ブックマーク       → /bookmarks      │
│  ⭐ 推し！            → /oshi           │
│  🏆 ランキング         → /ranking        │
│  ⚙ 設定              → /settings       │
│  ─────────────────              │
│  [Avatar S] @hime_kawaii  [→ logout] │
└────────────────────────────────┘
```

- 上半分: viewer の avatar + display name + handle + フォロー / フォロワー count (実装済の `useSocialCounts` を流用)。
- nav 項目順序は spec §4 line 158 + capture 通り。
- 最下部: avatar + handle + ログアウトアイコン (`useAuthStore.clearTokens()` + `/` へ navigate)。

## Stub pages (5 file)

各 stub page はシンプル placeholder:

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

対象 path:
- `/search`
- `/messages`
- `/footprints` (足跡、本プロダクトで route 名は英訳。日本語 nav label は「足跡」)
- `/bookmarks`
- `/ranking`

drawer / bottom-tab から tap した時に 404 にならず、明示的に「準備中」表示で UX を一貫させる。

## Existing UI side effects

- `src/app/u/[username]/page.tsx`: NotificationBell の import + 配置を削除 (重複表示防止、shell の bottom-tab badge と drawer 通知 slot badge に集約)
- 各 page の `<main className="mx-auto max-w-xl ...">` は据置、AppShell が外側で wrap、bottom-tab + FAB 分の `pb-24` 等を AppShell 側で main wrapper に注入
- `/dev/ui` page に AppShell 視覚 mock section 追加 (top bar / bottom-tab / drawer 開閉状態のスタイル展示) — **1b-B として defer 可**

## Decomposition (2 PR 想定)

- **1b-A** [本 spec → 直後の最大 PR]: AppShell + TopBar + BottomTab(4 + FAB overlay) + Drawer 部品 + layout 統合 + 5 stub pages + `/u/[username]` から NotificationBell 削除 + bell badge 集約。NavigationItem icon は emoji or lucide-react svg どちらか implementer 判断。全 nav 項目が tap で動作 (stub or 実装済 route へ navigate)。
- **1b-B** (任意): `/dev/ui` に AppShell mock section 追加。スコープ最小、独立 mergeable。

## Deferred / out of scope

- **desktop 3-col layout** (left nav 240 + center + right panel 320): Phase 2 以降、右 panel コンテンツも未定義
- **composer modal / `/posts/new`**: Post module 拡張、別 PR
- **検索 / メッセージ / 足跡 / ブックマーク / ランキング の実機能**: 各自 brainstorming + 縦実装、別 spec
- **出勤管理(Cast)**: memory の「商取引次元 drop」方針で削除済
- **カルテ(Cast)**: memory の「Phase 3 + 弁護士 hard gate」方針、本 spec から除外
- **キーボード a11y の完全 ARIA tab nav**: 1a で見送り済、本 PR でも継続 defer
- **Drawer 開閉 アニメーション微調整 (slide-in easing / overlay opacity 値)**: 実装時調整

## Verification

- **1b-A**: `pnpm exec tsc --noEmit` 緑、`pnpm build` 緑、`pnpm lint` baseline 維持、`/u/[username]` から NotificationBell が削除されているか grep 確認、bottom-tab 通知 slot badge が `useUnreadCount` を消費しているか hook 解決 trace、新 5 stub route が build 出力に登場、drawer 開閉 + active tab highlight + bell badge 表示の visual smoke (`/dev/ui` で representations を確認)
- **1b-B** (任意): tsc / build / lint baseline 同等

全 PR additive / build-green / auto-merge 運用。
