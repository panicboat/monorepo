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
