"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, type TabItem } from "@/components/ui/tab";
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
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { PostComposer } from "@/modules/post/components/PostComposer";
import type { PostView, SavePostPayload } from "@/modules/post/lib/post-view";
import type { FeedFilterValue } from "@/modules/feed/types";

export default function DevUiPage() {
  const [tab, setTab] = useState("home");
  const [on, setOn] = useState(false);
  const [following, setFollowing] = useState(false);
  const [bio, setBio] = useState("");
  const [prefecture, setPrefecture] = useState("東京都");
  const [editOpen, setEditOpen] = useState(false);
  const [areaSel, setAreaSel] = useState<string[]>(["1"]);
  const [feedFilter, setFeedFilter] = useState<FeedFilterValue>("all");
  const FEED_TAB_ITEMS: TabItem[] = [
    { id: "all", label: "全員" },
    { id: "area", label: "エリア" },
    { id: "following", label: "フォロー中" },
  ];
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

  const mockPosts: PostView[] = [
    {
      id: "mock-1",
      authorId: "demo",
      content: "新作のお洋服届きました！今日はこれで出勤します🌷",
      media: [],
      createdAt: "2026-06-08T11:55:00Z",
      author: {
        accountId: "demo",
        displayName: "ゆな",
        username: "yuna",
        avatarUrl: "",
      },
      likesCount: 12,
      commentsCount: 3,
      visibility: "public",
      hashtags: ["新作", "渋谷"],
      liked: false,
    },
    {
      id: "mock-2",
      authorId: "guest-1",
      content: "今度の週末空いてる方いますか？",
      media: [],
      createdAt: "2026-06-08T11:00:00Z",
      author: {
        accountId: "guest-1",
        displayName: "ぱにっく",
        username: "panicboat",
        avatarUrl: "",
      },
      likesCount: 1,
      commentsCount: 0,
      visibility: "private",
      hashtags: [],
      liked: true,
    },
  ];

  const handleMockSubmit = async (payload: SavePostPayload) => {
    console.log("[dev/ui] mock submit:", payload);
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-secondary">PostComposer</h2>
        <PostComposer onSubmit={handleMockSubmit} />
      </section>

      <section className="flex flex-col">
        <h2 className="px-4 pb-3 text-sm font-bold text-text-secondary">PostCardBinding</h2>
        {mockPosts.map((p) => (
          <PostCardBinding key={p.id} post={p} />
        ))}
      </section>

      <section className="flex flex-col">
        <h2 className="px-4 pb-3 text-sm font-bold text-text-secondary">Feed (3-tab home)</h2>
        <Tabs
          items={FEED_TAB_ITEMS}
          value={feedFilter}
          onValueChange={(id) => setFeedFilter(id as FeedFilterValue)}
        />
        <div>
          {mockPosts.map((p) => (
            <PostCardBinding key={`feed-${feedFilter}-${p.id}`} post={p} />
          ))}
        </div>
      </section>

      <section className="px-4 pt-8">
        <h2 className="pb-3 text-lg font-bold">Social</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm text-text-secondary">NONE</span>
            <Button variant="primary" size="sm">フォロー</Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm text-text-secondary">PENDING</span>
            <Button variant="secondary" size="sm">申請中</Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm text-text-secondary">APPROVED</span>
            <Button variant="secondary" size="sm">フォロー中</Button>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <span className="w-24 text-sm text-text-secondary">申請 1 件</span>
            <Button variant="primary" size="sm">承認</Button>
            <Button variant="secondary" size="sm">拒否</Button>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <span className="w-24 text-sm text-text-secondary">未ブロック</span>
            <Button variant="secondary" size="sm">ブロック</Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-sm text-text-secondary">ブロック中</span>
            <Button variant="secondary" size="sm">ブロック解除</Button>
          </div>
        </div>
      </section>

      <section className="px-4 pt-8">
        <h2 className="pb-3 text-lg font-bold">Notifications</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded border border-border bg-bg-secondary/50 px-3 py-2">
            <span className="text-xl" aria-hidden="true">🔔</span>
            <div className="flex-1 text-sm">
              <p className="text-text-primary">A さん他 3 人がいいねしました</p>
              <p className="text-xs text-text-secondary">2 分前 / 未読</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-accent" />
          </div>
          <div className="flex items-center gap-3 rounded border border-border px-3 py-2">
            <span className="text-xl" aria-hidden="true">💬</span>
            <div className="flex-1 text-sm">
              <p className="text-text-primary">B さんがコメントしました</p>
              <p className="text-xs text-text-secondary">15 分前 / 既読</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded border border-border px-3 py-2">
            <span className="text-xl" aria-hidden="true">↩</span>
            <div className="flex-1 text-sm">
              <p className="text-text-primary">C さんが返信しました</p>
              <p className="text-xs text-text-secondary">1 時間前 / 既読</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded border border-border bg-bg-secondary/50 px-3 py-2">
            <span className="text-xl" aria-hidden="true">➕</span>
            <div className="flex-1 text-sm">
              <p className="text-text-primary">D さんからフォロー申請が届きました</p>
              <p className="text-xs text-text-secondary">3 時間前 / 未読</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-accent" />
          </div>
          <div className="flex items-center gap-3 rounded border border-border px-3 py-2">
            <span className="text-xl" aria-hidden="true">✅</span>
            <div className="flex-1 text-sm">
              <p className="text-text-primary">E さんがフォロー承認しました</p>
              <p className="text-xs text-text-secondary">昨日 / 既読</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3">
            <span className="w-24 text-sm text-text-secondary">Bell badge</span>
            <span className="relative inline-flex items-center justify-center rounded-full p-2 text-xl text-text-primary">
              🔔
              <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-accent px-1 text-center text-xs font-bold text-white">5</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
