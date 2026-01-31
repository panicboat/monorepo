import { API_ERROR_CODES, ApiErrorCode } from "@/types/api";

/**
 * User-friendly error messages in Japanese
 */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  [API_ERROR_CODES.UNAUTHORIZED]: "ログインが必要です",
  [API_ERROR_CODES.FORBIDDEN]: "この操作を行う権限がありません",
  [API_ERROR_CODES.NOT_FOUND]: "お探しのページが見つかりません",
  [API_ERROR_CODES.VALIDATION_ERROR]: "入力内容に誤りがあります",
  [API_ERROR_CODES.INTERNAL_ERROR]: "サーバーエラーが発生しました",
  [API_ERROR_CODES.NETWORK_ERROR]: "ネットワークエラーが発生しました",
};

/**
 * HTTP status code to user-friendly message
 */
export const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: "リクエストが正しくありません",
  401: "ログインが必要です",
  403: "アクセスが許可されていません",
  404: "お探しのページが見つかりません",
  408: "リクエストがタイムアウトしました",
  429: "リクエストが多すぎます。しばらく経ってから再試行してください",
  500: "サーバーエラーが発生しました",
  502: "サーバーに接続できません",
  503: "サービスが一時的に利用できません",
  504: "サーバーからの応答がありません",
};

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  // API error with code
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: string }).code as ApiErrorCode;
    if (code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[code];
    }
  }

  // HTTP status error
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    if (status in HTTP_STATUS_MESSAGES) {
      return HTTP_STATUS_MESSAGES[status];
    }
  }

  // Error with message
  if (error instanceof Error) {
    // Don't expose internal error messages to users
    return "エラーが発生しました";
  }

  return "予期しないエラーが発生しました";
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return true;
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    if ("status" in error && (error as { status: number }).status === 401) {
      return true;
    }
    if ("code" in error && (error as { code: string }).code === API_ERROR_CODES.UNAUTHORIZED) {
      return true;
    }
  }
  return false;
}
