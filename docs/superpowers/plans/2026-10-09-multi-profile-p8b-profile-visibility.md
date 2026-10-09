# Multi Profile P8b: Profile Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 無効な人格と、退会手続き中の account に属する人格を、本人以外から「存在しない人格」と同じに見せる。

**Architecture:** 他の slice は、profile の表示と role の解決を `Profile` slice の `GetProfile` / `GetProfileByUsername` / `GetRole` に頼っている。この 3 つと、profile を一覧する repository の 3 つのメソッドを「見える profile」だけに絞ると、大半の読み取り経路に一括で効く。投稿の可視判定(`Social::UseCases::FilterVisiblePosts` / `ViewerCanSeePost`)は、著者の profile が見つからなければ不可視に改める。残るのは、profile が見つからないときに各 slice がどう振る舞うかで、経路ごとに決める(Decisions)。全経路を、無効化と退会手続きの 2 通りで、実 database を使う 1 本の spec で確かめる。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL 18 / RSpec。proto と frontend は変わらない。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(Visibility、Testing strategy の「可視性」、Open questions の 2 項目め、Delivery の段 8)

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で適用して確かめてある。plan に載せた patch をゼロから再適用して、同じ差分(27 ファイル)になることも確かめた。最終結果は monolith `692 examples, 0 failures`。各 Step の Expected のうち数を示したものは、その再適用での実測である。足した spec は、対象の行を壊すと赤になることを 1 経路ずつ確かめてある(Review Focus)。可視性の spec は繰り返し実行して結果が変わらないことを確かめた。

この plan は stack の 8 段目の後半で、P8a と同じブランチ `feat/dystopia-multi-profile-lifecycle` に積む。

## Decisions

spec の Open questions(「2 つの集約点で隠れない読み取り経路の全量」)に対する、経路ごとの決定。「見えない人格」は、無効な人格と、退会手続き中の account の人格を指す。

| 経路 | 見えない人格の扱い | 理由 |
|---|---|---|
| profile の取得(id・username)、検索、おすすめ、都道府県別 | 返さない。`GetRole` も `nil` を返す | spec の集約点 1 |
| 投稿(単体、著者別の一覧、フィード 3 種、検索、ランキング、ブックマーク、いいねした投稿) | 見えない人格の投稿を返さない | spec の集約点 2 |
| **著者別の投稿一覧(`ListPosts`)** | この RPC は可視判定を通していなかったので、通すようにした。**非公開の cast の投稿がフォローしていない相手に返り、ブロックした相手にも返っていた**(実測で確認した既存の漏れ)。あわせて直る | 見えない人格の投稿を隠すには可視判定を通す必要があり、通せば公開範囲と block も正しく効く |
| 他人の投稿に付けたコメント・返信 | 一覧から落とす | 削除された人格のコメントは purge で消える。それと同じに見せる |
| フォロー・フォロワーの一覧 | 一覧から落とす(既存の挙動) | 同上 |
| フォローする | 何も作らず `status: "none"` を返す | 存在しない相手はフォローできない |
| DM | thread は相手なし(`counterpart` が無い)で残る。新しい thread を開くこと・送信はどちらも拒否(`INVALID_ARGUMENT`) | 削除された人格との thread は相手が `NULL` になって残る。それと同じに見せる |
| 通知 | 行為者が見えない通知を一覧から落とす | 削除された人格が行為者の通知は purge で消える |
| レビュー | 見えない人格が書いた・書かれたレビューを返さない。見えない人格にはレビューを書けない | 同上 |
| 足跡 | 一覧から落とす(既存の挙動)。見えない人格への訪問は記録しない | 同上 |
| スケジュール | 返さない | 同上 |
| mention | 見えない人格の username は mention として解決しない(行も通知も作らない) | 存在しない username と同じ |
| 件数(フォロー数・フォロワー数・いいね数・コメント数・返信数・各未読数) | **引かない** | 件数から人格は特定できない。全件数の query に可視性の join を足すコストに見合わない。無効化している間、一覧より件数が多く見えることがある |
| karte | 対象外(spec の決定)。記録は残り、表示名とアバターだけが空になる | |
| 本人 | 自分の account の人格は `ListMyProfiles` にだけ出る(無効の表示つき)。`GetProfile` では、本人からも見えない | 本人向けの入口を 1 つにして、公開の経路に例外を作らない |

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-lifecycle`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...` の形で実行する。patch の適用(`git apply`)は必ずリポジトリの root で実行する。下のディレクトリで実行すると、patch は 1 行も適用されずに成功として終わる。
- 判定基準: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。開始時点の基準は `671 examples, 0 failures`。
- patch は plan の code block の内容を 1 文字も変えずに file に保存して適用する。`git apply --check` が失敗したら、保存した file が plan と一致しているかを確かめる。patch を手で直して通さない。
- この plan が変える挙動は Decisions に書いたものだけである。それ以外の spec の期待値を書き換えて通すことはしない。既存の spec のうち 7 ファイルは、存在しない profile の id を fixture に使っていたので、実在する profile に替える(spec の patch に含まれる)。
- `ProfileRepository#find_by_id` / `find_by_username` / `role_of` / `username_available?` / `list_by_account` は絞らない。認証(interceptor)、人格の管理(無効化・有効化・削除)、username の重複検査は、見えない人格も対象にする必要がある。
- 行の並びに依存する比較を足さない(同じ example の中で作った行は `created_at` が同じ値になる)。
- テスト用 database に seed や手動の行を入れない。migration は足さない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan が足すコメントは patch に含まれる 1 行だけである。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` と pull request の作成はしない(区切りの判断と push は controller が行う)。
- 依存を追加しない。`bundle install` を実行しない。

## Review Focus

見えない人格が漏れてもエラーにならない箇所。すべて Task 1 の `spec/slices/profile/visibility_wiring_spec.rb` が、無効化と退会手続きの 2 通りで確かめる。括弧内は、その行を壊して spec が落ちることを確かめた変異。

1. 「見える profile」の条件そのもの(無効の条件を外す / 退会手続きの条件を外す → それぞれの context の 8 件が落ちる)。
2. profile の一覧 3 つ(検索・おすすめ・都道府県別)。後段で `GetProfile` が落とすので結果は同じに見えるが、絞らないとページが短くなる(repository の 3 メソッドをそれぞれ絞らない状態に戻す)。
3. 投稿の可視判定 2 つと、著者別の投稿一覧(著者が見つからない投稿を公開扱いに戻す / `ListPosts` の絞り込みを外す)。
4. `GetRole` と username での取得(絞らない状態に戻す)。
5. フォロー、DM の開始、DM の送信(それぞれの拒否を外す)。
6. 通知、コメント、返信、レビューの「相手側」(それぞれの絞り込みを外す)。
7. スケジュール、足跡の記録、mention(それぞれの判定を外す)。
8. `ListPosts` が公開範囲と block を守ること(`spec/slices/post/cross_slice_wiring_spec.rb` の例。絞り込みを外すと落ちる)。
9. 元に戻せること。隠すのは読み取りだけで、行は消さない(有効に戻す・退会を取り消すと、profile・投稿・フォロワーが再び見える)。

---

### Task 1: Hide disabled profiles and profiles of deactivated accounts

**Files:**
- Create: `dystopia/monolith/spec/slices/profile/visibility_wiring_spec.rb`
- Modify: `slices/profile/repositories/profile_repository.rb`、`slices/profile/use_cases/get_profile.rb`、`get_profile_by_username.rb`、`get_role.rb`
- Modify: `slices/social/use_cases/filter_visible_posts.rb`、`viewer_can_see_post.rb`、`follows/follow.rb`
- Modify: `slices/post/grpc/post_handler.rb`、`slices/post/use_cases/comments/list_comments.rb`、`list_replies.rb`、`slices/post/use_cases/extract_mentions.rb`
- Modify: `slices/messaging/use_cases/get_or_create_thread.rb`、`send_message.rb`、`slices/notifications/use_cases/list_notifications.rb`、`slices/review/use_cases/filter_visible_entries.rb`、`slices/schedule/use_cases/list_schedules.rb`、`slices/footprints/use_cases/record_visit.rb`
- Modify(spec): `spec/slices/post/cross_slice_wiring_spec.rb`、`spec/slices/profile/grpc/profile_handler_spec.rb`、`spec/slices/review/use_cases/filter_visible_entries_spec.rb`、`spec/slices/messaging/use_cases/send_message_spec.rb`、`get_or_create_thread_spec.rb`、`spec/slices/footprints/use_cases/record_visit_spec.rb`、`spec/slices/schedule/use_cases/list_schedules_spec.rb`、`spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb`、`spec/slices/post/use_cases/extract_mentions_spec.rb`

**Interfaces:**
- Produces:
  - `ProfileRepository#find_visible_by_id(id)` / `find_visible_by_username(username)` / `visible_role_of(profile_id)`。`list_recent` / `search_by_query` / `profile_ids_by_prefecture` は見える profile だけを返す
  - `Profile::Slice["use_cases.get_profile"]` / `get_profile_by_username` / `get_role` は、見えない人格に対して `nil` を返す(引数は変わらない)
  - `Messaging::UseCases::SendMessage` と `GetOrCreateThread` は `get_profile:` を注入できる(spec 用)。`Review::UseCases::FilterVisibleEntries` も同じ

- [ ] **Step 1: spec を足す・書き換える(失敗する)**

次の内容を `/tmp/p8b-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8b-spec.patch && git apply /tmp/p8b-spec.patch` を実行する。

```diff
diff --git a/dystopia/monolith/spec/slices/footprints/use_cases/record_visit_spec.rb b/dystopia/monolith/spec/slices/footprints/use_cases/record_visit_spec.rb
index f035cd03..01e7fe1a 100644
--- a/dystopia/monolith/spec/slices/footprints/use_cases/record_visit_spec.rb
+++ b/dystopia/monolith/spec/slices/footprints/use_cases/record_visit_spec.rb
@@ -5,8 +5,8 @@ require "spec_helper"
 RSpec.describe Footprints::UseCases::RecordVisit do
   subject(:use_case) { Footprints::Slice["use_cases.record_visit"] }

-  let(:visitor) { SecureRandom.uuid_v7 }
-  let(:visited) { SecureRandom.uuid_v7 }
+  let(:visitor) { create_account_with_profile }
+  let(:visited) { create_account_with_profile(role: 2) }

   let(:visit_records) { Footprints::Slice["relations.visit_records"] }
   let(:blocks) { Social::Slice["relations.blocks"] }
diff --git a/dystopia/monolith/spec/slices/messaging/use_cases/get_or_create_thread_spec.rb b/dystopia/monolith/spec/slices/messaging/use_cases/get_or_create_thread_spec.rb
index b65d2da6..c4a5f017 100644
--- a/dystopia/monolith/spec/slices/messaging/use_cases/get_or_create_thread_spec.rb
+++ b/dystopia/monolith/spec/slices/messaging/use_cases/get_or_create_thread_spec.rb
@@ -3,7 +3,8 @@
 require "spec_helper"

 RSpec.describe Messaging::UseCases::GetOrCreateThread do
-  let(:use_case) { described_class.new(messaging_repo: messaging_repo, authorize_message: authorize_message) }
+  let(:use_case) { described_class.new(messaging_repo: messaging_repo, authorize_message: authorize_message, get_profile: get_profile) }
+  let(:get_profile) { double(:get_profile, call: double(:profile)) }
   let(:messaging_repo)   { double(:messaging_repository) }
   let(:authorize_message) { double(:authorize_message) }

diff --git a/dystopia/monolith/spec/slices/messaging/use_cases/send_message_spec.rb b/dystopia/monolith/spec/slices/messaging/use_cases/send_message_spec.rb
index b618487d..b581ef87 100644
--- a/dystopia/monolith/spec/slices/messaging/use_cases/send_message_spec.rb
+++ b/dystopia/monolith/spec/slices/messaging/use_cases/send_message_spec.rb
@@ -3,7 +3,8 @@
 require "spec_helper"

 RSpec.describe Messaging::UseCases::SendMessage do
-  let(:use_case) { described_class.new(messaging_repo: messaging_repo, authorize_message: authorize_message) }
+  let(:use_case) { described_class.new(messaging_repo: messaging_repo, authorize_message: authorize_message, get_profile: get_profile) }
+  let(:get_profile) { double(:get_profile, call: double(:profile)) }
   let(:messaging_repo)    { double(:messaging_repository) }
   let(:authorize_message) { double(:authorize_message) }

diff --git a/dystopia/monolith/spec/slices/post/cross_slice_wiring_spec.rb b/dystopia/monolith/spec/slices/post/cross_slice_wiring_spec.rb
index 8a3c3603..61851863 100644
--- a/dystopia/monolith/spec/slices/post/cross_slice_wiring_spec.rb
+++ b/dystopia/monolith/spec/slices/post/cross_slice_wiring_spec.rb
@@ -227,6 +227,24 @@ RSpec.describe "Post slice wiring with the slices that read posts", type: :datab
       expect(replies.replies.map(&:author_profile_id)).not_to include(blocked_profile)
     end

+    it "lists an author's posts only to viewers who may see them" do
+      authored_by = ->(author) { rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author)).posts.map(&:id) }
+
+      act_as(viewer)
+      expect(authored_by.call(public_author)).to eq([public_post.id])
+      expect(authored_by.call(private_author)).to be_empty
+      expect(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new).posts.map(&:id)).to eq([public_post.id])
+
+      follow_repo.follow(follower_profile_id: viewer, followee_profile_id: private_author, status: "approved")
+      expect(authored_by.call(private_author)).to eq([private_post.id])
+
+      Social::Slice["repositories.block_repository"].block(blocker_profile_id: public_author, blocked_profile_id: viewer)
+      expect(authored_by.call(public_author)).to be_empty
+
+      act_as(private_author)
+      expect(authored_by.call(private_author)).to eq([private_post.id])
+    end
+
     it "serves the feed with hydrated posts" do
       act_as(viewer)

diff --git a/dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb b/dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb
index 82d7a992..d5e09fd0 100644
--- a/dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb
+++ b/dystopia/monolith/spec/slices/post/use_cases/extract_mentions_spec.rb
@@ -75,7 +75,7 @@ RSpec.describe "Post::UseCases::ExtractMentions", type: :database do
     id = create_profile(username: "alice_1")
     extractor = Post::UseCases::ExtractMentions.new(profile_repo: profile_repo)

-    expect(profile_repo).to receive(:find_by_username).with("alice_1").once.and_call_original
+    expect(profile_repo).to receive(:find_visible_by_username).with("alice_1").once.and_call_original

     result = extractor.call(content: "@alice_1 @alice_1 @alice_1")

diff --git a/dystopia/monolith/spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb b/dystopia/monolith/spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb
index 20151cfd..565dc62f 100644
--- a/dystopia/monolith/spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb
+++ b/dystopia/monolith/spec/slices/post/use_cases/likes/list_liked_posts_by_profile_spec.rb
@@ -9,7 +9,7 @@ RSpec.describe "Post::UseCases::Likes::ListLikedPostsByProfile", type: :database
   let(:like_repo) { Hanami.app.slices[:post]["repositories.like_repository"] }
   let(:profile_id) { SecureRandom.uuid_v7 }
   let(:other_profile_id) { SecureRandom.uuid_v7 }
-  let(:post) { post_repo.create_post(author_profile_id: SecureRandom.uuid_v7, content: "Liked post", visibility: "public") }
+  let(:post) { post_repo.create_post(author_profile_id: create_account_with_profile(role: 2), content: "Liked post", visibility: "public") }

   before { like_repo.profile_like(post_id: post.id, profile_id: profile_id) }

diff --git a/dystopia/monolith/spec/slices/profile/grpc/profile_handler_spec.rb b/dystopia/monolith/spec/slices/profile/grpc/profile_handler_spec.rb
index 77bf6d6e..fe0c2177 100644
--- a/dystopia/monolith/spec/slices/profile/grpc/profile_handler_spec.rb
+++ b/dystopia/monolith/spec/slices/profile/grpc/profile_handler_spec.rb
@@ -110,15 +110,17 @@ RSpec.describe Profile::Grpc::ProfileHandler, type: :database do
       }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
     end

-    it "does not report the disabled state of a profile owned by another account" do
+    it "returns no profile for a disabled profile, as for one that does not exist" do
       other = create_account_with_profile(disabled_at: Time.now)
       account_id = create_account(role: 1)
       Current.account_id = account_id
       Current.profile_id = create_account_with_profile(account_id: account_id)

-      response = handler_for(::Profile::V1::GetProfileRequest.new(profile_id: other)).get_profile
+      disabled = handler_for(::Profile::V1::GetProfileRequest.new(profile_id: other)).get_profile
+      missing = handler_for(::Profile::V1::GetProfileRequest.new(profile_id: SecureRandom.uuid_v7)).get_profile

-      expect(response.profile.disabled).to be false
+      expect(disabled.profile).to be_nil
+      expect(disabled).to eq(missing)
     end
   end

diff --git a/dystopia/monolith/spec/slices/profile/visibility_wiring_spec.rb b/dystopia/monolith/spec/slices/profile/visibility_wiring_spec.rb
new file mode 100644
index 00000000..73552246
--- /dev/null
+++ b/dystopia/monolith/spec/slices/profile/visibility_wiring_spec.rb
@@ -0,0 +1,210 @@
+# frozen_string_literal: true
+
+require "spec_helper"
+require "lib/current"
+require "gruf"
+require "lib/grpc/authenticatable"
+require "slices/profile/grpc/profile_handler"
+require "slices/post/grpc/post_handler"
+require "slices/feed/grpc/handler"
+require "slices/review/grpc/review_handler"
+require "slices/footprints/grpc/footprints_handler"
+
+RSpec.describe "Visibility of a profile that others must not see", type: :database do
+  let(:db) { Hanami.app["db.gateway"].connection }
+  let(:post_repo) { Post::Slice["repositories.post_repository"] }
+  let(:comment_repo) { Post::Slice["repositories.comment_repository"] }
+  let(:like_repo) { Post::Slice["repositories.like_repository"] }
+  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
+  let(:review_repo) { Review::Slice["repositories.entry_repository"] }
+
+  let(:ghost_account) { create_account(role: 2) }
+  let!(:ghost) { create_account_with_profile(account_id: ghost_account, username: "ghost_cast", display_name: "Ghost", prefecture: "東京都") }
+  let!(:shown) { create_account_with_profile(role: 2, username: "shown_cast", display_name: "Shown", prefecture: "東京都") }
+  let!(:viewer) { create_account_with_profile(username: "visible_viewer") }
+  let!(:stranger) { create_account_with_profile(username: "visible_stranger") }
+
+  let!(:ghost_post) { post_repo.create_post(author_profile_id: ghost, content: "visibility ghost", visibility: "public") }
+  let!(:shown_post) { post_repo.create_post(author_profile_id: shown, content: "visibility shown", visibility: "public") }
+  let!(:shown_comment) { comment_repo.create_comment(post_id: shown_post.id, author_profile_id: viewer, content: "by viewer") }
+
+  def rpc(handler_class, method, message)
+    handler_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
+  end
+
+  def act_as(profile_id)
+    Current.account_id = SecureRandom.uuid_v7
+    Current.profile_id = profile_id
+  end
+
+  def status(code)
+    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
+  end
+
+  def post_ids(posts)
+    posts.map(&:id)
+  end
+
+  before do
+    comment_repo.create_comment(post_id: shown_post.id, author_profile_id: ghost, content: "by ghost")
+    comment_repo.create_comment(post_id: shown_post.id, author_profile_id: ghost, content: "reply by ghost", parent_id: shown_comment.id)
+    like_repo.profile_like(post_id: ghost_post.id, profile_id: viewer)
+    Bookmarks::Slice["repositories.bookmark_repository"].bookmark(profile_id: viewer, post_id: ghost_post.id)
+    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: ghost, status: "approved")
+    follow_repo.follow(follower_profile_id: ghost, followee_profile_id: viewer, status: "approved")
+    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: shown, status: "approved")
+    Messaging::Slice["use_cases.send_message"].call(sender_profile_id: ghost, content: "hello", recipient_profile_id: viewer)
+    Notifications::Slice["use_cases.emit"].call(recipient_profile_id: viewer, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: ghost)
+    Notifications::Slice["use_cases.emit"].call(recipient_profile_id: viewer, type: "like", target_resource_id: SecureRandom.uuid_v7, actor_profile_id: shown)
+    review_repo.create(author_profile_id: ghost, target_profile_id: shown, rating: 4.0, body: "by ghost")
+    review_repo.create(author_profile_id: viewer, target_profile_id: ghost, rating: 4.0, body: "about ghost")
+    review_repo.create(author_profile_id: viewer, target_profile_id: shown, rating: 4.0, body: "about shown")
+    Footprints::Slice["repositories.footprints_repository"].upsert_visit(visitor_profile_id: ghost, visited_profile_id: viewer)
+    Footprints::Slice["repositories.footprints_repository"].upsert_visit(visitor_profile_id: shown, visited_profile_id: viewer)
+    Schedule::Slice["repositories.schedule_repository"].upsert(profile_id: ghost, work_date: "2026-10-20", start_time: "20:00", end_time: "02:00")
+  end
+
+  after { Current.clear }
+
+  shared_examples "a profile that reads as nonexistent" do
+    before { hide.call }
+
+    it "is not returned by the profile lookups, the search or the suggestions" do
+      act_as(viewer)
+
+      expect(rpc(Profile::Grpc::ProfileHandler, :get_profile, Profile::V1::GetProfileRequest.new(profile_id: ghost)).profile).to be_nil
+      expect {
+        rpc(Profile::Grpc::ProfileHandler, :get_profile_by_username, Profile::V1::GetProfileByUsernameRequest.new(username: "ghost_cast"))
+      }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
+      expect(Discovery::Slice["use_cases.search_users"].call(query: "_cast")[:profiles].map(&:id)).to eq([shown])
+      expect(Discovery::Slice["use_cases.suggest_users"].call(viewer_profile_id: stranger)[:profiles].map(&:id)).to eq([shown])
+      expect(Profile::Slice["use_cases.get_role"].call(profile_id: ghost)).to be_nil
+      expect(Post::UseCases::ExtractMentions.new.call(content: "@ghost_cast @shown_cast").map { |mention| mention[:profile_id] }).to eq([shown])
+    end
+
+    it "is left out of the profile lists before they are paged" do
+      repo = Hanami.app.slices[:profile]["repositories.profile_repository"]
+
+      expect(repo.search_by_query(query: "_cast").map(&:id)).to eq([shown])
+      expect(repo.list_recent(limit: 10).map(&:id)).to contain_exactly(shown, viewer, stranger)
+      expect(repo.profile_ids_by_prefecture("東京都")).to eq([shown])
+      expect(repo.find_by_id(ghost).id).to eq(ghost)
+      expect(repo.username_available?("ghost_cast")).to be false
+    end
+
+    it "has no posts anywhere a post is read" do
+      act_as(viewer)
+
+      expect { rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: ghost_post.id)) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
+      expect(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: ghost)).posts).to be_empty
+      expect(post_ids(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new).posts)).to eq([shown_post.id])
+      expect(post_ids(rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_ALL)).posts)).to eq([shown_post.id])
+      expect(post_ids(rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_FOLLOWING)).posts)).to eq([shown_post.id])
+      expect(post_ids(rpc(Feed::Grpc::Handler, :list_feed, Feed::V1::ListFeedRequest.new(filter: :FEED_FILTER_AREA, prefecture: "東京都")).posts)).to eq([shown_post.id])
+      expect(post_ids(Discovery::Slice["use_cases.search_posts"].call(query: "visibility", viewer_profile_id: viewer)[:posts])).to eq([shown_post.id])
+      expect(post_ids(Discovery::Slice["use_cases.rank_posts"].call(period: "all", viewer_profile_id: viewer)[:posts])).to eq([shown_post.id])
+      expect(Bookmarks::Slice["use_cases.list_bookmarks"].call(profile_id: viewer)[:posts]).to be_empty
+      expect(Post::Slice["use_cases.likes.list_liked_posts_by_profile"].call(profile_id: viewer, viewer_profile_id: viewer)[:posts]).to be_empty
+    end
+
+    it "has no comments or replies under other profiles' posts" do
+      comments = Post::Slice["use_cases.comments.list_comments"].call(post_id: shown_post.id)[:comments]
+      replies = Post::Slice["use_cases.comments.list_replies"].call(comment_id: shown_comment.id)[:replies]
+
+      expect(comments.map(&:author_profile_id)).to eq([viewer])
+      expect(replies).to be_empty
+    end
+
+    it "is absent from follow lists and cannot be followed" do
+      followers = Social::Slice["use_cases.follows.list_followers"].call(profile_id: viewer)[:profiles]
+      following = Social::Slice["use_cases.follows.list_following"].call(profile_id: viewer)[:profiles]
+      attempt = Social::Slice["use_cases.follows.follow"].call(follower_profile_id: stranger, target_profile_id: ghost)
+
+      expect(followers.map(&:id)).to be_empty
+      expect(following.map(&:id)).to eq([shown])
+      expect(attempt[:status]).to eq("none")
+      expect(db[:social__follows].where(follower_profile_id: stranger).count).to eq(0)
+    end
+
+    it "leaves its conversation without a counterpart and cannot be messaged" do
+      threads = Messaging::Slice["use_cases.list_threads"].call(profile_id: viewer)[:threads]
+      thread_id = threads.first[:row].id
+      send_message = Messaging::Slice["use_cases.send_message"]
+      open_thread = Messaging::Slice["use_cases.get_or_create_thread"]
+
+      expect(threads.map { |thread| thread[:counterpart] }).to eq([nil])
+      expect { send_message.call(sender_profile_id: viewer, content: "anyone?", thread_id: thread_id) }
+        .to raise_error(Messaging::UseCases::SendMessage::RecipientUnresolvedError)
+      expect { open_thread.call(viewer_profile_id: shown, recipient_profile_id: ghost) }
+        .to raise_error(Messaging::UseCases::GetOrCreateThread::RecipientUnresolvedError)
+      expect(db[:messaging__messages].count).to eq(1)
+      expect(db[:messaging__threads].count).to eq(1)
+    end
+
+    it "is absent from notifications, footprints and schedules" do
+      notifications = Notifications::Slice["use_cases.list_notifications"].call(recipient_profile_id: viewer)
+      act_as(viewer)
+      footprints = rpc(Footprints::Grpc::FootprintsHandler, :list_footprints, Footprints::V1::ListFootprintsRequest.new).footprints
+      schedules = Schedule::Slice["use_cases.list_schedules"].call(profile_id: ghost, from_date: "2026-10-01", to_date: "2026-10-31")
+
+      expect(notifications[:rows].map(&:latest_actor_profile_id)).to eq([shown])
+      expect(footprints.map { |footprint| footprint.visitor.id }).to eq([shown])
+      expect(schedules).to be_empty
+      expect(Footprints::Slice["use_cases.record_visit"].call(visitor_profile_id: stranger, visited_profile_id: ghost)).to be_nil
+      expect(db[:footprints__visits].where(visited_profile_id: ghost).count).to eq(0)
+    end
+
+    it "has no reviews as author or target and cannot be reviewed" do
+      act_as(stranger)
+      by_target = ->(profile_id) { rpc(Review::Grpc::ReviewHandler, :list_entries_by_target, Review::V1::ListEntriesByTargetRequest.new(target_profile_id: profile_id)).entries }
+      by_author = ->(profile_id) { rpc(Review::Grpc::ReviewHandler, :list_entries_by_author, Review::V1::ListEntriesByAuthorRequest.new(author_profile_id: profile_id)).entries }
+      recent = rpc(Review::Grpc::ReviewHandler, :list_recent_entries, Review::V1::ListRecentEntriesRequest.new).entries
+
+      expect(by_target.call(shown).map(&:author_profile_id)).to eq([viewer])
+      expect(by_target.call(ghost)).to be_empty
+      expect(by_author.call(ghost)).to be_empty
+      expect(by_author.call(viewer).map(&:target_profile_id)).to eq([shown])
+      expect(recent.map { |entry| [entry.author_profile_id, entry.target_profile_id] }).to eq([[viewer, shown]])
+      expect {
+        rpc(Review::Grpc::ReviewHandler, :create_entry, Review::V1::CreateEntryRequest.new(target_profile_id: ghost, rating: 4.0))
+      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
+    end
+
+    it "is still listed for its own account and comes back when it is shown again" do
+      Current.account_id = ghost_account
+      mine = rpc(Profile::Grpc::ProfileHandler, :list_my_profiles, Profile::V1::ListMyProfilesRequest.new).profiles
+      expect(mine.map(&:id)).to eq([ghost])
+
+      show.call
+      act_as(viewer)
+
+      expect(rpc(Profile::Grpc::ProfileHandler, :get_profile, Profile::V1::GetProfileRequest.new(profile_id: ghost)).profile.id).to eq(ghost)
+      expect(rpc(Post::Grpc::PostHandler, :get_post, Post::V1::GetPostRequest.new(id: ghost_post.id)).post.id).to eq(ghost_post.id)
+      expect(Social::Slice["use_cases.follows.list_followers"].call(profile_id: viewer)[:profiles].map(&:id)).to eq([ghost])
+    end
+  end
+
+  context "when the profile is disabled" do
+    let(:hide) { -> { db[:profile__profiles].where(id: ghost).update(disabled_at: Time.now) } }
+    let(:show) { -> { db[:profile__profiles].where(id: ghost).update(disabled_at: nil) } }
+
+    it_behaves_like "a profile that reads as nonexistent"
+  end
+
+  context "when the profile's account is deactivated" do
+    let(:hide) { -> { db[:identity__accounts].where(id: ghost_account).update(deactivated_at: Time.now) } }
+    let(:show) { -> { db[:identity__accounts].where(id: ghost_account).update(deactivated_at: nil) } }
+
+    it_behaves_like "a profile that reads as nonexistent"
+  end
+
+  it "shows the profile everywhere while it is enabled and its account is active" do
+    act_as(viewer)
+
+    expect(rpc(Profile::Grpc::ProfileHandler, :get_profile, Profile::V1::GetProfileRequest.new(profile_id: ghost)).profile.id).to eq(ghost)
+    expect(post_ids(rpc(Post::Grpc::PostHandler, :list_posts, Post::V1::ListPostsRequest.new(author_profile_id: ghost)).posts)).to eq([ghost_post.id])
+    expect(Post::Slice["use_cases.comments.list_comments"].call(post_id: shown_post.id)[:comments].map(&:author_profile_id)).to contain_exactly(viewer, ghost)
+    expect(Notifications::Slice["use_cases.list_notifications"].call(recipient_profile_id: viewer)[:rows].map(&:latest_actor_profile_id)).to contain_exactly(ghost, shown)
+    expect(Schedule::Slice["use_cases.list_schedules"].call(profile_id: ghost, from_date: "2026-10-01", to_date: "2026-10-31").length).to eq(1)
+  end
+end
diff --git a/dystopia/monolith/spec/slices/review/use_cases/filter_visible_entries_spec.rb b/dystopia/monolith/spec/slices/review/use_cases/filter_visible_entries_spec.rb
index aff09e91..f35ae1da 100644
--- a/dystopia/monolith/spec/slices/review/use_cases/filter_visible_entries_spec.rb
+++ b/dystopia/monolith/spec/slices/review/use_cases/filter_visible_entries_spec.rb
@@ -7,9 +7,11 @@ RSpec.describe Review::UseCases::FilterVisibleEntries do
     described_class.new(
       cast_settings_repo: cast_settings_repo,
       block_adapter: block_adapter,
-      filter_visible_posts: filter_visible_posts
+      filter_visible_posts: filter_visible_posts,
+      get_profile: get_profile
     )
   end
+  let(:get_profile) { double(:get_profile, call: double(:profile)) }
   let(:cast_settings_repo) { double(:cast_settings_repository) }
   let(:block_adapter) { double(:block_adapter) }
   let(:filter_visible_posts) { double(:filter_visible_posts) }
@@ -82,6 +84,15 @@ RSpec.describe Review::UseCases::FilterVisibleEntries do
     expect(result).to eq(entries)
   end

+  it "drops an entry whose other party cannot be resolved" do
+    allow(get_profile).to receive(:call).with(profile_id: other_id).and_return(nil)
+    entries = [entry(author: page_owner_id, target: other_id, hidden: false)]
+
+    result = use_case.call(viewer_profile_id: viewer_id, page_owner_profile_id: page_owner_id, entries: entries)
+
+    expect(result).to be_empty
+  end
+
   it "raises when an entry has neither party as the page owner" do
     entries = [entry(author: viewer_id, target: other_id, hidden: false)]

diff --git a/dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb b/dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb
index 2b9ba3a8..fc303a37 100644
--- a/dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb
+++ b/dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb
@@ -6,7 +6,7 @@ require "errors/validation_error"
 RSpec.describe "Schedule::UseCases::ListSchedules", type: :database do
   let(:uc) { Hanami.app.slices[:schedule]["use_cases.list_schedules"] }
   let(:save_uc) { Hanami.app.slices[:schedule]["use_cases.save_schedule"] }
-  let(:profile_id) { SecureRandom.uuid_v7 }
+  let(:profile_id) { create_account_with_profile(role: 2) }

   it "returns rows within the date range" do
     save_uc.call(profile_id: profile_id, work_date: "2026-09-20", start_time: "20:00", end_time: "02:00")
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/profile spec/slices/post spec/slices/messaging spec/slices/footprints spec/slices/schedule spec/slices/review > /tmp/rspec-p8b-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p8b-red.txt`
Expected: `374 examples, 35 failures`

- [ ] **Step 2: 実装する**

次の内容を `/tmp/p8b-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8b-impl.patch && git apply /tmp/p8b-impl.patch` を実行する。

```diff
diff --git a/dystopia/monolith/slices/post/use_cases/extract_mentions.rb b/dystopia/monolith/slices/post/use_cases/extract_mentions.rb
index baa81d55..a39e49a0 100644
--- a/dystopia/monolith/slices/post/use_cases/extract_mentions.rb
+++ b/dystopia/monolith/slices/post/use_cases/extract_mentions.rb
@@ -16,7 +16,7 @@ module Post
         content.to_s.scan(MENTION_PATTERN) { matches << Regexp.last_match }

         profiles_by_username = matches.map { |match| match[1].downcase }.uniq.each_with_object({}) do |username, hash|
-          profile = profile_repo.find_by_username(username)
+          profile = profile_repo.find_visible_by_username(username)
           hash[username] = profile if profile
         end

diff --git a/dystopia/monolith/slices/social/use_cases/follows/follow.rb b/dystopia/monolith/slices/social/use_cases/follows/follow.rb
index b5eeb6a2..ba6a7b90 100644
--- a/dystopia/monolith/slices/social/use_cases/follows/follow.rb
+++ b/dystopia/monolith/slices/social/use_cases/follows/follow.rb
@@ -13,8 +13,9 @@ module Social
           end

           profile = get_profile.call(profile_id: target_profile_id)
-          is_private = profile.respond_to?(:is_private) ? !!profile.is_private : false
-          status = is_private ? "pending" : "approved"
+          return { status: "none", reason: :not_found } unless profile
+
+          status = profile.is_private ? "pending" : "approved"

           result = follow_repo.follow(follower_profile_id: follower_profile_id, followee_profile_id: target_profile_id, status: status)

diff --git a/dystopia/monolith/slices/social/use_cases/viewer_can_see_post.rb b/dystopia/monolith/slices/social/use_cases/viewer_can_see_post.rb
index fad27d0d..614827f4 100644
--- a/dystopia/monolith/slices/social/use_cases/viewer_can_see_post.rb
+++ b/dystopia/monolith/slices/social/use_cases/viewer_can_see_post.rb
@@ -18,8 +18,8 @@ module Social
         end

         profile = get_profile.call(profile_id: author_profile_id)
-        is_private = profile.respond_to?(:is_private) ? !!profile.is_private : false
-        return true unless is_private
+        return false unless profile
+        return true unless profile.is_private

         return false unless viewer_profile_id

diff --git a/dystopia/monolith/slices/footprints/use_cases/record_visit.rb b/dystopia/monolith/slices/footprints/use_cases/record_visit.rb
index be211509..4fb6af33 100644
--- a/dystopia/monolith/slices/footprints/use_cases/record_visit.rb
+++ b/dystopia/monolith/slices/footprints/use_cases/record_visit.rb
@@ -11,6 +11,7 @@ module Footprints
         return nil if block_repo.blocked?(blocker_profile_id: visitor_profile_id, blocked_profile_id: visited_profile_id)
         return nil if block_repo.blocked?(blocker_profile_id: visited_profile_id, blocked_profile_id: visitor_profile_id)
         return nil unless visitor_records_visits?(visitor_profile_id)
+        return nil unless get_profile.call(profile_id: visited_profile_id)

         footprints_repo.upsert_visit(visitor_profile_id: visitor_profile_id, visited_profile_id: visited_profile_id)
       end
@@ -26,6 +27,10 @@ module Footprints
         prefs[:footprints_record_my_visits] != false
       end

+      def get_profile
+        @get_profile ||= Profile::Slice["use_cases.get_profile"]
+      end
+
       def notifications_get_prefs
         @notifications_get_prefs ||= Notifications::Slice["use_cases.get_preferences"]
       end
diff --git a/dystopia/monolith/slices/messaging/use_cases/get_or_create_thread.rb b/dystopia/monolith/slices/messaging/use_cases/get_or_create_thread.rb
index 5e3a14ca..f81dc745 100644
--- a/dystopia/monolith/slices/messaging/use_cases/get_or_create_thread.rb
+++ b/dystopia/monolith/slices/messaging/use_cases/get_or_create_thread.rb
@@ -13,11 +13,19 @@ module Messaging
       BlockedError = Class.new(StandardError)
       RecipientUnresolvedError = Class.new(StandardError)

+      def initialize(get_profile: nil, **kwargs)
+        super(**kwargs)
+        @get_profile = get_profile
+      end
+
       def call(viewer_profile_id:, recipient_profile_id:)
         if recipient_profile_id.nil? || recipient_profile_id.to_s.empty?
           raise RecipientUnresolvedError, "recipient_profile_id required"
         end
         raise SelfMessageError, "viewer == recipient" if viewer_profile_id.to_s == recipient_profile_id.to_s
+
+        counterpart = get_profile.call(profile_id: recipient_profile_id)
+        raise RecipientUnresolvedError, "recipient not found" unless counterpart
         raise BlockedError, "blocked" if bidirectionally_blocked?(viewer_profile_id, recipient_profile_id)
         unless authorize_message.call(sender_profile_id: viewer_profile_id, recipient_profile_id: recipient_profile_id)
           raise FollowRequiredError, "follow required"
@@ -29,7 +37,7 @@ module Messaging

         {
           row: row,
-          counterpart: get_profile.call(profile_id: recipient_profile_id),
+          counterpart: counterpart,
           last_message: messaging_repo.last_message(thread_id: thread_id),
           unread_count: messaging_repo.unread_count(thread_id: thread_id, profile_id: viewer_profile_id)
         }
diff --git a/dystopia/monolith/slices/messaging/use_cases/send_message.rb b/dystopia/monolith/slices/messaging/use_cases/send_message.rb
index 81ad6247..3d42558c 100644
--- a/dystopia/monolith/slices/messaging/use_cases/send_message.rb
+++ b/dystopia/monolith/slices/messaging/use_cases/send_message.rb
@@ -18,6 +18,11 @@ module Messaging
       EmptyContentError = Class.new(StandardError)
       RecipientUnresolvedError = Class.new(StandardError)

+      def initialize(get_profile: nil, **kwargs)
+        super(**kwargs)
+        @get_profile = get_profile
+      end
+
       def call(sender_profile_id:, content:, thread_id: nil, recipient_profile_id: nil)
         raise EmptyContentError, "content is required" if content.nil? || content.to_s.strip.empty?

@@ -28,6 +33,7 @@ module Messaging
         )

         raise SelfMessageError, "sender == recipient" if sender_profile_id.to_s == resolved_recipient_profile_id.to_s
+        raise RecipientUnresolvedError, "recipient not found" unless get_profile.call(profile_id: resolved_recipient_profile_id)
         raise BlockedError, "blocked" if bidirectionally_blocked?(sender_profile_id, resolved_recipient_profile_id)
         unless authorize_message.call(sender_profile_id: sender_profile_id, recipient_profile_id: resolved_recipient_profile_id)
           raise FollowRequiredError, "follow required"
@@ -75,6 +81,10 @@ module Messaging
         @social_block_repo ||= Social::Slice["repositories.block_repository"]
       end

+      def get_profile
+        @get_profile ||= Profile::Slice["use_cases.get_profile"]
+      end
+
       def bidirectionally_blocked?(a, b)
         social_block_repo.blocked?(blocker_profile_id: a, blocked_profile_id: b) ||
           social_block_repo.blocked?(blocker_profile_id: b, blocked_profile_id: a)
diff --git a/dystopia/monolith/slices/notifications/use_cases/list_notifications.rb b/dystopia/monolith/slices/notifications/use_cases/list_notifications.rb
index fff50ae2..9b1f13d8 100644
--- a/dystopia/monolith/slices/notifications/use_cases/list_notifications.rb
+++ b/dystopia/monolith/slices/notifications/use_cases/list_notifications.rb
@@ -25,7 +25,7 @@ module Notifications
         end

         {
-          rows: result[:items],
+          rows: result[:items].select { |row| profiles_by_actor_profile_id[row.latest_actor_profile_id] },
           profiles_by_actor_profile_id: profiles_by_actor_profile_id,
           next_cursor: result[:next_cursor],
           has_more: result[:has_more],
diff --git a/dystopia/monolith/slices/post/grpc/post_handler.rb b/dystopia/monolith/slices/post/grpc/post_handler.rb
index 73eb6a71..c99755df 100644
--- a/dystopia/monolith/slices/post/grpc/post_handler.rb
+++ b/dystopia/monolith/slices/post/grpc/post_handler.rb
@@ -37,6 +37,7 @@ module Post
         else
           ""
         end
+        rows = filter_visible_posts.call(viewer_profile_id: current_profile_id, posts: rows)

         ::Post::V1::ListPostsResponse.new(
           posts: present_posts(rows),
@@ -184,6 +185,10 @@ module Post
       def viewer_can_see_post
         @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
       end
+
+      def filter_visible_posts
+        @filter_visible_posts ||= Social::Slice["use_cases.filter_visible_posts"]
+      end
     end
   end
 end
diff --git a/dystopia/monolith/slices/post/use_cases/comments/list_comments.rb b/dystopia/monolith/slices/post/use_cases/comments/list_comments.rb
index ee46a230..06d23b3f 100644
--- a/dystopia/monolith/slices/post/use_cases/comments/list_comments.rb
+++ b/dystopia/monolith/slices/post/use_cases/comments/list_comments.rb
@@ -32,6 +32,7 @@ module Post

           author_profile_ids = comments.map(&:author_profile_id).uniq
           authors = build_authors(author_profile_ids)
+          comments = comments.select { |comment| authors.key?(comment.author_profile_id) }
           mentioned_usernames = build_mentioned_usernames(comments)

           { comments: comments, next_cursor: next_cursor, has_more: has_more, authors: authors, mentioned_usernames: mentioned_usernames }
diff --git a/dystopia/monolith/slices/post/use_cases/comments/list_replies.rb b/dystopia/monolith/slices/post/use_cases/comments/list_replies.rb
index d41255ee..a8874637 100644
--- a/dystopia/monolith/slices/post/use_cases/comments/list_replies.rb
+++ b/dystopia/monolith/slices/post/use_cases/comments/list_replies.rb
@@ -32,6 +32,7 @@ module Post

           author_profile_ids = replies.map(&:author_profile_id).uniq
           authors = build_authors(author_profile_ids)
+          replies = replies.select { |reply| authors.key?(reply.author_profile_id) }
           mentioned_usernames = build_mentioned_usernames(replies)

           { replies: replies, next_cursor: next_cursor, has_more: has_more, authors: authors, mentioned_usernames: mentioned_usernames }
diff --git a/dystopia/monolith/slices/profile/repositories/profile_repository.rb b/dystopia/monolith/slices/profile/repositories/profile_repository.rb
index 5c5a1361..9ce100a3 100644
--- a/dystopia/monolith/slices/profile/repositories/profile_repository.rb
+++ b/dystopia/monolith/slices/profile/repositories/profile_repository.rb
@@ -24,6 +24,18 @@ module Profile
         profiles.where { Sequel.function(:lower, :username) =~ username.downcase }.one
       end

+      def find_visible_by_id(id)
+        return nil unless uuid?(id)
+
+        visible_profiles.by_pk(id).one
+      end
+
+      def find_visible_by_username(username)
+        return nil if username.nil? || username.strip.empty?
+
+        visible_profiles.where { Sequel.function(:lower, :username) =~ username.downcase }.one
+      end
+
       def list_by_account(account_id)
         return [] unless uuid?(account_id)

@@ -85,7 +97,7 @@ module Profile
       def profile_ids_by_prefecture(prefecture)
         return [] if prefecture.nil? || prefecture.to_s.empty?

-        profiles.where(prefecture: prefecture).pluck(:id)
+        visible_profiles.where(prefecture: prefecture).pluck(:id)
       end

       def save_media(profile_id:, avatar_media_id: nil, cover_media_id: nil)
@@ -98,7 +110,7 @@ module Profile
       end

       def list_recent(limit:, cursor: nil, exclude_profile_ids: [], role_filter: nil)
-        scope = profiles
+        scope = visible_profiles
         scope = scope.exclude(id: exclude_profile_ids) unless exclude_profile_ids.empty?
         scope = filter_by_role(scope, role_filter)
         scope = apply_cursor(scope, cursor)
@@ -111,7 +123,7 @@ module Profile
         return [] if q.empty?

         pattern = "%#{q}%"
-        scope = profiles.where(
+        scope = visible_profiles.where(
           Sequel.|(
             Sequel.lit("username ILIKE ?", pattern),
             Sequel.lit("display_name ILIKE ?", pattern)
@@ -130,12 +142,26 @@ module Profile
         profiles.dataset.db[:identity__accounts].where(id: profile.account_id).get(:role)
       end

+      def visible_role_of(profile_id)
+        profile = find_visible_by_id(profile_id)
+        return nil unless profile
+
+        profiles.dataset.db[:identity__accounts].where(id: profile.account_id).get(:role)
+      end
+
       def delete(id)
         profiles.dataset.where(id: id).delete
       end

       private

+      # A disabled profile and every profile of a deactivated account read as nonexistent to other slices.
+      def visible_profiles
+        profiles.where(disabled_at: nil).where(
+          account_id: profiles.dataset.db[:identity__accounts].where(deactivated_at: nil).select(:id)
+        )
+      end
+
       def uuid?(value)
         UUID_FORMAT.match?(value.to_s)
       end
diff --git a/dystopia/monolith/slices/profile/use_cases/get_profile.rb b/dystopia/monolith/slices/profile/use_cases/get_profile.rb
index 6b9711d8..619e43f4 100644
--- a/dystopia/monolith/slices/profile/use_cases/get_profile.rb
+++ b/dystopia/monolith/slices/profile/use_cases/get_profile.rb
@@ -6,7 +6,7 @@ module Profile
       include Deps["repositories.profile_repository"]

       def call(profile_id:)
-        profile_repository.find_by_id(profile_id)
+        profile_repository.find_visible_by_id(profile_id)
       end
     end
   end
diff --git a/dystopia/monolith/slices/profile/use_cases/get_profile_by_username.rb b/dystopia/monolith/slices/profile/use_cases/get_profile_by_username.rb
index 289a41db..445a2510 100644
--- a/dystopia/monolith/slices/profile/use_cases/get_profile_by_username.rb
+++ b/dystopia/monolith/slices/profile/use_cases/get_profile_by_username.rb
@@ -6,7 +6,7 @@ module Profile
       include Deps["repositories.profile_repository"]

       def call(username:)
-        profile_repository.find_by_username(username)
+        profile_repository.find_visible_by_username(username)
       end
     end
   end
diff --git a/dystopia/monolith/slices/profile/use_cases/get_role.rb b/dystopia/monolith/slices/profile/use_cases/get_role.rb
index da061353..73634a85 100644
--- a/dystopia/monolith/slices/profile/use_cases/get_role.rb
+++ b/dystopia/monolith/slices/profile/use_cases/get_role.rb
@@ -6,7 +6,7 @@ module Profile
       include Deps["repositories.profile_repository"]

       def call(profile_id:)
-        profile_repository.role_of(profile_id)
+        profile_repository.visible_role_of(profile_id)
       end
     end
   end
diff --git a/dystopia/monolith/slices/review/use_cases/filter_visible_entries.rb b/dystopia/monolith/slices/review/use_cases/filter_visible_entries.rb
index 98ddccd2..9c7907b3 100644
--- a/dystopia/monolith/slices/review/use_cases/filter_visible_entries.rb
+++ b/dystopia/monolith/slices/review/use_cases/filter_visible_entries.rb
@@ -7,10 +7,11 @@ module Review

       include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

-      def initialize(cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil, **kwargs)
+      def initialize(cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil, get_profile: nil, **kwargs)
         super(**kwargs.merge(cast_settings_repo: cast_settings_repo).compact)
         @block_adapter = block_adapter
         @filter_visible_posts = filter_visible_posts
+        @get_profile = get_profile
       end

       def call(viewer_profile_id:, page_owner_profile_id:, entries:)
@@ -27,7 +28,10 @@ module Review
         return [] unless page_owner_reachable?(viewer_profile_id, page_owner_profile_id)

         blocked_ids = block_adapter.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)
-        visible.reject { |e| blocked_ids.include?(other_party_id(e, page_owner_profile_id)) }
+        visible.reject do |e|
+          other_party = other_party_id(e, page_owner_profile_id)
+          blocked_ids.include?(other_party) || get_profile.call(profile_id: other_party).nil?
+        end
       end

       private
@@ -61,6 +65,10 @@ module Review
       def filter_visible_posts
         @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
       end
+
+      def get_profile
+        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
+      end
     end
   end
 end
diff --git a/dystopia/monolith/slices/schedule/use_cases/list_schedules.rb b/dystopia/monolith/slices/schedule/use_cases/list_schedules.rb
index 3fe5a507..0c320651 100644
--- a/dystopia/monolith/slices/schedule/use_cases/list_schedules.rb
+++ b/dystopia/monolith/slices/schedule/use_cases/list_schedules.rb
@@ -12,12 +12,17 @@ module Schedule
       def call(profile_id:, from_date:, to_date:)
         validate_format!(from_date, "取得開始日")
         validate_format!(to_date, "取得終了日")
+        return [] unless get_profile.call(profile_id: profile_id)

         schedule_repo.list(profile_id: profile_id, from_date: from_date, to_date: to_date)
       end

       private

+      def get_profile
+        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
+      end
+
       def validate_format!(value, label)
         unless value.is_a?(String) && value.match?(DATE_FORMAT)
           raise Errors::ValidationError, "#{label}の形式が正しくありません"
diff --git a/dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb b/dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb
index 0b764d52..e6f7ba15 100644
--- a/dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb
+++ b/dystopia/monolith/slices/social/use_cases/filter_visible_posts.rb
@@ -15,9 +15,8 @@ module Social

         author_profile_ids = posts.map(&:author_profile_id).compact.uniq

-        is_private_by_author = author_profile_ids.each_with_object({}) do |aid, h|
-          profile = get_profile.call(profile_id: aid)
-          h[aid] = profile.respond_to?(:is_private) ? !!profile.is_private : false
+        profile_by_author = author_profile_ids.each_with_object({}) do |aid, h|
+          h[aid] = get_profile.call(profile_id: aid)
         end

         if viewer_profile_id
@@ -31,8 +30,9 @@ module Social
         posts.select do |post|
           author_profile_id = post.author_profile_id
           next true if viewer_profile_id && author_profile_id == viewer_profile_id
+          next false unless profile_by_author[author_profile_id]
           next false if blocked_set.include?(author_profile_id.to_s)
-          next true unless is_private_by_author[author_profile_id]
+          next true unless profile_by_author[author_profile_id].is_private
           next false unless viewer_profile_id

           follow_statuses[author_profile_id.to_s] == "approved"
```

Run(root): `git status --short | wc -l`
Expected: `27`

- [ ] **Step 3: 通ることを確認する**

Run(`dystopia/monolith`): Step 1 と同じ rspec のコマンド(出力先は `/tmp/rspec-p8b-green.txt`)。
Expected: `374 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `692 examples, 0 failures`

Run: `for i in 1 2 3 4 5; do HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/profile/visibility_wiring_spec.rb 2>&1 | /usr/bin/grep -E '^[0-9]+ examples'; done | sort | uniq -c`
Expected: 5 回とも `25 examples, 0 failures`

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add -A dystopia/monolith && git status --short && git commit -s -m "feat(dystopia/monolith): hide disabled profiles and profiles of deactivated accounts from other profiles" && cd dystopia/monolith
```

`git status --short` の出力が `dystopia/monolith` の下だけであることを確認してから commit する。

---

## Controller verification (not dispatched)

Task 1 の後、controller が実サーバーを起動して確認する(使い捨ての database に migrate と seed、`bin/grpc` と `next dev`)。frontend には無効化の画面がまだ無いので、無効化は gRPC を直接呼んで行い、見え方は BFF とブラウザで確かめる。

- cast の人格を無効化すると、他の profile から見て、プロフィールページが「見つからない」になり、フィード・検索・ランキング・フォロー一覧・通知・レビュー・足跡から消える。DM の thread は相手なしで残り、送信できない。
- 有効に戻すと、すべて元どおり見える。
- account を退会手続き中にすると、その account の全人格が同じように見えなくなる。
- 非公開の cast のプロフィールページの投稿が、フォローしていない profile には出ない(`ListPosts` の修正)。
- gRPC server のログに、意図しない ERROR が無い。

## Known gaps left for later plans

- 件数(フォロー数・フォロワー数・いいね数・コメント数・返信数、通知・足跡・DM の未読数)は、見えない人格の分を引かない(Decisions 参照)。
- 絞り込みを paging の後に行う経路(コメント、返信、通知、投稿の一覧、レビュー)は、見えない人格の分だけページが短くなることがある。
- `GetProfile` は、見つからない profile に対して `NOT_FOUND` ではなく空の応答を返す(以前から)。
- 退会手続き中の account 自身の session が残っている場合、その account の人格は本人からも `GetProfile` で見えない。interceptor は退会手続き中の account の request を拒否していない(以前から。ログインし直すと退会が取り消される)。
- 既に保存されている mention の行のうち、見えない人格を指すものは、username が空で表示される(行は消さない。人格が戻ると表示も戻る)。
- frontend の無効化・有効化・削除の画面は段 9 で作る。
- P1a〜P8a の Known gaps はそのまま残る。
