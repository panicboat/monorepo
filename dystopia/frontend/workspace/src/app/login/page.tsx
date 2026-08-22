"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(phone, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-text-primary">
          ログイン
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="phone"
              className="text-sm font-medium text-text-primary"
            >
              電話番号
            </label>
            <Input
              id="phone"
              type="tel"
              placeholder="09012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-sm font-medium text-text-primary"
            >
              パスワード
            </label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? "ログイン中…" : "ログイン"}
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm text-text-secondary">
          <p>
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-accent hover:underline">
              新規登録
            </Link>
          </p>
          <p>
            <Link
              href="/reset-password"
              className="text-accent hover:underline"
            >
              パスワードをお忘れの方
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
