# Dystopia Post Quote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投稿を引用して通常の投稿として作成でき、元の投稿から引用を辿れて、元の投稿者に通知が届くようにする。

**Architecture:** `post.posts` に `quoted_post_id` を足し、引用投稿を通常の投稿の行として持つ。
引用枠と引用数は投稿を返す 2 つの経路（`PostHandler` と `ListPostsByIds`）で共通の use case から組み立て、閲覧者ごとに判定する。
frontend は `PostCardBinding` に引用アイコンと枠を足し、詳細のコメント欄をコメントと引用のタブに分ける。

**Tech Stack:** Hanami 2 / ROM-SQL / Sequel、gruf（gRPC）、buf、Next.js 16、SWR、zustand、vitest、rspec。

**Spec:** `docs/superpowers/specs/2026-11-01-dystopia-post-quote-design.md`

## Global Constraints

- 作業場所は worktree `.worktrees/feat-post-quote`、ブランチは `feat/post-quote`。
- コードのコメントは英語で 1 行まで、Why not だけを書き、タスクや修正に言及しない。
- commit は `git commit -s` で行い、`Co-Authored-By` を付けない。
- 新しい依存を追加しない（`Repeat2` は既存の `lucide-react` にある）。
- 本文の上限は 1000 文字、引用できない投稿のエラー文言は「この投稿は引用できません」、見られない枠の文言は「この投稿は表示できません」。
- monolith の検証は `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <path> > <scratch file> 2>&1` で行い、出力は file で確認する（CI は rspec を回さない）。
- frontend の型検査は `cd dystopia/frontend && pnpm exec tsc --noEmit --incremental false` で行い、exit code をパイプせずに取る。
- `pnpm lint` は現在動かないので使わない。
- `bin/codegen` と `pnpm proto:gen` は無関係な stub にも差分を出すので、`post` と `notifications` の stub だけ commit する。
  - billing の未追跡 stub が出たら消す。
- 文言を一括で置き換えたら、diff の追加行を日本語として読む。

## Review Focus

1. 閲覧者が引用元を見られないとき（ブロック、削除、表示終了、無効化）: レスポンスの `quoted_post` に `available: false` 以外の値が入らず、中身も ID も漏れない（Task 2 のテスト）。
2. 閲覧者ごとの引用数と引用タブの件数のずれ: SQL の集計と `FilterVisiblePosts` が同じ結果を返す（Task 2 の閲覧者の組み合わせのテスト）。
3. 不正な `quoted_post_id`（UUID でない文字列）: 500 にならず 400 の「この投稿は引用できません」を返す（Task 1 のテスト）。
4. 作成画面を開いている間に引用元が消されたとき: 投稿ボタンでエラー文言が出て、書いた本文は残る（Task 5 のテスト）。
5. 本文が空のお知らせ投稿を引用したとき: 枠に空行を出さず、予定の表示だけを出す（Task 5 のテスト）。

---

### Task 1: Create a quote post

proto の変更をここでまとめて行い、stub の再生成を 1 回で済ませる。

**Files:**
- Modify: `proto/dystopia/post/v1/post_service.proto`
- Modify: `proto/dystopia/notifications/v1/notification_service.proto`
- Modify: `dystopia/monolith/stubs/post/v1/*`、`dystopia/monolith/stubs/notifications/v1/*`（生成物）
- Modify: `dystopia/frontend/src/stub/post/v1/*`、`dystopia/frontend/src/stub/notifications/v1/*`（生成物）
- Create: `dystopia/monolith/config/db/migrate/20261106000000_add_quoted_post_id_to_posts.rb`
- Modify: `dystopia/monolith/slices/post/relations/posts.rb`
- Modify: `dystopia/monolith/slices/post/repositories/post_repository.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/create_post.rb`
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`
- Test: `dystopia/monolith/spec/slices/post/use_cases/create_post_spec.rb`

**Interfaces:**
- Produces: proto の `post.v1.QuotedPost`、`Post.quoted_post`、`Post.quotes_count`、`SavePostRequest.quoted_post_id`、`rpc ListPostQuotes`、`NOTIFICATION_TYPE_QUOTE`、`NotificationPreferences.quote`。
- Produces: `PostRepository#find_quotable(id) -> post struct | nil`。
- Produces: `CreatePost#call(..., quoted_post_id: "")`。戻り値の `:post` は `quoted_post_id` を持つ。

- [ ] **Step 1: Prepare the worktree**

Run: `cd dystopia/monolith && bundle install` と `cd dystopia/frontend && pnpm install`
Expected: どちらも成功する。

- [ ] **Step 2: Write the failing tests in `create_post_spec.rb`**

`describe "quoting"` に次のテストを足す。
エラーはすべて `raise_error(invalid, "この投稿は引用できません")` で確かめ、`db[:post__posts].where(author_profile_id: author).count` が増えないことも確かめる。

```ruby
it "saves the quoted post id on a public live post"
it "quotes a post of a locked profile"
it "quotes the quoter's own public live post"
it "quotes a post that is itself a quote"
it "rejects a post that does not exist"
it "rejects a value that is not a UUID"
it "rejects a followers-only post, even the quoter's own"
it "rejects a scheduled post and an expired post, even the quoter's own"
it "rejects a post of a profile in a block relation in either direction"
it "requires a body on a quote post"
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/create_post_spec.rb > <scratch file> 2>&1`
Expected: 新しいテストが `unknown keyword: :quoted_post_id` で失敗する。

- [ ] **Step 4: Change the protos**

`post_service.proto`:

```proto
service PostService {
  rpc ListPostQuotes(ListPostQuotesRequest) returns (ListPostsResponse);
}

message QuotedPost {
  bool available = 1;
  string id = 2;
  profile.v1.ProfileSummary author = 3;
  string content = 4;
  repeated PostMedia media = 5;
  string published_at = 6;
  schedule.v1.Schedule schedule = 7;
  repeated PostMention mentions = 8;
  repeated string hashtags = 9;
}

message ListPostQuotesRequest {
  string post_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
```

`Post` に `QuotedPost quoted_post = 17;` と `int32 quotes_count = 18;`、`SavePostRequest` に `string quoted_post_id = 8;` を足す。

`notification_service.proto`:
- `NotificationType` に `NOTIFICATION_TYPE_QUOTE = 7;` を足す。
- `NotificationPreferences` の `reserved` の名前から `"quote"` だけを外し、番号の `reserved 1, 4, 5, 10;` は残したまま `bool quote = 13;` を足す。
  - 番号 5 は過去の `quote` のもので、再利用すると古いデータと衝突するため新しい番号にする。

- [ ] **Step 5: Regenerate the stubs**

Run: `cd dystopia/monolith && bin/codegen` と `cd dystopia/frontend && pnpm proto:gen`
Expected: `git status` で `post` と `notifications` 以外の stub に差分があれば `git checkout` で戻し、billing の未追跡 stub は消す。

- [ ] **Step 6: Add the migration and the relation attribute**

`20261106000000_add_quoted_post_id_to_posts.rb` は `post__posts` に NULL 可の `uuid` 列 `quoted_post_id` を足し、`idx_post_posts_quoted_post_id` を `[:quoted_post_id, Sequel.desc(:published_at), Sequel.desc(:id)]` に `where: Sequel.~(quoted_post_id: nil)` で張る。
外部キーは張らない。
`down` は index と列を消す。
`relations/posts.rb` に `attribute :quoted_post_id, Types::String.optional` を足す。

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: 列ができる（test 環境の `pg_dump` の version mismatch は無視してよい）。

- [ ] **Step 7: Implement `PostRepository#find_quotable(id)` and `CreatePost`**

`find_quotable` は `visibility: "public"` と `live_condition` を満たす行だけを返す。
`CreatePost#call` に `quoted_post_id: ""` を足す。
- 空文字なら従来どおり。
- `::Concerns::CursorPagination::UUID_FORMAT` に合わなければ `InvalidPostError`。
- `find_quotable` が nil、または `viewer_can_see_post` が author に対して false なら `InvalidPostError`。
- `post_repo.create_post` に `quoted_post_id` を渡す。

`PostHandler#save_post` は `quoted_post_id: m.quoted_post_id` を渡す。

- [ ] **Step 8: Run the tests to verify they pass**

Run: Step 3 と同じコマンド。
Expected: `create_post_spec.rb` が全部通る。

- [ ] **Step 9: Commit**

```bash
git add proto dystopia/monolith/stubs/post dystopia/monolith/stubs/notifications dystopia/frontend/src/stub/post dystopia/frontend/src/stub/notifications dystopia/monolith/config/db/migrate dystopia/monolith/slices/post dystopia/monolith/spec/slices/post/use_cases/create_post_spec.rb
git commit -s -m "feat(dystopia/monolith): create a post that quotes another post"
```

### Task 2: Present quote frames, quote counts, and the quote list

**Files:**
- Create: `dystopia/monolith/slices/post/use_cases/posts/build_quote_context.rb`
- Modify: `dystopia/monolith/slices/post/repositories/post_repository.rb`
- Modify: `dystopia/monolith/slices/post/presenters/post_presenter.rb`
- Modify: `dystopia/monolith/slices/post/grpc/post_handler.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/posts/list_posts_by_ids.rb`
- Create: `dystopia/monolith/spec/slices/post/grpc/quoted_post_spec.rb`
- Test: `dystopia/monolith/spec/slices/post/repositories/post_repository_spec.rb`

**Interfaces:**
- Consumes: Task 1 の proto と `quoted_post_id`。
- Produces: `PostRepository#quotes_count_batch(post_ids:, viewer_profile_id:) -> Hash{post_id => Integer}`。
- Produces: `PostRepository#list_quotes(post_id:, limit:, cursor:) -> Array<post struct>`（`limit + 1` 件、`published_at` と `id` の降順）。
- Produces: `Post::UseCases::Posts::BuildQuoteContext#call(posts:, viewer_profile_id:) -> { quotes_counts: Hash, quoted_posts: Hash{String => QuotedPost} }`。
- Produces: `PostPresenter.to_post_proto(..., quotes_count: 0, quoted_posts: {})`。

- [ ] **Step 1: Write the failing tests in `quoted_post_spec.rb`**

`pinned_post_spec.rb` の `rpc` と `act_as` を手本に、`get_post`・`list_posts`・`ListPostsByIds` を通して確かめる。

```ruby
it "returns the frame with author, body, media, and schedule when the viewer can see the original"
it "does not nest a frame inside a frame"
it "returns only available: false when the original was deleted"
it "returns only available: false when the original expired"
it "returns only available: false when the viewer and the original author block each other in either direction"
it "returns only available: false when the original author is disabled or the account is deactivated"
it "keeps the frame visible to a third party after the original author blocks the quoter"
it "shows the updated words when an announcement is saved again and hides the frame after the announcement is deleted"
it "leaves quoted_post empty on a post that is not a quote"
it "returns the same quote fields from ListPostsByIds as from list_posts"
```

「available: false」のテストは `expect(frame.to_h).to eq(Post::V1::QuotedPost.new(available: false).to_h)` で確かめる。

引用数と一覧については、次の閲覧者ごとに `quotes_count` と `ListPostQuotes` の件数が一致することを同じテストで確かめる。
閲覧者: 他人、承認済みフォロワー、承認待ち、引用した本人、引用者をブロックした人、引用者にブロックされた人。
引用の種類: 全員、フォロワーのみ、予約中、表示終了、投稿者が無効、投稿者のアカウントが退会中。

```ruby
it "counts the quotes each viewer can list"
it "orders quotes newest first and pages them with a cursor"
it "fills a page when quotes are filtered out"
it "returns NOT_FOUND from ListPostQuotes when the viewer cannot see the original"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/grpc/quoted_post_spec.rb > <scratch file> 2>&1`
Expected: `quoted_post` と `quotes_count` が空で失敗する。

- [ ] **Step 3: Implement `quotes_count_batch` and `list_quotes`**

`quotes_count_batch` は行を読み込まず、1 回の SQL で集計する。
`FilterVisiblePosts` と同じ条件を次の形で書く。

```ruby
db = posts.dataset.db
visible_authors = db[:profile__profiles].where(disabled_at: nil, account_id: db[:identity__accounts].where(deactivated_at: nil).select(:id)).select(:id)
others = live_condition & Sequel[author_profile_id: visible_authors]
readable = Sequel[visibility: "public"]
readable |= Sequel[author_profile_id: db[:social__follows].where(follower_profile_id: viewer_profile_id, status: "approved").select(:followee_profile_id)]
others &= ~Sequel[author_profile_id: db[:social__blocks].where(blocker_profile_id: viewer_profile_id).select(:blocked_profile_id)]
others &= ~Sequel[author_profile_id: db[:social__blocks].where(blocked_profile_id: viewer_profile_id).select(:blocker_profile_id)]
condition = (others & readable) | Sequel[author_profile_id: viewer_profile_id]
```

`viewer_profile_id` が nil のときは、`others & Sequel[visibility: "public"]` だけを条件にする。
`Sequel[author_profile_id: nil]` は `IS NULL` になり、投稿者のいない行に一致してしまうため。

メソッドの上に、次の意図の 1 行コメントを英語で書く: 引用の多い投稿の行を読み込まないために `FilterVisiblePosts` を SQL で写している。
`scope.unordered.group_and_count(:quoted_post_id).to_hash(:quoted_post_id, :count)` で返す。

`list_quotes` は `list_posts` と同じ `combine` と cursor の条件で、`quoted_post_id: post_id` の行を返す。

- [ ] **Step 4: Implement `BuildQuoteContext` and the presenter**

`BuildQuoteContext` は次を行う。
- `posts` の `quoted_post_id` の集合を `post_repo.find_by_ids` で読む。
- `Social::Slice["use_cases.filter_visible_posts"]` で絞る。
- 投稿者（`summarize_profiles`）、media（`Post::Adapters::MediaAdapter#find_by_ids`）、予定（`ScheduleAdapter#find_by_post_ids`）、メンションのユーザー名を読む。
- `PostPresenter.to_quoted_post_proto` で `quoted_posts` を組み立てる。
- `post_repo.quotes_count_batch` で `quotes_counts` を求める。

`to_quoted_post_proto` の `available` は true で、枠の中に引用元の `quoted_post` は入らない（proto に場がない）。
`to_post_proto` は `post.quoted_post_id` があるとき `quoted_posts[id] || ::Post::V1::QuotedPost.new(available: false)` を返し、ないときは nil を返す。

- [ ] **Step 5: Use the context from every post response and add the RPC**

`PostHandler#present_posts`・`present_post`・`ListPostsByIds#call` が `BuildQuoteContext` を 1 回呼び、`quotes_count:` と `quoted_posts:` を presenter に渡す。
`rpc :ListPostQuotes, ::Post::V1::ListPostQuotesRequest, ::Post::V1::ListPostsResponse` と `list_post_quotes` を足す。
`list_post_quotes` は `find_readable_post(post_id)` が nil なら `NOT_FOUND` を返し、それ以外は `list_posts` と同じく `::Concerns::VisiblePage.fill` と `filter_visible_posts` と `present_posts` で返す。

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post spec/slices/feed spec/slices/bookmarks spec/slices/discovery > <scratch file> 2>&1`
Expected: 全部通る。

- [ ] **Step 7: Commit**

```bash
git add dystopia/monolith/slices/post dystopia/monolith/spec/slices/post
git commit -s -m "feat(dystopia/monolith): present quote frames, counts, and the quote list"
```

### Task 3: Notify the quoted author

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261106000001_add_quote_to_notification_preferences.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/create_post.rb`
- Modify: `dystopia/monolith/slices/notifications/repositories/notification_repository.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/get_preferences.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/send_push.rb`
- Modify: `dystopia/monolith/slices/notifications/use_cases/build_push_message.rb`
- Modify: `dystopia/monolith/slices/notifications/grpc/notification_handler.rb`
- Test: `dystopia/monolith/spec/slices/post/use_cases/create_post_spec.rb`
- Test: `dystopia/monolith/spec/slices/notifications/`（`build_push_message`・`send_push`・`notification_handler` の既存 spec）

**Interfaces:**
- Consumes: Task 1 の `CreatePost` と proto の `NOTIFICATION_TYPE_QUOTE`・`quote`。
- Produces: 通知の種類 `"quote"`（`target_resource_id` と `target_post_id` は元の投稿の ID）。

- [ ] **Step 1: Write the failing tests**

```ruby
it "notifies the original author once with the type quote, targeting the original post"
it "aggregates quotes of the same post into one row"
it "does not notify when quoting one's own post"
it "does not notify for a scheduled quote, at creation or after it goes live"
it "does not notify when the original author cannot read a followers-only quote"
it "does not notify when the original author blocks the quoter"
it "sends both a mention and a quote notification when the quote mentions the original author"
```

`build_push_message` のテスト: `kind: "quote"` の本文は「あなたの投稿を引用しました：<抜粋>」、遷移先は `/posts/<id>?tab=quotes` になる。
`send_push` のテスト: `quote` の設定が off なら送らない。
`notification_handler` のテスト: `"quote"` が `NOTIFICATION_TYPE_QUOTE` になり、設定の `quote` が読み書きできて、初期値は true になる。

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/post/use_cases/create_post_spec.rb spec/slices/notifications > <scratch file> 2>&1`
Expected: 新しいテストが失敗する。

- [ ] **Step 3: Implement**

- migration は `notifications__preferences` に `add_column :quote, :boolean, null: false, default: true` を足す（`down` で消す）。
- `PREFERENCE_COLUMNS`・`DEFAULT_PREFERENCES`・`PREFERENCE_FIELD_BY_KIND`（`"quote" => :quote`）・handler の `update_notification_preferences` と `preferences_to_proto`・種類の変換に `quote` を足す。
- `BuildPushMessage::ACTIONS` に `"quote" => "あなたの投稿を引用しました"` を足し、`path` の分岐で `quote` を `"/posts/#{segment(post_id)}?tab=quotes"` にする（`post_id` がなければ `FALLBACK_PATH`）。
- `CreatePost` は `published_at <= now` のときだけ、元の投稿者が `post` を読める場合に `notifications_emit.call(recipient_profile_id: quoted.author_profile_id, type: "quote", target_resource_id: quoted.id, actor_profile_id: author_profile_id, target_post_id: quoted.id, excerpt: post.content)` を呼ぶ。
  - 判定は `mention_visible?` を `readable_by?(profile_id, post)` に改名して共用する。

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: 列ができる。

- [ ] **Step 4: Run the tests to verify they pass**

Run: Step 2 と同じコマンド。
Expected: 全部通る。

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/config/db/migrate dystopia/monolith/slices dystopia/monolith/spec/slices
git commit -s -m "feat(dystopia/monolith): notify the author of a quoted post"
```

### Task 4: Frontend views, API route, and notifications

**Files:**
- Modify: `dystopia/frontend/src/modules/post/lib/post-view.ts`
- Modify: `dystopia/frontend/src/modules/post/lib/post-mappers.ts`
- Create: `dystopia/frontend/src/modules/post/lib/quotable.ts`
- Create: `dystopia/frontend/src/app/api/posts/[id]/quotes/route.ts`
- Create: `dystopia/frontend/src/modules/post/hooks/useQuotes.ts`
- Modify: `dystopia/frontend/src/modules/notifications/lib/format.ts`
- Modify: `dystopia/frontend/src/modules/notifications/types.ts`
- Modify: `dystopia/frontend/src/modules/notifications/hooks/useNotificationPreferences.ts`
- Modify: `dystopia/frontend/src/app/api/notifications/preferences/route.ts`
- Modify: `dystopia/frontend/src/modules/notifications/components/NotificationSettings.tsx`
- Test: `dystopia/frontend/src/modules/post/lib/quotable.test.ts`、`dystopia/frontend/src/modules/post/lib/post-mappers.test.ts`
- Test: `dystopia/frontend/src/app/api/posts/[id]/quotes/route.test.ts`
- Test: `dystopia/frontend/src/modules/notifications/lib/format.test.ts`、`NotificationSettings.test.tsx`、`app/api/notifications/preferences/route.test.ts`

**Interfaces:**
- Consumes: Task 1 の TS stub。
- Produces: `PostView.quotedPost: QuotedPostView | null` と `PostView.quotesCount: number`。
- Produces: `QuotedPostView = { available: boolean; id: string; author: ProfileSummaryView | null; content: string; media: PostMediaView[]; publishedAt: string; schedule: PostScheduleView | null; mentions: MentionView[]; hashtags: string[] }`。
- Produces: `SavePostPayload.quotedPostId?: string`。
- Produces: `isQuotable(post: Pick<PostView, "visibility" | "publishedAt" | "expiresAt">, now?: Date): boolean`。
- Produces: `useQuotes(postId: string)` は `{ posts, hasMore, loading, error, loadMore, refresh }` を返す（`useAuthorPosts` と同じ形）。
- Produces: `GET /api/posts/:id/quotes?limit&cursor` は `PostsListView` を返す。

- [ ] **Step 1: Write the failing tests**

```ts
it("is quotable only when public and live")
it("is not quotable when followers-only, scheduled, or expired")
it("maps a quoted post, an unavailable quoted post, and no quoted post")
it("sends quotedPostId in the save request")
it("returns the quotes of a post from the quotes route")
it("describes a quote notification with the others count")
it("routes a quote notification to the post's quotes tab")
it("lists the quote toggle in notification settings")
```

`NotificationSettings.test.tsx` は `lists the device switch and the six kinds` を七種類に変え、ラベルの一覧に「引用」を足し、`removed` の一覧から「引用」を外す。

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/lib src/app/api/posts src/modules/notifications src/app/api/notifications`
Expected: 新しいテストが失敗する。

- [ ] **Step 3: Implement**

- `isQuotable` は `visibility === "public" && displayStateOf(post, now) === "live"`。
- `mapPostToView` は `quotedPost` と `quotesCount` を写し、`buildSavePostRequest` は `quotedPostId: payload.quotedPostId || ""` を足す。
- `route.ts` は `app/api/posts/route.ts` の GET を手本に `postClient.listPostQuotes({ postId, limit, cursor }, { headers })` を呼ぶ。
- `useQuotes` は `useCursorPages` と `usePostListRevalidation` を `useAuthorPosts` と同じように使う。
- `describeNotificationAction` は `NotificationType.QUOTE` を `${others}あなたの投稿を引用しました` にする。
- `notificationHref` は `QUOTE` を `/posts/${encodeURIComponent(n.targetPostId)}?tab=quotes` にする（`targetPostId` がなければ null）。
- 通知設定の `quote` をプロパティの全箇所（型、既定値、route、`PUSH_TYPE_ROWS` の「メンション」の次に「引用」）に足す。

- [ ] **Step 4: Run the tests to verify they pass**

Run: Step 2 と同じコマンド。
Expected: 全部通る。

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src
git commit -s -m "feat(dystopia/frontend): add quote views, the quotes route, and quote notifications"
```

### Task 5: Quote frame, card icon, and composer

**Files:**
- Create: `dystopia/frontend/src/modules/post/components/QuoteFrame.tsx`
- Create: `dystopia/frontend/src/modules/post/components/QuoteComposerSheet.tsx`
- Create: `dystopia/frontend/src/stores/quoteComposeStore.ts`
- Modify: `dystopia/frontend/src/components/ui/post-card.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostCardBinding.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostComposer.tsx`
- Modify: `dystopia/frontend/src/components/shell/AppShell.tsx`
- Test: `QuoteFrame.test.tsx`、`QuoteComposerSheet.test.tsx`、`PostCardBinding.quote.test.tsx`、`PostComposer.submit.test.tsx`（すべて `modules/post/components/`）

**Interfaces:**
- Consumes: Task 4 の `QuotedPostView`・`isQuotable`・`SavePostPayload.quotedPostId`。
- Produces: `useQuoteComposeStore`（`post: PostView | null`、`session: number`、`open: boolean`、`openQuote(post: PostView)`、`close()`。`close` は `postSheetStore` と同じく `post` を残す）。
- Produces: `<QuoteFrame quoted={QuotedPostView} interactive?: boolean />`。
- Produces: `PostCardBindingProps.hideQuoteFrame?: boolean`（Task 6 が使う）。
- Produces: `PostCardProps.quoteFrame?: React.ReactNode`。自分の画像と動画の下、リアクション列の上に出す。
- Produces: `openPost(postId: string, tab?: PostDetailTab)` は Task 6 で足すので、ここでは数字のリンクの `href` だけを `/posts/<id>?tab=quotes` にする。

- [ ] **Step 1: Write the failing tests**

```tsx
// QuoteFrame
it("shows the author with the lock mark, the time, the body, and the images")
it("clamps a long body with line-clamp")
it("shows a video as a tile without playing it inside the frame")
it("shows the schedule card and no empty body line for an announcement without words")
it("shows only この投稿は表示できません when unavailable, with no link")
it("links to the original post when available")

// PostCardBinding.quote
it("shows the Repeat2 icon and the quote count after the comment count, with no text label")
it("opens the quote composer from the icon and closes the detail sheet")
it("links the count to the quotes tab of the post")
it("disables the icon but keeps the count pressable on a followers-only, scheduled, or expired post")
it("shows the frame on a quote post and hides it with hideQuoteFrame")

// QuoteComposerSheet
it("shows the original in a frame and submits quotedPostId with the body")
it("keeps the written body and shows the error when the original can no longer be quoted")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/components`
Expected: 新しいテストが失敗する。

- [ ] **Step 3: Implement `QuoteFrame`**

枠は `rounded-md border border-border p-3` を基本とし、本文は `PostText` を `line-clamp-4` で出す。
- 投稿者は `Avatar`（小）と `profileDisplayName`、`LockMark`、`@username`、`formatTimeAgo(publishedAt)`。
- 画像は `next/image` で最大 4 枚を `PostCard` と同じ格子に並べ、拡大はしない。
- 動画は `<video>` を置かず、`thumbnailUrl` があれば画像、なければ「動画」と書いたタイルにする（枠全体がリンクなので再生操作を置かない）。
- お知らせは `PostScheduleCard` を出し、本文が空なら本文の行を出さない。
- `interactive` が true のとき、全体を `/posts/<id>` への `Link` にして `isPlainClick` のときは `openPost(quoted.id)` を呼ぶ（`PostCardBinding` の `openDetail` と同じ）。
- `quoted.available` が false のときは `bg-bg-elevated` の枠に「この投稿は表示できません」だけを出す。

- [ ] **Step 4: Implement the card and the composer**

`PostCardBinding`:
- コメントの次に、`Repeat2` のボタン（`aria-label="引用する"`、`isQuotable` が false なら `disabled` と `opacity-50`）と数字の `Link`（`aria-label={`引用 ${post.quotesCount} 件`}`、`/posts/<id>?tab=quotes`）を、どちらも `min-h-11 min-w-11` で並べる。
- `inDetail` では数字を `span` にする（コメント数と同じ）。
- ボタンの `onClick` は `closeSheet()` のあとに `openQuote(post)` を呼ぶ。
  - SideSheet を二重に開かないために詳細を閉じる。
- `post.quotedPost && !hideQuoteFrame` のとき `quoteFrame={<QuoteFrame quoted={post.quotedPost} interactive />}` を渡す。

`PostComposer`: `children?: ReactNode` を足し、入力欄の下に出す。
本文が必須である既存の検証はそのまま使う。

`QuoteComposerSheet`: `useQuoteComposeStore` を読み、`key={session}` で開き直すたびに初期化する。
`title="引用して投稿"`、`handleSubmit` は `PostComposerSheet` と同じ処理に `quotedPostId: post.id` を足す。
`children` に元の投稿の `QuoteFrame`（`interactive` なし）を出す。
元の投稿を `QuotedPostView` に変える `toQuotedView(post: PostView): QuotedPostView` は `post-mappers.ts` に置く。
エラーは `PostComposer` の既存の表示に任せ、API の文言をそのまま出す。

`AppShell.tsx` の `<PostDetailSheet />` の隣に `<QuoteComposerSheet />` を置く。

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/components src/components/ui`
Expected: 全部通る。

- [ ] **Step 6: Commit**

```bash
git add dystopia/frontend/src
git commit -s -m "feat(dystopia/frontend): quote a post from its card and show the quote frame"
```

### Task 6: Comment and quote tabs in the post detail

**Files:**
- Create: `dystopia/frontend/src/modules/post/components/QuoteList.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostDetailContent.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostDetailSheet.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostCardBinding.tsx`
- Modify: `dystopia/frontend/src/stores/postSheetStore.ts`
- Modify: `dystopia/frontend/src/app/posts/[id]/page.tsx`
- Test: `QuoteList.test.tsx`、`PostDetailContent.test.tsx`、`PostDetailSheet.test.tsx`、`PostCardBinding.quote.test.tsx`、`app/posts/[id]/page.test.tsx`

**Interfaces:**
- Consumes: Task 4 の `useQuotes`、Task 5 の `hideQuoteFrame`。
- Produces: `type PostDetailTab = "comments" | "quotes"`（`postSheetStore.ts` から export）。
- Produces: `usePostSheetStore` の `tab: PostDetailTab` と `openPost(postId: string, tab?: PostDetailTab)`（既定は `"comments"`）。
- Produces: `<PostDetailContent postId initialTab? />`。

- [ ] **Step 1: Write the failing tests**

```tsx
// PostDetailContent
it("opens the comments tab by default and shows the counts in the tab labels")
it("opens the quotes tab with initialTab")
it("shows the composer and comments only in the comments tab")

// QuoteList
it("lists quote posts as cards without the frame")
it("says まだ引用はありません when empty")
it("loads more with もっと見る when there are more quotes")

// page and sheet
it("opens the quotes tab from ?tab=quotes on the post page and ignores unknown values")
it("opens the sheet on the quotes tab when the count is clicked")
```

`PostDetailContent.test.tsx` の既存の「コメント（2 件）」の検証は、タブの見出し「コメント 2」に書き換える。

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && pnpm vitest run src/modules/post/components src/app/posts`
Expected: 新しいテストが失敗する。

- [ ] **Step 3: Implement**

`PostDetailContent` は `components/ui/tab` の `Tabs` を使い、見出しは `コメント ${commentsCount}` と `引用 ${post.quotesCount}` とする。
コメント数は `PostCardBinding` と同じく `usePostCommentCountStore` の値を優先する。
`QuoteList` は `ProfileContentTabs` の一覧を手本に、`PostCardBinding` に `hideQuoteFrame` を渡して並べる。
`page.tsx` は `useSearchParams` を `Suspense` の内側で読み、`tab=quotes` のときだけ `initialTab="quotes"` にする。
`PostDetailSheet` はストアの `tab` を渡す。
`PostCardBinding` の数字の `Link` の `onClick` は `isPlainClick` のとき `openPost(post.id, "quotes")` を呼ぶ。

- [ ] **Step 4: Run the tests to verify they pass**

Run: Step 2 と同じコマンド。
Expected: 全部通る。

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src
git commit -s -m "feat(dystopia/frontend): split the post detail into comment and quote tabs"
```

### Task 7: Docs and end-to-end verification

**Files:**
- Modify: `dystopia/docs/features/posts.md`
- Modify: `dystopia/docs/features/notifications.md`
- Modify: `dystopia/docs/features/feed-and-ranking.md`
- Modify: `dystopia/docs/features/follows-and-blocks.md`
- Modify: `dystopia/docs/data-model.md`

**Interfaces:**
- Consumes: Task 1〜6 の挙動。

- [ ] **Step 1: Update the specs**

本文は日本語で 1 文 1 行、箇条書きは 1 項目 1 文、理由は下の階層、表のセルの改行は `<br>` にする。
- `posts.md`: 節「引用」を足す（引用できる投稿の表、引用投稿の扱い、引用枠、引用数、引用タブ）。
  - 「投稿の削除」に、引用投稿は残って枠が「この投稿は表示できません」になることを足す。
  - `Interactions` と `Data`、`Rationale`（引用から外す操作を作らない理由、引用数をコメント数と違う規則にする理由）に足す。
- `notifications.md`: 種類の表、集約の対象、設定、`Interactions` に引用を足す。
- `feed-and-ranking.md`: 引用投稿は通常の投稿と同じに並び、引用数は順位に使わないことを足す。
- `follows-and-blocks.md`: ブロックの影響表に引用枠と引用数の行を足す。
- `data-model.md`: `post_posts` の図に `quoted_post_id` を足し、外部キーを持たない理由を書く。

- [ ] **Step 2: Run all tests**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec > <scratch file> 2>&1`
Expected: 失敗 0 件（並びに依存する既知の不安定なテストが落ちたら、単独で再実行して確かめる）。

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit --incremental false` と `pnpm vitest run`
Expected: どちらも exit code 0。

- [ ] **Step 3: Run the feature on real screens**

ローカルで monolith と frontend を起動し（`reference_local_e2e_run` の手順。ブラウザは `localhost` で開く）、次を画面で確かめてスクショを残す。
1. 他人の投稿のカードで引用アイコンを押し、本文を書いて投稿すると、自分の投稿のカードに枠が出る。
2. 元の投稿の数字を押すと、詳細が引用タブで開き、同じ引用が枠なしで出る。
3. 元の投稿者でログインすると通知が出て、押すと引用タブが開く。
4. 元の投稿を削除すると、引用投稿の枠が「この投稿は表示できません」になる。
5. 「フォロワーのみ」の投稿のアイコンが無効で、数字は押せる。

Expected: 5 つすべてがこのとおりに動く。

- [ ] **Step 4: Review the added comments**

`git diff origin/main...HEAD` の追加コメントを `AGENTS.md` の Documentation > Content Rules と突き合わせ、タスクへの言及と複数行のコメントを消す。

- [ ] **Step 5: Commit**

```bash
git add dystopia/docs
git commit -s -m "docs(dystopia): describe post quotes"
```

- [ ] **Step 6: Open the Draft PR**

Run: `gh pr view --json state 2>/dev/null` で既存の PR がないことを確かめてから、`git push -u origin HEAD` のあと、`.github/pull_request_template.md` の見出しに従って `gh pr create --draft` で作る。
本文は `Closes #1886` を先頭に、1 文 1 行で書く。
タイトルは `feat(dystopia): quote a post`。
Expected: Draft PR の URL が返る。
