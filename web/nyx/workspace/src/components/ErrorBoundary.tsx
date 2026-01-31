"use client";

import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for catching and handling React errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-4xl">😵</div>
          <h2 className="text-lg font-semibold text-slate-900">
            エラーが発生しました
          </h2>
          <p className="text-sm text-slate-500">
            予期しないエラーが発生しました。もう一度お試しください。
          </p>
          <Button onClick={this.handleReset} variant="outline" size="sm">
            再試行
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
export function ErrorFallback({
  error,
  resetError,
}: {
  error?: Error | null;
  resetError?: () => void;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-4xl">😵</div>
      <h2 className="text-lg font-semibold text-slate-900">
        エラーが発生しました
      </h2>
      <p className="text-sm text-slate-500">
        {error?.message || "予期しないエラーが発生しました。"}
      </p>
      {resetError && (
        <Button onClick={resetError} variant="outline" size="sm">
          再試行
        </Button>
      )}
    </div>
  );
}

/**
 * Full page error component
 */
export function PageError({
  title = "ページを表示できません",
  message = "エラーが発生しました。しばらく経ってから再度お試しください。",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-6xl">🚧</div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-slate-500">{message}</p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="brand">
            再試行
          </Button>
        )}
        <Button onClick={() => window.location.href = "/"} variant="outline">
          ホームに戻る
        </Button>
      </div>
    </div>
  );
}
