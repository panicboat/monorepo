# Posts Q4a: frontend data layer (BFF + types + mappers + hooks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** symmetric Post / Like (account-authored) の **data 層**を frontend に追加する: `PostView` + mappers + BFF route handlers (`/api/posts` 配下) + SWR / pagination hooks。UI（ページ・コンポーズ・PostCard binding）は Q4b。

**Architecture:** **Additive、build-green**。新 `PostService` / `LikeService` の symmetric RPC（`ListPosts` / `GetPost` / `SavePost` / `DeletePost` / `LikePost` / `UnlikePost` / `GetLikeStatus`）を消費する純粋な配線。旧 `useCastPosts` / `useLike` / `useTimeline` と `/api/cast/timeline` / `/api/guest/likes` BFF は**無改変**（feed スライス・/dev が依存中、cleanup フェーズで剥がす）。connect-node client は server 専用（route handler）、hooks は `"use client"` で BFF route を `authFetch` / SWR で叩く（profile P5a 完全踏襲）。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / connect-es（`@connectrpc/connect` + `@connectrpc/connect-node`） / SWR / pnpm。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（§API contract / §Frontend）。前提: Q1（symmetric proto stub 生成済、`Post` / `PostAuthor` / `PostMedia` / `LikePost*` / `GetLikeStatus*` 全て stub 存在）、Q3 / Q3b（backend symmetric PostService / LikeService 実装済、main マージ済 PR #652）。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-frontend`。frontend app root: `services/frontend/workspace`。branch `feat/posts-frontend`（origin/main base、tracking 設定済）。**push しない・PR 作らない**（plan 完了後に親が判断）。
- 検索は **`/usr/bin/grep`** / `/usr/bin/find`（bare `grep` が不安定なため）。import alias `@/` → `src/`。
- **テストランナーは無い**（`package.json` に test script 無し、vitest/jest 無し）。検証は **`pnpm build`（= next build の型チェック）+ `pnpm lint`**、途中確認は **`pnpm exec tsc --noEmit`**。ユニットテストランナーは**追加しない**（未依頼の依存追加を避ける。mapper は純関数で型が主担保）。
- `pnpm build` は backend / DB を必要としない（型チェック + バンドルのみ、route は実行されない）。
- **build-green / additive**: 以下は**触らない**:
  - `src/modules/post/types.ts`（`CastPost` などの旧型）
  - `src/modules/post/lib/mappers.ts` / `lib/api-mappers.ts`
  - `src/modules/post/hooks/{useCastPosts,useLike,useComments,useTimeline}.ts`
  - `src/app/api/cast/*` / `src/app/api/guest/*` / `src/app/api/feed/*`
  - `src/lib/grpc.ts`（`postClient` / `likeClient` は既に bound。symmetric RPC はそれら client に additive で生えているのでクライアント追記不要）
- 新規 / 並走名で配置するため命名衝突なし。

### 既存パターン（探索で確定、踏襲する）

- **gRPC client**（`src/lib/grpc.ts`）: `createGrpcTransport({ baseUrl: process.env.MONOLITH_URL || "http://localhost:9001" })` を共有し `createClient(Service, transport)`。`postClient` / `likeClient` は既存 export（symmetric RPC を含む同じ Service 定義から生成）。
- **BFF route**: `requireAuth(req)`（`Authorization` ヘッダ無しで 401）→ `buildGrpcHeaders(req.headers)`（Bearer + X-Request-ID を透過）→ `client.method(init, { headers })` → proto を view にマップして `NextResponse.json` → `catch` で `isConnectError`/`GrpcCode.NOT_FOUND` 個別処理 + `handleApiError(error, "Ctx")`。
- **dynamic route param は async**: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`（Next 16）。
- **SWR hook**: `"use client"`、`getAuthToken()` でトークン有無を判定し SWR key を条件付き（無ければ `null`）、`fetcher`（`@/lib/swr`）で GET。mutation は `authFetch`（`@/lib/auth/fetch`、`{ method, body }`）→ `mutate`。
- **cursor pagination hook**: `usePaginatedFetch<T, R>({ apiUrl, mapResponse, getItemId, fetchFn, buildParams? })` を使う（既存 `useCastPosts` と同じ）。
- **stub フィールド（camelCase、確定）**: `Post{id,authorId,content,media[],createdAt,author?,likesCount,commentsCount,visibility,hashtags[],liked}`、`PostAuthor{accountId,displayName,username,avatarUrl}`、`PostMedia{id,mediaType,url,thumbnailUrl,mediaId}`、`ListPostsRequest{limit,cursor,authorId,filter}` / `ListPostsResponse{posts[],nextCursor,hasMore}`、`SavePostRequest{id,content,media[],visibility,hashtags[]}` / `SavePostResponse{post}`、`GetPostRequest{id}` / `GetPostResponse{post}`、`DeletePostRequest{id}` / `DeletePostResponse{}`、`LikePostRequest{postId}` / `LikePostResponse{likesCount}`、`UnlikePostRequest{postId}` / `UnlikePostResponse{likesCount}`、`GetLikeStatusRequest{postIds[]}` / `GetLikeStatusResponse{liked: map<string,bool>}`。RPC は camelCase（`listPosts` / `getPost` / `savePost` / `deletePost` / `likePost` / `unlikePost` / `getLikeStatus`）。

## File Structure

- Create: `src/modules/post/lib/post-view.ts`（symmetric view 型）
- Create: `src/modules/post/lib/post-mappers.ts`（proto Post → PostView 変換 + SavePostRequest builder）
- Modify: `src/modules/post/lib/index.ts`（新 mapper を additive で re-export）
- Create: `src/app/api/posts/route.ts`（GET list, POST create）
- Create: `src/app/api/posts/[id]/route.ts`（GET, PUT update, DELETE）
- Create: `src/app/api/posts/[id]/like/route.ts`（POST like, DELETE unlike）
- Create: `src/app/api/posts/likes/status/route.ts`（GET batch）
- Create: `src/modules/post/hooks/usePosts.ts`（cursor pagination list）
- Create: `src/modules/post/hooks/usePost.ts`（single post）
- Create: `src/modules/post/hooks/usePostLike.ts`（symmetric like）
- Modify: `src/modules/post/hooks/index.ts`（新 hook を additive で re-export）

> route 衝突回避: `/api/posts/[id]/like` を子セグメントに置き、`/api/posts/likes/status` は `likes/status` の静的セグメント（`[id]` と別階層）。Next の dynamic vs static の優先順序で衝突しない（静的優先）。

---

## Task 1: 型 + mappers（symmetric）

**Files:** Create `src/modules/post/lib/post-view.ts`, `src/modules/post/lib/post-mappers.ts`; Modify `src/modules/post/lib/index.ts`。

- [ ] **Step 1: `src/modules/post/lib/post-view.ts` を作成**

```ts
export interface PostAuthorView {
  accountId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
}

export interface PostMediaView {
  id: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl: string;
  mediaId: string;
}

export interface PostView {
  id: string;
  authorId: string;
  content: string;
  media: PostMediaView[];
  createdAt: string;
  author: PostAuthorView | null;
  likesCount: number;
  commentsCount: number;
  visibility: "public" | "private";
  hashtags: string[];
  liked: boolean;
}

export interface SavePostMediaInput {
  mediaType: "image" | "video";
  mediaId: string;
}

export interface SavePostPayload {
  id?: string;
  content: string;
  media?: SavePostMediaInput[];
  visibility?: "public" | "private";
  hashtags?: string[];
}

export interface PostsListResult {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface PostLikeStatus {
  liked: Record<string, boolean>;
}

export interface PostLikeResult {
  likesCount: number;
}
```

- [ ] **Step 2: `src/modules/post/lib/post-mappers.ts` を作成**

```ts
import type {
  Post,
  PostAuthor,
  PostMedia,
} from "@/stub/post/v1/post_service_pb";
import type {
  PostAuthorView,
  PostMediaView,
  PostView,
  PostsListResult,
  SavePostPayload,
} from "@/modules/post/lib/post-view";

export function mapPostAuthorToView(a: PostAuthor | undefined): PostAuthorView | null {
  if (!a) return null;
  return {
    accountId: a.accountId || "",
    displayName: a.displayName || "",
    username: a.username || "",
    avatarUrl: a.avatarUrl || "",
  };
}

export function mapPostMediaToView(m: PostMedia): PostMediaView {
  const t = (m.mediaType || "image") as "image" | "video";
  return {
    id: m.id || "",
    mediaType: t === "video" ? "video" : "image",
    url: m.url || "",
    thumbnailUrl: m.thumbnailUrl || "",
    mediaId: m.mediaId || "",
  };
}

export function mapPostToView(p: Post): PostView {
  const v = (p.visibility || "public").toLowerCase();
  return {
    id: p.id,
    authorId: p.authorId || "",
    content: p.content || "",
    media: (p.media || []).map(mapPostMediaToView),
    createdAt: p.createdAt || "",
    author: mapPostAuthorToView(p.author),
    likesCount: p.likesCount || 0,
    commentsCount: p.commentsCount || 0,
    visibility: v === "private" ? "private" : "public",
    hashtags: p.hashtags || [],
    liked: p.liked || false,
  };
}

export function mapPostsListResponse(res: {
  posts: Post[];
  nextCursor: string;
  hasMore: boolean;
}): PostsListResult {
  return {
    posts: (res.posts || []).map(mapPostToView),
    nextCursor: res.nextCursor || "",
    hasMore: res.hasMore || false,
  };
}

export function buildSavePostRequest(payload: SavePostPayload) {
  return {
    id: payload.id || "",
    content: payload.content,
    media: (payload.media || []).map((m) => ({
      id: "",
      mediaType: m.mediaType,
      url: "",
      thumbnailUrl: "",
      mediaId: m.mediaId,
    })),
    visibility: payload.visibility || "public",
    hashtags: payload.hashtags || [],
  };
}
```

- [ ] **Step 3: `src/modules/post/lib/index.ts` を additive で更新**

現状の内容:

```ts
export * from "./mappers";
```

を以下に置き換え（既存 export はそのまま、symmetric を additive 追加）:

```ts
export * from "./mappers";
export * from "./post-view";
export * from "./post-mappers";
```

- [ ] **Step 4: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: 新規型エラー無し（`mapPostToView` の戻り型が `PostView` と一致、`buildSavePostRequest` の戻りが `SavePostRequest` の init 形と一致）。既存の無関係エラーがあっても触らない（増やさないこと）。

---

## Task 2: BFF route handlers（`/api/posts` namespace 新設）

**Files:** Create 4 route ファイル。

- [ ] **Step 1: `src/app/api/posts/route.ts`（GET list + POST create）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import {
  mapPostToView,
  mapPostsListResponse,
  buildSavePostRequest,
} from "@/modules/post/lib/post-mappers";
import type { SavePostPayload } from "@/modules/post/lib/post-view";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const limitParam = req.nextUrl.searchParams.get("limit");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const authorId = req.nextUrl.searchParams.get("author_id") || "";
    const filter = req.nextUrl.searchParams.get("filter") || "";

    const limit = limitParam ? Math.max(1, Math.min(50, parseInt(limitParam, 10) || 20)) : 20;
    const res = await postClient.listPosts(
      { limit, cursor, authorId, filter },
      { headers }
    );
    return NextResponse.json(mapPostsListResponse(res));
  } catch (error: unknown) {
    return handleApiError(error, "ListPosts");
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as SavePostPayload;
    const headers = buildGrpcHeaders(req.headers);
    const res = await postClient.savePost(buildSavePostRequest({ ...body, id: "" }), { headers });
    if (!res.post) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ post: mapPostToView(res.post) });
  } catch (error: unknown) {
    return handleApiError(error, "CreatePost");
  }
}
```

- [ ] **Step 2: `src/app/api/posts/[id]/route.ts`（GET + PUT + DELETE）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { postClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { isConnectError, GrpcCode } from "@/lib/grpc-errors";
import { mapPostToView, buildSavePostRequest } from "@/modules/post/lib/post-mappers";
import type { SavePostPayload } from "@/modules/post/lib/post-view";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await postClient.getPost({ id }, { headers });
    if (!res.post) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return NextResponse.json({ post: mapPostToView(res.post) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "GetPost");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const body = (await req.json()) as SavePostPayload;
    const headers = buildGrpcHeaders(req.headers);
    const res = await postClient.savePost(buildSavePostRequest({ ...body, id }), { headers });
    if (!res.post) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ post: mapPostToView(res.post) });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "UpdatePost");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    await postClient.deletePost({ id }, { headers });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.NOT_FOUND) {
      return NextResponse.json({ error: "投稿が見つかりませんでした" }, { status: 404 });
    }
    return handleApiError(error, "DeletePost");
  }
}
```

- [ ] **Step 3: `src/app/api/posts/[id]/like/route.ts`（POST like + DELETE unlike）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { likeClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await likeClient.likePost({ postId: id }, { headers });
    return NextResponse.json({ likesCount: res.likesCount });
  } catch (error: unknown) {
    return handleApiError(error, "LikePost");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id } = await params;
    const headers = buildGrpcHeaders(req.headers);
    const res = await likeClient.unlikePost({ postId: id }, { headers });
    return NextResponse.json({ likesCount: res.likesCount });
  } catch (error: unknown) {
    return handleApiError(error, "UnlikePost");
  }
}
```

- [ ] **Step 4: `src/app/api/posts/likes/status/route.ts`（GET batch）**

```ts
import { NextRequest, NextResponse } from "next/server";
import { likeClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const raw = req.nextUrl.searchParams.get("post_ids") || "";
    const postIds = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    if (postIds.length === 0) {
      return NextResponse.json({ liked: {} });
    }
    const res = await likeClient.getLikeStatus({ postIds }, { headers });
    const liked: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(res.liked || {})) {
      liked[k] = Boolean(v);
    }
    return NextResponse.json({ liked });
  } catch (error: unknown) {
    return handleApiError(error, "GetLikeStatus");
  }
}
```

- [ ] **Step 5: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: 新規 route の型エラーなし。`postClient.listPosts` / `getPost` / `savePost` / `deletePost`、`likeClient.likePost` / `unlikePost` / `getLikeStatus` の init 形と一致、`params` の Promise が型に合う。

---

## Task 3: SWR / pagination hooks

**Files:** Create `src/modules/post/hooks/{usePosts,usePost,usePostLike}.ts`; Modify `src/modules/post/hooks/index.ts`。

- [ ] **Step 1: `src/modules/post/hooks/usePosts.ts`（cursor pagination list）**

```ts
"use client";

import { useCallback } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { usePaginatedFetch, type PaginatedResult } from "@/lib/hooks/usePaginatedFetch";
import type { PostView, PostsListResult, SavePostPayload } from "@/modules/post/lib/post-view";

interface UsePostsOptions {
  authorId?: string;
  filter?: string;
}

interface SavePostResponse {
  post: PostView;
}

export function usePosts(options: UsePostsOptions = {}) {
  const { authorId, filter } = options;

  const mapResponse = useCallback(
    (data: PostsListResult): PaginatedResult<PostView> => ({
      items: data.posts,
      hasMore: data.hasMore,
      nextCursor: data.nextCursor || null,
    }),
    []
  );

  const getItemId = useCallback((p: PostView) => p.id, []);

  const fetchFn = useCallback(
    async (url: string): Promise<PostsListResult> =>
      authFetch<PostsListResult>(url, { cache: "no-store" }),
    []
  );

  const buildParams = useCallback(
    (params: URLSearchParams) => {
      if (authorId) params.set("author_id", authorId);
      if (filter) params.set("filter", filter);
    },
    [authorId, filter]
  );

  const {
    items: posts,
    setItems: setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = usePaginatedFetch<PostView, PostsListResult>({
    apiUrl: "/api/posts",
    mapResponse,
    getItemId,
    fetchFn,
    buildParams,
  });

  const createPost = useCallback(
    async (payload: SavePostPayload) => {
      const data = await authFetch<SavePostResponse>("/api/posts", {
        method: "POST",
        body: payload,
      });
      setPosts((prev) => [data.post, ...prev]);
      return data.post;
    },
    [setPosts]
  );

  const updatePost = useCallback(
    async (id: string, payload: SavePostPayload) => {
      const data = await authFetch<SavePostResponse>(`/api/posts/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: payload,
      });
      setPosts((prev) => prev.map((p) => (p.id === data.post.id ? data.post : p)));
      return data.post;
    },
    [setPosts]
  );

  const deletePost = useCallback(
    async (id: string) => {
      await authFetch(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p.id !== id));
    },
    [setPosts]
  );

  return {
    posts,
    setPosts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
    createPost,
    updatePost,
    deletePost,
  };
}
```

- [ ] **Step 2: `src/modules/post/hooks/usePost.ts`（single post）**

```ts
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { PostView } from "@/modules/post/lib/post-view";

interface PostResponse {
  post: PostView;
}

export function usePost(id: string | null) {
  const token = getAuthToken();
  const { data, error, isLoading, mutate } = useSWR<PostResponse>(
    token && id ? `/api/posts/${encodeURIComponent(id)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return {
    post: data?.post ?? null,
    loading: isLoading,
    error,
    mutate,
  };
}
```

- [ ] **Step 3: `src/modules/post/hooks/usePostLike.ts`（symmetric like）**

```ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { getAuthToken } from "@/lib/swr";

interface LikeEntry {
  liked: boolean;
  likesCount: number;
}

interface LikeResponse {
  likesCount: number;
}

interface LikeStatusResponse {
  liked: Record<string, boolean>;
}

export function usePostLike() {
  const [state, setState] = useState<Record<string, LikeEntry>>({});
  const [loading, setLoading] = useState(false);

  const like = useCallback(async (postId: string) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot like: not authenticated");
      return null;
    }
    setLoading(true);
    try {
      const data = await authFetch<LikeResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "POST" }
      );
      setState((prev) => ({
        ...prev,
        [postId]: { liked: true, likesCount: data.likesCount },
      }));
      return data.likesCount;
    } finally {
      setLoading(false);
    }
  }, []);

  const unlike = useCallback(async (postId: string) => {
    if (!getAuthToken()) {
      // FALLBACK: Returns null when not authenticated
      console.warn("Cannot unlike: not authenticated");
      return null;
    }
    setLoading(true);
    try {
      const data = await authFetch<LikeResponse>(
        `/api/posts/${encodeURIComponent(postId)}/like`,
        { method: "DELETE" }
      );
      setState((prev) => ({
        ...prev,
        [postId]: { liked: false, likesCount: data.likesCount },
      }));
      return data.likesCount;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleLike = useCallback(
    async (postId: string, currentlyLiked: boolean) =>
      currentlyLiked ? unlike(postId) : like(postId),
    [like, unlike]
  );

  const fetchLikeStatus = useCallback(
    async (postIds: string[]): Promise<Record<string, boolean>> => {
      if (postIds.length === 0) return {};
      const data = await authFetch<LikeStatusResponse>(
        `/api/posts/likes/status?post_ids=${encodeURIComponent(postIds.join(","))}`,
        { method: "GET" }
      );
      return data.liked || {};
    },
    []
  );

  const setInitialState = useCallback(
    (postId: string, liked: boolean, likesCount: number) => {
      setState((prev) => ({
        ...prev,
        [postId]: { liked, likesCount },
      }));
    },
    []
  );

  const isLiked = useCallback(
    (postId: string, fallback = false) => state[postId]?.liked ?? fallback,
    [state]
  );
  const getLikesCount = useCallback(
    (postId: string, fallback = 0) => state[postId]?.likesCount ?? fallback,
    [state]
  );

  return {
    like,
    unlike,
    toggleLike,
    fetchLikeStatus,
    setInitialState,
    isLiked,
    getLikesCount,
    state,
    loading,
  };
}
```

- [ ] **Step 4: `src/modules/post/hooks/index.ts` を additive で更新**

現状の内容:

```ts
export { useCastPosts } from "./useCastPosts";
export { useLike } from "./useLike";
export { useComments } from "./useComments";
export { useTimeline, useGuestPost } from "./useTimeline";
```

を以下に置き換え（既存 export は保持、symmetric を additive 追加）:

```ts
export { useCastPosts } from "./useCastPosts";
export { useLike } from "./useLike";
export { useComments } from "./useComments";
export { useTimeline, useGuestPost } from "./useTimeline";
export { usePosts } from "./usePosts";
export { usePost } from "./usePost";
export { usePostLike } from "./usePostLike";
```

- [ ] **Step 5: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -20`
Expected: 新規 hooks の型エラーなし。`usePaginatedFetch<PostView, PostsListResult>` の generics が `mapResponse` / `getItemId` / `fetchFn` の型と整合。

---

## Task 4: build / lint で検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド（型 + バンドル）**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -30`
Expected: 成功。新 route（`/api/posts`, `/api/posts/[id]`, `/api/posts/[id]/like`, `/api/posts/likes/status`）がビルド出力に現れ、型エラーなし。`/api/cast/timeline` 等の旧 route も保持されていること。

- [ ] **Step 2: lint**

Run: `cd services/frontend/workspace && pnpm lint 2>&1 | tail -20`
Expected: 新規ファイルに lint エラーなし。

- [ ] **Step 3: コミット（signoff、Co-Authored-By 無し）**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-posts-frontend
git add services/frontend/workspace/src/modules/post services/frontend/workspace/src/app/api/posts docs/superpowers/plans/2026-06-08-posts-q4a-frontend-data-layer.md
git commit -s -m "feat(posts): add symmetric posts frontend data layer (BFF + hooks)"
```
（push は親が判断、ここでは push しない。）

---

## Deferred（Q4a では実施しない）

- **PostCardBinding**（`PostView` → 既存 `ui/post-card.tsx` `PostCardProps` への adapter）→ **Q4b**。
- **PostComposer**（投稿作成 form、`SavePostPayload` 構築 + `createPost` 呼び出し）→ **Q4b**。
- **`/posts/[id]` 投稿詳細ページ**（本文 + media + like ボタン + コメント表示）→ **Q4b**。
- **`/dev/ui` への mock デモ**（symmetric post の視覚確認セクション追加）→ **Q4b**。
- **comments の symmetric 化**（現状 `user_id` ベースで対称的、BFF は cast/guest 旧パス → cleanup フェーズで ProfileService 化と同時に行う）。
- **feed timeline**（複数著者の集約タイムライン）→ feed スライス。
- **follow-gate**（鍵アカ閲覧制限）→ social スライス。
- **media 実アップロード e2e**（object storage 未配備のため、Q4b でも mock URL 表示までに留める）。
- **旧 `useCastPosts` / `useLike` / `useTimeline` / `/api/cast/timeline` の撤去**（feed / dev が消費中 → cleanup フェーズで一括）。

## Self-Review（作成者チェック済）

- **Spec coverage（Q4a 範囲）**: §API contract の symmetric PostService 4 RPC + LikeService 3 RPC を BFF + hooks で配線。§Frontend の「型 + mappers + SWR hooks + BFF routes」をデータ層として完全実装。UI は明示的に Q4b へ分離。
- **Additive で build-green**: 旧 `useCastPosts` / `useLike` / `useTimeline` / `useComments` と `types.ts` / `mappers.ts` / `api-mappers.ts` は無改変。`hooks/index.ts` と `lib/index.ts` は既存 export を保持し additive で追加。`src/lib/grpc.ts` は無改変（`postClient` / `likeClient` 既存）。`/api/cast/*` / `/api/guest/*` も無改変、新 `/api/posts` namespace で独立配置。
- **Placeholder 無し**: 型 / mappers / 4 route / 3 hooks すべて完全コード。
- **型 / 命名整合**:
  - `PostView` ↔ proto `Post`（camelCase: `authorId`, `likesCount`, `commentsCount`, `liked`）対応。
  - `PostMediaView.mediaType` は `"image" | "video"` リテラル union、`mapPostMediaToView` で proto の `string` を絞り込み。
  - `SavePostPayload` → `buildSavePostRequest` 戻り = `SavePostRequest` の init 形（`id` / `content` / `media[]` / `visibility` / `hashtags[]`）と一致。`PostMedia` init には `id` / `url` / `thumbnailUrl` も必要（input 時は空文字、`mediaId` のみが実値）。
  - BFF が返す `{ post: PostView }` / `{ posts, nextCursor, hasMore }` / `{ likesCount }` / `{ liked }` を hooks の response interface と一致させた。
  - `usePosts` の `usePaginatedFetch<PostView, PostsListResult>` generics 整合。
  - dynamic params は `Promise<{id}>`（Next 16 規約）。
  - `/api/posts/likes/status` を `[id]` と別階層に置き route 衝突回避（静的セグメント `likes/status`）。
- **テスト方針**: frontend ランナー無し → `pnpm build`（tsc 型チェック）+ `pnpm lint` を検証本体に。ユニットテストランナーは未依頼のため追加せず（mapper は純関数で型が主担保、ローカル e2e は Q4b で `/dev/ui` + `[[local-e2e-run]]` メモリ手順で実施）。
