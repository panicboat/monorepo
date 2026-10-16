# Dystopia Post Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投稿詳細をアプリ内では右からのシートで開き（`/posts/[id]` を直接開いたときはページ）、ホームと検索のタブ切り替えをフェードさせ、ホーム・検索・ブックマークの文言をモックに合わせる。

**Architecture:** 開く投稿を小さな zustand store（`postSheetStore`）で持ち、`AppShell` に 1 つだけ置いた `PostDetailSheet` が開く。投稿カードの本文とコメントアイコン、プロフィールの返信タブの「元の投稿」は、修飾キーのない左クリックのときだけ遷移を止めて store を開く。詳細の中身は `PostDetailContent` にまとめ、シートとページの両方で使う。

**Tech Stack:** Next.js 16 App Router / React 19 / zustand / SWR 2.5.1 / Radix Dialog（`SideSheet`）/ vitest 5 + happy-dom

**Spec:** `docs/superpowers/specs/2026-10-16-dystopia-post-screens-design.md`

## Global Constraints

- 作業ディレクトリは worktree（`/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/refactor-dystopia-design-foundation`）。ブランチは `feat/dystopia-post-screens`
- frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` として実行する
- `src/app/api`・`src/stub`・`proto`・`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容も変更しない
- モックにしかない機能は追加しない。現行にしかない機能は削除しない
- 作成ボタンの花形メニューとモバイルの FAB は変更しない
- シートは第 1 段の `SideSheet`（`src/components/ui/side-sheet.tsx`）を使う
- 画面の文言は spec の表のとおりに一字一句合わせる（各 Task に転記済み）
- 依存を追加しない
- コードコメントは英語・1 行・「なぜ他のやり方を採らなかったか」だけ。タスクや変更への言及を書かない
- コミットは `git commit -s`。`Co-Authored-By` を付けない。メッセージは英語
- happy-dom のテストで zustand の store の値を変えるときは、`renderToStaticMarkup` ではなく `createRoot` + `act` で描く
- happy-dom でリンクをクリックするテストは、`document` に `click` の `preventDefault` を入れて、happy-dom の画面遷移を止める

## Review Focus

- Ctrl・⌘・Shift・Alt を押したクリックと中クリックでは、シートを開かずに今までどおりリンクとして動く（Task 1）
- 詳細の中の投稿カードの本文やコメントアイコンを押しても、詳細を開き直したりページへ移動したりしない（Task 1）
- シートの中で作者名などのリンクを押してページを移ると、シートが閉じる（Task 2。`SideSheet` の既存の動き）
- 存在しない投稿の詳細を開くと「投稿が見つかりませんでした。」を出す（Task 2）
- 閉じるアニメーションの間、シートの中身が消えない（`close` は `postId` を残す。Task 1）

---

## File Structure

frontend（`dystopia/frontend/src/`）:

| ファイル | 責務 | Task |
|---|---|---|
| `lib/utils/isPlainClick.ts` | 修飾キーのない左クリックか | 1 |
| `stores/postSheetStore.ts` | 開いている投稿と開閉 | 1 |
| `components/ui/post-card.tsx` | 本文のリンクのクリックを受け取る | 1 |
| `modules/post/components/PostCardBinding.tsx` | 本文とコメントアイコンでシートを開く、詳細の中では開かない | 1 |
| `modules/post/components/ReplyWithParentRow.tsx` | 元の投稿でシートを開く | 1 |
| `modules/post/components/PostDetailContent.tsx` | 投稿とコメントの詳細の中身 | 2 |
| `modules/post/components/PostDetailSheet.tsx` | store に従って開くシート | 2 |
| `app/posts/[id]/page.tsx` | 中身の部品を使う | 2 |
| `components/shell/AppShell.tsx` | シートを置く | 2 |
| `app/page.tsx`, `app/search/page.tsx`, `app/bookmarks/page.tsx` | フェードと文言 | 3 |

---

### Task 1: Open the post sheet from cards and replies

**Files:**
- Create: `dystopia/frontend/src/lib/utils/isPlainClick.ts`, `isPlainClick.test.ts`
- Create: `dystopia/frontend/src/stores/postSheetStore.ts`, `postSheetStore.test.ts`
- Modify: `dystopia/frontend/src/components/ui/post-card.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostCardBinding.tsx`
- Create: `dystopia/frontend/src/modules/post/components/PostCardBinding.sheet.test.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/ReplyWithParentRow.tsx`
- Create: `dystopia/frontend/src/modules/post/components/ReplyWithParentRow.sheet.test.tsx`

**Interfaces:**
- Produces:
  - `isPlainClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean`
  - `usePostSheetStore`（zustand）: `{ postId: string | null; session: number; open: boolean; openPost: (postId: string) => void; close: () => void }`
  - `PostCard` の props に `onDetailClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void`
  - `PostCardBinding` の props に `inDetail?: boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/utils/isPlainClick.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPlainClick } from "./isPlainClick";

const click = (overrides: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({
  button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...overrides,
});

describe("isPlainClick", () => {
  it("accepts a left click without modifier keys", () => {
    expect(isPlainClick(click())).toBe(true);
  });

  it("refuses modifier keys and other buttons", () => {
    expect(isPlainClick(click({ metaKey: true }))).toBe(false);
    expect(isPlainClick(click({ ctrlKey: true }))).toBe(false);
    expect(isPlainClick(click({ shiftKey: true }))).toBe(false);
    expect(isPlainClick(click({ altKey: true }))).toBe(false);
    expect(isPlainClick(click({ button: 1 }))).toBe(false);
  });
});
```

`src/stores/postSheetStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { usePostSheetStore } from "./postSheetStore";

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
});

describe("postSheetStore", () => {
  it("opens a post and counts each opening", () => {
    usePostSheetStore.getState().openPost("post-1");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", session: 1, open: true });

    usePostSheetStore.getState().openPost("post-2");
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-2", session: 2, open: true });
  });

  it("keeps the post while closing so the sheet can slide out with its content", () => {
    usePostSheetStore.getState().openPost("post-1");
    usePostSheetStore.getState().close();

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: false });
  });
});
```

`src/modules/post/components/PostCardBinding.sheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { PostCardBinding } from "./PostCardBinding";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const post: PostView = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "こんにちは",
  media: [],
  createdAt: new Date().toISOString(),
  author: { profileId: "author-1", displayName: "テスト太郎", username: "test_taro", avatarUrl: "" },
  likesCount: 0,
  commentsCount: 3,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
};

const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  document.addEventListener("click", stopNavigation);
});

afterEach(() => {
  document.removeEventListener("click", stopNavigation);
  document.body.innerHTML = "";
});

async function mount(props: { inDetail?: boolean } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostCardBinding, { post, ...props }));
  });
  return container;
}

async function click(element: Element, init: MouseEventInit = {}) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
  });
}

describe("PostCardBinding opening the detail", () => {
  it("opens the sheet from the comment icon", async () => {
    const container = await mount();

    await click(container.querySelector('a[aria-label="コメント"]')!);

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true });
  });

  it("opens the sheet from the body", async () => {
    const container = await mount();

    await click(container.querySelector('a[href="/posts/post-1"]:not([aria-label])')!);

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true });
  });

  it("leaves a modified click to the link", async () => {
    const container = await mount();

    await click(container.querySelector('a[aria-label="コメント"]')!, { metaKey: true });
    await click(container.querySelector('a[aria-label="コメント"]')!, { ctrlKey: true });

    expect(usePostSheetStore.getState().open).toBe(false);
  });

  it("does not link to the detail inside the detail", async () => {
    const container = await mount({ inDetail: true });

    expect(container.querySelector('a[href="/posts/post-1"]')).toBeNull();
    expect(container.textContent).toContain("3");
  });
});
```

`src/modules/post/components/ReplyWithParentRow.sheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommentView } from "@/modules/post/lib/comment-view";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { ReplyWithParentRow } from "./ReplyWithParentRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const parentPost = {
  id: "post-1",
  authorProfileId: "author-1",
  content: "元の投稿",
  media: [],
  createdAt: new Date().toISOString(),
  author: { profileId: "author-1", displayName: "テスト太郎", username: "test_taro", avatarUrl: "" },
  likesCount: 0,
  commentsCount: 1,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
} as PostView;

const comment: CommentView = {
  id: "comment-1",
  postId: "post-1",
  parentId: null,
  authorProfileId: "replier-1",
  content: "返信",
  createdAt: new Date().toISOString(),
  author: { profileId: "replier-1", name: "返信者", imageUrl: "", username: "replier" },
  repliesCount: 0,
  mentions: [],
};

const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  document.addEventListener("click", stopNavigation);
});

afterEach(() => {
  document.removeEventListener("click", stopNavigation);
  document.body.innerHTML = "";
});

describe("ReplyWithParentRow opening the parent post", () => {
  it("opens the parent post in the sheet on a plain click and leaves a modified click to the link", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(ReplyWithParentRow, { comment, parentPost }));
    });
    const link = container.querySelector('a[href="/posts/post-1"]')!;

    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, shiftKey: true }));
    });
    expect(usePostSheetStore.getState().open).toBe(false);

    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/lib/utils/isPlainClick.test.ts src/stores/postSheetStore.test.ts src/modules/post/components/PostCardBinding.sheet.test.tsx src/modules/post/components/ReplyWithParentRow.sheet.test.tsx > /tmp/post-vitest.txt 2>&1; tail -15 /tmp/post-vitest.txt`
Expected: FAIL（`isPlainClick`・`postSheetStore` が見つからない、store が開かない）

- [ ] **Step 3: Implement the click rule and the store**

`src/lib/utils/isPlainClick.ts`:

```ts
interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function isPlainClick(event: ClickLike): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
```

`src/stores/postSheetStore.ts`:

```ts
import { create } from "zustand";

interface PostSheetState {
  postId: string | null;
  session: number;
  open: boolean;
  openPost: (postId: string) => void;
  close: () => void;
}

export const usePostSheetStore = create<PostSheetState>()((set) => ({
  postId: null,
  session: 0,
  open: false,
  openPost: (postId) => set((state) => ({ postId, session: state.session + 1, open: true })),
  // Keep the post while closing: dropping it would empty the sheet before it slides out.
  close: () => set({ open: false }),
}));
```

- [ ] **Step 4: Let the card's body link take a click handler**

`src/components/ui/post-card.tsx`:

- `PostCardProps` の `detailHref?: string;` の次に `onDetailClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;` を足す
- 関数の引数の `detailHref,` の次に `onDetailClick,` を足す
- `<Link href={detailHref} className="block">` を `<Link href={detailHref} onClick={onDetailClick} className="block">` に替える

- [ ] **Step 5: Open the sheet from the card**

`src/modules/post/components/PostCardBinding.tsx`:

import に足す:

```tsx
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { usePostSheetStore } from "@/stores/postSheetStore";
```

`PostCardBindingProps` に `inDetail?: boolean;` を足し、関数の引数を `{ post, detailHref, inDetail, className }` に替える。

`const href = detailHref || ...` の次に足す:

```tsx
  const openPost = usePostSheetStore((s) => s.openPost);
  const openDetail = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openPost(post.id);
  };
```

コメントアイコンの `<Link ...>...</Link>` を次に替える:

```tsx
      {inDetail ? (
        <span className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm">
          <MessageCircle className="size-5" aria-hidden="true" />
          <span>{post.commentsCount}</span>
        </span>
      ) : (
        <Link
          href={href}
          onClick={openDetail}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary"
          aria-label="コメント"
        >
          <MessageCircle className="size-5" />
          <span>{post.commentsCount}</span>
        </Link>
      )}
```

`<PostCard ... detailHref={href}` を次に替える:

```tsx
      detailHref={inDetail ? undefined : href}
      onDetailClick={inDetail ? undefined : openDetail}
```

- [ ] **Step 6: Open the sheet from a reply's parent post**

`src/modules/post/components/ReplyWithParentRow.tsx`:

import に足す:

```tsx
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { usePostSheetStore } from "@/stores/postSheetStore";
```

`const detailHref = ...` の次に足す:

```tsx
  const openPost = usePostSheetStore((s) => s.openPost);
  const openParent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openPost(comment.postId);
  };
```

元の投稿の `<Link href={detailHref}` に `onClick={openParent}` を足す。

- [ ] **Step 7: Run the tests to verify they pass, and the existing post tests**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/lib/utils src/stores src/modules/post src/components/ui > /tmp/post-vitest.txt 2>&1; tail -8 /tmp/post-vitest.txt`
Expected: PASS（既存の `PostCardBinding.test.tsx`・`ReplyWithParentRow.test.tsx`・`post-card.test.tsx` も通る）

- [ ] **Step 8: Commit**

```bash
cd dystopia/frontend
git add src/lib/utils/isPlainClick.ts src/lib/utils/isPlainClick.test.ts src/stores/postSheetStore.ts src/stores/postSheetStore.test.ts src/components/ui/post-card.tsx src/modules/post/components/PostCardBinding.tsx src/modules/post/components/PostCardBinding.sheet.test.tsx src/modules/post/components/ReplyWithParentRow.tsx src/modules/post/components/ReplyWithParentRow.sheet.test.tsx
git commit -s -m "feat(dystopia/frontend): open a post's detail from cards and replies on a plain click"
```

---

### Task 2: Post detail content, sheet and page

**Files:**
- Create: `dystopia/frontend/src/modules/post/components/PostDetailContent.tsx`, `PostDetailContent.test.tsx`
- Create: `dystopia/frontend/src/modules/post/components/PostDetailSheet.tsx`, `PostDetailSheet.test.tsx`
- Modify: `dystopia/frontend/src/app/posts/[id]/page.tsx`
- Create: `dystopia/frontend/src/app/posts/[id]/page.test.tsx`
- Modify: `dystopia/frontend/src/components/shell/AppShell.tsx`

**Interfaces:**
- Consumes: Task 1 の `usePostSheetStore`、`PostCardBinding` の `inDetail`
- Produces: `PostDetailContent({ postId: string })`、`PostDetailSheet()`（props なし）

- [ ] **Step 1: Write the failing tests**

`src/modules/post/components/PostDetailContent.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePost: vi.fn(),
  cardProps: null as null | { inDetail?: boolean },
}));

vi.mock("../hooks/usePost", () => ({ usePost: mocks.usePost }));
vi.mock("./PostCardBinding", () => ({
  PostCardBinding: (props: { inDetail?: boolean }) => {
    mocks.cardProps = props;
    return <div>post-card</div>;
  },
}));
vi.mock("./CommentComposer", () => ({ CommentComposer: ({ postId }: { postId: string }) => <div>composer:{postId}</div> }));
vi.mock("./CommentList", () => ({ CommentList: ({ postId }: { postId: string }) => <div>comments:{postId}</div> }));

const { PostDetailContent } = await import("./PostDetailContent");

beforeEach(() => {
  mocks.cardProps = null;
});

describe("PostDetailContent", () => {
  it("shows the post without detail links, then the comments", () => {
    mocks.usePost.mockReturnValue({ post: { id: "post-1", commentsCount: 2 }, loading: false, error: undefined });

    const html = renderToStaticMarkup(<PostDetailContent postId="post-1" />);

    expect(mocks.usePost).toHaveBeenCalledWith("post-1");
    expect(mocks.cardProps?.inDetail).toBe(true);
    expect(html).toContain("コメント（2 件）");
    expect(html).toContain("composer:post-1");
    expect(html).toContain("comments:post-1");
  });

  it("says it is loading and that a missing post was not found", () => {
    mocks.usePost.mockReturnValue({ post: null, loading: true, error: undefined });
    expect(renderToStaticMarkup(<PostDetailContent postId="post-1" />)).toContain("読み込み中…");

    mocks.usePost.mockReturnValue({ post: null, loading: false, error: new Error("not found") });
    expect(renderToStaticMarkup(<PostDetailContent postId="post-1" />)).toContain("投稿が見つかりませんでした。");
  });
});
```

`src/modules/post/components/PostDetailSheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePostSheetStore } from "@/stores/postSheetStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("./PostDetailContent", () => ({ PostDetailContent: ({ postId }: { postId: string }) => <div>detail:{postId}</div> }));

const { PostDetailSheet } = await import("./PostDetailSheet");

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostDetailSheet));
  });
}

describe("PostDetailSheet", () => {
  it("shows nothing before a post is opened", async () => {
    await mount();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows the opened post's detail and closes through the store", async () => {
    await mount();
    await act(async () => usePostSheetStore.getState().openPost("post-1"));

    expect(document.body.textContent).toContain("投稿の詳細");
    expect(document.body.textContent).toContain("detail:post-1");

    await act(async () => {
      (document.querySelector('button[aria-label="閉じる"]') as HTMLButtonElement).click();
    });

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: false });
  });
});
```

`src/app/posts/[id]/page.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "post-1" }) }));
vi.mock("@/modules/post/components/PostDetailContent", () => ({
  PostDetailContent: ({ postId }: { postId: string }) => <div>detail:{postId}</div>,
}));

const { default: PostDetailPage } = await import("./page");

describe("PostDetailPage", () => {
  it("shows the post's detail for the id in the URL", () => {
    expect(renderToStaticMarkup(<PostDetailPage />)).toContain("detail:post-1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/post/components/PostDetailContent.test.tsx src/modules/post/components/PostDetailSheet.test.tsx "src/app/posts/[id]/page.test.tsx" > /tmp/post-vitest.txt 2>&1; tail -15 /tmp/post-vitest.txt`
Expected: FAIL（モジュールが見つからない、ページが `PostDetailContent` を使っていない）

- [ ] **Step 3: Implement the content**

`src/modules/post/components/PostDetailContent.tsx`:

```tsx
"use client";

import { usePost } from "../hooks/usePost";
import { CommentComposer } from "./CommentComposer";
import { CommentList } from "./CommentList";
import { PostCardBinding } from "./PostCardBinding";

export function PostDetailContent({ postId }: { postId: string }) {
  const { post, loading, error } = usePost(postId || null);

  if (loading) {
    return <p className="p-6 text-text-secondary">読み込み中…</p>;
  }
  if (error || !post) {
    return <p className="p-6 text-text-secondary">投稿が見つかりませんでした。</p>;
  }

  return (
    <>
      <PostCardBinding post={post} inDetail />
      <section className="border-t border-divider">
        <h2 className="px-4 py-3 text-sm font-bold text-text-secondary">コメント（{post.commentsCount} 件）</h2>
        <CommentComposer postId={post.id} />
        <CommentList postId={post.id} />
      </section>
    </>
  );
}
```

- [ ] **Step 4: Implement the sheet and the page**

`src/modules/post/components/PostDetailSheet.tsx`:

```tsx
"use client";

import { SideSheet } from "@/components/ui/side-sheet";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { PostDetailContent } from "./PostDetailContent";

export function PostDetailSheet() {
  const postId = usePostSheetStore((s) => s.postId);
  const session = usePostSheetStore((s) => s.session);
  const open = usePostSheetStore((s) => s.open);
  const close = usePostSheetStore((s) => s.close);

  if (!postId) return null;

  return (
    <SideSheet
      key={session}
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title="投稿の詳細"
    >
      <div className="-mx-4 -mt-4 md:-mx-5">
        <PostDetailContent postId={postId} />
      </div>
    </SideSheet>
  );
}
```

`src/app/posts/[id]/page.tsx` を次に替える:

```tsx
"use client";

import { useParams } from "next/navigation";
import { PostDetailContent } from "@/modules/post/components/PostDetailContent";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <PostDetailContent postId={id} />
    </main>
  );
}
```

`src/components/shell/AppShell.tsx` の import に `import { PostDetailSheet } from "@/modules/post/components/PostDetailSheet";` を足し、アプリ表示の `<Drawer ... />` の次の行に `<PostDetailSheet />` を足す。

- [ ] **Step 5: Run the tests to verify they pass, and the shell tests**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/post "src/app/posts" src/components/shell > /tmp/post-vitest.txt 2>&1; tail -8 /tmp/post-vitest.txt`
Expected: PASS。`src/components/shell` の既存テストが `PostDetailSheet` の読み込みで落ちたら、そのテストに `vi.mock("@/modules/post/components/PostDetailSheet", () => ({ PostDetailSheet: () => null }))` を足す

- [ ] **Step 6: Commit**

```bash
cd dystopia/frontend
git add src/modules/post/components/PostDetailContent.tsx src/modules/post/components/PostDetailContent.test.tsx src/modules/post/components/PostDetailSheet.tsx src/modules/post/components/PostDetailSheet.test.tsx "src/app/posts/[id]/page.tsx" "src/app/posts/[id]/page.test.tsx" src/components/shell
git commit -s -m "feat(dystopia/frontend): show a post's detail in a sheet in the app and as a page by URL"
```

---

### Task 3: Tab fade and copy on home, search and bookmarks

**Files:**
- Modify: `dystopia/frontend/src/app/page.tsx`
- Create: `dystopia/frontend/src/app/page.tabs.test.tsx`
- Modify: `dystopia/frontend/src/app/search/page.tsx`, `page.test.tsx`
- Modify: `dystopia/frontend/src/app/bookmarks/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `useEnterAnimation(ref: RefObject<HTMLElement | null>, key: string)`（`src/lib/motion/useEnterAnimation.ts`、第 1 段）、`PageHeader({ title, description })`

- [ ] **Step 1: Write the failing tests**

`src/app/page.tabs.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ enterKeys: [] as string[] }));

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    mocks.enterKeys.push(key);
  },
}));
vi.mock("@/modules/feed/hooks/useFeed", () => ({
  useFeed: () => ({
    posts: [], loading: false, loadingMore: false, error: null, hasMore: false, initialized: true,
    fetchInitial: vi.fn(), fetchMore: vi.fn(), reset: vi.fn(),
  }),
}));
vi.mock("@/modules/profile/hooks/useProfile", () => ({ useProfile: () => ({ profile: { prefecture: "" } }) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: Object.assign(
    (selector: (state: { role: string }) => unknown) => selector({ role: "cast" }),
    { subscribe: () => () => {}, getState: () => ({}) },
  ),
  selectRole: (state: { role: string }) => state.role,
}));
vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({
  useRecentKarte: () => ({ kartes: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/review/hooks/useRecentReviews", () => ({
  useRecentReviews: () => ({ entries: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/karte/components/KarteList", () => ({ KarteList: () => <div>karte-list</div> }));

const { default: HomePage } = await import("./page");

async function selectTab(container: HTMLElement, label: string) {
  await act(async () => {
    (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === label) as HTMLElement).click();
  });
}

describe("HomePage tab content", () => {
  it("fades the content on each tab and explains the karte and review tabs", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(HomePage));
    });
    expect(mocks.enterKeys.at(-1)).toBe("all");

    await selectTab(container, "カルテ");
    expect(mocks.enterKeys.at(-1)).toBe("karte");
    expect(container.textContent).toContain("全キャスト間で共有される新着カルテ（記録中を含む）。カードから詳細を確認できます。");

    await selectTab(container, "レビュー");
    expect(mocks.enterKeys.at(-1)).toBe("reviews");
    expect(container.textContent).toContain("ゲストがキャストに残した新着レビューです。");
  });
});
```

`src/app/search/page.test.tsx` の `describe("SearchPage", ...)` の中に足す:

```tsx
  it("shows the page heading above the search box", async () => {
    navigation.query = null;
    hookMocks.useSearchUsers.mockReturnValue({ profiles: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() });
    hookMocks.useSearchPosts.mockReturnValue({ posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SearchPage />);
    });

    expect(container.querySelector("h1")?.textContent).toBe("検索");
    expect(container.textContent).toContain("ユーザーや投稿を探す");
    await act(async () => root.unmount());
    container.remove();
  });
```

`src/app/bookmarks/page.test.tsx` を次に替える（既存の `BookmarksHeader` のテストは残す）:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/bookmarks", () => ({
  useBookmarkList: () => ({ posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
}));
vi.mock("@/modules/post/components/PostCardBinding", () => ({ PostCardBinding: () => null }));

const { default: BookmarksPage, BookmarksHeader } = await import("./page");

describe("BookmarksHeader", () => {
  it("renders a description of what this list is", () => {
    const html = renderToStaticMarkup(<BookmarksHeader />);

    expect(html).toContain("ブックマーク");
    expect(html).toContain("保存した投稿の一覧");
  });
});

describe("BookmarksPage", () => {
  it("tells how to add a bookmark when there is none", () => {
    const html = renderToStaticMarkup(<BookmarksPage />);

    expect(html).toContain("まだブックマークがありません");
    expect(html).toContain("投稿のしおりアイコンから追加できます。");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/app/page.tabs.test.tsx src/app/search src/app/bookmarks > /tmp/post-vitest.txt 2>&1; tail -15 /tmp/post-vitest.txt`
Expected: FAIL（フェードの鍵が渡らない、説明文・見出し・空の文言がない）

- [ ] **Step 3: Implement home**

`src/app/page.tsx`:

- import に `useRef` を足し（`react` の import に追加）、`import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";` を足す
- `HomePage` の中、`const content = ...` の前に足す:

```tsx
  const contentRef = useRef<HTMLElement>(null);
  useEnterAnimation(contentRef, tab);
```

- `<section>{content}</section>` を `<section ref={contentRef}>{content}</section>` に替える
- `karteContent` の `useMemo` の中身を、説明文を先頭に出す形に替える:

```tsx
  const karteContent = useMemo(
    () => (
      <>
        <p className="px-4 py-3 text-sm text-text-secondary">全キャスト間で共有される新着カルテ（記録中を含む）。カードから詳細を確認できます。</p>
        {karte.error ? (
          <p className="px-4 py-8 text-center text-error">読み込みに失敗しました</p>
        ) : (
          <KarteList
            kartes={karte.kartes}
            variant="feed"
            hasMore={karte.hasMore}
            loading={karte.loading}
            onLoadMore={karte.loadMore}
            empty="まだカルテがありません"
          />
        )}
      </>
    ),
    [karte.error, karte.kartes, karte.hasMore, karte.loading, karte.loadMore]
  );
```

- `reviewsContent` の `useMemo` が返す要素の先頭に `<p className="px-4 py-3 text-sm text-text-secondary">ゲストがキャストに残した新着レビューです。</p>` を出す。早期 return している分岐（読み込み中・エラー）も含め、すべての返り値の先頭に出るように、返り値を `<>説明文{今の返り値}</>` で包む
- ファイル内の残りの `text-text-danger` を `text-error` に替える（`grep -n "text-text-danger" src/app/page.tsx` で 0 件になること）

- [ ] **Step 4: Implement search**

`src/app/search/page.tsx`:

- import に `useRef` を足し、`import { PageHeader } from "@/components/ui/page-header";` と `import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";` を足す
- `SearchView` の中、`const trimmed = ...` の次に足す:

```tsx
  const resultsRef = useRef<HTMLDivElement>(null);
  useEnterAnimation(resultsRef, tab);
```

- `<main ...>` の直後（sticky の検索欄の前）に足す:

```tsx
      <header className="px-4 pt-3">
        <PageHeader title="検索" description="ユーザーや投稿を探す" />
      </header>
```

- `<Tabs ... />` より後ろ（役割の絞り込み・空の案内・結果）を `<div ref={resultsRef}>...</div>` で包む

- [ ] **Step 5: Implement bookmarks**

`src/app/bookmarks/page.tsx` の空のときの文言を替える:

- 「ブックマークはまだありません」→「まだブックマークがありません」
- 「投稿をブックマークすると、ここに表示されます」→「投稿のしおりアイコンから追加できます。」

- [ ] **Step 6: Run the tests to verify they pass, and the app tests**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/app > /tmp/post-vitest.txt 2>&1; tail -8 /tmp/post-vitest.txt`
Expected: PASS（既存の `src/app/page.test.tsx` も通る）

- [ ] **Step 7: Run every frontend check**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/post-vitest-all.txt 2>&1; tail -6 /tmp/post-vitest-all.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit $?"
```

Expected: vitest 全件通過、`tsc exit 0`

- [ ] **Step 8: Commit**

```bash
cd dystopia/frontend
git add src/app/page.tsx src/app/page.tabs.test.tsx src/app/search src/app/bookmarks
git commit -s -m "feat(dystopia/frontend): fade tab content and match home, search and bookmark copy to the mock"
```

---

### Task 4: Whole-branch verification

**Files:** なし（検証と PR）

- [ ] **Step 1: Run the frontend checks and the production build**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/post-vitest.txt 2>&1; tail -6 /tmp/post-vitest.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit $?"
env -u NODE_OPTIONS pnpm exec next build > /tmp/post-build.txt 2>&1; echo "build exit $?"
```

Expected: vitest 全件通過、`tsc exit 0`、`build exit 0`

- [ ] **Step 2: Check the scope**

Run: `git diff --stat feat/dystopia-karte-screens...HEAD` と `git status --short`
Expected: 変更が File Structure の表と spec・plan に収まる。`src/app/api`・`src/stub`・`proto`・`dystopia/monolith` が含まれない。作業ツリーが clean

- [ ] **Step 3: Check on a real browser**

使い捨て DB を作り、monolith と frontend を起動する（手順はメモリ `reference_local_e2e_run.md`）。seed のキャストでログインし、次を確かめる。

| 操作 | 期待 |
|---|---|
| ホームで投稿のコメントアイコンを押す | 右から「投稿の詳細」が開き、投稿とコメント欄が出る。URL は変わらない |
| シートでコメントを書いて送る | コメント一覧に出る |
| ブラウザの戻る | シートが閉じ、ホームに残る |
| 投稿の本文を押す | 同じシートが開く |
| ⌘ を押しながらコメントアイコンを押す | シートは開かない |
| `/posts/<id>` を直接開く | ページで詳細が出る |
| プロフィールの返信タブで元の投稿を押す | シートで開く |
| シートの中で作者名を押す | プロフィールへ移り、シートが閉じる |
| ホームのタブを替える | 中身がフェードで切り替わる。カルテ・レビュータブに説明文が出る |
| 検索 | 見出し「検索」「ユーザーや投稿を探す」 |

monolith と frontend のログに ERROR がないことを確かめる。確認後、サーバーを止め、使い捨て DB を削除し、`dystopia/frontend/AGENTS.md`・`CLAUDE.md` が生成されていれば消す。

- [ ] **Step 4: Push and open the draft PR**

```bash
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-karte-screens --title "feat(dystopia): open post details in a sheet and fade tab content" --body-file <説明のファイル>
gh stack link 1521 1542 1544 <この PR の番号>
```

PR の説明には、Why（#1517 の第 4 段の 4a）、Decisions（spec の表）、検証（Step 1〜3 のコマンドと結果）、`Refs #1517` を書く。PR は Draft のままにする。
