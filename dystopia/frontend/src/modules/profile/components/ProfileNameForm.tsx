"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CreateProfilePayload } from "@/modules/profile/types";

export interface ProfileNameFormProps {
  submitLabel: string;
  onSubmit: (payload: Required<CreateProfilePayload>) => Promise<void>;
}

export function ProfileNameForm({ submitLabel, onSubmit }: ProfileNameFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ displayName, username });
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールの保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          placeholder="例：さくら"
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
        {submitting ? "保存中…" : submitLabel}
      </Button>
    </form>
  );
}
