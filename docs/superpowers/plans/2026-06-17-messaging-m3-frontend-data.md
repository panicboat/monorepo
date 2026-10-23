# Messaging M3: frontend data + SSE bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M1+M2 で動いた messaging unary + streaming を frontend から消費する。types + 5 hooks + 8 BFFs (unary 7 + SSE bridge 1) + `MessagingStreamProvider` + `src/lib/grpc.ts` に `messagingClient` 追加。M4 (UI) が乗れる状態に。

**Architecture:** social S4 + notifications N4 + bookmarks B2 同形 (unary 部分)。**SSE bridge** は `src/app/api/messaging/stream/route.ts` で `ReadableStream` を返し、内部で gRPC stream subscribe (`messagingClient.streamEvents({})`) → async iterator から各 Event を SSE format `data: <json>\n\n` で client へ write。Frontend は `EventSource('/api/messaging/stream')` で受信、event を SWR cache に mutate。

**Tech Stack:** Next.js 16 App Router (Streaming response) / React / TypeScript / SWR / connect-es (gRPC streaming client) / EventSource。

**Spec:** `docs/superpowers/specs/2026-06-17-messaging-slice-design.md` Frontend 節。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m3-frontend-data`、branch `feat/messaging-m3-frontend-data` (origin/main = `6d8f6c3e`、M2 #712 マージ後)。**push しない**。
- 触らない: 他 module、monolith、proto、UI page (M4 で実装)。

### 既存パターン (踏襲)

- BFF: `src/app/api/bookmarks/route.ts` (GET) / `[postId]/route.ts` (POST/DELETE) を参考
- hook (single + toggle): `useBookmark` 同 pattern (initial fetch + action)
- hook (useSWRInfinite): `useFollowList` / `useBookmarkList` 同 pattern
- hook (useSWR + refreshInterval polling fallback): `useUnreadCount` (notifications) 同 pattern
- mapper: proto → view は inline (PostView / SocialAccountView の流用済 pattern)、または `src/modules/messaging/lib/mappers.ts` に集約

### SSE bridge 設計

`GET /api/messaging/stream`:
```typescript
export async function GET(req: NextRequest) {
  // requireAuth check (失敗時は 401)
  // headers = buildGrpcHeaders
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const event of messagingClient.streamEvents({}, { headers, signal: req.signal })) {
          const json = JSON.stringify(serializeEvent(event));
          controller.enqueue(enc.encode(`data: ${json}\n\n`));
        }
      } catch (e) {
        // signal aborted = client closed tab、正常終了扱い
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
```

`connect-es` 生成の `streamEvents()` は `AsyncIterable<Event>` を返す前提 (server-streaming RPC)。stub の export を実装時に確認、`signal` で client disconnect 検出。

### Frontend MessagingStreamProvider

root layout に追加せず、`/messages` 系 page 内で `<MessagingStreamProvider>` を mount する形 (chat 不使用時は EventSource 接続しない、コスト節約)。Provider が EventSource を持ち、event を SWRConfig 経由で mutate:

```typescript
"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";

export function MessagingStreamProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const es = new EventSource("/api/messaging/stream");
    es.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      switch (data.type) {
        case "message":
          // mutate thread list + messages for the thread
          mutate((key) => typeof key === "string" && key.startsWith(`/api/messaging/threads/${data.threadId}/messages`));
          mutate("/api/messaging/threads");
          mutate("/api/messaging/unread-count");
          break;
        case "read_state":
          mutate((key) => typeof key === "string" && key.startsWith(`/api/messaging/threads/${data.threadId}/messages`));
          mutate("/api/messaging/threads");
          break;
        case "typing":
          // 別 channel で typing state を broadcast (custom event)
          window.dispatchEvent(new CustomEvent("messaging:typing", { detail: data }));
          break;
      }
    };
    return () => es.close();
  }, [mutate]);

  return <>{children}</>;
}
```

typing は SWR ではなく custom event で hook (`useTyping(threadId)`) が listen + 3s auto-expire。

## File Structure

**New (13 file):**
- `src/modules/messaging/index.ts`
- `src/modules/messaging/types.ts`
- `src/modules/messaging/hooks/index.ts`
- `src/modules/messaging/hooks/useThreads.ts`
- `src/modules/messaging/hooks/useMessages.ts`
- `src/modules/messaging/hooks/useTotalUnread.ts`
- `src/modules/messaging/hooks/useTyping.ts`
- `src/modules/messaging/providers/MessagingStreamProvider.tsx`
- `src/app/api/messaging/threads/route.ts` (GET list + POST get_or_create)
- `src/app/api/messaging/threads/[id]/messages/route.ts` (GET)
- `src/app/api/messaging/messages/route.ts` (POST send)
- `src/app/api/messaging/threads/[id]/read/route.ts` (POST)
- `src/app/api/messaging/threads/[id]/typing/route.ts` (POST)
- `src/app/api/messaging/unread-count/route.ts` (GET)
- `src/app/api/messaging/stream/route.ts` (SSE bridge)

**Modify (1 file):**
- `src/lib/grpc.ts` (MessagingService import + messagingClient export)

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-17-messaging-m3-frontend-data.md`

合計 ~16 file。

---

## Task 1: types

**Files:** Create `src/modules/messaging/types.ts`。

```typescript
import type { SocialAccountView } from "@/modules/social";

export interface MessageView {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ThreadView {
  id: string;
  counterpart: SocialAccountView | null;
  lastMessage: MessageView | null;
  unreadCount: number;
  lastMessageAt: string;
}

export interface PaginatedThreadsResponse {
  threads: ThreadView[];
  nextCursor: string;
  hasMore: boolean;
  totalUnreadCount: number;
}

export interface PaginatedMessagesResponse {
  messages: MessageView[];
  nextCursor: string;
  hasMore: boolean;
}

// SSE bridge wire format (BFF → browser)
export type StreamEventPayload =
  | { type: "message"; data: MessageView }
  | { type: "read_state"; data: { threadId: string; accountId: string; lastReadMessageId: string } }
  | { type: "typing"; data: { threadId: string; accountId: string } };
```

---

## Task 2: index files

`src/modules/messaging/index.ts`:
```typescript
export * from "./types";
export * from "./hooks";
export { MessagingStreamProvider } from "./providers/MessagingStreamProvider";
```

`src/modules/messaging/hooks/index.ts`:
```typescript
export * from "./useThreads";
export * from "./useMessages";
export * from "./useTotalUnread";
export * from "./useTyping";
```

---

## Task 3: `src/lib/grpc.ts` に messagingClient 追加

```typescript
import { MessagingService } from "@/stub/messaging/v1/messaging_service_pb";
// ...
// Messaging domain client (messaging.v1)
export const messagingClient = createClient(MessagingService, transport);
```

---

## Task 4: BFFs unary (7 routes)

各 BFF は既存 pattern (`requireAuth` + `buildGrpcHeaders` + `handleApiError`)。proto messaging 型 → view 型 mapper は inline (`Timestamp` → ISO8601 は既存 `notificationToView` を参考)。

### Task 4.1: `GET /api/messaging/threads` + `POST /api/messaging/threads`

`src/app/api/messaging/threads/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { profileToSocialAccount } from "@/modules/social";
import type { ThreadView, MessageView } from "@/modules/messaging/types";

function timestampToIso(ts: any): string {
  if (!ts) return "";
  const seconds = typeof ts.seconds === "bigint" ? Number(ts.seconds) : (ts.seconds || 0);
  const millis = seconds * 1000 + Math.floor((ts.nanos || 0) / 1_000_000);
  return new Date(millis).toISOString();
}

function messageProtoToView(m: any): MessageView {
  return {
    id: m.id, threadId: m.threadId, senderId: m.senderId,
    content: m.content, createdAt: timestampToIso(m.createdAt),
  };
}

function threadProtoToView(t: any): ThreadView {
  return {
    id: t.id,
    counterpart: t.counterpart ? profileToSocialAccount(t.counterpart) : null,
    lastMessage: t.lastMessage && t.lastMessage.id ? messageProtoToView(t.lastMessage) : null,
    unreadCount: t.unreadCount || 0,
    lastMessageAt: timestampToIso(t.lastMessageAt),
  };
}

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = buildGrpcHeaders(req.headers);
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await messagingClient.listThreads({ limit, cursor }, { headers });
    return NextResponse.json({
      threads: (res.threads || []).map(threadProtoToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      totalUnreadCount: res.totalUnreadCount || 0,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListThreads");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const headers = buildGrpcHeaders(req.headers);
    const body = await req.json();
    const recipientAccountId = body?.recipientAccountId ?? "";
    if (!recipientAccountId) {
      return NextResponse.json({ error: "recipientAccountId required" }, { status: 400 });
    }
    const res = await messagingClient.getOrCreateThread({ recipientAccountId }, { headers });
    return NextResponse.json({
      thread: res.thread ? threadProtoToView(res.thread) : null,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetOrCreateThread");
  }
}
```

mapper を別 file (`src/modules/messaging/lib/mappers.ts`) に集約しても可、本 plan では各 BFF 内 inline で記述してまとめる。後段の `[id]/messages/route.ts` でも同 helper を再利用するため共有 module 化が綺麗、実装時に決定。

### Task 4.2-4.6: 残り 5 routes (省略形、上記同 pattern)

| Path | Method | RPC | body | response |
|---|---|---|---|---|
| `/api/messaging/threads/[id]/messages` | GET | `ListMessages` | - | `{messages, nextCursor, hasMore}` |
| `/api/messaging/messages` | POST | `SendMessage` | `{threadId?, recipientAccountId?, content}` | `{message, threadId}` |
| `/api/messaging/threads/[id]/read` | POST | `MarkRead` | `{messageId}` | `{success: true}` |
| `/api/messaging/threads/[id]/typing` | POST | `SendTyping` | - | `{success: true}` |
| `/api/messaging/unread-count` | GET | `GetTotalUnreadCount` | - | `{count}` |

実装時に Task 4.1 のテンプレを使い回す。

---

## Task 5: BFF SSE bridge `/api/messaging/stream/route.ts`

```typescript
import { NextRequest } from "next/server";
import { messagingClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth } from "@/lib/api-helpers";

function timestampToIso(ts: any): string {
  if (!ts) return "";
  const seconds = typeof ts.seconds === "bigint" ? Number(ts.seconds) : (ts.seconds || 0);
  const millis = seconds * 1000 + Math.floor((ts.nanos || 0) / 1_000_000);
  return new Date(millis).toISOString();
}

function serializeEvent(event: any) {
  if (event.payload.case === "messageEvent") {
    const m = event.payload.value;
    return {
      type: "message",
      data: {
        id: m.id, threadId: m.threadId, senderId: m.senderId,
        content: m.content, createdAt: timestampToIso(m.createdAt),
      },
    };
  } else if (event.payload.case === "readState") {
    const r = event.payload.value;
    return {
      type: "read_state",
      data: { threadId: r.threadId, accountId: r.accountId, lastReadMessageId: r.lastReadMessageId },
    };
  } else if (event.payload.case === "typing") {
    const t = event.payload.value;
    return { type: "typing", data: { threadId: t.threadId, accountId: t.accountId } };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const headers = buildGrpcHeaders(req.headers);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const event of messagingClient.streamEvents({}, { headers, signal: req.signal })) {
          const serialized = serializeEvent(event);
          if (!serialized) continue;
          controller.enqueue(enc.encode(`data: ${JSON.stringify(serialized)}\n\n`));
        }
      } catch {
        // signal aborted = client tab closed、正常終了扱い
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

export const dynamic = "force-dynamic";
```

> **Note**: connect-es の server-streaming RPC は async iterable を返す前提。stub の `streamEvents()` signature を実装時に確認、`AsyncIterable` でない場合は wrapper で iterate (`for await of`)。

---

## Task 6: 5 hooks

### Task 6.1: `useThreads`

useSWR + 30s polling fallback (streaming で実時間更新 + polling は接続切断時の fallback)。

```typescript
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PaginatedThreadsResponse } from "../types";

export function useThreads() {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PaginatedThreadsResponse>(
    token ? "/api/messaging/threads" : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 30000 }
  );
  return {
    threads: data?.threads || [],
    totalUnreadCount: data?.totalUnreadCount || 0,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

### Task 6.2: `useMessages(threadId)`

useSWRInfinite + cursor。

```typescript
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher, getAuthToken } from "@/lib/swr";
import { authFetch } from "@/lib/auth";
import { useCallback } from "react";
import type { PaginatedMessagesResponse } from "../types";

export function useMessages(threadId: string | null | undefined) {
  const token = getAuthToken();

  const getKey = (pageIndex: number, prev: PaginatedMessagesResponse | null): string | null => {
    if (!token || !threadId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/messaging/threads/${encodeURIComponent(threadId)}/messages${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PaginatedMessagesResponse>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  const messages = pages.flatMap((p) => p.messages || []);
  const hasMore = pages.length > 0 ? !!pages[pages.length - 1].hasMore : false;

  const send = useCallback(
    async (content: string) => {
      if (!threadId) return;
      await authFetch("/api/messaging/messages", {
        method: "POST",
        body: { threadId, content },
      });
      // streaming で event 受信 → SWR mutate されるので明示 refresh 不要だが、保険として
      mutate();
    },
    [threadId, mutate]
  );

  const markRead = useCallback(
    async (messageId: string) => {
      if (!threadId) return;
      await authFetch(
        `/api/messaging/threads/${encodeURIComponent(threadId)}/read`,
        { method: "POST", body: { messageId } }
      );
    },
    [threadId]
  );

  return {
    messages,
    hasMore,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    send,
    markRead,
    refresh: () => mutate(),
  };
}
```

### Task 6.3: `useTotalUnread`

```typescript
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";

interface Response { count: number }

export function useTotalUnread() {
  const token = getAuthToken();
  const { data, isLoading, mutate } = useSWR<Response>(
    token ? "/api/messaging/unread-count" : null,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false }
  );
  return {
    count: data?.count ?? 0,
    loading: isLoading,
    refresh: () => mutate(),
  };
}
```

### Task 6.4: `useTyping(threadId)`

custom event listen + 3s auto-expire + sendTyping action。

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";

interface TypingDetail { type: "typing"; data: { threadId: string; accountId: string } }

export function useTyping(threadId: string | null | undefined) {
  const [typingActorId, setTypingActorId] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onTyping = (e: Event) => {
      const detail = (e as CustomEvent<TypingDetail>).detail;
      if (detail?.data?.threadId !== threadId) return;
      setTypingActorId(detail.data.accountId);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTypingActorId(null), 3000);
    };
    window.addEventListener("messaging:typing", onTyping as EventListener);
    return () => {
      window.removeEventListener("messaging:typing", onTyping as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, [threadId]);

  const sendTyping = useCallback(async () => {
    if (!threadId || !getAuthToken()) return;
    try {
      await authFetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/typing`, { method: "POST" });
    } catch {
      // ignore
    }
  }, [threadId]);

  return { typingActorId, sendTyping };
}
```

---

## Task 7: `MessagingStreamProvider`

`src/modules/messaging/providers/MessagingStreamProvider.tsx` — 上記 architecture 節のコード。

```typescript
"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { getAuthToken } from "@/lib/auth";
import type { StreamEventPayload } from "../types";

export function MessagingStreamProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!getAuthToken()) return;
    const es = new EventSource("/api/messaging/stream");
    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as StreamEventPayload;
        if (payload.type === "message") {
          mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith(`/api/messaging/threads/${payload.data.threadId}/messages`)
          );
          mutate("/api/messaging/threads");
          mutate("/api/messaging/unread-count");
        } else if (payload.type === "read_state") {
          mutate(
            (key) =>
              typeof key === "string" &&
              key.startsWith(`/api/messaging/threads/${payload.data.threadId}/messages`)
          );
          mutate("/api/messaging/threads");
        } else if (payload.type === "typing") {
          window.dispatchEvent(new CustomEvent("messaging:typing", { detail: payload }));
        }
      } catch {
        // bad payload、skip
      }
    };
    return () => es.close();
  }, [mutate]);

  return <>{children}</>;
}
```

---

## Task 8: 検証 + commit

- [ ] **Step 1: tsc / build / lint baseline 維持**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待: tsc 緑、build 緑 + 新 8 BFF route 登場、lint baseline 同等。

- [ ] **Step 2: route 出力 smoke**

```bash
pnpm build 2>&1 | /usr/bin/grep -E "/api/messaging" | /usr/bin/head -10
```

期待: 8 route 全部 (`/threads` GET+POST、`/threads/[id]/messages` GET、`/messages` POST、`/threads/[id]/read` POST、`/threads/[id]/typing` POST、`/unread-count` GET、`/stream` GET)。

- [ ] **Step 3: diff stat**

期待: 13 new + 1 modify + plan = **15 file 前後**。

- [ ] **Step 4: commit**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-messaging-m3-frontend-data
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-17-messaging-m3-frontend-data.md
/usr/bin/git commit -s -m "feat(messaging): frontend data + SSE bridge (types + hooks + 8 BFFs + Provider, M3)"
```

push しない。

---

## Deferred

- **M4** (frontend UI): `/messages` 実装 + `/messages/[id]` 新規 + bottom-tab badge 連動 + typing UI + composer

## Self-Review

- **Spec coverage (M3 範囲)**: types + 5 hook + 8 BFF + grpc.ts client + Provider = 全項目
- **Placeholder 無し**: Task 4.1 で 1 BFF 完全 code、残り 5 BFF は table 形式で記述、実装時に同 pattern で書く
- **SSE bridge**: connect-es server-streaming の AsyncIterable → SSE `data: <json>\n\n` 変換、signal abort で正常 cleanup
- **Provider**: SWR cache mutate (threads / messages / unread-count) + custom event (typing)
- **typing 3s auto-expire**: client-side timer のみ、server-side 状態なし (spec の通り)
- **検証**: tsc / build / lint baseline + 新 8 route 登場
