"use client";

import { useState } from "react";
import { Globe, Lock, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/Label";

interface VisibilityToggleProps {
  isPrivate: boolean;
  onSave: (isPrivate: boolean) => Promise<void>;
  disabled?: boolean;
}

export const VisibilityToggle = ({
  isPrivate,
  onSave,
  disabled = false,
}: VisibilityToggleProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [localValue, setLocalValue] = useState(isPrivate);

  const handleToggle = async (newValue: boolean) => {
    if (disabled || isSaving || newValue === localValue) return;

    setLocalValue(newValue);
    setIsSaving(true);

    try {
      await onSave(newValue);
    } catch (error) {
      // Revert on error
      setLocalValue(!newValue);
      console.error("Failed to save visibility:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="block text-sm font-bold text-text-secondary">
        Account Visibility
        <span className="ml-2 text-xs font-normal text-text-muted">
          プロフィールの公開設定
        </span>
      </Label>

      <div className="grid grid-cols-2 gap-3">
        {/* Public Option */}
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={disabled || isSaving}
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
            !localValue
              ? "border-role-cast bg-role-cast-lighter text-role-cast"
              : "border-border bg-surface text-text-secondary hover:border-border-secondary hover:bg-surface-secondary"
          } ${disabled || isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {isSaving && !localValue && (
            <Loader2 className="absolute top-2 right-2 h-4 w-4 animate-spin" />
          )}
          <Globe className="h-6 w-6" />
          <div className="text-center">
            <div className="text-sm font-bold">Public</div>
            <div className="text-xs opacity-70">誰でもフォロー可能</div>
          </div>
        </button>

        {/* Private Option */}
        <button
          type="button"
          onClick={() => handleToggle(true)}
          disabled={disabled || isSaving}
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
            localValue
              ? "border-role-cast bg-role-cast-lighter text-role-cast"
              : "border-border bg-surface text-text-secondary hover:border-border-secondary hover:bg-surface-secondary"
          } ${disabled || isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {isSaving && localValue && (
            <Loader2 className="absolute top-2 right-2 h-4 w-4 animate-spin" />
          )}
          <Lock className="h-6 w-6" />
          <div className="text-center">
            <div className="text-sm font-bold">Private</div>
            <div className="text-xs opacity-70">フォロー承認が必要</div>
          </div>
        </button>
      </div>

      {/* Description */}
      <div className="text-xs text-text-muted bg-surface-secondary rounded-lg p-3">
        {localValue ? (
          <p>
            <strong>Private モード:</strong> 新規フォロワーは承認が必要です。
            承認したフォロワーのみがあなたの投稿を見ることができます。
          </p>
        ) : (
          <p>
            <strong>Public モード:</strong> 誰でも即座にフォローでき、
            あなたの投稿を見ることができます。
          </p>
        )}
      </div>
    </div>
  );
};
