"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ProfileView } from "@/modules/profile/types";

const SNS_LABELS: { key: keyof ProfileView["snsLinks"]; label: string }[] = [
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "bluesky", label: "Bluesky" },
  { key: "line", label: "LINE" },
];

interface ProfileHeaderProps {
  profile: ProfileView;
  role: "cast" | "guest" | null;
  onEdit?: () => void;
}

export function ProfileHeader({ profile, role, onEdit }: ProfileHeaderProps) {
  const isCast = role === "cast";
  const sns = SNS_LABELS.filter(({ key }) => profile.snsLinks[key]);

  return (
    <div className="flex flex-col">
      <div
        className="h-40 w-full bg-gradient-brand"
        style={
          profile.coverUrl
            ? { backgroundImage: `url(${profile.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      />
      <div className="flex items-start justify-between px-4">
        <div className="-mt-10">
          <Avatar
            src={profile.avatarUrl || undefined}
            fallback={profile.displayName.slice(0, 1) || "?"}
            size="lg"
            className="h-20 w-20 text-2xl ring-4 ring-bg"
          />
        </div>
        {onEdit && (
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              プロフィールを編集
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 px-4 pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-text-primary">{profile.displayName}</h1>
          {isCast && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">セラピスト</span>
          )}
        </div>
        <p className="text-sm text-text-secondary">@{profile.username || "—"}</p>
        {profile.prefecture && <p className="text-sm text-text-secondary">📍 {profile.prefecture}</p>}
        {profile.bio && <p className="whitespace-pre-wrap pt-1 text-sm text-text-primary">{profile.bio}</p>}
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {profile.website}
          </a>
        )}
        {sns.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {sns.map(({ key, label }) => (
              <a
                key={key}
                href={profile.snsLinks[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline"
              >
                {label}
              </a>
            ))}
          </div>
        )}
        {isCast && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm text-text-secondary">
            {profile.age > 0 && <span>{profile.age}歳</span>}
            {profile.heightCm > 0 && <span>{profile.heightCm}cm</span>}
            {profile.cupSize && <span>{profile.cupSize}カップ</span>}
            {profile.industry && <span>{profile.industry}</span>}
            {profile.areas.length > 0 && <span>{profile.areas.map((a) => a.name).join(" / ")}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
