# Multi Profile P6: Footprints, Bookmarks, Schedule and Media Actor Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** footprints・bookmarks・schedule・media の 4 slice が持つ「行為者の id」を表す名前を、カラム・proto・Ruby・BFF・frontend のすべてで profile に揃える。挙動は変えない。

**Architecture:** 値は段 1 から profile の id なので、変えるのは名前だけである。改名は決まった規則の置換(perl)で行う。この 4 slice には handler を通す spec が 1 つも無く、repository は生の SQL(`INSERT ... ON CONFLICT (カラム)`)でカラム名を文字列として持っている。名前がずれると実行時まで分からないので、handler を実 database で動かす spec を先に書き、改名の前後で赤 → 緑を確かめる。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL 18 / RSpec。frontend は Next.js 16 / TypeScript 7 / vitest 5 / buf。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(API contract の「その他の proto」、Schema changes の footprints・bookmarks・schedule・media の行、Delivery の段 6)

**Dry run:** この plan の手順は、使い捨ての database と作業ツリー上で通しで適用して確かめてある。plan に載せた script と file をゼロから再適用して、同じ差分(72 ファイル)になることも確かめた。最終結果は monolith `637 examples, 0 failures`、frontend `tsc` エラー 0・vitest `92` ファイル `350` 件通過。各 Step の Expected のうち数を示したものは、その再適用での実測である。migration は up → down → up を実行して確かめた。Review Focus に「テストで守る」と書いた項目は、該当箇所を壊すと赤になることを確かめてある。

この plan は stack の 6 段目で、ブランチ `feat/dystopia-multi-profile-footprints`(`feat/dystopia-multi-profile-messaging` の上)に積む。

## Naming

| 場所 | 旧 | 新 |
|---|---|---|
| `footprints.visits` | `visitor_id` / `visited_id` | `visitor_profile_id` / `visited_profile_id` |
| `footprints.read_states` / `bookmarks.bookmarks` / `schedule.schedules` | `account_id` | `profile_id` |
| `media.files` | `uploader_account_id` | `uploader_profile_id` |
| proto(footprints) | `RecordVisitRequest.visited_account_id` | `visited_profile_id` |
| proto(schedule) | `Schedule.account_id` / `ListSchedulesRequest.account_id` | `profile_id` |
| footprints の use case と repository の引数 | `visitor_id:` / `visited_id:` / `viewer_id:` / `account_id:` / `exclude_visitor_ids:` | `visitor_profile_id:` / `visited_profile_id:` / `viewer_profile_id:` / `profile_id:` / `exclude_visitor_profile_ids:` |
| `ListFootprints` が返す行の key | `:visitor_id` | `:visitor_profile_id` |
| bookmarks・schedule の use case と repository の引数 | `account_id:` | `profile_id:` |
| media の repository と use case の引数 | `uploader_account_id:` | `uploader_profile_id:` |
| repository のメソッド | `delete_visits_by_account` / `delete_read_state_by_account` / `delete_by_account`(bookmarks・schedule) | `delete_visits_by_profile` / `delete_read_state_by_profile` / `delete_by_profile` |
| handler | `current_user_id` | `current_profile_id` |
| frontend の view | `FootprintVisitorView.accountId` / `ScheduleView.accountId` | `profileId` |
| frontend の props・hook・BFF | `ScheduleSection` の `accountId` / `useSchedules(accountId, ...)` / query `accountId` / body `visitedAccountId` | `profileId` / `profileId` / `profileId` / `visitedProfileId` |
| frontend の hook の local | `userId`(footprints 2 箇所・bookmarks 1 箇所) | `profileId` |

proto の field 番号は変えない。bookmarks と media の proto には改名する field が無い。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-footprints`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0、`env -u NODE_OPTIONS pnpm exec vitest run` で失敗 0。開始時点の基準は rspec `629 examples, 0 failures`、vitest 89 ファイル 345 件通過、`tsc` エラー 0。
- 挙動を変えない。この plan が足すテスト以外の spec と test は、名前の置換だけで通る。期待値(件数・順序・status)を書き換えて通すことはしない。
- script は必ず `bash` で実行する。zsh は変数に入れたファイル一覧を単語に分割しないので、`zsh` で実行すると置換が 1 件も適用されない。
- 本物の account の id は変えない。footprints の handler は、訪問者の表示のために `account_id`(profile の行が持つ account の id)から role を引く(`role_for(account_id)`)。bookmarks・schedule・media には本物の account の id は現れない。
- 退会の purge の入口(4 slice の `UseCases::PurgeAccount#call(account_id:)`)は変えない。段 8 で作り替える。入口が呼ぶ repository のメソッド名は改名する。
- `Current.account_id` と `create_account_with_profile` の引数(fixture)は変えない。
- カラムを改名したら、名前にカラム名を含む index・unique 制約・NOT NULL 制約も改名する(全環境が PostgreSQL 18.6)。
- テスト用 database に seed や手動の行を入れない。
- shell は macOS である。grep は `/usr/bin/grep` を使い、パターンは引用符で囲む。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan の手順はコメントを追加しない。
- 名前は現在の状態を表す。test の名前に「former」「old」「new」のような変更履歴の語を使わない。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` と pull request の作成はしない(区切りの判断と push は controller が行う)。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない。

## Review Focus

改名で壊れやすく、既存のテストでは検知できない箇所。各行のテストは括弧内のタスクに入れてある。

1. repository の生の SQL が文字列として持つカラム名(`INSERT INTO footprints.visits (..., visitor_id, visited_id, ...)`、`ON CONFLICT (account_id)` など)。漏れると実行時に SQL が失敗する(Task 1 の handler の spec が、訪問の記録・既読・ブックマーク・スケジュールの保存を実 database で実行する)。
2. `ListFootprints` が返す行の key(`:visitor_profile_id`)を handler が読む箇所。key がずれると `nil` になり、handler はその行を黙って捨てるので、足跡の一覧が空になる(Task 1 の footprints の spec が一覧の訪問者を確かめる。handler の key を旧名に戻すと落ちることを確かめた)。
3. 訪問の向きと、訪問を記録するかどうかの設定を訪問者の側から読むこと(Task 1 の footprints の spec。handler で訪問者と訪問先を入れ替えた場合と、設定を訪問先から読んだ場合に落ちることを確かめた)。
4. 本物の account の id(`role_for(profile.account_id)`)が置換に巻き込まれない(Task 1 の footprints の spec が訪問者の `role` を確かめる。`role_for` に profile の id を渡すと落ちることを確かめた)。
5. schedule の handler は `m.account_id` / `r.account_id` のように `.` の直後でカラムと proto の field を読む。footprints 用の規則(`.` の直後を変えない)では漏れるので、schedule と bookmarks には `.` の直後も変える規則を使う。この規則は `Current.account_id` だけを除外する(Task 1 の schedule の spec が、他の profile のスケジュールを profile の id で取得する。Step 5 で `Current.account_id` が 3 行残ることを確かめる)。
6. profile で絞る条件が外れていないこと(Task 1 の spec が、他の profile のブックマーク・スケジュール・アップロードが消えないことを確かめる。条件を外すと落ちることを確かめた)。
7. frontend の型の付いていない名前: 訪問を記録する hook が送る body(`visitedProfileId`。失敗を握りつぶすので、名前がずれると足跡が記録されなくなるだけでエラーにならない)、スケジュールを取得する SWR の key の query(`profileId`)、BFF が読む名前(Task 2 の test 3 ファイル)。

---

### Task 1: Proto, schema and monolith

**Files:**
- Modify: `proto/dystopia/footprints/v1/footprints_service.proto`、`proto/dystopia/schedule/v1/schedule_service.proto`
- Generate: `dystopia/monolith/stubs/footprints/v1/footprints_service_pb.rb`、`dystopia/monolith/stubs/schedule/v1/schedule_service_pb.rb`
- Create: `dystopia/monolith/config/db/migrate/20261008050000_rename_footprint_bookmark_schedule_and_media_actor_columns_to_profile.rb`
- Create: `dystopia/monolith/spec/slices/footprints/grpc/footprints_handler_spec.rb`、`spec/slices/bookmarks/grpc/bookmark_handler_spec.rb`、`spec/slices/schedule/grpc/schedule_handler_spec.rb`
- Modify: `dystopia/monolith/slices/footprints/**`、`slices/bookmarks/**`、`slices/schedule/**`、`slices/media/**` と、それぞれの `spec/slices/<slice>/**`
- Modify(spec): `spec/slices/post/cross_slice_wiring_spec.rb`、`spec/slices/identity/use_cases/account/purge_wiring_spec.rb`、`spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`

**Interfaces:**
- Consumes: `Grpc::Authenticatable#current_profile_id`、`ProfileFixtures`、`Notifications::Slice["use_cases.get_preferences"].call(profile_id:)`
- Produces: Naming の表のとおり。他 slice の spec から呼ばれるものは次のとおり。
  - `Footprints::Slice["use_cases.record_visit"].call(visitor_profile_id:, visited_profile_id:)`
  - `Footprints::Slice["use_cases.list_footprints"].call(viewer_profile_id:, limit:, cursor:)`(行の key は `:visitor_profile_id`)
  - `Footprints::Slice["repositories.footprints_repository"].upsert_visit(visitor_profile_id:, visited_profile_id:)`
  - `Bookmarks::Slice["repositories.bookmark_repository"].bookmark(profile_id:, post_id:)`、`Bookmarks::Slice["use_cases.list_bookmarks"].call(profile_id:)`
  - `Schedule::Slice["repositories.schedule_repository"].upsert(profile_id:, work_date:, start_time:, end_time:)`

- [ ] **Step 1: handler の spec を書く(失敗する)**

`spec/slices/footprints/grpc/footprints_handler_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/footprints/grpc/footprints_handler"

RSpec.describe Footprints::Grpc::FootprintsHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "footprint_cast") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "footprint_other_cast") }
  let(:guest) { create_account_with_profile(username: "footprint_guest") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def visit(profile_id)
    rpc(:record_visit, Footprints::V1::RecordVisitRequest.new(visited_profile_id: profile_id))
  end

  def footprints
    rpc(:list_footprints, Footprints::V1::ListFootprintsRequest.new).footprints
  end

  def unread
    rpc(:get_unread_count, Footprints::V1::GetUnreadCountRequest.new).count
  end

  after { Current.clear }

  it "records a visit from the acting profile to the visited profile" do
    act_as(guest)
    visit(cast)
    visit(cast)

    expect(db[:footprints__visits].select_map([:visitor_profile_id, :visited_profile_id, :visit_count])).to eq([[guest, cast, 2]])
  end

  it "lists the acting profile's visitors with their role and clears the unread state" do
    act_as(guest)
    visit(cast)
    act_as(other_cast)
    visit(cast)

    act_as(cast)
    expect(footprints.map { |f| [f.visitor.id, f.visitor.role, f.is_unread, f.visit_count] }).to eq([[other_cast, 2, true, 1], [guest, 1, true, 1]])
    expect(unread).to eq(2)

    rpc(:mark_read, Footprints::V1::MarkReadRequest.new)

    expect(db[:footprints__read_states].select_map(:profile_id)).to eq([cast])
    expect(unread).to eq(0)
    expect(footprints.map(&:is_unread)).to eq([false, false])

    act_as(guest)
    expect(footprints).to be_empty
    expect(unread).to eq(0)
  end

  it "does not record a visit when the visitor turned visit recording off" do
    preferences = Notifications::Slice["use_cases.get_preferences"].call(profile_id: guest)
    Notifications::Slice["use_cases.update_preferences"].call(profile_id: guest, preferences: preferences.merge(footprints_record_my_visits: false))

    act_as(guest)
    visit(cast)
    act_as(other_cast)
    visit(cast)

    expect(db[:footprints__visits].select_map(:visitor_profile_id)).to eq([other_cast])
  end
end
```

`spec/slices/bookmarks/grpc/bookmark_handler_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/bookmarks/grpc/bookmark_handler"

RSpec.describe Bookmarks::Grpc::BookmarkHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }

  let(:author) { create_account_with_profile(role: 2, username: "bookmark_author") }
  let(:reader) { create_account_with_profile(username: "bookmark_reader") }
  let(:other_reader) { create_account_with_profile(username: "bookmark_other_reader") }
  let!(:first_post) { post_repo.create_post(author_profile_id: author, content: "first", visibility: "public") }
  let!(:second_post) { post_repo.create_post(author_profile_id: author, content: "second", visibility: "public") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def bookmarked_post_ids
    rpc(:list_bookmarks, Bookmarks::V1::ListBookmarksRequest.new).posts.map(&:id)
  end

  def bookmark_status
    rpc(:get_bookmark_status, Bookmarks::V1::GetBookmarkStatusRequest.new(post_ids: [first_post.id, second_post.id])).bookmarked.to_h
  end

  after { Current.clear }

  it "stores a bookmark under the acting profile and lists it only for that profile" do
    act_as(reader)
    rpc(:bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: first_post.id))

    expect(db[:bookmarks__bookmarks].select_map([:profile_id, :post_id])).to eq([[reader, first_post.id]])
    expect(bookmarked_post_ids).to eq([first_post.id])
    expect(bookmark_status).to eq(first_post.id => true, second_post.id => false)

    act_as(other_reader)
    expect(bookmarked_post_ids).to be_empty
    expect(bookmark_status).to eq(first_post.id => false, second_post.id => false)
  end

  it "removes only the acting profile's bookmark" do
    act_as(reader)
    rpc(:bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: first_post.id))
    act_as(other_reader)
    rpc(:bookmark, Bookmarks::V1::BookmarkRequest.new(post_id: first_post.id))

    rpc(:unbookmark, Bookmarks::V1::UnbookmarkRequest.new(post_id: first_post.id))

    expect(db[:bookmarks__bookmarks].select_map(:profile_id)).to eq([reader])
    expect(bookmarked_post_ids).to be_empty
  end
end
```

`spec/slices/schedule/grpc/schedule_handler_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/schedule/grpc/schedule_handler"

RSpec.describe Schedule::Grpc::ScheduleHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  let(:cast) { create_account_with_profile(role: 2, username: "schedule_cast") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "schedule_other_cast") }
  let(:guest) { create_account_with_profile(username: "schedule_guest") }

  def rpc(method, message)
    described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def save(work_date)
    rpc(:save_schedule, Schedule::V1::SaveScheduleRequest.new(work_date: work_date, start_time: "20:00", end_time: "02:00")).schedule
  end

  def schedules_of(profile_id)
    request = Schedule::V1::ListSchedulesRequest.new(profile_id: profile_id, from_date: "2026-10-01", to_date: "2026-10-31")
    rpc(:list_schedules, request).schedules.map { |s| [s.profile_id, s.work_date, s.start_time, s.end_time] }
  end

  after { Current.clear }

  it "saves a schedule under the acting profile and lists it by profile id for any viewer" do
    act_as(cast)
    saved = save("2026-10-20")

    expect(saved.profile_id).to eq(cast)
    expect(db[:schedule__schedules].select_map(:profile_id)).to eq([cast])

    act_as(guest)
    expect(schedules_of(cast)).to eq([[cast, "2026-10-20", "20:00", "02:00"]])
    expect(schedules_of(other_cast)).to be_empty
  end

  it "deletes only the acting profile's schedule for that date" do
    act_as(cast)
    save("2026-10-20")
    act_as(other_cast)
    save("2026-10-20")

    rpc(:delete_schedule, Schedule::V1::DeleteScheduleRequest.new(work_date: "2026-10-20"))

    expect(schedules_of(other_cast)).to be_empty
    expect(schedules_of(cast)).to eq([[cast, "2026-10-20", "20:00", "02:00"]])
  end
end
```

media は repository の spec に 1 件足す。次の内容を `/tmp/p6-media-spec.sh` に保存し、`dystopia/monolith` で `bash /tmp/p6-media-spec.sh` を実行する(`spec/slices/media/repositories/media_repository_spec.rb` の最後の `end` の前に `describe "#delete_by_uploader"` を足す)。

```bash
set -euo pipefail
perl -0pi -e 's/\nend\n\z/\n\n  describe "#delete_by_uploader" do\n    it "stores the uploading profile and deletes only the files that profile uploaded" do\n      uploader = SecureRandom.uuid_v7\n      mine = repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media\/image\/mine.jpg", uploader_profile_id: uploader)\n      theirs = repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media\/image\/theirs.jpg", uploader_profile_id: SecureRandom.uuid_v7)\n\n      expect(mine.uploader_profile_id).to eq(uploader)\n\n      repo.delete_by_uploader(uploader)\n\n      expect(repo.find_by_id(mine.id)).to be_nil\n      expect(repo.find_by_id(theirs.id)).not_to be_nil\n    end\n  end\nend\n/' spec/slices/media/repositories/media_repository_spec.rb
```

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/footprints/grpc spec/slices/bookmarks/grpc spec/slices/schedule/grpc spec/slices/media/repositories > /tmp/rspec-p6-red.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p6-red.txt`
Expected: `24 examples, 8 failures`(足した 8 件がすべて落ち、既存の件は通る)。

- [ ] **Step 2: proto を改名する**

次の内容を `/tmp/p6-proto.sh` に保存し、リポジトリの root(`.worktrees/feat-dystopia-multi-profile-model`)で `bash /tmp/p6-proto.sh` を実行する。

```bash
set -euo pipefail
perl -pi -e 's/visited_account_id/visited_profile_id/g' proto/dystopia/footprints/v1/footprints_service.proto
perl -pi -e 's/\baccount_id\b/profile_id/g' proto/dystopia/schedule/v1/schedule_service.proto
```

Run(root): `/usr/bin/grep -c 'account_id' proto/dystopia/footprints/v1/footprints_service.proto proto/dystopia/schedule/v1/schedule_service.proto`
Expected: どちらも `0`

- [ ] **Step 3: Ruby の stub を生成する**

`bin/codegen` は全 package の stub を作り直す。footprints と schedule の `*_service_pb.rb` 以外の差分を戻す(RPC の名前は変わらない。`*_services_pb.rb` に出る差分は generator がコメントを落とすだけのもので、戻す)。

Run(`dystopia/monolith`):
```bash
rbenv exec bundle exec bin/codegen
git diff --name-only --relative -- stubs | /usr/bin/grep -v -E '^stubs/(footprints/v1/footprints|schedule/v1/schedule)_service_pb.rb$' | xargs git checkout --
git status --short stubs
```
Expected: ` M stubs/footprints/v1/footprints_service_pb.rb` と ` M stubs/schedule/v1/schedule_service_pb.rb` の 2 行だけ。

- [ ] **Step 4: migration を書いて適用する**

`config/db/migrate/20261008050000_rename_footprint_bookmark_schedule_and_media_actor_columns_to_profile.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:footprints__visits) do
      rename_column :visitor_id, :visitor_profile_id
      rename_column :visited_id, :visited_profile_id
    end
    alter_table(:footprints__read_states) { rename_column :account_id, :profile_id }
    alter_table(:bookmarks__bookmarks) { rename_column :account_id, :profile_id }
    alter_table(:schedule__schedules) { rename_column :account_id, :profile_id }
    alter_table(:media__files) { rename_column :uploader_account_id, :uploader_profile_id }

    run "ALTER INDEX bookmarks.idx_bookmarks_account_created RENAME TO idx_bookmarks_profile_created"

    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visitor_id_not_null TO visits_visitor_profile_id_not_null"
    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visited_id_not_null TO visits_visited_profile_id_not_null"
    run "ALTER TABLE footprints.read_states RENAME CONSTRAINT read_states_account_id_not_null TO read_states_profile_id_not_null"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT uq_bookmarks_account_post TO uq_bookmarks_profile_post"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT bookmarks_account_id_not_null TO bookmarks_profile_id_not_null"
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT uq_schedule_schedules_account_date TO uq_schedule_schedules_profile_date"
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT schedules_account_id_not_null TO schedules_profile_id_not_null"
  end

  down do
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT schedules_profile_id_not_null TO schedules_account_id_not_null"
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT uq_schedule_schedules_profile_date TO uq_schedule_schedules_account_date"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT bookmarks_profile_id_not_null TO bookmarks_account_id_not_null"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT uq_bookmarks_profile_post TO uq_bookmarks_account_post"
    run "ALTER TABLE footprints.read_states RENAME CONSTRAINT read_states_profile_id_not_null TO read_states_account_id_not_null"
    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visited_profile_id_not_null TO visits_visited_id_not_null"
    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visitor_profile_id_not_null TO visits_visitor_id_not_null"

    run "ALTER INDEX bookmarks.idx_bookmarks_profile_created RENAME TO idx_bookmarks_account_created"

    alter_table(:media__files) { rename_column :uploader_profile_id, :uploader_account_id }
    alter_table(:schedule__schedules) { rename_column :profile_id, :account_id }
    alter_table(:bookmarks__bookmarks) { rename_column :profile_id, :account_id }
    alter_table(:footprints__read_states) { rename_column :profile_id, :account_id }
    alter_table(:footprints__visits) do
      rename_column :visited_profile_id, :visited_id
      rename_column :visitor_profile_id, :visitor_id
    end
  end
end
```

`media.files.uploader_account_id` は NULL を許すので NOT NULL 制約が無い。`idx_footprints_visits_visited_last`・`uq_footprints_visits_pair`・`idx_media_files_uploader`・`read_states_pkey` は、名前にカラム名を含まないので変えない。unique 制約を改名すると、同名の index も一緒に改名される。

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated` と出る。`config/db/structure.sql` の dump は git の管理外なので commit に含めない。

Run: `psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select string_agg(n, ' ' order by n) from (select conname n from pg_constraint where connamespace in ('footprints'::regnamespace,'bookmarks'::regnamespace,'schedule'::regnamespace,'media'::regnamespace) and conname ~ '(account|visitor_|visited_|profile)' union select indexname from pg_indexes where schemaname in ('footprints','bookmarks','schedule','media') and indexname ~ '(account|profile)') x"`
Expected: `bookmarks_profile_id_not_null idx_bookmarks_profile_created read_states_profile_id_not_null schedules_profile_id_not_null uq_bookmarks_profile_post uq_schedule_schedules_profile_date visits_last_visited_at_not_null visits_visited_profile_id_not_null visits_visitor_profile_id_not_null`(`visits_last_visited_at_not_null` は検索の正規表現に掛かるだけで、改名の対象ではない)

- [ ] **Step 5: Ruby の名前を置換する**

次の内容を `/tmp/p6-monolith.sh` に保存し、`dystopia/monolith` で `bash /tmp/p6-monolith.sh` を実行する。

```bash
set -euo pipefail

# 1. footprints and its specs (the purge entry point keeps its keyword; role_for takes a real account id)
FOOT=$(find slices/footprints spec/slices/footprints -name '*.rb')
perl -pi -e 's/current_user_id/current_profile_id/g; s/visited_account_id/visited_profile_id/g; s/excluded_visitor_ids_for/excluded_visitor_profile_ids_for/g; s/\bexclude_ids\b/excluded_visitor_profile_ids/g; s/visitor_ids\b/visitor_profile_ids/g; s/\bvisitor_id\b/visitor_profile_id/g; s/\bvisited_id\b/visited_profile_id/g; s/\bviewer_id\b/viewer_profile_id/g; s/delete_visits_by_account/delete_visits_by_profile/g; s/delete_read_state_by_account/delete_read_state_by_profile/g' $FOOT
perl -pi -e 's/(?<![.\w])account_id\b/profile_id/g unless /role_for\(account_id\)|identity_account_repo\.find_by_id\(account_id\)/' $(echo "$FOOT" | /usr/bin/grep -v 'purge_account')
perl -pi -e 's/\baid\b/visitor_profile_id/g' slices/footprints/grpc/footprints_handler.rb

# 2. bookmarks and schedule and their specs (no real account id appears in these slices)
OWNED=$(find slices/bookmarks slices/schedule spec/slices/bookmarks spec/slices/schedule -name '*.rb')
perl -pi -e 's/current_user_id/current_profile_id/g; s/delete_by_account/delete_by_profile/g' $OWNED
perl -pi -e 's/(?<!Current\.)\baccount_id\b/profile_id/g; s/other_account_id/other_profile_id/g' $(echo "$OWNED" | /usr/bin/grep -v 'purge_account')

# 3. media and its specs
MEDIA=$(find slices/media spec/slices/media -name '*.rb')
perl -pi -e 's/uploader_account_id/uploader_profile_id/g' $MEDIA
perl -pi -e 's/\baccount_id\b/profile_id/g' slices/media/repositories/media_repository.rb

# 4. specs of other slices that call these repositories and use cases
perl -pi -e 's/bookmark_repo\.bookmark\(account_id:/bookmark_repo.bookmark(profile_id:/; s/(Bookmarks::Slice\["use_cases\.list_bookmarks"\]\.call\()account_id:/$1profile_id:/' spec/slices/post/cross_slice_wiring_spec.rb
perl -pi -e 's/bookmark_repo\.bookmark\(account_id:/bookmark_repo.bookmark(profile_id:/; s/upsert_visit\(visitor_id: (\w+), visited_id:/upsert_visit(visitor_profile_id: $1, visited_profile_id:/; s/schedule_repo\.upsert\(account_id:/schedule_repo.upsert(profile_id:/; s/(db\[:(?:bookmarks__bookmarks|schedule__schedules|footprints__read_states)\]\.where\()account_id:/$1profile_id:/; s/where\(visitor_id: (\w+)\)\.or\(visited_id:/where(visitor_profile_id: $1).or(visited_profile_id:/; s/where\(visitor_id: (\w+), visited_id:/where(visitor_profile_id: $1, visited_profile_id:/' spec/slices/identity/use_cases/account/purge_wiring_spec.rb
perl -pi -e 's/record\.call\(visitor_id: (\w+), visited_id:/record.call(visitor_profile_id: $1, visited_profile_id:/; s/list\.call\(viewer_id:/list.call(viewer_profile_id:/g; s/row\[:visitor_id\]/row[:visitor_profile_id]/g' spec/slices/social/rpc_and_cross_slice_wiring_spec.rb
```

Run: `/usr/bin/grep -rn -E 'account_id|current_user_id|\b(visitor|visited|viewer)_id\b|by_account|\baid\b' slices/footprints slices/bookmarks slices/schedule slices/media spec/slices/footprints spec/slices/bookmarks spec/slices/schedule spec/slices/media --include='*.rb' | wc -l`
Expected: `19`。内訳は次のとおりで、これ以外が出たら置換漏れである。

- `slices/footprints/grpc/footprints_handler.rb` の 3 行: `role_for(profile.account_id)`、`def role_for(account_id)`、`identity_account_repo.find_by_id(account_id)`(本物の account の id)
- 4 slice の `use_cases/purge_account.rb` の計 9 行と、それぞれの `purge_account_spec.rb` の計 4 行(purge の入口)
- 足した handler の spec 3 ファイルの `Current.account_id` の計 3 行

Run: `/usr/bin/grep -rn 'Current\.account_id = ' spec/slices/footprints spec/slices/bookmarks spec/slices/schedule | wc -l`
Expected: `3`(置換が `Current.account_id` を書き換えていない)

他の slice に旧い名前の呼び出しが残っていないことを確かめる。

Run: `/usr/bin/grep -rn -E '\b(visitor|visited)_id\b|uploader_account_id|visited_account_id|bookmark\(account_id|schedule_repo\.[a-z]+\(account_id|(bookmarks__bookmarks|schedule__schedules|footprints__read_states)\]\.where\(account_id' slices spec lib config/db/seeds.rb --include='*.rb' | wc -l`
Expected: `0`

Run: `git status --short . | wc -l`
Expected: `49`

- [ ] **Step 6: 足した spec と全体が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/footprints/grpc spec/slices/bookmarks/grpc spec/slices/schedule/grpc spec/slices/media/repositories > /tmp/rspec-p6-green.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-p6-green.txt`
Expected: `24 examples, 0 failures`

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `637 examples, 0 failures`

失敗がある場合は、名前の置換漏れか置換し過ぎである。期待値を書き換えず、該当の名前だけを直す。直せない場合は BLOCKED として出力を報告する。

- [ ] **Step 7: migration の down を確かめる**

Run:
```bash
HANAMI_ENV=test rbenv exec bundle exec hanami db rollback
psql postgres://postgres:password@localhost:5432/monolith_test -Atc "select string_agg(table_schema||'.'||table_name||'('||cols||')', ' ' order by 1) from (select table_schema, table_name, string_agg(column_name, ',' order by ordinal_position) cols from information_schema.columns where table_schema in ('footprints','bookmarks','schedule','media') and column_name ~ '(account|visitor_|visited_|profile)' group by 1,2) y"
HANAMI_ENV=test rbenv exec bundle exec hanami db migrate
```
Expected: rollback は `rolled back to 20261008040000_rename_messaging_and_notification_actor_columns_to_profile` と出る。カラムは `bookmarks.bookmarks(account_id) footprints.read_states(account_id) footprints.visits(visitor_id,visited_id,last_visited_at) media.files(uploader_account_id) schedule.schedules(account_id)` に戻る。最後の migrate は `migrated` と出る。

- [ ] **Step 8: Commit**

```bash
cd ../.. && git add -A proto/dystopia/footprints proto/dystopia/schedule dystopia/monolith && git status --short && git commit -s -m "refactor(dystopia): name the footprint, bookmark, schedule and media actor columns, fields and arguments after the profile" && cd dystopia/monolith
```

`git status --short` の出力が `proto/dystopia/footprints`・`proto/dystopia/schedule`・`dystopia/monolith` の下だけであることを確認してから commit する。

---

### Task 2: Frontend

**Files:**
- Generate: `dystopia/frontend/src/stub/footprints/v1/footprints_service_pb.ts`、`src/stub/schedule/v1/schedule_service_pb.ts`
- Create: `dystopia/frontend/src/app/api/footprints/profile-names.test.ts`、`src/modules/footprints/hooks/useRecordVisit.test.ts`、`src/modules/schedule/hooks/useSchedules.test.ts`
- Modify: `dystopia/frontend/src/modules/footprints/**`、`src/modules/schedule/**`、`src/app/api/footprints/**`、`src/app/api/schedule/**`、`src/app/footprints/**`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`、`src/modules/bookmarks/hooks/useBookmarkList.ts`

**Interfaces:**
- Consumes: Task 1 の proto
- Produces:
  - `@/modules/footprints` の `FootprintVisitorView.profileId`、`@/modules/schedule` の `ScheduleView.profileId`
  - `ScheduleSection` の props は `profileId`、`useSchedules(profileId, fromDate, toDate)`
  - BFF: `POST /api/footprints/visit` の body は `{ visitedProfileId }`、`GET /api/schedule/list` の query は `profileId` / `fromDate` / `toDate`

- [ ] **Step 1: stub を生成する**

Run(`dystopia/frontend`):
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v -E '^src/stub/(footprints|schedule)/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
```
Expected: ` M src/stub/footprints/v1/footprints_service_pb.ts` と ` M src/stub/schedule/v1/schedule_service_pb.ts` の 2 行だけ。

- [ ] **Step 2: 名前を固定する test を書く(失敗する)**

`src/app/api/footprints/profile-names.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ScheduleSchema } from "@/stub/schedule/v1/schedule_service_pb";

const footprints = vi.hoisted(() => ({ recordVisit: vi.fn() }));
const schedule = vi.hoisted(() => ({ listSchedules: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ footprintsClient: footprints, scheduleClient: schedule }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const visitRoute = await import("./visit/route");
const scheduleListRoute = await import("../schedule/list/route");

function request(path: string, init?: { method: string; body: unknown }) {
  const req = new NextRequest(`http://localhost${path}`, init && { method: init.method, body: JSON.stringify(init.body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("footprints and schedule routes address the profile by profile id", () => {
  beforeEach(() => {
    footprints.recordVisit.mockReset().mockResolvedValue({});
    schedule.listSchedules.mockReset().mockResolvedValue({
      schedules: [create(ScheduleSchema, { profileId: "prof-1", workDate: "2026-10-20", startTime: "20:00", endTime: "02:00" })],
    });
  });

  it("POST /api/footprints/visit records the visit to visitedProfileId and ignores visitedAccountId", async () => {
    await visitRoute.POST(request("/api/footprints/visit", { method: "POST", body: { visitedProfileId: "prof-1" } }));
    await visitRoute.POST(request("/api/footprints/visit", { method: "POST", body: { visitedAccountId: "prof-2" } }));

    expect(footprints.recordVisit.mock.calls.map(([message]) => message)).toEqual([
      { visitedProfileId: "prof-1" },
      { visitedProfileId: "" },
    ]);
  });

  it("GET /api/schedule/list reads the profileId query and returns schedules keyed profileId", async () => {
    const res = await scheduleListRoute.GET(request("/api/schedule/list?profileId=prof-1&fromDate=2026-10-01&toDate=2026-10-31"));

    expect(schedule.listSchedules).toHaveBeenCalledWith(
      { profileId: "prof-1", fromDate: "2026-10-01", toDate: "2026-10-31" },
      expect.anything()
    );
    expect((await res.json()).schedules).toEqual([
      { profileId: "prof-1", workDate: "2026-10-20", startTime: "20:00", endTime: "02:00" },
    ]);
  });

  it("GET /api/schedule/list does not read the accountId query", async () => {
    await scheduleListRoute.GET(request("/api/schedule/list?accountId=prof-1&fromDate=2026-10-01&toDate=2026-10-31"));

    expect(schedule.listSchedules).toHaveBeenCalledWith(
      { profileId: "", fromDate: "2026-10-01", toDate: "2026-10-31" },
      expect.anything()
    );
  });
});
```

`src/modules/footprints/hooks/useRecordVisit.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("react", () => ({ useCallback: (callback: unknown) => callback }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));

const { useRecordVisit } = await import("./useRecordVisit");

describe("useRecordVisit", () => {
  it("posts the visited profile as visitedProfileId", async () => {
    mocks.authFetch.mockResolvedValue({});

    await useRecordVisit()("prof-1");

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/footprints/visit", {
      method: "POST",
      body: { visitedProfileId: "prof-1" },
    });
  });
});
```

`src/modules/schedule/hooks/useSchedules.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useSWR: vi.fn() }));

vi.mock("swr", () => ({ default: mocks.useSWR }));
vi.mock("@/lib/swr", () => ({ fetcher: vi.fn() }));

const { useSchedules } = await import("./useSchedules");

describe("useSchedules", () => {
  it("requests the schedules of a profile through the profileId query", () => {
    mocks.useSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: vi.fn() });

    useSchedules("prof 1", "2026-10-01", "2026-10-31");
    useSchedules(null, "2026-10-01", "2026-10-31");

    expect(mocks.useSWR.mock.calls.map(([key]) => key)).toEqual([
      "/api/schedule/list?profileId=prof%201&fromDate=2026-10-01&toDate=2026-10-31",
      null,
    ]);
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/footprints/profile-names.test.ts src/modules/footprints/hooks/useRecordVisit.test.ts src/modules/schedule/hooks/useSchedules.test.ts > /tmp/vitest-p6-red.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p6-red.txt | /usr/bin/grep -E 'Test Files|Tests ' | head -3`
Expected: `Test Files  3 failed (3)` と `Tests  5 failed (5)`(route と hook がまだ旧い名前を使うため)。

- [ ] **Step 3: 名前を置換する**

次の内容を `/tmp/p6-frontend.sh` に保存し、`dystopia/frontend` で `bash /tmp/p6-frontend.sh` を実行する。

```bash
set -euo pipefail

# 1. the footprints and schedule modules, their BFF routes and the footprints page
FILES=$(find src/modules/footprints src/modules/schedule src/app/api/footprints src/app/api/schedule src/app/footprints -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'profile-names.test.ts')
perl -pi -e 's/visitedAccountId/visitedProfileId/g; s/\baccountId\b/profileId/g' $FILES

# 2. the caller of the schedule component outside the module
perl -0pi -e 's/(<ScheduleSection\s+)accountId=/$1profileId=/g' "src/app/u/[username]/page.tsx"

# 3. hooks that gate on the acting profile
perl -pi -e 's/\buserId\b/profileId/g' src/modules/footprints/hooks/useFootprints.ts src/modules/footprints/hooks/useFootprintsUnreadCount.ts src/modules/bookmarks/hooks/useBookmarkList.ts
```

Run: `/usr/bin/grep -rn -E 'visitedAccountId|\baccountId\b|\buserId\b' src/modules/footprints src/modules/schedule src/modules/bookmarks src/app/api/footprints src/app/api/schedule src/app/footprints | /usr/bin/grep -v 'profile-names.test.ts'`
Expected: 出力なし(`profile-names.test.ts` は、旧い名前を読まないことを確かめるために旧名を含む)。

型の付いていない mock や fixture は `tsc` で拾えない。足跡とスケジュールの view の形をした object が旧い key のまま残っていないことを、`src` 全体で確かめる。

Run: `/usr/bin/grep -rn -E 'visitedAccountId|visitor.*accountId|accountId.*workDate|ScheduleSection[^/]*accountId' src --include='*.ts' --include='*.tsx' | /usr/bin/grep -v -E '^src/stub/|profile-names.test.ts'`
Expected: 出力なし。

- [ ] **Step 4: 全体を確認する**

Run: `rm -rf .next; env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p6.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-p6.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、`Test Files  92 passed (92)`、`Tests  350 passed (350)`。

`rm -rf .next` を shell が拒否した場合は、`.next` が存在しないことを確かめてから残りを実行する。

Run: `git status --short . | wc -l; git status --short src/stub | wc -l`
Expected: `21` と `2`

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -s -m "refactor(dystopia/frontend): address footprint visitors and schedule owners by profile id"
```

---

## Controller verification (not dispatched)

Task 2 の後、controller が実サーバーを起動して確認する(使い捨ての database に migrate と seed、`bin/grpc` に `.env` と `.env.test` を export、`next dev`、ブラウザは `localhost` を幅 1280px で開き、初回のチュートリアルを閉じる。終了後に生成物と database を削除)。

- プロフィールページを開くと足跡が記録され、訪問された側の足跡一覧に訪問者が出る。未読数が増え、一覧を開くと既読になる。訪問の記録を切った profile の訪問は記録されない。
- 投稿をブックマークすると、その profile のブックマーク一覧にだけ出る。解除すると消える。
- cast がスケジュールを保存すると、他の profile がそのプロフィールページで見られる。削除すると消える。
- 画像をアップロードして投稿できる(media の登録が改名後も動く)。
- gRPC server のログに、意図しない ERROR が無い。

## Known gaps left for later plans

- 4 slice の `UseCases::PurgeAccount#call(account_id:)` は、profile の id を `account_id` という引数名で受け取る。段 8 で改名する。
- footprints の handler の `role_for(account_id)` は、本物の account の id を受け取る。
- `Media::Grpc::Handler#register_media` はアップロードした profile を渡していないので、`media.files.uploader_profile_id` は常に `NULL` で、`delete_by_uploader` は 1 行も消さない(VERIFIED: `/usr/bin/grep -n 'uploader' slices/media/grpc/handler.rb` が 0 行)。この段は名前だけを変える。段 8 で人格ごとの削除を作るときに、アップロードした profile を記録するかどうかを決める。
- `ListSchedules` は、認証済みなら誰でも任意の profile のスケジュールを取得できる(現状のまま)。停止中の profile を隠す扱いは段 8 で決める。
- `idx_footprints_visits_visited_last`・`uq_footprints_visits_pair`・`idx_media_files_uploader` は、名前にカラム名を含まないので変えていない。
- `src/lib/media.ts` が読む auth store の `accountId` は本物の account の id で、変えていない。
- frontend の hook の `const userId = useAuthStore((s) => s.activeProfileId)` は、この段で footprints と bookmarks の 3 箇所を改名した。残りは 18 箇所で、review 4・discovery 4 は段 7、social 5・karte 4・profile 1 は段 9 で改名する。
- P1a・P1b・P2・P3・P4・P5 の Known gaps はそのまま残る。
