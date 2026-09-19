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
import { ImageUpload } from "@/modules/profile/components/ImageUpload";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileView;
  isCast: boolean;
  onSave: (payload: SaveProfilePayload) => Promise<void>;
  onSaveMedia: (payload: { avatarMediaId?: string; coverMediaId?: string }) => Promise<void>;
}

interface FormState {
  displayName: string;
  bio: string;
  prefecture: string;
  website: string;
  age: string;
  heightCm: string;
  bust: string;
  waist: string;
  hip: string;
  cup: string;
  industry: string;
  snsX: string;
  snsInstagram: string;
  snsTiktok: string;
  snsBluesky: string;
  snsLine: string;
  snsCityheaven: string;
}

function toForm(p: ProfileView): FormState {
  return {
    displayName: p.displayName,
    bio: p.bio,
    prefecture: p.prefecture,
    website: p.website,
    age: p.age ? String(p.age) : "",
    heightCm: p.bodyStats.heightCm ? String(p.bodyStats.heightCm) : "",
    bust: p.bodyStats.bust ? String(p.bodyStats.bust) : "",
    waist: p.bodyStats.waist ? String(p.bodyStats.waist) : "",
    hip: p.bodyStats.hip ? String(p.bodyStats.hip) : "",
    cup: p.bodyStats.cup,
    industry: p.industry,
    snsX: p.snsLinks.x,
    snsInstagram: p.snsLinks.instagram,
    snsTiktok: p.snsLinks.tiktok,
    snsBluesky: p.snsLinks.bluesky,
    snsLine: p.snsLinks.line,
    snsCityheaven: p.snsLinks.cityheaven,
  };
}

// full-payload: 現在値 + 編集。モーダルが扱わない username/isPrivate/areaIds は現在値を維持。
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
      cityheaven: f.snsCityheaven,
    },
    prefecture: f.prefecture,
    isPrivate: current.isPrivate,
    age: isCast ? Number(f.age) || 0 : 0,
    bodyStats: isCast
      ? {
          heightCm: Number(f.heightCm) || 0,
          bust: Number(f.bust) || 0,
          waist: Number(f.waist) || 0,
          hip: Number(f.hip) || 0,
          cup: f.cup,
        }
      : { heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" },
    industry: isCast ? f.industry : "",
    areaIds: current.areas.map((a) => a.id),
  };
}

export function EditProfileModal({ open, onOpenChange, profile, isCast, onSave, onSaveMedia }: EditProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl);

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
            <div className="flex flex-col gap-3">
              <ImageUpload
                shape="cover"
                url={coverUrl || undefined}
                onUploaded={async (mediaId, url) => {
                  setCoverUrl(url);
                  await onSaveMedia({ coverMediaId: mediaId });
                }}
              />
              <ImageUpload
                shape="avatar"
                url={avatarUrl || undefined}
                onUploaded={async (mediaId, url) => {
                  setAvatarUrl(url);
                  await onSaveMedia({ avatarMediaId: mediaId });
                }}
              />
            </div>
            <FormField label="表示名" htmlFor="displayName" required>
              <Input id="displayName" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
            </FormField>

            <FormField label="自己紹介" htmlFor="bio" hint={`${form.bio.length}/1000`}>
              <Textarea
                id="bio"
                maxLength={1000}
                rows={6}
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder={"自己紹介を入力（【〇〇について】のように見出しを付けて書けます）"}
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
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="身長(cm)" htmlFor="height">
                    <Input id="height" type="number" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
                  </FormField>
                  <FormField label="カップ" htmlFor="cup">
                    <Select id="cup" value={form.cup} onChange={(e) => set("cup", e.target.value)}>
                      <option value="">未選択</option>
                      {CUP_SIZES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="バスト(cm)" htmlFor="bust">
                    <Input id="bust" type="number" value={form.bust} onChange={(e) => set("bust", e.target.value)} />
                  </FormField>
                  <FormField label="ウエスト(cm)" htmlFor="waist">
                    <Input id="waist" type="number" value={form.waist} onChange={(e) => set("waist", e.target.value)} />
                  </FormField>
                  <FormField label="ヒップ(cm)" htmlFor="hip">
                    <Input id="hip" type="number" value={form.hip} onChange={(e) => set("hip", e.target.value)} />
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
              <Input
                value={form.snsCityheaven}
                onChange={(e) => set("snsCityheaven", e.target.value)}
                placeholder="シティーヘブン"
              />
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
