"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { PREFECTURES, CUP_SIZES, INDUSTRIES } from "@/modules/profile/lib/constants";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileView;
  isCast: boolean;
  onSave: (payload: SaveProfilePayload) => Promise<void>;
}

interface FormState {
  displayName: string;
  bio: string;
  prefecture: string;
  website: string;
  age: string;
  heightCm: string;
  cupSize: string;
  industry: string;
  snsX: string;
  snsInstagram: string;
  snsTiktok: string;
  snsBluesky: string;
  snsLine: string;
}

function toForm(p: ProfileView): FormState {
  return {
    displayName: p.displayName,
    bio: p.bio,
    prefecture: p.prefecture,
    website: p.website,
    age: p.age ? String(p.age) : "",
    heightCm: p.heightCm ? String(p.heightCm) : "",
    cupSize: p.cupSize,
    industry: p.industry,
    snsX: p.snsLinks.x,
    snsInstagram: p.snsLinks.instagram,
    snsTiktok: p.snsLinks.tiktok,
    snsBluesky: p.snsLinks.bluesky,
    snsLine: p.snsLinks.line,
  };
}

// full-payload: 現在値 + 編集。モーダルが扱わない username/isPrivate/areaIds/shopId は現在値を維持。
function buildPayload(current: ProfileView, f: FormState, isCast: boolean): SaveProfilePayload {
  return {
    username: current.username,
    displayName: f.displayName,
    bio: f.bio,
    website: f.website,
    snsLinks: {
      x: f.snsX,
      instagram: f.snsInstagram,
      tiktok: f.snsTiktok,
      bluesky: f.snsBluesky,
      line: f.snsLine,
    },
    prefecture: f.prefecture,
    isPrivate: current.isPrivate,
    age: isCast ? Number(f.age) || 0 : 0,
    heightCm: isCast ? Number(f.heightCm) || 0 : 0,
    cupSize: isCast ? f.cupSize : "",
    industry: isCast ? f.industry : "",
    areaIds: current.areas.map((a) => a.id),
    shopId: current.shopId,
  };
}

export function EditProfileModal({ open, onOpenChange, profile, isCast, onSave }: EditProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(buildPayload(profile, form, isCast));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3">
            <Dialog.Title className="text-base font-bold text-text-primary">プロフィールを編集</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text-primary" aria-label="閉じる">
              ✕
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
            <FormField label="表示名" htmlFor="displayName" required>
              <Input id="displayName" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
            </FormField>

            <FormField label="自己紹介" htmlFor="bio" hint={`${form.bio.length}/160`}>
              <Textarea
                id="bio"
                maxLength={160}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="自己紹介を入力"
              />
            </FormField>

            <FormField label="場所" htmlFor="prefecture">
              <Select id="prefecture" value={form.prefecture} onChange={(e) => set("prefecture", e.target.value)}>
                <option value="">未選択</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="ウェブサイト" htmlFor="website">
              <Input
                id="website"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
              />
            </FormField>

            {isCast && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="年齢" htmlFor="age">
                    <Input id="age" type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
                  </FormField>
                  <FormField label="身長(cm)" htmlFor="height">
                    <Input id="height" type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="カップ" htmlFor="cup">
                    <Select id="cup" value={form.cupSize} onChange={(e) => set("cupSize", e.target.value)}>
                      <option value="">未選択</option>
                      {CUP_SIZES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="業種" htmlFor="industry">
                    <Select id="industry" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                      <option value="">未選択</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">SNS リンク</p>
              <Input value={form.snsX} onChange={(e) => set("snsX", e.target.value)} placeholder="X (https://x.com/...)" />
              <Input value={form.snsInstagram} onChange={(e) => set("snsInstagram", e.target.value)} placeholder="Instagram" />
              <Input value={form.snsTiktok} onChange={(e) => set("snsTiktok", e.target.value)} placeholder="TikTok" />
              <Input value={form.snsBluesky} onChange={(e) => set("snsBluesky", e.target.value)} placeholder="Bluesky" />
              <Input value={form.snsLine} onChange={(e) => set("snsLine", e.target.value)} placeholder="LINE" />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-divider px-4 py-3">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
