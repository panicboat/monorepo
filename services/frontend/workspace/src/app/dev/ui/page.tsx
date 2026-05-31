"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tab";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/ui/avatar";
import { UserCard } from "@/components/ui/user-card";
import { PostCard } from "@/components/ui/post-card";

export default function DevUiPage() {
  const [tab, setTab] = useState("home");
  const [on, setOn] = useState(false);
  const [following, setFollowing] = useState(false);

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
    </main>
  );
}
