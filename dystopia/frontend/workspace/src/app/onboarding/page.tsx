"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useProfile } from "@/modules/profile/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const router = useRouter();
  const role = useAuthStore(selectRole);
  const { saveProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isCast = role === "cast";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await saveProfile({ displayName, username });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールの保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">
          プロフィール設定
        </h1>
        <p className="mb-8 text-center text-sm text-text-secondary">
          {isCast
            ? "キャストとして表示される名前とユーザー名を設定してください。"
            : "表示名とユーザー名を設定してください。"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="displayName"
              className="text-sm font-medium text-text-primary"
            >
              表示名
              <span className="ml-0.5 text-error">*</span>
            </label>
            <Input
              id="displayName"
              type="text"
              placeholder={isCast ? "例：さくら" : "例：さくら"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
              maxLength={50}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="username"
              className="text-sm font-medium text-text-primary"
            >
              ユーザー名
              <span className="ml-0.5 text-error">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted select-none">
                @
              </span>
              <Input
                id="username"
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                className="pl-8"
              />
            </div>
            <p className="text-xs text-text-muted">
              英数字とアンダースコアのみ使用できます。
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "保存中…" : "完了"}
          </Button>
        </form>
      </div>
    </main>
  );
}
