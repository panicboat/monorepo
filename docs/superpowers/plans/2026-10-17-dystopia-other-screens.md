# Dystopia Other Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メッセージ・足跡・ランキング・設定の残りの差をモックに合わせ、ブロック一覧をシートにし、定義のないクラスを置き換える。

**Architecture:** 各ページの小さな変更にとどめる。ブロック一覧は中身を `BlockedAccountsList` にまとめ、`/settings/blocks` のページと `BlockedAccountsSheet` の両方で使う。メッセージの一覧は既存の `ComposeToSheet`（`kind="message"`）を開く。

**Tech Stack:** Next.js 16 App Router / React 19 / Radix Dialog（`SideSheet`）/ vitest 5 + happy-dom

**Spec:** `docs/superpowers/specs/2026-10-16-dystopia-other-screens-design.md`

## Global Constraints

- 作業ディレクトリは worktree（`/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/refactor-dystopia-design-foundation`）。ブランチは `feat/dystopia-other-screens`
- frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` として実行する
- `src/app/api`・`src/stub`・`proto`・`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容も変更しない
- モックにしかない機能は追加しない。現行にしかない機能は削除しない
- 作成ボタンの花形メニューとモバイルの FAB は変更しない
- シートは第 1 段の `SideSheet` を使う
- 画面の文言は各 Task の表のとおりに一字一句合わせる
- 依存を追加しない
- コードコメントは英語・1 行・「なぜ他のやり方を採らなかったか」だけ。タスクや変更への言及を書かない
- コミットは `git commit -s`。`Co-Authored-By` を付けない。メッセージは英語
- happy-dom のテストで zustand の store の値を変えるときは `createRoot` + `act` で描く
- ファイルを書くときに `cat > file` を使わない（この環境の `cat` は `bat` の alias で、標準入力を待って止まる）。heredoc か編集ツールを使う

## Review Focus

- メッセージの一覧から開いた相手選びのシートで相手を選ぶと、スレッドへ移り、シートは移動で閉じる（Task 1。既存の `ComposeToSheet` の動き）
- ブロック一覧のシートで解除しても、プライバシーの画面は保ったまま一覧だけが更新される（Task 3）
- `/settings/blocks` を直接開いたときも同じ一覧が出る（Task 3）
- ランキングで期間のタブを替えると、小見出しの期間名も替わる（Task 2）
- スレッドの相手が退会済みのとき、見出しは「(退会)とのメッセージ」でリンクにならない（Task 1）

---

## File Structure

frontend（`dystopia/frontend/src/`）:

| ファイル | 責務 | Task |
|---|---|---|
| `app/messages/page.tsx` | 「＋ 新しいメッセージ」、行の「→」と空のときの文言 | 1 |
| `app/messages/[id]/page.tsx` | 見出し「○○とのメッセージ」、相手の吹き出しの色 | 1 |
| `app/footprints/page.tsx` | 説明文、`text-error` | 2 |
| `app/ranking/page.tsx` | 順位と期間の小見出し | 2 |
| `modules/social/components/BlockedAccountsList.tsx` | ブロック一覧の中身 | 3 |
| `modules/social/components/BlockedAccountsSheet.tsx` | ブロック一覧のシート | 3 |
| `app/settings/blocks/page.tsx` | 一覧の部品を使う | 3 |
| `modules/profile/components/PrivacySettings.tsx` | シートを開く | 3 |
| `app/settings/page.tsx` | タブのフェード、`text-text-secondary` | 3 |
| `app/settings/reviews/page.tsx`, `modules/profile/components/ProfileManager.tsx` | 定義のないクラス | 3 |

---

### Task 1: Messages list and thread

**Files:**
- Modify: `dystopia/frontend/src/app/messages/page.tsx`
- Create: `dystopia/frontend/src/app/messages/page.compose.test.tsx`
- Modify: `dystopia/frontend/src/app/messages/[id]/page.tsx`, `page.test.tsx`

文言:

| 場所 | 文言 |
|---|---|
| 一覧の見出しの下のボタン | ＋ 新しいメッセージ |
| 最後のメッセージがない行 | メッセージはまだありません |
| スレッドの見出し | （相手の表示名）とのメッセージ。読み込み中は「チャット」のまま |

- [ ] **Step 1: Write the failing tests**

`src/app/messages/page.compose.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/messaging", () => ({
  useThreads: () => ({
    threads: [
      {
        id: "t-1",
        counterpart: { profileId: "p-2", username: "yuna", displayName: "ゆな", avatarUrl: "" },
        lastMessage: null,
        lastMessageAt: "",
        unreadCount: 0,
      },
    ],
    totalUnreadCount: 0,
    loading: false,
    error: undefined,
  }),
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open }: { kind: string; open: boolean }) => <div>compose:{kind}:{String(open)}</div>,
}));

const { default: MessagesPage } = await import("./page");

describe("MessagesPage", () => {
  it("starts a new message from the list and marks a thread without messages", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(MessagesPage));
    });

    expect(container.textContent).toContain("メッセージはまだありません");
    expect(container.textContent).not.toContain("compose:");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "＋ 新しいメッセージ") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("compose:message:true");
  });
});
```

`src/app/messages/[id]/page.test.tsx` の `it("heads the conversation with the counterpart's name linked to their profile", ...)` の期待値を次に替える:

```tsx
    expect(html).toMatch(/<a[^>]*href="\/u\/yuna"[^>]*>.*<h1[^>]*>ゆなとのメッセージ<\/h1>/);
```

同じファイルの `it("names a withdrawn counterpart without a profile link", ...)` に、見出しが `(退会)とのメッセージ` であることの確認を足す（`expect(html).toContain("(退会)とのメッセージ");`）。

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/app/messages > /tmp/other-vitest.txt 2>&1; tail -15 /tmp/other-vitest.txt`
Expected: FAIL

- [ ] **Step 3: Implement the list**

`src/app/messages/page.tsx`:

- import に `useState` と `ChevronRight`（`lucide-react`）、`Button`（`@/components/ui/button`）、`ComposeToSheet`（`@/components/compose/ComposeToSheet`）を足す
- `ThreadRow` の `const preview = thread.lastMessage?.content || "（メッセージなし）";` を `|| "メッセージはまだありません";` に替え、行の最後（未読の数の後）に `<ChevronRight className="size-5 shrink-0 text-text-secondary" aria-hidden="true" />` を足す
- `MessagesPage` の先頭に足す:

```tsx
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<{ session: number; open: boolean } | null>(null);
```

- `<p className="pt-1 text-sm text-text-secondary">未読 {totalUnreadCount} 件</p>` の次に足す:

```tsx
        <Button
          type="button"
          size="sm"
          className="mt-3"
          onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
        >
          ＋ 新しいメッセージ
        </Button>
```

- `</main>` の直前に足す:

```tsx
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="message"
          open={composing.open}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
```

- [ ] **Step 4: Implement the thread heading and bubbles**

`src/app/messages/[id]/page.tsx`:

- 相手がいるときと退会済みのときの 2 つの `<h1 className="truncate text-base font-bold">{counterpartName}</h1>` を `<h1 className="truncate text-base font-bold">{counterpartName}とのメッセージ</h1>` に替える（読み込み中の「チャット」はそのまま）
- 相手の吹き出しのクラス `"bg-bg-secondary text-text-primary"` を `"bg-surface text-text-primary"` に替える

- [ ] **Step 5: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd dystopia/frontend
git add src/app/messages
git commit -s -m "feat(dystopia/frontend): start a message from the list and name the thread after the counterpart"
```

---

### Task 2: Footprints and ranking

**Files:**
- Modify: `dystopia/frontend/src/app/footprints/page.tsx`
- Create: `dystopia/frontend/src/app/footprints/page.intro.test.tsx`
- Modify: `dystopia/frontend/src/app/ranking/page.tsx`
- Create: `dystopia/frontend/src/app/ranking/page.rank.test.tsx`

文言:

| 場所 | 文言 |
|---|---|
| 足跡の見出しの下 | 最近の訪問を表示しています。足跡を残すかどうかは設定で切り替えられます。 |
| ランキングの各投稿の上 | #（順位） · （期間）の人気投稿。期間は「24h」のタブで「24時間」、ほかはタブの名前（「1週間」「全期間」） |

- [ ] **Step 1: Write the failing tests**

`src/app/footprints/page.intro.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/footprints", () => ({
  useFootprints: () => ({ footprints: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
  useFootprintsUnreadCount: () => ({ count: 0, refresh: vi.fn() }),
  markFootprintsRead: () => Promise.resolve(),
}));

const { default: FootprintsPage } = await import("./page");

describe("FootprintsPage", () => {
  it("explains what the list shows", () => {
    expect(renderToStaticMarkup(<FootprintsPage />)).toContain("最近の訪問を表示しています。足跡を残すかどうかは設定で切り替えられます。");
  });
});
```

`src/app/ranking/page.rank.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/discovery", () => ({
  useRankPosts: () => ({ posts: [{ id: "a" }, { id: "b" }], hasMore: false, loading: false, loadMore: vi.fn() }),
}));
vi.mock("@/modules/post/components/PostCardBinding", () => ({
  PostCardBinding: ({ post }: { post: { id: string } }) => <div>post:{post.id}</div>,
}));

const { default: RankingPage } = await import("./page");

describe("RankingPage", () => {
  it("ranks each post with the selected period", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(RankingPage));
    });

    expect(container.textContent).toContain("#1 · 1週間の人気投稿");
    expect(container.textContent).toContain("#2 · 1週間の人気投稿");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "24h") as HTMLElement).click();
    });

    expect(container.textContent).toContain("#1 · 24時間の人気投稿");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/app/footprints src/app/ranking > /tmp/other-vitest.txt 2>&1; tail -15 /tmp/other-vitest.txt`
Expected: FAIL

- [ ] **Step 3: Implement**

`src/app/footprints/page.tsx`:

- `<FootprintsHeader />` の次（同じ `div` の中）に `<p className="pt-2 text-sm text-text-secondary">最近の訪問を表示しています。足跡を残すかどうかは設定で切り替えられます。</p>` を足す
- `text-text-danger` を `text-error` に替える

`src/app/ranking/page.tsx`:

- `RankingPage` の中、`useRankPosts` の次に足す:

```tsx
  const periodLabel = period === "day" ? "24時間" : (TABS.find((t) => t.id === period)?.label ?? "");
```

- `{posts.map((post) => (<PostCardBinding key={post.id} post={post} />))}` を次に替える:

```tsx
      {posts.map((post, index) => (
        <div key={post.id}>
          <p className="px-4 pt-3 text-xs font-bold tracking-wide text-text-secondary">
            #{index + 1} · {periodLabel}の人気投稿
          </p>
          <PostCardBinding post={post} />
        </div>
      ))}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS（既存の `page.test.tsx` も通る）

- [ ] **Step 5: Commit**

```bash
cd dystopia/frontend
git add src/app/footprints src/app/ranking
git commit -s -m "feat(dystopia/frontend): explain footprints and rank posts by the selected period"
```

---

### Task 3: Settings fade, blocked accounts sheet and undefined classes

**Files:**
- Create: `dystopia/frontend/src/modules/social/components/BlockedAccountsList.tsx`, `BlockedAccountsList.test.tsx`
- Create: `dystopia/frontend/src/modules/social/components/BlockedAccountsSheet.tsx`
- Modify: `dystopia/frontend/src/app/settings/blocks/page.tsx`
- Modify: `dystopia/frontend/src/modules/profile/components/PrivacySettings.tsx`, `PrivacySettings.test.tsx`
- Create: `dystopia/frontend/src/modules/profile/components/PrivacySettings.sheet.test.tsx`
- Modify: `dystopia/frontend/src/app/settings/page.tsx`
- Create: `dystopia/frontend/src/app/settings/page.fade.test.tsx`
- Modify: `dystopia/frontend/src/app/settings/reviews/page.tsx`, `dystopia/frontend/src/modules/profile/components/ProfileManager.tsx`

**Interfaces:**
- Produces: `BlockedAccountsList()`（props なし。`useBlockedList` を読む）、`BlockedAccountsSheet({ open: boolean; onClose: () => void })`

文言:

| 場所 | 文言 |
|---|---|
| シートの見出し | ブロックしたアカウント |
| プライバシーのボタン | ブロックしたアカウント（今のまま） |
| ページの見出し | ブロック一覧（今のまま） |

- [ ] **Step 1: Write the failing tests**

`src/modules/social/components/BlockedAccountsList.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useBlockedList", () => ({
  useBlockedList: () => ({
    profiles: [{ profileId: "p-9", username: "blocked_one", displayName: "ブロック中", avatarUrl: "", isPrivate: false, role: "guest" }],
    loading: false,
    error: undefined,
  }),
}));
vi.mock("./BlockButton", () => ({ BlockButton: ({ targetProfileId }: { targetProfileId: string }) => <span>block:{targetProfileId}</span> }));

const { BlockedAccountsList } = await import("./BlockedAccountsList");

describe("BlockedAccountsList", () => {
  it("counts and lists the blocked accounts with an unblock control", () => {
    const html = renderToStaticMarkup(<BlockedAccountsList />);

    expect(html).toContain("ブロック中のアカウント 1 件");
    expect(html).toContain("@blocked_one");
    expect(html).toContain("block:p-9");
  });
});
```

`src/modules/profile/components/PrivacySettings.test.tsx` の `it("renders a link to the blocked accounts list", ...)` を次に替える（シートを開くボタンになり、リンクではなくなるため）:

```tsx
  it("offers the blocked accounts as a button instead of a link", () => {
    const html = renderToStaticMarkup(
      <PrivacySettings profile={profile} save={async () => {}} />
    );

    expect(html).toContain("ブロックしたアカウント");
    expect(html).not.toContain('href="/settings/blocks"');
  });
```

`src/modules/profile/components/PrivacySettings.sheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/social/components/BlockedAccountsSheet", () => ({
  BlockedAccountsSheet: ({ open }: { open: boolean }) => <div>blocked-sheet:{String(open)}</div>,
}));

const { PrivacySettings } = await import("./PrivacySettings");

describe("PrivacySettings blocked accounts", () => {
  it("opens the blocked accounts in a sheet", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(
        createElement(PrivacySettings, { profile: { ...emptyProfileView("p-1"), username: "yuna" }, save: async () => {} })
      );
    });
    expect(container.textContent).not.toContain("blocked-sheet:");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "ブロックしたアカウント") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("blocked-sheet:true");
  });
});
```

`src/app/settings/page.fade.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ keys: [] as string[] }));

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    mocks.keys.push(key);
  },
}));
vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: { id: "p-1" }, loading: false, error: undefined, saveProfile: vi.fn() }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { isHydrated: boolean; role: string }) => unknown) => selector({ isHydrated: true, role: "guest" }),
  selectIsHydrated: (state: { isHydrated: boolean }) => state.isHydrated,
  selectRole: (state: { role: string }) => state.role,
}));
vi.mock("@/modules/notifications/components/NotificationSettings", () => ({ NotificationSettings: () => <div>notifications</div> }));
vi.mock("@/modules/profile/components/PrivacySettings", () => ({ PrivacySettings: () => <div>privacy</div> }));
vi.mock("@/modules/profile/components/AppearanceSettings", () => ({ AppearanceSettings: () => <div>appearance</div> }));
vi.mock("@/modules/profile/components/AccountSettings", () => ({ AccountSettings: () => <div>account</div> }));
vi.mock("@/modules/profile/components/ProfileManager", () => ({ ProfileManager: () => <div>profiles</div> }));
vi.mock("@/modules/identity/hooks/useDeactivateAccount", () => ({ useDeactivateAccount: () => ({ deactivate: vi.fn(), loading: false, error: null }) }));

const { default: SettingsPage } = await import("./page");

describe("SettingsPage tab fade", () => {
  it("keys the enter animation by the selected tab", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(SettingsPage));
    });
    expect(mocks.keys.at(-1)).toBe("notifications");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "プライバシー") as HTMLElement).click();
    });

    expect(mocks.keys.at(-1)).toBe("privacy");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/social src/modules/profile/components/PrivacySettings src/app/settings > /tmp/other-vitest.txt 2>&1; tail -15 /tmp/other-vitest.txt`
Expected: FAIL

- [ ] **Step 3: Extract the list and add the sheet**

`src/modules/social/components/BlockedAccountsList.tsx`: 今の `src/app/settings/blocks/page.tsx` の、見出し（`<h1>ブロック一覧</h1>`）以外の中身（件数の行、読み込み中・失敗・空の文言、各行）を移す。

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { useBlockedList } from "../hooks/useBlockedList";
import { BlockButton } from "./BlockButton";

export function BlockedAccountsList() {
  const { profiles, loading, error } = useBlockedList();

  return (
    <div>
      <p className="px-4 pt-1 text-sm text-text-secondary">ブロック中のアカウント {profiles.length} 件</p>
      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && profiles.length === 0 && <p className="px-4 py-6 text-text-secondary">ブロック中のアカウントはありません。</p>}
      {profiles.map((p) => (
        <div key={p.profileId} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Avatar src={p.avatarUrl || undefined} fallback={p.displayName.slice(0, 1) || "?"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text-primary">{p.displayName}</p>
            <p className="truncate text-sm text-text-secondary">@{p.username}</p>
          </div>
          <BlockButton targetProfileId={p.profileId} />
        </div>
      ))}
    </div>
  );
}
```

`src/modules/social/components/BlockedAccountsSheet.tsx`:

```tsx
"use client";

import { SideSheet } from "@/components/ui/side-sheet";
import { BlockedAccountsList } from "./BlockedAccountsList";

export function BlockedAccountsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="ブロックしたアカウント"
    >
      <div className="-mx-4 md:-mx-5">
        <BlockedAccountsList />
      </div>
    </SideSheet>
  );
}
```

`src/app/settings/blocks/page.tsx` を次に替える:

```tsx
"use client";

import { BlockedAccountsList } from "@/modules/social/components/BlockedAccountsList";

export default function BlockedAccountsPage() {
  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">ブロック一覧</h1>
      </div>
      <BlockedAccountsList />
    </main>
  );
}
```

`src/modules/profile/components/PrivacySettings.tsx`:

- import に `useState`（今の `react` の import に足す）と `import { BlockedAccountsSheet } from "@/modules/social/components/BlockedAccountsSheet";` を足し、使われなくなる `Link` の import を消す
- コンポーネントの中に足す:

```tsx
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [blocked, setBlocked] = useState<{ session: number; open: boolean } | null>(null);
```

- `<Button asChild variant="secondary" size="sm" className="self-start"><Link href="/settings/blocks">ブロックしたアカウント</Link></Button>` を次に替える:

```tsx
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setBlocked((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
      >
        ブロックしたアカウント
      </Button>
      {blocked && (
        <BlockedAccountsSheet
          key={blocked.session}
          open={blocked.open}
          onClose={() => setBlocked((current) => current && { ...current, open: false })}
        />
      )}
```

- [ ] **Step 4: Fade the settings tabs and replace the undefined classes**

`src/app/settings/page.tsx`:

- import に `useRef` と `import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";` を足す
- `const [tab, setTab] = useState("notifications");` の次に足す（このファイルで早期 return より前にあること）:

```tsx
  const contentRef = useRef<HTMLDivElement>(null);
  useEnterAnimation(contentRef, tab);
```

- タブの中身を包む `<div className="px-4">` を `<div ref={contentRef} className="px-4">` に替える
- `text-muted-foreground` を `text-text-secondary` に替える

`src/app/settings/reviews/page.tsx`: `"bg-accent text-accent-foreground"` を `"bg-accent text-white"`、`"bg-muted text-muted-foreground"` を `"bg-surface text-text-secondary"` に替える。

`src/modules/profile/components/ProfileManager.tsx`: `border-red-600 ... text-red-600` を `border-error ... text-error` に替える。

置き換えのあと、`grep -rnE "text-muted-foreground|text-text-danger|text-foreground\\b|bg-muted\\b|text-accent-foreground|-red-[0-9]{3}|-amber-[0-9]{3}" src --include=*.tsx | grep -v test` が 0 件になること。0 件にならない場合は、出た箇所を同じ規則（灰色の文字は `text-text-secondary`、赤は `text-error`/`border-error`、黄色は `text-warning`、灰色の面は `bg-surface`）で置き換える。

- [ ] **Step 5: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS

- [ ] **Step 6: Run every frontend check**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/other-vitest-all.txt 2>&1; tail -6 /tmp/other-vitest-all.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit $?"
```

Expected: vitest 全件通過、`tsc exit 0`

- [ ] **Step 7: Commit**

```bash
cd dystopia/frontend
git add -A src/modules/social src/modules/profile/components/PrivacySettings.tsx src/modules/profile/components/PrivacySettings.test.tsx src/modules/profile/components/PrivacySettings.sheet.test.tsx src/modules/profile/components/ProfileManager.tsx src/app/settings
git commit -s -m "feat(dystopia/frontend): open blocked accounts in a sheet and fade the settings tabs"
```

---

### Task 4: Whole-branch verification

**Files:** なし（検証と PR）

- [ ] **Step 1: Run the frontend checks and the production build**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/other-vitest.txt 2>&1; tail -6 /tmp/other-vitest.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit $?"
env -u NODE_OPTIONS pnpm exec next build > /tmp/other-build.txt 2>&1; echo "build exit $?"
```

Expected: vitest 全件通過、`tsc exit 0`、`build exit 0`

- [ ] **Step 2: Check the scope**

Run: `git diff --stat feat/dystopia-profile-screens...HEAD` と `git status --short`
Expected: `src/app/api`・`src/stub`・`proto`・`dystopia/monolith` が含まれない。作業ツリーが clean

- [ ] **Step 3: Check on a real browser**

使い捨て DB を作り、monolith と frontend を起動する（メモリ `reference_local_e2e_run.md`）。次を確かめる。

| 操作 | 期待 |
|---|---|
| メッセージの一覧で「＋ 新しいメッセージ」 | 相手選びのシート。相手を選ぶとスレッドへ移り、シートは閉じる |
| スレッド | 見出し「○○とのメッセージ」 |
| 足跡 | 説明文が出る |
| ランキング | 「#1 · 1週間の人気投稿」。24h のタブで「#1 · 24時間の人気投稿」 |
| 設定のタブを替える | 中身がフェードで切り替わる |
| プライバシーの「ブロックしたアカウント」 | 右からシート「ブロックしたアカウント」。閉じるとプライバシーの画面に戻る |
| `/settings/blocks` を直接開く | ページ「ブロック一覧」で同じ一覧 |

monolith と frontend のログに ERROR がないことを確かめる。確認後、サーバーを止め、使い捨て DB を削除し、`dystopia/frontend/AGENTS.md`・`CLAUDE.md` が生成されていれば消す。

- [ ] **Step 4: Push and open the draft PR**

```bash
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-profile-screens --title "feat(dystopia): align messages, footprints, ranking and settings with the mock" --body-file <説明のファイル>
gh stack link 1521 1542 1544 1545 1546 <この PR の番号>
```

PR の説明には、Why（#1517 の第 4 段の 4c）、Decisions（spec の表）、検証（Step 1〜3 のコマンドと結果）、`Refs #1517` を書く。PR は Draft のままにする。
