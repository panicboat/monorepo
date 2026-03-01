# エラー処理統一 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** フロントエンド全レイヤーのエラー処理を統一し、ユーザーに一貫した日本語エラー通知を提供する。

**Architecture:** 既存の throw ベースを維持しつつ、`AppError` 型でエラーを分類。HTTP ステータスから `ErrorCode` を自動判定し、全エラーを Toast で通知する。Error Boundary を追加して未ハンドルエラーを受け止める。

**Tech Stack:** Next.js App Router, React 19, TypeScript, SWR, Framer Motion

**Design Doc:** `docs/plans/2026-03-01-error-handling-design.md`

---

## Task 1: AppError クラスと ERROR_MESSAGES 定数の作成

**Files:**
- Create: `services/nyx/workspace/src/lib/errors.ts`
- Create: `services/nyx/workspace/src/lib/error-messages.ts`

**Step 1: `errors.ts` を作成**

```typescript
// services/nyx/workspace/src/lib/errors.ts

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "NETWORK"
  | "SERVER"
  | "UNKNOWN";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    default:
      return status >= 500 ? "SERVER" : "UNKNOWN";
  }
}
```

**Step 2: `error-messages.ts` を作成**

```typescript
// services/nyx/workspace/src/lib/error-messages.ts
import type { ErrorCode } from "./errors";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "ログインしてください",
  FORBIDDEN: "この操作を行う権限がありません",
  NOT_FOUND: "データが見つかりませんでした",
  VALIDATION: "入力内容を確認してください",
  CONFLICT: "データが競合しています",
  NETWORK: "ネットワーク接続を確認してください",
  SERVER: "サーバーエラーが発生しました。しばらくしてからお試しください",
  UNKNOWN: "予期しないエラーが発生しました",
};

/** ErrorCode からデフォルトの日本語メッセージを取得 */
export function getDefaultMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}
```

**Step 3: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: エラーなし

**Step 4: コミット**

```bash
git add services/nyx/workspace/src/lib/errors.ts services/nyx/workspace/src/lib/error-messages.ts
git commit -m "feat: add AppError class and error message constants"
```

---

## Task 2: api-helpers.ts の更新

**Files:**
- Modify: `services/nyx/workspace/src/lib/api-helpers.ts`

**Step 1: `handleApiError` を改修**

`handleApiError` がエラーメッセージを日本語で返すようにする。レスポンス形式 `{ error: string }` は維持（クライアント側の読み取りコードに影響しないため）。

```typescript
// services/nyx/workspace/src/lib/api-helpers.ts
import { NextRequest, NextResponse } from "next/server";
import { ConnectError } from "@connectrpc/connect";
import { grpcCodeToHttpStatus } from "./grpc-errors";
import { httpStatusToErrorCode } from "./errors";
import { getDefaultMessage } from "./error-messages";

export function requireAuth(req: NextRequest): NextResponse | null {
  if (!req.headers.get("authorization")) {
    return NextResponse.json(
      { error: "ログインしてください" },
      { status: 401 }
    );
  }
  return null;
}

export function extractPaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 20
): { limit: number; cursor: string } {
  return {
    limit: parseInt(searchParams.get("limit") || String(defaultLimit), 10),
    cursor: searchParams.get("cursor") || "",
  };
}

export function handleApiError(error: unknown, context?: string): NextResponse {
  if (error instanceof ConnectError) {
    const status = grpcCodeToHttpStatus(error.code);
    const code = httpStatusToErrorCode(status);
    const message = getDefaultMessage(code);
    if (context) {
      console.error(`[${context}] gRPC error (${error.code}):`, error.rawMessage);
    }
    return NextResponse.json({ error: message }, { status });
  }

  if (context) {
    console.error(`[${context}] Error:`, error);
  }
  return NextResponse.json(
    { error: "予期しないエラーが発生しました" },
    { status: 500 }
  );
}
```

**Step 2: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: エラーなし

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/lib/api-helpers.ts
git commit -m "refactor: update handleApiError to return Japanese messages"
```

---

## Task 3: authFetch を AppError に統合

**Files:**
- Modify: `services/nyx/workspace/src/lib/auth/fetch.ts`

**Step 1: `ApiError` を `AppError` に置き換え**

```typescript
// services/nyx/workspace/src/lib/auth/fetch.ts
"use client";

import { getAuthToken } from "@/lib/swr";
import { AppError, httpStatusToErrorCode } from "@/lib/errors";
import { getDefaultMessage } from "@/lib/error-messages";

export type AuthFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
  cache?: RequestCache;
};

// TODO: ApiError を使っている既存コードの移行期間中の後方互換性
export { AppError as ApiError } from "@/lib/errors";

export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true, cache } = options;
  const token = getAuthToken();

  if (requireAuth && !token) {
    throw new AppError("UNAUTHORIZED", "ログインしてください", 401);
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
    });
  } catch (cause) {
    throw new AppError(
      "NETWORK",
      "ネットワーク接続を確認してください",
      undefined,
      cause
    );
  }

  if (!res.ok) {
    // FALLBACK: Returns empty object when JSON parse fails
    const errBody = await res.json().catch(() => ({}));
    const code = httpStatusToErrorCode(res.status);
    const message = errBody.error || getDefaultMessage(code);
    throw new AppError(code, message, res.status, errBody);
  }

  return res.json();
}
```

**Step 2: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: エラーなし（`ApiError` の re-export で後方互換性を維持しているため）

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/lib/auth/fetch.ts
git commit -m "refactor: replace ApiError with AppError in authFetch"
```

---

## Task 4: SWR fetcher の更新

**Files:**
- Modify: `services/nyx/workspace/src/lib/swr.ts`

**Step 1: fetcher を簡素化**

`AppError` は既に `Error` を継承しているため、SWR 互換のための変換が不要になる。`status` と `info` プロパティは `AppError` の `status` と `cause` で代替する。

```typescript
// services/nyx/workspace/src/lib/swr.ts
import { SWRConfiguration } from "swr";

import { useAuthStore } from "@/stores/authStore";

export function getAuthToken(): string | null {
  // FALLBACK: Returns null during SSR since browser APIs are unavailable
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().accessToken;
}

export const fetcher = async <T>(url: string): Promise<T> => {
  const { authFetch } = await import("@/lib/auth/fetch");
  return authFetch<T>(url, {
    method: "GET",
    requireAuth: false,
    cache: "no-store",
  });
};

export const authFetcher = async <T>(url: string): Promise<T> => {
  const { authFetch } = await import("@/lib/auth/fetch");
  return authFetch<T>(url, {
    method: "GET",
    requireAuth: true,
    cache: "no-store",
  });
};

export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 3,
};
```

**Step 2: SWR エラー利用箇所の互換性を確認**

以下のファイルで `(err as { status?: number }).status` パターンを使っている。`AppError` は `status` プロパティを持つので互換性あり。

- `services/nyx/workspace/src/modules/portfolio/hooks/useCastData.ts`
- `services/nyx/workspace/src/modules/portfolio/hooks/useGuestData.ts`

確認のみ、変更不要。

**Step 3: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: エラーなし

**Step 4: コミット**

```bash
git add services/nyx/workspace/src/lib/swr.ts
git commit -m "refactor: simplify SWR fetchers with AppError"
```

---

## Task 5: useApiMutation の更新

**Files:**
- Modify: `services/nyx/workspace/src/lib/hooks/useApiMutation.ts`

**Step 1: AppError を使用し、エラーメッセージを日本語化**

```typescript
// services/nyx/workspace/src/lib/hooks/useApiMutation.ts
"use client";

import { useState, useCallback } from "react";
import { getAuthToken } from "@/lib/swr";
import { AppError, httpStatusToErrorCode } from "@/lib/errors";
import { getDefaultMessage } from "@/lib/error-messages";

export type HttpMethod = "POST" | "PUT" | "DELETE" | "PATCH";

export interface UseApiMutationOptions<TPayload, TResponse> {
  apiUrl: string;
  method?: HttpMethod;
  mapResponse?: (data: unknown) => TResponse;
  mapPayload?: (payload: TPayload) => unknown;
  onSuccess?: (data: TResponse) => void;
  onError?: (error: AppError) => void;
}

export interface UseApiMutationReturn<TPayload, TResponse> {
  mutate: (payload: TPayload) => Promise<TResponse>;
  loading: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useApiMutation<TPayload = unknown, TResponse = unknown>(
  options: UseApiMutationOptions<TPayload, TResponse>
): UseApiMutationReturn<TPayload, TResponse> {
  const {
    apiUrl,
    method = "POST",
    mapResponse = (data) => data as TResponse,
    mapPayload = (payload) => payload,
    onSuccess,
    onError,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const mutate = useCallback(
    async (payload: TPayload): Promise<TResponse> => {
      const token = getAuthToken();
      if (!token) {
        const err = new AppError("UNAUTHORIZED", "ログインしてください", 401);
        setError(err);
        onError?.(err);
        throw err;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(apiUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(mapPayload(payload)),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const code = httpStatusToErrorCode(res.status);
          const message = errBody.error || getDefaultMessage(code);
          throw new AppError(code, message, res.status, errBody);
        }

        const data = await res.json();
        const result = mapResponse(data);
        onSuccess?.(result);
        return result;
      } catch (e) {
        const err =
          e instanceof AppError
            ? e
            : new AppError("UNKNOWN", "予期しないエラーが発生しました", undefined, e);
        setError(err);
        onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, method, mapResponse, mapPayload, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { mutate, loading, error, reset };
}

export function createMutationHook<TPayload, TResponse>(
  baseOptions: Omit<UseApiMutationOptions<TPayload, TResponse>, "onSuccess" | "onError">
) {
  return function useMutation(
    callbacks?: Pick<UseApiMutationOptions<TPayload, TResponse>, "onSuccess" | "onError">
  ) {
    return useApiMutation<TPayload, TResponse>({
      ...baseOptions,
      ...callbacks,
    });
  };
}
```

**Step 2: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: `onError` の型が `Error` → `AppError` に変わったことで呼び出し元にエラーが出る可能性あり。Task 8 以降で対応。

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/lib/hooks/useApiMutation.ts
git commit -m "refactor: update useApiMutation to use AppError"
```

---

## Task 6: usePaginatedFetch の更新

**Files:**
- Modify: `services/nyx/workspace/src/lib/hooks/usePaginatedFetch.ts`

**Step 1: エラーメッセージを日本語化**

変更は最小限。`doFetch` 内のエラーメッセージを日本語化し、catch ブロックで `AppError` を使う。

`usePaginatedFetch.ts` 内の以下を修正:

1. `doFetch` 内の `throw new Error(errBody.error || ...)` → `throw new AppError(...)` に変更
2. `fetchInitial` と `fetchMore` の catch 内の `new Error("Unknown error")` → `new AppError(...)` に変更

具体的な差分:

- import 追加: `import { AppError, httpStatusToErrorCode } from "@/lib/errors";` と `import { getDefaultMessage } from "@/lib/error-messages";`
- `doFetch` 内:
  ```typescript
  // Before:
  throw new Error(errBody.error || `Failed to fetch from ${apiUrl}`);
  // After:
  const code = httpStatusToErrorCode(res.status);
  throw new AppError(code, errBody.error || getDefaultMessage(code), res.status, errBody);
  ```
- `fetchInitial` と `fetchMore` の catch 内:
  ```typescript
  // Before:
  const err = e instanceof Error ? e : new Error("Unknown error");
  // After:
  const err = e instanceof AppError ? e : new AppError("UNKNOWN", "予期しないエラーが発生しました", undefined, e);
  ```

**Step 2: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: エラーなし

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/lib/hooks/usePaginatedFetch.ts
git commit -m "refactor: update usePaginatedFetch to use AppError"
```

---

## Task 7: ErrorFallback コンポーネントと error.tsx の作成

**Files:**
- Create: `services/nyx/workspace/src/components/shared/ErrorFallback.tsx`
- Create: `services/nyx/workspace/src/app/error.tsx`
- Create: `services/nyx/workspace/src/app/(cast)/error.tsx`
- Create: `services/nyx/workspace/src/app/(guest)/error.tsx`

**Step 1: `ErrorFallback` コンポーネントを作成**

```tsx
// services/nyx/workspace/src/components/shared/ErrorFallback.tsx
"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <AlertCircle className="h-12 w-12 text-error" />
      <h2 className="text-lg font-bold text-text-primary">
        予期しないエラーが発生しました
      </h2>
      <p className="text-sm text-text-secondary text-center max-w-md">
        問題が解決しない場合は、ページを再読み込みしてください。
      </p>
      <Button onClick={reset} className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        再読み込み
      </Button>
    </div>
  );
}
```

**Step 2: `src/app/error.tsx` を作成**

```tsx
// services/nyx/workspace/src/app/error.tsx
"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/shared/ErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
```

**Step 3: `src/app/(cast)/error.tsx` を作成**

```tsx
// services/nyx/workspace/src/app/(cast)/error.tsx
"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/shared/ErrorFallback";

export default function CastError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Cast error:", error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
```

**Step 4: `src/app/(guest)/error.tsx` を作成**

```tsx
// services/nyx/workspace/src/app/(guest)/error.tsx
"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/shared/ErrorFallback";

export default function GuestError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Guest error:", error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
```

**Step 5: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: エラーなし

**Step 6: コミット**

```bash
git add services/nyx/workspace/src/components/shared/ErrorFallback.tsx \
      services/nyx/workspace/src/app/error.tsx \
      services/nyx/workspace/src/app/\(cast\)/error.tsx \
      services/nyx/workspace/src/app/\(guest\)/error.tsx
git commit -m "feat: add Error Boundary with ErrorFallback component"
```

---

## Task 8: Identity モジュールのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/modules/identity/hooks/useAuth.tsx`
- Modify: `services/nyx/workspace/src/modules/identity/components/LoginGate.tsx`

**Step 1: `useAuth.tsx` のエラーメッセージを日本語化**

以下の英語メッセージを修正:

| 行 | Before | After |
|----|--------|-------|
| sendSms catch | `"Failed to send SMS"` | `"SMSの送信に失敗しました"` |
| verifySms catch | `"Verification failed"` | `"認証コードの検証に失敗しました"` |
| register - no token | `"Registration failed: No access token"` | `"登録に失敗しました"` |
| register catch | `"Registration failed"` | `"登録に失敗しました"` |
| login - no token | `"Login failed: No access token"` | `"ログインに失敗しました"` |
| login catch | `"Login failed"` | `"ログインに失敗しました"` |

`console.error` のログメッセージ（英語）はデバッグ用なのでそのまま維持。

**Step 2: `LoginGate.tsx` のエラーメッセージを日本語化**

| Before | After |
|--------|-------|
| `"Please enter a valid phone number"` | `"有効な電話番号を入力してください"` |
| `"Failed to send SMS. Try again."` | `"SMSの送信に失敗しました。もう一度お試しください"` |
| `"Invalid code."` | `"認証コードが正しくありません"` |
| `"Registration failed"` (fallback) | `"登録に失敗しました"` |
| `"Login failed."` (fallback) | `"ログインに失敗しました"` |

**Step 3: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: コミット**

```bash
git add services/nyx/workspace/src/modules/identity/
git commit -m "fix: unify identity module error messages to Japanese"
```

---

## Task 9: Post モジュールのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/modules/post/hooks/useLike.ts`
- Modify: `services/nyx/workspace/src/modules/post/hooks/useComments.ts`
- Modify: `services/nyx/workspace/src/modules/post/components/comments/CommentForm.tsx`

**Step 1: `useLike.ts` — `console.error` のみの箇所に throw を追加**

現状 catch ブロックで `console.error` + `throw e` しているので、呼び出し元で Toast を出す必要がある。Hook 自体は throw しているので OK。呼び出し元のページで対応（Task 14）。

変更なし（既に re-throw している）。

**Step 2: `useComments.ts` のエラーメッセージを日本語化**

| Before | After |
|--------|-------|
| `"Unauthorized"` | `"ログインしてください"` |

**Step 3: `CommentForm.tsx` のエラーメッセージとUIテキストを日本語化**

| Before | After |
|--------|-------|
| `"Comment cannot be empty"` | `"コメントを入力してください"` |
| `"Comment must be ${MAX_CONTENT_LENGTH} characters or less"` | `"コメントは${MAX_CONTENT_LENGTH}文字以内で入力してください"` |
| `"Failed to post comment"` | `"コメントの投稿に失敗しました"` |
| `"Maximum ${MAX_MEDIA} files allowed"` | `"ファイルは${MAX_MEDIA}個までです"` |
| placeholder `"Add a comment..."` | `"コメントを入力..."` |
| Cancel button `"Cancel"` | `"キャンセル"` |
| Submit button `"Uploading..."` | `"アップロード中..."` |
| Submit button `"Reply"` | `"返信"` |
| Submit button `"Post"` | `"投稿"` |
| aria-label `"Submit reply"` | `"返信を送信"` |
| aria-label `"Submit comment"` | `"コメントを送信"` |

**Step 4: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: コミット**

```bash
git add services/nyx/workspace/src/modules/post/
git commit -m "fix: unify post module error messages to Japanese"
```

---

## Task 10: Relationship モジュールのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/modules/relationship/hooks/useFollow.ts`

**Step 1: エラー修正**

`useFollow.ts` は既に catch ブロックで `console.error` + `throw e` している。Hook 自体は re-throw しているので、呼び出し元のページで Toast を出す（Task 14, 15）。

変更なし（呼び出し元で対応）。

**Step 2: コミット**

スキップ（変更なし）。

---

## Task 11: Portfolio モジュールのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/modules/portfolio/hooks/useCastData.ts`
- Modify: `services/nyx/workspace/src/modules/portfolio/hooks/useGuestData.ts`
- Modify: `services/nyx/workspace/src/modules/portfolio/components/cast/VisibilityToggle.tsx`

**Step 1: `useCastData.ts` のエラーメッセージを日本語化**

| Before | After |
|--------|-------|
| `"No token"` | `"ログインしてください"` |
| `"Failed to save profile"` | `"プロフィールの保存に失敗しました"` |
| `"Failed to save images"` | `"画像の保存に失敗しました"` |
| `"Failed to save plans"` | `"プランの保存に失敗しました"` |
| `"Failed to save schedules"` | `"スケジュールの保存に失敗しました"` |
| `"Failed to get upload URL"` | `"アップロードに失敗しました"` |
| `"Failed to upload image"` | `"画像のアップロードに失敗しました"` |
| `"Failed to publish profile"` | `"プロフィールの公開に失敗しました"` |
| `"Failed to save visibility"` | `"公開設定の保存に失敗しました"` |

**Step 2: `useGuestData.ts` のエラーメッセージを日本語化**

| Before | After |
|--------|-------|
| `"Failed to save profile"` | `"プロフィールの保存に失敗しました"` |
| `"Failed to get upload URL"` | `"アップロードに失敗しました"` |
| `"Failed to upload image"` | `"画像のアップロードに失敗しました"` |
| `"Failed to register media"` | `"メディアの登録に失敗しました"` |

`"ログインが必要です"` は既に日本語なので変更なし。

**Step 3: `VisibilityToggle.tsx` に Toast 追加**

```tsx
// 追加: import { useToast } from "@/components/ui/Toast";
// handleToggle の catch ブロックを修正:
} catch (error) {
  setLocalValue(!newValue);
  console.error("Failed to save visibility:", error);
  toast({
    title: "公開設定の保存に失敗しました",
    variant: "destructive",
  });
}
```

**Step 4: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: コミット**

```bash
git add services/nyx/workspace/src/modules/portfolio/
git commit -m "fix: unify portfolio module error messages to Japanese and add toast"
```

---

## Task 12: Media モジュールのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/modules/media/hooks/useMediaUpload.ts`
- Modify: `services/nyx/workspace/src/components/shared/AvatarUploader.tsx`

**Step 1: `useMediaUpload.ts` のエラーメッセージを日本語化**

| Before | After |
|--------|-------|
| `"No authentication token"` | `"ログインしてください"` |
| `"Failed to get upload URL"` | `"アップロードに失敗しました"` |
| `"Failed to upload file to storage"` | `"ファイルのアップロードに失敗しました"` |
| `"Upload failed"` | `"アップロードに失敗しました"` |
| `"Failed to register media"` | `"メディアの登録に失敗しました"` |

**Step 2: `AvatarUploader.tsx` — `console.error` のみの箇所**

現状は `console.error("Upload failed:", error)` のみでユーザー通知なし。ただし、このコンポーネントは親（`GuestProfileForm` 等）から `onUpload` を受け取り、親側でエラーハンドリングしているので、ここでは `throw` して親に任せる。

```tsx
// AvatarUploader.tsx の catch ブロック:
} catch (error) {
  console.error("Upload failed:", error);
  setPreviewUrl(mediaUrl);
  // 親コンポーネントの onUpload が throw した場合、ここに来る
  // 親側で Toast 等の通知を行う
}
```

変更なし（親コンポーネントで対応済み）。

**Step 3: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: コミット**

```bash
git add services/nyx/workspace/src/modules/media/
git commit -m "fix: unify media module error messages to Japanese"
```

---

## Task 13: Trust モジュールのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/modules/trust/hooks/usePendingReviews.ts`
- Modify: `services/nyx/workspace/src/modules/trust/hooks/useTaggings.ts`
- Modify: `services/nyx/workspace/src/modules/trust/components/GuestTagsDisplay.tsx`

**Step 1: `usePendingReviews.ts` — 既に re-throw しているので呼び出し元で対応**

変更なし。

**Step 2: `useTaggings.ts` — 既に re-throw しているので呼び出し元で対応**

変更なし。

**Step 3: `GuestTagsDisplay.tsx` — `console.error` のみの箇所に Toast 追加**

```tsx
// 追加: import { useToast } from "@/components/ui/Toast";
// loadData の catch ブロックを修正:
} catch (e) {
  console.error("Failed to load tags:", e);
  toast({
    title: "タグの読み込みに失敗しました",
    variant: "destructive",
  });
}
```

注: `TrustTagsSection.tsx` と `WriteTrustModal.tsx` は既に Toast を使っているので変更なし。

**Step 4: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: コミット**

```bash
git add services/nyx/workspace/src/modules/trust/
git commit -m "fix: add toast notification to trust module error handling"
```

---

## Task 14: Cast ページのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/app/(cast)/cast/timeline/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/home/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/profile/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/schedules/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/plans/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/blocks/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/followers/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/followers/requests/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/onboarding/step-2/page.tsx`
- Modify: `services/nyx/workspace/src/app/(cast)/cast/onboarding/step-5/page.tsx`

**Step 1: 各ページの `console.error` のみの箇所に Toast を追加し、英語メッセージを日本語化**

**`timeline/page.tsx`:**
既に `useToast` を使用。英語メッセージを修正:

| Before | After |
|--------|-------|
| `"Post is now public"` / `"Post is now hidden"` | `"投稿を公開しました"` / `"投稿を非公開にしました"` |
| `"Failed to update visibility"` | `"公開設定の変更に失敗しました"` |
| `"Failed to delete post"` | `"投稿の削除に失敗しました"` |

`savePost` の catch ブロック（`console.error` のみ）に Toast 追加:
```tsx
toast({ title: "投稿の保存に失敗しました", variant: "destructive" });
```

**`home/page.tsx`:**
既に `useToast` と日本語メッセージを使用。以下の `console.error` のみの箇所に Toast 追加:

- `"Failed to check onboarding status"` → Toast: `"読み込みに失敗しました"`

**`profile/page.tsx`:**
`console.error(e)` のみの箇所に Toast 追加。`useToast` をインポートし:

- プロフィール保存失敗 → `toast({ title: "プロフィールの保存に失敗しました", variant: "destructive" })`
- アバターアップロード失敗 → `toast({ title: "画像のアップロードに失敗しました", variant: "destructive" })`

**`schedules/page.tsx`:**
`console.error` のみの箇所に Toast 追加:

- `"Failed to save schedules"` → `toast({ title: "スケジュールの保存に失敗しました", variant: "destructive" })`

**`plans/page.tsx`:**
`console.error` のみの箇所に Toast 追加:

- `"Failed to save plans"` → `toast({ title: "プランの保存に失敗しました", variant: "destructive" })`

**`blocks/page.tsx`:**
`console.error` のみの箇所に Toast 追加:

- `"Failed to block user"` → `toast({ title: "ブロックに失敗しました", variant: "destructive" })`

**`followers/page.tsx`:**
`console.error` のみの箇所に Toast 追加:

- `"Failed to block user"` → `toast({ title: "ブロックに失敗しました", variant: "destructive" })`

**`followers/requests/page.tsx`:**
`console.error` のみの箇所に Toast 追加:

- `"Failed to approve"` → `toast({ title: "承認に失敗しました", variant: "destructive" })`
- `"Failed to reject"` → `toast({ title: "拒否に失敗しました", variant: "destructive" })`

**`onboarding/step-2/page.tsx`:**
`console.error(e)` のみの箇所に Toast 追加:

- プロフィール保存失敗 → `toast({ title: "プロフィールの保存に失敗しました", variant: "destructive" })`

**`onboarding/step-5/page.tsx`:**
`console.error(e)` のみの箇所に Toast 追加:

- 公開失敗 → `toast({ title: "プロフィールの公開に失敗しました", variant: "destructive" })`

**Step 2: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -30`

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/app/\(cast\)/
git commit -m "fix: add toast notifications and Japanese messages to cast pages"
```

---

## Task 15: Guest ページのエラー修正

**Files:**
- Modify: `services/nyx/workspace/src/app/(guest)/casts/[userId]/page.tsx`
- Modify: `services/nyx/workspace/src/app/(guest)/search/page.tsx`
- Modify: `services/nyx/workspace/src/app/(guest)/following/page.tsx`

**Step 1: 各ページの `console.error` のみの箇所に Toast を追加し、英語メッセージを日本語化**

**`casts/[userId]/page.tsx`:**

| Before | After |
|--------|-------|
| `"Cast not found"` | `"キャストが見つかりませんでした"` |
| `"Failed to load cast"` | `"キャスト情報の読み込みに失敗しました"` |

`console.error("Failed to toggle follow:", e)` に Toast 追加:
```tsx
toast({ title: "フォロー操作に失敗しました", variant: "destructive" });
```

**`search/page.tsx`:**
`console.error("Failed to fetch initial data:", error)` に Toast 追加:
```tsx
toast({ title: "検索データの読み込みに失敗しました", variant: "destructive" });
```

**`following/page.tsx`:**
`console.error("Failed to unfollow:", e)` に Toast 追加:
```tsx
toast({ title: "フォロー解除に失敗しました", variant: "destructive" });
```

**Step 2: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: コミット**

```bash
git add services/nyx/workspace/src/app/\(guest\)/
git commit -m "fix: add toast notifications and Japanese messages to guest pages"
```

---

## Task 16: API Routes の特定エラーメッセージ日本語化

**Files:**
- Modify: 14 API route files with specific error handling (see below)

**Step 1: 特定の ConnectError ハンドリングのメッセージを日本語化**

以下のファイルで、カスタムエラーメッセージが英語で返されている箇所を修正:

| File | Before | After |
|------|--------|-------|
| `api/identity/sign-in/route.ts` | `error.rawMessage \|\| error.message` | そのまま（gRPC メッセージをそのまま返している。`handleApiError` で日本語に変換される） |
| `api/guest/comments/route.ts` | `"Post or parent comment not found"` | `"投稿またはコメントが見つかりませんでした"` |
| `api/me/trust/taggings/route.ts` | `"Tag name is required"` | `"タグ名を入力してください"` |
| `api/me/trust/taggings/route.ts` | `"Tagging already exists"` | `"このタグは既に追加されています"` |

その他のルートは `handleApiError` を通るため、Task 2 の修正で自動的に日本語化される。

**Step 2: `sign-in/route.ts` の修正**

認証失敗時のメッセージを日本語化:
```typescript
// Before:
return NextResponse.json({ error: error.rawMessage || error.message }, { status: 401 });
// After:
return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
```

**Step 3: ビルド確認**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: コミット**

```bash
git add services/nyx/workspace/src/app/api/
git commit -m "fix: unify API route error messages to Japanese"
```

---

## Task 17: 最終ビルド検証

**Step 1: TypeScript 型チェック**

Run: `cd services/nyx/workspace && npx tsc --noEmit --pretty`
Expected: エラーなし

**Step 2: Next.js ビルド**

Run: `cd services/nyx/workspace && npx next build`
Expected: ビルド成功

**Step 3: 未使用の `ApiError` インポートを削除**

`ApiError` の re-export（Task 3）を参照しているファイルがなければ、`fetch.ts` から re-export を削除:

```typescript
// 削除: export { AppError as ApiError } from "@/lib/errors";
```

**Step 4: 最終コミット**

```bash
git add -A
git commit -m "chore: clean up ApiError migration artifacts"
```
