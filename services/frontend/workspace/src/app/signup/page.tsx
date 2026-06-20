"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Step = "phone" | "code" | "details";

export default function SignupPage() {
  const { requestSMS, verifySMS, register } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestSMS(phone);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMSの送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await verifySMS(phone, code);
      setVerificationToken(token);
      setStep("details");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "認証コードの検証に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(phone, password, verificationToken, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-bold text-text-primary">
          新規登録
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
              {phone} に送信した6桁のコードを入力してください。
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

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "確認中…" : "確認"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-text-secondary hover:text-text-primary"
              onClick={() => {
                setStep("phone");
                setError(null);
                setCode("");
              }}
            >
              電話番号を変更
            </button>
          </form>
        )}

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="space-y-4">
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
                placeholder="パスワードを設定"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-text-primary">
                登録種別
              </legend>
              <div className="flex gap-3">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-text-primary has-[:checked]:border-accent has-[:checked]:text-accent">
                  <input
                    type="radio"
                    name="role"
                    value="1"
                    checked={role === 1}
                    onChange={() => setRole(1)}
                    className="sr-only"
                  />
                  ゲスト
                </label>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-text-primary has-[:checked]:border-accent has-[:checked]:text-accent">
                  <input
                    type="radio"
                    name="role"
                    value="2"
                    checked={role === 2}
                    onChange={() => setRole(2)}
                    className="sr-only"
                  />
                  キャスト
                </label>
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "登録中…" : "登録する"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-accent hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  );
}
