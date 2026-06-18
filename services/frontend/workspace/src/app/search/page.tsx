"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { FollowButton } from "@/modules/social";
import { useSearchUsers, useSearchPosts } from "@/modules/discovery";
import type { SearchUsersRoleFilter } from "@/modules/discovery/hooks/useSearchUsers";
import { cn } from "@/lib/utils";

const ROLE_CHIPS: Array<{ id: SearchUsersRoleFilter; label: string }> = [
  { id: 0, label: "全て" },
  { id: 2, label: "キャスト" },
  { id: 1, label: "ゲスト" },
];

const TABS: TabItem[] = [
  { id: "users", label: "ユーザー" },
  { id: "posts", label: "投稿" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("users");
  const [roleFilter, setRoleFilter] = useState<SearchUsersRoleFilter>(0);

  const users = useSearchUsers(tab === "users" ? query : "", roleFilter);
  const posts = useSearchPosts(tab === "posts" ? query : "");

  const trimmed = query.trim();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="sticky top-0 z-10 bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ユーザーや投稿を検索"
            aria-label="検索"
            className="pr-9"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-secondary hover:text-text-primary"
              aria-label="検索をクリア"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <Tabs items={TABS} value={tab} onValueChange={setTab} />

      {tab === "users" && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2">
          {ROLE_CHIPS.map((chip) => {
            const active = roleFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setRoleFilter(chip.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs",
                  active
                    ? "border-transparent bg-gradient-brand text-white"
                    : "border-divider text-text-secondary hover:text-text-primary"
                )}
                aria-pressed={active}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {trimmed.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="text-4xl" aria-hidden="true">🔍</span>
          <p className="pt-3 text-text-primary">ユーザーや投稿を検索</p>
          <p className="pt-1 text-sm text-text-secondary">
            ユーザー名や投稿内容で検索できます
          </p>
        </div>
      )}

      {tab === "users" && trimmed.length > 0 && (
        <>
          {users.loading && users.profiles.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">検索中…</p>
          )}
          {!users.loading && users.profiles.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">該当するユーザーがいません</p>
          )}
          {users.profiles.map((p) => (
            <div
              key={p.accountId}
              className="flex items-center gap-3 border-b border-border px-4 py-3"
            >
              <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text-primary">{p.displayName}</p>
                <p className="truncate text-sm text-text-secondary">@{p.username}</p>
              </div>
              <FollowButton targetAccountId={p.accountId} />
            </div>
          ))}
          {users.hasMore && (
            <div className="flex justify-center px-4 py-6">
              <Button variant="secondary" size="md" onClick={() => users.loadMore()} disabled={users.loading}>
                もっと見る
              </Button>
            </div>
          )}
        </>
      )}

      {tab === "posts" && trimmed.length > 0 && (
        <>
          {posts.loading && posts.posts.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">検索中…</p>
          )}
          {!posts.loading && posts.posts.length === 0 && (
            <p className="px-4 py-6 text-text-secondary">該当する投稿がありません</p>
          )}
          {posts.posts.map((post) => (
            <PostCardBinding key={post.id} post={post} />
          ))}
          {posts.hasMore && (
            <div className="flex justify-center px-4 py-6">
              <Button variant="secondary" size="md" onClick={() => posts.loadMore()} disabled={posts.loading}>
                もっと見る
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
