"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { ProfileName } from "@/components/ui/profile-name";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { ScheduleSearchPanel } from "@/modules/schedule/components/ScheduleSearchPanel";
import { parseSearchChoices, writeSearchChoices, type ScheduleSearchChoices, type SearchHome } from "@/modules/schedule/lib/searchChoices";
import { useProfile } from "@/modules/profile/hooks";
import { FollowButton } from "@/modules/social";
import { useSearchUsers, useSearchPosts } from "@/modules/discovery";
import type { SearchUsersRoleFilter } from "@/modules/discovery/hooks/useSearchUsers";
import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";
import { cn } from "@/lib/utils";

const ROLE_CHIPS: Array<{ id: SearchUsersRoleFilter; label: string }> = [
  { id: 0, label: "全て" },
  { id: 2, label: "キャスト" },
  { id: 1, label: "ゲスト" },
];

const TABS: TabItem[] = [
  { id: "users", label: "ユーザー" },
  { id: "posts", label: "投稿" },
  { id: "schedules", label: "出勤" },
];

const HASHTAG_QUERY = /^[#＃]/;

export default function SearchPage() {
  return (
    <Suspense>
      <SearchFromUrl />
    </Suspense>
  );
}

function SearchFromUrl() {
  const params = useSearchParams();
  const urlQuery = params?.get("q") ?? "";
  const urlTab = params?.get("tab") ?? "";
  const { profile, loading } = useProfile();
  // Wait for the acting profile so the schedule filters start from its area instead of switching after the first search.
  if (loading) return null;
  const home: SearchHome = { prefecture: profile?.prefecture ?? "", area: profile?.area ?? "" };
  // Remount per URL query only: a tag opened from the results must replace what was typed, but the tab and filters this page writes must not.
  return <SearchView key={urlQuery} initialQuery={urlQuery} initialTab={urlTab} initialChoices={parseSearchChoices(params, home)} home={home} />;
}

function initialTabFor(urlTab: string, query: string): string {
  if (TABS.some((t) => t.id === urlTab)) return urlTab;
  return HASHTAG_QUERY.test(query) ? "posts" : "users";
}

interface SearchViewProps {
  initialQuery: string;
  initialTab: string;
  initialChoices: ScheduleSearchChoices;
  home: SearchHome;
}

function SearchView({ initialQuery, initialTab, initialChoices, home }: SearchViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState(initialTabFor(initialTab, initialQuery));
  const [roleFilter, setRoleFilter] = useState<SearchUsersRoleFilter>(0);
  const [choices, setChoices] = useState(initialChoices);

  function replaceUrl(nextTab: string, nextChoices: ScheduleSearchChoices) {
    const next = new URLSearchParams();
    if (initialQuery !== "") next.set("q", initialQuery);
    next.set("tab", nextTab);
    if (nextTab === "schedules") writeSearchChoices(next, nextChoices, home);
    router.replace(`/search?${next}`, { scroll: false });
  }

  function selectTab(nextTab: string) {
    setTab(nextTab);
    replaceUrl(nextTab, choices);
  }

  function changeChoices(nextChoices: ScheduleSearchChoices) {
    setChoices(nextChoices);
    replaceUrl("schedules", nextChoices);
  }

  const users = useSearchUsers(tab === "users" ? query : "", roleFilter);
  const posts = useSearchPosts(tab === "posts" ? query : "");

  const trimmed = query.trim();
  const resultsRef = useRef<HTMLDivElement>(null);
  useEnterAnimation(resultsRef, tab);

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <header className="px-4 pt-3">
        <PageHeader title="検索" description="ユーザーや投稿を探す" />
      </header>
      <div className="sticky top-0 z-10 bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "schedules" ? "名前で絞り込む" : "ユーザーや投稿を検索"}
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
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      <Tabs items={TABS} value={tab} onValueChange={selectTab} />
      <div ref={resultsRef}>

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
                  "shrink-0 rounded-full border px-3 py-1 text-sm",
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

      {trimmed.length === 0 && tab !== "schedules" && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <Search className="size-10 text-text-secondary" strokeWidth={1.5} />
          <p className="pt-3 text-text-primary">ユーザーや投稿を検索</p>
          <p className="pt-1 text-sm text-text-secondary">
            ユーザー名や投稿内容で検索できます。#タグ でタグの付いた投稿を探せます
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
          {users.profiles.map((p) => {
            const href = `/u/${encodeURIComponent(p.username)}`;
            return (
              <div
                key={p.profileId}
                className="flex items-center gap-3 border-b border-border px-4 py-3"
              >
                <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" href={href} />
                <Link href={href} className="min-w-0 flex-1">
                  <p className="flex">
                    <ProfileName profile={p} />
                  </p>
                  <p className="truncate text-sm text-text-secondary">@{p.username}</p>
                </Link>
                <FollowButton targetProfileId={p.profileId} />
              </div>
            );
          })}
          {users.hasMore && (
            <div className="flex justify-center px-4 py-6">
              <Button variant="secondary" size="md" onClick={() => users.loadMore()} disabled={users.loading}>
                もっと見る
              </Button>
            </div>
          )}
        </>
      )}

      {tab === "schedules" && <ScheduleSearchPanel query={query} choices={choices} onChoicesChange={changeChoices} />}

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
      </div>
    </main>
  );
}
