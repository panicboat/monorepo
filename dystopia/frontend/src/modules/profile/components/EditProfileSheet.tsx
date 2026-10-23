"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Toggle } from "@/components/ui/toggle";
import { useUsernameAvailability } from "@/modules/profile/hooks/useUsernameCheck";
import { PREFECTURES, CUP_SIZES, INDUSTRIES, areasOf } from "@/modules/profile/lib/constants";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";
import { ImageUpload } from "@/modules/profile/components/ImageUpload";

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileView;
  isCast: boolean;
  onSave: (payload: SaveProfilePayload) => Promise<void>;
  onSaveMedia: (payload: { avatarMediaId?: string; coverMediaId?: string }) => Promise<void>;
}

interface FormState {
  username: string;
  isPrivate: boolean;
  followApprovalRequired: boolean;
  displayName: string;
  bio: string;
  prefecture: string;
  area: string;
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
  snsLitlink: string;
  snsCityheaven: string;
}

function toForm(p: ProfileView): FormState {
  return {
    username: p.username,
    isPrivate: p.isPrivate,
    followApprovalRequired: p.followApprovalRequired,
    displayName: p.displayName,
    bio: p.bio,
    prefecture: p.prefecture,
    area: p.area,
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
    snsLitlink: p.snsLinks.litlink,
    snsCityheaven: p.snsLinks.cityheaven,
  };
}

function buildPayload(f: FormState, isCast: boolean): SaveProfilePayload {
  return {
    username: f.username,
    displayName: f.displayName,
    bio: f.bio,
    snsLinks: {
      x: f.snsX,
      instagram: f.snsInstagram,
      tiktok: f.snsTiktok,
      bluesky: f.snsBluesky,
      litlink: f.snsLitlink,
      cityheaven: f.snsCityheaven,
    },
    prefecture: f.prefecture,
    area: f.area,
    isPrivate: f.isPrivate,
    followApprovalRequired: f.followApprovalRequired,
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
  };
}

export function EditProfileSheet({ open, onOpenChange, profile, isCast, onSave, onSaveMedia }: EditProfileSheetProps) {
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl);
  const username = useUsernameAvailability(form.username, profile.username);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const areaChoices = areasOf(form.prefecture);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(buildPayload(form, isCast));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideSheet open={open} onOpenChange={onOpenChange} title="プロフィールを編集">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-surface px-3 py-2">
          <p className="text-sm font-bold text-text-primary">{profile.displayName}として編集中</p>
          <p className="text-xs text-text-secondary">@{profile.username}</p>
        </div>
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
        <FormField
          label="ユーザー名"
          htmlFor="username"
          required
          error={username.blocked ? username.status?.message : undefined}
          hint={username.status?.available ? "使用できます" : undefined}
        >
          <Input id="username" value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="username" />
        </FormField>
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

        <FormField label="主要エリア" htmlFor="prefecture">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              id="prefecture"
              aria-label="都道府県"
              value={form.prefecture}
              onChange={(e) => setForm((f) => ({ ...f, prefecture: e.target.value, area: "" }))}
            >
              <option value="">未選択</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            {areaChoices.length > 0 && (
              <Select id="area" aria-label="エリア" value={form.area} onChange={(e) => set("area", e.target.value)}>
                <option value="">エリアを選ばない</option>
                {areaChoices.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            )}
          </div>
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
                  {INDUSTRIES.map(({ name, icon }) => (
                    <option key={name} value={name}>
                      {icon} {name}
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
          <Input value={form.snsLitlink} onChange={(e) => set("snsLitlink", e.target.value)} placeholder="lit.link" />
          <Input
            value={form.snsCityheaven}
            onChange={(e) => set("snsCityheaven", e.target.value)}
            placeholder="CityHeaven"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-divider pt-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">プロフィールに鍵をかける</span>
            <span className="text-xs text-text-muted">投稿はフォロワーだけが見られます。プロフィールの項目、フォロー・フォロワーの一覧、コメント、予定などは、フォロワー以外にも表示されます</span>
          </div>
          <Toggle checked={form.isPrivate} onCheckedChange={(value) => set("isPrivate", value)} aria-label="プロフィールに鍵をかける" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-primary">フォローを承認制にする</span>
            <span className="text-xs text-text-muted">フォローされる前に、あなたが承認します</span>
          </div>
          <Toggle checked={form.followApprovalRequired} onCheckedChange={(value) => set("followApprovalRequired", value)} aria-label="フォローを承認制にする" />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-divider pt-4">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || username.blocked}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </SideSheet>
  );
}
