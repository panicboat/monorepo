"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tab";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/ui/avatar";
import { UserCard } from "@/components/ui/user-card";
import { PostCard } from "@/components/ui/post-card";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileModal } from "@/modules/profile/components/EditProfileModal";
import { AreaAccordion } from "@/modules/profile/components/AreaAccordion";
import { ImageUpload } from "@/modules/profile/components/ImageUpload";
import type { ProfileView, AreaView } from "@/modules/profile/types";

export default function DevUiPage() {
  const [tab, setTab] = useState("home");
  const [on, setOn] = useState(false);
  const [following, setFollowing] = useState(false);
  const [bio, setBio] = useState("");
  const [prefecture, setPrefecture] = useState("東京都");
  const [editOpen, setEditOpen] = useState(false);
  const [areaSel, setAreaSel] = useState<string[]>(["1"]);
  const mockAreas: AreaView[] = [
    { id: "1", region: "関東", prefecture: "東京都", name: "渋谷", code: "shibuya" },
    { id: "2", region: "関東", prefecture: "東京都", name: "新宿", code: "shinjuku" },
    { id: "3", region: "関東", prefecture: "神奈川県", name: "横浜", code: "yokohama" },
    { id: "4", region: "関西", prefecture: "大阪府", name: "難波", code: "namba" },
    { id: "5", region: "九州・沖縄", prefecture: "福岡県", name: "中洲", code: "nakasu" },
  ];
  const mockProfile: ProfileView = {
    accountId: "demo",
    username: "yuna",
    displayName: "ゆな",
    bio: "はじめまして、ゆなです。\nよろしくお願いします。",
    avatarMediaId: "",
    avatarUrl: "",
    coverMediaId: "",
    coverUrl: "",
    website: "https://example.com",
    snsLinks: { x: "https://x.com/yuna", instagram: "", tiktok: "", bluesky: "", line: "" },
    prefecture: "東京都",
    isPrivate: false,
    registeredAt: "",
    age: 23,
    heightCm: 158,
    cupSize: "D",
    industry: "デリヘル",
    areas: [{ id: "a1", region: "関東", prefecture: "東京都", name: "渋谷", code: "shibuya" }],
    shopId: "",
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section className="flex flex-wrap items-center gap-3">
        <Button variant="primary">投稿する</Button>
        <Button variant="secondary">フォロー</Button>
        <Button variant="primary" size="sm">
          sm
        </Button>
        <Button variant="primary" disabled>
          disabled
        </Button>
      </section>

      <section>
        <Input placeholder="検索" />
      </section>

      <section>
        <Tabs
          items={[
            { id: "home", label: "ホーム" },
            { id: "trend", label: "トレンド" },
            { id: "new", label: "新着" },
          ]}
          value={tab}
          onValueChange={setTab}
        />
      </section>

      <section className="flex items-center gap-4">
        <Toggle checked={on} onCheckedChange={setOn} aria-label="toggle" />
        <Avatar fallback="A" size="sm" />
        <Avatar fallback="B" size="md" />
        <Avatar fallback="C" size="lg" />
      </section>

      <section>
        <UserCard
          name="さくら"
          handle="sakura"
          following={following}
          onFollow={() => setFollowing((v) => !v)}
        />
      </section>

      <section>
        <PostCard
          author={{ name: "さくら", handle: "sakura" }}
          time="3分前"
          body={"はじめての投稿です。\nよろしくお願いします。"}
          reactions={<span className="text-sm">♥ 12 · 💬 3</span>}
        />
      </section>

      <section className="flex flex-col gap-4">
        <FormField label="表示名" htmlFor="dn" required hint="公開されます">
          <Input id="dn" placeholder="ゆな" />
        </FormField>
        <FormField label="自己紹介" htmlFor="bio" hint={`${bio.length}/160`}>
          <Textarea
            id="bio"
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="自己紹介を入力"
          />
        </FormField>
        <FormField label="都道府県" htmlFor="pref">
          <Select
            id="pref"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
          >
            <option value="東京都">東京都</option>
            <option value="大阪府">大阪府</option>
            <option value="福岡県">福岡県</option>
          </Select>
        </FormField>
        <FormField
          label="ユーザー名"
          htmlFor="un"
          error="このユーザー名は使用されています"
        >
          <Input id="un" placeholder="username" />
        </FormField>
      </section>

      <section className="flex flex-col gap-3 border border-divider rounded-lg">
        <ProfileHeader profile={mockProfile} role="cast" onEdit={() => setEditOpen(true)} />
        <EditProfileModal
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={mockProfile}
          isCast
          onSave={async () => {}}
          onSaveMedia={async () => {}}
        />
      </section>

      <section>
        <AreaAccordion areas={mockAreas} selectedIds={areaSel} onChange={setAreaSel} max={2} />
      </section>

      <section className="border border-divider rounded-lg">
        <ProfileHeader profile={mockProfile} role="cast" />
      </section>

      <section className="flex flex-col gap-3">
        <ImageUpload shape="cover" onUploaded={() => {}} />
        <ImageUpload shape="avatar" onUploaded={() => {}} />
      </section>
    </main>
  );
}
