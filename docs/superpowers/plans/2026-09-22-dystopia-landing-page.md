# dystopia landing page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインで`/`にアクセスした訪問者に、`/login`への即時redirectの代わりにdystopia.cityのランディングページ（ヒーロー・機能紹介・サンプル投稿・年齢確認兼CTA）を表示する。

**Architecture:** 新規コンポーネント`LandingPage`を`modules/landing/components/`に作成し、既存の`AppShell.tsx`の未ログイン時レンダリング分岐に「`pathname === "/"`ならLandingPageを描画」という特例を1つ追加する。`app/page.tsx`（ログイン後のホームフィード）は無変更。

**Tech Stack:** Next.js (App Router) / React / TypeScript / Tailwind (既存トークン) / vitest / `react-dom/server`の`renderToStaticMarkup`

**Spec:** `docs/superpowers/specs/2026-09-22-dystopia-landing-page-design.md`

## Global Constraints

- ルーティング変更は`AppShell.tsx`の redirect effect 条件に `&& pathname !== "/"` を追加し、render分岐に `pathname === "/"` の特例を追加するだけに留める。hydration前の分岐（`if (!isHydrated)`）は変更しない。`app/page.tsx`は一切変更しない。
- 新規ファイルは `dystopia/frontend/src/modules/landing/components/LandingPage.tsx`。
- コンテンツの文言は確定済みで、一字一句そのまま使う（スペック「コンテンツ構成（確定文面）」節）。
- 実際の`PostCard`/`PostCardBinding`コンポーネントやそのフック（`usePostLike`等）は使わない。サンプル投稿は独立した静的マークアップにする。
- メインCTAは`/signup`へ、退場リンクは外部URL `https://www.google.com`、既存ユーザー導線は`/login`。
- フッターはコピーライト表記のみ（`© 2026 dystopia.city`）。存在しない`/terms`等へのリンクは作らない。
- 年齢確認の状態を永続化しない（Cookie等に「確認済み」を保存しない）。
- 新しいデザイン言語を作らない。既存の`Button`コンポーネント（`@/components/ui/button`）と既存のカラートークン（`bg-bg`, `bg-bg-secondary`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-accent`, `border-border`, `border-divider`）をそのまま使う。
- `AppShell.tsx`への変更に新規テストは追加しない（既存に土台が無いため）。この変更は自動テストの代わりに手動確認で担保する。

---

### Task 1: LandingPageコンポーネント

**Files:**
- Create: `dystopia/frontend/src/modules/landing/components/LandingPage.tsx`
- Test: `dystopia/frontend/src/modules/landing/components/LandingPage.test.tsx`

**Interfaces:**
- Produces: `export function LandingPage(): JSX.Element` — propsなし。`"use client"`ディレクティブは不要（stateもeffectも使わない静的マークアップのため、サーバー・クライアントいずれの親からも呼び出せる）。

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/frontend/src/modules/landing/components/LandingPage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("renders the age-gate CTA linking to /signup", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="/signup"');
    expect(html).toContain("18歳以上なので入室します");
  });

  it("renders the exit link pointing to an external site", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="https://www.google.com"');
  });

  it("renders a login link for existing users", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="/login"');
  });
});
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/landing/components/LandingPage.test.tsx`
Expected: FAIL — `LandingPage.tsx`が存在しないため、モジュール解決エラー（`Cannot find module './LandingPage'`相当）で落ちる。

- [ ] **Step 3: LandingPageを実装する**

`dystopia/frontend/src/modules/landing/components/LandingPage.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "投稿でつながる",
    body: "テキストや写真で日々を発信。フォロー・いいねで、気になる相手と自然につながれます。",
  },
  {
    title: "カルテで守られる安心",
    body: "トラブルや不安な相手の記録を残せる『カルテ』機能。キャストの安全を第一に考えた仕組みです。",
  },
  {
    title: "公開も非公開も、自分で選ぶ",
    body: "投稿は公開・非公開を自由に切り替え可能。見せたい相手にだけ、見せたいものを。",
  },
] as const;

export function LandingPage() {
  return (
    <main className="flex min-h-screen justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="text-center">
          <p className="text-2xl font-bold text-text-primary">dystopia.city</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-text-muted">
            The Ritual of Sovereign Love
          </p>
          <h1 className="mt-6 text-xl font-bold text-text-primary">
            誰にも縛られない、自分だけの物語を。
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            dystopia.cityは、キャストとゲストが本当の自分で繋がるためのSNSです。凍結の不安に怯えることなく、日々の投稿やカルテによる安全な記録で、あなたらしさを守りながら発信できます。
          </p>
        </header>

        <section className="mt-8 space-y-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-md border border-border bg-bg-secondary p-4"
            >
              <p className="font-bold text-text-primary">{feature.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <p className="mb-2 text-xs text-text-muted">こんな投稿が届きます</p>
          <article className="rounded-md border border-divider px-4 py-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-text-primary">Rin</span>
              <span className="text-text-secondary">@rin</span>
              <span className="text-text-muted">· 3分前</span>
            </div>
            <p className="mt-1 text-text-primary">
              今日はゆっくりお散歩日和。読みかけの本を続きから。📖
            </p>
            <div className="mt-3 flex items-center gap-1 text-sm text-text-secondary">
              <span aria-hidden="true">♡</span>
              <span>24</span>
            </div>
          </article>
        </section>

        <section className="mt-10 space-y-3 text-center">
          <Button asChild size="md" className="w-full">
            <Link href="/signup">18歳以上なので入室します →</Link>
          </Button>
          <a
            href="https://www.google.com"
            className="block text-sm text-text-muted hover:underline"
          >
            18歳未満の方はこちら
          </a>
        </section>

        <p className="mt-6 text-center text-sm text-text-secondary">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-accent hover:underline">
            ログイン
          </Link>
        </p>

        <footer className="mt-10 text-center text-xs text-text-muted">
          © 2026 dystopia.city
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: テストを実行し、通ることを確認する**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/landing/components/LandingPage.test.tsx`
Expected: PASS — 3 examples, 0 failures。

- [ ] **Step 5: 型チェック**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add dystopia/frontend/src/modules/landing/components/LandingPage.tsx dystopia/frontend/src/modules/landing/components/LandingPage.test.tsx
git commit -s -m "feat(dystopia/frontend): add unauthenticated landing page component"
```

---

### Task 2: AppShellでの未ログイン`/`分岐

**Files:**
- Modify: `dystopia/frontend/src/components/shell/AppShell.tsx:1-46`（import・`isAuthRoute`計算・redirect effect・hydration前後の分岐部分）

**Interfaces:**
- Consumes: `LandingPage`（Task 1で作成、`@/modules/landing/components/LandingPage`からの named export、propsなし）

- [ ] **Step 1: importと`isLandingRoute`を追加する**

`dystopia/frontend/src/components/shell/AppShell.tsx`の先頭のimport群に追加:

```tsx
import { LandingPage } from "@/modules/landing/components/LandingPage";
```

`isAuthRoute`の直後に追加:

```tsx
const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
const isLandingRoute = pathname === "/";
```

- [ ] **Step 2: redirect effectの条件を変更する**

変更前:

```tsx
  useEffect(() => {
    if (isHydrated && !viewerId && !isAuthRoute) {
      router.replace("/login");
    }
  }, [isHydrated, viewerId, isAuthRoute, router]);
```

変更後:

```tsx
  useEffect(() => {
    if (isHydrated && !viewerId && !isAuthRoute && !isLandingRoute) {
      router.replace("/login");
    }
  }, [isHydrated, viewerId, isAuthRoute, isLandingRoute, router]);
```

- [ ] **Step 3: hydration後・未ログイン時の分岐に`LandingPage`を追加する**

変更前:

```tsx
  // Hydrated but unauthenticated: auth routes render their own page; others wait for redirect.
  if (!viewerId) {
    return isAuthRoute ? <>{children}</> : null;
  }
```

変更後:

```tsx
  // Hydrated but unauthenticated: landing page on "/", auth routes render their own
  // page, others wait for redirect.
  if (!viewerId) {
    if (isLandingRoute) {
      return <LandingPage />;
    }
    return isAuthRoute ? <>{children}</> : null;
  }
```

hydration前の分岐（`if (!isHydrated) { return isAuthRoute ? <>{children}</> : null; }`）は変更しない。

- [ ] **Step 4: 型チェックと既存テストの回帰確認**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: エラーなし。

Run: `cd dystopia/frontend && pnpm exec vitest run`
Expected: 全件PASS（既存テスト＋Task 1の3件を含む）。

- [ ] **Step 5: 手動確認**

`cd dystopia/frontend && pnpm dev`でローカル起動し、ブラウザ（またはheadless chromeのスクリーンショット）で以下を確認する:

1. ブラウザのCookie/localStorageをクリアした状態（未ログイン）で`/`にアクセス → `LandingPage`が表示され、`/login`へのredirectが発生しないこと
2. `LandingPage`のメインCTA「18歳以上なので入室します →」を押す → `/signup`に遷移すること
3. `LandingPage`の「ログイン」リンクを押す → `/login`に遷移すること
4. ログイン済み状態で`/`にアクセス → 従来通りホームフィード（`HomePage`）が表示され、`LandingPage`は表示されないこと
5. 未ログイン状態で`/settings`等の非authルートにアクセス → 従来通り`/login`へredirectされること（`isLandingRoute`の追加が他ルートのredirect挙動を壊していないことの確認）

- [ ] **Step 6: コミット**

```bash
git add dystopia/frontend/src/components/shell/AppShell.tsx
git commit -s -m "feat(dystopia/frontend): show landing page on unauthenticated root route"
```
