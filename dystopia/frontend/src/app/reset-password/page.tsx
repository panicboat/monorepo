"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Step = "phone" | "code" | "complete";

export default function ResetPasswordPage() {
  const { forgotPassword, confirmForgotPassword } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step !== "complete") return;

    const redirectTimer = window.setTimeout(() => {
      router.push("/login");
    }, 2000);

    return () => window.clearTimeout(redirectTimer);
  }, [router, step]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(phone);
      setStep("code");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "認証コードの送信に失敗しました",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await confirmForgotPassword(phone, code, newPassword);
      setStep("complete");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "パスワードの再設定に失敗しました",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-text-primary">
          パスワード再設定
        </h1>

        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
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

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "送信中…" : "認証コードを送信"}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <p className="text-sm text-text-secondary">
              {phone}{" "}
              に送信した6桁のコードと新しいパスワードを入力してください。
            </p>

            <div className="space-y-1">
              <label
                htmlFor="code"
                className="text-sm font-medium text-text-primary"
              >
                認証コード
              </label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="new-password"
                className="text-sm font-medium text-text-primary"
              >
                新しいパスワード
              </label>
              <Input
                id="new-password"
                type="password"
                placeholder="新しいパスワードを設定"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "再設定中…" : "パスワードを再設定する"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-text-secondary hover:text-text-primary"
              onClick={() => {
                setStep("phone");
                setError(null);
                setCode("");
                setNewPassword("");
              }}
            >
              電話番号を変更
            </button>
          </form>
        )}

        {step === "complete" && (
          <p className="text-center text-sm text-text-secondary">
            パスワードを再設定しました。ログイン画面に移動します。
          </p>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/login" className="text-accent hover:underline">
            ログインに戻る
          </Link>
        </p>
      </div>
    </main>
  );
}
