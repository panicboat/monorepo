# Multi Profile P7: Review, Discovery and Feed Actor Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** review・discovery・feed の 3 slice が持つ「行為者の id」を表す名前を、カラム・proto・Ruby・BFF・frontend のすべてで profile に揃える。挙動は変えない。

**Architecture:** 値は段 1 から profile の id なので、変えるのは名前だけである。改名は決まった規則の置換(perl)で行う。review の handler は、use case が返す hash を symbol の key で読んで `.to_s` する。key がずれるとエラーにならずに空文字を返すので、handler を実 database で動かす spec を先に書き、改名の前後で赤 → 緑を確かめる。discovery の handler にも spec が無いので、現在の挙動を固定する spec を同時に足す(proto は変わらないので、こちらは改名の前から通る)。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL 18 / RSpec。frontend は Next.js 16 / TypeScript 7 / vitest 5 / buf。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(API contract の「その他の proto」、Schema changes の `review.entries` と `review.cast_settings` の行、Delivery の段 7)

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で通しで適用して確かめてある。plan に載せた script と file をゼロから再適用して、同じ差分(71 ファイル)になることも確かめた。最終結果は monolith `647 examples, 0 failures`、frontend `tsc` エラー 0・vitest `95` ファイル `356` 件通過。各 Step の Expected のうち数を示したものは、その再適用での実測である。migration は up → down → up を実行して確かめた。Review Focus に「テストで守る」と書いた項目は、該当箇所を壊すと赤になることを確かめてある。

この plan は stack の 7 段目で、ブランチ `feat/dystopia-multi-profile-review`(`feat/dystopia-multi-profile-footprints` の上)に積む。

## Naming

| 場所 | 旧 | 新 |
|---|---|---|
| `review.entries` | `author_account_id` / `target_account_id` | `author_profile_id` / `target_profile_id` |
| `review.cast_settings` | `account_id` | `profile_id` |
| proto(review) | `ReviewEntry` と各 request の `author_account_id` / `target_account_id` | `author_profile_id` / `target_profile_id` |
| review の use case と repository の引数 | `viewer_account_id:` / `target_account_id:` / `author_account_id:` / `page_owner_account_id:` / `account_id:` | `viewer_profile_id:` / `target_profile_id:` / `author_profile_id:` / `page_owner_profile_id:` / `profile_id:` |
| review の use case が返す entry の hash の key | `:author_account_id` / `:target_account_id` | `:author_profile_id` / `:target_profile_id` |
| review の repository・adapter・private メソッド | `find_by_account` / `bidirectionally_blocked_ids(account_id:)` / `reachable_account_ids` | `find_by_profile` / `bidirectionally_blocked_ids(profile_id:)` / `reachable_profile_ids` |
| discovery と feed の use case の引数 | `viewer_account_id:` | `viewer_profile_id:` |
| feed の adapter | `following_account_ids(account_id:)` / `bidirectionally_blocked_account_ids(account_id:)` | `following_profile_ids(profile_id:)` / `bidirectionally_blocked_profile_ids(profile_id:)` |
| handler | `current_user_id` | `current_profile_id` |
| frontend の view | `ReviewEntry.authorAccountId` / `targetAccountId` | `authorProfileId` / `targetProfileId` |
| frontend の props・hook・BFF | `ReviewsTab` の `accountId` / `ReviewComposer` の `targetAccountId` / body `targetAccountId` / query `account_id` | `profileId` / `targetProfileId` / `targetProfileId` / `profile_id` |
| frontend の hook の local | `userId`(review 4 箇所・discovery 4 箇所) | `profileId` |

proto の field 番号は変えない。discovery と feed の proto には改名する field が無い。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-review`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0、`env -u NODE_OPTIONS pnpm exec vitest run` で失敗 0。開始時点の基準は rspec `638 examples, 0 failures`、vitest 93 ファイル 350 件通過、`tsc` エラー 0。
- 挙動を変えない。この plan が足すテスト以外の spec と test は、名前の置換だけで通る。期待値(件数・順序・status)を書き換えて通すことはしない。
- script は必ず `bash` で実行する。zsh は変数に入れたファイル一覧を単語に分割しないので、`zsh` で実行すると置換が 1 件も適用されない。
- **karte と billing は変えない。** この 2 slice も `viewer_account_id` / `author_account_id` / `target_account_id` という名前を持つが、中身は本物の account の id である(カルテと課金は account に属する)。置換は review・discovery・feed の下と、script が名指しする他 slice の spec の行だけに適用する。
- 本物の account の id は変えない。discovery の handler は、profile の表示のために `account_id`(profile の行が持つ account の id)から role を引く(`role_for(account_id)`)。
- `Current.account_id` と `create_account_with_profile` の引数(fixture)は変えない。
- discovery の RPC と use case の名前(`SearchUsers` / `SuggestUsers`)は変えない。id の種類を表す名前ではない。
- カラムを改名したら、名前にカラム名を含む NOT NULL 制約も改名する(全環境が PostgreSQL 18.6)。
- テスト用 database に seed や手動の行を入れない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan の手順はコメントを追加しない。
- 名前は現在の状態を表す。test の名前に「former」「old」「new」のような変更履歴の語を使わない。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` と pull request の作成はしない(区切りの判断と push は controller が行う)。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない。

## Review Focus

改名で壊れやすく、既存のテストでは検知できない箇所。各行のテストは括弧内のタスクに入れてある。

1. review の use case が返す hash の key(`:author_profile_id` / `:target_profile_id`)を、handler が `e[:author_profile_id].to_s` で読む箇所。key がずれると `nil.to_s` で空文字になり、エラーにならない(Task 1 の review の spec が、作成・一覧・更新のすべての応答で両方の id を確かめる。handler の key を旧名に戻すと落ちることを確かめた)。
2. 作者と対象の向き。作者だけが編集・削除でき、対象だけが非表示にできる(Task 1 の review の spec。作成時に作者と対象を入れ替えた場合、非表示の判定を作者にした場合、更新の判定を対象にした場合に落ちることを確かめた)。
3. レビューの公開設定は cast の profile ごとに持ち、切った cast のレビューは他の profile に見えない(Task 1 の review の spec。設定を account の id で保存した場合と、新着一覧が設定を見ない場合に落ちることを確かめた)。
4. block の判定は「ページの持ち主でない側」に対して行う(Task 1 の review の spec。持ち主の側で判定すると落ちることを確かめた)。
5. 本物の account の id が置換に巻き込まれない。discovery の handler の `role_for(profile.account_id)`(Task 1 の discovery の spec が profile の `role` を確かめる。profile の id を渡すと落ちることを確かめた)と、karte・billing の同名の引数(Task 1 の Step 5 で、この 2 slice に差分が無いことを確かめる)。
6. discovery の検索・ランキング・おすすめが、操作中の profile の可視性と block で絞られる(Task 1 の discovery の spec。viewer を渡さない場合と block を除外しない場合に落ちることを確かめた)。
7. frontend の型の付いていない名前: レビューを作る hook が送る body(`targetProfileId`)、一覧を取得する SWR の key の query(`profile_id`)、BFF が読む名前(Task 2 の test 2 ファイル)。

---

### Task 1: Proto, schema and monolith

**Files:**
- Modify: `proto/dystopia/review/v1/service.proto`
- Generate: `dystopia/monolith/stubs/review/v1/service_pb.rb`
- Create: `dystopia/monolith/config/db/migrate/20261008060000_rename_review_actor_columns_to_profile.rb`
- Create: `dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb`、`spec/slices/discovery/grpc/discovery_handler_spec.rb`
- Modify: `dystopia/monolith/slices/review/**`、`slices/discovery/**`、`slices/feed/**`、`spec/slices/review/**`、`spec/slices/discovery/**`
- Modify(spec): `spec/slices/post/cross_slice_wiring_spec.rb`、`spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`

**Interfaces:**
- Consumes: `Grpc::Authenticatable#current_profile_id`、`ProfileFixtures`
- Produces: Naming の表のとおり。他 slice の spec から呼ばれるものは次のとおり。
  - `Feed::UseCases::ListFeed#call(filter:, viewer_profile_id:, prefecture: nil, limit:, cursor:)`
  - `Discovery::Slice["use_cases.rank_posts"].call(period:, viewer_profile_id:)`、`Discovery::Slice["use_cases.search_posts"].call(query:, viewer_profile_id:)`
  - `Review::Slice["use_cases.filter_visible_entries"].call(viewer_profile_id:, page_owner_profile_id:, entries:)`
  - `Review::Slice["use_cases.list_recent_entries"].call(viewer_profile_id:)`
  - `Review::Slice["repositories.entry_repository"].create(author_profile_id:, target_profile_id:, rating:, body:)`
  - `Review::Adapters::BlockAdapter#bidirectionally_blocked_ids(profile_id:)`、`Feed::Adapters::BlockAdapter#bidirectionally_blocked_profile_ids(profile_id:)`、`Feed::Adapters::FollowAdapter#following_profile_ids(profile_id:)`

- [ ] **Step 1: handler の spec を書く(review の分が失敗する)**

`spec/slices/review/grpc/review_handler_spec.rb`(`slices/review/grpc/handler.rb` は gruf と `lib/grpc/authenticatable` を自分で require していないので、spec の側で先に require する):

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "gruf"
require "lib/grpc/authenticatable"
require "slices/review/grpc/review_handler"

RSpec.describe Review::Grpc::ReviewHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "review_cast") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "review_other_cast") }
  let(:guest) { create_account_with_profile(username: "review_guest") }
  let(:reader) { create_account_with_profile(username: "review_reader") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def review(target)
    rpc(:create_entry, Review::V1::CreateEntryRequest.new(target_profile_id: target, rating: 4.5, body: "great")).entry
  end

  def by_target(profile_id)
    rpc(:list_entries_by_target, Review::V1::ListEntriesByTargetRequest.new(target_profile_id: profile_id)).entries
  end

  def by_author(profile_id)
    rpc(:list_entries_by_author, Review::V1::ListEntriesByAuthorRequest.new(author_profile_id: profile_id)).entries
  end

  def recent
    rpc(:list_recent_entries, Review::V1::ListRecentEntriesRequest.new).entries
  end

  def parties(entries)
    entries.map { |e| [e.author_profile_id, e.target_profile_id, e.author_username, e.target_username] }
  end

  def settings
    rpc(:get_my_settings, Review::V1::GetMySettingsRequest.new).reviews_visible
  end

  after { Current.clear }

  it "stores a review from the acting profile about the target profile" do
    act_as(guest)

    entry = review(cast)

    expect(parties([entry])).to eq([[guest, cast, "review_guest", "review_cast"]])
    expect(db[:review__entries].select_map([:author_profile_id, :target_profile_id])).to eq([[guest, cast]])
  end

  it "accepts a review only about a cast profile" do
    act_as(guest)

    expect { review(reader) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    expect(db[:review__entries].count).to eq(0)
  end

  it "lists reviews by target, by author and in the recent list with both parties" do
    act_as(guest)
    review(cast)
    review(other_cast)
    about_cast = [guest, cast, "review_guest", "review_cast"]
    about_other_cast = [guest, other_cast, "review_guest", "review_other_cast"]

    act_as(reader)

    expect(parties(by_target(cast))).to eq([about_cast])
    expect(parties(by_author(guest))).to eq([about_other_cast, about_cast])
    expect(parties(recent)).to eq([about_other_cast, about_cast])
  end

  it "lets only the author change a review and only the target hide it" do
    act_as(guest)
    id = review(cast).id

    act_as(reader)
    expect { rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 1.0)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    expect { rpc(:hide_entry, Review::V1::HideEntryRequest.new(entry_id: id)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    expect { rpc(:delete_entry, Review::V1::DeleteEntryRequest.new(entry_id: id)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)

    act_as(cast)
    expect { rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 1.0)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    expect(rpc(:hide_entry, Review::V1::HideEntryRequest.new(entry_id: id)).entry.hidden).to be true
    expect(by_target(cast).map(&:hidden)).to eq([true])

    act_as(reader)
    expect(by_target(cast)).to be_empty

    act_as(guest)
    expect { rpc(:unhide_entry, Review::V1::UnhideEntryRequest.new(entry_id: id)) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    updated = rpc(:update_entry, Review::V1::UpdateEntryRequest.new(entry_id: id, rating: 2.0)).entry
    expect([updated.rating, updated.author_profile_id, updated.target_profile_id]).to eq([2.0, guest, cast])
    rpc(:delete_entry, Review::V1::DeleteEntryRequest.new(entry_id: id))
    expect(db[:review__entries].count).to eq(0)
  end

  it "stores review settings per cast profile and hides that cast's reviews from other profiles" do
    act_as(guest)
    review(cast)
    review(other_cast)

    act_as(cast)
    expect(settings).to be true
    expect(rpc(:update_my_settings, Review::V1::UpdateMySettingsRequest.new(reviews_visible: false)).reviews_visible).to be false
    expect(db[:review__cast_settings].select_map([:profile_id, :reviews_visible])).to eq([[cast, false]])
    expect(settings).to be false
    expect(by_target(cast).length).to eq(1)

    act_as(other_cast)
    expect(settings).to be true

    act_as(reader)
    expect(by_target(cast)).to be_empty
    expect(by_target(other_cast).map(&:author_profile_id)).to eq([guest])
    expect(recent.map(&:target_profile_id)).to eq([other_cast])
  end

  it "hides a review from a viewer who is blocked with the other party" do
    act_as(guest)
    review(cast)
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: guest, blocked_profile_id: reader)

    act_as(reader)

    expect(by_target(cast)).to be_empty
    expect(recent).to be_empty

    act_as(other_cast)
    expect(by_target(cast).map(&:author_profile_id)).to eq([guest])
  end
end
```

`spec/slices/discovery/grpc/discovery_handler_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/discovery/grpc/discovery_handler"

RSpec.describe Discovery::Grpc::DiscoveryHandler, type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  let!(:viewer) { create_account_with_profile(username: "discovery_viewer") }
  let!(:other_guest) { create_account_with_profile(username: "discovery_other_guest") }
  let!(:public_cast) { create_account_with_profile(role: 2, username: "discovery_public") }
  let!(:private_cast) { create_account_with_profile(role: 2, username: "discovery_private", is_private: true) }
  let!(:public_post) { post_repo.create_post(author_profile_id: public_cast, content: "discovery public", visibility: "public") }
  let!(:private_post) { post_repo.create_post(author_profile_id: private_cast, content: "discovery private", visibility: "public") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def suggested
    rpc(:suggest_users, Discovery::V1::SuggestUsersRequest.new).profiles.map { |p| [p.id, p.role] }
  end

  def searched_post_ids
    rpc(:search_posts, Discovery::V1::SearchPostsRequest.new(query: "discovery")).posts.map(&:id)
  end

  def ranked_post_ids
    rpc(:rank_posts, Discovery::V1::RankPostsRequest.new(period: :RANK_PERIOD_ALL)).posts.map(&:id)
  end

  after { Current.clear }

  it "suggests profiles of the opposite role, without the ones the acting profile follows or is blocked with" do
    act_as(viewer)
    expect(suggested).to contain_exactly([public_cast, 2], [private_cast, 2])

    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: public_cast, status: "approved")
    block_repo.block(blocker_profile_id: private_cast, blocked_profile_id: viewer)
    expect(suggested).to be_empty

    act_as(public_cast)
    expect(suggested).to contain_exactly([viewer, 1], [other_guest, 1])
  end

  it "searches and ranks posts as the acting profile is allowed to see them" do
    act_as(viewer)
    expect(searched_post_ids).to eq([public_post.id])
    expect(ranked_post_ids).to eq([public_post.id])

    follow_repo.follow(follower_profile_id: viewer, followee_profile_id: private_cast, status: "approved")
    expect(searched_post_ids).to contain_exactly(public_post.id, private_post.id)
    expect(ranked_post_ids).to contain_exactly(public_post.id, private_post.id)

    act_as(other_guest)
    expect(searched_post_ids).to eq([public_post.id])
    expect(ranked_post_ids).to eq([public_post.id])
  end

  it "returns each found profile with the role of its account" do
    act_as(viewer)

    found = rpc(:search_users, Discovery::V1::SearchUsersRequest.new(query: "discovery_p")).profiles

    expect(found.map { |p| [p.username, p.role] }).to contain_exactly(["discovery_public", 2], ["discovery_private", 2])
  end
end
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/review/grpc spec/slices/discovery/grpc > /tmp/rspec-p7-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p7-red.txt`
Expected: `15 examples, 6 failures`(review の 6 件がすべて落ちる。discovery の 3 件は proto が変わらないので通り、改名の後も通り続けることを Step 6 で確かめる)。

- [ ] **Step 2: proto を改名する**

次の内容を `/tmp/p7-proto.sh` に保存し、リポジトリの root(`.worktrees/feat-dystopia-multi-profile-model`)で `bash /tmp/p7-proto.sh` を実行する。

```bash
set -euo pipefail
perl -pi -e 's/author_account_id/author_profile_id/g; s/target_account_id/target_profile_id/g' proto/dystopia/review/v1/service.proto
```

Run(root): `/usr/bin/grep -c 'account' proto/dystopia/review/v1/service.proto`
Expected: `0`

- [ ] **Step 3: Ruby の stub を生成する**

`bin/codegen` は全 package の stub を作り直す。review の stub 以外の差分を戻す。

Run(`dystopia/monolith`):
```bash
rbenv exec bundle exec bin/codegen
git diff --name-only --relative -- stubs | /usr/bin/grep -v -E '^stubs/review/v1/service(_services)?_pb.rb$' | xargs git checkout --
git status --short stubs
```
Expected: ` M stubs/review/v1/service_pb.rb` の 1 行だけ。

- [ ] **Step 4: migration を書いて適用する**

`config/db/migrate/20261008060000_rename_review_actor_columns_to_profile.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:review__entries) do
      rename_column :author_account_id, :author_profile_id
      rename_column :target_account_id, :target_profile_id
    end
    alter_table(:review__cast_settings) { rename_column :account_id, :profile_id }

    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_author_account_id_not_null TO entries_author_profile_id_not_null"
    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_target_account_id_not_null TO entries_target_profile_id_not_null"
    run "ALTER TABLE review.cast_settings RENAME CONSTRAINT cast_settings_account_id_not_null TO cast_settings_profile_id_not_null"
  end

  down do
    run "ALTER TABLE review.cast_settings RENAME CONSTRAINT cast_settings_profile_id_not_null TO cast_settings_account_id_not_null"
    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_target_profile_id_not_null TO entries_target_account_id_not_null"
    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_author_profile_id_not_null TO entries_author_account_id_not_null"

    alter_table(:review__cast_settings) { rename_column :profile_id, :account_id }
    alter_table(:review__entries) do
      rename_column :target_profile_id, :target_account_id
      rename_column :author_profile_id, :author_account_id
    end
  end
end
```

`idx_review_entries_author_created`・`idx_review_entries_target_created`・`cast_settings_pkey` は、名前にカラム名を含まないので変えない。

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated` と出る。`config/db/structure.sql` の dump は git の管理外なので commit に含めない。

Run: `psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select string_agg(n, ' ' order by n) from (select conname n from pg_constraint where connamespace = 'review'::regnamespace and conname ~ '(account|profile)' union select indexname from pg_indexes where schemaname = 'review' and indexname ~ '(account|profile)') x"`
Expected: `cast_settings_profile_id_not_null entries_author_profile_id_not_null entries_target_profile_id_not_null`

- [ ] **Step 5: Ruby の名前を置換する**

次の内容を `/tmp/p7-monolith.sh` に保存し、`dystopia/monolith` で `bash /tmp/p7-monolith.sh` を実行する。

```bash
set -euo pipefail

# 1. review, discovery and feed and their specs (role_for in the discovery handler takes a real account id)
FILES=$(find slices/review slices/discovery slices/feed spec/slices/review spec/slices/discovery -name '*.rb')
perl -pi -e 's/current_user_id/current_profile_id/g; s/\b(viewer|target|author|page_owner)_account_id\b/$1_profile_id/g; s/\b(reachable|following|bidirectionally_blocked)_account_ids\b/$1_profile_ids/g; s/\bfind_by_account\b/find_by_profile/g' $FILES
perl -pi -e 's/(?<![.\w])account_id\b/profile_id/g unless /role_for\(account_id\)|identity_account_repo\.find_by_id\(account_id\)/' $FILES

# 2. specs of other slices that call these use cases and adapters
perl -pi -e 's/(ListFeed\.new\.call\(filter: "\w+", )viewer_account_id:/$1viewer_profile_id:/; s/(\["use_cases\.(?:rank|search)_posts"\]\.call\([^)]*?)viewer_account_id:/$1viewer_profile_id:/' spec/slices/post/cross_slice_wiring_spec.rb
perl -pi -e 's/filter\.call\(viewer_account_id: (\w+), page_owner_account_id:/filter.call(viewer_profile_id: $1, page_owner_profile_id:/; s/(\["use_cases\.list_recent_entries"\]\.call\()viewer_account_id:/$1viewer_profile_id:/; s/bidirectionally_blocked_ids\(account_id:/bidirectionally_blocked_ids(profile_id:/; s/bidirectionally_blocked_account_ids\(account_id:/bidirectionally_blocked_profile_ids(profile_id:/; s/following_account_ids\(account_id:/following_profile_ids(profile_id:/; s/Struct\.new\(:hidden, :author_account_id, :target_account_id\)/Struct.new(:hidden, :author_profile_id, :target_profile_id)/; s/entry_repo\.create\(author_account_id: (\w+), target_account_id:/entry_repo.create(author_profile_id: $1, target_profile_id:/' spec/slices/social/rpc_and_cross_slice_wiring_spec.rb

# 3. spec titles that describe a profile as an account
perl -pi -e 's/\(private account, not followed\)/(private profile, not followed)/' spec/slices/review/use_cases/list_recent_entries_spec.rb
perl -pi -e 's/bidirectionally-blocked accounts/bidirectionally-blocked profiles/' spec/slices/discovery/use_cases/suggest_users_spec.rb
```

Run: `/usr/bin/grep -rn -E 'account_id|current_user_id|_account_ids|find_by_account' slices/review slices/discovery slices/feed spec/slices/review spec/slices/discovery --include='*.rb' | wc -l`
Expected: `7`。内訳は次のとおりで、これ以外が出たら置換漏れである。

- `slices/discovery/grpc/discovery_handler.rb` の 3 行: `role_for(profile.account_id)`、`def role_for(account_id)`、`identity_account_repo.find_by_id(account_id)`(本物の account の id)
- `spec/slices/discovery/use_cases/search_users_spec.rb` と `suggest_users_spec.rb` の `last_profile.account_id` の計 2 行(cursor が account の id でないことを確かめる行)
- 足した handler の spec 2 ファイルの `Current.account_id` の計 2 行

karte と billing に差分が無いことを確かめる。

Run: `git status --short slices/karte slices/billing spec/slices/karte spec/slices/billing | wc -l`
Expected: `0`

他の slice に旧い名前の呼び出しが残っていないことを確かめる(karte と billing を除く)。

Run: `/usr/bin/grep -rn -E '(viewer|page_owner|author|target)_account_id|_account_ids\b|find_by_account\b' slices spec lib --include='*.rb' | /usr/bin/grep -v -E '^(slices|spec/slices)/(karte|billing)/' | /usr/bin/grep -v 'purge_wiring_spec.rb' | wc -l`
Expected: `0`(`spec/slices/identity/use_cases/account/purge_wiring_spec.rb` は karte の行を作るために `author_account_id:` と `block_target_account_id` を使う。どちらも本物の account の id である)

Run: `git status --short . | wc -l`
Expected: `46`

- [ ] **Step 6: 足した spec と全体が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/review/grpc spec/slices/discovery/grpc > /tmp/rspec-p7-green.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p7-green.txt`
Expected: `15 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `647 examples, 0 failures`

失敗がある場合は、名前の置換漏れか置換し過ぎである。期待値を書き換えず、該当の名前だけを直す。直せない場合は BLOCKED として出力を報告する。

- [ ] **Step 7: migration の down を確かめる**

Run:
```bash
HANAMI_ENV=test rbenv exec bundle exec hanami db rollback
psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select string_agg(table_name||'('||cols||')', ' ' order by 1) from (select table_name, string_agg(column_name, ',' order by ordinal_position) cols from information_schema.columns where table_schema = 'review' and column_name ~ '(account|profile)' group by 1) y"
HANAMI_ENV=test rbenv exec bundle exec hanami db migrate
```
Expected: rollback は `rolled back to 20261008050000_rename_footprint_bookmark_schedule_and_media_actor_columns_to_profile` と出る。カラムは `cast_settings(account_id) entries(author_account_id,target_account_id)` に戻る。最後の migrate は `migrated` と出る。

- [ ] **Step 8: Commit**

```bash
cd ../.. && git add -A proto/dystopia/review dystopia/monolith && git status --short && git commit -s -m "refactor(dystopia): name the review, discovery and feed actor columns, fields and arguments after the profile" && cd dystopia/monolith
```

`git status --short` の出力が `proto/dystopia/review` と `dystopia/monolith` の下だけであることを確認してから commit する。

---

### Task 2: Frontend

**Files:**
- Generate: `dystopia/frontend/src/stub/review/v1/service_pb.ts`
- Create: `dystopia/frontend/src/app/api/review/profile-names.test.ts`、`src/modules/review/hooks/request-names.test.ts`
- Modify: `dystopia/frontend/src/modules/review/**`、`src/modules/discovery/hooks/**`、`src/app/api/review/**`、`src/app/reviews/**`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`

**Interfaces:**
- Consumes: Task 1 の proto
- Produces:
  - `@/modules/review` の `ReviewEntry.authorProfileId` / `targetProfileId`
  - `ReviewsTab` の props は `profileId`、`ReviewComposer` の props は `targetProfileId`
  - BFF: `POST /api/review` の body は `{ targetProfileId, rating, body }`、`GET /api/review/by-target` と `GET /api/review/by-author` の query は `profile_id`

- [ ] **Step 1: stub を生成する**

Run(`dystopia/frontend`):
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v -E '^src/stub/review/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
```
Expected: ` M src/stub/review/v1/service_pb.ts` の 1 行だけ。

- [ ] **Step 2: 名前を固定する test を書く(失敗する)**

`src/app/api/review/profile-names.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ReviewEntrySchema } from "@/stub/review/v1/service_pb";

const review = vi.hoisted(() => ({
  createEntry: vi.fn(),
  listEntriesByTarget: vi.fn(),
  listEntriesByAuthor: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ reviewClient: review }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const createRoute = await import("./route");
const byTargetRoute = await import("./by-target/route");
const byAuthorRoute = await import("./by-author/route");

function request(path: string, body?: unknown) {
  const req = new NextRequest(`http://localhost${path}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("review routes address the author and the target by profile id", () => {
  beforeEach(() => {
    const entry = create(ReviewEntrySchema, { id: "r-1", authorProfileId: "author-1", targetProfileId: "target-1", rating: 4.5 });
    review.createEntry.mockReset().mockResolvedValue({ entry });
    review.listEntriesByTarget.mockReset().mockResolvedValue({ entries: [entry], nextCursor: "", hasMore: false });
    review.listEntriesByAuthor.mockReset().mockResolvedValue({ entries: [entry], nextCursor: "", hasMore: false });
  });

  it("POST /api/review creates a review about targetProfileId and returns both profile ids", async () => {
    const res = await createRoute.POST(request("/api/review", { targetProfileId: "target-1", rating: 4.5, body: "great" }));

    expect(review.createEntry).toHaveBeenCalledWith({ targetProfileId: "target-1", rating: 4.5, body: "great" }, expect.anything());
    expect((await res.json()).entry).toMatchObject({ id: "r-1", authorProfileId: "author-1", targetProfileId: "target-1" });
  });

  it("POST /api/review rejects targetAccountId", async () => {
    const res = await createRoute.POST(request("/api/review", { targetAccountId: "target-1", rating: 4.5, body: "great" }));

    expect(res.status).toBe(400);
    expect(review.createEntry).not.toHaveBeenCalled();
  });

  it("GET /api/review/by-target reads the profile_id query and rejects account_id", async () => {
    const ok = await byTargetRoute.GET(request("/api/review/by-target?profile_id=target-1"));
    const rejected = await byTargetRoute.GET(request("/api/review/by-target?account_id=target-1"));

    expect(rejected.status).toBe(400);
    expect(review.listEntriesByTarget).toHaveBeenCalledTimes(1);
    expect(review.listEntriesByTarget.mock.calls[0][0]).toMatchObject({ targetProfileId: "target-1" });
    expect((await ok.json()).entries).toMatchObject([{ authorProfileId: "author-1", targetProfileId: "target-1" }]);
  });

  it("GET /api/review/by-author reads the profile_id query and rejects account_id", async () => {
    const ok = await byAuthorRoute.GET(request("/api/review/by-author?profile_id=author-1"));
    const rejected = await byAuthorRoute.GET(request("/api/review/by-author?account_id=author-1"));

    expect(rejected.status).toBe(400);
    expect(review.listEntriesByAuthor).toHaveBeenCalledTimes(1);
    expect(review.listEntriesByAuthor.mock.calls[0][0]).toMatchObject({ authorProfileId: "author-1" });
    expect((await ok.json()).entries).toMatchObject([{ authorProfileId: "author-1", targetProfileId: "target-1" }]);
  });
});
```

`src/modules/review/hooks/request-names.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), useSWRInfinite: vi.fn() }));

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock("swr/infinite", () => ({ default: mocks.useSWRInfinite }));
vi.mock("@/lib/swr", () => ({ fetcher: vi.fn() }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "viewer-1" }),
}));

const { useCreateReview } = await import("./useCreateReview");
const { useReviewsByTarget } = await import("./useReviewsByTarget");
const { useReviewsByAuthor } = await import("./useReviewsByAuthor");

function firstPageKey(hook: (profileId: string) => unknown, profileId: string) {
  mocks.useSWRInfinite.mockReset().mockReturnValue({ data: undefined, size: 1, setSize: vi.fn(), mutate: vi.fn() });
  hook(profileId);
  return mocks.useSWRInfinite.mock.calls[0][0](0, null);
}

describe("review hooks address the author and the target by profile id", () => {
  it("posts a review about the target profile as targetProfileId", async () => {
    mocks.authFetch.mockResolvedValue({ entry: { id: "r-1" } });

    await useCreateReview().create("target 1", 4.5, "great");

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/review", {
      method: "POST",
      body: { targetProfileId: "target 1", rating: 4.5, body: "great" },
    });
  });

  it("requests reviews by target and by author through the profile_id query", () => {
    expect(firstPageKey(useReviewsByTarget, "target 1")).toBe("/api/review/by-target?profile_id=target%201");
    expect(firstPageKey(useReviewsByAuthor, "author 1")).toBe("/api/review/by-author?profile_id=author%201");
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/review/profile-names.test.ts src/modules/review/hooks/request-names.test.ts > /tmp/vitest-p7-red.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p7-red.txt | /usr/bin/grep -E 'Test Files|Tests ' | tail -2`
Expected: `Test Files  2 failed (2)` と `Tests  6 failed (6)`(route と hook がまだ旧い名前を使うため)。

- [ ] **Step 3: 名前を置換する**

次の内容を `/tmp/p7-frontend.sh` に保存し、`dystopia/frontend` で `bash /tmp/p7-frontend.sh` を実行する。

```bash
set -euo pipefail

# 1. the review module, its BFF routes and pages, and the discovery hooks
FILES=$(find src/modules/review src/modules/discovery src/app/api/review src/app/reviews -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'profile-names.test.ts' ! -name 'request-names.test.ts')
perl -pi -e 's/authorAccountId/authorProfileId/g; s/targetAccountId/targetProfileId/g; s/\baccountId\b/profileId/g; s/\baccount_id\b/profile_id/g; s/\buserId\b/profileId/g' $FILES

# 2. the caller of the review tab on the profile page
perl -0pi -e 's/(<ReviewsTab\s+)accountId=/$1profileId=/g' "src/app/u/[username]/page.tsx"
```

Run: `/usr/bin/grep -rn -E 'AccountId|\baccountId\b|account_id|\buserId\b' src/modules/review src/modules/discovery src/app/api/review src/app/reviews | /usr/bin/grep -v 'profile-names.test.ts'`
Expected: 出力なし(`profile-names.test.ts` は、旧い名前を受け付けないことを確かめるために旧名を含む)。

型の付いていない mock や fixture は `tsc` で拾えない。レビューの旧い key が test や他の module に残っていないことを、`src` 全体で確かめる。

Run: `/usr/bin/grep -rn -E 'authorAccountId|targetAccountId|ReviewsTab[^/]*accountId' src --include='*.ts' --include='*.tsx' | /usr/bin/grep -v -E '^src/stub/|profile-names.test.ts|profile-queries.test.ts|src/modules/karte/lib/mappers.test.ts'`
Expected: 出力なし(`profile-queries.test.ts` は social が拒否する名前、karte の `mappers.test.ts` は view に含めない key として、それぞれ旧名を含む)。

- [ ] **Step 4: 全体を確認する**

Run: `rm -rf .next; env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p7.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p7.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、`Test Files  95 passed (95)`、`Tests  356 passed (356)`。

`rm -rf .next` を shell が拒否した場合は、`.next` が存在しないことを確かめてから残りを実行する。

Run: `git status --short . | wc -l; git status --short src/stub | wc -l`
Expected: `24` と `1`

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -s -m "refactor(dystopia/frontend): address review authors and targets by profile id"
```

---

## Controller verification (not dispatched)

Task 2 の後、controller が実サーバーを起動して確認する(使い捨ての database に migrate と seed、`bin/grpc` に `.env` と `.env.test` を export、`next dev`、ブラウザは `localhost` を幅 1280px で開き、初回のチュートリアルを閉じる。終了後に生成物と database を削除)。

- guest が cast にレビューを書け、cast のプロフィールページのレビュー欄と、guest の「書いたレビュー」に出る。guest には書けない。
- 作者だけが編集・削除でき、対象の cast だけが非表示・再表示にできる。
- cast がレビューの公開を切ると、他の profile にはその cast のレビューが見えなくなる。
- 検索(profile と投稿)、ランキング、おすすめ、フィード(すべて・フォロー中)が、操作中の profile の可視性で表示される。
- gRPC server のログに、意図しない ERROR が無い。

## Known gaps left for later plans

- review の entry と公開設定は、退会の purge の対象に入っていない(VERIFIED: `/usr/bin/grep -c -i 'review' slices/identity/use_cases/account/purge_deactivated_accounts.rb` が `0`)。段 8 で人格ごとの削除を作るときに扱いを決める。
- `slices/review/grpc/handler.rb` は、他の slice と違って gruf と `lib/grpc/authenticatable` を自分で require していない(`bin/grpc` が先に読み込むので本番では動く)。この段では spec の側で require した。
- discovery の handler の `role_for(account_id)` は、本物の account の id を受け取る。
- discovery の RPC と use case の名前(`SearchUsers` / `SuggestUsers`)は変えていない。
- `idx_review_entries_author_created` と `idx_review_entries_target_created` は、名前にカラム名を含まないので変えていない。
- この段の後、slice から `Grpc::Authenticatable#current_user_id` を呼ぶ箇所は無くなる(VERIFIED: `/usr/bin/grep -rn 'current_user_id' slices | wc -l` が `0`)。別名の定義(`lib/grpc/authenticatable.rb`)とその spec だけが残り、段 8 で削除する。
- frontend の hook の `const userId = useAuthStore((s) => s.activeProfileId)` は、この段で review と discovery の 8 箇所を改名した。残りは social 5・karte 4・profile 1 の 10 箇所で、段 9 で改名する。
- review と discovery の一覧の hook は、SWR の key に操作中の profile を含めていない(現状のまま)。段 9 で cache の消去と合わせて扱う。
- P1a・P1b・P2・P3・P4・P5・P6 の Known gaps はそのまま残る。
