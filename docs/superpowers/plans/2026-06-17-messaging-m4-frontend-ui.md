# Messaging M4: frontend UI Implementation Plan (最終段)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** messaging slice 最終段。M3 (#713) で揃った data 層 + SSE bridge を消費する UI を実装。`/messages` を stub から実装 (inbox)、`/messages/[id]` 新規 (chat view + composer + typing indicator)、bottom-tab メッセージ slot の badge 連動 (`useTotalUnread`)、Drawer のメッセージ slot にも badge。これで messaging slice の縦切り完成。

**Architecture:** social `/oshi` + notifications `/notifications` + bookmarks `/bookmarks` の page pattern を踏襲。`MessagingStreamProvider` は `/messages` route 入口 (= `/messages/layout.tsx`) で mount し、`/messages` + `/messages/[id]` 全体で stream を 1 つ共有。bottom-tab badge は shell の `BottomTab.tsx` に `useTotalUnread` フックを追加で配置。

**Tech Stack:** Next.js 16 App Router / React / TypeScript / Tailwind / 既存 UI primitives。

**Spec:** `docs/superpowers/specs/2026-06-17-messaging-slice-design.md` Frontend > UI 節。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m4-frontend-ui`、branch `feat/messaging-m4-frontend-ui` (origin/main = `a89d8668`、M3 #713 マージ後)。**push しない**。
- 触らない: `src/modules/messaging/{types,hooks,providers}`、BFFs、monolith、proto、Drawer / TopBar の他 nav 項目構成 (badge 追加のみ)。

### 既存パターン (踏襲)

- page スケルトン: `/notifications/page.tsx` を参考 (loading / empty / list / "もっと見る")
- avatar + 表示名 row: `/oshi/page.tsx` の ProfileRow パターン
- composer: post の `PostComposer.tsx` を参考、小型版 (textarea + 送信、ESC で modal close は M4 範囲外)
- bottom-tab badge: `BottomTab.tsx` の通知 slot 同形、`useTotalUnread` のフックを追加

### Drawer / BottomTab の messaging badge

`src/components/shell/BottomTab.tsx`:
- 既存 line: `tab.id === "notifications"` で badge 表示
- 同じ pattern で `tab.id === "messages"` も判定、`useTotalUnread` の count を消費

`src/components/shell/Drawer.tsx`:
- 既存 `NAV_ITEMS` 配列で通知のみ `badgeKey: "unread"` 設定 → `useUnreadCount` 消費
- メッセージにも `badgeKey: "messaging_unread"` を追加 → `useTotalUnread` 消費

実装単純化のため Drawer 内で両 hook を call、`item.badgeKey` で switch (`unread` → useUnreadCount / `messaging_unread` → useTotalUnread)。

### /messages/layout.tsx で MessagingStreamProvider mount

```typescript
"use client";

import { MessagingStreamProvider } from "@/modules/messaging";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagingStreamProvider>{children}</MessagingStreamProvider>;
}
```

これで `/messages` + `/messages/[id]` 全体で 1 つの EventSource を共有、page 遷移しても切断・再接続しない。

## File Structure

**New (3 file):**
- `src/app/messages/layout.tsx`
- `src/app/messages/[id]/page.tsx`
- `src/modules/messaging/components/MessageComposer.tsx`

**Modify (3 file):**
- `src/app/messages/page.tsx` (stub から実装、inbox)
- `src/components/shell/BottomTab.tsx` (messages slot に badge 追加)
- `src/components/shell/Drawer.tsx` (messages 項目に badge 追加)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-17-messaging-m4-frontend-ui.md`

合計 7 file。

---

## Task 1: `/messages/layout.tsx` (Provider mount)

```tsx
"use client";

import { MessagingStreamProvider } from "@/modules/messaging";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagingStreamProvider>{children}</MessagingStreamProvider>;
}
```

---

## Task 2: `/messages/page.tsx` 実装 (inbox)

stub 置換、`useThreads` で list 取得 + 各 thread を tap で `/messages/[id]` へ navigate。

```tsx
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useThreads } from "@/modules/messaging";
import type { ThreadView } from "@/modules/messaging/types";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ThreadRow({ thread }: { thread: ThreadView }) {
  const name = thread.counterpart?.displayName || "—";
  const preview = thread.lastMessage?.content || "（メッセージなし）";
  const isUnread = thread.unreadCount > 0;

  return (
    <Link
      href={`/messages/${encodeURIComponent(thread.id)}`}
      className={`flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-bg-secondary ${
        isUnread ? "bg-bg-secondary/30" : ""
      }`}
    >
      <Avatar
        src={thread.counterpart?.avatarUrl || undefined}
        fallback={name.slice(0, 1) || "?"}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${isUnread ? "font-bold text-text-primary" : "text-text-primary"}`}>
            {name}
          </p>
          <span className="shrink-0 text-xs text-text-muted">{timeAgo(thread.lastMessageAt)}</span>
        </div>
        <p className="truncate pt-0.5 text-sm text-text-secondary">{preview}</p>
      </div>
      {isUnread && (
        <span className="ml-2 inline-flex shrink-0 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white">
          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
        </span>
      )}
    </Link>
  );
}

export default function MessagesPage() {
  const { threads, totalUnreadCount, loading, error } = useThreads();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">メッセージ</h1>
        <p className="pt-1 text-sm text-text-secondary">未読 {totalUnreadCount} 件</p>
      </div>

      {loading && threads.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました</p>}
      {!loading && threads.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">💬</span>
          <p className="pt-3 text-text-primary">メッセージはまだありません</p>
          <p className="pt-1 text-sm text-text-secondary">
            フォロー中の相手の プロフィール からメッセージを送信できます
          </p>
        </div>
      )}

      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} />
      ))}
    </main>
  );
}
```

---

## Task 3: `MessageComposer.tsx` component

shared composer (chat 入力用)。typing event を送信。

```tsx
"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

const MAX_LENGTH = 5000;

export function MessageComposer({ onSend, onTyping, disabled }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = content.trim();
  const overLimit = content.length > MAX_LENGTH;
  const canSubmit = !submitting && !disabled && trimmed.length > 0 && !overLimit;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (onTyping) onTyping();
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      try {
        await onSend(trimmed);
        setContent("");
      } catch {
        // SILENT: error は呼び出し側で expose、本 form は state 内回収しない
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, trimmed, onSend]
  );

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-bg px-4 py-3">
      <Textarea
        value={content}
        onChange={handleChange}
        placeholder="メッセージを入力"
        rows={2}
        disabled={disabled}
        aria-label="メッセージ本文"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          className={`text-xs ${overLimit ? "text-error" : "text-text-muted"}`}
          aria-live="polite"
        >
          {content.length}/{MAX_LENGTH}
        </span>
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
          {submitting ? "送信中…" : "送信"}
        </Button>
      </div>
    </form>
  );
}
```

---

## Task 4: `/messages/[id]/page.tsx` (chat view)

```tsx
"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { useMessages, useTyping } from "@/modules/messaging";
import { MessageComposer } from "@/modules/messaging/components/MessageComposer";
import { useAuthStore, selectUserId } from "@/stores/authStore";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const threadId = typeof params.id === "string" ? params.id : "";
  const viewerId = useAuthStore(selectUserId);

  const { messages, hasMore, loading, send, markRead, loadMore } = useMessages(threadId || null);
  const { typingActorId, sendTyping } = useTyping(threadId || null);

  // 最上端の message を read marker として mark (= 最新の to-viewer message)
  useEffect(() => {
    const incoming = messages.find((m) => m.senderId !== viewerId);
    if (incoming) {
      markRead(incoming.id);
    }
  }, [messages, viewerId, markRead]);

  if (!threadId) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">無効なスレッドです。</main>;
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-xl flex-col bg-bg text-text-primary">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold">チャット</h1>
      </header>

      <div className="flex-1 overflow-y-auto pt-2">
        {hasMore && (
          <div className="flex justify-center px-4 py-2">
            <button
              type="button"
              onClick={() => loadMore()}
              disabled={loading}
              className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {loading ? "読み込み中…" : "もっと見る"}
            </button>
          </div>
        )}
        {loading && messages.length === 0 && (
          <p className="px-4 py-6 text-center text-text-secondary">読み込み中…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="px-4 py-6 text-center text-text-secondary">メッセージはまだありません</p>
        )}
        {/* messages は新→古順なので reverse して古→新で render */}
        <div className="flex flex-col-reverse gap-2 px-4 pb-4">
          {messages.map((m) => {
            const isMine = m.senderId === viewerId;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isMine && <Avatar fallback="?" size="sm" />}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine ? "bg-accent text-white" : "bg-bg-secondary text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className={`mt-1 text-[10px] opacity-70 ${isMine ? "text-white" : "text-text-muted"}`}>
                    {timeAgo(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {typingActorId && typingActorId !== viewerId && (
        <p className="px-4 py-1 text-xs text-text-secondary" aria-live="polite">
          入力中…
        </p>
      )}

      <MessageComposer onSend={send} onTyping={sendTyping} />
    </main>
  );
}
```

---

## Task 5: `BottomTab.tsx` に messages badge 追加

`src/components/shell/BottomTab.tsx`:

- import 追加: `useTotalUnread` from `@/modules/messaging`
- tab.id === "messages" 判定で badge レンダリング
- 既存の通知 slot pattern を踏襲

```typescript
// import に追加
import { useTotalUnread } from "@/modules/messaging";

// component 内で fetch
const { count: notifCount } = useUnreadCount();
const { count: msgCount } = useTotalUnread();

// map 内
const badgeCount = tab.id === "notifications" ? notifCount : tab.id === "messages" ? msgCount : 0;
```

既存 `isNotif` 判定 + `count` を上記に置換、JSX で `{badgeCount > 0 && (...)}` 描画。

---

## Task 6: `Drawer.tsx` の messages 項目に badge 追加

`src/components/shell/Drawer.tsx`:

- import 追加: `useTotalUnread`
- `NAV_ITEMS` の `{ path: "/messages", ... }` に `badgeKey: "messaging_unread" as const` を追加
- hook call: `const { count: msgUnread } = useTotalUnread();`
- showBadge ロジックを 2 way switch に拡張:
  ```typescript
  const showBadge =
    item.badgeKey === "unread" ? unread > 0 :
    item.badgeKey === "messaging_unread" ? msgUnread > 0 :
    false;
  const badgeCount =
    item.badgeKey === "unread" ? unread :
    item.badgeKey === "messaging_unread" ? msgUnread :
    0;
  ```

JSX で `badgeCount` を使う。

---

## Task 7: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -5
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -5
```

期待: tsc 緑、build 緑 (`/messages` + 新 `/messages/[id]` route 登場)、lint baseline 同等。

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/messages" | /usr/bin/head -5
```

期待: `/messages` (Static or Dynamic) + `/messages/[id]` 両方出力。

- [ ] **Step 3: diff stat**

期待: 3 new + 3 modify + plan = **7 file**。

- [ ] **Step 4: commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m4-frontend-ui
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-17-messaging-m4-frontend-ui.md
/usr/bin/git commit -s -m "feat(messaging): frontend UI (/messages inbox + /messages/[id] chat + composer + typing + badges, M4)"
```

push しない。

---

## Deferred

- **DM 起点 UI (profile 詳細から「メッセージを送る」ボタン)**: 別 PR で `GetOrCreateThread` + navigate を加える
- **メッセージ削除 / 編集**: spec で v1 = immutable text only、別 PR
- **検索 / ソート 切替 (未読のみ表示等)**: 別 PR
- **/dev/ui mock section**: 別 polish PR

## Self-Review

- **Spec coverage (M4 範囲)**: `/messages` inbox + `/messages/[id]` chat + composer + typing + bottom-tab/drawer badge = 全項目
- **Placeholder 無し**: 全 component / page 完全 code
- **既存パターン踏襲**: notifications page + oshi page + post composer の structure 引き継ぎ
- **read marker logic**: useEffect で最新の incoming message を markRead、SWR mutate で自動 refresh
- **typing UI**: 3s auto-expire は useTyping 内 timer、UI は `typingActorId && typingActorId !== viewerId` で描画
- **Provider mount 位置**: `/messages/layout.tsx` (page 全体共有)、`/notifications` 等とは独立
- **検証**: tsc / build / lint baseline + 新 route 登場
