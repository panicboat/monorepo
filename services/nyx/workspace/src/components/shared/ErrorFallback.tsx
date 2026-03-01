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
