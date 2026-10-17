# Dystopia Followers-only Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 非公開（`visibility: "private"`）の投稿を「フォロワーのみ」として、作者本人と承認済みのフォロワーに、プロフィールの投稿一覧・「フォロー中」・投稿詳細で見せる。投稿画面に公開範囲の説明を出す。

**Architecture:** 見られるかの判定を social の `FilterVisiblePosts` / `ViewerCanSeePost` に集約し、「プロフィールが鍵付き、または投稿がフォロワーのみ」ならフォローが要る、とする。post slice の「非公開は本人だけ」の判定は削除する。一覧の取得は、プロフィールの一覧（本人か承認済みのフォロワーのとき）と「フォロー中」だけ非公開を含める。メンションの通知は見られる人にだけ送る。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、Next.js（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-18-dystopia-followers-only-posts-design.md`

## Global Constraints

- DB の値（`"public"` / `"private"`）と proto は変えない。画面の文言だけを「フォロワーのみ」にする
- 見られるルール: ブロック（両方向）があれば本人以外は見られない。プロフィールが公開かつ投稿が公開なら全員。プロフィールが鍵付き、または投稿がフォロワーのみなら、本人と承認済み（`status: "approved"`）のフォロワーだけ。フォロー申請中は見られない
- 全国・エリア・検索・ハッシュタグ・ランキングには、フォロワーのみの投稿を出さない
- `visibility` を持たない投稿の参照（他 slice の構造体）は公開として扱う
- 投稿画面の説明（そのまま使う）: 公開アカウント×公開「誰でも見られます」／公開アカウント×フォロワーのみ「あなたとフォロワーだけが見られます」／鍵付き×公開「今は鍵付きのため、フォロワーだけに表示されます。鍵を外すと誰でも見られるようになります」／鍵付き×フォロワーのみ「あなたとフォロワーだけが見られます。鍵を外してもフォロワーのみのままです」
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` は付けない、末尾に `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証は `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`（`spec_helper` が billing の support spec 6 件も走らせる。失敗が見込まれる DB 操作は `db.transaction(savepoint: true)` で包む）
- frontend の検証は `cd dystopia/frontend && pnpm exec vitest run <paths>` と `pnpm exec tsc --noEmit`

## Review Focus

1. フォロー申請中（未承認）の人: プロフィールの一覧にも投稿詳細にも、フォロワーのみの投稿が出ない（Task 1 と Task 2 の spec で固定）
2. フォロワーのみの投稿のメディア: プロフィールの「メディア」タブでも、本人とフォロワーにだけ出る（Task 2 の spec で固定）
3. フォローを外した後: ブックマーク・いいねの一覧から、その人のフォロワーのみの投稿が消える（Task 2 の spec で固定）
4. 自分で自分をメンションしたフォロワーのみの投稿: 本人は見られるので通知のルールに従う（Task 3 の spec で固定）
5. 鍵付きアカウントで「公開」を選んだ投稿: 鍵付きの間はフォロワーだけに見え、全国・検索には出ない（Task 2 の spec で固定）

---

ブランチ `feat/dystopia-followers-only-posts`（#1564 の上に積んだもの）で作業する。spec の commit が乗っている。作業場所は `.worktrees/fix-dystopia-reply-render`。

### Task 1: Visibility rule in social

**Files:**
- Modify: `dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb`、`viewer_can_see_post.rb`
- Create: `dystopia/monolith/spec/slices/social/use_cases/post_visibility_spec.rb`

**Interfaces:**
- Produces: `FilterVisiblePosts#call(viewer_profile_id:, posts:)` と `ViewerCanSeePost#call(viewer_profile_id:, post:)` が、投稿の `visibility == "private"` をフォローが要る条件として扱う

- [ ] **Step 1: Write the failing spec** — `spec/slices/social/use_cases/post_visibility_spec.rb`

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "post visibility in social", type: :database do
  let(:filter) { Social::Slice["use_cases.filter_visible_posts"] }
  let(:can_see) { Social::Slice["use_cases.viewer_can_see_post"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:author) { create_account_with_profile(role: 2, username: "author") }
  let(:follower) { create_account_with_profile(username: "follower") }
  let(:pending) { create_account_with_profile(username: "pending") }
  let(:stranger) { create_account_with_profile(username: "stranger") }
  let(:post_ref) { Struct.new(:id, :author_profile_id, :visibility) }

  before do
    follow_repo.follow(follower_profile_id: follower, followee_profile_id: author, status: "approved")
    follow_repo.follow(follower_profile_id: pending, followee_profile_id: author, status: "pending")
  end

  def visible_to(viewer, post) = filter.call(viewer_profile_id: viewer, posts: [post]).any?

  it "shows a public post on a public profile to everyone" do
    post = post_ref.new("p1", author, "public")

    expect([visible_to(stranger, post), visible_to(nil, post), can_see.call(viewer_profile_id: stranger, post: post)]).to eq([true, true, true])
  end

  it "shows a followers-only post to the author and approved followers only" do
    post = post_ref.new("p2", author, "private")

    expect([author, follower, pending, stranger, nil].map { |viewer| visible_to(viewer, post) }).to eq([true, true, false, false, false])
    expect([author, follower, pending, stranger].map { |viewer| can_see.call(viewer_profile_id: viewer, post: post) }).to eq([true, true, false, false])
  end

  it "keeps a private profile's public posts to approved followers" do
    db[:profile__profiles].where(id: author).update(is_private: true)
    post = post_ref.new("p3", author, "public")

    expect([follower, stranger].map { |viewer| visible_to(viewer, post) }).to eq([true, false])
  end

  it "hides a followers-only post from a follower when either side blocks" do
    block_repo.block(blocker_profile_id: author, blocked_profile_id: follower)
    post = post_ref.new("p4", author, "private")

    expect(visible_to(follower, post)).to be false
    expect(can_see.call(viewer_profile_id: follower, post: post)).to be false
  end

  it "treats a post reference without a visibility as public" do
    ref = Struct.new(:author_profile_id).new(author)

    expect(filter.call(viewer_profile_id: stranger, posts: [ref]).length).to eq(1)
  end
end
```

`follow_repo.follow` と `block_repo.block` の引数名は `spec/slices/social/rpc_and_cross_slice_wiring_spec.rb` の呼び方に合わせる。

- [ ] **Step 2: Run to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/social/use_cases/post_visibility_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: 「followers-only post」の例が FAIL（フォロワーでない人にも見えてしまう）

- [ ] **Step 3: Implement**

`filter_visible_posts.rb`: `next true unless profile_by_author[author_profile_id].is_private` を `next true unless follow_required?(profile_by_author[author_profile_id], post)` に替え、private に追加する。

```ruby
      def follow_required?(profile, post)
        profile.is_private || (post.respond_to?(:visibility) && post.visibility == "private")
      end
```

`viewer_can_see_post.rb`: `return true unless profile.is_private` を `return true unless follow_required?(profile, post)` に替え、同じ `follow_required?` を private に追加する。

- [ ] **Step 4: Run the spec and the social specs**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/social spec/slices/post/cross_slice_wiring_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: 0 failures

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/social dystopia/monolith/spec/slices/social/use_cases/post_visibility_spec.rb
git commit -s -m "feat(dystopia): let approved followers see followers-only posts

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 2: Lists, detail and feed

**Files:**
- Modify: `dystopia/monolith/slices/post/grpc/handler.rb`（`find_readable_post`）、`slices/post/use_cases/posts/list_readable_post_ids.rb`
- Modify: `dystopia/monolith/slices/post/repositories/post_repository.rb`（`list_posts` に `include_private:`、`list_public_post_ids` を `list_post_ids` に改名して `include_private:`）
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`（`list_posts`）
- Modify: `dystopia/monolith/slices/feed/use_cases/list_feed.rb`
- Modify/Create: `dystopia/monolith/spec/slices/post/grpc/post_handler_spec.rb`、`spec/slices/feed/use_cases/list_feed_spec.rb`（新規）、`spec/slices/post/repositories/post_repository_spec.rb`（`list_public_post_ids` を参照していれば改名）

**Interfaces:**
- Consumes: Task 1 のルール
- Produces: `PostRepository#list_posts(limit:, cursor:, author_profile_id:, media_only:, include_private: false)`、`#list_post_ids(limit:, cursor:, author_profile_ids:, excluded_author_profile_ids:, include_private: false)`

- [ ] **Step 1: Write failing specs**

`spec/slices/post/grpc/post_handler_spec.rb` に、既存の helper（`act_as` などの呼び方）に合わせて次の例を足す。作者 `author`（公開プロフィール）がフォロワーのみの投稿 `secret` と公開の投稿 `open` を作り、フォロワーのみの投稿にはメディアも付ける。

- `list_posts`（作者指定）: 本人と承認済みのフォロワーには `secret` と `open` が出る。フォロワーでない人と申請中の人には `open` だけ
- `list_posts`（作者指定、`media_only: true`）: フォロワーには `secret` が出て、フォロワーでない人には出ない
- `get_post`: フォロワーは `secret` を取得でき、申請中の人とフォロワーでない人は NOT_FOUND
- 鍵付きのプロフィールで「公開」の投稿: フォロワーには出て、フォロワーでない人には出ない（作者のプロフィールの一覧で）

`spec/slices/feed/use_cases/list_feed_spec.rb`（新規）:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Feed::UseCases::ListFeed", type: :database do
  let(:uc) { Feed::UseCases::ListFeed.new }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:author) { create_account_with_profile(role: 2, username: "author") }
  let(:viewer) { create_account_with_profile(username: "viewer") }

  it "puts followers-only posts in the following feed and keeps them out of the all feed" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: author, status: "approved")
    secret = post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private")
    open = post_repo.create_post(author_profile_id: author, content: "everyone", visibility: "public")

    following = uc.call(filter: "following", viewer_profile_id: viewer)[:post_ids]
    all = uc.call(filter: "all", viewer_profile_id: viewer)[:post_ids]

    expect(following).to contain_exactly(secret.id.to_s, open.id.to_s)
    expect(all).to eq([open.id.to_s])
  end

  it "leaves a pending follower's following feed without followers-only posts" do
    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: author, status: "pending")
    post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private")

    expect(uc.call(filter: "following", viewer_profile_id: viewer)[:post_ids]).to eq([])
  end
end
```

`ListFeed` の `call` の戻り値のキーと引数（`prefecture:` など）は既存の実装に合わせる。`create_post` の戻り値の id の型（文字列か）は `post_repository_spec.rb` の使い方に合わせる。

ブックマーク・いいねの一覧（Review Focus 3）: `spec/slices/post/grpc/post_handler_spec.rb` か、いいね・ブックマークの一覧の spec に、フォロワーがフォロワーのみの投稿にいいねしたあとフォローを外すと、いいねの一覧（`list_liked_posts_by_profile` を通る RPC）から消える例を足す。

検索・ランキング（Global Constraints）: `spec/slices/discovery` の検索の spec に、フォロワーのみの投稿がフォロワーの検索結果にも出ない例を足す。

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post spec/slices/feed spec/slices/discovery > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
Expected: 新しい例のうち、プロフィールの一覧・フォロー中・1 件取得のフォロワーの例が FAIL

- [ ] **Step 2: Remove the author-only checks**

- `grpc/handler.rb` の `find_readable_post` から `return nil if post.visibility == "private" && post.author_profile_id != current_profile_id` を削除する
- `use_cases/posts/list_readable_post_ids.rb` から `posts = posts.reject { |post| post.visibility == "private" && post.author_profile_id != viewer_profile_id }` を削除する

- [ ] **Step 3: Repository**

`post_repository.rb`:

- `list_posts` の引数に `include_private: false` を足し、`.where(visibility: "public")` を、`include_private` が false のときだけかける形にする

```ruby
      def list_posts(limit: 20, cursor: nil, author_profile_id: nil, media_only: false, include_private: false)
        scope = posts.combine(:post_media, :hashtags, :post_mentions).exclude(author_profile_id: nil)
        scope = scope.where(visibility: "public") unless include_private
        scope = scope.where(author_profile_id: author_profile_id) if author_profile_id
```

  （以降は今のまま）
- `list_public_post_ids` を `list_post_ids` に改名し、`include_private: false` を足して同じ形にする

```ruby
      def list_post_ids(limit: 20, cursor: nil, author_profile_ids: nil, excluded_author_profile_ids: [], include_private: false)
        return [] if !author_profile_ids.nil? && author_profile_ids.empty?

        scope = posts.dataset
        scope = scope.where(visibility: "public") unless include_private
```

  （以降は今のまま）。`/usr/bin/grep -rn "list_public_post_ids" dystopia/monolith` で出る呼び出しと spec をすべて `list_post_ids` にする

- [ ] **Step 4: Handler and feed**

`grpc/post_handler.rb` の `list_posts`: `post_repo.list_posts(...)` の呼び出しに `include_private: author_profile_id ? followers_only_readable?(author_profile_id) : false` を足し、private に追加する。

```ruby
      def followers_only_readable?(author_profile_id)
        return true if author_profile_id == current_profile_id
        return false unless current_profile_id

        follow_repo.find(follower_profile_id: current_profile_id, followee_profile_id: author_profile_id)&.status == "approved"
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
```

（handler にすでに `follow_repo` があればそれを使う。ブロックと鍵付きの判定は、続く `filter_visible_posts` が行う）

`feed/use_cases/list_feed.rb`: `post_repo.list_public_post_ids(` を `post_repo.list_post_ids(` にし、引数に `include_private: filter == "following"` を足す。

- [ ] **Step 5: Run the specs, the whole suite, and commit**

Run: Step 1 と同じあと、`HANAMI_ENV=test bundle exec rspec > <scratchpad>/rspec.log 2>&1; tail -5 <scratchpad>/rspec.log`
Expected: 0 failures

```bash
git add dystopia/monolith
git commit -s -m "feat(dystopia): list followers-only posts on the profile and the following feed

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 3: Mention notifications only to people who can see the post

**Files:**
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`（`save_post` のメンションの通知）
- Modify: `dystopia/monolith/slices/post/use_cases/comments/add_comment.rb`（メンションの通知）
- Modify: `spec/slices/post/grpc/post_handler_spec.rb`、`spec/slices/post/grpc/comment_handler_spec.rb`（または `add_comment` の use case の spec）

**Interfaces:**
- Consumes: `Social::Slice["use_cases.viewer_can_see_post"].call(viewer_profile_id:, post:)`

- [ ] **Step 1: Write failing specs**

- `post_handler_spec.rb`: 作者がフォロワーのみの投稿でフォロワー `follower` とフォロワーでない `stranger` をメンションすると、`notifications__notifications` に `follower` 宛ての `mention` が 1 件でき、`stranger` 宛てはできない。公開の投稿なら両方にできる
- `comment_handler_spec.rb`（または `add_comment` の spec）: フォロワーのみの投稿へのコメントで同じことを確かめる
- 本人をメンションした場合（Review Focus 4）: 本人宛ての通知の扱いは今の挙動（`Notifications::UseCases::Emit` が自分宛てを作らないなら作らない）のままで、このタスクの判定が本人を落とさないこと

通知の行の確かめ方は、既存の spec でメンションの通知を見ている箇所（`/usr/bin/grep -rn "mention" spec/slices/post`）に合わせる。

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: `stranger` 宛ての通知ができてしまい FAIL

- [ ] **Step 2: Filter the mentioned profiles**

`post_handler.rb` の `save_post` の `mentions.uniq { |mention| mention[:profile_id] }.each do |mention|` を次にする（`viewer_can_see_post` は `grpc/handler.rb` にある）。

```ruby
          mentions.uniq { |mention| mention[:profile_id] }
            .select { |mention| viewer_can_see_post.call(viewer_profile_id: mention[:profile_id], post: post) }
            .each do |mention|
```

`add_comment.rb`: メンションの `each` の前に同じ `.select` を入れる。`viewer_can_see_post` を private メソッドとして足す。

```ruby
        def viewer_can_see_post
          @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
        end
```

- [ ] **Step 3: Run the post specs and commit**

Run: Step 1 と同じ
Expected: 0 failures

```bash
git add dystopia/monolith
git commit -s -m "feat(dystopia): skip mention notifications for people who cannot see the post

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 4: Composer wording and note

**Files:**
- Modify: `dystopia/frontend/src/modules/post/components/PostComposer.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostComposer.test.tsx`

**Interfaces:**
- Consumes: `useProfile()`（`@/modules/profile/hooks`）の `profile?.isPrivate`

- [ ] **Step 1: Write the failing tests** — `PostComposer.test.tsx` に追加する

```tsx
const profileMock = vi.hoisted(() => ({ profile: null as { isPrivate: boolean } | null }));
vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: profileMock.profile }) }));

describe("PostComposer visibility", () => {
  const render = (accountPrivate: boolean, visibility: "public" | "private") => {
    profileMock.profile = { isPrivate: accountPrivate };
    return renderToStaticMarkup(<PostComposer onSubmit={async () => {}} initialVisibility={visibility} />);
  };

  it("labels the switch with followers only", () => {
    const html = render(false, "private");

    expect(html).toContain('aria-label="フォロワーのみ"');
    expect(html).toContain(">フォロワーのみ<");
    expect(html).not.toContain("非公開");
  });

  it("explains each visibility for a public account", () => {
    expect(render(false, "public")).toContain("誰でも見られます");
    expect(render(false, "private")).toContain("あなたとフォロワーだけが見られます");
  });

  it("explains each visibility for a private account", () => {
    expect(render(true, "public")).toContain("今は鍵付きのため、フォロワーだけに表示されます。鍵を外すと誰でも見られるようになります");
    expect(render(true, "private")).toContain("あなたとフォロワーだけが見られます。鍵を外してもフォロワーのみのままです");
  });
});
```

`vi.mock` と `vi.hoisted` はファイルの先頭（既存の `vi.mock` の隣）に置く。

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/post/components/PostComposer.test.tsx`
Expected: FAIL

- [ ] **Step 2: Implement**

`PostComposer.tsx`:

- `import { useProfile } from "@/modules/profile/hooks";` を足し、本体の先頭で `const { profile } = useProfile();` と `const accountPrivate = !!profile?.isPrivate;` を作る
- 切替を `<Toggle checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="フォロワーのみ" />` に、ラベルを `<span>{isPrivate ? "フォロワーのみ" : "公開"}</span>` にする
- 切替と文字数の行（`<div className="mt-2 flex items-center justify-between gap-3">`）の直後に説明を足す

```tsx
      <p className="mt-1 text-xs text-text-secondary">{visibilityNote(accountPrivate, isPrivate)}</p>
```

- ファイルの末尾（コンポーネントの外）に追加する

```tsx
function visibilityNote(accountPrivate: boolean, followersOnly: boolean): string {
  if (followersOnly) {
    return accountPrivate
      ? "あなたとフォロワーだけが見られます。鍵を外してもフォロワーのみのままです"
      : "あなたとフォロワーだけが見られます";
  }
  return accountPrivate
    ? "今は鍵付きのため、フォロワーだけに表示されます。鍵を外すと誰でも見られるようになります"
    : "誰でも見られます";
}
```

- [ ] **Step 3: Run all frontend checks and commit**

Run: `cd dystopia/frontend && pnpm exec vitest run > <scratchpad>/vitest.log 2>&1; /usr/bin/grep -E "×|FAIL|Tests |Test Files" <scratchpad>/vitest.log | head; pnpm exec tsc --noEmit; echo "tsc exit=$?"`
Expected: 全件 PASS、tsc exit 0。`非公開投稿` を期待している既存のテスト（`PostComposer.submit.test.tsx` など）があれば「フォロワーのみ」に直す

```bash
git add -A dystopia/frontend/src
git commit -s -m "feat(dystopia): call private posts followers-only and explain it in the composer

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 5: End-to-end check and the PR

- [ ] **Step 1: Run the suites**

Run: monolith の全 rspec、frontend の全 vitest と tsc
Expected: 0 failures、全件 PASS、tsc exit 0

- [ ] **Step 2: Check it in the running app**

memory の `reference_local_e2e_run.md` の手順で起動し、次を確かめてスクリーンショットを `<scratchpad>` に保存する。起動したプロセスは最後に止め、使い捨て DB を消し、ポートが空いたことを確かめ、`git status` を clean にする。
1. 公開アカウントでフォロワーのみの投稿をすると、本人のプロフィールに出る
2. 承認済みのフォロワーのプロフィールの閲覧と「フォロー中」に出る。フォロワーでない人には出ず、投稿詳細も開けない
3. フォロワーがいいね・コメントできる
4. 全国のタイムラインに出ない
5. 投稿画面の説明が、アカウントの鍵の状態と選択に応じて 4 通りに変わる

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-profile-name --title "feat(dystopia): show followers-only posts to followers" --body-file <scratchpad>/pr.md
gh stack submit --auto
```

`<scratchpad>/pr.md`: Why（非公開の投稿は一覧のどこにも出ず、本人も URL を直接開かないと見られなかった）、What（ルール、出す場所、メンションの通知、文言と説明）、Verification（Step 1・Step 2 の結果）、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL。
