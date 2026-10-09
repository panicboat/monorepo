# Multi Profile P8a: Per-Profile Purge and Profile Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 人格(profile)を 1 つだけ消せるようにし、無効化・有効化・削除の RPC を足す。あわせて、段 1 から残していた別名 `current_user_id` を削除し、proto に account の id を表す field が無いことを検査する。

**Architecture:** これまで退会の purge は identity slice が各 slice の `PurgeAccount` を並べて呼び、失敗を握りつぶしていた。この plan では、1 つの profile のデータを全 slice から消す処理を profile slice の `PurgeProfile` に集め、profile の行を最後に消す。途中で失敗したら例外をそのまま上げるので、profile は残り、同じ呼び出しを繰り返せば続きから消せる。人格の削除(`DeleteProfile`)も退会の purge も、この 1 つの処理を使う。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL 18 / RSpec。frontend は buf で生成した stub だけが変わる。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(API contract の `profile.v1`、Profile lifecycle、Errors、Testing strategy、Delivery の段 8)。段 8 のうち、可視性(Visibility)は次の plan(P8b)で扱う。

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で通しで適用して確かめてある。plan に載せた patch をゼロから再適用して、同じ差分(48 ファイル)になることも確かめた。最終結果は monolith `663 examples, 0 failures`、frontend `tsc` エラー 0。各 Step の Expected のうち数を示したものは、その再適用での実測である。足した spec は、対象の行を壊すと赤になることを確かめてある(Review Focus の各行)。database を使う spec は、繰り返し実行して結果が変わらないことを確かめた。

この plan は stack の 8 段目の前半で、ブランチ `feat/dystopia-multi-profile-lifecycle`(`feat/dystopia-multi-profile-review` の上)に積む。

## Decisions

spec が決めていない点について、この plan が決めたこと。

| 論点 | 決定 | 理由 |
|---|---|---|
| 退会の purge が slice の失敗に出会ったとき | その account の purge を中断し、account を残す。次回の実行で最初からやり直す | 以前は失敗を握りつぶして account を消していたので、消し損ねた行が持ち主のいないまま残った。purge は何度実行しても同じ結果になるので、やり直せば済む。失敗は握りつぶされずログに出る |
| review の記録と公開設定 | 人格を消すとき、その人格が書いた・書かれたレビューと公開設定を消す | review には purge が無く、退会しても行が残っていた。残すと相手のいないレビューが溜まる |
| media のアップロード者 | 記録しない(現状のまま)。人格を消しても media の行には触れない | アップロード者を記録して人格と一緒に消すと、残すと決めた karte の記録に付いた画像まで消える。アップロード者の扱いは別件(Media uploader backfill)に任せる |
| 自分の account の人格へのレビュー | 拒否する(`INVALID_ARGUMENT`)。自分自身へのレビューも同じ規則で拒否される | 複数の人格を持てると、cast が自分の別の人格にレビューを書いて評価を上げられる。server は account を知っているので、本人以外に紐付きを漏らさずに判定できる。karte の「同じ account の別人格からは通報できない」と同じ考え方 |
| 他人の profile を指定した無効化・有効化・削除 | `NOT_FOUND` | 「その profile は存在するが自分のものではない」ことを知らせない |
| 既に無効な profile の無効化、既に有効な profile の有効化 | 何も変えずにその profile を返す | 連打や再送で失敗させない |

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-lifecycle`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。patch の適用(`git apply`)は必ずリポジトリの root(`.worktrees/feat-dystopia-multi-profile-model`)で実行する。下のディレクトリで実行すると、patch は 1 行も適用されずに成功として終わる。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0。開始時点の基準は rspec `647 examples, 0 failures`、`tsc` エラー 0。
- patch は plan の code block の内容を 1 文字も変えずに file に保存して適用する。`git apply --check` が失敗したら、保存した file が plan と一致しているかを確かめる。patch を手で直して通さない。
- この plan が変える挙動は Decisions と各 Task に書いたものだけである。それ以外の spec の期待値を書き換えて通すことはしない。
- database を使う spec は、同じ example の中で作った行の `created_at` が同じ値になる(transaction の中では `now()` が変わらない)。行の並びに依存する比較を足さない。
- テスト用 database に seed や手動の行を入れない。migration は足さない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan が足すコメントは patch に含まれる 3 行だけである。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` と pull request の作成はしない(区切りの判断と push は controller が行う)。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない。

## Review Focus

壊れてもエラーにならない箇所。各行のテストは括弧内のタスクに入れてある。

1. profile の行を消す順序。slice より先に消すと、途中で失敗したときに、持ち主のいない行が残って再実行もできない(Task 1 の `purge_profile_spec`。順序を入れ替えた場合と、失敗を握りつぶした場合に落ちることを確かめた)。
2. purge の対象から slice が抜けること。足し忘れてもエラーにならず、その slice の行が残る(Task 1 の `purge_profile_spec` が slice の一覧を固定し、`purge_wiring_spec` が行が消えることを確かめる。review を外すと両方落ちることを確かめた)。
3. 退会の purge が、失敗した account を消してしまうこと(Task 1 の `purge_identity_spec` と `purge_wiring_spec`。失敗を握りつぶすと落ちることを確かめた)。
4. 最後の有効な人格の無効化。有効な人格が 1 つも無い account は、どの人格としても操作できなくなる(Task 2 の `profile_lifecycle_spec`。判定を外した場合と、無効な人格も数えた場合に落ちることを確かめた)。
5. 他人の profile の操作(Task 2 の `profile_lifecycle_spec`。所有の照合を外すと 3 件落ちることを確かめた)。
6. 有効な人格の削除と、削除で他 slice の行が消えること、karte の記録が残ること(Task 2 の `profile_lifecycle_spec`。無効の判定を外した場合と、purge を通さずに行だけ消した場合に落ちることを確かめた)。
7. 自分の account の人格へのレビュー(Task 3 の `review_handler_spec` と `same_account_spec`。判定を外した場合、profile の id で比べた場合、存在しない profile 同士を同じ account と見なした場合に落ちることを確かめた)。
8. proto の field 名の検査が、実際に field を読んでいること(Task 3 の `field_names_spec`。footprints の field を `visited_account_id` に戻して stub を生成し直すと落ちることを確かめた)。

---

### Task 1: Per-profile purge

**Files:**
- Rename: 8 slice(notifications・footprints・bookmarks・messaging・social・post・media・schedule)の `slices/<slice>/use_cases/purge_account.rb` → `purge_profile.rb` と、その spec
- Create: `slices/review/use_cases/purge_profile.rb`、`slices/profile/use_cases/purge_profile.rb`、それぞれの spec
- Modify: `slices/review/repositories/entry_repository.rb`、`slices/review/repositories/cast_settings_repository.rb`、`slices/profile/repositories/profile_repository.rb`、`slices/profile/use_cases/purge_account.rb`、`slices/identity/use_cases/account/purge_identity.rb`、`slices/identity/use_cases/account/purge_deactivated_accounts.rb`
- Modify(spec): `spec/slices/identity/use_cases/account/purge_identity_spec.rb`、`purge_wiring_spec.rb`、`spec/slices/profile/repositories/profile_repository_spec.rb`、`spec/slices/profile/use_cases/purge_account_spec.rb`

**Interfaces:**
- Produces:
  - 9 slice の `<Slice>::Slice["use_cases.purge_profile"].call(profile_id:)`(karte は account 単位のまま `Karte::Slice["use_cases.purge_account"].call(account_id:)`)
  - `Profile::Slice["use_cases.purge_profile"].call(profile_id:)`: 全 slice の purge を順に呼び、cast の行と profile の行を最後に消す。失敗は握りつぶさない
  - `Profile::Slice["use_cases.purge_account"].call(account_id:)`: その account の全 profile に `purge_profile` を呼ぶ
  - `Identity::UseCases::Account::PurgeIdentity#call(sub:)`: profile の purge → karte の purge → Cognito の user の削除 → account の削除。最初の失敗で中断する
  - `ProfileRepository#delete(id)`(`delete_by_account` は無くなる)

- [ ] **Step 1: spec を足す・書き換える(失敗する)**

次の内容を `/tmp/p8a-t1-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8a-t1-spec.patch && git apply /tmp/p8a-t1-spec.patch` を実行する。

```diff
diff --git a/dystopia/monolith/spec/slices/bookmarks/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/bookmarks/use_cases/purge_profile_spec.rb
similarity index 64%
rename from dystopia/monolith/spec/slices/bookmarks/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/bookmarks/use_cases/purge_profile_spec.rb
index 348399a7..9432bf70 100644
--- a/dystopia/monolith/spec/slices/bookmarks/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/bookmarks/use_cases/purge_profile_spec.rb
@@ -2,12 +2,12 @@

 require "spec_helper"

-RSpec.describe Bookmarks::UseCases::PurgeAccount do
+RSpec.describe Bookmarks::UseCases::PurgeProfile do
   let(:use_case) { described_class.new(bookmark_repo: bookmark_repo) }
   let(:bookmark_repo) { double(:bookmark_repository) }

-  it "deletes all bookmarks owned by the account" do
+  it "deletes all bookmarks owned by the profile" do
     expect(bookmark_repo).to receive(:delete_by_profile).with("cast-1")
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end
 end
diff --git a/dystopia/monolith/spec/slices/footprints/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/footprints/use_cases/purge_profile_spec.rb
similarity index 80%
rename from dystopia/monolith/spec/slices/footprints/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/footprints/use_cases/purge_profile_spec.rb
index 4fdab012..383f133c 100644
--- a/dystopia/monolith/spec/slices/footprints/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/footprints/use_cases/purge_profile_spec.rb
@@ -2,13 +2,13 @@

 require "spec_helper"

-RSpec.describe Footprints::UseCases::PurgeAccount do
+RSpec.describe Footprints::UseCases::PurgeProfile do
   let(:use_case) { described_class.new(footprints_repo: footprints_repo) }
   let(:footprints_repo) { double(:footprints_repository) }

-  it "deletes visits (visitor or visited) and read_state for the account" do
+  it "deletes visits (visitor or visited) and read_state for the profile" do
     expect(footprints_repo).to receive(:delete_visits_by_profile).with("cast-1")
     expect(footprints_repo).to receive(:delete_read_state_by_profile).with("cast-1")
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end
 end
diff --git a/dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb b/dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb
index 6ec90a85..3b384c47 100644
--- a/dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb
+++ b/dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb
@@ -5,69 +5,39 @@ require "cognito"

 RSpec.describe Identity::UseCases::Account::PurgeIdentity do
   let(:use_case) do
-    described_class.new(
-      account_repo: account_repo,
-      actor_cascades: [actor_cascade],
-      account_cascades: [account_cascade],
-      list_profiles: list_profiles
-    )
+    described_class.new(account_repo: account_repo, purge_profiles: purge_profiles, purge_karte: purge_karte)
   end
   let(:account_repo) { double(:account_repository) }
-  let(:actor_cascade) { double(:actor_cascade) }
-  let(:account_cascade) { double(:account_cascade) }
-  let(:list_profiles) { double(:list_profiles) }
+  let(:purge_profiles) { double(:purge_profiles) }
+  let(:purge_karte) { double(:purge_karte) }
   let(:sub) { "sub-purge-1" }
   let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

   before do
     Cognito.reset!
     Cognito.adapter = cognito_adapter
-    allow(list_profiles).to receive(:call).with(account_id: sub)
-      .and_return([double(:profile, id: "prof-a"), double(:profile, id: "prof-b")])
-    allow(actor_cascade).to receive(:call)
-    allow(account_cascade).to receive(:call)
+    allow(purge_profiles).to receive(:call)
+    allow(purge_karte).to receive(:call)
     allow(account_repo).to receive(:delete).with(sub)
   end

   after { Cognito.reset! }

-  it "calls each actor cascade once per profile of the account" do
-    expect(actor_cascade).to receive(:call).with(account_id: "prof-a")
-    expect(actor_cascade).to receive(:call).with(account_id: "prof-b")
-
-    use_case.call(sub: sub)
-  end
-
-  it "never calls an actor cascade with the account id" do
-    expect(actor_cascade).not_to receive(:call).with(account_id: sub)
-
-    use_case.call(sub: sub)
-  end
-
-  it "calls each account cascade once with the account id, after the actor cascades" do
-    expect(actor_cascade).to receive(:call).with(account_id: "prof-a").ordered
-    expect(actor_cascade).to receive(:call).with(account_id: "prof-b").ordered
-    expect(account_cascade).to receive(:call).with(account_id: sub).ordered
-
-    use_case.call(sub: sub)
-  end
-
-  it "keeps purging the remaining profiles when one cascade call fails" do
-    allow(actor_cascade).to receive(:call).with(account_id: "prof-a").and_raise(StandardError)
-    expect(actor_cascade).to receive(:call).with(account_id: "prof-b")
-    expect(account_cascade).to receive(:call).with(account_id: sub)
-
-    use_case.call(sub: sub)
-  end
-
-  it "deletes the Cognito user before deleting the identity account" do
+  it "purges the account's profiles, then its karte rows, then the Cognito user, then the account" do
+    expect(purge_profiles).to receive(:call).with(account_id: sub).ordered
+    expect(purge_karte).to receive(:call).with(account_id: sub).ordered
     expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
     expect(account_repo).to receive(:delete).with(sub).ordered

-    use_case.call(sub: sub)
+    expect(use_case.call(sub: sub)).to be_nil
   end

-  it "returns nil" do
-    expect(use_case.call(sub: sub)).to be_nil
+  it "keeps the Cognito user and the account when purging the profiles fails" do
+    allow(purge_profiles).to receive(:call).and_raise(RuntimeError, "slice failed")
+    expect(purge_karte).not_to receive(:call)
+    expect(cognito_adapter).not_to receive(:admin_delete_user)
+    expect(account_repo).not_to receive(:delete)
+
+    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "slice failed")
   end
 end
diff --git a/dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb b/dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb
index 57cf24ed..6fa7e197 100644
--- a/dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb
+++ b/dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb
@@ -17,6 +17,7 @@ RSpec.describe "Identity::UseCases::Account::PurgeDeactivatedAccounts wiring", t
   let(:footprints_repo) { Footprints::Slice["repositories.footprints_repository"] }
   let(:messaging_repo) { Messaging::Slice["repositories.messaging_repository"] }
   let(:schedule_repo) { Schedule::Slice["repositories.schedule_repository"] }
+  let(:review_repo) { Review::Slice["repositories.entry_repository"] }
   let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

   before do
@@ -97,6 +98,9 @@ RSpec.describe "Identity::UseCases::Account::PurgeDeactivatedAccounts wiring", t
     messaging_repo.upsert_read_state(thread_id: thread[:id], profile_id: bystander, last_read_message_id: nil)
     schedule_repo.upsert(profile_id: persona_a, work_date: "2026-10-01", start_time: "20:00", end_time: "02:00")
     schedule_repo.upsert(profile_id: bystander, work_date: "2026-10-01", start_time: "20:00", end_time: "02:00")
+    review_repo.create(author_profile_id: bystander, target_profile_id: persona_a, rating: 4.0, body: "received")
+    review_repo.create(author_profile_id: persona_b, target_profile_id: witness, rating: 4.0, body: "written")
+    review_repo.create(author_profile_id: bystander, target_profile_id: witness, rating: 4.0, body: "kept")

     db[:identity__accounts].where(id: account_id).update(deactivated_at: Time.now - (31 * 24 * 3600))

@@ -124,6 +128,7 @@ RSpec.describe "Identity::UseCases::Account::PurgeDeactivatedAccounts wiring", t
     expect(db[:messaging__read_states].where(profile_id: personas).count).to eq(0)
     expect(db[:messaging__threads].where(profile_a: personas).or(profile_b: personas).count).to eq(0)
     expect(db[:schedule__schedules].where(profile_id: personas).count).to eq(0)
+    expect(db[:review__entries].where(author_profile_id: personas).or(target_profile_id: personas).count).to eq(0)

     expect(db[:profile__profiles].where(id: bystander).count).to eq(1)
     expect(db[:profile__casts].where(profile_id: bystander).count).to eq(1)
@@ -142,5 +147,35 @@ RSpec.describe "Identity::UseCases::Account::PurgeDeactivatedAccounts wiring", t
       db[:messaging__threads].where(id: thread[:id]).where(Sequel.|({ profile_a: bystander }, { profile_b: bystander })).count
     ).to eq(1)
     expect(db[:schedule__schedules].where(profile_id: bystander).count).to eq(1)
+    expect(db[:review__entries].where(author_profile_id: bystander, target_profile_id: witness).count).to eq(1)
+  end
+
+  it "keeps the account and the profile whose slice purge failed, and finishes on the next run" do
+    account_id = create_account(role: 2)
+    create_account_with_profile(account_id: account_id)
+    persona_b = create_account_with_profile(account_id: account_id)
+    schedule_repo.upsert(profile_id: persona_b, work_date: "2026-10-01", start_time: "20:00", end_time: "02:00")
+    db[:identity__accounts].where(id: account_id).update(deactivated_at: Time.now - (31 * 24 * 3600))
+    purge = Identity::Slice["use_cases.account.purge_deactivated_accounts"]
+    schedule_fails = true
+    allow_any_instance_of(Schedule::UseCases::PurgeProfile).to receive(:call).and_wrap_original do |original, profile_id:|
+      raise "schedule failed" if schedule_fails && profile_id == persona_b
+
+      original.call(profile_id: profile_id)
+    end
+
+    expect(purge.call(now: Time.now)).to eq(0)
+
+    expect(cognito_adapter).not_to have_received(:admin_delete_user)
+    expect(db[:identity__accounts].where(id: account_id).count).to eq(1)
+    expect(db[:profile__profiles].where(account_id: account_id).select_map(:id)).to include(persona_b)
+    expect(db[:schedule__schedules].where(profile_id: persona_b).count).to eq(1)
+
+    schedule_fails = false
+
+    expect(purge.call(now: Time.now)).to eq(1)
+    expect(db[:identity__accounts].where(id: account_id).count).to eq(0)
+    expect(db[:profile__profiles].where(account_id: account_id).count).to eq(0)
+    expect(db[:schedule__schedules].where(profile_id: persona_b).count).to eq(0)
   end
 end
diff --git a/dystopia/monolith/spec/slices/media/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/media/use_cases/purge_profile_spec.rb
similarity index 76%
rename from dystopia/monolith/spec/slices/media/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/media/use_cases/purge_profile_spec.rb
index 08584508..c69ff558 100644
--- a/dystopia/monolith/spec/slices/media/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/media/use_cases/purge_profile_spec.rb
@@ -2,12 +2,12 @@

 require "spec_helper"

-RSpec.describe Media::UseCases::PurgeAccount do
+RSpec.describe Media::UseCases::PurgeProfile do
   let(:use_case) { described_class.new(repo: repo) }
   let(:repo) { double(:media_repository) }

   it "deletes media__files where uploader_profile_id matches" do
     expect(repo).to receive(:delete_by_uploader).with("cast-1")
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end
 end
diff --git a/dystopia/monolith/spec/slices/messaging/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/messaging/use_cases/purge_profile_spec.rb
similarity index 84%
rename from dystopia/monolith/spec/slices/messaging/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/messaging/use_cases/purge_profile_spec.rb
index 56a8fb30..2951b599 100644
--- a/dystopia/monolith/spec/slices/messaging/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/messaging/use_cases/purge_profile_spec.rb
@@ -2,7 +2,7 @@

 require "spec_helper"

-RSpec.describe Messaging::UseCases::PurgeAccount do
+RSpec.describe Messaging::UseCases::PurgeProfile do
   let(:use_case) { described_class.new(repo: repo) }
   let(:repo) { double(:messaging_repository) }

@@ -10,6 +10,6 @@ RSpec.describe Messaging::UseCases::PurgeAccount do
     expect(repo).to receive(:delete_read_states_by_profile).with("cast-1").ordered
     expect(repo).to receive(:null_out_sender).with("cast-1").ordered
     expect(repo).to receive(:null_out_thread_participants).with("cast-1").ordered
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end
 end
diff --git a/dystopia/monolith/spec/slices/notifications/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/notifications/use_cases/purge_profile_spec.rb
similarity index 78%
rename from dystopia/monolith/spec/slices/notifications/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/notifications/use_cases/purge_profile_spec.rb
index 63eac8c9..0cafc0eb 100644
--- a/dystopia/monolith/spec/slices/notifications/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/notifications/use_cases/purge_profile_spec.rb
@@ -2,13 +2,13 @@

 require "spec_helper"

-RSpec.describe Notifications::UseCases::PurgeAccount do
+RSpec.describe Notifications::UseCases::PurgeProfile do
   let(:use_case) { described_class.new(notification_repo: notification_repo) }
   let(:notification_repo) { double(:notification_repository) }

-  it "deletes notifications (recipient or latest_actor) and preferences for the account" do
+  it "deletes notifications (recipient or latest_actor) and preferences for the profile" do
     expect(notification_repo).to receive(:delete_notifications_by_profile).with("cast-1")
     expect(notification_repo).to receive(:delete_preferences_by_profile).with("cast-1")
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end
 end
diff --git a/dystopia/monolith/spec/slices/post/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/post/use_cases/purge_profile_spec.rb
similarity index 78%
rename from dystopia/monolith/spec/slices/post/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/post/use_cases/purge_profile_spec.rb
index 2bbbfcdc..fa024e4e 100644
--- a/dystopia/monolith/spec/slices/post/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/post/use_cases/purge_profile_spec.rb
@@ -2,7 +2,7 @@

 require "spec_helper"

-RSpec.describe Post::UseCases::PurgeAccount do
+RSpec.describe Post::UseCases::PurgeProfile do
   let(:use_case) do
     described_class.new(
       post_repo: post_repo,
@@ -14,17 +14,17 @@ RSpec.describe Post::UseCases::PurgeAccount do
   let(:like_repo) { double(:like_repository) }
   let(:comment_repo) { double(:comment_repository) }

-  it "deletes likes, comments, then posts owned by the account" do
+  it "deletes likes, comments, then posts owned by the profile" do
     expect(like_repo).to receive(:delete_by_profile).with("cast-1").ordered
     expect(comment_repo).to receive(:delete_by_profile).with("cast-1").ordered
     expect(post_repo).to receive(:delete_by_author).with("cast-1").ordered
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end

   it "returns nil" do
     allow(like_repo).to receive(:delete_by_profile)
     allow(comment_repo).to receive(:delete_by_profile)
     allow(post_repo).to receive(:delete_by_author)
-    expect(use_case.call(account_id: "cast-1")).to be_nil
+    expect(use_case.call(profile_id: "cast-1")).to be_nil
   end
 end
diff --git a/dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb b/dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb
index 392da51c..9edb6cfa 100644
--- a/dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb
+++ b/dystopia/monolith/spec/slices/profile/repositories/profile_repository_spec.rb
@@ -205,16 +205,14 @@ RSpec.describe "Profile::Repositories::ProfileRepository", type: :database do
     end
   end

-  describe "#delete_by_account" do
-    it "deletes every profile of the account and no others" do
-      create_profile
-      create_profile
-      other = create_profile(owner: create_account)
+  describe "#delete" do
+    it "deletes the profile and no other profile of the account" do
+      deleted = create_profile
+      kept = create_profile

-      repo.delete_by_account(account_id)
+      repo.delete(deleted.id)

-      expect(repo.list_by_account(account_id)).to eq([])
-      expect(repo.find_by_id(other.id)).not_to be_nil
+      expect(repo.list_by_account(account_id).map(&:id)).to eq([kept.id])
     end
   end
 end
diff --git a/dystopia/monolith/spec/slices/profile/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/profile/use_cases/purge_account_spec.rb
index 4999e975..76749ba2 100644
--- a/dystopia/monolith/spec/slices/profile/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/profile/use_cases/purge_account_spec.rb
@@ -7,7 +7,7 @@ RSpec.describe "Profile::UseCases::PurgeAccount", type: :database do
   let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
   let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

-  it "deletes every profile and cast row of the account and leaves other accounts" do
+  it "purges every profile of the account and leaves other accounts" do
     account_id = create_account(role: 2)
     first = create_account_with_profile(account_id: account_id)
     second = create_account_with_profile(account_id: account_id)
diff --git a/dystopia/monolith/spec/slices/profile/use_cases/purge_profile_spec.rb b/dystopia/monolith/spec/slices/profile/use_cases/purge_profile_spec.rb
new file mode 100644
index 00000000..0c23e820
--- /dev/null
+++ b/dystopia/monolith/spec/slices/profile/use_cases/purge_profile_spec.rb
@@ -0,0 +1,58 @@
+# frozen_string_literal: true
+
+require "spec_helper"
+
+RSpec.describe Profile::UseCases::PurgeProfile, type: :database do
+  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
+  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }
+  let(:account_id) { create_account(role: 2) }
+  let(:purged) { create_account_with_profile(account_id: account_id) }
+  let(:sibling) { create_account_with_profile(account_id: account_id) }
+
+  before do
+    cast_repo.create(profile_id: purged)
+    cast_repo.create(profile_id: sibling)
+  end
+
+  it "purges every slice for the profile, then deletes its cast and profile rows and keeps the account's other profile" do
+    first = double(:slice_purge)
+    second = double(:slice_purge)
+    expect(first).to receive(:call).with(profile_id: purged).ordered
+    expect(second).to receive(:call).with(profile_id: purged).ordered
+
+    expect(described_class.new(slice_purges: [first, second]).call(profile_id: purged)).to be_nil
+
+    expect(repo.find_by_id(purged)).to be_nil
+    expect(cast_repo.find_by_profile_id(purged)).to be_nil
+    expect(repo.find_by_id(sibling)).not_to be_nil
+    expect(cast_repo.find_by_profile_id(sibling)).not_to be_nil
+  end
+
+  it "keeps the profile and its cast row when a slice purge fails, and skips the slices after it" do
+    failing = double(:slice_purge)
+    later = double(:slice_purge)
+    allow(failing).to receive(:call).and_raise(RuntimeError, "slice failed")
+    expect(later).not_to receive(:call)
+
+    expect { described_class.new(slice_purges: [failing, later]).call(profile_id: purged) }.to raise_error(RuntimeError, "slice failed")
+
+    expect(repo.find_by_id(purged)).not_to be_nil
+    expect(cast_repo.find_by_profile_id(purged)).not_to be_nil
+  end
+
+  it "resolves a purge for every slice that stores rows per profile" do
+    purges = Hanami.app.slices[:profile]["use_cases.purge_profile"].send(:slice_purges)
+
+    expect(purges.map { |purge| purge.class.name }).to eq(%w[
+      Notifications::UseCases::PurgeProfile
+      Footprints::UseCases::PurgeProfile
+      Bookmarks::UseCases::PurgeProfile
+      Messaging::UseCases::PurgeProfile
+      Social::UseCases::PurgeProfile
+      Review::UseCases::PurgeProfile
+      Post::UseCases::PurgeProfile
+      Media::UseCases::PurgeProfile
+      Schedule::UseCases::PurgeProfile
+    ])
+  end
+end
diff --git a/dystopia/monolith/spec/slices/review/use_cases/purge_profile_spec.rb b/dystopia/monolith/spec/slices/review/use_cases/purge_profile_spec.rb
new file mode 100644
index 00000000..1159de6b
--- /dev/null
+++ b/dystopia/monolith/spec/slices/review/use_cases/purge_profile_spec.rb
@@ -0,0 +1,27 @@
+# frozen_string_literal: true
+
+require "spec_helper"
+
+RSpec.describe "Review::UseCases::PurgeProfile", type: :database do
+  let(:db) { Hanami.app["db.gateway"].connection }
+  let(:use_case) { Review::Slice["use_cases.purge_profile"] }
+  let(:entry_repo) { Review::Slice["repositories.entry_repository"] }
+  let(:cast_settings_repo) { Review::Slice["repositories.cast_settings_repository"] }
+
+  let(:purged) { SecureRandom.uuid_v7 }
+  let(:cast) { SecureRandom.uuid_v7 }
+  let(:guest) { SecureRandom.uuid_v7 }
+
+  it "deletes the reviews the profile wrote or received and its setting, and leaves other profiles' rows" do
+    entry_repo.create(author_profile_id: purged, target_profile_id: cast, rating: 4.0, body: "written")
+    entry_repo.create(author_profile_id: guest, target_profile_id: purged, rating: 3.0, body: "received")
+    kept = entry_repo.create(author_profile_id: guest, target_profile_id: cast, rating: 5.0, body: "kept")
+    cast_settings_repo.upsert(profile_id: purged, reviews_visible: false)
+    cast_settings_repo.upsert(profile_id: cast, reviews_visible: false)
+
+    expect(use_case.call(profile_id: purged)).to be_nil
+
+    expect(db[:review__entries].select_map(:id)).to eq([kept.id])
+    expect(db[:review__cast_settings].select_map(:profile_id)).to eq([cast])
+  end
+end
diff --git a/dystopia/monolith/spec/slices/schedule/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/schedule/use_cases/purge_profile_spec.rb
similarity index 64%
rename from dystopia/monolith/spec/slices/schedule/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/schedule/use_cases/purge_profile_spec.rb
index 024a92f1..fff17391 100644
--- a/dystopia/monolith/spec/slices/schedule/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/schedule/use_cases/purge_profile_spec.rb
@@ -2,12 +2,12 @@

 require "spec_helper"

-RSpec.describe Schedule::UseCases::PurgeAccount do
+RSpec.describe Schedule::UseCases::PurgeProfile do
   let(:use_case) { described_class.new(schedule_repo: schedule_repo) }
   let(:schedule_repo) { double(:schedule_repository) }

-  it "deletes all schedule rows for the account" do
+  it "deletes all schedule rows for the profile" do
     expect(schedule_repo).to receive(:delete_by_profile).with("cast-1")
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end
 end
diff --git a/dystopia/monolith/spec/slices/social/use_cases/purge_account_spec.rb b/dystopia/monolith/spec/slices/social/use_cases/purge_profile_spec.rb
similarity index 80%
rename from dystopia/monolith/spec/slices/social/use_cases/purge_account_spec.rb
rename to dystopia/monolith/spec/slices/social/use_cases/purge_profile_spec.rb
index f190a1db..5405cd5b 100644
--- a/dystopia/monolith/spec/slices/social/use_cases/purge_account_spec.rb
+++ b/dystopia/monolith/spec/slices/social/use_cases/purge_profile_spec.rb
@@ -2,7 +2,7 @@

 require "spec_helper"

-RSpec.describe Social::UseCases::PurgeAccount do
+RSpec.describe Social::UseCases::PurgeProfile do
   let(:use_case) do
     described_class.new(follow_repo: follow_repo, block_repo: block_repo)
   end
@@ -12,12 +12,12 @@ RSpec.describe Social::UseCases::PurgeAccount do
   it "deletes follows (follower OR followee) and blocks (blocker OR blocked)" do
     expect(follow_repo).to receive(:delete_by_profile).with("cast-1")
     expect(block_repo).to receive(:delete_by_profile).with("cast-1")
-    use_case.call(account_id: "cast-1")
+    use_case.call(profile_id: "cast-1")
   end

   it "returns nil" do
     allow(follow_repo).to receive(:delete_by_profile)
     allow(block_repo).to receive(:delete_by_profile)
-    expect(use_case.call(account_id: "cast-1")).to be_nil
+    expect(use_case.call(profile_id: "cast-1")).to be_nil
   end
 end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/identity spec/slices/profile spec/slices/review spec/slices/notifications spec/slices/footprints spec/slices/bookmarks spec/slices/messaging spec/slices/social spec/slices/post spec/slices/media spec/slices/schedule > /tmp/rspec-p8a-t1-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p8a-t1-red.txt`
Expected: `0 examples, 0 failures, 9 errors occurred outside of examples`(改名した spec が、まだ無い `PurgeProfile` を読み込めずに止まる)。

- [ ] **Step 2: 実装する**

次の内容を `/tmp/p8a-t1-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8a-t1-impl.patch && git apply /tmp/p8a-t1-impl.patch` を実行する。

```diff
diff --git a/dystopia/monolith/slices/bookmarks/use_cases/purge_account.rb b/dystopia/monolith/slices/bookmarks/use_cases/purge_profile.rb
similarity index 64%
rename from dystopia/monolith/slices/bookmarks/use_cases/purge_account.rb
rename to dystopia/monolith/slices/bookmarks/use_cases/purge_profile.rb
index 4f62212d..29e7bc9a 100644
--- a/dystopia/monolith/slices/bookmarks/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/bookmarks/use_cases/purge_profile.rb
@@ -2,11 +2,11 @@

 module Bookmarks
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Bookmarks::Deps[bookmark_repo: "repositories.bookmark_repository"]

-      def call(account_id:)
-        bookmark_repo.delete_by_profile(account_id)
+      def call(profile_id:)
+        bookmark_repo.delete_by_profile(profile_id)
         nil
       end
     end
diff --git a/dystopia/monolith/slices/footprints/use_cases/purge_account.rb b/dystopia/monolith/slices/footprints/use_cases/purge_profile.rb
similarity index 52%
rename from dystopia/monolith/slices/footprints/use_cases/purge_account.rb
rename to dystopia/monolith/slices/footprints/use_cases/purge_profile.rb
index 62596411..6cb1124d 100644
--- a/dystopia/monolith/slices/footprints/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/footprints/use_cases/purge_profile.rb
@@ -2,12 +2,12 @@

 module Footprints
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

-      def call(account_id:)
-        footprints_repo.delete_visits_by_profile(account_id)
-        footprints_repo.delete_read_state_by_profile(account_id)
+      def call(profile_id:)
+        footprints_repo.delete_visits_by_profile(profile_id)
+        footprints_repo.delete_read_state_by_profile(profile_id)
         nil
       end
     end
diff --git a/dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb b/dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb
index c80c6139..ae7a5946 100644
--- a/dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb
+++ b/dystopia/monolith/slices/identity/use_cases/account/purge_deactivated_accounts.rb
@@ -6,36 +6,13 @@ module Identity
       class PurgeDeactivatedAccounts
         GRACE_PERIOD_SECONDS = 30 * 24 * 3600

-        include Identity::Deps[account_repo: "repositories.account_repository"]
+        include Identity::Deps[
+          account_repo: "repositories.account_repository",
+          purge_identity: "use_cases.account.purge_identity"
+        ]

-        def initialize(
-          account_repo: nil,
-          purge_notifications: nil,
-          purge_footprints: nil,
-          purge_bookmarks: nil,
-          purge_karte: nil,
-          purge_messaging: nil,
-          purge_social: nil,
-          purge_post: nil,
-          purge_media: nil,
-          purge_schedule: nil,
-          purge_profile: nil,
-          purge_identity: nil,
-          logger: nil,
-          **kwargs
-        )
-          super(**kwargs.merge(account_repo: account_repo).compact)
-          @purge_notifications = purge_notifications
-          @purge_footprints = purge_footprints
-          @purge_bookmarks = purge_bookmarks
-          @purge_karte = purge_karte
-          @purge_messaging = purge_messaging
-          @purge_social = purge_social
-          @purge_post = purge_post
-          @purge_media = purge_media
-          @purge_schedule = purge_schedule
-          @purge_profile = purge_profile
-          @purge_identity = purge_identity
+        def initialize(logger: nil, **kwargs)
+          super(**kwargs)
           @logger = logger
         end

@@ -57,74 +34,6 @@ module Identity

         private

-        def actor_cascades
-          [
-            purge_notifications,
-            purge_footprints,
-            purge_bookmarks,
-            purge_messaging,
-            purge_social,
-            purge_post,
-            purge_media,
-            purge_schedule
-          ]
-        end
-
-        def account_cascades
-          [
-            purge_karte,
-            purge_profile
-          ]
-        end
-
-        def purge_notifications
-          @purge_notifications ||= ::Notifications::Slice["use_cases.purge_account"]
-        end
-
-        def purge_footprints
-          @purge_footprints ||= ::Footprints::Slice["use_cases.purge_account"]
-        end
-
-        def purge_bookmarks
-          @purge_bookmarks ||= ::Bookmarks::Slice["use_cases.purge_account"]
-        end
-
-        def purge_karte
-          @purge_karte ||= ::Karte::Slice["use_cases.purge_account"]
-        end
-
-        def purge_messaging
-          @purge_messaging ||= ::Messaging::Slice["use_cases.purge_account"]
-        end
-
-        def purge_social
-          @purge_social ||= ::Social::Slice["use_cases.purge_account"]
-        end
-
-        def purge_post
-          @purge_post ||= ::Post::Slice["use_cases.purge_account"]
-        end
-
-        def purge_media
-          @purge_media ||= ::Media::Slice["use_cases.purge_account"]
-        end
-
-        def purge_schedule
-          @purge_schedule ||= ::Schedule::Slice["use_cases.purge_account"]
-        end
-
-        def purge_profile
-          @purge_profile ||= ::Profile::Slice["use_cases.purge_account"]
-        end
-
-        def purge_identity
-          @purge_identity ||= PurgeIdentity.new(
-            account_repo: account_repo,
-            actor_cascades: actor_cascades,
-            account_cascades: account_cascades
-          )
-        end
-
         def logger
           @logger
         end
diff --git a/dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb b/dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb
index 54c47c9e..0dd15f84 100644
--- a/dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb
+++ b/dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb
@@ -8,19 +8,16 @@ module Identity
       class PurgeIdentity
         include Identity::Deps[account_repo: "repositories.account_repository"]

-        def initialize(actor_cascades:, account_cascades:, list_profiles: nil, **kwargs)
+        def initialize(purge_profiles: nil, purge_karte: nil, **kwargs)
           super(**kwargs)
-          @actor_cascades = actor_cascades
-          @account_cascades = account_cascades
-          @list_profiles = list_profiles
+          @purge_profiles = purge_profiles
+          @purge_karte = purge_karte
         end

+        # Raises on the first failure so the account stays deactivated and the next run repeats the purge.
         def call(sub:)
-          profile_ids = list_profiles.call(account_id: sub).map(&:id)
-          @actor_cascades.each do |cascade|
-            profile_ids.each { |profile_id| cascade.call(account_id: profile_id) rescue nil } # SILENT: A failed slice purge must not prevent remaining profile data from being removed.
-          end
-          @account_cascades.each { |cascade| cascade.call(account_id: sub) rescue nil } # SILENT: A failed slice purge must not prevent remaining account data from being removed.
+          purge_profiles.call(account_id: sub)
+          purge_karte.call(account_id: sub)
           Cognito.admin_delete_user(sub: sub)
           account_repo.delete(sub)
           nil
@@ -28,8 +25,12 @@ module Identity

         private

-        def list_profiles
-          @list_profiles ||= ::Profile::Slice["use_cases.list_my_profiles"]
+        def purge_profiles
+          @purge_profiles ||= ::Profile::Slice["use_cases.purge_account"]
+        end
+
+        def purge_karte
+          @purge_karte ||= ::Karte::Slice["use_cases.purge_account"]
         end
       end
     end
diff --git a/dystopia/monolith/slices/media/use_cases/purge_account.rb b/dystopia/monolith/slices/media/use_cases/purge_profile.rb
similarity index 63%
rename from dystopia/monolith/slices/media/use_cases/purge_account.rb
rename to dystopia/monolith/slices/media/use_cases/purge_profile.rb
index 3fbb0283..aa36c0ab 100644
--- a/dystopia/monolith/slices/media/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/media/use_cases/purge_profile.rb
@@ -2,11 +2,11 @@

 module Media
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Media::Deps[repo: "repositories.media_repository"]

-      def call(account_id:)
-        repo.delete_by_uploader(account_id)
+      def call(profile_id:)
+        repo.delete_by_uploader(profile_id)
         nil
       end
     end
diff --git a/dystopia/monolith/slices/messaging/use_cases/purge_account.rb b/dystopia/monolith/slices/messaging/use_cases/purge_account.rb
deleted file mode 100644
index 90bece49..00000000
--- a/dystopia/monolith/slices/messaging/use_cases/purge_account.rb
+++ /dev/null
@@ -1,16 +0,0 @@
-# frozen_string_literal: true
-
-module Messaging
-  module UseCases
-    class PurgeAccount
-      include Messaging::Deps[repo: "repositories.messaging_repository"]
-
-      def call(account_id:)
-        repo.delete_read_states_by_profile(account_id)
-        repo.null_out_sender(account_id)
-        repo.null_out_thread_participants(account_id)
-        nil
-      end
-    end
-  end
-end
diff --git a/dystopia/monolith/slices/messaging/use_cases/purge_profile.rb b/dystopia/monolith/slices/messaging/use_cases/purge_profile.rb
new file mode 100644
index 00000000..4772713e
--- /dev/null
+++ b/dystopia/monolith/slices/messaging/use_cases/purge_profile.rb
@@ -0,0 +1,16 @@
+# frozen_string_literal: true
+
+module Messaging
+  module UseCases
+    class PurgeProfile
+      include Messaging::Deps[repo: "repositories.messaging_repository"]
+
+      def call(profile_id:)
+        repo.delete_read_states_by_profile(profile_id)
+        repo.null_out_sender(profile_id)
+        repo.null_out_thread_participants(profile_id)
+        nil
+      end
+    end
+  end
+end
diff --git a/dystopia/monolith/slices/notifications/use_cases/purge_account.rb b/dystopia/monolith/slices/notifications/use_cases/purge_profile.rb
similarity index 52%
rename from dystopia/monolith/slices/notifications/use_cases/purge_account.rb
rename to dystopia/monolith/slices/notifications/use_cases/purge_profile.rb
index fe9765b9..f4d97888 100644
--- a/dystopia/monolith/slices/notifications/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/notifications/use_cases/purge_profile.rb
@@ -2,12 +2,12 @@

 module Notifications
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Notifications::Deps[notification_repo: "repositories.notification_repository"]

-      def call(account_id:)
-        notification_repo.delete_notifications_by_profile(account_id)
-        notification_repo.delete_preferences_by_profile(account_id)
+      def call(profile_id:)
+        notification_repo.delete_notifications_by_profile(profile_id)
+        notification_repo.delete_preferences_by_profile(profile_id)
         nil
       end
     end
diff --git a/dystopia/monolith/slices/post/use_cases/purge_account.rb b/dystopia/monolith/slices/post/use_cases/purge_profile.rb
similarity index 59%
rename from dystopia/monolith/slices/post/use_cases/purge_account.rb
rename to dystopia/monolith/slices/post/use_cases/purge_profile.rb
index 4638b4b6..d0b0789b 100644
--- a/dystopia/monolith/slices/post/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/post/use_cases/purge_profile.rb
@@ -2,17 +2,17 @@

 module Post
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Post::Deps[
         post_repo: "repositories.post_repository",
         like_repo: "repositories.like_repository",
         comment_repo: "repositories.comment_repository"
       ]

-      def call(account_id:)
-        like_repo.delete_by_profile(account_id)
-        comment_repo.delete_by_profile(account_id)
-        post_repo.delete_by_author(account_id)
+      def call(profile_id:)
+        like_repo.delete_by_profile(profile_id)
+        comment_repo.delete_by_profile(profile_id)
+        post_repo.delete_by_author(profile_id)
         nil
       end
     end
diff --git a/dystopia/monolith/slices/profile/repositories/profile_repository.rb b/dystopia/monolith/slices/profile/repositories/profile_repository.rb
index e0685045..14a7816e 100644
--- a/dystopia/monolith/slices/profile/repositories/profile_repository.rb
+++ b/dystopia/monolith/slices/profile/repositories/profile_repository.rb
@@ -106,8 +106,8 @@ module Profile
         profiles.dataset.db[:identity__accounts].where(id: profile.account_id).get(:role)
       end

-      def delete_by_account(account_id)
-        profiles.dataset.where(account_id: account_id).delete
+      def delete(id)
+        profiles.dataset.where(id: id).delete
       end

       private
diff --git a/dystopia/monolith/slices/profile/use_cases/purge_account.rb b/dystopia/monolith/slices/profile/use_cases/purge_account.rb
index b6c6efed..2829c1c4 100644
--- a/dystopia/monolith/slices/profile/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/profile/use_cases/purge_account.rb
@@ -5,13 +5,11 @@ module Profile
     class PurgeAccount
       include Profile::Deps[
         profile_repo: "repositories.profile_repository",
-        cast_repo: "repositories.cast_repository"
+        purge_profile: "use_cases.purge_profile"
       ]

       def call(account_id:)
-        profile_ids = profile_repo.list_by_account(account_id).map(&:id)
-        cast_repo.delete_by_profile_ids(profile_ids)
-        profile_repo.delete_by_account(account_id)
+        profile_repo.list_by_account(account_id).each { |profile| purge_profile.call(profile_id: profile.id) }
         nil
       end
     end
diff --git a/dystopia/monolith/slices/profile/use_cases/purge_profile.rb b/dystopia/monolith/slices/profile/use_cases/purge_profile.rb
new file mode 100644
index 00000000..78d8dbac
--- /dev/null
+++ b/dystopia/monolith/slices/profile/use_cases/purge_profile.rb
@@ -0,0 +1,41 @@
+# frozen_string_literal: true
+
+module Profile
+  module UseCases
+    class PurgeProfile
+      include Profile::Deps[
+        profile_repo: "repositories.profile_repository",
+        cast_repo: "repositories.cast_repository"
+      ]
+
+      def initialize(slice_purges: nil, **kwargs)
+        super(**kwargs)
+        @slice_purges = slice_purges
+      end
+
+      # Deletes the profile row last so that a failed slice leaves the profile in place and the call can be repeated.
+      def call(profile_id:)
+        slice_purges.each { |purge| purge.call(profile_id: profile_id) }
+        cast_repo.delete_by_profile_ids([profile_id])
+        profile_repo.delete(profile_id)
+        nil
+      end
+
+      private
+
+      def slice_purges
+        @slice_purges ||= [
+          ::Notifications::Slice["use_cases.purge_profile"],
+          ::Footprints::Slice["use_cases.purge_profile"],
+          ::Bookmarks::Slice["use_cases.purge_profile"],
+          ::Messaging::Slice["use_cases.purge_profile"],
+          ::Social::Slice["use_cases.purge_profile"],
+          ::Review::Slice["use_cases.purge_profile"],
+          ::Post::Slice["use_cases.purge_profile"],
+          ::Media::Slice["use_cases.purge_profile"],
+          ::Schedule::Slice["use_cases.purge_profile"]
+        ]
+      end
+    end
+  end
+end
diff --git a/dystopia/monolith/slices/review/repositories/cast_settings_repository.rb b/dystopia/monolith/slices/review/repositories/cast_settings_repository.rb
index 255d7840..05d15b26 100644
--- a/dystopia/monolith/slices/review/repositories/cast_settings_repository.rb
+++ b/dystopia/monolith/slices/review/repositories/cast_settings_repository.rb
@@ -21,6 +21,10 @@ module Review
           )
         end
       end
+
+      def delete_by_profile(profile_id)
+        cast_settings_records.dataset.where(profile_id: profile_id).delete
+      end
     end
   end
 end
diff --git a/dystopia/monolith/slices/review/repositories/entry_repository.rb b/dystopia/monolith/slices/review/repositories/entry_repository.rb
index 37bb23fc..c7ec87cd 100644
--- a/dystopia/monolith/slices/review/repositories/entry_repository.rb
+++ b/dystopia/monolith/slices/review/repositories/entry_repository.rb
@@ -30,6 +30,12 @@ module Review
         entry_records.by_pk(id).command(:delete).call
       end

+      def delete_by_profile(profile_id)
+        entry_records.dataset
+          .where(Sequel.|({ author_profile_id: profile_id }, { target_profile_id: profile_id }))
+          .delete
+      end
+
       def list_by_target(target_profile_id:, limit: 20, cursor: nil)
         scope = entry_records.where(target_profile_id: target_profile_id)
         scope = apply_cursor(scope, cursor)
diff --git a/dystopia/monolith/slices/review/use_cases/purge_profile.rb b/dystopia/monolith/slices/review/use_cases/purge_profile.rb
new file mode 100644
index 00000000..c8286012
--- /dev/null
+++ b/dystopia/monolith/slices/review/use_cases/purge_profile.rb
@@ -0,0 +1,18 @@
+# frozen_string_literal: true
+
+module Review
+  module UseCases
+    class PurgeProfile
+      include Review::Deps[
+        entry_repo: "repositories.entry_repository",
+        cast_settings_repo: "repositories.cast_settings_repository"
+      ]
+
+      def call(profile_id:)
+        entry_repo.delete_by_profile(profile_id)
+        cast_settings_repo.delete_by_profile(profile_id)
+        nil
+      end
+    end
+  end
+end
diff --git a/dystopia/monolith/slices/schedule/use_cases/purge_account.rb b/dystopia/monolith/slices/schedule/use_cases/purge_profile.rb
similarity index 64%
rename from dystopia/monolith/slices/schedule/use_cases/purge_account.rb
rename to dystopia/monolith/slices/schedule/use_cases/purge_profile.rb
index 16709ef3..e1340c64 100644
--- a/dystopia/monolith/slices/schedule/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/schedule/use_cases/purge_profile.rb
@@ -2,11 +2,11 @@

 module Schedule
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

-      def call(account_id:)
-        schedule_repo.delete_by_profile(account_id)
+      def call(profile_id:)
+        schedule_repo.delete_by_profile(profile_id)
         nil
       end
     end
diff --git a/dystopia/monolith/slices/social/use_cases/purge_account.rb b/dystopia/monolith/slices/social/use_cases/purge_profile.rb
similarity index 62%
rename from dystopia/monolith/slices/social/use_cases/purge_account.rb
rename to dystopia/monolith/slices/social/use_cases/purge_profile.rb
index 8be0cd41..a5b563c1 100644
--- a/dystopia/monolith/slices/social/use_cases/purge_account.rb
+++ b/dystopia/monolith/slices/social/use_cases/purge_profile.rb
@@ -2,15 +2,15 @@

 module Social
   module UseCases
-    class PurgeAccount
+    class PurgeProfile
       include Social::Deps[
         follow_repo: "repositories.follow_repository",
         block_repo: "repositories.block_repository"
       ]

-      def call(account_id:)
-        follow_repo.delete_by_profile(account_id)
-        block_repo.delete_by_profile(account_id)
+      def call(profile_id:)
+        follow_repo.delete_by_profile(profile_id)
+        block_repo.delete_by_profile(profile_id)
         nil
       end
     end
```

Run(`dystopia/monolith`): `/usr/bin/grep -rn -E 'purge_account|PurgeAccount|delete_by_account' slices lib --include='*.rb' --include='*.rake' | wc -l`
Expected: `4`(`Profile` と `Karte` の `PurgeAccount` の定義と、それを呼ぶ `PurgeIdentity` の 2 行)。

- [ ] **Step 3: 通ることを確認する**

Run: Step 1 と同じ rspec のコマンド(出力先は `/tmp/rspec-p8a-t1-green.txt`)。
Expected: `404 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `648 examples, 0 failures`

Run: `for i in 1 2 3 4 5; do HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/identity/use_cases/account/purge_wiring_spec.rb 2>&1 | /usr/bin/grep -E '^[0-9]+ examples'; done | sort | uniq -c`
Expected: 5 回とも `8 examples, 0 failures`(行の並びに依存していないことの確認)。

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add -A dystopia/monolith && git status --short && git commit -s -m "feat(dystopia/monolith): purge one profile across slices and stop the account purge on failure" && cd dystopia/monolith
```

`git status --short` の出力が `dystopia/monolith` の下だけであることを確認してから commit する(`git add -A` の後は改名が 1 行にまとまるので 31 行、`git add -A` の前に数えると 46 行)。

---

### Task 2: Disable, enable and delete a profile

**Files:**
- Modify: `proto/dystopia/profile/v1/service.proto`
- Generate: `dystopia/monolith/stubs/profile/v1/service_pb.rb`、`service_services_pb.rb`、`dystopia/frontend/src/stub/profile/v1/service_pb.ts`
- Create: `slices/profile/use_cases/disable_profile.rb`、`enable_profile.rb`、`delete_profile.rb`、`spec/slices/profile/grpc/profile_lifecycle_spec.rb`
- Modify: `slices/profile/repositories/profile_repository.rb`、`slices/profile/grpc/profile_handler.rb`

**Interfaces:**
- Consumes: Task 1 の `Profile::Slice["use_cases.purge_profile"]`
- Produces(3 つとも account を主体として動き、操作中の人格を必要としない):
  - `DisableProfile(profile_id)` → `Profile`(`disabled` が真)。最後の有効な人格なら `FAILED_PRECONDITION`、自分の account のものでなければ `NOT_FOUND`
  - `EnableProfile(profile_id)` → `Profile`(`disabled` が偽)。自分の account のものでなければ `NOT_FOUND`
  - `DeleteProfile(profile_id)` → 空。有効な人格なら `FAILED_PRECONDITION`、自分の account のものでなければ `NOT_FOUND`

- [ ] **Step 1: spec を足す(失敗する)**

次の内容を `/tmp/p8a-t2-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8a-t2-spec.patch && git apply /tmp/p8a-t2-spec.patch` を実行する。

```diff
diff --git a/dystopia/monolith/spec/slices/profile/grpc/profile_lifecycle_spec.rb b/dystopia/monolith/spec/slices/profile/grpc/profile_lifecycle_spec.rb
new file mode 100644
index 00000000..ef02f4d0
--- /dev/null
+++ b/dystopia/monolith/spec/slices/profile/grpc/profile_lifecycle_spec.rb
@@ -0,0 +1,139 @@
+# frozen_string_literal: true
+
+require "spec_helper"
+require "lib/current"
+require "lib/interceptors/authentication_interceptor"
+require "slices/profile/grpc/profile_handler"
+
+RSpec.describe "Profile lifecycle RPCs", type: :database do
+  let(:db) { Hanami.app["db.gateway"].connection }
+  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
+
+  let(:account_id) { create_account(role: 2) }
+  let!(:first) { create_account_with_profile(account_id: account_id, username: "lifecycle_first") }
+  let!(:second) { create_account_with_profile(account_id: account_id, username: "lifecycle_second") }
+  let(:stranger) { create_account_with_profile(role: 2, username: "lifecycle_stranger") }
+
+  def rpc(method, message)
+    Profile::Grpc::ProfileHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
+  end
+
+  def status(code)
+    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
+  end
+
+  def disable(profile_id)
+    rpc(:disable_profile, Profile::V1::DisableProfileRequest.new(profile_id: profile_id))
+  end
+
+  def enable(profile_id)
+    rpc(:enable_profile, Profile::V1::EnableProfileRequest.new(profile_id: profile_id))
+  end
+
+  def delete(profile_id)
+    rpc(:delete_profile, Profile::V1::DeleteProfileRequest.new(profile_id: profile_id))
+  end
+
+  def disabled?(profile_id)
+    !db[:profile__profiles].where(id: profile_id).get(:disabled_at).nil?
+  end
+
+  def acting_as(profile_id)
+    request = double(:request, metadata: { "x-user-id" => account_id, "x-profile-id" => profile_id }, context: {})
+    Interceptors::AuthenticationInterceptor.new(request, double(:error)).call { yield }
+  end
+
+  before { Current.account_id = account_id }
+  after { Current.clear }
+
+  describe "DisableProfile" do
+    it "disables a profile of the account without an acting profile and stops it from acting" do
+      response = disable(first)
+
+      expect([response.profile.id, response.profile.disabled]).to eq([first, true])
+      expect([disabled?(first), disabled?(second)]).to eq([true, false])
+      expect {
+        acting_as(first) { rpc(:save_profile_media, Profile::V1::SaveProfileMediaRequest.new) }
+      }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
+    end
+
+    it "refuses to disable the last enabled profile" do
+      disable(first)
+
+      expect { disable(second) }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
+      expect(disabled?(second)).to be false
+    end
+
+    it "answers NOT_FOUND for a profile of another account and leaves it enabled" do
+      expect { disable(stranger) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
+      expect(disabled?(stranger)).to be false
+    end
+
+    it "keeps a disabled profile disabled when asked again" do
+      disable(first)
+
+      expect(disable(first).profile.disabled).to be true
+    end
+
+    it "requires an account" do
+      Current.clear
+
+      expect { disable(first) }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
+    end
+  end
+
+  describe "EnableProfile" do
+    it "enables a disabled profile of the account so that it can act again" do
+      disable(first)
+
+      response = enable(first)
+
+      expect([response.profile.id, response.profile.disabled]).to eq([first, false])
+      expect(disabled?(first)).to be false
+      expect(acting_as(first) { rpc(:get_profile, Profile::V1::GetProfileRequest.new).profile.id }).to eq(first)
+    end
+
+    it "answers NOT_FOUND for a profile of another account and leaves it disabled" do
+      db[:profile__profiles].where(id: stranger).update(disabled_at: Time.now)
+
+      expect { enable(stranger) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
+      expect(disabled?(stranger)).to be true
+    end
+  end
+
+  describe "DeleteProfile" do
+    let(:post_repo) { Post::Slice["repositories.post_repository"] }
+    let(:karte_entries) { Karte::Slice["repositories.entry_repository"] }
+
+    it "refuses to delete an enabled profile" do
+      expect { delete(first) }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
+      expect(repo.find_by_id(first)).not_to be_nil
+    end
+
+    it "answers NOT_FOUND for a profile of another account and leaves it in place" do
+      db[:profile__profiles].where(id: stranger).update(disabled_at: Time.now)
+
+      expect { delete(stranger) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
+      expect(repo.find_by_id(stranger)).not_to be_nil
+    end
+
+    it "deletes a disabled profile with its rows in other slices, frees its username and keeps the account's karte record" do
+      post_repo.create_post(author_profile_id: first, content: "by first", visibility: "public")
+      kept_post = post_repo.create_post(author_profile_id: second, content: "by second", visibility: "public")
+      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: first, followee_profile_id: stranger, status: "approved")
+      record = karte_entries.create(
+        author_account_id: account_id, author_profile_id: first, target_profile_id: stranger, rating: 3, body: "note"
+      )
+      disable(first)
+
+      delete(first)
+
+      expect(db[:profile__profiles].where(account_id: account_id).select_map(:id)).to eq([second])
+      expect(db[:post__posts].select_map(:id)).to eq([kept_post.id])
+      expect(db[:social__follows].count).to eq(0)
+      expect(repo.username_available?("lifecycle_first")).to be true
+      mine = Karte::Slice["use_cases.list_my_entries"].call(viewer_account_id: account_id)
+      expect(mine[:entries].map { |entry| entry[:id] }).to eq([record.id])
+    end
+  end
+end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/profile/grpc/profile_lifecycle_spec.rb > /tmp/rspec-p8a-t2-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p8a-t2-red.txt`
Expected: `16 examples, 10 failures`

- [ ] **Step 2: proto と実装を足す**

次の内容を `/tmp/p8a-t2-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8a-t2-impl.patch && git apply /tmp/p8a-t2-impl.patch` を実行する。

```diff
diff --git a/dystopia/monolith/slices/profile/grpc/profile_handler.rb b/dystopia/monolith/slices/profile/grpc/profile_handler.rb
index d7b4d46a..be04c9ce 100644
--- a/dystopia/monolith/slices/profile/grpc/profile_handler.rb
+++ b/dystopia/monolith/slices/profile/grpc/profile_handler.rb
@@ -21,6 +21,9 @@ module Profile
       rpc :SaveProfile, ::Profile::V1::SaveProfileRequest, ::Profile::V1::SaveProfileResponse
       rpc :CheckUsernameAvailability, ::Profile::V1::CheckUsernameAvailabilityRequest, ::Profile::V1::CheckUsernameAvailabilityResponse
       rpc :SaveProfileMedia, ::Profile::V1::SaveProfileMediaRequest, ::Profile::V1::SaveProfileMediaResponse
+      rpc :DisableProfile, ::Profile::V1::DisableProfileRequest, ::Profile::V1::DisableProfileResponse
+      rpc :EnableProfile, ::Profile::V1::EnableProfileRequest, ::Profile::V1::EnableProfileResponse
+      rpc :DeleteProfile, ::Profile::V1::DeleteProfileRequest, ::Profile::V1::DeleteProfileResponse

       include ::Profile::Deps[
         get_profile_uc: "use_cases.get_profile",
@@ -30,6 +33,9 @@ module Profile
         save_profile_uc: "use_cases.save_profile",
         check_username_uc: "use_cases.check_username_availability",
         save_media_uc: "use_cases.save_profile_media",
+        disable_profile_uc: "use_cases.disable_profile",
+        enable_profile_uc: "use_cases.enable_profile",
+        delete_profile_uc: "use_cases.delete_profile",
         profile_repository: "repositories.profile_repository",
         cast_repository: "repositories.cast_repository"
       ]
@@ -124,6 +130,37 @@ module Profile
         build_response(::Profile::V1::SaveProfileMediaResponse, profile)
       end

+      def disable_profile
+        authenticate_account!
+
+        profile = disable_profile_uc.call(account_id: current_account_id, profile_id: request.message.profile_id)
+        build_response(::Profile::V1::DisableProfileResponse, profile)
+      rescue Profile::UseCases::DisableProfile::NotFoundError => e
+        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
+      rescue Profile::UseCases::DisableProfile::LastEnabledProfileError => e
+        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
+      end
+
+      def enable_profile
+        authenticate_account!
+
+        profile = enable_profile_uc.call(account_id: current_account_id, profile_id: request.message.profile_id)
+        build_response(::Profile::V1::EnableProfileResponse, profile)
+      rescue Profile::UseCases::EnableProfile::NotFoundError => e
+        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
+      end
+
+      def delete_profile
+        authenticate_account!
+
+        delete_profile_uc.call(account_id: current_account_id, profile_id: request.message.profile_id)
+        ::Profile::V1::DeleteProfileResponse.new
+      rescue Profile::UseCases::DeleteProfile::NotFoundError => e
+        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
+      rescue Profile::UseCases::DeleteProfile::NotDisabledError => e
+        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::FAILED_PRECONDITION, e.message)
+      end
+
       private

       Presenter = Profile::Presenters::ProfilePresenter
diff --git a/dystopia/monolith/slices/profile/repositories/profile_repository.rb b/dystopia/monolith/slices/profile/repositories/profile_repository.rb
index 14a7816e..66be4e06 100644
--- a/dystopia/monolith/slices/profile/repositories/profile_repository.rb
+++ b/dystopia/monolith/slices/profile/repositories/profile_repository.rb
@@ -54,6 +54,26 @@ module Profile
         end
       end

+      def find_owned(account_id:, profile_id:)
+        return nil unless uuid?(account_id) && uuid?(profile_id)
+
+        profiles.where(id: profile_id, account_id: account_id).one
+      end
+
+      def disable_unless_last_enabled(account_id:, profile_id:)
+        profiles.dataset.db.transaction do
+          # Lock the account row so concurrent disables cannot both leave the account without an enabled profile.
+          profiles.dataset.db[:identity__accounts].where(id: account_id).for_update.first
+          next nil if profiles.where(account_id: account_id, disabled_at: nil).exclude(id: profile_id).count.zero?
+
+          update(profile_id, disabled_at: Time.now, updated_at: Time.now)
+        end
+      end
+
+      def enable(profile_id)
+        update(profile_id, disabled_at: nil, updated_at: Time.now)
+      end
+
       def update_profile(id, attrs)
         update(id, attrs.merge(updated_at: Time.now))
       end
diff --git a/dystopia/monolith/slices/profile/use_cases/delete_profile.rb b/dystopia/monolith/slices/profile/use_cases/delete_profile.rb
new file mode 100644
index 00000000..2f470fe8
--- /dev/null
+++ b/dystopia/monolith/slices/profile/use_cases/delete_profile.rb
@@ -0,0 +1,21 @@
+# frozen_string_literal: true
+
+module Profile
+  module UseCases
+    class DeleteProfile
+      class NotFoundError < StandardError; end
+      class NotDisabledError < StandardError; end
+
+      include Deps["repositories.profile_repository", purge_profile: "use_cases.purge_profile"]
+
+      def call(account_id:, profile_id:)
+        profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
+        raise NotFoundError, "Profile not found" unless profile
+        raise NotDisabledError, "有効なプロフィールは削除できません。先に無効にしてください" unless profile.disabled_at
+
+        purge_profile.call(profile_id: profile.id)
+        nil
+      end
+    end
+  end
+end
diff --git a/dystopia/monolith/slices/profile/use_cases/disable_profile.rb b/dystopia/monolith/slices/profile/use_cases/disable_profile.rb
new file mode 100644
index 00000000..e79a699d
--- /dev/null
+++ b/dystopia/monolith/slices/profile/use_cases/disable_profile.rb
@@ -0,0 +1,23 @@
+# frozen_string_literal: true
+
+module Profile
+  module UseCases
+    class DisableProfile
+      class NotFoundError < StandardError; end
+      class LastEnabledProfileError < StandardError; end
+
+      include Deps["repositories.profile_repository"]
+
+      def call(account_id:, profile_id:)
+        profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
+        raise NotFoundError, "Profile not found" unless profile
+        return profile if profile.disabled_at
+
+        disabled = profile_repository.disable_unless_last_enabled(account_id: account_id, profile_id: profile.id)
+        raise LastEnabledProfileError, "最後の有効なプロフィールは無効にできません" unless disabled
+
+        disabled
+      end
+    end
+  end
+end
diff --git a/dystopia/monolith/slices/profile/use_cases/enable_profile.rb b/dystopia/monolith/slices/profile/use_cases/enable_profile.rb
new file mode 100644
index 00000000..3480ce79
--- /dev/null
+++ b/dystopia/monolith/slices/profile/use_cases/enable_profile.rb
@@ -0,0 +1,19 @@
+# frozen_string_literal: true
+
+module Profile
+  module UseCases
+    class EnableProfile
+      class NotFoundError < StandardError; end
+
+      include Deps["repositories.profile_repository"]
+
+      def call(account_id:, profile_id:)
+        profile = profile_repository.find_owned(account_id: account_id, profile_id: profile_id)
+        raise NotFoundError, "Profile not found" unless profile
+        return profile unless profile.disabled_at
+
+        profile_repository.enable(profile.id)
+      end
+    end
+  end
+end
diff --git a/proto/dystopia/profile/v1/service.proto b/proto/dystopia/profile/v1/service.proto
index 22c296ec..3963c56c 100644
--- a/proto/dystopia/profile/v1/service.proto
+++ b/proto/dystopia/profile/v1/service.proto
@@ -10,6 +10,9 @@ service ProfileService {
   rpc SaveProfile (SaveProfileRequest) returns (SaveProfileResponse);
   rpc CheckUsernameAvailability (CheckUsernameAvailabilityRequest) returns (CheckUsernameAvailabilityResponse);
   rpc SaveProfileMedia (SaveProfileMediaRequest) returns (SaveProfileMediaResponse);
+  rpc DisableProfile (DisableProfileRequest) returns (DisableProfileResponse);
+  rpc EnableProfile (EnableProfileRequest) returns (EnableProfileResponse);
+  rpc DeleteProfile (DeleteProfileRequest) returns (DeleteProfileResponse);
 }

 message Profile {
@@ -90,3 +93,12 @@ message SaveProfileMediaRequest {
   string cover_media_id = 2;
 }
 message SaveProfileMediaResponse { Profile profile = 1; }
+
+message DisableProfileRequest { string profile_id = 1; }
+message DisableProfileResponse { Profile profile = 1; }
+
+message EnableProfileRequest { string profile_id = 1; }
+message EnableProfileResponse { Profile profile = 1; }
+
+message DeleteProfileRequest { string profile_id = 1; }
+message DeleteProfileResponse {}
```

- [ ] **Step 3: stub を生成する**

Run(`dystopia/monolith`):
```bash
rbenv exec bundle exec bin/codegen
git diff --name-only --relative -- stubs | /usr/bin/grep -v -E '^stubs/profile/v1/service(_services)?_pb.rb$' | xargs git checkout --
git status --short stubs
```
Expected: ` M stubs/profile/v1/service_pb.rb` と ` M stubs/profile/v1/service_services_pb.rb` の 2 行だけ。

Run(`dystopia/frontend`):
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v -E '^src/stub/profile/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"
```
Expected: ` M src/stub/profile/v1/service_pb.ts` の 1 行と `tsc exit=0`。

- [ ] **Step 4: 通ることを確認する**

Run(`dystopia/monolith`): Step 1 と同じ rspec のコマンド(出力先は `/tmp/rspec-p8a-t2-green.txt`)。
Expected: `16 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `658 examples, 0 failures`

- [ ] **Step 5: Commit**

```bash
cd ../.. && git add -A proto/dystopia/profile dystopia/monolith dystopia/frontend/src/stub && git status --short && git commit -s -m "feat(dystopia): disable, enable and delete a profile" && cd dystopia/monolith
```

`git status --short` の出力が 10 行であることを確認してから commit する。

---

### Task 3: Own-account reviews, the retired alias and the proto field check

**Files:**
- Create: `slices/profile/use_cases/same_account.rb`、`spec/slices/profile/use_cases/same_account_spec.rb`、`spec/stubs/field_names_spec.rb`
- Modify: `slices/review/use_cases/create_entry.rb`、`lib/grpc/authenticatable.rb`
- Modify(spec): `spec/slices/review/use_cases/create_entry_spec.rb`、`spec/slices/review/grpc/review_handler_spec.rb`、`spec/lib/grpc/authenticatable_spec.rb`

**Interfaces:**
- Produces:
  - `Profile::Slice["use_cases.same_account"].call(profile_id:, other_profile_id:)` → 真偽(どちらかの profile が存在しなければ偽)
  - `Review::UseCases::CreateEntry` は、作者と対象が同じ account の profile なら `CreateError`(handler は `INVALID_ARGUMENT` に写す)
  - `Grpc::Authenticatable#current_user_id` は無くなる

- [ ] **Step 1: spec を足す・書き換える(失敗する)**

次の内容を `/tmp/p8a-t3-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8a-t3-spec.patch && git apply /tmp/p8a-t3-spec.patch` を実行する。

```diff
diff --git a/dystopia/monolith/spec/lib/grpc/authenticatable_spec.rb b/dystopia/monolith/spec/lib/grpc/authenticatable_spec.rb
index c72ab6f4..434e2d33 100644
--- a/dystopia/monolith/spec/lib/grpc/authenticatable_spec.rb
+++ b/dystopia/monolith/spec/lib/grpc/authenticatable_spec.rb
@@ -74,11 +74,4 @@ RSpec.describe Grpc::Authenticatable do
     expect(host.current_account_id).to eq("acc-1")
     expect(host.current_profile_id).to eq("prof-1")
   end
-
-  it "returns the profile id from current_user_id" do
-    Current.account_id = "acc-1"
-    Current.profile_id = "prof-1"
-
-    expect(host.current_user_id).to eq("prof-1")
-  end
 end
diff --git a/dystopia/monolith/spec/slices/profile/use_cases/same_account_spec.rb b/dystopia/monolith/spec/slices/profile/use_cases/same_account_spec.rb
new file mode 100644
index 00000000..a39198b8
--- /dev/null
+++ b/dystopia/monolith/spec/slices/profile/use_cases/same_account_spec.rb
@@ -0,0 +1,22 @@
+# frozen_string_literal: true
+
+require "spec_helper"
+
+RSpec.describe "Profile::UseCases::SameAccount", type: :database do
+  let(:use_case) { Hanami.app.slices[:profile]["use_cases.same_account"] }
+  let(:account_id) { create_account(role: 2) }
+  let(:first) { create_account_with_profile(account_id: account_id) }
+  let(:second) { create_account_with_profile(account_id: account_id) }
+  let(:stranger) { create_account_with_profile(role: 2) }
+
+  it "is true for two profiles of one account and for a profile compared with itself" do
+    expect(use_case.call(profile_id: first, other_profile_id: second)).to be true
+    expect(use_case.call(profile_id: first, other_profile_id: first)).to be true
+  end
+
+  it "is false for profiles of different accounts and for a profile that does not exist" do
+    expect(use_case.call(profile_id: first, other_profile_id: stranger)).to be false
+    expect(use_case.call(profile_id: first, other_profile_id: SecureRandom.uuid_v7)).to be false
+    expect(use_case.call(profile_id: SecureRandom.uuid_v7, other_profile_id: SecureRandom.uuid_v7)).to be false
+  end
+end
diff --git a/dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb b/dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb
index 334f6548..44176b10 100644
--- a/dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb
+++ b/dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb
@@ -69,6 +69,20 @@ RSpec.describe Review::Grpc::ReviewHandler, type: :database do
     expect(db[:review__entries].count).to eq(0)
   end

+  it "rejects a review about another profile of the author's own account, and about the author itself" do
+    owner = create_account(role: 2)
+    persona = create_account_with_profile(account_id: owner, username: "review_persona")
+    sibling = create_account_with_profile(account_id: owner, username: "review_sibling")
+    Hanami.app.slices[:profile]["repositories.cast_repository"].create(profile_id: sibling)
+
+    act_as(persona)
+
+    expect { review(sibling) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
+    expect { review(persona) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
+    expect(review(cast).target_profile_id).to eq(cast)
+    expect(db[:review__entries].count).to eq(1)
+  end
+
   it "lists reviews by target, by author and in the recent list with both parties" do
     act_as(guest)
     review(cast)
diff --git a/dystopia/monolith/spec/slices/review/use_cases/create_entry_spec.rb b/dystopia/monolith/spec/slices/review/use_cases/create_entry_spec.rb
index d8405083..e16593cb 100644
--- a/dystopia/monolith/spec/slices/review/use_cases/create_entry_spec.rb
+++ b/dystopia/monolith/spec/slices/review/use_cases/create_entry_spec.rb
@@ -3,7 +3,8 @@
 require "spec_helper"

 RSpec.describe Review::UseCases::CreateEntry do
-  let(:use_case) { described_class.new(entry_repo: entry_repo, get_role: get_role) }
+  let(:use_case) { described_class.new(entry_repo: entry_repo, get_role: get_role, same_account: same_account) }
+  let(:same_account) { double(:same_account, call: false) }
   let(:entry_repo) { double(:entry_repository) }
   let(:get_role) { double(:get_role) }

@@ -32,6 +33,16 @@ RSpec.describe Review::UseCases::CreateEntry do
     }.not_to raise_error
   end

+  it "rejects a review about a profile of the author's own account" do
+    allow(get_role).to receive(:call).with(profile_id: target_id).and_return(2)
+    allow(same_account).to receive(:call).with(profile_id: viewer_id, other_profile_id: target_id).and_return(true)
+    expect(entry_repo).not_to receive(:create)
+
+    expect {
+      use_case.call(viewer_profile_id: viewer_id, target_profile_id: target_id, rating: 3.0, body: nil)
+    }.to raise_error(Review::UseCases::CreateEntry::CreateError, /own account/)
+  end
+
   it "rejects when target is a guest" do
     allow(get_role).to receive(:call).with(profile_id: target_id).and_return(1)
     expect {
diff --git a/dystopia/monolith/spec/stubs/field_names_spec.rb b/dystopia/monolith/spec/stubs/field_names_spec.rb
new file mode 100644
index 00000000..6e944f41
--- /dev/null
+++ b/dystopia/monolith/spec/stubs/field_names_spec.rb
@@ -0,0 +1,33 @@
+# frozen_string_literal: true
+
+require "spec_helper"
+
+RSpec.describe "proto field names" do
+  ACCOUNT_SCOPED_PACKAGES = %w[identity.v1 billing.v1].freeze
+
+  let(:stub_files) do
+    Dir[File.expand_path("../../stubs/**/*_pb.rb", __dir__)].reject { |path| path.end_with?("_services_pb.rb") }
+  end
+
+  let(:message_names) do
+    stub_files.each { |path| require path }
+    stub_files.flat_map { |path| File.read(path).scan(/lookup\("([\w.]+)"\)\.msgclass/).flatten }
+  end
+
+  it "reads the messages of every package" do
+    packages = message_names.map { |name| name.split(".").first(2).join(".") }.uniq
+
+    expect(packages).to include("profile.v1", "post.v1", "social.v1", "messaging.v1", "karte.v1", "review.v1")
+  end
+
+  it "names no field after an account id outside the identity and billing packages" do
+    pool = Google::Protobuf::DescriptorPool.generated_pool
+    exposed = message_names.reject { |name| ACCOUNT_SCOPED_PACKAGES.any? { |package| name.start_with?("#{package}.") } }
+
+    offenders = exposed.flat_map do |name|
+      pool.lookup(name).map(&:name).grep(/account_id/).map { |field| "#{name}.#{field}" }
+    end
+
+    expect(offenders).to eq([])
+  end
+end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/stubs spec/lib spec/slices/review spec/slices/profile/use_cases/same_account_spec.rb > /tmp/rspec-p8a-t3-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p8a-t3-red.txt`
Expected: `158 examples, 10 failures`(`field_names_spec` の 2 件は、proto に account の id の field が既に無いので最初から通る。この spec が field を実際に読んでいることは dry run で確かめてある)。

- [ ] **Step 2: 実装する**

次の内容を `/tmp/p8a-t3-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p8a-t3-impl.patch && git apply /tmp/p8a-t3-impl.patch` を実行する。

```diff
diff --git a/dystopia/monolith/lib/grpc/authenticatable.rb b/dystopia/monolith/lib/grpc/authenticatable.rb
index f9b48d96..fc718298 100644
--- a/dystopia/monolith/lib/grpc/authenticatable.rb
+++ b/dystopia/monolith/lib/grpc/authenticatable.rb
@@ -41,10 +41,5 @@ module Grpc
     def current_profile_id
       ::Current.profile_id
     end
-
-    # TODO: Remove once every slice reads current_profile_id.
-    def current_user_id
-      ::Current.profile_id
-    end
   end
 end
diff --git a/dystopia/monolith/slices/profile/use_cases/same_account.rb b/dystopia/monolith/slices/profile/use_cases/same_account.rb
new file mode 100644
index 00000000..0dab5494
--- /dev/null
+++ b/dystopia/monolith/slices/profile/use_cases/same_account.rb
@@ -0,0 +1,16 @@
+# frozen_string_literal: true
+
+module Profile
+  module UseCases
+    class SameAccount
+      include Deps["repositories.profile_repository"]
+
+      def call(profile_id:, other_profile_id:)
+        first = profile_repository.find_by_id(profile_id)
+        second = profile_repository.find_by_id(other_profile_id)
+
+        !first.nil? && !second.nil? && first.account_id == second.account_id
+      end
+    end
+  end
+end
diff --git a/dystopia/monolith/slices/review/use_cases/create_entry.rb b/dystopia/monolith/slices/review/use_cases/create_entry.rb
index 7bcc933f..b8fadfbb 100644
--- a/dystopia/monolith/slices/review/use_cases/create_entry.rb
+++ b/dystopia/monolith/slices/review/use_cases/create_entry.rb
@@ -10,9 +10,10 @@ module Review

       include Review::Deps[entry_repo: "repositories.entry_repository"]

-      def initialize(entry_repo: nil, get_role: nil, **kwargs)
+      def initialize(entry_repo: nil, get_role: nil, same_account: nil, **kwargs)
         super(**kwargs.merge(entry_repo: entry_repo).compact)
         @get_role = get_role
+        @same_account = same_account
       end

       def call(viewer_profile_id:, target_profile_id:, rating:, body:)
@@ -22,6 +23,9 @@ module Review
         target_role = get_role.call(profile_id: target_profile_id)
         raise CreateError, "Target not found" unless target_role
         raise CreateError, "Target must be a cast" unless target_role == 2
+        if same_account.call(profile_id: viewer_profile_id, other_profile_id: target_profile_id)
+          raise CreateError, "Cannot review a profile of your own account"
+        end

         entry_repo.create(
           author_profile_id: viewer_profile_id,
@@ -36,6 +40,10 @@ module Review
       def get_role
         @get_role ||= ::Profile::Slice["use_cases.get_role"]
       end
+
+      def same_account
+        @same_account ||= ::Profile::Slice["use_cases.same_account"]
+      end
     end
   end
 end
```

Run(`dystopia/monolith`): `/usr/bin/grep -rn 'current_user_id' slices lib spec | wc -l`
Expected: `0`

- [ ] **Step 3: 通ることを確認する**

Run: Step 1 と同じ rspec のコマンド(出力先は `/tmp/rspec-p8a-t3-green.txt`)。
Expected: `158 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `663 examples, 0 failures`

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add -A dystopia/monolith && git status --short && git commit -s -m "feat(dystopia/monolith): reject reviews within one account and retire current_user_id" && cd dystopia/monolith
```

`git status --short` の出力が `dystopia/monolith` の下の 8 行であることを確認してから commit する。

---

## Controller verification (not dispatched)

frontend にはまだ無効化・削除の画面が無い(段 9)ので、BFF を通した確認はできない。Task 3 の後、controller が使い捨ての database に seed を入れ、`bin/grpc` を起動して gRPC を直接呼んで確認する。

- 人格を 2 つ持つ cast の account で、片方を無効化 → その人格では操作できない → 有効化 → 操作できる。
- 無効化した人格を削除すると、その人格の投稿・フォロー・レビューが消え、もう片方の人格と karte の記録は残る。username が再び使える。
- 最後の有効な人格の無効化、有効な人格の削除、他人の profile の操作が、決めた status で拒否される。
- `rake` の退会 purge が、猶予を過ぎた account を全 profile ごと消す。

## Known gaps left for later plans

- 可視性(無効な人格と、退会手続き中の account の人格を、本人以外から見えなくする)は P8b で扱う。この plan の時点では、無効な人格は「操作できない」だけで、他人からは見えたままである。
- frontend の無効化・有効化・削除の画面と BFF の route は段 9 で作る。
- media の行は、人格を消しても残る(Decisions 参照)。`Media::UseCases::PurgeProfile` は `uploader_profile_id` で消すが、アップロード者を記録していないので 1 行も消えない。
- karte の記録は人格を消しても残り、著者の表示が空になる(spec の決定どおり)。
- 人格を消すとき、その人格の投稿に付いた他人のいいね・コメント・ブックマークと、その人格宛ての通知の扱いは、各 slice の既存の purge のままである。
- `slices/review/grpc/handler.rb` は gruf と `lib/grpc/authenticatable` を自分で require していない(P7 から引き継ぎ)。
- P1a〜P7 の Known gaps はそのまま残る。
