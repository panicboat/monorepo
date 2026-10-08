# Multi Profile P3: Post Actor Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** post slice が持つ「行為者の id」を表す名前を、カラム・proto・Ruby・BFF・frontend のすべてで profile に揃える。挙動は変えない。

**Architecture:** 値は段 1 から profile の id なので、変えるのは名前だけである。改名は決まった規則の置換(perl)で行い、規則で書けない数箇所だけを個別に直す。post を呼ぶ他 slice(feed / discovery / bookmarks / social / review)は、post が持つ名前(struct の属性、repository と use case の引数)を参照している箇所だけを直す。それらの経路は既存のテストが通っていないので、実 database を使う結線の spec を先に書き、改名の前後で赤 → 緑を確かめる。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL / RSpec。frontend は Next.js 16 / TypeScript 7 / vitest 5 / buf。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(API contract の「その他の proto」、Schema changes の post の 5 行、Delivery の段 3)

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で通しで適用して確かめてある。plan に載せた script と file をゼロから再適用して、同じ差分(98 ファイル)になることも確かめた。最終結果は monolith `604 examples, 0 failures`、frontend `tsc` エラー 0・vitest `86` ファイル `328` 件通過。各 Step の Expected のうち数を示したものは、そのときの実測である。実行時に implementer が、置換規則が 2 つの spec で fixture を 1 つに潰すことを見つけた(suite は通るため dry run では検知できなかった)。Step 5 の script の 3 番と、その後の確認はこの修正である。

この plan は stack の 3 段目で、ブランチ `feat/dystopia-multi-profile-post`(`feat/dystopia-multi-profile-karte` の上)に積む。

## Naming

| 場所 | 旧 | 新 |
|---|---|---|
| `post.posts` | `author_id` | `author_profile_id` |
| `post.comments` | `user_id` | `author_profile_id` |
| `post.likes` / `post.post_mentions` / `post.comment_mentions` | `account_id` | `profile_id` |
| proto `Post` / `ListPostsRequest` / `ListCommentsByAuthorRequest` | `author_id` | `author_profile_id` |
| proto `Comment` | `user_id` | `author_profile_id` |
| proto `PostAuthor` / `PostMention` | `account_id` | `profile_id` |
| proto `CommentAuthor` | `user_id` | `profile_id` |
| proto RPC と message | `ListLikedPostsByAccount`(`account_id`) | `ListLikedPostsByProfile`(`profile_id`) |
| like repository | `account_like` / `account_unlike` / `account_liked?` / `account_liked_status_batch` / `liked_post_ids_by_account` / `delete_by_account` | `profile_like` / `profile_unlike` / `profile_liked?` / `profile_liked_status_batch` / `liked_post_ids_by_profile` / `delete_by_profile` |
| post の use case の引数 | `viewer_account_id:` / `user_id:` / `author_id:` / `exclude_user_ids:` | `viewer_profile_id:` / `author_profile_id:` / `author_profile_id:` / `exclude_author_profile_ids:` |
| post の handler | `current_user_id` / `get_blocked_user_ids` | `current_profile_id` / `get_blocked_profile_ids` |
| frontend の view | `PostView.authorId` / `CommentView.userId` | `authorProfileId` |
| frontend の view | `PostAuthorView.accountId` / `MentionView.accountId` / `CommentAuthorView.userId` | `profileId` |
| BFF の query | `author_id` / `account_id` | `author_profile_id` / `profile_id` |

proto の field 番号は変えない。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-post`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0、`env -u NODE_OPTIONS pnpm exec vitest run` で失敗 0。開始時点の基準は rspec `592 examples, 0 failures`、vitest 85 ファイル 324 件通過、`tsc` エラー 0。
- 挙動を変えない。この plan が足すテスト以外の spec と test は、名前の置換だけで通る。期待値(件数・順序・status)を書き換えて通すことはしない。
- script は必ず `bash` で実行する。zsh は変数に入れたファイル一覧を単語に分割しないので、`zsh` で実行すると置換が 1 件も適用されない。
- 他 slice が持つ名前は変えない。該当するのは、social の `viewer_can_see_post` / `filter_visible_posts` の引数 `viewer_account_id:`、social の `block_repo.blocked_ids(account_id:)`、notifications の `recipient_id:` / `actor_id:`、bookmarks の `account_id:`、feed / discovery の use case 自身の引数である。これらは値に profile の id を渡したまま、後続の段で改名する。
- 退会の purge の入口(`Post::UseCases::PurgeAccount#call(account_id:)`)は変えない。identity が全 slice を同じ引数名で呼ぶためで、段 8 で profile 単位の purge に作り替える。
- `Current.account_id` と `create_account_with_profile` の引数(fixture)は変えない。
- テスト用 database に seed や手動の行を入れない。spec の truncation は slice の schema の行を消さない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan の手順はコメントを追加しない。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない。

## Review Focus

改名で壊れやすく、既存のテストでは検知できない箇所。各行のテストは括弧内のタスクに入れてある。

1. feed / discovery / bookmarks が post の repository と use case を新しい引数名で呼べる(Task 1 の結線 spec)。
2. social と review が、post の struct の `author_profile_id` を読める。social の引数名 `viewer_account_id:` は元のまま呼ばれる(Task 1 の結線 spec)。
3. 置換は `author_id`(投稿者)と `user_id`(コメントの著者)を同じ `author_profile_id` にする。両方を別々の fixture として持つ spec では 2 つが 1 つに潰れ、投稿者とコメントの著者が同じ profile になっても suite は通る。コメントの 4 つの spec では投稿者の fixture を `post_author_profile_id` にして分ける(Task 1 の Step 5 の script と、`let` の種類の数を比べる確認)。
4. `create_post` は未知のキーを黙って捨てる。旧名 `author_id:` のまま呼ぶ箇所が残ると、著者の無い投稿が作られる(Task 1 の結線 spec が、保存した投稿の `author_profile_id` を確かめる)。
5. コメントの著者の id が、`Comment.author_profile_id` と `CommentAuthor.profile_id` に正しく分かれる(Task 1 の結線 spec、Task 2 の `comment-mappers.test.ts`)。
6. いいね一覧は本人の profile でだけ見え、他人の profile の id を渡すと拒否される(Task 1 の結線 spec)。
7. BFF が新しい query 名(`author_profile_id` / `profile_id`)を読む(Task 2 の route test)。hook が同じ名前を送ることは、Controller verification のブラウザ確認で確かめる。

---

### Task 1: Proto, schema and monolith

**Files:**
- Modify: `proto/dystopia/post/v1/post_service.proto`、`comment_service.proto`、`like_service.proto`
- Generate: `dystopia/monolith/stubs/post/v1/*.rb`
- Create: `dystopia/monolith/config/db/migrate/20261008020000_rename_post_actor_columns_to_profile.rb`
- Create: `dystopia/monolith/spec/slices/post/cross_slice_wiring_spec.rb`
- Rename: `dystopia/monolith/slices/post/use_cases/likes/list_liked_posts_by_account.rb` → `list_liked_posts_by_profile.rb`(spec も同様)
- Modify: `dystopia/monolith/slices/post/**`、`dystopia/monolith/spec/slices/post/**`
- Modify(post の名前を参照する箇所のみ): `slices/social/use_cases/viewer_can_see_post.rb`、`slices/social/use_cases/filter_visible_posts.rb`、`slices/review/use_cases/list_recent_entries.rb`、`slices/review/use_cases/filter_visible_entries.rb`、`slices/feed/use_cases/list_feed.rb`、`slices/feed/grpc/handler.rb`、`slices/discovery/use_cases/rank_posts.rb`、`slices/discovery/use_cases/search_posts.rb`、`slices/bookmarks/use_cases/list_bookmarks.rb`
- Modify: `config/db/seeds/post/posts.rb`、`comments.rb`、`likes.rb`
- Modify: `spec/slices/identity/use_cases/account/purge_wiring_spec.rb`、`spec/slices/review/use_cases/list_recent_entries_spec.rb`

**Interfaces:**
- Consumes: `Grpc::Authenticatable#current_profile_id`、`ProfileFixtures`(`create_account_with_profile(role:, **attrs)` は profile の id を返す)
- Produces:
  - proto: Naming の表のとおり
  - `Post::Slice["repositories.post_repository"]`: `create_post(author_profile_id:, content:, visibility:)`、`list_posts(limit:, cursor:, author_profile_id:, media_only:)`、`list_public_post_ids(limit:, cursor:, author_profile_ids:, excluded_author_profile_ids:)`、`find_by_id_and_author(id:, author_profile_id:)`。struct の属性は `author_profile_id`
  - `Post::Slice["repositories.like_repository"]`: Naming の表のとおり。引数は `profile_id:`
  - `Post::Slice["repositories.comment_repository"]`: `create_comment(post_id:, author_profile_id:, content:, ...)`、`delete_comment(id:, author_profile_id:)`、`list_by_author(author_profile_id:, ...)`、`exclude_author_profile_ids:`
  - `Post::Slice["use_cases.posts.list_posts_by_ids"].call(post_ids:, viewer_profile_id:)`
  - `Post::Slice["use_cases.likes.list_liked_posts_by_profile"].call(profile_id:, viewer_profile_id:, limit:, cursor:)`

- [ ] **Step 1: 結線の spec を書く(失敗する)**

`spec/slices/post/cross_slice_wiring_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"
require "slices/post/grpc/like_handler"
require "slices/post/grpc/comment_handler"
require "slices/feed/grpc/handler"

RSpec.describe "Post slice wiring with the slices that read posts", type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:bookmark_repo) { Bookmarks::Slice["repositories.bookmark_repository"] }
  let(:list_posts) { Post::Slice["use_cases.posts.list_posts_by_ids"] }

  let(:viewer) { create_account_with_profile(username: "wiring_viewer") }
  let(:public_author) { create_account_with_profile(role: 2, username: "wiring_public") }
  let(:private_author) { create_account_with_profile(role: 2, username: "wiring_private", is_private: true) }
  let!(:public_post) { post_repo.create_post(author_profile_id: public_author, content: "wiring public", visibility: "public") }
  let!(:private_post) { post_repo.create_post(author_profile_id: private_author, content: "wiring private", visibility: "public") }

  it "hydrates posts with the author profile and hides a private author's post from a non-follower" do
    result = list_posts.call(post_ids: [public_post.id, private_post.id], viewer_profile_id: viewer)

    expect(result.keys).to eq([public_post.id])
    expect(result[public_post.id].author_profile_id).to eq(public_author)
    expect(result[public_post.id].author.profile_id).to eq(public_author)
    expect(result[public_post.id].author.username).to eq("wiring_public")
  end

  it "shows a private author's post to an approved follower and marks the viewer's like" do
    follow_repo.follow(follower_id: viewer, followee_id: private_author, status: "approved")
    like_repo.profile_like(post_id: private_post.id, profile_id: viewer)

    result = list_posts.call(post_ids: [public_post.id, private_post.id], viewer_profile_id: viewer)

    expect(result.keys).to contain_exactly(public_post.id, private_post.id)
    expect(result[private_post.id].liked).to be true
    expect(result[public_post.id].liked).to be false
  end

  it "decides a single post's visibility from its author profile" do
    can_see = Social::Slice["use_cases.viewer_can_see_post"]

    expect(can_see.call(viewer_account_id: viewer, post: post_repo.find_by_id(public_post.id))).to be true
    expect(can_see.call(viewer_account_id: viewer, post: post_repo.find_by_id(private_post.id))).to be_falsy
    expect(can_see.call(viewer_account_id: private_author, post: post_repo.find_by_id(private_post.id))).to be true
  end

  it "lists the following feed by the followed author profiles" do
    follow_repo.follow(follower_id: viewer, followee_id: public_author, status: "approved")

    all = Feed::UseCases::ListFeed.new.call(filter: "all", viewer_account_id: viewer)
    following = Feed::UseCases::ListFeed.new.call(filter: "following", viewer_account_id: viewer)

    expect(all[:post_ids]).to contain_exactly(public_post.id, private_post.id)
    expect(following[:post_ids]).to eq([public_post.id])
  end

  it "ranks and searches posts for a viewer" do
    ranked = Discovery::Slice["use_cases.rank_posts"].call(period: "all", viewer_account_id: viewer)
    found = Discovery::Slice["use_cases.search_posts"].call(query: "wiring", viewer_account_id: viewer)

    expect(ranked[:posts].map(&:id)).to eq([public_post.id])
    expect(found[:posts].map(&:id)).to eq([public_post.id])
  end

  it "lists bookmarked posts for a viewer" do
    bookmark_repo.bookmark(account_id: viewer, post_id: public_post.id)

    result = Bookmarks::Slice["use_cases.list_bookmarks"].call(account_id: viewer)

    expect(result[:posts].map(&:id)).to eq([public_post.id])
  end

  it "filters review author references through the post visibility filter" do
    refs = [public_author, private_author].map { |id| Review::UseCases::ListRecentEntries::AuthorRef.new(id) }

    visible = Social::Slice["use_cases.filter_visible_posts"].call(viewer_account_id: viewer, posts: refs)

    expect(visible.map(&:author_profile_id)).to eq([public_author])
  end

  describe "RPC entry points" do
    def rpc(handler_class, method, message)
      handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
    end

    def act_as(profile_id)
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = profile_id
    end

    def status(code)
      raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
    end

    after { Current.clear }

    it "lists and gets posts by author profile" do
      act_as(viewer)

      listed = rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: public_author))
      got = rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: public_post.id))

      expect(listed.posts.map(&:id)).to eq([public_post.id])
      expect(listed.posts.first.author_profile_id).to eq(public_author)
      expect(got.post.author.profile_id).to eq(public_author)
      expect { rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: private_post.id)) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end

    it "saves a post as the acting profile and lets only that profile delete it" do
      act_as(viewer)
      saved = rpc(Post::Grpc::PostHandler, :save_post, Post::V1::SavePostRequest.new(content: "mine", visibility: "public")).post

      act_as(public_author)
      expect { rpc(Post::Grpc::PostHandler, :delete_post, Post::V1::DeletePostRequest.new(id: saved.id)) }
        .to status(GRPC::Core::StatusCodes::NOT_FOUND)

      act_as(viewer)
      rpc(Post::Grpc::PostHandler, :delete_post, Post::V1::DeletePostRequest.new(id: saved.id))

      expect(saved.author_profile_id).to eq(viewer)
      expect(post_repo.find_by_id(saved.id)).to be_nil
    end

    it "likes, reports like status, lists liked posts for the acting profile only, and unlikes" do
      act_as(viewer)

      liked = rpc(Post::Grpc::LikeHandler, :like_post, Post::V1::LikePostRequest.new(post_id: public_post.id))
      status_map = rpc(Post::Grpc::LikeHandler, :get_like_status, Post::V1::GetLikeStatusRequest.new(post_ids: [public_post.id])).liked
      mine = rpc(Post::Grpc::LikeHandler, :list_liked_posts_by_profile, Post::V1::ListLikedPostsByProfileRequest.new(profile_id: viewer))

      expect(liked.likes_count).to eq(1)
      expect(status_map[public_post.id]).to be true
      expect(mine.posts.map(&:id)).to eq([public_post.id])
      expect {
        rpc(Post::Grpc::LikeHandler, :list_liked_posts_by_profile, Post::V1::ListLikedPostsByProfileRequest.new(profile_id: public_author))
      }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)

      unliked = rpc(Post::Grpc::LikeHandler, :unlike_post, Post::V1::UnlikePostRequest.new(post_id: public_post.id))
      expect(unliked.likes_count).to eq(0)
    end

    it "adds, lists and deletes comments by author profile" do
      act_as(viewer)
      added = rpc(Post::Grpc::CommentHandler, :add_comment, Post::V1::AddCommentRequest.new(post_id: public_post.id, content: "hello"))
      listed = rpc(Post::Grpc::CommentHandler, :list_comments, Post::V1::ListCommentsRequest.new(post_id: public_post.id))
      by_author = rpc(Post::Grpc::CommentHandler, :list_comments_by_author, Post::V1::ListCommentsByAuthorRequest.new(author_profile_id: viewer))

      expect(added.comment.author_profile_id).to eq(viewer)
      expect(added.comment.author.profile_id).to eq(viewer)
      expect(listed.comments.map(&:author_profile_id)).to eq([viewer])
      expect(by_author.comments.map(&:id)).to eq([added.comment.id])
      expect(by_author.posts_by_id[public_post.id].author_profile_id).to eq(public_author)

      act_as(public_author)
      expect {
        rpc(Post::Grpc::CommentHandler, :delete_comment, Post::V1::DeleteCommentRequest.new(comment_id: added.comment.id))
      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)

      act_as(viewer)
      deleted = rpc(Post::Grpc::CommentHandler, :delete_comment, Post::V1::DeleteCommentRequest.new(comment_id: added.comment.id))
      expect(deleted.comments_count).to eq(0)
    end

    it "serves the feed with hydrated posts" do
      act_as(viewer)

      feed = rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_ALL))

      expect(feed.posts.map(&:id)).to eq([public_post.id])
      expect(feed.posts.first.author_profile_id).to eq(public_author)
    end
  end
end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/post/cross_slice_wiring_spec.rb > /tmp/rspec-p3-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p3-red.txt`
Expected: `18 examples, 11 failures`(spec/support の 6 件は通る。この spec の 12 件のうち 11 件が、`author_profile_id` というカラムや引数がまだ無いために落ちる。「lists bookmarked posts for a viewer」だけは改名前でも通る。repository が未知のキーを黙って捨てるので著者の無い投稿が作られ、bookmarks の経路は旧名のまま動くためである)。

- [ ] **Step 2: proto を改名する**

次の内容を `/tmp/p3-proto.sh` に保存し、リポジトリの root(`.worktrees/feat-dystopia-multi-profile-model`)で `bash /tmp/p3-proto.sh` を実行する。

```bash
set -euo pipefail
perl -pi -e 's/string account_id = 1;/string profile_id = 1;/; s/string author_id = /string author_profile_id = /; s/string user_id = 1;/string profile_id = 1;/; s/string user_id = 4;/string author_profile_id = 4;/; s/ListLikedPostsByAccount/ListLikedPostsByProfile/g' proto/dystopia/post/v1/post_service.proto proto/dystopia/post/v1/comment_service.proto proto/dystopia/post/v1/like_service.proto
```

Run(root): `/usr/bin/grep -c -E 'account_id|user_id|string author_id|ByAccount' proto/dystopia/post/v1/*.proto`
Expected: 3 ファイルとも `:0`

- [ ] **Step 3: Ruby の stub を生成する**

`bin/codegen` は全 package の stub を作り直すので、post 以外の差分を戻す。

Run(`dystopia/monolith`):
```bash
rbenv exec bundle exec bin/codegen
git diff --name-only --relative -- stubs | /usr/bin/grep -v '^stubs/post/' | xargs git checkout --
git status --short stubs
```
Expected: 次の 4 行だけ。
```
 M stubs/post/v1/comment_service_pb.rb
 M stubs/post/v1/like_service_pb.rb
 M stubs/post/v1/like_service_services_pb.rb
 M stubs/post/v1/post_service_pb.rb
```

- [ ] **Step 4: migration を書いて適用する**

`config/db/migrate/20261008020000_rename_post_actor_columns_to_profile.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:post__posts) { rename_column :author_id, :author_profile_id }
    alter_table(:post__comments) { rename_column :user_id, :author_profile_id }
    alter_table(:post__likes) { rename_column :account_id, :profile_id }
    alter_table(:post__post_mentions) { rename_column :account_id, :profile_id }
    alter_table(:post__comment_mentions) { rename_column :account_id, :profile_id }

    run "ALTER INDEX post.social_post_comments_user_id_index RENAME TO social_post_comments_author_profile_id_index"
    run "ALTER INDEX post.idx_post_likes_post_account RENAME TO idx_post_likes_post_profile"
    run "ALTER INDEX post.post_post_mentions_account_id_index RENAME TO post_post_mentions_profile_id_index"
    run "ALTER INDEX post.post_comment_mentions_account_id_index RENAME TO post_comment_mentions_profile_id_index"
  end

  down do
    run "ALTER INDEX post.post_comment_mentions_profile_id_index RENAME TO post_comment_mentions_account_id_index"
    run "ALTER INDEX post.post_post_mentions_profile_id_index RENAME TO post_post_mentions_account_id_index"
    run "ALTER INDEX post.idx_post_likes_post_profile RENAME TO idx_post_likes_post_account"
    run "ALTER INDEX post.social_post_comments_author_profile_id_index RENAME TO social_post_comments_user_id_index"

    alter_table(:post__comment_mentions) { rename_column :profile_id, :account_id }
    alter_table(:post__post_mentions) { rename_column :profile_id, :account_id }
    alter_table(:post__likes) { rename_column :profile_id, :account_id }
    alter_table(:post__comments) { rename_column :author_profile_id, :user_id }
    alter_table(:post__posts) { rename_column :author_profile_id, :author_id }
  end
end
```

カラム名を含む index の名前も合わせて変える。NOT NULL 制約の名前(`post_comments_user_id_not_null` など)は変えない。この名前が付くのは NOT NULL 制約を名前付きで持つ PostgreSQL だけで、適用先の版によっては存在せず、改名の SQL が失敗するためである(ローカルは PostgreSQL 18 で存在する。適用先の版は未確認)。

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated` と出る。`config/db/structure.sql` の dump は git の管理外なので commit に含めない。

- [ ] **Step 5: Ruby の名前を置換する**

次の内容を `/tmp/p3-monolith.sh` に保存し、`dystopia/monolith` で `bash /tmp/p3-monolith.sh` を実行する。2 回実行しない(`git mv` が 2 回目に失敗する)。

```bash
set -euo pipefail

# 1. files named after the account
git mv slices/post/use_cases/likes/list_liked_posts_by_account.rb slices/post/use_cases/likes/list_liked_posts_by_profile.rb
git mv spec/slices/post/use_cases/likes/list_liked_posts_by_account_spec.rb spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb

# 2. the role adapter takes profile ids
perl -pi -e 's/user_ids\b/profile_ids/g; s/user_id\b/profile_id/g' slices/post/adapters/account_adapter.rb spec/slices/post/adapters/account_adapter_spec.rb

# 3. comment specs keep the post author fixture distinct from the comment author, which also becomes author_profile_id
perl -pi -e 's/let\(:author_id\)/let(:post_author_profile_id)/; s/create_post\(author_id: author_id,/create_post(author_profile_id: post_author_profile_id,/' spec/slices/post/repositories/comment_repository_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/comments/list_comments_spec.rb spec/slices/post/use_cases/comments/list_replies_spec.rb

# 4. every other file of the post slice and its specs (the wiring spec already uses the new names)
FILES=$(find slices/post spec/slices/post -name '*.rb' ! -name 'account_adapter.rb' ! -name 'account_adapter_spec.rb' ! -name 'cross_slice_wiring_spec.rb')
perl -pi -e 's/account_liked_status_batch/profile_liked_status_batch/g; s/account_liked\?/profile_liked?/g; s/account_unlike/profile_unlike/g; s/account_like/profile_like/g; s/liked_post_ids_by_account/liked_post_ids_by_profile/g; s/delete_by_account/delete_by_profile/g; s/list_liked_posts_by_account/list_liked_posts_by_profile/g; s/ListLikedPostsByAccount/ListLikedPostsByProfile/g' $FILES
perl -pi -e 's/viewer_account_id/viewer_profile_id/g; s/current_user_id/current_profile_id/g; s/author_id(s?)\b/author_profile_id$1/g; s/exclude_user_ids/exclude_author_profile_ids/g; s/blocked_user_ids/blocked_profile_ids/g; s/user_ids\b/author_profile_ids/g; s/user_id\b/author_profile_id/g' $FILES
perl -pi -e 's/account_ids\b/profile_ids/g; s/(?<!Current\.)account_id\b/profile_id/g' $(echo "$FILES" | /usr/bin/grep -v 'purge_account')

# 5. keywords owned by the social slice keep their names; only the value changes
perl -pi -e 's/viewer_can_see_post\.call\(viewer_profile_id:/viewer_can_see_post.call(viewer_account_id:/' slices/post/grpc/post_handler.rb
perl -pi -e 's/visibility_filter\.call\(viewer_profile_id:/visibility_filter.call(viewer_account_id:/' slices/post/use_cases/posts/list_posts_by_ids.rb
perl -pi -e 's/block_repo\.blocked_ids\(profile_id:/block_repo.blocked_ids(account_id:/' slices/post/adapters/block_adapter.rb

# 6. CommentAuthor carries the profile id of the author
perl -pi -e 's/author_profile_id: author_info\[:id\]/profile_id: author_info[:id]/' slices/post/presenters/comment_presenter.rb

# 7. locals and a message that still say account
perl -pi -e 's/accounts_by_username/profiles_by_username/g; s/\baccount\b/profile/g' slices/post/use_cases/extract_mentions.rb
perl -pi -e "s/another account's likes/another profile's likes/" slices/post/use_cases/likes/list_liked_posts_by_profile.rb spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb

# 8. other slices that read post structs or call post use cases and repositories
perl -pi -e 's/post\.author_id\b/post.author_profile_id/; s/posts\.map\(&:author_id\)/posts.map(&:author_profile_id)/' slices/social/use_cases/viewer_can_see_post.rb slices/social/use_cases/filter_visible_posts.rb
perl -pi -e 's/Struct\.new\(:author_id\)/Struct.new(:author_profile_id)/; s/\.map\(&:author_id\)/.map(&:author_profile_id)/' slices/review/use_cases/list_recent_entries.rb slices/review/use_cases/filter_visible_entries.rb
perl -pi -e 's/^(\s+)author_ids: author_ids,$/$1author_profile_ids: author_ids,/; s/^(\s+)excluded_author_ids: excluded$/$1excluded_author_profile_ids: excluded/' slices/feed/use_cases/list_feed.rb
perl -pi -e 's/(list_posts(?:_by_ids)?_uc\.call\(post_ids: [^,]+, )viewer_account_id:/$1viewer_profile_id:/' slices/feed/grpc/handler.rb slices/discovery/use_cases/rank_posts.rb slices/discovery/use_cases/search_posts.rb slices/bookmarks/use_cases/list_bookmarks.rb

# 9. seeds
perl -pi -e 's/author_id = post\[:author_id\]/post_author_profile_id = post[:author_profile_id]/; s/user_id: author_id,/author_profile_id: post_author_profile_id,/; s/all_user_ids/all_profile_ids/g; s/\buser_id\b/author_profile_id/g' config/db/seeds/post/comments.rb
perl -pi -e 's/\bauthor_id\b/author_profile_id/g' config/db/seeds/post/posts.rb
perl -pi -e 's/\baccount_id\b/profile_id/g' config/db/seeds/post/likes.rb

# 10. specs of other slices that build post rows
perl -pi -e 's/p\.author_id\b/p.author_profile_id/' spec/slices/review/use_cases/list_recent_entries_spec.rb
perl -pi -e 's/create_post\(author_id:/create_post(author_profile_id:/; s/like_repo\.account_like\(post_id: ([^,]+), account_id:/like_repo.profile_like(post_id: $1, profile_id:/; s/(create_comment\(post_id: [^,]+, )user_id:/$1author_profile_id:/; s/db\[:post__posts\]\.where\(author_id:/db[:post__posts].where(author_profile_id:/; s/db\[:post__likes\]\.where\(account_id:/db[:post__likes].where(profile_id:/; s/db\[:post__comments\]\.where\(user_id:/db[:post__comments].where(author_profile_id:/' spec/slices/identity/use_cases/account/purge_wiring_spec.rb

# 11. example names that describe a profile as an account
perl -pi -e 's/mentioned account/mentioned profile/g; s/the same account/the same profile/g; s/existing account/existing profile/; s/account-based likes \(symmetric\)/profile-based likes (symmetric)/; s/a like by account/a like by profile/; s/likes by the account/likes by the profile/' spec/slices/post/grpc/post_handler_spec.rb spec/slices/post/repositories/like_repository_spec.rb spec/slices/post/presenters/post_presenter_spec.rb spec/slices/post/presenters/comment_presenter_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/extract_mentions_spec.rb
```

Run: `/usr/bin/grep -rn -E '\b(author_id|user_id|account_id)\b|account_like|by_account\b|current_user_id' slices/post spec/slices/post --include='*.rb' | /usr/bin/grep -v 'Current\.account_id'`
Expected: 次の 9 行だけ(他 slice の引数名と、purge の入口)。
```
slices/post/adapters/block_adapter.rb:7:        block_repo.blocked_ids(account_id: profile_id)
slices/post/use_cases/purge_account.rb:12:      def call(account_id:)
slices/post/use_cases/purge_account.rb:13:        like_repo.delete_by_profile(account_id)
slices/post/use_cases/purge_account.rb:14:        comment_repo.delete_by_profile(account_id)
slices/post/use_cases/purge_account.rb:15:        post_repo.delete_by_author(account_id)
spec/slices/post/cross_slice_wiring_spec.rb:70:    bookmark_repo.bookmark(account_id: viewer, post_id: public_post.id)
spec/slices/post/cross_slice_wiring_spec.rb:72:    result = Bookmarks::Slice["use_cases.list_bookmarks"].call(account_id: viewer)
spec/slices/post/use_cases/purge_account_spec.rb:21:    use_case.call(account_id: "cast-1")
spec/slices/post/use_cases/purge_account_spec.rb:28:    expect(use_case.call(account_id: "cast-1")).to be_nil
```

Run: `git status --short . | wc -l`
Expected: `62`

2 つの名前を同じ名前に置換する規則なので、別々だった fixture が 1 つに潰れていないことを確かめる。

Run:
```bash
git diff --name-only --relative HEAD -- spec | while read -r f; do [ -f "$f" ] || continue; git cat-file -e "HEAD:dystopia/monolith/$f" 2>/dev/null || continue; a=$(git show "HEAD:dystopia/monolith/$f" | /usr/bin/grep -o 'let!\{0,1\}(:[a-z_0-9]*)' | sort -u | wc -l); b=$(/usr/bin/grep -o 'let!\{0,1\}(:[a-z_0-9]*)' "$f" | sort -u | wc -l); [ "$a" -eq "$b" ] || echo "$f: $a -> $b distinct let names"; done
```
Expected: 出力なし(`let` の名前の種類が、どの spec でも置換の前後で同じ数である)。

- [ ] **Step 6: 結線の spec と全体が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/post/cross_slice_wiring_spec.rb > /tmp/rspec-p3-green.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p3-green.txt`
Expected: `18 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `604 examples, 0 failures`

失敗がある場合は、名前の置換漏れか置換し過ぎである。期待値を書き換えず、該当の名前だけを直す。直せない場合は BLOCKED として出力を報告する。

- [ ] **Step 7: Commit**

```bash
cd ../.. && git add -A proto/dystopia/post dystopia/monolith && git status --short && git commit -s -m "refactor(dystopia): name the post actor columns, fields and arguments after the profile" && cd dystopia/monolith
```

`git status --short` の出力が `proto/dystopia/post` と `dystopia/monolith` の下だけであることを確認してから commit する。

---

### Task 2: Frontend

**Files:**
- Generate: `dystopia/frontend/src/stub/post/v1/post_service_pb.ts`、`comment_service_pb.ts`、`like_service_pb.ts`
- Create: `dystopia/frontend/src/app/api/posts/author-queries.test.ts`
- Modify: `dystopia/frontend/src/modules/post/**`、`dystopia/frontend/src/app/api/posts/**`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`、`dystopia/frontend/src/app/dev/ui/page.tsx`

**Interfaces:**
- Consumes: Task 1 の proto
- Produces:
  - `@/modules/post/lib/post-view`: `PostView.authorProfileId`、`PostAuthorView.profileId`、`MentionView.profileId`
  - `@/modules/post/lib/comment-view`: `CommentView.authorProfileId`、`CommentAuthorView.profileId`
  - BFF: `GET /api/posts?author_profile_id=`、`GET /api/posts/comments-by-author?author_profile_id=`、`GET /api/posts/liked-by?profile_id=`
  - `ProfileContentTabs` の props は `profileId`。`useAuthorPosts` / `useAuthorComments` / `useAuthorLikedPosts` の第 1 引数は profile の id

- [ ] **Step 1: stub を生成する**

`pnpm proto:gen` は全 package の stub を作り直し、管理外の `src/stub/billing/` も作る。post 以外を戻す。

Run(`dystopia/frontend`):
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v '^src/stub/post/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
```
Expected: 次の 3 行だけ。
```
 M src/stub/post/v1/comment_service_pb.ts
 M src/stub/post/v1/like_service_pb.ts
 M src/stub/post/v1/post_service_pb.ts
```

- [ ] **Step 2: BFF の query 名を固定する test を書く(失敗する)**

`src/app/api/posts/author-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

vi.mock("@/lib/grpc", () => ({
  postClient: { listPosts: vi.fn(), savePost: vi.fn() },
  commentClient: { listCommentsByAuthor: vi.fn() },
  likeClient: { listLikedPostsByProfile: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const { postClient, commentClient, likeClient } = await import("@/lib/grpc");
const posts = await import("./route");
const commentsByAuthor = await import("./comments-by-author/route");
const likedBy = await import("./liked-by/route");

const listPosts = postClient.listPosts as unknown as ReturnType<typeof vi.fn>;
const listCommentsByAuthor = commentClient.listCommentsByAuthor as unknown as ReturnType<typeof vi.fn>;
const listLikedPostsByProfile = likeClient.listLikedPostsByProfile as unknown as ReturnType<typeof vi.fn>;

function get(path: string) {
  const req = new NextRequest(`http://localhost${path}`);
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("post list routes address the author by profile id", () => {
  beforeEach(() => {
    listPosts.mockReset().mockResolvedValue({ posts: [], nextCursor: "", hasMore: false });
    listCommentsByAuthor.mockReset().mockResolvedValue({ comments: [], postsById: {}, nextCursor: "", hasMore: false });
    listLikedPostsByProfile.mockReset().mockResolvedValue({ posts: [], nextCursor: "", hasMore: false });
  });

  it("GET /api/posts forwards author_profile_id", async () => {
    const res = await posts.GET(get("/api/posts?author_profile_id=prof-1&media_only=1"));

    expect(res.status).toBe(200);
    expect(listPosts).toHaveBeenCalledWith(
      expect.objectContaining({ authorProfileId: "prof-1", mediaOnly: true }),
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it("GET /api/posts lists every author when the parameter is absent", async () => {
    await posts.GET(get("/api/posts"));

    expect(listPosts).toHaveBeenCalledWith(expect.objectContaining({ authorProfileId: "" }), expect.anything());
  });

  it("GET /api/posts/comments-by-author forwards author_profile_id", async () => {
    const res = await commentsByAuthor.GET(get("/api/posts/comments-by-author?author_profile_id=prof-1"));

    expect(res.status).toBe(200);
    expect(listCommentsByAuthor).toHaveBeenCalledWith(
      expect.objectContaining({ authorProfileId: "prof-1" }),
      expect.anything()
    );
  });

  it("GET /api/posts/liked-by forwards profile_id", async () => {
    const res = await likedBy.GET(get("/api/posts/liked-by?profile_id=prof-1"));

    expect(res.status).toBe(200);
    expect(listLikedPostsByProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "prof-1" }),
      expect.anything()
    );
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/posts/author-queries.test.ts > /tmp/vitest-p3-red.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p3-red.txt | /usr/bin/grep -E 'Tests |FAIL' | head -6`
Expected: `Tests  4 failed (4)`(route がまだ `author_id` / `account_id` を読み、`listLikedPostsByAccount` を呼ぶため)。

- [ ] **Step 3: 名前を置換する**

次の内容を `/tmp/p3-frontend.sh` に保存し、`dystopia/frontend` で `bash /tmp/p3-frontend.sh` を実行する。

```bash
set -euo pipefail
POST=$(find src/modules/post src/app/api/posts -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'author-queries.test.ts')

# 1. comment ids: the author object carries profileId, the comment carries authorProfileId
perl -0pi -e 's/userId: string;/profileId: string;/; s/userId: string;/authorProfileId: string;/' src/modules/post/lib/comment-view.ts
perl -pi -e 's/a\.userId/a.profileId/g; s/userId: a\.profileId/profileId: a.profileId/; s/userId: c\.userId/authorProfileId: c.authorProfileId/' src/modules/post/lib/comment-mappers.ts
perl -0pi -e 's/userId: "user-1"/profileId: "user-1"/; s/userId: "user-1"/authorProfileId: "user-1"/' src/modules/post/lib/comment-mappers.test.ts
perl -pi -e 's/\b([rc])\.userId\b/$1.authorProfileId/' src/modules/post/components/ReplyList.tsx src/modules/post/components/CommentList.tsx
perl -pi -e 's/^  userId:/  authorProfileId:/; s/^    userId:/    profileId:/' src/modules/post/components/ReplyList.test.tsx src/modules/post/components/CommentList.test.tsx src/modules/post/components/ReplyWithParentRow.test.tsx

# 2. the viewer local in hooks is the acting profile
perl -pi -e 's/\buserId\b/activeProfileId/g' src/modules/post/hooks/*.ts

# 3. post author, mention and liker ids; query strings; the renamed RPC
perl -pi -e 's/\bauthorId\b/authorProfileId/g; s/\baccountId\b/profileId/g; s/author_id\b/author_profile_id/g; s/\baccount_id\b/profile_id/g; s/listLikedPostsByAccount/listLikedPostsByProfile/g; s/"ListLikedPostsByAccount"/"ListLikedPostsByProfile"/' $POST

# 4. callers outside the post module
perl -0pi -e 's/(<ProfileContentTabs\s+)accountId=/$1profileId=/' "src/app/u/[username]/page.tsx"
perl -pi -e 's/\bauthorId\b/authorProfileId/; s/\baccountId\b/profileId/' src/app/dev/ui/page.tsx

# 5. a fixture value that names the id an account
perl -pi -e 's/profileId="account-1"/profileId="profile-1"/' src/modules/post/components/ProfileContentTabs.test.tsx
```

Run: `/usr/bin/grep -rn -E '\b(userId|accountId|authorId)\b|account_id|author_id\b|ByAccount' src/modules/post src/app/api/posts`
Expected: 出力なし。

- [ ] **Step 4: 全体を確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p3.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p3.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、`Test Files  86 passed (86)`、`Tests  328 passed (328)`。

`tsc` がエラーを出した場合は、post の view の型(`PostView` / `CommentView` など)を作っている箇所の旧名が残っている。出力された箇所だけを Naming の表に従って直す。social / messaging / review の component の `accountId` や `targetAccountId` という props は変えない。

Run: `git status --short . | wc -l; git status --short src/stub | wc -l`
Expected: `33` と `3`

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -s -m "refactor(dystopia/frontend): name post authors, mentions and likers after the profile"
```

---

## Controller verification (not dispatched)

Task 2 の後、controller が実サーバーを起動して確認する(使い捨ての database に migrate と seed、`bin/grpc` に `.env` と `.env.test` を export、`next dev`、ブラウザは `localhost` で開く、終了後に生成物と database を削除)。

- seed が新しいカラム名で通る(`post.posts` / `post.comments` / `post.likes` に行が入る)。
- cast でログインし、feed(すべて・フォロー中)、検索、ランキング、ブックマークの一覧に投稿が出る。
- 投稿の作成・編集・削除、いいね・いいね解除、コメントと返信の追加・削除ができる。mention した相手に通知が届く。
- プロフィールページの「投稿」「返信」「メディア」「いいね」の各タブに内容が出る(hook が新しい query 名を送っていることの確認)。他人のプロフィールに「いいね」タブは出ない。
- 自分のコメントにだけ削除が出る。
- gRPC server のログに、意図しない ERROR が無い。

## Known gaps left for later plans

- `Post::UseCases::PurgeAccount#call(account_id:)` は、profile の id を `account_id` という引数名で受け取る。段 8 で profile 単位の purge に作り替えるときに改名する。
- `Post::Adapters::AccountAdapter` は class 名をそのままにした。profile の id から、その account の role(cast / guest)を引く adapter である。
- post の中から他 slice を呼ぶ箇所は、相手の引数名に合わせて `viewer_account_id:` / `account_id:` / `recipient_id:` / `actor_id:` のままである。social(段 4)、notifications(段 5)の改名で直る。
- feed / discovery / bookmarks の use case 自身の引数(`viewer_account_id:` / `account_id:`)と、handler の `current_user_id` は変えていない。段 6・7 で改名する。
- `post.comments` などの NOT NULL 制約の名前に、旧カラム名が残る(Task 1 Step 4 の理由による)。
- `post.posts` の著者のカラムには index が無い(この段より前からの状態)。著者別の一覧は全件走査になる。
- BFF の route と hook が同じ query 名を使うことは、route 側だけを test で固定した。hook 側は Controller verification で確かめる。
- P1a・P1b・P2 の Known gaps はそのまま残る。
