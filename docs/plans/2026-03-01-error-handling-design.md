# エラー処理統一デザイン

## 概要

フロントエンド（Nyx）全レイヤーのエラー処理ルールを定義し、既存コードを修正する。

## 方針

- 既存の throw ベースを維持（SWR・Error Boundary と自然に連携）
- `AppError` 型でエラーの種類を型で分類（型安全性を確保）
- Error Boundary を追加してクラッシュを受け止める
- ルールを明文化してパターンを統一する

## AppError 型

```typescript
// src/lib/errors.ts

type ErrorCode =
  | "UNAUTHORIZED"       // 未認証（トークン切れ等）
  | "FORBIDDEN"          // 権限不足
  | "NOT_FOUND"          // リソースが見つからない
  | "VALIDATION"         // バリデーションエラー
  | "CONFLICT"           // 重複・競合
  | "NETWORK"            // ネットワーク接続の問題
  | "SERVER"             // サーバー内部エラー
  | "UNKNOWN"            // 分類不能

class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,               // ユーザー向けメッセージ（日本語）
    public readonly status?: number, // HTTP ステータス
    public readonly cause?: unknown, // 元のエラー
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

- `message` はそのままユーザーに見せられる日本語メッセージ
- `cause` に元のエラー（ConnectError 等）を保持しデバッグに使う
- `code` でエラーの種類を判定しリカバリー処理を分岐できる
- 既存の `ApiError`（`authFetch` で使用）は `AppError` に統合する

## エラーメッセージ定数

```typescript
// src/lib/error-messages.ts

export const ERROR_MESSAGES = {
  // 共通
  UNAUTHORIZED: "ログインしてください",
  FORBIDDEN: "この操作を行う権限がありません",
  NOT_FOUND: "データが見つかりませんでした",
  NETWORK: "ネットワーク接続を確認してください",
  SERVER: "サーバーエラーが発生しました。しばらくしてからお試しください",
  UNKNOWN: "予期しないエラーが発生しました",

  // 操作系
  SAVE_FAILED: "保存に失敗しました",
  DELETE_FAILED: "削除に失敗しました",
  UPLOAD_FAILED: "アップロードに失敗しました",

  // バリデーション
  REQUIRED: (field: string) => `${field}を入力してください`,
  MAX_LENGTH: (field: string, max: number) => `${field}は${max}文字以内で入力してください`,
} as const;
```

- ドメイン固有のメッセージは各モジュールで定義
- 共通メッセージだけここに集約
- `ErrorCode` → デフォルトメッセージの変換関数も用意する

## レイヤー別エラー処理ルール

### Layer 1: API Routes（BFF層）

```
gRPC エラー → AppError に変換 → JSON レスポンスとして返す
```

- ConnectError を `AppError` に変換する `toAppError()` ヘルパーを用意
- レスポンスは `{ error: { code, message } }` で統一
- `console.error` でログを残す（`cause` 含む）
- 認証エラー（UNAUTHORIZED）の場合はトークンクリアのヒントを返す

### Layer 2: Hooks（データ取得・ミューテーション）

```
fetch → レスポンスチェック → AppError を throw
```

- `authFetch` を改修しエラー時に `AppError` を throw
- SWR fetcher はそのまま throw ベースを維持（SWR の `error` に自然に入る）
- `useApiMutation` に Toast 通知のデフォルト動作を組み込む

### Layer 3: コンポーネント（UI層）

全エラーを Toast で通知する。

| 操作の種類 | エラー表示方法 |
|-----------|-------------|
| データ取得失敗 | Toast 通知 |
| ミューテーション失敗 | Toast 通知 |
| フォーム送信失敗 | Toast 通知 |
| フォームバリデーション | Toast 通知 |
| 認証エラー | Toast 通知 + ログイン画面へリダイレクト |

- `console.error` だけでユーザーに何も見せない、は禁止
- 明示的にサイレントにする場合は `// SILENT:` コメント必須

### Layer 4: Error Boundary（最後の砦）

```
未ハンドルのエラー → error.tsx がキャッチ → リカバリーUI表示
```

配置:
```
src/app/
├── error.tsx           # グローバル
├── (cast)/error.tsx    # キャスト画面用
├── (guest)/error.tsx   # ゲスト画面用
└── (public)/error.tsx  # 公開画面用
```

- 「予期しないエラーが発生しました」と表示
- 「再読み込み」ボタンで `reset()` を呼ぶ
- `console.error` でエラー詳細をログ出力
- 各ルートグループで共通の `ErrorFallback` コンポーネントを使い回す

## 既存コードの修正方針

### 1. `ApiError` → `AppError` への統合

- `src/lib/auth/fetch.ts` の `ApiError` を `AppError` に置き換え
- `authFetch` がレスポンスの HTTP ステータスから `ErrorCode` を判定して `AppError` を throw

### 2. `console.error` だけで握りつぶしている箇所 → Toast 通知を追加

- `useLike` 等で `console.error` のみのケースに Toast を追加
- `// SILENT:` コメントが明示されていない限り、ユーザーに通知する

### 3. 英語エラーメッセージ → 日本語に統一

- `"Unauthorized"`、`"Comment cannot be empty"` 等を `ERROR_MESSAGES` 定数に置き換え

### 4. API Routes のエラーレスポンス形式統一

- `{ error: string }` → `{ error: { code: ErrorCode, message: string } }` に統一
- `handleApiError` を改修して `AppError` ベースのレスポンスを返す

### 5. Hook のエラー処理統一

- `useApiMutation` に Toast 通知のデフォルト動作を組み込む
- `usePaginatedFetch` のエラーも `AppError` に統一
