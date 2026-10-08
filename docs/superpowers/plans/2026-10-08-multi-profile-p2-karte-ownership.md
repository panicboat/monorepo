# Multi Profile P2: Karte Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** karte の記録を「所有は account、著者として表示するのは書いた profile」に分け、通報と利用権を account 単位に戻す。

**Architecture:** `karte.entries` が `author_account_id`(所有権)と `author_profile_id`(表示する著者)の両方を持ち、対象は `target_profile_id` で持つ。「自分の記録か」は server が account で判定して `is_mine` として返す。account の id はレスポンスに載せない。handler は account を主体とする判定(利用権・所有・通報)に `current_account_id` を、著者の記録に `current_profile_id` を渡す。

**Tech Stack:** Ruby 3.4 / Hanami 3 / Gruf / ROM-SQL + Sequel / PostgreSQL / RSpec。frontend は Next.js 16 / TypeScript 7 / vitest 5 / buf。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(Ownership boundary、API contract の `karte.v1.KarteEntry`、Schema changes、Delivery の段 2)

**Dry run:** この plan のコードは、使い捨ての database と作業ツリー上で一度通しで適用して確かめてある(monolith `592 examples, 0 failures`、frontend `tsc` エラー 0・vitest 85 ファイル 324 件通過)。各 Step の Expected はそのときの実測である。

この plan は stack の 2 段目で、ブランチ `feat/dystopia-multi-profile-karte`(`feat/dystopia-multi-profile-model` の上)に積む。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-karte`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- monolith のコマンドは `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec ...`、frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。
- 判定基準: monolith は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1` で失敗 0。frontend は `env -u NODE_OPTIONS pnpm exec tsc --noEmit` でエラー 0、`env -u NODE_OPTIONS pnpm exec vitest run` で失敗 0。開始時点の基準は rspec `569 examples, 0 failures`、vitest 84 ファイル 317 件通過、`tsc` エラー 0。
- テスト用 database に seed や手動の行を入れない。spec の truncation は slice の schema の行を消さない。
- shell は zsh で macOS である。grep に渡すパターンは引用符で囲む(`--include='*.rb'`)。その場編集の sed は `sed -i ''`。
- account の id を他人が取得しうるレスポンスに載せない。`karte.v1.KarteEntry` に account の id を持つフィールドを置かない。
- 通報は account 単位。1 つの account は、どの profile からでも同じ記録を 1 回しか通報できず、自分の account の記録(どの profile で書いたものでも)を通報できない。
- 記録の編集・削除と「自分の記録一覧」は account 単位。ある profile で書いた記録を、同じ account の別の profile から一覧・編集・削除できる。
- 記録に表示する著者は、書いた profile とする。著者の profile が存在しなくなっても記録は残り、著者の表示名とアバターは空になる。
- 記録の対象は guest の profile に限る。cast の profile、存在しない id、account の id を対象にした作成は拒否する。
- 既存行の整合は保たない。migration はデータを移行しない。
- frontend のテストは React を描画してよい(`// @vitest-environment happy-dom`、または `react-dom/server` の `renderToStaticMarkup`)。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。一時的な実装には `TODO:`、握りつぶすエラーには `SILENT:`、フォールバックには `FALLBACK:` を付ける。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。
- Task 1〜3 の各 commit の時点では、karte の RPC は実行時に失敗する(handler と use case と repository の引数名が揃うのは Task 4)。この間も `rspec` の全体は通る(double を使う spec は引数名の不一致を検知しない)。Task 4 の handler の spec が、揃ったことを実 database で確認する。
- この plan が挙げていない slice のカラム名・引数名は変えない。依存を追加しない。`pnpm install` / `bundle install` / seed を実行しない。

## Review Focus

spec が含意するが、素直に実装すると抜けやすい入力。各行のテストは括弧内のタスクに入れてある。

1. ある profile で書いた記録を、同じ account の別の profile から編集・削除でき、「自分の記録一覧」にも出る(Task 4)。
2. 1 つの account が 3 つの profile から同じ記録を通報しても 1 件としか数えない。別の profile からでも自分の account の記録は通報できない(Task 4)。
3. 作成・更新・対象別一覧・自分の一覧・新着一覧のどの応答にも、著者の account の id が入らない(Task 4)。
4. 著者の profile の行が無くなった記録が、一覧に残り、所有者には `is_mine` が真で返り、著者名が空になる(Task 4)。
5. 対象に guest の account の id を渡した作成が、profile として見つからず拒否される(Task 4)。

---

### Task 1: Proto contract and Ruby stub

**Files:**
- Modify: `proto/dystopia/karte/v1/service.proto`
- Generate: `dystopia/monolith/stubs/karte/v1/service_pb.rb`, `dystopia/monolith/stubs/karte/v1/service_services_pb.rb`

**Interfaces:**
- Consumes: なし
- Produces:
  - `Karte::V1::KarteEntry`: フィールド 2 が `author_profile_id`、フィールド 3 が `target_profile_id`、フィールド 13 が `is_mine`(bool)。`author_account_id` / `target_account_id` は無くなる
  - `Karte::V1::CreateEntryRequest#target_profile_id`、`Karte::V1::ListEntriesByTargetRequest#target_profile_id`

- [ ] **Step 1: proto を編集する**

`proto/dystopia/karte/v1/service.proto` の `message KarteEntry` を次に置き換える。

```proto
message KarteEntry {
  string id = 1;
  string author_profile_id = 2;
  string target_profile_id = 3;
  string author_username = 4;
  string author_avatar_url = 5;
  int32 rating = 6;
  string body = 7;
  bool flagged = 8;
  google.protobuf.Timestamp created_at = 9;
  google.protobuf.Timestamp updated_at = 10;
  string target_username = 11;
  string target_avatar_url = 12;
  bool is_mine = 13;
}
```

`CreateEntryRequest` と `ListEntriesByTargetRequest` の 1 番のフィールドを改名する。

```proto
message CreateEntryRequest {
  string target_profile_id = 1;
  int32 rating = 2;
  string body = 3;
}
```

```proto
message ListEntriesByTargetRequest {
  string target_profile_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
```

- [ ] **Step 2: Ruby の stub を生成する**

Run(`dystopia/monolith`): `rbenv exec bundle exec bin/codegen`
Expected: `✅ Done.`

`bin/codegen` は全 package の stub を作り直すので、karte 以外の差分を戻す。

Run:
```bash
git diff --name-only --relative -- stubs | /usr/bin/grep -v '^stubs/karte/' | xargs git checkout --
git status --short stubs
```
Expected: ` M stubs/karte/v1/service_pb.rb` の 1 行だけ(service の定義は変わらないので `service_services_pb.rb` に差分は出ない)。

- [ ] **Step 3: stub の内容を確認する**

Run:
```bash
rbenv exec bundle exec ruby -Istubs -e 'require "karte/v1/service_pb"; puts Karte::V1::KarteEntry.descriptor.map(&:name).inspect; puts Karte::V1::CreateEntryRequest.descriptor.map(&:name).first; puts Karte::V1::ListEntriesByTargetRequest.descriptor.map(&:name).first'
```
Expected:
```
["id", "author_profile_id", "target_profile_id", "author_username", "author_avatar_url", "rating", "body", "flagged", "created_at", "updated_at", "target_username", "target_avatar_url", "is_mine"]
target_profile_id
target_profile_id
```

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add proto/dystopia/karte/v1/service.proto dystopia/monolith/stubs/karte/v1 && git commit -s -m "feat(dystopia): carry the author profile and an ownership flag on karte entries" && cd dystopia/monolith
```

---

### Task 2: Schema, relation and entry repository

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261008010000_recreate_karte_entries_with_author_profile.rb`
- Modify: `dystopia/monolith/slices/karte/relations/entries.rb`
- Modify: `dystopia/monolith/slices/karte/repositories/entry_repository.rb`
- Test: `dystopia/monolith/spec/slices/karte/repositories/entry_repository_spec.rb`

**Interfaces:**
- Consumes: なし
- Produces(`Karte::Slice["repositories.entry_repository"]`):
  - `create(author_account_id:, author_profile_id:, target_profile_id:, rating:, body:) -> struct`
  - `list_by_target(target_profile_id:, limit: 20, cursor: nil) -> Array<struct>`
  - `list_by_author(author_account_id:, limit: 20, cursor: nil) -> Array<struct>`(account の全 profile の記録)
  - `aggregate(target_profile_id:) -> { count:, avg_rating: }`
  - `find_by_id` / `update` / `delete` / `list_recent` / `increment_reported_count` は変更なし
  - struct の属性: `id` / `author_account_id` / `author_profile_id` / `target_profile_id` / `rating` / `body` / `reported_count` / `created_at` / `updated_at`

- [ ] **Step 1: repository の spec を更新する(失敗する)**

`spec/slices/karte/repositories/entry_repository_spec.rb` の既存の呼び出しを、新しい引数名に合わせる(`repo.create` に `author_profile_id` を足し、`target_account_id:` を `target_profile_id:` にする)。

Run:
```bash
perl -pi -e 's/repo\.create\(author_account_id: ([^,]+), target_account_id:/repo.create(author_account_id: $1, author_profile_id: SecureRandom.uuid_v7, target_profile_id:/g; s/target_account_id:/target_profile_id:/g' spec/slices/karte/repositories/entry_repository_spec.rb
/usr/bin/grep -c 'target_account_id' spec/slices/karte/repositories/entry_repository_spec.rb
```
Expected: `0`

ファイル末尾の `end`(最上位の `RSpec.describe` を閉じるもの)の直前に、次の 2 つの describe を足す。

```ruby
  describe "#list_by_author" do
    it "returns the entries of every profile of the account and none of another account" do
      account_id = SecureRandom.uuid_v7
      first_profile = SecureRandom.uuid_v7
      second_profile = SecureRandom.uuid_v7
      by_first = repo.create(author_account_id: account_id, author_profile_id: first_profile, target_profile_id: target_id, rating: 3, body: nil)
      by_second = repo.create(author_account_id: account_id, author_profile_id: second_profile, target_profile_id: target_id, rating: 4, body: nil)
      repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 5, body: nil)

      rows = repo.list_by_author(author_account_id: account_id)

      expect(rows.map(&:id)).to contain_exactly(by_first.id, by_second.id)
      expect(rows.map(&:author_profile_id)).to contain_exactly(first_profile, second_profile)
    end

    it "does not find entries when given a profile id instead of the account id" do
      profile_id = SecureRandom.uuid_v7
      repo.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: profile_id, target_profile_id: target_id, rating: 3, body: nil)

      expect(repo.list_by_author(author_account_id: profile_id)).to eq([])
    end
  end

  describe "#list_by_target" do
    it "returns only the entries about the given profile" do
      about_target = repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target_id, rating: 3, body: nil)
      repo.create(author_account_id: author_id, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7, rating: 3, body: nil)

      expect(repo.list_by_target(target_profile_id: target_id).map(&:id)).to eq([about_target.id])
    end
  end
```

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/repositories > /tmp/rspec-t2.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t2.txt`
Expected: 失敗がある(`author_profile_id` を知らない、キーワードが違う)。

- [ ] **Step 2: migration を書く**

`config/db/migrate/20261008010000_recreate_karte_entries_with_author_profile.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"karte__reports", cascade: true
    drop_table :"karte__entries", cascade: true

    create_table :"karte__entries" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :author_profile_id, :uuid, null: false
      column :target_profile_id, :uuid, null: false
      column :rating, :integer, null: false
      column :body, :text
      column :reported_count, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
    end

    run <<~SQL
      CREATE INDEX idx_karte_entries_target_created
        ON karte.entries (target_profile_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_entries_author_created
        ON karte.entries (author_account_id, created_at DESC, id DESC)
    SQL

    create_table :"karte__reports" do
      column :id, :uuid, null: false
      column :entry_id, :uuid, null: false
      column :reporter_account_id, :uuid, null: false
      column :reason, :text
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:entry_id, :reporter_account_id], name: :uq_karte_reports_entry_reporter
    end
  end

  down do
    raise Sequel::Error, "irreversible: karte entries and reports are not restored"
  end
end
```

`karte.reports` も作り直すのは、列は変わらないが、これまでの行の `reporter_account_id` に profile の id が入っているためである。`karte.access` は変更しない。

Run: `HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: `=> database monolith_test migrated` と出る。続いて `config/db/structure.sql` を dump した旨が出るが、このファイルは git の管理外(`.gitignore`)なので commit に含めない。

- [ ] **Step 3: relation を更新する**

`slices/karte/relations/entries.rb` の `schema` ブロックを次に置き換える。

```ruby
      schema(:"karte__entries", as: :entry_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :author_profile_id, Types::String
        attribute :target_profile_id, Types::String
        attribute :rating, Types::Integer
        attribute :body, Types::String.optional
        attribute :reported_count, Types::Integer
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
```

- [ ] **Step 4: repository を更新する**

`slices/karte/repositories/entry_repository.rb` の `create`、`list_by_target`、`aggregate` を次に置き換える。`list_by_author` は引数名も中身も変えない(渡される値が account の id になる)。

```ruby
      def create(author_account_id:, author_profile_id:, target_profile_id:, rating:, body:)
        entry_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          body: body
        )
      end
```

```ruby
      def list_by_target(target_profile_id:, limit: 20, cursor: nil)
        scope = entry_records.where(target_profile_id: target_profile_id)
        scope = apply_cursor(scope, cursor)
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end
```

```ruby
      def aggregate(target_profile_id:)
        row = entry_records
          .where(target_profile_id: target_profile_id)
          # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
          .dataset
          .unordered
          .select { [count(id).as(:count), avg(rating).as(:avg)] }
          .first
        {
          count: row[:count].to_i,
          avg_rating: row[:avg].nil? ? 0.0 : row[:avg].to_f
        }
      end
```

- [ ] **Step 5: spec が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/repositories > /tmp/rspec-t2.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t2.txt`
Expected: `0 failures`

- [ ] **Step 6: Commit**

```bash
git add config/db/migrate/20261008010000_recreate_karte_entries_with_author_profile.rb slices/karte/relations/entries.rb slices/karte/repositories/entry_repository.rb spec/slices/karte/repositories && git commit -s -m "feat(dystopia/monolith): store the owning account and the author profile on karte entries"
```

---

### Task 3: Use cases

**Files:**
- Modify: `dystopia/monolith/slices/karte/use_cases/authorize_cast_access.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/create_entry.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/list_entries_by_target.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/list_my_entries.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/list_recent_entries.rb`
- Test: `dystopia/monolith/spec/slices/karte/use_cases/`(下記)

`update_entry.rb` / `delete_entry.rb` / `report_entry.rb` / `get_my_access.rb` / `purge_account.rb` のコードは変えない。これらは `viewer_account_id` を所有・通報・利用権の主体として使っており、Task 4 で handler が account の id を渡すようになると正しく動く。

**Interfaces:**
- Consumes: Task 2 の repository
- Produces(`Karte::Slice["use_cases.<name>"]`):
  - `authorize_cast_access.call(viewer_account_id:) -> Boolean`(account の role と利用権で判定)
  - `create_entry.call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, body:) -> struct`
  - `list_entries_by_target.call(viewer_account_id:, target_profile_id:, limit: 20, cursor: nil) -> { entries:, next_cursor:, has_more:, aggregate: }`
  - `list_my_entries.call(viewer_account_id:, limit: 20, cursor: nil)` / `list_recent_entries.call(viewer_account_id:, limit: 20, cursor: nil)` は引数変更なし
  - 3 つの一覧が返す各 entry の hash のキー: `id` / `author_profile_id` / `target_profile_id` / `is_mine` / `author_username` / `author_avatar_url` / `target_username` / `target_avatar_url` / `rating` / `body` / `flagged` / `created_at` / `updated_at`。`author_account_id` と `target_account_id` は含めない

- [ ] **Step 1: spec を更新する(失敗する)**

`spec/slices/karte/use_cases/authorize_cast_access_spec.rb` を次の内容に置き換える。

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AuthorizeCastAccess do
  let(:use_case) { described_class.new(account_repo: account_repo, get_my_access: get_my_access_uc) }
  let(:account_repo)     { double(:account_repository) }
  let(:get_my_access_uc) { double(:get_my_access) }

  let(:viewer_account_id) { "account-1" }

  it "returns true for a cast account with karte access" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(true)
  end

  it "returns false for a guest account" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 1))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(false)
  end

  it "returns false when the account cannot be found" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(nil)
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: true)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(false)
  end

  it "returns false for a cast account without karte access" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 2))
    allow(get_my_access_uc).to receive(:call).with(viewer_account_id: viewer_account_id).and_return(has_access: false)

    expect(use_case.call(viewer_account_id: viewer_account_id)).to be(false)
  end

  it "does not ask for access when the role check already fails" do
    allow(account_repo).to receive(:find_by_id).with(viewer_account_id).and_return(double(:account, role: 1))
    expect(get_my_access_uc).not_to receive(:call)

    use_case.call(viewer_account_id: viewer_account_id)
  end
end
```

`spec/slices/karte/use_cases/create_entry_spec.rb` を新しい引数に合わせる。`viewer_profile_id` の `let` を足し、`use_case.call` に `viewer_profile_id:` と `target_profile_id:` を渡し、`entry_repo.create` の期待値に `author_profile_id:` と `target_profile_id:` を入れる。

Run:
```bash
perl -pi -e 's/viewer_account_id: viewer_id, target_account_id: target_id,/viewer_account_id: viewer_id, viewer_profile_id: viewer_profile_id, target_profile_id: target_id,/; s/^(\s+)target_account_id: target_id,$/$1author_profile_id: viewer_profile_id,\n$1target_profile_id: target_id,/; s/^(\s*)let\(:viewer_id\) \{ "viewer-cast-1" \}$/$&\n$1let(:viewer_profile_id) { "viewer-profile-1" }/' spec/slices/karte/use_cases/create_entry_spec.rb
/usr/bin/grep -c 'target_account_id' spec/slices/karte/use_cases/create_entry_spec.rb
```
Expected: `0`

3 つの一覧の spec(`list_entries_by_target_spec.rb`、`list_my_entries_spec.rb`、`list_recent_entries_spec.rb`)の既存の example を、著者を profile で引く形に合わせる。entry の double に `author_profile_id` を足し(`author_account_id: "author-1"` の著者は `"author-1-profile"`、`author_account_id: viewer_id` の著者は `"viewer-profile-1"`)、`target_account_id:` を `target_profile_id:` にし、著者を引く `get_profile` の stub と期待値を profile の id に変える。

Run:
```bash
perl -pi -e 's/author_account_id: "(author-\d+)",/author_account_id: "$1", author_profile_id: "$1-profile",/g; s/^(\s+)author_account_id: viewer_id,$/$1author_account_id: viewer_id,\n$1author_profile_id: "viewer-profile-1",/; s/target_account_id:/target_profile_id:/g; s/with\(profile_id: "(author-\d+)"\)/with(profile_id: "$1-profile")/g; s/with\(profile_id: viewer_id\)/with(profile_id: "viewer-profile-1")/g; s/\[:author_account_id\]\)\.to eq\(viewer_id\)/[:author_profile_id]).to eq("viewer-profile-1")/' spec/slices/karte/use_cases/list_entries_by_target_spec.rb spec/slices/karte/use_cases/list_my_entries_spec.rb spec/slices/karte/use_cases/list_recent_entries_spec.rb
/usr/bin/grep -c 'target_account_id' spec/slices/karte/use_cases/list_entries_by_target_spec.rb spec/slices/karte/use_cases/list_my_entries_spec.rb spec/slices/karte/use_cases/list_recent_entries_spec.rb
```
Expected: 3 ファイルとも `:0`

`list_my_entries_spec.rb` の `.with(author_account_id: viewer_id, limit: ..., cursor: nil)`(`list_by_author` の stub)は変わらない。この引数は account の id のままである。

そのうえで、3 つの spec それぞれの、ファイル末尾の `end` の直前に 2 つの example を足す。stub する repository のメソッドと `use_case.call` の引数が spec ごとに違うので、それぞれの全文を示す。

`spec/slices/karte/use_cases/list_entries_by_target_spec.rb`:

```ruby
  it "marks an entry as mine by the owning account, whichever profile wrote it" do
    mine = double(:entry, id: "e-mine", author_account_id: viewer_id, author_profile_id: "other-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    theirs = double(:entry, id: "e-theirs", author_account_id: "someone-else", author_profile_id: "their-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_by_target).and_return([mine, theirs])
    allow(entry_repo).to receive(:aggregate).and_return(count: 0, avg_rating: 0.0)
    allow(get_profile_uc).to receive(:call).and_return(nil)

    entries = use_case.call(viewer_account_id: viewer_id, target_profile_id: "target-x")[:entries]

    expect(entries.map { |e| e[:is_mine] }).to eq([true, false])
    expect(entries.map { |e| e[:author_profile_id] }).to eq(["other-persona", "their-persona"])
  end

  it "never includes the author's account id in a presented entry" do
    entry = double(:entry, id: "e-1", author_account_id: "secret-account", author_profile_id: "persona-1",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_by_target).and_return([entry])
    allow(entry_repo).to receive(:aggregate).and_return(count: 0, avg_rating: 0.0)
    allow(get_profile_uc).to receive(:call).and_return(nil)

    presented = use_case.call(viewer_account_id: viewer_id, target_profile_id: "target-x")[:entries].first

    expect(presented).not_to have_key(:author_account_id)
    expect(presented.values).not_to include("secret-account")
  end
```

`spec/slices/karte/use_cases/list_my_entries_spec.rb`:

```ruby
  it "marks an entry as mine by the owning account, whichever profile wrote it" do
    mine = double(:entry, id: "e-mine", author_account_id: viewer_id, author_profile_id: "other-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    theirs = double(:entry, id: "e-theirs", author_account_id: "someone-else", author_profile_id: "their-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_by_author).and_return([mine, theirs])
    allow(get_profile_uc).to receive(:call).and_return(nil)

    entries = use_case.call(viewer_account_id: viewer_id)[:entries]

    expect(entries.map { |e| e[:is_mine] }).to eq([true, false])
    expect(entries.map { |e| e[:author_profile_id] }).to eq(["other-persona", "their-persona"])
  end

  it "never includes the author's account id in a presented entry" do
    entry = double(:entry, id: "e-1", author_account_id: "secret-account", author_profile_id: "persona-1",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_by_author).and_return([entry])
    allow(get_profile_uc).to receive(:call).and_return(nil)

    presented = use_case.call(viewer_account_id: viewer_id)[:entries].first

    expect(presented).not_to have_key(:author_account_id)
    expect(presented.values).not_to include("secret-account")
  end
```

`spec/slices/karte/use_cases/list_recent_entries_spec.rb`:

```ruby
  it "marks an entry as mine by the owning account, whichever profile wrote it" do
    mine = double(:entry, id: "e-mine", author_account_id: viewer_id, author_profile_id: "other-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    theirs = double(:entry, id: "e-theirs", author_account_id: "someone-else", author_profile_id: "their-persona",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_recent).and_return([mine, theirs])
    allow(get_profile_uc).to receive(:call).and_return(nil)

    entries = use_case.call(viewer_account_id: viewer_id)[:entries]

    expect(entries.map { |e| e[:is_mine] }).to eq([true, false])
    expect(entries.map { |e| e[:author_profile_id] }).to eq(["other-persona", "their-persona"])
  end

  it "never includes the author's account id in a presented entry" do
    entry = double(:entry, id: "e-1", author_account_id: "secret-account", author_profile_id: "persona-1",
      target_profile_id: "target-x", rating: 3, body: nil, reported_count: 0, created_at: now, updated_at: now)
    allow(entry_repo).to receive(:list_recent).and_return([entry])
    allow(get_profile_uc).to receive(:call).and_return(nil)

    presented = use_case.call(viewer_account_id: viewer_id)[:entries].first

    expect(presented).not_to have_key(:author_account_id)
    expect(presented.values).not_to include("secret-account")
  end
```

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/use_cases > /tmp/rspec-t3.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t3.txt`
Expected: 失敗がある。

- [ ] **Step 2: `AuthorizeCastAccess` を account で判定する**

`slices/karte/use_cases/authorize_cast_access.rb` のクラス本体を次に置き換える。

```ruby
    class AuthorizeCastAccess
      ROLE_CAST = 2

      def initialize(account_repo: nil, get_my_access: nil)
        @account_repo = account_repo
        @get_my_access = get_my_access
      end

      def call(viewer_account_id:)
        return false unless account_repo.find_by_id(viewer_account_id)&.role == ROLE_CAST

        get_my_access.call(viewer_account_id: viewer_account_id)[:has_access]
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def get_my_access
        @get_my_access ||= Karte::Slice["use_cases.get_my_access"]
      end
    end
```

- [ ] **Step 3: `CreateEntry` が所有者と著者を別々に記録する**

`slices/karte/use_cases/create_entry.rb` の `call` を次に置き換える。`initialize` と private は変えない。

```ruby
      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, body:)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        raise CreateError, "Rating must be 1..5" unless (1..5).cover?(rating)
        raise CreateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        target_role = get_role.call(profile_id: target_profile_id)
        raise CreateError, "Target not found" unless target_role
        raise CreateError, "Target must be a guest" unless target_role == 1

        entry_repo.create(
          author_account_id: viewer_account_id,
          author_profile_id: viewer_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          body: body
        )
      end
```

- [ ] **Step 4: 3 つの一覧の表示用 hash を更新する**

`list_entries_by_target.rb`、`list_my_entries.rb`、`list_recent_entries.rb` のそれぞれで、次の 2 点を変える。

`call` の中の `visible.map { |e| present_with_author(e, profile_cache) }` を次に変える。

```ruby
        entries = visible.map { |e| present_with_author(e, profile_cache, viewer_account_id) }
```

`present_with_author` を次に置き換える(`flagged` の定数の書き方は各ファイルの現状を保つ: `list_entries_by_target.rb` は `MIN_FLAG_REPORTS`、他の 2 つは `ListEntriesByTarget::MIN_FLAG_REPORTS`)。

```ruby
      def present_with_author(e, profile_cache, viewer_account_id)
        profile = profile_cache[e.author_profile_id] ||= get_profile.call(profile_id: e.author_profile_id)
        target_profile = profile_cache[e.target_profile_id] ||= get_profile.call(profile_id: e.target_profile_id)
        {
          id: e.id,
          author_profile_id: e.author_profile_id,
          target_profile_id: e.target_profile_id,
          is_mine: e.author_account_id == viewer_account_id,
          author_username: profile&.username,
          author_avatar_url: avatar_url_for(profile),
          target_username: target_profile&.username,
          target_avatar_url: avatar_url_for(target_profile),
          rating: e.rating,
          body: e.body,
          flagged: e.reported_count >= ListEntriesByTarget::MIN_FLAG_REPORTS,
          created_at: e.created_at,
          updated_at: e.updated_at
        }
      end
```

`list_entries_by_target.rb` はさらに、`call` の引数と repository の呼び出しを改名する。

```ruby
      def call(viewer_account_id:, target_profile_id:, limit: 20, cursor: nil)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)

        result = entry_repo.list_by_target(target_profile_id: target_profile_id, limit: limit, cursor: cursor)
```

```ruby
        aggregate = entry_repo.aggregate(target_profile_id: target_profile_id)
```

- [ ] **Step 5: spec が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte > /tmp/rspec-t3.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t3.txt`
Expected: `0 failures`

Run: `/usr/bin/grep -rn -E 'target_account_id|get_role' slices/karte/use_cases`
Expected: `create_entry.rb` の `get_role` に関する行だけ(`@get_role`、`get_role.call`、`def get_role`、`Profile::Slice["use_cases.get_role"]`)。`target_account_id` は出ない。

- [ ] **Step 6: Commit**

```bash
git add slices/karte/use_cases spec/slices/karte/use_cases && git commit -s -m "feat(dystopia/monolith): decide karte ownership by account and show the writing profile"
```

---

### Task 4: Handler, handler spec, and purge wiring

**Files:**
- Modify: `dystopia/monolith/slices/karte/grpc/karte_handler.rb`
- Create: `dystopia/monolith/spec/slices/karte/grpc/karte_handler_spec.rb`
- Modify: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb`

**Interfaces:**
- Consumes: Task 1 の stub、Task 3 の use case、`Grpc::Authenticatable#current_account_id` / `#current_profile_id`、`ProfileFixtures`(`create_account(role:)` は account の id、`create_account_with_profile(role:, account_id:, **attrs)` は profile の id を返す)
- Produces: gRPC の karte の全 RPC が、account を主体とする判定に account の id を、著者の記録に profile の id を使う。`KarteEntry` は `author_profile_id` / `target_profile_id` / `is_mine` を返す

- [ ] **Step 1: handler の spec を書く(失敗する)**

`spec/slices/karte/grpc/karte_handler_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/karte/grpc/karte_handler"

RSpec.describe Karte::Grpc::KarteHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:access_repo) { Karte::Slice["repositories.access_repository"] }

  let(:cast_account) { create_account(role: 2) }
  let(:persona_a) { create_account_with_profile(account_id: cast_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: cast_account, username: "persona_b") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:other_persona) { create_account_with_profile(account_id: other_cast_account, username: "other_cast") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }

  def handler_for(message)
    described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def act_as(account_id, profile_id)
    Current.account_id = account_id
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def create_entry(target: guest, rating: 4, body: "memo")
    handler_for(::Karte::V1::CreateEntryRequest.new(target_profile_id: target, rating: rating, body: body)).create_entry.entry
  end

  def list_my
    handler_for(::Karte::V1::ListMyEntriesRequest.new).list_my_entries.entries
  end

  def list_by_target(target = guest)
    handler_for(::Karte::V1::ListEntriesByTargetRequest.new(target_profile_id: target)).list_entries_by_target
  end

  def list_recent
    handler_for(::Karte::V1::ListRecentEntriesRequest.new).list_recent_entries.entries
  end

  after { Current.clear }

  describe "#create_entry" do
    it "records the acting profile as the author and the account as the owner" do
      act_as(cast_account, persona_a)

      entry = create_entry

      expect(entry.author_profile_id).to eq(persona_a)
      expect(entry.target_profile_id).to eq(guest)
      expect(entry.author_username).to eq("persona_a")
      expect(entry.target_username).to eq("guest_one")
      expect(entry.is_mine).to be true
      row = db[:karte__entries].where(id: entry.id).first
      expect(row[:author_account_id]).to eq(cast_account)
      expect(row[:author_profile_id]).to eq(persona_a)
    end

    it "rejects a cast profile as the target" do
      act_as(cast_account, persona_a)

      expect { create_entry(target: other_persona) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects a guest's account id as the target" do
      guest
      act_as(cast_account, persona_a)

      expect { create_entry(target: guest_account) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects a guest account" do
      act_as(guest_account, guest)
      another_guest = create_account_with_profile(role: 1)

      expect { create_entry(target: another_guest) }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end
  end

  describe "ownership across profiles of one account" do
    it "lists an entry written as another profile among my entries" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(cast_account, persona_b)
      mine = list_my

      expect(mine.map(&:id)).to eq([entry.id])
      expect(mine.first.is_mine).to be true
      expect(mine.first.author_profile_id).to eq(persona_a)
    end

    it "lets another profile of the account update and delete the entry" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(cast_account, persona_b)
      updated = handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: entry.id, rating: 2, body: "edited")).update_entry.entry
      expect(updated.rating).to eq(2)
      expect(updated.author_profile_id).to eq(persona_a)
      expect(updated.is_mine).to be true

      handler_for(::Karte::V1::DeleteEntryRequest.new(entry_id: entry.id)).delete_entry
      expect(db[:karte__entries].where(id: entry.id).count).to eq(0)
    end

    it "does not let another account update or delete the entry" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(other_cast_account, other_persona)

      expect {
        handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: entry.id, rating: 1)).update_entry
      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect {
        handler_for(::Karte::V1::DeleteEntryRequest.new(entry_id: entry.id)).delete_entry
      }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(db[:karte__entries].where(id: entry.id).count).to eq(1)
    end

    it "shows the entry to another cast as not theirs, attributed to the writing profile" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(other_cast_account, other_persona)
      seen = list_by_target.entries.first

      expect(seen.id).to eq(entry.id)
      expect(seen.is_mine).to be false
      expect(seen.author_profile_id).to eq(persona_a)
      expect(seen.author_username).to eq("persona_a")
    end
  end

  describe "the author's account id" do
    it "appears in no response" do
      act_as(cast_account, persona_a)
      created = create_entry
      updated = handler_for(::Karte::V1::UpdateEntryRequest.new(entry_id: created.id, rating: 3)).update_entry.entry
      mine = list_my

      act_as(other_cast_account, other_persona)
      by_target = list_by_target
      recent = list_recent

      [created, updated, *mine, *by_target.entries, *recent].each do |entry|
        expect(entry.to_h.values).not_to include(cast_account)
      end
      expect(::Karte::V1::KarteEntry.descriptor.map(&:name)).not_to include("author_account_id", "target_account_id")
    end
  end

  describe "an entry whose author profile no longer exists" do
    it "stays listed, is still mine for the owner, and has an empty author name" do
      act_as(cast_account, persona_a)
      entry = create_entry
      persona_b
      db[:profile__profiles].where(id: persona_a).delete

      act_as(cast_account, persona_b)
      mine = list_my.first
      expect(mine.id).to eq(entry.id)
      expect(mine.is_mine).to be true
      expect(mine.author_username).to eq("")

      act_as(other_cast_account, other_persona)
      seen = list_by_target.entries.first
      expect(seen.id).to eq(entry.id)
      expect(seen.is_mine).to be false
      expect(seen.author_username).to eq("")
    end
  end

  describe "#report_entry" do
    def report(entry_id)
      handler_for(::Karte::V1::ReportEntryRequest.new(entry_id: entry_id, reason: "spam")).report_entry
    end

    it "rejects a report on the account's own entry from another profile" do
      act_as(cast_account, persona_a)
      entry = create_entry

      act_as(cast_account, persona_b)

      expect { report(entry.id) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect(db[:karte__entries].where(id: entry.id).get(:reported_count)).to eq(0)
    end

    it "counts one report per account, however many profiles report" do
      act_as(cast_account, persona_a)
      entry = create_entry
      second_persona = create_account_with_profile(account_id: other_cast_account)
      third_persona = create_account_with_profile(account_id: other_cast_account)

      [other_persona, second_persona, third_persona].each do |persona|
        act_as(other_cast_account, persona)
        report(entry.id)
      end

      expect(db[:karte__entries].where(id: entry.id).get(:reported_count)).to eq(1)
      expect(db[:karte__reports].where(entry_id: entry.id).select_map(:reporter_account_id)).to eq([other_cast_account])
    end

    it "counts reports from different accounts separately" do
      act_as(cast_account, persona_a)
      entry = create_entry
      third_account = create_account(role: 2)
      third_account_persona = create_account_with_profile(account_id: third_account)

      act_as(other_cast_account, other_persona)
      report(entry.id)
      act_as(third_account, third_account_persona)
      report(entry.id)

      expect(db[:karte__entries].where(id: entry.id).get(:reported_count)).to eq(2)
    end
  end

  describe "#get_my_access" do
    it "reads the grant of the account from any of its profiles" do
      access_repo.grant(account_id: cast_account)

      [persona_a, persona_b].each do |persona|
        act_as(cast_account, persona)
        response = handler_for(::Karte::V1::GetMyAccessRequest.new).get_my_access
        expect(response.has_access).to be true
        expect(response.granted_at).not_to be_nil
      end
    end
  end
end
```

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/grpc > /tmp/rspec-t4.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t4.txt`
Expected: 失敗がある(handler が旧フィールド名を読む、profile の id を account として渡す)。

- [ ] **Step 2: handler を更新する**

`slices/karte/grpc/karte_handler.rb` で、次を変える。

`viewer_account_id: current_user_id` は 8 箇所ある。すべて `viewer_account_id: current_account_id` に変える。

`create_entry` の use case 呼び出しを次に置き換える。

```ruby
          create_uc.call(
            viewer_account_id: current_account_id,
            viewer_profile_id: current_profile_id,
            target_profile_id: request.message.target_profile_id,
            rating: request.message.rating,
            body: body
          )
```

`list_entries_by_target` の use case 呼び出しで、`target_account_id: request.message.target_account_id,` を次に変える。

```ruby
            target_profile_id: request.message.target_profile_id,
```

`present_for_author` と `entry_to_proto` を次に置き換える。

```ruby
      def present_for_author(entry)
        profile = ::Profile::Slice["use_cases.get_profile"].call(profile_id: entry.author_profile_id)
        target_profile = ::Profile::Slice["use_cases.get_profile"].call(profile_id: entry.target_profile_id)
        media = ::Karte::Adapters::MediaAdapter.new
        {
          id: entry.id,
          author_profile_id: entry.author_profile_id,
          target_profile_id: entry.target_profile_id,
          is_mine: entry.author_account_id == current_account_id,
          author_username: profile&.username,
          author_avatar_url: media.find_url(profile&.avatar_media_id),
          target_username: target_profile&.username,
          target_avatar_url: media.find_url(target_profile&.avatar_media_id),
          rating: entry.rating,
          body: entry.body,
          flagged: entry.reported_count >= Karte::UseCases::ListEntriesByTarget::MIN_FLAG_REPORTS,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        }
      end

      def entry_to_proto(e)
        ::Karte::V1::KarteEntry.new(
          id: e[:id].to_s,
          author_profile_id: e[:author_profile_id].to_s,
          target_profile_id: e[:target_profile_id].to_s,
          is_mine: e[:is_mine] ? true : false,
          author_username: e[:author_username] || "",
          author_avatar_url: e[:author_avatar_url] || "",
          target_username: e[:target_username] || "",
          target_avatar_url: e[:target_avatar_url] || "",
          rating: e[:rating],
          body: e[:body] || "",
          flagged: e[:flagged],
          created_at: timestamp(e[:created_at]),
          updated_at: timestamp(e[:updated_at])
        )
      end
```

Run: `/usr/bin/grep -n 'current_user_id\|account_id' slices/karte/grpc/karte_handler.rb`
Expected: `current_account_id` を含む行だけ(`viewer_account_id: current_account_id` の 8 行と、`present_for_author` の `entry.author_account_id == current_account_id` の 1 行)。`current_user_id`、`target_account_id`、`author_account_id:` は出ない。

- [ ] **Step 3: handler の spec が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte > /tmp/rspec-t4.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t4.txt`
Expected: `0 failures`

- [ ] **Step 4: purge の結線の spec を新しい列と通報に合わせる**

`spec/slices/identity/use_cases/account/purge_wiring_spec.rb` は、退会の purge を実配線で流す spec である。karte については利用権(`karte__access`)だけを確認している。通報が account で消えることも確認する。

fixture を作っている箇所の `access_repo.grant(account_id: bystander_account_id)` の行の直後に、次を足す。`account_id`、`bystander_account_id`、`persona_a`、`bystander` は、その example の既存の変数である。

```ruby
    entry_repo = Karte::Slice["repositories.entry_repository"]
    report_repo = Karte::Slice["repositories.report_repository"]
    reported_entry = entry_repo.create(
      author_account_id: bystander_account_id, author_profile_id: bystander,
      target_profile_id: SecureRandom.uuid_v7, rating: 3, body: nil
    )
    report_repo.create(entry_id: reported_entry.id, reporter_account_id: account_id, reason: "x")
    own_entry = entry_repo.create(
      author_account_id: account_id, author_profile_id: persona_a,
      target_profile_id: SecureRandom.uuid_v7, rating: 3, body: nil
    )
    report_repo.create(entry_id: own_entry.id, reporter_account_id: bystander_account_id, reason: "x")
```

purge 後の確認の `expect(db[:karte__access].where(account_id: account_id).count).to eq(0)` の行の直後に、次を足す。

```ruby
    expect(db[:karte__reports].where(reporter_account_id: account_id).count).to eq(0)
    expect(db[:karte__reports].where(reporter_account_id: bystander_account_id).count).to eq(1)
    expect(db[:karte__entries].where(id: own_entry.id).count).to eq(1)
```

最後の行は、退会しても karte の記録そのものは残る、という既存の挙動を固定している。

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/identity/use_cases/account/purge_wiring_spec.rb > /tmp/rspec-t4.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t4.txt`
Expected: `0 failures`

- [ ] **Step 5: monolith の全体を確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `592 examples, 0 failures`

Run: `/usr/bin/grep -rn -E 'target_account_id' slices/karte spec/slices/karte`
Expected: 出力なし。

- [ ] **Step 6: Commit**

```bash
git add slices/karte/grpc/karte_handler.rb spec/slices/karte/grpc spec/slices/identity/use_cases/account/purge_wiring_spec.rb && git commit -s -m "feat(dystopia/monolith): act on karte with the account for ownership and the profile for authorship"
```

---

### Task 5: Frontend

**Files:**
- Generate: `dystopia/frontend/src/stub/karte/v1/service_pb.ts`
- Modify: `dystopia/frontend/src/modules/karte/types.ts`
- Create: `dystopia/frontend/src/modules/karte/lib/mappers.ts`
- Create: `dystopia/frontend/src/modules/karte/lib/mappers.test.ts`
- Modify: `dystopia/frontend/src/app/api/karte/route.ts`、`src/app/api/karte/[id]/route.ts`、`src/app/api/karte/by-target/route.ts`、`src/app/api/karte/my/route.ts`、`src/app/api/karte/recent/route.ts`
- Modify: `dystopia/frontend/src/modules/karte/hooks/useGuestKarte.ts`、`src/modules/karte/hooks/useCreateKarte.ts`
- Modify: `dystopia/frontend/src/modules/karte/components/GuestKarteTab.tsx`、`KarteComposer.tsx`、`KarteEntryCard.tsx`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`、`src/app/dev/ui/karte/page.tsx`
- Test: `dystopia/frontend/src/modules/karte/components/KarteEntryCard.test.tsx` ほか、`tsc` / `vitest` が指す test

**Interfaces:**
- Consumes: Task 1 の proto
- Produces:
  - `@/modules/karte/types` の `KarteEntry`: `authorProfileId` / `targetProfileId` / `isMine: boolean` を持ち、`authorAccountId` / `targetAccountId` は無くなる
  - `@/modules/karte/lib/mappers`: `mapKarteEntryToView(entry): KarteEntry`
  - BFF: `GET /api/karte/by-target?profile_id=...`、`POST /api/karte` の body は `{ targetProfileId, rating, body }`
  - `GuestKarteTab` の props は `guestProfileId`、`KarteComposer` の props は `targetProfileId`

- [ ] **Step 1: stub を生成する**

`pnpm proto:gen` は全 package の stub を作り直し、管理外の `src/stub/billing/` も作る。karte 以外を戻す。

Run:
```bash
env -u NODE_OPTIONS pnpm proto:gen
git diff --name-only --relative -- src/stub | /usr/bin/grep -v '^src/stub/karte/' | xargs git checkout --
git clean -fd -- src/stub
git status --short src/stub
```
Expected: ` M src/stub/karte/v1/service_pb.ts` の 1 行だけ。

- [ ] **Step 2: mapper の test を書く(失敗する)**

`src/modules/karte/lib/mappers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { KarteEntrySchema } from "@/stub/karte/v1/service_pb";
import { mapKarteEntryToView } from "./mappers";

describe("mapKarteEntryToView", () => {
  it("maps the author and target profile ids and the ownership flag", () => {
    const view = mapKarteEntryToView(
      create(KarteEntrySchema, {
        id: "e-1",
        authorProfileId: "author-profile",
        targetProfileId: "target-profile",
        isMine: true,
        authorUsername: "cast_taro",
        targetUsername: "guest_hanako",
        rating: 4,
        body: "memo",
        flagged: true,
      })
    );

    expect(view).toMatchObject({
      id: "e-1",
      authorProfileId: "author-profile",
      targetProfileId: "target-profile",
      isMine: true,
      authorUsername: "cast_taro",
      targetUsername: "guest_hanako",
      rating: 4,
      body: "memo",
      flagged: true,
    });
  });

  it("has no account id field", () => {
    const view = mapKarteEntryToView(create(KarteEntrySchema, { id: "e-1" }));

    expect(Object.keys(view)).not.toContain("authorAccountId");
    expect(Object.keys(view)).not.toContain("targetAccountId");
  });

  it("defaults missing strings, the flag, and timestamps", () => {
    const view = mapKarteEntryToView(create(KarteEntrySchema, { id: "e-1" }));

    expect(view.isMine).toBe(false);
    expect(view.authorUsername).toBe("");
    expect(view.targetAvatarUrl).toBe("");
    expect(view.createdAt).toBe("");
    expect(view.updatedAt).toBe("");
  });

  it("converts timestamps to ISO strings", () => {
    const view = mapKarteEntryToView(
      create(KarteEntrySchema, { id: "e-1", createdAt: { seconds: BigInt(1_700_000_000), nanos: 0 } })
    );

    expect(view.createdAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte/lib/mappers.test.ts > /tmp/vitest-t5.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t5.txt | /usr/bin/grep -E 'Tests |FAIL' | head -4`
Expected: FAIL(`./mappers` が無い)。

- [ ] **Step 3: 型と mapper を実装する**

`src/modules/karte/types.ts` の `KarteEntry` を次に置き換える。

```ts
export interface KarteEntry {
  id: string;
  authorProfileId: string;
  targetProfileId: string;
  isMine: boolean;
  authorUsername: string;
  authorAvatarUrl: string;
  targetUsername: string;
  targetAvatarUrl: string;
  rating: number;
  body: string;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`src/modules/karte/lib/mappers.ts`:

```ts
import type { KarteEntry as KarteEntryMessage } from "@/stub/karte/v1/service_pb";
import type { KarteEntry } from "@/modules/karte/types";

function toIsoString(timestamp: { seconds: bigint } | undefined): string {
  return timestamp ? new Date(Number(timestamp.seconds) * 1000).toISOString() : "";
}

export function mapKarteEntryToView(entry: KarteEntryMessage): KarteEntry {
  return {
    id: entry.id,
    authorProfileId: entry.authorProfileId,
    targetProfileId: entry.targetProfileId,
    isMine: !!entry.isMine,
    authorUsername: entry.authorUsername || "",
    authorAvatarUrl: entry.authorAvatarUrl || "",
    targetUsername: entry.targetUsername || "",
    targetAvatarUrl: entry.targetAvatarUrl || "",
    rating: entry.rating,
    body: entry.body || "",
    flagged: !!entry.flagged,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
  };
}
```

5 つの route が同じ変換を各自で持っていたものを、この 1 箇所に寄せる。5 箇所すべてのフィールドを変える必要があり、うち 2 箇所(作成と更新)は対象の表示名とアバターを落としていたためである。

- [ ] **Step 4: BFF の route を mapper に切り替える**

5 つの route で、entry を手書きで組み立てている箇所を `mapKarteEntryToView` に置き換える。import を足す。

```ts
import { mapKarteEntryToView } from "@/modules/karte/lib/mappers";
```

| ファイル | 置き換え |
|---|---|
| `src/app/api/karte/route.ts`(POST) | `NextResponse.json({ entry: { id: e.id, ... } })` → `NextResponse.json({ entry: mapKarteEntryToView(e) })` |
| `src/app/api/karte/[id]/route.ts`(PATCH) | 同上 |
| `src/app/api/karte/my/route.ts` | `(res.entries || []).map((e) => ({ ... }))` → `(res.entries || []).map(mapKarteEntryToView)` |
| `src/app/api/karte/recent/route.ts` | 同上 |
| `src/app/api/karte/by-target/route.ts` | ファイル内の `entryToView` 関数と `ListEntry` 型を削除し、`(res.entries || []).map(mapKarteEntryToView)` にする |

`src/app/api/karte/route.ts`(POST)は、対象の id の受け取りも改名する。

```ts
    const targetProfileId = body.targetProfileId as string | undefined;
    const rating = Number(body.rating);
    const text = (body.body as string | undefined) ?? "";
    if (!targetProfileId || !Number.isFinite(rating)) {
      return NextResponse.json({ error: "targetProfileId and rating required" }, { status: 400 });
    }
    const res = await karteClient.createEntry(
      { targetProfileId, rating, body: text },
      { headers: await buildGrpcHeaders(req) }
    );
```

`src/app/api/karte/by-target/route.ts` は、クエリの名前と gRPC の引数を改名する。

```ts
    const targetProfileId = req.nextUrl.searchParams.get("profile_id") || "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }
```

```ts
    const res = await karteClient.listEntriesByTarget(
      { targetProfileId, limit, cursor },
      { headers }
    );
```

- [ ] **Step 5: hook と component を更新する**

`src/modules/karte/hooks/useGuestKarte.ts`: 引数 `targetAccountId` を `targetProfileId` に改名し、URL のクエリを `profile_id` にする。

```ts
    const base = `/api/karte/by-target?profile_id=${encodeURIComponent(targetProfileId)}`;
```

`src/modules/karte/hooks/useCreateKarte.ts`: 引数 `targetAccountId` を `targetProfileId` に改名し、送信する body を次にする。

```ts
        body: { targetProfileId, rating, body },
```

`src/modules/karte/components/KarteComposer.tsx`: props の `targetAccountId` を `targetProfileId` に改名する(型、分割代入、`create(...)` の呼び出しの 3 箇所)。

`src/modules/karte/components/GuestKarteTab.tsx`: props の `guestAccountId` を `guestProfileId` に改名し、`<KarteComposer targetProfileId={guestProfileId} ... />` にする。

`src/modules/karte/components/KarteEntryCard.tsx`: 「自分の記録か」を server の判定に任せる。`useAuthStore` の import と `viewerId` の行を削除し、`isOwn` を次にする。

```tsx
  const isOwn = entry.isMine;
```

`src/app/u/[username]/page.tsx`: `<GuestKarteTab guestAccountId={profile.id} />` を `<GuestKarteTab guestProfileId={profile.id} />` にする。

`src/app/dev/ui/karte/page.tsx`: fixture の `authorAccountId` / `targetAccountId` を `authorProfileId` / `targetProfileId` に改名して `isMine` を足し(1 件目は `true`、2 件目は `false`)、`<KarteComposer targetAccountId=... />` を `targetProfileId` にする。

- [ ] **Step 6: `KarteEntryCard` の test を更新する**

`src/modules/karte/components/KarteEntryCard.test.tsx` で、`vi.mock("@/stores/authStore", ...)` の行を削除し、`baseEntry` の `authorAccountId` / `targetAccountId` を次に置き換える。

```ts
  authorProfileId: "author-1",
  targetProfileId: "target-1",
  isMine: false,
```

次の describe を足す。

```tsx
describe("KarteEntryCard ownership", () => {
  it("offers delete and no report for an entry the server marks as mine", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={{ ...baseEntry, isMine: true }} mode="my" />);

    expect(html).toContain("削除");
    expect(html).not.toContain("報告");
  });

  it("offers report and no delete for an entry that is not mine", () => {
    const html = renderToStaticMarkup(<KarteEntryCard entry={{ ...baseEntry, isMine: false }} mode="target" />);

    expect(html).toContain("報告");
    expect(html).not.toContain("削除");
  });

  it("decides by the server flag, not by comparing ids on the client", () => {
    const html = renderToStaticMarkup(
      <KarteEntryCard entry={{ ...baseEntry, authorProfileId: "another-persona-of-mine", isMine: true }} mode="recent" />
    );

    expect(html).toContain("削除");
  });
});
```

- [ ] **Step 7: 型が通ることを確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"`
Expected: `tsc exit=0`。Step 3〜6 の変更だけで通る(`KarteEntry` を作っている箇所は `src/app/dev/ui/karte/page.tsx` と `KarteEntryCard.test.tsx` の 2 つで、どちらも Step 5・6 で直している)。

エラーが出た場合は、出力された箇所だけを直す。karte 以外の型(`SocialAccountView`、review の `authorAccountId` など)と、social / messaging の component の `targetAccountId` という props は変えない。

- [ ] **Step 8: 全体を確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-t5.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t5.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、`Test Files  85 passed (85)`、`Tests  324 passed (324)`。

Run: `/usr/bin/grep -rn -E 'authorAccountId|targetAccountId|guestAccountId' src/modules/karte src/app/karte src/app/api/karte src/app/dev/ui/karte | /usr/bin/grep -v 'mappers.test.ts'; /usr/bin/grep -n 'guestAccountId' "src/app/u/[username]/page.tsx"`
Expected: 出力なし(`mappers.test.ts` は「account の id のキーが無い」ことを確かめるためにこの名前を含む。`u/[username]/page.tsx` の `FollowButton` などの `targetAccountId` は social / messaging の props で、この plan では変えない)。

Run: `git status --short src/stub`
Expected: ` M src/stub/karte/v1/service_pb.ts` の 1 行だけ。

- [ ] **Step 9: Commit**

```bash
git add src && git commit -s -m "feat(dystopia/frontend): show karte ownership from the server and address targets by profile"
```

---

## Controller verification (not dispatched)

Task 5 の後、controller が実サーバーを起動して確認する。起動方法は P1b の plan の Controller verification に書いたとおりである(使い捨ての database、`bin/grpc` に `.env` と `.env.test` を export、`next dev`、ブラウザは `localhost` で開く、終了後に生成物と database を削除)。

確認する内容:

- cast でログインし、guest の profile を対象に karte を作成できる。返ってきた記録の `authorProfileId` が自分の profile の id、`isMine` が真である。
- 同じ記録が `GET /api/karte/my` に出る。`GET /api/karte/by-target?profile_id=<guest の profile>` にも出る。
- 別の cast でログインすると、同じ記録が `isMine` 偽で見え、通報でき、編集は 400 で拒否される。
- どの応答の本文にも、著者の account の id が含まれない。
- 画面上で、自分の記録には「削除」、他人の記録には「報告」が出る。

## Known gaps left for later plans

- review slice は、著者と対象を `author_account_id` / `target_account_id` という名前で持ち、値は profile の id である。段 7 で改名する。
- 人格を削除したとき、その人格が書いた karte の著者表示は空になる。所有者は別の人格から引き続き一覧・編集できる。人格の削除は段 8 で入る。
- karte の利用権(`karte.access`)は account 単位で、現在は `GetMyAccess` が常に利用可を返す(既存の TODO)。課金との接続はこの stack の範囲外である。
- P1a と P1b の Known gaps のうち karte 以外のものはそのまま残る。
