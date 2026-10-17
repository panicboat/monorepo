# Dystopia Karte Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カルテを「1 回の予約〜接客後 = 1 カルテ（段階ごとの出来事、記録中／完了、キャスト単位の平均評価）」に作り替え、frontend のデータ層と既存画面を新しい形で動かす。

**Architecture:** monolith の karte slice を `kartes` と `events` の 2 表に作り直し、RPC ごとの use case と、カルテに出来事とプロフィールを付ける `PresentKartes` を置く。`karte.v1` の proto をその場で作り替え、frontend の BFF・型・hook を合わせる。通報と閲覧権の仕組みは取り除き、カルテの利用可否はキャストかどうかで決める。

**Tech Stack:** Hanami 2 + ROM-SQL 3.7 + Sequel 5.99 + PostgreSQL 18 / gruf (gRPC) / buf 1.73 / Next.js 16 + protobuf-es v2 + connect / vitest 5 + happy-dom

**Spec:** `docs/superpowers/specs/2026-10-16-dystopia-karte-lifecycle-design.md`

## Global Constraints

- 作業ディレクトリは worktree（`/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/refactor-dystopia-design-foundation`）。ブランチは `feat/dystopia-karte-lifecycle`
- Ruby のコマンドは `dystopia/monolith` で `rbenv exec bundle exec ...` として実行する
- rspec は `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt` で実行する（stderr に大量の warning が出るためファイルへ出す）。test DB は `monolith_test`
- frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` として実行する
- 段階のコード: `reservation`・`service`・`aftercare`。状態のコード: `open`・`closed`
- 対応結果・タグ・補足必須の対応結果は spec の表のとおり（Task 1 と Task 6 に全件転記済み）
- 補足は 500 文字まで。発生日は `YYYY-MM-DD` で、日本時間の今日以前
- 星は 1〜5。記録中は未評価（`nil` / proto の `0` / frontend の `null`）を許し、完了には必須
- 一覧の件数は既定 20、上限 50。並びは作成日時の新しい順
- 権限: 閲覧・作成はキャスト（アカウントの `role` が `2`）のみ。作成の対象はゲスト（役割 `1`）のプロフィール。編集系は作成者と同じアカウント
- エラー: 権限は `PERMISSION_DENIED`、入力・見つからない・状態違反は `INVALID_ARGUMENT`
- 既存のカルテ・通報・閲覧権の表は破棄する。データは移さない
- `dystopia/frontend` の第 1 段の constraint（花形メニュー、FAB、ブレークポイントを変えない）を守る
- proto のスタブは `karte` package の差分だけを commit する。生成で出た他 package の差分は `git checkout --` で戻し、未追跡の `dystopia/frontend/src/stub/billing` は削除する
- 依存を追加しない
- コードコメントは英語・1 行・「なぜ他のやり方を採らなかったか」だけ。タスクや変更への言及を書かない。`// FALLBACK:`・`# FALLBACK:` などのマーカー規約に従う
- コミットは `git commit -s`。`Co-Authored-By` を付けない。メッセージは英語
- ROM の command（`command(:create)`・`command(:update)`）経由の制約違反は `ROM::SQL::CheckConstraintError` に包まれる。dataset を直接更新したときは `Sequel::CheckConstraintViolation` のまま
- DB を使う spec は、同じ example の中で作った行の並びを `eq([a, b])` で比べない。並びを確かめるときは `created_at` を明示的に更新してから比べる（同じ transaction 内では `now()` が同値になるため）
- frontend の `tsc --noEmit` は Task 6 の後は Task 7 が終わるまで失敗する（型を作り直し、画面の追従が Task 7 のため）。Task 6 では自分のテストファイルだけを vitest で確かめる

## Review Focus

- UUID でない id（カルテ・出来事・対象プロフィール）を渡されたら、500 ではなく `INVALID_ARGUMENT` を返す（Task 3 の use case spec と Task 4 の handler spec）
- 補足必須の対応結果で、空白だけの補足は補足なしとして拒否する（Task 1）
- 存在しない日付（`2026-02-30`）や形式違い（`2026/10/16`）の発生日を拒否する（Task 1）
- 同じアカウントの別プロフィールが書いたカルテは、評価したキャスト数で 1 人と数える（Task 2）
- 後から追記した過去の日付の出来事は、新しい出来事より前に並び、カードの「最後の出来事」は発生日が最も新しいものになる（Task 2 と Task 7）

---

## File Structure

monolith（`dystopia/monolith/`）:

| ファイル | 責務 | Task |
|---|---|---|
| `slices/karte/errors.rb` | `Forbidden`・`Invalid` の例外 | 1 |
| `slices/karte/catalog.rb` | 段階・対応結果・タグ・補足必須の一覧 | 1 |
| `slices/karte/ids.rb` | UUID 形式の判定 | 1 |
| `slices/karte/use_cases/validate_event.rb` | 出来事の入力の検証と正規化 | 1 |
| `slices/karte/use_cases/authorize_cast.rb` | 閲覧者がキャストか | 1 |
| `config/db/migrate/20261016000000_create_karte_lifecycle_tables.rb` | `kartes`・`events` の作成 | 2 |
| `slices/karte/relations/kartes.rb`, `events.rb` | 表の定義 | 2 |
| `slices/karte/repositories/karte_repository.rb` | カルテの読み書き、一覧、信頼性の集計 | 2 |
| `slices/karte/repositories/event_repository.rb` | 出来事の読み書き、カルテ群の出来事の一括取得 | 2 |
| `slices/karte/use_cases/present_kartes.rb` | カルテに出来事とプロフィールを付けた Hash にする | 3 |
| `slices/karte/use_cases/load_own_karte.rb` | 作成者の操作の前提（キャスト、存在、作成者、状態）を確かめる | 3 |
| `slices/karte/use_cases/page_kartes.rb` | 一覧の件数の正規化とページの組み立て | 3 |
| `slices/karte/use_cases/*_karte*.rb`（12 ファイル） | RPC ごとの use case | 3 |
| `proto/dystopia/karte/v1/service.proto` | RPC とメッセージ | 4 |
| `slices/karte/grpc/karte_handler.rb` | RPC と use case の対応、proto への変換 | 4 |
| `config/db/migrate/20261016010000_drop_karte_entries_reports_and_access.rb` | 旧表の削除 | 4 |

frontend（`dystopia/frontend/`）は Task 5〜7 の冒頭に列挙する。

---

### Task 1: Catalog and event validation

**Files:**
- Create: `dystopia/monolith/slices/karte/errors.rb`
- Create: `dystopia/monolith/slices/karte/catalog.rb`
- Create: `dystopia/monolith/slices/karte/ids.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/validate_event.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/authorize_cast.rb`
- Test: `dystopia/monolith/spec/slices/karte/use_cases/validate_event_spec.rb`
- Test: `dystopia/monolith/spec/slices/karte/use_cases/authorize_cast_spec.rb`

**Interfaces:**
- Consumes: なし
- Produces:
  - `Karte::Errors::Forbidden`, `Karte::Errors::Invalid`（`StandardError` の子）
  - `Karte::Catalog::STAGES`（Array<String>）, `OUTCOMES` / `TAGS` / `NOTE_REQUIRED_OUTCOMES`（Hash<String, Array<String>>）, `MAX_NOTE_LENGTH`（500）
  - `Karte::Ids.valid?(value) -> Boolean`
  - `Karte::UseCases::ValidateEvent#call(stage:, outcome:, tags:, note:, occurred_on:, today: <JST の今日>) -> { stage: String, outcome: String, tags: Array<String>, note: String | nil, occurred_on: Date }`。不正なら `Karte::Errors::Invalid`
  - `Karte::UseCases::AuthorizeCast#call(viewer_account_id:) -> Boolean`。container key は `use_cases.authorize_cast`

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/monolith/spec/slices/karte/use_cases/validate_event_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::ValidateEvent do
  subject(:validate) { described_class.new }

  let(:today) { Date.new(2026, 10, 16) }
  let(:valid) do
    { stage: "service", outcome: "completed", tags: %w[late punctual], note: "15分遅刻", occurred_on: "2026-10-15" }
  end

  def call(**overrides)
    validate.call(**valid.merge(overrides), today: today)
  end

  def invalid(message)
    raise_error(Karte::Errors::Invalid, message)
  end

  it "returns the event with the date parsed" do
    expect(call).to eq(stage: "service", outcome: "completed", tags: %w[late punctual], note: "15分遅刻", occurred_on: Date.new(2026, 10, 15))
  end

  it "accepts every outcome and tag listed for each stage" do
    Karte::Catalog::STAGES.each do |stage|
      Karte::Catalog::OUTCOMES.fetch(stage).each do |outcome|
        result = call(stage: stage, outcome: outcome, tags: Karte::Catalog::TAGS.fetch(stage), note: "補足")
        expect(result[:outcome]).to eq(outcome)
      end
    end
  end

  it "rejects an unknown stage" do
    expect { call(stage: "after") }.to invalid("Unknown stage")
  end

  it "rejects an outcome of another stage" do
    expect { call(stage: "service", outcome: "no_show") }.to invalid("Unknown outcome for the stage")
  end

  it "rejects a tag of another stage" do
    expect { call(stage: "service", tags: %w[smooth_contact]) }.to invalid("Unknown tag for the stage")
  end

  it "rejects a repeated tag" do
    expect { call(tags: %w[late late]) }.to invalid("Duplicate tags")
  end

  it "stores a blank note as no note" do
    expect(call(note: "   ")[:note]).to be_nil
  end

  it "requires a note for a serious outcome and treats spaces as no note" do
    expect { call(stage: "reservation", outcome: "no_show", tags: [], note: "  ") }.to invalid("Note required for this outcome")
    expect { call(stage: "service", outcome: "ended_early", tags: [], note: "") }.to invalid("Note required for this outcome")
    expect { call(stage: "aftercare", outcome: "trouble_occurred", tags: [], note: "") }.to invalid("Note required for this outcome")
    expect(call(stage: "reservation", outcome: "no_show", tags: [], note: "連絡なし")[:note]).to eq("連絡なし")
  end

  it "accepts a note of 500 characters and rejects 501" do
    expect(call(note: "あ" * 500)[:note].length).to eq(500)
    expect { call(note: "あ" * 501) }.to invalid("Note too long")
  end

  it "accepts today and rejects tomorrow" do
    expect(call(occurred_on: "2026-10-16")[:occurred_on]).to eq(today)
    expect { call(occurred_on: "2026-10-17") }.to invalid("Occurred date is in the future")
  end

  it "rejects a date that does not exist or is not written as YYYY-MM-DD" do
    expect { call(occurred_on: "2026-02-30") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { call(occurred_on: "2026/10/16") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { call(occurred_on: "") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { call(occurred_on: nil) }.to invalid("Occurred date must be YYYY-MM-DD")
  end

  it "defaults today to the date in Japan" do
    travel_to = Time.utc(2026, 10, 15, 16, 0, 0)
    allow(Time).to receive(:now).and_return(travel_to)

    expect(validate.call(**valid, occurred_on: "2026-10-16")[:occurred_on]).to eq(Date.new(2026, 10, 16))
  end
end
```

`dystopia/monolith/spec/slices/karte/use_cases/authorize_cast_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AuthorizeCast, type: :database do
  subject(:authorize) { described_class.new }

  it "allows a cast account" do
    expect(authorize.call(viewer_account_id: create_account(role: 2))).to be true
  end

  it "refuses a guest account" do
    expect(authorize.call(viewer_account_id: create_account(role: 1))).to be false
  end

  it "refuses an unknown account" do
    expect(authorize.call(viewer_account_id: SecureRandom.uuid_v7)).to be false
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/use_cases/validate_event_spec.rb spec/slices/karte/use_cases/authorize_cast_spec.rb > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（`uninitialized constant Karte::UseCases::ValidateEvent`）

- [ ] **Step 3: 実装する**

`dystopia/monolith/slices/karte/errors.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Errors
    class Forbidden < StandardError; end
    class Invalid < StandardError; end
  end
end
```

`dystopia/monolith/slices/karte/catalog.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Catalog
    STAGES = %w[reservation service aftercare].freeze

    OUTCOMES = {
      "reservation" => %w[inquiry_only booked cancelled_with_notice no_show other],
      "service" => %w[completed completed_with_issues ended_early other],
      "aftercare" => %w[closed_without_issues next_booking_inquiry inquiry_handled trouble_occurred trouble_resolved other]
    }.freeze

    TAGS = {
      "reservation" => %w[smooth_contact contact_problem condition_mismatch rescheduled advance_notice unagreed_request],
      "service" => %w[punctual late payment_ok payment_trouble smooth_communication excessive_request],
      "aftercare" => %w[polite_contact excessive_contact personal_contact_request condition_change_request resolved]
    }.freeze

    NOTE_REQUIRED_OUTCOMES = {
      "reservation" => %w[no_show],
      "service" => %w[ended_early],
      "aftercare" => %w[trouble_occurred]
    }.freeze

    MAX_NOTE_LENGTH = 500
  end
end
```

`dystopia/monolith/slices/karte/ids.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Ids
    PATTERN = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def self.valid?(value)
      value.is_a?(String) && PATTERN.match?(value)
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/validate_event.rb`:

```ruby
# frozen_string_literal: true

require "date"

module Karte
  module UseCases
    class ValidateEvent
      JAPAN_OFFSET = "+09:00"
      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

      def call(stage:, outcome:, tags:, note:, occurred_on:, today: Time.now.getlocal(JAPAN_OFFSET).to_date)
        raise Errors::Invalid, "Unknown stage" unless Catalog::STAGES.include?(stage)
        raise Errors::Invalid, "Unknown outcome for the stage" unless Catalog::OUTCOMES.fetch(stage).include?(outcome)

        tags = Array(tags)
        raise Errors::Invalid, "Duplicate tags" unless tags.uniq.length == tags.length
        raise Errors::Invalid, "Unknown tag for the stage" unless (tags - Catalog::TAGS.fetch(stage)).empty?

        note = note.to_s
        raise Errors::Invalid, "Note too long" if note.length > Catalog::MAX_NOTE_LENGTH
        blank_note = note.strip.empty?
        if blank_note && Catalog::NOTE_REQUIRED_OUTCOMES.fetch(stage).include?(outcome)
          raise Errors::Invalid, "Note required for this outcome"
        end

        date = parse_date(occurred_on)
        raise Errors::Invalid, "Occurred date is in the future" if date > today

        { stage: stage, outcome: outcome, tags: tags, note: blank_note ? nil : note, occurred_on: date }
      end

      private

      def parse_date(value)
        raise Errors::Invalid, "Occurred date must be YYYY-MM-DD" unless value.is_a?(String) && DATE_FORMAT.match?(value)

        Date.iso8601(value)
      rescue Date::Error
        raise Errors::Invalid, "Occurred date must be YYYY-MM-DD"
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/authorize_cast.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class AuthorizeCast
      ROLE_CAST = 2

      def initialize(account_repo: nil)
        @account_repo = account_repo
      end

      def call(viewer_account_id:)
        return false unless Ids.valid?(viewer_account_id)

        account_repo.find_by_id(viewer_account_id)&.role == ROLE_CAST
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
```

- [ ] **Step 4: テストが通ることを確認する**

Run: Step 2 と同じ
Expected: `examples, 0 failures`（validate_event 13 件、authorize_cast 3 件）

- [ ] **Step 5: コミットする**

```bash
git add dystopia/monolith/slices/karte/errors.rb dystopia/monolith/slices/karte/catalog.rb dystopia/monolith/slices/karte/ids.rb dystopia/monolith/slices/karte/use_cases/validate_event.rb dystopia/monolith/slices/karte/use_cases/authorize_cast.rb dystopia/monolith/spec/slices/karte/use_cases/validate_event_spec.rb dystopia/monolith/spec/slices/karte/use_cases/authorize_cast_spec.rb
git commit -s -m "feat(dystopia/monolith): validate karte events against the stage catalog"
```

---

### Task 2: Schema and repositories

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261016000000_create_karte_lifecycle_tables.rb`
- Create: `dystopia/monolith/slices/karte/relations/kartes.rb`
- Create: `dystopia/monolith/slices/karte/relations/events.rb`
- Create: `dystopia/monolith/slices/karte/repositories/karte_repository.rb`
- Create: `dystopia/monolith/slices/karte/repositories/event_repository.rb`
- Test: `dystopia/monolith/spec/slices/karte/repositories/karte_repository_spec.rb`
- Test: `dystopia/monolith/spec/slices/karte/repositories/event_repository_spec.rb`

**Interfaces:**
- Consumes: なし
- Produces:
  - `KarteRepository`（key `repositories.karte_repository`）: `create(author_account_id:, author_profile_id:, target_profile_id:, rating:) -> struct`、`find(id) -> struct | nil`、`update_rating(id, rating) -> struct`、`close(id) -> struct`、`reopen(id) -> struct`、`touch(id)`、`delete(id)`、`list_by_target(target_profile_id:, limit:, cursor: nil) -> Array`（最大 `limit + 1` 件）、`list_by_author(author_account_id:, limit:, cursor: nil)`、`list_recent(limit:, cursor: nil)`、`cursor_for(karte) -> String`、`reliability(target_profile_id:) -> { average_rating: Float, rater_count: Integer, karte_count: Integer }`、`transaction { }`
  - カルテの struct の属性: `id`・`author_account_id`・`author_profile_id`・`target_profile_id`・`rating`（Integer | nil）・`status`（`"open"` / `"closed"`）・`closed_at`・`created_at`・`updated_at`
  - `EventRepository`（key `repositories.event_repository`）: `create(karte_id:, stage:, outcome:, tags:, note:, occurred_on:) -> struct`、`find(id) -> struct | nil`、`update(id, stage:, outcome:, tags:, note:, occurred_on:) -> struct`、`delete(id)`、`count_for(karte_id) -> Integer`、`list_for(karte_ids) -> Hash<String, Array<struct>>`（出来事は発生日・作成日時・id の昇順）
  - 出来事の struct の属性: `id`・`karte_id`・`stage`・`outcome`・`tags`（Array<String> として読める）・`note`・`occurred_on`（Date）・`created_at`・`updated_at`

- [ ] **Step 1: migration を書いて test DB に適用する**

`dystopia/monolith/config/db/migrate/20261016000000_create_karte_lifecycle_tables.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"karte__kartes" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :author_profile_id, :uuid, null: false
      column :target_profile_id, :uuid, null: false
      column :rating, :smallint
      column :status, :text, null: false
      column :closed_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
      constraint :status_value, "status IN ('open', 'closed')"
      constraint :closed_at_matches_status, "(status = 'closed') = (closed_at IS NOT NULL)"
      constraint :closed_karte_rated, "status = 'open' OR rating IS NOT NULL"
    end

    run <<~SQL
      CREATE INDEX idx_karte_kartes_target_created
        ON karte.kartes (target_profile_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_author_created
        ON karte.kartes (author_account_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_created
        ON karte.kartes (created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_reliability
        ON karte.kartes (target_profile_id, author_account_id)
        WHERE status = 'closed'
    SQL

    create_table :"karte__events" do
      column :id, :uuid, null: false
      column :karte_id, :uuid, null: false
      column :stage, :text, null: false
      column :outcome, :text, null: false
      column :tags, "text[]", null: false, default: Sequel.lit("'{}'::text[]")
      column :note, :text
      column :occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      foreign_key [:karte_id], :"karte__kartes", on_delete: :cascade
      constraint :stage_value, "stage IN ('reservation', 'service', 'aftercare')"
    end

    run <<~SQL
      CREATE INDEX idx_karte_events_karte_occurred
        ON karte.events (karte_id, occurred_on, created_at)
    SQL
  end

  down do
    drop_table :"karte__events"
    drop_table :"karte__kartes"
  end
end
```

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: migration が適用される。最後に `pg_dump: error: server version ... aborting because of server version mismatch` が出ても構わない（構造ダンプの失敗で、migration 自体は成功している）。`git status` に `config/db/structure.sql` の変更が出た場合は `git checkout -- config/db/structure.sql` で戻す

Run: `/opt/homebrew/opt/postgresql@18/bin/psql postgres://postgres:password@localhost:5432/monolith_test -c '\d karte.events'`
Expected: `tags | text[]`、`occurred_on | date`、`karte_id` の外部キー（`ON DELETE CASCADE`）が表示される

- [ ] **Step 2: 失敗するテストを書く**

`dystopia/monolith/spec/slices/karte/repositories/karte_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::Repositories::KarteRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:target) { SecureRandom.uuid_v7 }

  def karte(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: target, rating: nil)
    repo.create(author_account_id: author_account_id, author_profile_id: author_profile_id, target_profile_id: target_profile_id, rating: rating)
  end

  def closed(rating:, **attrs)
    repo.close(karte(rating: rating, **attrs).id)
  end

  def set_created_at(record, time)
    db[:karte__kartes].where(id: record.id).update(created_at: time)
  end

  describe "#create" do
    it "starts an open karte without a close time" do
      record = karte(rating: 4)

      expect(record.status).to eq("open")
      expect(record.rating).to eq(4)
      expect(record.closed_at).to be_nil
    end

    it "allows an open karte without a rating" do
      expect(karte(rating: nil).rating).to be_nil
    end
  end

  describe "#close and #reopen" do
    it "records the close time and clears it on reopening, keeping the rating" do
      record = karte(rating: 3)

      closed_record = repo.close(record.id)
      expect(closed_record.status).to eq("closed")
      expect(closed_record.closed_at).not_to be_nil

      reopened = repo.reopen(record.id)
      expect(reopened.status).to eq("open")
      expect(reopened.closed_at).to be_nil
      expect(reopened.rating).to eq(3)
    end
  end

  describe "#update_rating" do
    it "sets and clears the rating" do
      record = karte(rating: nil)

      expect(repo.update_rating(record.id, 5).rating).to eq(5)
      expect(repo.update_rating(record.id, nil).rating).to be_nil
    end
  end

  describe "constraints" do
    it "rejects closing a karte without a rating" do
      record = karte(rating: nil)

      expect { repo.close(record.id) }.to raise_error(ROM::SQL::CheckConstraintError)
    end

    it "rejects a rating outside 1..5" do
      expect { karte(rating: 6) }.to raise_error(ROM::SQL::CheckConstraintError)
    end

    it "rejects an unknown status" do
      record = karte(rating: 2)

      expect { db[:karte__kartes].where(id: record.id).update(status: "archived") }.to raise_error(Sequel::CheckConstraintViolation)
    end

    it "rejects a closed karte without a close time" do
      record = karte(rating: 2)

      expect { db[:karte__kartes].where(id: record.id).update(status: "closed") }.to raise_error(Sequel::CheckConstraintViolation)
    end
  end

  describe "#delete" do
    it "removes the karte and its events" do
      record = karte(rating: 2)
      Karte::Repositories::EventRepository.new.create(
        karte_id: record.id, stage: "service", outcome: "completed", tags: [], note: nil, occurred_on: Date.new(2026, 10, 1)
      )

      repo.delete(record.id)

      expect(repo.find(record.id)).to be_nil
      expect(db[:karte__events].where(karte_id: record.id).count).to eq(0)
    end
  end

  describe "listing" do
    it "lists the kartes about a guest newest first, one more than the limit, and continues from the cursor" do
      now = Time.now
      first = karte
      second = karte
      third = karte
      set_created_at(first, now - 300)
      set_created_at(second, now - 200)
      set_created_at(third, now - 100)
      karte(target_profile_id: SecureRandom.uuid_v7)

      page = repo.list_by_target(target_profile_id: target, limit: 2)
      expect(page.map(&:id)).to eq([third.id, second.id, first.id])

      rest = repo.list_by_target(target_profile_id: target, limit: 2, cursor: repo.cursor_for(page[1]))
      expect(rest.map(&:id)).to eq([first.id])
    end

    it "lists the kartes of an author account and the recent kartes of everyone, open ones included" do
      now = Time.now
      author = SecureRandom.uuid_v7
      mine = karte(author_account_id: author)
      theirs = closed(rating: 4)
      set_created_at(mine, now - 100)
      set_created_at(theirs, now - 50)

      expect(repo.list_by_author(author_account_id: author, limit: 20).map(&:id)).to eq([mine.id])
      expect(repo.list_recent(limit: 20).map(&:id)).to eq([theirs.id, mine.id])
    end
  end

  describe "#reliability" do
    it "averages each account first, so a cast who wrote many kartes weighs the same as one who wrote one" do
      heavy = SecureRandom.uuid_v7
      closed(rating: 5, author_account_id: heavy)
      closed(rating: 3, author_account_id: heavy)
      closed(rating: 4, author_account_id: heavy)
      closed(rating: 2, author_account_id: SecureRandom.uuid_v7)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 3.0, rater_count: 2, karte_count: 4)
    end

    it "counts the profiles of one account as one cast" do
      account = SecureRandom.uuid_v7
      closed(rating: 5, author_account_id: account, author_profile_id: SecureRandom.uuid_v7)
      closed(rating: 1, author_account_id: account, author_profile_id: SecureRandom.uuid_v7)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 3.0, rater_count: 1, karte_count: 2)
    end

    it "leaves open kartes out, including a reopened one" do
      closed(rating: 4)
      karte(rating: 1)
      reopened = closed(rating: 1)
      repo.reopen(reopened.id)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 4.0, rater_count: 1, karte_count: 1)
    end

    it "reports nothing for a guest without closed kartes" do
      karte(rating: 5)

      expect(repo.reliability(target_profile_id: target)).to eq(average_rating: 0.0, rater_count: 0, karte_count: 0)
    end
  end
end
```

`dystopia/monolith/spec/slices/karte/repositories/event_repository_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::Repositories::EventRepository, type: :database do
  subject(:repo) { described_class.new }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:kartes) { Karte::Repositories::KarteRepository.new }

  def new_karte
    kartes.create(author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7, rating: nil)
  end

  def event(karte_id, occurred_on:, stage: "service", outcome: "completed", tags: [], note: nil)
    repo.create(karte_id: karte_id, stage: stage, outcome: outcome, tags: tags, note: note, occurred_on: occurred_on)
  end

  it "stores the tags as a list and the date as a date" do
    record = event(new_karte.id, occurred_on: Date.new(2026, 10, 1), tags: %w[late punctual], note: "遅刻")

    found = repo.find(record.id)
    expect(found.tags.to_a).to eq(%w[late punctual])
    expect(found.occurred_on).to eq(Date.new(2026, 10, 1))
    expect(found.note).to eq("遅刻")
  end

  it "updates every field of an event" do
    record = event(new_karte.id, occurred_on: Date.new(2026, 10, 1))

    updated = repo.update(record.id, stage: "aftercare", outcome: "trouble_occurred", tags: %w[excessive_contact], note: "頻繁", occurred_on: Date.new(2026, 10, 3))

    expect(updated.stage).to eq("aftercare")
    expect(updated.tags.to_a).to eq(%w[excessive_contact])
    expect(updated.occurred_on).to eq(Date.new(2026, 10, 3))
  end

  it "rejects an unknown stage" do
    expect { event(new_karte.id, occurred_on: Date.new(2026, 10, 1), stage: "after") }.to raise_error(ROM::SQL::CheckConstraintError)
  end

  it "groups the events of several kartes and orders each by the day it happened" do
    first = new_karte
    second = new_karte
    later = event(first.id, occurred_on: Date.new(2026, 10, 5))
    earlier = event(first.id, occurred_on: Date.new(2026, 10, 2))
    other = event(second.id, occurred_on: Date.new(2026, 10, 3))

    grouped = repo.list_for([first.id, second.id])

    expect(grouped.fetch(first.id).map(&:id)).to eq([earlier.id, later.id])
    expect(grouped.fetch(second.id).map(&:id)).to eq([other.id])
    expect(repo.list_for([])).to eq({})
  end

  it "counts and deletes the events of a karte" do
    record = new_karte
    kept = event(record.id, occurred_on: Date.new(2026, 10, 1))
    removed = event(record.id, occurred_on: Date.new(2026, 10, 2))

    repo.delete(removed.id)

    expect(repo.count_for(record.id)).to eq(1)
    expect(repo.find(kept.id)).not_to be_nil
  end
end
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/repositories/karte_repository_spec.rb spec/slices/karte/repositories/event_repository_spec.rb > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（`uninitialized constant Karte::Repositories::KarteRepository`）

- [ ] **Step 4: 実装する**

`dystopia/monolith/slices/karte/relations/kartes.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Relations
    class Kartes < Karte::DB::Relation
      schema(:"karte__kartes", as: :karte_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :author_profile_id, Types::String
        attribute :target_profile_id, Types::String
        attribute :rating, Types::Integer.optional
        attribute :status, Types::String
        attribute :closed_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/relations/events.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Relations
    class Events < Karte::DB::Relation
      schema(:"karte__events", as: :event_records, infer: false) do
        attribute :id, Types::String
        attribute :karte_id, Types::String
        attribute :stage, Types::String
        attribute :outcome, Types::String
        attribute :tags, Types::PG::Array("text", Types::String)
        attribute :note, Types::String.optional
        attribute :occurred_on, Types::Date
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/repositories/karte_repository.rb`:

```ruby
# frozen_string_literal: true

require "concerns/cursor_pagination"

module Karte
  module Repositories
    class KarteRepository < Karte::DB::Repo
      include ::Concerns::CursorPagination

      def create(author_account_id:, author_profile_id:, target_profile_id:, rating:)
        karte_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          status: "open"
        )
      end

      def find(id)
        karte_records.by_pk(id).one
      end

      def update_rating(id, rating)
        update(id, rating: rating)
      end

      def close(id)
        update(id, status: "closed", closed_at: Time.now)
      end

      def reopen(id)
        update(id, status: "open", closed_at: nil)
      end

      def touch(id)
        karte_records.by_pk(id).command(:update).call(updated_at: Time.now)
      end

      def delete(id)
        karte_records.by_pk(id).command(:delete).call
      end

      def list_by_target(target_profile_id:, limit:, cursor: nil)
        page(karte_records.where(target_profile_id: target_profile_id), limit, cursor)
      end

      def list_by_author(author_account_id:, limit:, cursor: nil)
        page(karte_records.where(author_account_id: author_account_id), limit, cursor)
      end

      def list_recent(limit:, cursor: nil)
        page(karte_records, limit, cursor)
      end

      def cursor_for(karte)
        encode_cursor(created_at: karte.created_at.iso8601(6), id: karte.id)
      end

      def reliability(target_profile_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
        per_account = karte_records.dataset.unordered
          .where(target_profile_id: target_profile_id, status: "closed")
          .group(:author_account_id)
          .select(Sequel.function(:avg, :rating).as(:account_average), Sequel.function(:count, :id).as(:karte_count))
        row = karte_records.dataset.db.from(per_account.as(:per_account)).select(
          Sequel.function(:avg, :account_average).as(:average_rating),
          Sequel.function(:count).*.as(:rater_count),
          Sequel.function(:sum, :karte_count).as(:karte_count)
        ).first
        karte_count = row[:karte_count].to_i
        {
          average_rating: karte_count.zero? ? 0.0 : row[:average_rating].to_f,
          rater_count: row[:rater_count].to_i,
          karte_count: karte_count
        }
      end

      private

      def update(id, attrs)
        karte_records.by_pk(id).command(:update).call(attrs.merge(updated_at: Time.now))
        find(id)
      end

      def page(scope, limit, cursor)
        decoded = decode_cursor(cursor)
        if decoded
          scope = scope.where {
            (created_at < decoded[:created_at]) |
              ((created_at =~ decoded[:created_at]) & (id < decoded[:id]))
          }
        end
        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/repositories/event_repository.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module Repositories
    class EventRepository < Karte::DB::Repo
      def create(karte_id:, stage:, outcome:, tags:, note:, occurred_on:)
        event_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          karte_id: karte_id,
          stage: stage,
          outcome: outcome,
          tags: tags,
          note: note,
          occurred_on: occurred_on
        )
      end

      def find(id)
        event_records.by_pk(id).one
      end

      def update(id, stage:, outcome:, tags:, note:, occurred_on:)
        event_records.by_pk(id).command(:update).call(
          stage: stage, outcome: outcome, tags: tags, note: note, occurred_on: occurred_on, updated_at: Time.now
        )
        find(id)
      end

      def delete(id)
        event_records.by_pk(id).command(:delete).call
      end

      def count_for(karte_id)
        event_records.where(karte_id: karte_id).count
      end

      def list_for(karte_ids)
        return {} if karte_ids.empty?

        event_records.where(karte_id: karte_ids)
          .order { [occurred_on.asc, created_at.asc, id.asc] }
          .to_a
          .group_by(&:karte_id)
      end
    end
  end
end
```

- [ ] **Step 5: テストが通ることを確認する**

Run: Step 3 と同じ
Expected: `0 failures`（karte_repository 15 件、event_repository 5 件）。続けて同じコマンドを 5 回繰り返し、毎回 `0 failures` であることを確かめる（並びに依存する spec の不安定さを検出するため）

- [ ] **Step 6: コミットする**

```bash
git add dystopia/monolith/config/db/migrate/20261016000000_create_karte_lifecycle_tables.rb dystopia/monolith/slices/karte/relations/kartes.rb dystopia/monolith/slices/karte/relations/events.rb dystopia/monolith/slices/karte/repositories/karte_repository.rb dystopia/monolith/slices/karte/repositories/event_repository.rb dystopia/monolith/spec/slices/karte/repositories/karte_repository_spec.rb dystopia/monolith/spec/slices/karte/repositories/event_repository_spec.rb
git commit -s -m "feat(dystopia/monolith): store a karte with its events and score a guest per cast"
```

---

### Task 3: Use cases

**Files:**
- Create: `dystopia/monolith/slices/karte/use_cases/present_kartes.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/load_own_karte.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/page_kartes.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/create_karte.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/get_karte.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/update_karte_rating.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/delete_karte.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/close_karte.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/reopen_karte.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/add_karte_event.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/update_karte_event.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/delete_karte_event.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/list_kartes_by_target.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/list_my_kartes.rb`
- Create: `dystopia/monolith/slices/karte/use_cases/list_recent_kartes.rb`
- Test: `dystopia/monolith/spec/slices/karte/use_cases/karte_lifecycle_spec.rb`
- Test: `dystopia/monolith/spec/slices/karte/use_cases/list_kartes_spec.rb`

**Interfaces:**
- Consumes: Task 1 の `Errors`・`Ids`・`ValidateEvent`・`AuthorizeCast`、Task 2 の 2 つの repository
- Produces（key は `use_cases.<file name>`。戻り値の「カルテ Hash」は下記）:
  - `CreateKarte#call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, event:) -> カルテ Hash`（`event` は `ValidateEvent#call` のキーワードと同じ Hash。`rating` は `nil` か 1〜5）
  - `GetKarte#call(viewer_account_id:, karte_id:) -> カルテ Hash`
  - `UpdateKarteRating#call(viewer_account_id:, karte_id:, rating:) -> カルテ Hash`
  - `DeleteKarte#call(viewer_account_id:, karte_id:) -> nil`
  - `CloseKarte#call(viewer_account_id:, karte_id:) -> カルテ Hash`
  - `ReopenKarte#call(viewer_account_id:, karte_id:) -> カルテ Hash`
  - `AddKarteEvent#call(viewer_account_id:, karte_id:, event:) -> カルテ Hash`
  - `UpdateKarteEvent#call(viewer_account_id:, event_id:, event:) -> カルテ Hash`
  - `DeleteKarteEvent#call(viewer_account_id:, event_id:) -> カルテ Hash`
  - `ListKartesByTarget#call(viewer_account_id:, target_profile_id:, limit:, cursor:) -> { kartes: Array<カルテ Hash>, next_cursor: String | nil, has_more: Boolean, reliability: { average_rating:, rater_count:, karte_count: } }`
  - `ListMyKartes#call(viewer_account_id:, limit:, cursor:)` / `ListRecentKartes#call(viewer_account_id:, limit:, cursor:) -> { kartes:, next_cursor:, has_more: }`
  - カルテ Hash: `{ id:, author_profile_id:, author_username:, author_avatar_url:, target_profile_id:, target_username:, target_avatar_url:, is_mine:, rating: (Integer | nil), status: ("open" | "closed"), events: Array<{ id:, stage:, outcome:, tags: Array<String>, note: (String | nil), occurred_on: Date, created_at:, updated_at: }>, created_at:, updated_at:, closed_at: (Time | nil) }`。ユーザー名・アバターがないときは `""`

- [ ] **Step 1: 失敗するテストを書く**

`dystopia/monolith/spec/slices/karte/use_cases/karte_lifecycle_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Karte lifecycle use cases", type: :database do
  def uc(name) = Karte::Slice["use_cases.#{name}"]

  let(:cast_account) { create_account(role: 2) }
  let(:persona_a) { create_account_with_profile(account_id: cast_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: cast_account, username: "persona_b") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:event_input) { { stage: "reservation", outcome: "booked", tags: %w[smooth_contact], note: "", occurred_on: "2026-10-01" } }

  def create(rating: nil, event: event_input, viewer: cast_account, profile: persona_a, target: guest)
    uc(:create_karte).call(viewer_account_id: viewer, viewer_profile_id: profile, target_profile_id: target, rating: rating, event: event)
  end

  def forbidden = raise_error(Karte::Errors::Forbidden)
  def invalid(message) = raise_error(Karte::Errors::Invalid, message)

  describe "creating" do
    it "opens a karte with its first event and presents the profiles" do
      karte = create

      expect(karte).to include(status: "open", rating: nil, is_mine: true, author_username: "persona_a", target_username: "guest_one", closed_at: nil)
      expect(karte[:events].map { |e| e.slice(:stage, :outcome, :tags, :note, :occurred_on) }).to eq([
        { stage: "reservation", outcome: "booked", tags: %w[smooth_contact], note: nil, occurred_on: Date.new(2026, 10, 1) }
      ])
    end

    it "takes an optional rating of 1..5" do
      expect(create(rating: 4)[:rating]).to eq(4)
      expect { create(rating: 6) }.to invalid("Rating must be 1..5")
    end

    it "refuses a guest viewer" do
      expect { create(viewer: guest_account, profile: guest) }.to forbidden
    end

    it "refuses a cast as the target and an id that is not a profile" do
      other_cast_profile = create_account_with_profile(account_id: other_cast_account, username: "other_cast")

      expect { create(target: other_cast_profile) }.to invalid("Target must be a guest")
      expect { create(target: "not-a-uuid") }.to invalid("Target must be a guest")
    end

    it "keeps nothing when the first event is invalid" do
      expect { create(event: event_input.merge(outcome: "completed")) }.to invalid("Unknown outcome for the stage")
      expect(Hanami.app["db.gateway"].connection[:karte__kartes].count).to eq(0)
    end
  end

  describe "reading" do
    it "lets any cast read a karte and marks whether it is theirs" do
      karte = create

      expect(uc(:get_karte).call(viewer_account_id: other_cast_account, karte_id: karte[:id])[:is_mine]).to be false
      expect(uc(:get_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])[:is_mine]).to be true
    end

    it "refuses a guest and reports an unknown or malformed id as not found" do
      karte = create

      expect { uc(:get_karte).call(viewer_account_id: guest_account, karte_id: karte[:id]) }.to forbidden
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: SecureRandom.uuid_v7) }.to invalid("Karte not found")
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: "abc") }.to invalid("Karte not found")
    end
  end

  describe "rating, closing and reopening" do
    it "changes and clears the rating while open" do
      karte = create(rating: 2)

      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 5)[:rating]).to eq(5)
      expect(uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: nil)[:rating]).to be_nil
    end

    it "requires a rating to close, then freezes the karte until it is reopened" do
      karte = create
      close = -> { uc(:close_karte).call(viewer_account_id: cast_account, karte_id: karte[:id]) }

      expect { close.call }.to invalid("Rating required to close")

      uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 4)
      closed = close.call
      expect(closed).to include(status: "closed", rating: 4)
      expect(closed[:closed_at]).not_to be_nil

      expect { uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 3) }.to invalid("Karte is closed")
      expect { uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_input) }.to invalid("Karte is closed")
      expect { close.call }.to invalid("Karte is closed")

      reopened = uc(:reopen_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])
      expect(reopened).to include(status: "open", rating: 4, closed_at: nil)
      expect { uc(:reopen_karte).call(viewer_account_id: cast_account, karte_id: karte[:id]) }.to invalid("Karte is open")
    end

    it "lets another profile of the author's account act and refuses another account" do
      karte = create(rating: 3)

      expect(uc(:close_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])[:status]).to eq("closed")
      expect { uc(:reopen_karte).call(viewer_account_id: other_cast_account, karte_id: karte[:id]) }.to forbidden
    end
  end

  describe "events" do
    it "adds, updates and deletes events while open, keeping at least one" do
      karte = create
      added = uc(:add_karte_event).call(
        viewer_account_id: cast_account, karte_id: karte[:id],
        event: { stage: "service", outcome: "ended_early", tags: %w[late], note: "途中で帰った", occurred_on: "2026-10-02" }
      )
      expect(added[:events].map { |e| e[:outcome] }).to eq(%w[booked ended_early])

      second = added[:events].last
      updated = uc(:update_karte_event).call(
        viewer_account_id: cast_account, event_id: second[:id],
        event: { stage: "service", outcome: "completed", tags: [], note: "", occurred_on: "2026-10-02" }
      )
      expect(updated[:events].last).to include(outcome: "completed", tags: [], note: nil)

      remaining = uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: second[:id])
      expect(remaining[:events].length).to eq(1)

      only = remaining[:events].first
      expect { uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: only[:id]) }.to invalid("A karte keeps at least one event")
    end

    it "places a backdated event before newer ones" do
      karte = create
      added = uc(:add_karte_event).call(
        viewer_account_id: cast_account, karte_id: karte[:id],
        event: { stage: "reservation", outcome: "inquiry_only", tags: [], note: "", occurred_on: "2026-09-20" }
      )

      expect(added[:events].map { |e| e[:occurred_on] }).to eq([Date.new(2026, 9, 20), Date.new(2026, 10, 1)])
    end

    it "refuses events of another account's karte and malformed event ids" do
      karte = create
      event_id = karte[:events].first[:id]

      expect { uc(:delete_karte_event).call(viewer_account_id: other_cast_account, event_id: event_id) }.to forbidden
      expect { uc(:update_karte_event).call(viewer_account_id: cast_account, event_id: "abc", event: event_input) }.to invalid("Event not found")
    end
  end

  describe "deleting" do
    it "lets the author delete in any state and refuses another account" do
      open_karte = create
      closed_karte = create(rating: 5)
      uc(:close_karte).call(viewer_account_id: cast_account, karte_id: closed_karte[:id])

      expect { uc(:delete_karte).call(viewer_account_id: other_cast_account, karte_id: open_karte[:id]) }.to forbidden
      expect(uc(:delete_karte).call(viewer_account_id: cast_account, karte_id: open_karte[:id])).to be_nil
      expect(uc(:delete_karte).call(viewer_account_id: cast_account, karte_id: closed_karte[:id])).to be_nil
      expect { uc(:get_karte).call(viewer_account_id: cast_account, karte_id: closed_karte[:id]) }.to invalid("Karte not found")
    end
  end
end
```

`dystopia/monolith/spec/slices/karte/use_cases/list_kartes_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Karte list use cases", type: :database do
  def uc(name) = Karte::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:cast_account) { create_account(role: 2) }
  let(:persona) { create_account_with_profile(account_id: cast_account, username: "persona") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:other_persona) { create_account_with_profile(account_id: other_cast_account, username: "other") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:event_input) { { stage: "service", outcome: "completed", tags: [], note: "", occurred_on: "2026-10-01" } }

  def write(account:, profile:, rating:, close: false, created_at: Time.now)
    karte = uc(:create_karte).call(viewer_account_id: account, viewer_profile_id: profile, target_profile_id: guest, rating: rating, event: event_input)
    uc(:close_karte).call(viewer_account_id: account, karte_id: karte[:id]) if close
    db[:karte__kartes].where(id: karte[:id]).update(created_at: created_at)
    karte
  end

  it "lists a guest's kartes with the reliability of the closed ones" do
    now = Time.now
    first = write(account: cast_account, profile: persona, rating: 5, close: true, created_at: now - 30)
    second = write(account: other_cast_account, profile: other_persona, rating: 3, close: true, created_at: now - 20)
    open_one = write(account: cast_account, profile: persona, rating: nil, created_at: now - 10)

    result = uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: guest, limit: 20, cursor: nil)

    expect(result[:kartes].map { |k| k[:id] }).to eq([open_one[:id], second[:id], first[:id]])
    expect(result[:kartes].first[:events].length).to eq(1)
    expect(result[:reliability]).to eq(average_rating: 4.0, rater_count: 2, karte_count: 2)
    expect(result[:has_more]).to be false
    expect(result[:next_cursor]).to be_nil
  end

  it "pages with a cursor" do
    now = Time.now
    older = write(account: cast_account, profile: persona, rating: nil, created_at: now - 20)
    newer = write(account: cast_account, profile: persona, rating: nil, created_at: now - 10)

    page = uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: guest, limit: 1, cursor: nil)
    expect(page[:kartes].map { |k| k[:id] }).to eq([newer[:id]])
    expect(page[:has_more]).to be true

    rest = uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: guest, limit: 1, cursor: page[:next_cursor])
    expect(rest[:kartes].map { |k| k[:id] }).to eq([older[:id]])
    expect(rest[:has_more]).to be false
  end

  it "uses 20 for a missing limit and 50 at most" do
    page = Karte::Slice["use_cases.page_kartes"]

    expect(page.limit_for(0)).to eq(20)
    expect(page.limit_for(-3)).to eq(20)
    expect(page.limit_for(7)).to eq(7)
    expect(page.limit_for(500)).to eq(50)
  end

  it "lists the viewer's own kartes across the account's profiles" do
    second_persona = create_account_with_profile(account_id: cast_account, username: "persona_two")
    mine = write(account: cast_account, profile: persona, rating: nil)
    also_mine = write(account: cast_account, profile: second_persona, rating: nil)
    write(account: other_cast_account, profile: other_persona, rating: nil)

    result = uc(:list_my_kartes).call(viewer_account_id: cast_account, limit: 20, cursor: nil)

    expect(result[:kartes].map { |k| k[:id] }).to contain_exactly(mine[:id], also_mine[:id])
  end

  it "lists recent kartes of every cast, open ones included" do
    open_karte = write(account: cast_account, profile: persona, rating: nil)
    closed_karte = write(account: other_cast_account, profile: other_persona, rating: 2, close: true)

    result = uc(:list_recent_kartes).call(viewer_account_id: other_cast_account, limit: 20, cursor: nil)

    expect(result[:kartes].map { |k| k[:id] }).to contain_exactly(open_karte[:id], closed_karte[:id])
  end

  it "refuses a guest viewer and a malformed target id" do
    expect { uc(:list_recent_kartes).call(viewer_account_id: guest_account, limit: 20, cursor: nil) }.to raise_error(Karte::Errors::Forbidden)
    expect { uc(:list_kartes_by_target).call(viewer_account_id: cast_account, target_profile_id: "abc", limit: 20, cursor: nil) }
      .to raise_error(Karte::Errors::Invalid, "Unknown profile")
  end
end
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/use_cases/karte_lifecycle_spec.rb spec/slices/karte/use_cases/list_kartes_spec.rb > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（`use_cases.create_karte` を解決できない）

- [ ] **Step 3: 共通の use case を実装する**

`dystopia/monolith/slices/karte/use_cases/present_kartes.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class PresentKartes
      include Karte::Deps[event_repo: "repositories.event_repository"]

      def initialize(get_profile: nil, media_adapter: nil, **deps)
        super(**deps)
        @get_profile = get_profile
        @media_adapter = media_adapter
      end

      def call(kartes:, viewer_account_id:)
        events = event_repo.list_for(kartes.map(&:id))
        profiles = {}
        kartes.map { |karte| present(karte, events.fetch(karte.id, []), profiles, viewer_account_id) }
      end

      private

      def present(karte, events, profiles, viewer_account_id)
        author = profile(profiles, karte.author_profile_id)
        target = profile(profiles, karte.target_profile_id)
        {
          id: karte.id,
          author_profile_id: karte.author_profile_id,
          author_username: author&.username || "",
          author_avatar_url: avatar_url(author),
          target_profile_id: karte.target_profile_id,
          target_username: target&.username || "",
          target_avatar_url: avatar_url(target),
          is_mine: karte.author_account_id == viewer_account_id,
          rating: karte.rating,
          status: karte.status,
          events: events.map { |event| present_event(event) },
          created_at: karte.created_at,
          updated_at: karte.updated_at,
          closed_at: karte.closed_at
        }
      end

      def present_event(event)
        {
          id: event.id,
          stage: event.stage,
          outcome: event.outcome,
          tags: event.tags.to_a,
          note: event.note,
          occurred_on: event.occurred_on,
          created_at: event.created_at,
          updated_at: event.updated_at
        }
      end

      def profile(profiles, profile_id)
        profiles.fetch(profile_id) { profiles[profile_id] = get_profile.call(profile_id: profile_id) }
      end

      def avatar_url(profile)
        return "" if profile.nil? || profile.avatar_media_id.nil?

        media_adapter.find_url(profile.avatar_media_id)
      end

      def get_profile
        @get_profile ||= ::Profile::Slice["use_cases.get_profile"]
      end

      def media_adapter
        @media_adapter ||= Karte::Adapters::MediaAdapter.new
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/load_own_karte.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class LoadOwnKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast"
      ]

      def call(viewer_account_id:, karte_id:, require_open: false)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        karte = Ids.valid?(karte_id) ? karte_repo.find(karte_id) : nil
        raise Errors::Invalid, "Karte not found" unless karte
        raise Errors::Forbidden, "Not the author" unless karte.author_account_id == viewer_account_id
        raise Errors::Invalid, "Karte is closed" if require_open && karte.status != "open"

        karte
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/page_kartes.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class PageKartes
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50

      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        present_kartes: "use_cases.present_kartes"
      ]

      def limit_for(raw)
        limit = raw.to_i
        limit <= 0 ? DEFAULT_LIMIT : [limit, MAX_LIMIT].min
      end

      def call(rows:, limit:, viewer_account_id:)
        has_more = rows.length > limit
        visible = rows.first(limit)
        {
          kartes: present_kartes.call(kartes: visible, viewer_account_id: viewer_account_id),
          next_cursor: has_more ? karte_repo.cursor_for(visible.last) : nil,
          has_more: has_more
        }
      end
    end
  end
end
```

- [ ] **Step 4: RPC ごとの use case を実装する**

`dystopia/monolith/slices/karte/use_cases/create_karte.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class CreateKarte
      ROLE_GUEST = 1

      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        authorize_cast: "use_cases.authorize_cast",
        validate_event: "use_cases.validate_event",
        present_kartes: "use_cases.present_kartes"
      ]

      def initialize(get_role: nil, **deps)
        super(**deps)
        @get_role = get_role
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, event:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)
        raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)
        raise Errors::Invalid, "Target must be a guest" unless guest?(target_profile_id)

        attrs = validate_event.call(**event)
        karte = nil
        karte_repo.transaction do
          karte = karte_repo.create(
            author_account_id: viewer_account_id,
            author_profile_id: viewer_profile_id,
            target_profile_id: target_profile_id,
            rating: rating
          )
          event_repo.create(karte_id: karte.id, **attrs)
        end
        present_kartes.call(kartes: [karte], viewer_account_id: viewer_account_id).first
      end

      private

      def guest?(profile_id)
        Ids.valid?(profile_id) && get_role.call(profile_id: profile_id) == ROLE_GUEST
      end

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/get_karte.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class GetKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        karte = Ids.valid?(karte_id) ? karte_repo.find(karte_id) : nil
        raise Errors::Invalid, "Karte not found" unless karte

        present_kartes.call(kartes: [karte], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/update_karte_rating.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateKarteRating
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:, rating:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, require_open: true)
        raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)

        updated = karte_repo.update_rating(karte.id, rating)
        present_kartes.call(kartes: [updated], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/delete_karte.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte"
      ]

      def call(viewer_account_id:, karte_id:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id)
        karte_repo.delete(karte.id)
        nil
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/close_karte.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class CloseKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, require_open: true)
        raise Errors::Invalid, "Rating required to close" if karte.rating.nil?

        closed = karte_repo.close(karte.id)
        present_kartes.call(kartes: [closed], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/reopen_karte.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class ReopenKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id)
        raise Errors::Invalid, "Karte is open" unless karte.status == "closed"

        reopened = karte_repo.reopen(karte.id)
        present_kartes.call(kartes: [reopened], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/add_karte_event.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class AddKarteEvent
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        load_own_karte: "use_cases.load_own_karte",
        validate_event: "use_cases.validate_event",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:, event:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, require_open: true)
        attrs = validate_event.call(**event)
        karte_repo.transaction do
          event_repo.create(karte_id: karte.id, **attrs)
          karte_repo.touch(karte.id)
        end
        present_kartes.call(kartes: [karte_repo.find(karte.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/update_karte_event.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateKarteEvent
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        load_own_karte: "use_cases.load_own_karte",
        validate_event: "use_cases.validate_event",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, event_id:, event:)
        record = Ids.valid?(event_id) ? event_repo.find(event_id) : nil
        raise Errors::Invalid, "Event not found" unless record

        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: record.karte_id, require_open: true)
        attrs = validate_event.call(**event)
        karte_repo.transaction do
          event_repo.update(record.id, **attrs)
          karte_repo.touch(karte.id)
        end
        present_kartes.call(kartes: [karte_repo.find(karte.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/delete_karte_event.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteKarteEvent
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, event_id:)
        record = Ids.valid?(event_id) ? event_repo.find(event_id) : nil
        raise Errors::Invalid, "Event not found" unless record

        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: record.karte_id, require_open: true)
        raise Errors::Invalid, "A karte keeps at least one event" if event_repo.count_for(karte.id) <= 1

        karte_repo.transaction do
          event_repo.delete(record.id)
          karte_repo.touch(karte.id)
        end
        present_kartes.call(kartes: [karte_repo.find(karte.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/list_kartes_by_target.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class ListKartesByTarget
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        page_kartes: "use_cases.page_kartes"
      ]

      def call(viewer_account_id:, target_profile_id:, limit:, cursor:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)
        raise Errors::Invalid, "Unknown profile" unless Ids.valid?(target_profile_id)

        limit = page_kartes.limit_for(limit)
        rows = karte_repo.list_by_target(target_profile_id: target_profile_id, limit: limit, cursor: cursor)
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id)
          .merge(reliability: karte_repo.reliability(target_profile_id: target_profile_id))
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/list_my_kartes.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class ListMyKartes
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        page_kartes: "use_cases.page_kartes"
      ]

      def call(viewer_account_id:, limit:, cursor:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        limit = page_kartes.limit_for(limit)
        rows = karte_repo.list_by_author(author_account_id: viewer_account_id, limit: limit, cursor: cursor)
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id)
      end
    end
  end
end
```

`dystopia/monolith/slices/karte/use_cases/list_recent_kartes.rb`:

```ruby
# frozen_string_literal: true

module Karte
  module UseCases
    class ListRecentKartes
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        page_kartes: "use_cases.page_kartes"
      ]

      def call(viewer_account_id:, limit:, cursor:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        limit = page_kartes.limit_for(limit)
        rows = karte_repo.list_recent(limit: limit, cursor: cursor)
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id)
      end
    end
  end
end
```

- [ ] **Step 5: テストが通ることを確認する**

Run: Step 2 と同じ
Expected: `0 failures`（lifecycle 13 件、list 6 件）。同じコマンドを 5 回繰り返し、毎回 `0 failures` であることを確かめる

- [ ] **Step 6: コミットする**

```bash
git add dystopia/monolith/slices/karte/use_cases dystopia/monolith/spec/slices/karte/use_cases/karte_lifecycle_spec.rb dystopia/monolith/spec/slices/karte/use_cases/list_kartes_spec.rb
git commit -s -m "feat(dystopia/monolith): run a karte from its first event through close and reopen"
```

`git add dystopia/monolith/slices/karte/use_cases` は既存の use case ファイルも含むが、このタスクでは既存ファイルを変更していないので、新規ファイルだけが stage される。`git status` で確かめる。

---

### Task 4: Proto, handler and removal of the old model

**Files:**
- Modify: `proto/dystopia/karte/v1/service.proto`（全面書き換え）
- Modify: `dystopia/monolith/stubs/karte/v1/service_pb.rb`, `service_services_pb.rb`（生成）
- Modify: `dystopia/monolith/slices/karte/grpc/karte_handler.rb`（全面書き換え）
- Create: `dystopia/monolith/config/db/migrate/20261016010000_drop_karte_entries_reports_and_access.rb`
- Modify: `dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb`
- Modify: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb`
- Modify: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb`
- Modify: `dystopia/monolith/config/db/seeds.rb`, `dystopia/monolith/spec/config/db/seeds_spec.rb`
- Delete: `dystopia/monolith/config/db/seeds/karte/access.rb`
- Delete: `dystopia/monolith/slices/karte/relations/entries.rb`, `reports.rb`, `access.rb`
- Delete: `dystopia/monolith/slices/karte/repositories/entry_repository.rb`, `report_repository.rb`, `access_repository.rb`
- Delete: `dystopia/monolith/slices/karte/use_cases/` の `authorize_cast_access.rb`・`create_entry.rb`・`update_entry.rb`・`delete_entry.rb`・`list_entries_by_target.rb`・`list_my_entries.rb`・`list_recent_entries.rb`・`report_entry.rb`・`get_my_access.rb`・`purge_account.rb`
- Delete: 上記に対応する `dystopia/monolith/spec/slices/karte/` の spec（`repositories/entry_repository_spec.rb` と `use_cases/` の 10 ファイル）
- Test: `dystopia/monolith/spec/slices/karte/grpc/karte_handler_spec.rb`（全面書き換え）

**Interfaces:**
- Consumes: Task 3 の use case（key と戻り値）
- Produces: proto の `karte.v1.KarteService`（下記）。Task 6 の frontend はこの proto から生成したスタブを使う

- [ ] **Step 1: proto を書き換え、monolith のスタブを生成する**

`proto/dystopia/karte/v1/service.proto` を次の内容にする。

```proto
syntax = "proto3";

package karte.v1;

import "google/protobuf/timestamp.proto";

service KarteService {
  rpc CreateKarte(CreateKarteRequest) returns (CreateKarteResponse);
  rpc GetKarte(GetKarteRequest) returns (GetKarteResponse);
  rpc UpdateKarteRating(UpdateKarteRatingRequest) returns (UpdateKarteRatingResponse);
  rpc DeleteKarte(DeleteKarteRequest) returns (DeleteKarteResponse);
  rpc CloseKarte(CloseKarteRequest) returns (CloseKarteResponse);
  rpc ReopenKarte(ReopenKarteRequest) returns (ReopenKarteResponse);
  rpc AddKarteEvent(AddKarteEventRequest) returns (AddKarteEventResponse);
  rpc UpdateKarteEvent(UpdateKarteEventRequest) returns (UpdateKarteEventResponse);
  rpc DeleteKarteEvent(DeleteKarteEventRequest) returns (DeleteKarteEventResponse);
  rpc ListKartesByTarget(ListKartesByTargetRequest) returns (ListKartesByTargetResponse);
  rpc ListMyKartes(ListMyKartesRequest) returns (ListMyKartesResponse);
  rpc ListRecentKartes(ListRecentKartesRequest) returns (ListRecentKartesResponse);
}

enum KarteStatus {
  KARTE_STATUS_UNSPECIFIED = 0;
  KARTE_STATUS_OPEN = 1;
  KARTE_STATUS_CLOSED = 2;
}

enum KarteStage {
  KARTE_STAGE_UNSPECIFIED = 0;
  KARTE_STAGE_RESERVATION = 1;
  KARTE_STAGE_SERVICE = 2;
  KARTE_STAGE_AFTERCARE = 3;
}

message KarteEventInput {
  KarteStage stage = 1;
  string outcome = 2;
  repeated string tags = 3;
  string note = 4;
  string occurred_on = 5;
}

message KarteEvent {
  string id = 1;
  KarteStage stage = 2;
  string outcome = 3;
  repeated string tags = 4;
  string note = 5;
  string occurred_on = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
}

message Karte {
  string id = 1;
  string author_profile_id = 2;
  string author_username = 3;
  string author_avatar_url = 4;
  string target_profile_id = 5;
  string target_username = 6;
  string target_avatar_url = 7;
  bool is_mine = 8;
  int32 rating = 9;
  KarteStatus status = 10;
  repeated KarteEvent events = 11;
  google.protobuf.Timestamp created_at = 12;
  google.protobuf.Timestamp updated_at = 13;
  google.protobuf.Timestamp closed_at = 14;
}

message ReliabilitySummary {
  double average_rating = 1;
  int32 rater_count = 2;
  int32 karte_count = 3;
}

message CreateKarteRequest {
  string target_profile_id = 1;
  int32 rating = 2;
  KarteEventInput event = 3;
}
message CreateKarteResponse { Karte karte = 1; }

message GetKarteRequest { string karte_id = 1; }
message GetKarteResponse { Karte karte = 1; }

message UpdateKarteRatingRequest {
  string karte_id = 1;
  int32 rating = 2;
}
message UpdateKarteRatingResponse { Karte karte = 1; }

message DeleteKarteRequest { string karte_id = 1; }
message DeleteKarteResponse {}

message CloseKarteRequest { string karte_id = 1; }
message CloseKarteResponse { Karte karte = 1; }

message ReopenKarteRequest { string karte_id = 1; }
message ReopenKarteResponse { Karte karte = 1; }

message AddKarteEventRequest {
  string karte_id = 1;
  KarteEventInput event = 2;
}
message AddKarteEventResponse { Karte karte = 1; }

message UpdateKarteEventRequest {
  string event_id = 1;
  KarteEventInput event = 2;
}
message UpdateKarteEventResponse { Karte karte = 1; }

message DeleteKarteEventRequest { string event_id = 1; }
message DeleteKarteEventResponse { Karte karte = 1; }

message ListKartesByTargetRequest {
  string target_profile_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
message ListKartesByTargetResponse {
  repeated Karte kartes = 1;
  string next_cursor = 2;
  bool has_more = 3;
  ReliabilitySummary reliability = 4;
}

message ListMyKartesRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListMyKartesResponse {
  repeated Karte kartes = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListRecentKartesRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListRecentKartesResponse {
  repeated Karte kartes = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

Run: `cd proto/dystopia && buf lint`
Expected: 出力なし

Run: `cd dystopia/monolith && rbenv exec bundle exec ruby bin/codegen && git status --short stubs`
Expected: `stubs/karte/v1/service_pb.rb` と `service_services_pb.rb` が変更される。`karte` 以外の stub に差分が出たら `git checkout -- stubs/<その package>` で戻す

- [ ] **Step 2: 旧モデルを削除する**

```bash
cd dystopia/monolith
git rm slices/karte/relations/entries.rb slices/karte/relations/reports.rb slices/karte/relations/access.rb
git rm slices/karte/repositories/entry_repository.rb slices/karte/repositories/report_repository.rb slices/karte/repositories/access_repository.rb
git rm slices/karte/use_cases/authorize_cast_access.rb slices/karte/use_cases/create_entry.rb slices/karte/use_cases/update_entry.rb slices/karte/use_cases/delete_entry.rb slices/karte/use_cases/list_entries_by_target.rb slices/karte/use_cases/list_my_entries.rb slices/karte/use_cases/list_recent_entries.rb slices/karte/use_cases/report_entry.rb slices/karte/use_cases/get_my_access.rb slices/karte/use_cases/purge_account.rb
git rm spec/slices/karte/repositories/entry_repository_spec.rb
git rm spec/slices/karte/use_cases/authorize_cast_access_spec.rb spec/slices/karte/use_cases/create_entry_spec.rb spec/slices/karte/use_cases/update_entry_spec.rb spec/slices/karte/use_cases/delete_entry_spec.rb spec/slices/karte/use_cases/list_entries_by_target_spec.rb spec/slices/karte/use_cases/list_my_entries_spec.rb spec/slices/karte/use_cases/list_recent_entries_spec.rb spec/slices/karte/use_cases/report_entry_spec.rb spec/slices/karte/use_cases/get_my_access_spec.rb spec/slices/karte/use_cases/purge_account_spec.rb
git rm config/db/seeds/karte/access.rb
```

`dystopia/monolith/config/db/migrate/20261016010000_drop_karte_entries_reports_and_access.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"karte__reports", cascade: true
    drop_table :"karte__entries", cascade: true
    drop_table :"karte__access", cascade: true
  end

  down do
    raise Sequel::Error, "irreversible: karte entries, reports and access are not restored"
  end
end
```

`dystopia/monolith/config/db/seeds.rb` から次の 2 行（`require_relative "seeds/karte/access"` とその直後の空行）を削除する。

```ruby
require_relative "seeds/karte/access"

```

`dystopia/monolith/spec/config/db/seeds_spec.rb` の `seeded_tables` から `karte__access` を削除する（`identity__accounts profile__profiles profile__casts karte__access` の行を `identity__accounts profile__profiles profile__casts` にする）。

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec hanami db migrate`
Expected: 旧 3 表が削除される（最後の `pg_dump` のエラーは Task 2 と同じく無視してよい）。`git status` に `config/db/structure.sql` が出たら `git checkout -- config/db/structure.sql`

- [ ] **Step 3: 退会処理からカルテを外す**

`dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb` を次の内容にする。

```ruby
# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(purge_profiles: nil, **kwargs)
          super(**kwargs)
          @purge_profiles = purge_profiles
        end

        # Raises on the first failure so the account stays deactivated and the next run repeats the purge.
        def call(sub:)
          purge_profiles.call(account_id: sub)
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end

        private

        def purge_profiles
          @purge_profiles ||= ::Profile::Slice["use_cases.purge_account"]
        end
      end
    end
  end
end
```

`dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb` を次の内容にする。

```ruby
# frozen_string_literal: true

require "spec_helper"
require "cognito"

RSpec.describe Identity::UseCases::Account::PurgeIdentity do
  let(:use_case) do
    described_class.new(account_repo: account_repo, purge_profiles: purge_profiles)
  end
  let(:account_repo) { double(:account_repository) }
  let(:purge_profiles) { double(:purge_profiles) }
  let(:sub) { "sub-purge-1" }
  let(:cognito_adapter) { double(:cognito_adapter, admin_delete_user: true) }

  before do
    Cognito.reset!
    Cognito.adapter = cognito_adapter
    allow(purge_profiles).to receive(:call)
    allow(account_repo).to receive(:delete).with(sub)
  end

  after { Cognito.reset! }

  it "purges the account's profiles, then the Cognito user, then the account" do
    expect(purge_profiles).to receive(:call).with(account_id: sub).ordered
    expect(cognito_adapter).to receive(:admin_delete_user).with(sub: sub).ordered
    expect(account_repo).to receive(:delete).with(sub).ordered

    expect(use_case.call(sub: sub)).to be_nil
  end

  it "keeps the account when deleting the Cognito user fails" do
    allow(cognito_adapter).to receive(:admin_delete_user).and_raise(RuntimeError, "cognito failed")
    expect(account_repo).not_to receive(:delete)

    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "cognito failed")
  end

  it "keeps the Cognito user and the account when purging the profiles fails" do
    allow(purge_profiles).to receive(:call).and_raise(RuntimeError, "slice failed")
    expect(cognito_adapter).not_to receive(:admin_delete_user)
    expect(account_repo).not_to receive(:delete)

    expect { use_case.call(sub: sub) }.to raise_error(RuntimeError, "slice failed")
  end
end
```

`dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb` を次のとおり変更する。

1. `let(:access_repo) { Karte::Slice["repositories.access_repository"] }` の行を削除する
2. 44〜58 行目の、閲覧権の付与（`access_repo.grant` の 2 行）と、`entry_repo`・`report_repo`・`reported_entry`・`own_entry` を作る行（`entry_repo = ...` から `report_repo.create(entry_id: own_entry.id, ...)` まで）を、次の 4 行に置き換える

```ruby
    own_karte = Karte::Slice["repositories.karte_repository"].create(
      author_account_id: account_id, author_profile_id: persona_a,
      target_profile_id: SecureRandom.uuid_v7, rating: nil
    )
```

3. 123〜126 行目の `karte__access`・`karte__reports`・`karte__entries` の 4 つの expect を、次の 1 行に置き換える

```ruby
    expect(db[:karte__kartes].where(id: own_karte.id).count).to eq(1)
```

4. 146 行目の `expect(db[:karte__access].where(account_id: bystander_account_id).count).to eq(1)` を削除する

行番号は変更前のファイルのもの。`grep -n "karte" spec/slices/identity/use_cases/account/purge_wiring_spec.rb` で、変更後に残る karte の参照が `own_karte` を作る 4 行と expect の 1 行だけであることを確かめる。

- [ ] **Step 4: handler の失敗するテストを書く**

`dystopia/monolith/spec/slices/karte/grpc/karte_handler_spec.rb` を次の内容にする。

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/karte/grpc/karte_handler"

RSpec.describe Karte::Grpc::KarteHandler, type: :database do
  let(:cast_account) { create_account(role: 2) }
  let(:persona_a) { create_account_with_profile(account_id: cast_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: cast_account, username: "persona_b") }
  let(:other_cast_account) { create_account(role: 2) }
  let(:other_persona) { create_account_with_profile(account_id: other_cast_account, username: "other_cast") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }

  let(:booked) do
    ::Karte::V1::KarteEventInput.new(stage: :KARTE_STAGE_RESERVATION, outcome: "booked", tags: ["smooth_contact"], note: "", occurred_on: "2026-10-01")
  end

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

  def create_karte(rating: 0, event: booked, target: guest)
    handler_for(::Karte::V1::CreateKarteRequest.new(target_profile_id: target, rating: rating, event: event)).create_karte.karte
  end

  after { Current.clear }

  describe "#create_karte" do
    it "returns the open karte with its first event and the acting profile as the author" do
      act_as(cast_account, persona_a)

      karte = create_karte

      expect(karte.status).to eq(:KARTE_STATUS_OPEN)
      expect(karte.rating).to eq(0)
      expect(karte.author_profile_id).to eq(persona_a)
      expect(karte.author_username).to eq("persona_a")
      expect(karte.target_username).to eq("guest_one")
      expect(karte.is_mine).to be true
      expect(karte.closed_at).to be_nil
      event = karte.events.first
      expect([event.stage, event.outcome, event.tags.to_a, event.note, event.occurred_on]).to eq([:KARTE_STAGE_RESERVATION, "booked", ["smooth_contact"], "", "2026-10-01"])
    end

    it "keeps a rating given at creation" do
      act_as(cast_account, persona_a)

      expect(create_karte(rating: 4).rating).to eq(4)
    end

    it "refuses a guest viewer with PERMISSION_DENIED" do
      act_as(guest_account, guest)

      expect { create_karte }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end

    it "rejects a cast target, an unknown stage and a missing event with INVALID_ARGUMENT" do
      act_as(cast_account, persona_a)

      expect { create_karte(target: other_persona) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect { create_karte(event: ::Karte::V1::KarteEventInput.new(outcome: "booked", occurred_on: "2026-10-01")) }
        .to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect { handler_for(::Karte::V1::CreateKarteRequest.new(target_profile_id: guest)).create_karte }
        .to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "the lifecycle RPCs" do
    it "rates, closes, reopens and reads a karte" do
      act_as(cast_account, persona_a)
      id = create_karte.id

      expect { handler_for(::Karte::V1::CloseKarteRequest.new(karte_id: id)).close_karte }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)

      rated = handler_for(::Karte::V1::UpdateKarteRatingRequest.new(karte_id: id, rating: 5)).update_karte_rating.karte
      expect(rated.rating).to eq(5)

      closed = handler_for(::Karte::V1::CloseKarteRequest.new(karte_id: id)).close_karte.karte
      expect(closed.status).to eq(:KARTE_STATUS_CLOSED)
      expect(closed.closed_at).not_to be_nil

      reopened = handler_for(::Karte::V1::ReopenKarteRequest.new(karte_id: id)).reopen_karte.karte
      expect(reopened.status).to eq(:KARTE_STATUS_OPEN)

      act_as(other_cast_account, other_persona)
      read = handler_for(::Karte::V1::GetKarteRequest.new(karte_id: id)).get_karte.karte
      expect(read.is_mine).to be false
      expect { handler_for(::Karte::V1::ReopenKarteRequest.new(karte_id: id)).reopen_karte }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end

    it "clears the rating with 0 while open" do
      act_as(cast_account, persona_a)
      id = create_karte(rating: 3).id

      expect(handler_for(::Karte::V1::UpdateKarteRatingRequest.new(karte_id: id, rating: 0)).update_karte_rating.karte.rating).to eq(0)
    end

    it "lets another profile of the same account act on the karte" do
      act_as(cast_account, persona_a)
      id = create_karte(rating: 2).id

      act_as(cast_account, persona_b)
      expect(handler_for(::Karte::V1::CloseKarteRequest.new(karte_id: id)).close_karte.karte.status).to eq(:KARTE_STATUS_CLOSED)
    end

    it "adds, updates and deletes events and deletes the karte" do
      act_as(cast_account, persona_a)
      id = create_karte.id
      service = ::Karte::V1::KarteEventInput.new(stage: :KARTE_STAGE_SERVICE, outcome: "completed", tags: ["late"], note: "遅刻", occurred_on: "2026-10-02")

      added = handler_for(::Karte::V1::AddKarteEventRequest.new(karte_id: id, event: service)).add_karte_event.karte
      expect(added.events.map(&:stage)).to eq(%i[KARTE_STAGE_RESERVATION KARTE_STAGE_SERVICE])

      event_id = added.events.last.id
      aftercare = ::Karte::V1::KarteEventInput.new(stage: :KARTE_STAGE_AFTERCARE, outcome: "polite_contact_missing", occurred_on: "2026-10-03")
      expect { handler_for(::Karte::V1::UpdateKarteEventRequest.new(event_id: event_id, event: aftercare)).update_karte_event }
        .to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)

      remaining = handler_for(::Karte::V1::DeleteKarteEventRequest.new(event_id: event_id)).delete_karte_event.karte
      expect(remaining.events.length).to eq(1)

      handler_for(::Karte::V1::DeleteKarteRequest.new(karte_id: id)).delete_karte
      expect { handler_for(::Karte::V1::GetKarteRequest.new(karte_id: id)).get_karte }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "reports a malformed id as INVALID_ARGUMENT" do
      act_as(cast_account, persona_a)

      expect { handler_for(::Karte::V1::GetKarteRequest.new(karte_id: "abc")).get_karte }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
      expect { handler_for(::Karte::V1::DeleteKarteEventRequest.new(event_id: "abc")).delete_karte_event }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "the list RPCs" do
    it "lists by target with the reliability, and lists mine and recent ones" do
      act_as(cast_account, persona_a)
      rated = create_karte(rating: 4).id
      handler_for(::Karte::V1::CloseKarteRequest.new(karte_id: rated)).close_karte
      open_id = create_karte.id

      by_target = handler_for(::Karte::V1::ListKartesByTargetRequest.new(target_profile_id: guest)).list_kartes_by_target
      expect(by_target.kartes.map(&:id)).to contain_exactly(rated, open_id)
      expect([by_target.reliability.average_rating, by_target.reliability.rater_count, by_target.reliability.karte_count]).to eq([4.0, 1, 1])
      expect(by_target.has_more).to be false
      expect(by_target.next_cursor).to eq("")

      expect(handler_for(::Karte::V1::ListMyKartesRequest.new).list_my_kartes.kartes.map(&:id)).to contain_exactly(rated, open_id)

      act_as(other_cast_account, other_persona)
      expect(handler_for(::Karte::V1::ListRecentKartesRequest.new).list_recent_kartes.kartes.map(&:id)).to contain_exactly(rated, open_id)
      expect(handler_for(::Karte::V1::ListMyKartesRequest.new).list_my_kartes.kartes).to be_empty
    end

    it "refuses a guest viewer" do
      act_as(guest_account, guest)

      expect { handler_for(::Karte::V1::ListRecentKartesRequest.new).list_recent_kartes }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
    end
  end
end
```

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/grpc/karte_handler_spec.rb > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（handler に `create_karte` がない、または旧 use case の key を解決できない）

- [ ] **Step 5: handler を書き換える**

`dystopia/monolith/slices/karte/grpc/karte_handler.rb` を次の内容にする。

```ruby
# frozen_string_literal: true

require "karte/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Karte
  module Grpc
    class KarteHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "karte.v1.KarteService"

      bind ::Karte::V1::KarteService::Service

      self.rpc_descs.clear

      rpc :CreateKarte,        ::Karte::V1::CreateKarteRequest,        ::Karte::V1::CreateKarteResponse
      rpc :GetKarte,           ::Karte::V1::GetKarteRequest,           ::Karte::V1::GetKarteResponse
      rpc :UpdateKarteRating,  ::Karte::V1::UpdateKarteRatingRequest,  ::Karte::V1::UpdateKarteRatingResponse
      rpc :DeleteKarte,        ::Karte::V1::DeleteKarteRequest,        ::Karte::V1::DeleteKarteResponse
      rpc :CloseKarte,         ::Karte::V1::CloseKarteRequest,         ::Karte::V1::CloseKarteResponse
      rpc :ReopenKarte,        ::Karte::V1::ReopenKarteRequest,        ::Karte::V1::ReopenKarteResponse
      rpc :AddKarteEvent,      ::Karte::V1::AddKarteEventRequest,      ::Karte::V1::AddKarteEventResponse
      rpc :UpdateKarteEvent,   ::Karte::V1::UpdateKarteEventRequest,   ::Karte::V1::UpdateKarteEventResponse
      rpc :DeleteKarteEvent,   ::Karte::V1::DeleteKarteEventRequest,   ::Karte::V1::DeleteKarteEventResponse
      rpc :ListKartesByTarget, ::Karte::V1::ListKartesByTargetRequest, ::Karte::V1::ListKartesByTargetResponse
      rpc :ListMyKartes,       ::Karte::V1::ListMyKartesRequest,       ::Karte::V1::ListMyKartesResponse
      rpc :ListRecentKartes,   ::Karte::V1::ListRecentKartesRequest,   ::Karte::V1::ListRecentKartesResponse

      STAGE_TO_PROTO = {
        "reservation" => :KARTE_STAGE_RESERVATION,
        "service" => :KARTE_STAGE_SERVICE,
        "aftercare" => :KARTE_STAGE_AFTERCARE
      }.freeze
      STAGE_FROM_PROTO = STAGE_TO_PROTO.invert.freeze
      STATUS_TO_PROTO = { "open" => :KARTE_STATUS_OPEN, "closed" => :KARTE_STATUS_CLOSED }.freeze

      include Karte::Deps[
        create_karte_uc: "use_cases.create_karte",
        get_karte_uc: "use_cases.get_karte",
        update_karte_rating_uc: "use_cases.update_karte_rating",
        delete_karte_uc: "use_cases.delete_karte",
        close_karte_uc: "use_cases.close_karte",
        reopen_karte_uc: "use_cases.reopen_karte",
        add_karte_event_uc: "use_cases.add_karte_event",
        update_karte_event_uc: "use_cases.update_karte_event",
        delete_karte_event_uc: "use_cases.delete_karte_event",
        list_kartes_by_target_uc: "use_cases.list_kartes_by_target",
        list_my_kartes_uc: "use_cases.list_my_kartes",
        list_recent_kartes_uc: "use_cases.list_recent_kartes"
      ]

      def create_karte
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          create_karte_uc.call(
            viewer_account_id: current_account_id,
            viewer_profile_id: current_profile_id,
            target_profile_id: message.target_profile_id,
            rating: rating_from(message.rating),
            event: event_from(message.event)
          )
        end
        ::Karte::V1::CreateKarteResponse.new(karte: karte_to_proto(karte))
      end

      def get_karte
        authenticate_user!
        karte = wrap_errors { get_karte_uc.call(viewer_account_id: current_account_id, karte_id: request.message.karte_id) }
        ::Karte::V1::GetKarteResponse.new(karte: karte_to_proto(karte))
      end

      def update_karte_rating
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          update_karte_rating_uc.call(viewer_account_id: current_account_id, karte_id: message.karte_id, rating: rating_from(message.rating))
        end
        ::Karte::V1::UpdateKarteRatingResponse.new(karte: karte_to_proto(karte))
      end

      def delete_karte
        authenticate_user!
        wrap_errors { delete_karte_uc.call(viewer_account_id: current_account_id, karte_id: request.message.karte_id) }
        ::Karte::V1::DeleteKarteResponse.new
      end

      def close_karte
        authenticate_user!
        karte = wrap_errors { close_karte_uc.call(viewer_account_id: current_account_id, karte_id: request.message.karte_id) }
        ::Karte::V1::CloseKarteResponse.new(karte: karte_to_proto(karte))
      end

      def reopen_karte
        authenticate_user!
        karte = wrap_errors { reopen_karte_uc.call(viewer_account_id: current_account_id, karte_id: request.message.karte_id) }
        ::Karte::V1::ReopenKarteResponse.new(karte: karte_to_proto(karte))
      end

      def add_karte_event
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          add_karte_event_uc.call(viewer_account_id: current_account_id, karte_id: message.karte_id, event: event_from(message.event))
        end
        ::Karte::V1::AddKarteEventResponse.new(karte: karte_to_proto(karte))
      end

      def update_karte_event
        authenticate_user!
        message = request.message
        karte = wrap_errors do
          update_karte_event_uc.call(viewer_account_id: current_account_id, event_id: message.event_id, event: event_from(message.event))
        end
        ::Karte::V1::UpdateKarteEventResponse.new(karte: karte_to_proto(karte))
      end

      def delete_karte_event
        authenticate_user!
        karte = wrap_errors { delete_karte_event_uc.call(viewer_account_id: current_account_id, event_id: request.message.event_id) }
        ::Karte::V1::DeleteKarteEventResponse.new(karte: karte_to_proto(karte))
      end

      def list_kartes_by_target
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_kartes_by_target_uc.call(
            viewer_account_id: current_account_id,
            target_profile_id: message.target_profile_id,
            limit: message.limit,
            cursor: cursor_from(message.cursor)
          )
        end
        reliability = result[:reliability]
        ::Karte::V1::ListKartesByTargetResponse.new(
          **page_to_proto(result),
          reliability: ::Karte::V1::ReliabilitySummary.new(
            average_rating: reliability[:average_rating],
            rater_count: reliability[:rater_count],
            karte_count: reliability[:karte_count]
          )
        )
      end

      def list_my_kartes
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_my_kartes_uc.call(viewer_account_id: current_account_id, limit: message.limit, cursor: cursor_from(message.cursor))
        end
        ::Karte::V1::ListMyKartesResponse.new(**page_to_proto(result))
      end

      def list_recent_kartes
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_recent_kartes_uc.call(viewer_account_id: current_account_id, limit: message.limit, cursor: cursor_from(message.cursor))
        end
        ::Karte::V1::ListRecentKartesResponse.new(**page_to_proto(result))
      end

      private

      def wrap_errors
        yield
      rescue Karte::Errors::Forbidden => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Karte::Errors::Invalid => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      end

      def rating_from(value)
        value.zero? ? nil : value
      end

      def cursor_from(value)
        value.empty? ? nil : value
      end

      def event_from(input)
        input ||= ::Karte::V1::KarteEventInput.new
        {
          stage: STAGE_FROM_PROTO[input.stage],
          outcome: input.outcome,
          tags: input.tags.to_a,
          note: input.note,
          occurred_on: input.occurred_on
        }
      end

      def page_to_proto(result)
        {
          kartes: result[:kartes].map { |karte| karte_to_proto(karte) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        }
      end

      def karte_to_proto(karte)
        ::Karte::V1::Karte.new(
          id: karte[:id],
          author_profile_id: karte[:author_profile_id],
          author_username: karte[:author_username],
          author_avatar_url: karte[:author_avatar_url],
          target_profile_id: karte[:target_profile_id],
          target_username: karte[:target_username],
          target_avatar_url: karte[:target_avatar_url],
          is_mine: karte[:is_mine],
          rating: karte[:rating] || 0,
          status: STATUS_TO_PROTO.fetch(karte[:status]),
          events: karte[:events].map { |event| event_to_proto(event) },
          created_at: timestamp(karte[:created_at]),
          updated_at: timestamp(karte[:updated_at]),
          closed_at: timestamp(karte[:closed_at])
        )
      end

      def event_to_proto(event)
        ::Karte::V1::KarteEvent.new(
          id: event[:id],
          stage: STAGE_TO_PROTO.fetch(event[:stage]),
          outcome: event[:outcome],
          tags: event[:tags],
          note: event[:note] || "",
          occurred_on: event[:occurred_on].iso8601,
          created_at: timestamp(event[:created_at]),
          updated_at: timestamp(event[:updated_at])
        )
      end

      def timestamp(time)
        return nil unless time

        ::Google::Protobuf::Timestamp.new(seconds: time.to_i, nanos: time.nsec)
      end
    end
  end
end
```

- [ ] **Step 6: monolith 全体のテストが通ることを確認する**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte spec/slices/identity spec/config > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: `0 failures`

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/karte-rspec.txt 2>&1; grep -E '^[0-9]+ examples' /tmp/karte-rspec.txt`
Expected: `N examples, 0 failures`

Run: `cd dystopia/monolith && /usr/bin/grep -rnE 'entry_repository|report_repository|access_repository|authorize_cast_access|get_my_access|karte__entries|karte__reports|karte__access|KarteEntry\b|ReportEntry|GetMyAccess' slices spec config lib --include=*.rb | /usr/bin/grep -v 'config/db/migrate/'`
Expected: 出力なし（`Review::Slice["repositories.entry_repository"]` のように review slice の `entry_repository` が出た場合は karte と無関係なので無視する）

- [ ] **Step 7: コミットする**

```bash
cd ../..
git add proto/dystopia/karte/v1/service.proto dystopia/monolith/stubs/karte dystopia/monolith/slices/karte dystopia/monolith/spec/slices/karte dystopia/monolith/config/db/migrate/20261016010000_drop_karte_entries_reports_and_access.rb dystopia/monolith/config/db/seeds.rb dystopia/monolith/spec/config/db/seeds_spec.rb dystopia/monolith/slices/identity/use_cases/account/purge_identity.rb dystopia/monolith/spec/slices/identity/use_cases/account/purge_identity_spec.rb dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb
git status --short
git commit -s -m "feat(dystopia): serve the karte lifecycle over gRPC and drop entries, reports and access"
```

`git status --short` で、`dystopia/monolith/stubs` の `karte` 以外や `config/db/structure.sql` が stage されていないことを確かめてから commit する。

---

### Task 5: Cast check in place of karte access

**Files**（パスは `dystopia/frontend/` から）:
- Modify: `src/components/shell/resolveNavItems.ts`, `resolveNavItems.test.ts`
- Modify: `src/components/shell/SideNav.tsx`, `SideNav.test.tsx`
- Modify: `src/components/shell/Drawer.tsx`, `Drawer.test.tsx`
- Modify: `src/components/shell/BottomTab.tsx`, `BottomTab.test.tsx`
- Modify: `src/components/shell/AppShell.recovery.test.tsx`
- Modify: `src/components/compose/resolveComposeKinds.ts`, `resolveComposeKinds.test.ts`
- Modify: `src/components/compose/ComposeLauncher.tsx`, `ComposeLauncher.test.tsx`
- Modify: `src/app/page.tsx`, `src/app/page.test.tsx`, `src/app/page.feed-fetch.test.tsx`
- Modify: `src/app/u/[username]/page.tsx`, `src/app/u/[username]/page.test.tsx`
- Modify: `src/app/karte/my/page.tsx`, `src/app/karte/my/page.test.tsx`
- Modify: `src/modules/karte/hooks/index.ts`
- Delete: `src/modules/karte/hooks/useMyKarteAccess.ts`, `useMyKarteAccess.test.ts`, `src/app/api/karte/access/route.ts`

**Interfaces:**
- Consumes: `useAuthStore`・`selectRole`（`@/stores/authStore`）、`Role`（`@/lib/auth`、`"guest" | "cast"`）
- Produces: `resolveNavItems({ role: Role | null }): NavItem[]`、`resolveComposeKinds({ role: Role | null }): ComposeKind[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/shell/resolveNavItems.test.ts` を次の内容にする。

```ts
import { describe, expect, it } from "vitest";
import { PROFILE_NAV_PATH, resolveNavItems } from "./resolveNavItems";

const paths = (role: "cast" | "guest" | null) => resolveNavItems({ role }).map((item) => item.path);

describe("resolveNavItems", () => {
  it("orders the entries from home down to settings", () => {
    expect(paths(null)).toEqual([
      "/",
      "/search",
      "/notifications",
      "/messages",
      "/footprints",
      "/bookmarks",
      "/ranking",
      PROFILE_NAV_PATH,
      "/settings",
    ]);
  });

  it("places my karte above the profile and settings entries for a cast", () => {
    const result = paths("cast");

    expect(result.slice(-3)).toEqual(["/karte/my", PROFILE_NAV_PATH, "/settings"]);
    expect(result).not.toContain("/reviews/my");
  });

  it("places my reviews above the profile and settings entries for a guest", () => {
    const result = paths("guest");

    expect(result.slice(-3)).toEqual(["/reviews/my", PROFILE_NAV_PATH, "/settings"]);
    expect(result).not.toContain("/karte/my");
  });
});
```

`src/components/compose/resolveComposeKinds.test.ts` を次の内容にする。

```ts
import { describe, expect, it } from "vitest";
import { resolveComposeKinds } from "./resolveComposeKinds";

describe("resolveComposeKinds", () => {
  it("offers a guest a post, a message and a review", () => {
    expect(resolveComposeKinds({ role: "guest" })).toEqual(["post", "message", "review"]);
  });

  it("offers a cast a post, a message and a karte", () => {
    expect(resolveComposeKinds({ role: "cast" })).toEqual(["post", "message", "karte"]);
  });

  it("offers only a post before the role is known", () => {
    expect(resolveComposeKinds({ role: null })).toEqual(["post"]);
  });
});
```

`src/components/shell/SideNav.test.tsx`:

1. `const karteMocks = vi.hoisted(...)` の 3 行と、`vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)` の 3 行を削除する
2. `karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });` をすべて `authState.role = null;` に、`karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });` をすべて `authState.role = "cast";` に置き換える
3. テスト名 `"links to my karte when the viewer has karte access"` を `"links to my karte for a cast viewer"` に、`"hides the karte item when the viewer has no karte access"` を `"hides the karte item before the role is known"` にする

`src/components/shell/Drawer.test.tsx`:

1. `const karteMocks = vi.hoisted(...)` の 3 行と、`vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)` の 3 行を削除する
2. `const { emptyProfileView } = await import("@/modules/profile/lib/mappers");` の次の行に `const { useAuthStore } = await import("@/stores/authStore");` を追加する
3. `karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });` をすべて `useAuthStore.setState({ role: null });` に、`{ hasAccess: true }` の行をすべて `useAuthStore.setState({ role: "cast" });` に置き換える
4. テスト名 `"links to my karte when the viewer has karte access"` を `"links to my karte for a cast viewer"` に、`"hides the karte item when the viewer has no karte access"` を `"hides the karte item before the role is known"` にする

`src/components/shell/BottomTab.test.tsx`:

1. `const karteMocks = vi.hoisted(...)` の 3 行、`vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)` の 3 行、`karteMocks.useMyKarteAccess.mockReturnValue(...)` の行をすべて削除する
2. テスト名 `"hides both the karte and review tabs without access or a resolved role"` を `"hides both the karte and review tabs before the role is known"` にする

`src/components/shell/AppShell.recovery.test.tsx` から、`const { useMyKarteAccess } = await import("@/modules/karte/hooks/useMyKarteAccess");` の行と `useMyKarteAccess();` の行を削除する。

`src/components/compose/ComposeLauncher.test.tsx`:

1. `const mocks = vi.hoisted(() => ({ role: "cast" as "cast" | "guest" | null, karteAccess: true }));` を `const mocks = vi.hoisted(() => ({ role: "cast" as "cast" | "guest" | null }));` にする
2. `vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)` の行を削除し、`mocks.karteAccess = ...;` の行をすべて削除する
3. テスト名 `"offers a cast with karte access a post, a message and a karte entry"` を `"offers a cast a post, a message and a karte"` にする

`src/app/page.test.tsx`:

1. `karteAccessMocks` の 2 行（`const karteAccessMocks = ...` と `vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)`）を次に置き換える

```tsx
const authMocks = vi.hoisted(() => ({ role: null as "cast" | "guest" | null }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string | null }) => unknown) => selector({ role: authMocks.role }),
  selectRole: (state: { role: string | null }) => state.role,
}));
```

2. `karteAccessMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });` を `authMocks.role = "cast";` に、`{ hasAccess: false }` の行を `authMocks.role = "guest";` に置き換える
3. テスト名を `"shows the karte tab to a cast"` と `"hides the karte tab from a guest but keeps the review tab"` にする

`src/app/page.feed-fetch.test.tsx` から `vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)` の行を削除する。

`src/app/u/[username]/page.test.tsx`:

1. `mocks` の `karteAccess: false,` を `viewerRole: "guest" as "cast" | "guest",` にする
2. `vi.mock("@/stores/authStore", ...)` を次にする

```tsx
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector?: (state: { activeProfileId: string; role: string }) => unknown) => {
    const state = { activeProfileId: "viewer-1", role: mocks.viewerRole };
    return selector ? selector(state) : state;
  },
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
  selectRole: (state: { role: string }) => state.role,
}));
```

3. `vi.mock("@/modules/karte/hooks/useMyKarteAccess", ...)` の 3 行を削除する
4. `mocks.karteAccess = true;` を `mocks.viewerRole = "cast";` に、`mocks.karteAccess = false;` を `mocks.viewerRole = "guest";` に置き換える
5. `describe("PublicProfilePage karte tab visibility")` の 3 つのテスト名を、順に `"shows the karte tab on a guest profile to a cast"`、`"hides the karte tab on a guest profile from a guest"`、`"hides the karte tab on a cast profile even from a cast"` にする

`src/app/karte/my/page.test.tsx` を次の内容にする。

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMocks = vi.hoisted(() => ({ role: "guest" as "cast" | "guest" | null }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string | null }) => unknown) => selector({ role: authMocks.role }),
  selectRole: (state: { role: string | null }) => state.role,
}));
vi.mock("@/modules/karte/hooks/useMyKarte", () => ({
  useMyKarte: () => ({ entries: [], kartes: [], hasMore: false, loading: false, loadMore: vi.fn(), refresh: vi.fn() }),
}));

const { default: MyKartePage, MyKarteHeader } = await import("./page");

describe("MyKarteHeader", () => {
  it("renders a description of what this page is", () => {
    const html = renderToStaticMarkup(<MyKarteHeader />);

    expect(html).toContain("自分のカルテ");
    expect(html).toContain("ゲストについて書いたレビューの管理・共有");
  });
});

describe("MyKartePage", () => {
  it("tells a guest that karte is for casts", () => {
    authMocks.role = "guest";

    expect(renderToStaticMarkup(<MyKartePage />)).toContain("カルテはキャストだけが使えます");
  });

  it("shows the page to a cast", () => {
    authMocks.role = "cast";

    const html = renderToStaticMarkup(<MyKartePage />);

    expect(html).toContain("自分のカルテ");
    expect(html).not.toContain("キャストだけが使えます");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/components/shell src/components/compose src/app/page.test.tsx src/app/page.feed-fetch.test.tsx "src/app/u/[username]/page.test.tsx" src/app/karte/my/page.test.tsx`
Expected: FAIL。`resolveNavItems`・`resolveComposeKinds` の新しい引数、役割で出し分けるテスト、自分のカルテの画面のテストが落ちる

- [ ] **Step 3: 実装する**

`src/components/shell/resolveNavItems.ts` の `NavContext` と `resolveNavItems` を次にする（`import type { Role } from "@/lib/auth";` を追加する）。

```ts
interface NavContext {
  role: Role | null;
}

export function resolveNavItems({ role }: NavContext): NavItem[] {
  return [
    { path: "/", label: "ホーム", icon: FEATURE_ICONS.home },
    { path: "/search", label: "検索", icon: FEATURE_ICONS.search },
    { path: "/notifications", label: "通知", icon: FEATURE_ICONS.notifications, badgeKey: "unread" },
    { path: "/messages", label: "メッセージ", icon: FEATURE_ICONS.messages, badgeKey: "messaging_unread" },
    { path: "/footprints", label: "足跡", icon: FEATURE_ICONS.footprints, badgeKey: "footprints_unread" },
    { path: "/bookmarks", label: "ブックマーク", icon: FEATURE_ICONS.bookmarks },
    { path: "/ranking", label: "ランキング", icon: FEATURE_ICONS.ranking },
    ...(role === "cast" ? [{ path: "/karte/my", label: "カルテ", icon: FEATURE_ICONS.karte }] : []),
    ...(role === "guest" ? [{ path: "/reviews/my", label: "レビュー", icon: FEATURE_ICONS.reviews }] : []),
    { path: PROFILE_NAV_PATH, label: "プロフィール", icon: FEATURE_ICONS.profile },
    { path: "/settings", label: "設定", icon: FEATURE_ICONS.settings },
  ];
}
```

`src/components/shell/SideNav.tsx`: `useMyKarteAccess` の import と `const { hasAccess: karteAccess } = useMyKarteAccess();` を削除し、`resolveNavItems({ karteAccess, isGuest: role === "guest" })` を `resolveNavItems({ role })` にする。

`src/components/shell/Drawer.tsx`: `useMyKarteAccess` の import と `const { hasAccess: karteAccess } = useMyKarteAccess();` を削除し、`resolveNavItems({ karteAccess, isGuest: role === "guest" })` を `resolveNavItems({ role })` にする。

`src/components/shell/BottomTab.tsx`: `useMyKarteAccess` の import と `const { hasAccess: karteAccess } = useMyKarteAccess();` を削除し、`...(karteAccess ? [KARTE_TAB] : []),` を `...(role === "cast" ? [KARTE_TAB] : []),` にする。

`src/components/compose/resolveComposeKinds.ts` を次の内容にする。

```ts
import type { Role } from "@/lib/auth";

export type ComposeKind = "post" | "message" | "karte" | "review";

interface ComposeContext {
  role: Role | null;
}

export function resolveComposeKinds({ role }: ComposeContext): ComposeKind[] {
  if (role === "guest") return ["post", "message", "review"];
  if (role === "cast") return ["post", "message", "karte"];
  return ["post"];
}
```

`src/components/compose/ComposeLauncher.tsx`: `useMyKarteAccess` の import と `const { hasAccess: karteAccess } = useMyKarteAccess();` を削除し、`resolveComposeKinds({ role, karteAccess })` を `resolveComposeKinds({ role })` にする。

`src/app/page.tsx`: `import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";` を `import { useAuthStore, selectRole } from "@/stores/authStore";` に置き換え、`const { hasAccess: karteAccess } = useMyKarteAccess();` を `const role = useAuthStore(selectRole);` にする。`tabItems` の `useMemo` を次にする。

```tsx
  const tabItems: TabItem[] = useMemo(() => {
    const items = [...POST_TAB_ITEMS];
    if (role === "cast") items.push({ id: "karte", label: "カルテ" });
    items.push({ id: "reviews", label: "レビュー" });
    return items;
  }, [role]);
```

`src/app/u/[username]/page.tsx`: `import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";` を削除し、`import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";` を `import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";` にする。`const { hasAccess: karteAccess } = useMyKarteAccess();` を `const viewerRole = useAuthStore(selectRole);` にし、`...(role === "guest" && karteAccess` を `...(role === "guest" && viewerRole === "cast"` にする。

`src/app/karte/my/page.tsx`: `useMyKarteAccess` の import を `import { useAuthStore, selectRole } from "@/stores/authStore";` に置き換え、`MyKartePage` の先頭を次にする（`useMyKarte` の呼び出しと、その後の描画は変えない）。

```tsx
export default function MyKartePage() {
  const role = useAuthStore(selectRole);
  const { entries, hasMore, loading, loadMore, refresh } = useMyKarte();

  if (role !== "cast") {
    return (
      <div className="p-4 text-sm">
        <p>カルテはキャストだけが使えます。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }
```

（変更前の `const { hasAccess, loading: accessLoading } = useMyKarteAccess();`、`if (accessLoading) ...`、`if (!hasAccess) { ... }` は削除する。）

`src/modules/karte/hooks/index.ts` から `export { useMyKarteAccess } from "./useMyKarteAccess";` を削除する。

```bash
cd dystopia/frontend
git rm src/modules/karte/hooks/useMyKarteAccess.ts src/modules/karte/hooks/useMyKarteAccess.test.ts src/app/api/karte/access/route.ts
```

- [ ] **Step 4: テストと型検査が通ることを確認する**

Run: Step 2 と同じ
Expected: PASS

Run: `cd dystopia/frontend && /usr/bin/grep -rnE 'useMyKarteAccess|karteAccess|hasKarteAccess|api/karte/access' src`
Expected: 出力なし

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec tsc --noEmit`
Expected: 出力なし

- [ ] **Step 5: コミットする**

```bash
git add -A dystopia/frontend/src
git status --short
git commit -s -m "refactor(dystopia/frontend): offer karte to casts by role instead of an access flag"
```

---

### Task 6: Frontend data layer

**Files**（パスは `dystopia/frontend/` から）:
- Modify（生成）: `src/stub/karte/v1/service_pb.ts`
- Modify: `src/modules/karte/types.ts`（全面書き換え）
- Create: `src/modules/karte/lib/catalog.ts`, `catalog.test.ts`
- Create: `src/modules/karte/lib/dates.ts`, `dates.test.ts`
- Modify: `src/modules/karte/lib/mappers.ts`, `mappers.test.ts`（全面書き換え）
- Create: `src/modules/karte/lib/input.ts`, `input.test.ts`
- Create: `src/app/api/karte/karte-response.ts`
- Modify: `src/app/api/karte/route.ts`, `src/app/api/karte/[id]/route.ts`, `src/app/api/karte/by-target/route.ts`, `src/app/api/karte/my/route.ts`, `src/app/api/karte/recent/route.ts`
- Create: `src/app/api/karte/[id]/rating/route.ts`, `[id]/close/route.ts`, `[id]/reopen/route.ts`, `[id]/events/route.ts`, `src/app/api/karte/events/[eventId]/route.ts`
- Delete: `src/app/api/karte/[id]/report/route.ts`
- Create: `src/app/api/karte/routes.test.ts`
- Modify: `src/app/api/entry-update.test.ts`
- Modify: `src/modules/karte/hooks/useGuestKarte.ts`, `useMyKarte.ts`, `useRecentKarte.ts`, `index.ts`
- Create: `src/modules/karte/hooks/useKarteMutations.ts`, `useKarteMutations.test.ts`
- Delete: `src/modules/karte/hooks/useCreateKarte.ts`, `useUpdateKarte.ts`, `useDeleteKarte.ts`, `useReportKarte.ts`

**Interfaces:**
- Consumes: Task 4 の proto（生成後の `@/stub/karte/v1/service_pb`: `KarteSchema`・`KarteStage`・`KarteStatus`・`ReliabilitySummarySchema`、`karteClient` の 12 メソッド）
- Produces（Task 7 が使う）:
  - 型: `KarteStage`・`KarteStatus`・`KarteEvent`・`Karte`・`KarteEventInput`・`ReliabilitySummary`・`KartePage`・`KartesByTargetPage`（`@/modules/karte/types`。定義は Step 3）
  - `KARTE_STAGES`・`KARTE_OUTCOMES`・`KARTE_TAGS`・`MAX_NOTE_LENGTH`・`isNoteRequired(stage, outcome)`・`stageLabel(stage)`・`outcomeLabel(stage, code)`・`tagLabel(stage, code)`（`@/modules/karte/lib/catalog`）
  - `todayInJapan(now?: Date): string`（`@/modules/karte/lib/dates`）
  - `useGuestKarte(targetProfileId) -> { kartes, reliability, hasMore, loading, error, loadMore, refresh }`、`useMyKarte() / useRecentKarte(enabled) -> { kartes, hasMore, loading, error, loadMore, refresh }`
  - `useKarteMutations() -> { create(targetProfileId, rating: number | null, event), updateRating(karteId, rating: number | null), close(karteId), reopen(karteId), addEvent(karteId, event), updateEvent(eventId, event), removeEvent(eventId), remove(karteId): Promise<boolean>, loading, error }`。`remove` 以外は `Promise<Karte | null>`（失敗で `null` と `error`）
  - BFF: `POST /api/karte`、`GET|DELETE /api/karte/[id]`、`PATCH /api/karte/[id]/rating`、`POST /api/karte/[id]/close`、`POST /api/karte/[id]/reopen`、`POST /api/karte/[id]/events`、`PATCH|DELETE /api/karte/events/[eventId]`、`GET /api/karte/by-target?profile_id=`、`GET /api/karte/my`、`GET /api/karte/recent`。カルテを返す route は `{ karte }`、一覧は `{ kartes, nextCursor, hasMore }`（ゲスト別は `reliability` も）

`tsc --noEmit` はこのタスクの後、Task 7 が終わるまで失敗する（画面がまだ旧い型を使うため）。このタスクでは自分のテストファイルだけを vitest で確かめる。

- [ ] **Step 1: スタブを生成する**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm proto:gen && git status --short src/stub`
Expected: `src/stub/karte/v1/service_pb.ts` が変更される。`karte` 以外の `*_pb.ts` の差分は `git checkout -- src/stub/<package>` で戻し、未追跡の `src/stub/billing` は `rm -rf src/stub/billing` で消す

- [ ] **Step 2: 失敗するテストを書く**

`src/modules/karte/lib/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { KARTE_OUTCOMES, KARTE_STAGES, KARTE_TAGS, MAX_NOTE_LENGTH, isNoteRequired, outcomeLabel, stageLabel, tagLabel } from "./catalog";

const codes = (choices: { code: string }[]) => choices.map((choice) => choice.code);

describe("karte catalog", () => {
  it("lists the stages in order", () => {
    expect(codes(KARTE_STAGES)).toEqual(["reservation", "service", "aftercare"]);
  });

  it("lists the outcomes of each stage as the spec does", () => {
    expect(codes(KARTE_OUTCOMES.reservation)).toEqual(["inquiry_only", "booked", "cancelled_with_notice", "no_show", "other"]);
    expect(codes(KARTE_OUTCOMES.service)).toEqual(["completed", "completed_with_issues", "ended_early", "other"]);
    expect(codes(KARTE_OUTCOMES.aftercare)).toEqual([
      "closed_without_issues",
      "next_booking_inquiry",
      "inquiry_handled",
      "trouble_occurred",
      "trouble_resolved",
      "other",
    ]);
  });

  it("lists the tags of each stage as the spec does", () => {
    expect(codes(KARTE_TAGS.reservation)).toEqual([
      "smooth_contact",
      "contact_problem",
      "condition_mismatch",
      "rescheduled",
      "advance_notice",
      "unagreed_request",
    ]);
    expect(codes(KARTE_TAGS.service)).toEqual(["punctual", "late", "payment_ok", "payment_trouble", "smooth_communication", "excessive_request"]);
    expect(codes(KARTE_TAGS.aftercare)).toEqual([
      "polite_contact",
      "excessive_contact",
      "personal_contact_request",
      "condition_change_request",
      "resolved",
    ]);
  });

  it("requires a note only for the serious outcomes", () => {
    expect(isNoteRequired("reservation", "no_show")).toBe(true);
    expect(isNoteRequired("service", "ended_early")).toBe(true);
    expect(isNoteRequired("aftercare", "trouble_occurred")).toBe(true);
    expect(isNoteRequired("reservation", "booked")).toBe(false);
    expect(MAX_NOTE_LENGTH).toBe(500);
  });

  it("names codes in Japanese and falls back to the code for an unknown one", () => {
    expect(stageLabel("aftercare")).toBe("接客後");
    expect(outcomeLabel("reservation", "no_show")).toBe("無断キャンセル・来店なし");
    expect(tagLabel("service", "late")).toBe("遅刻あり");
    expect(outcomeLabel("service", "retired_code")).toBe("retired_code");
  });
});
```

`src/modules/karte/lib/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { todayInJapan } from "./dates";

describe("todayInJapan", () => {
  it("returns the calendar date in Japan as YYYY-MM-DD", () => {
    expect(todayInJapan(new Date("2026-10-15T14:59:59Z"))).toBe("2026-10-15");
    expect(todayInJapan(new Date("2026-10-15T15:00:00Z"))).toBe("2026-10-16");
  });
});
```

`src/modules/karte/lib/mappers.test.ts` を次の内容にする。

```ts
import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { KarteEventSchema, KarteSchema, KarteStage, KarteStatus, ReliabilitySummarySchema } from "@/stub/karte/v1/service_pb";
import { eventInputToMessage, mapKarteToView, mapReliabilityToView } from "./mappers";

describe("mapKarteToView", () => {
  it("maps a karte with its events", () => {
    const view = mapKarteToView(
      create(KarteSchema, {
        id: "k-1",
        authorProfileId: "author",
        authorUsername: "cast_taro",
        targetProfileId: "target",
        targetUsername: "guest_hanako",
        isMine: true,
        rating: 4,
        status: KarteStatus.CLOSED,
        closedAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
        events: [
          create(KarteEventSchema, { id: "e-1", stage: KarteStage.AFTERCARE, outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }),
        ],
      })
    );

    expect(view).toMatchObject({
      id: "k-1",
      authorUsername: "cast_taro",
      targetUsername: "guest_hanako",
      isMine: true,
      rating: 4,
      status: "closed",
      closedAt: new Date(1_700_000_000 * 1000).toISOString(),
      events: [{ id: "e-1", stage: "aftercare", outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }],
    });
  });

  it("reads rating 0 as unrated and a missing close time as null", () => {
    const view = mapKarteToView(create(KarteSchema, { id: "k-1", rating: 0, status: KarteStatus.OPEN }));

    expect(view.rating).toBeNull();
    expect(view.status).toBe("open");
    expect(view.closedAt).toBeNull();
    expect(view.authorUsername).toBe("");
    expect(view.events).toEqual([]);
  });

  it("maps each stage", () => {
    const stages = [KarteStage.RESERVATION, KarteStage.SERVICE, KarteStage.AFTERCARE].map(
      (stage) => mapKarteToView(create(KarteSchema, { events: [create(KarteEventSchema, { stage })] })).events[0].stage
    );

    expect(stages).toEqual(["reservation", "service", "aftercare"]);
  });
});

describe("mapReliabilityToView", () => {
  it("passes the average through when closed kartes exist", () => {
    expect(mapReliabilityToView(create(ReliabilitySummarySchema, { averageRating: 3.8, raterCount: 8, karteCount: 12 }))).toEqual({
      averageRating: 3.8,
      raterCount: 8,
      karteCount: 12,
    });
  });

  it("reports no average without closed kartes", () => {
    expect(mapReliabilityToView(create(ReliabilitySummarySchema, {}))).toEqual({ averageRating: null, raterCount: 0, karteCount: 0 });
    expect(mapReliabilityToView(undefined)).toEqual({ averageRating: null, raterCount: 0, karteCount: 0 });
  });
});

describe("eventInputToMessage", () => {
  it("turns the stage into the proto enum", () => {
    expect(eventInputToMessage({ stage: "service", outcome: "completed", tags: ["late"], note: "", occurredOn: "2026-10-01" })).toEqual({
      stage: KarteStage.SERVICE,
      outcome: "completed",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
    });
  });
});
```

`src/modules/karte/lib/input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseKarteEventInput, parseRating } from "./input";

describe("parseKarteEventInput", () => {
  it("accepts a well-formed event and defaults a missing note", () => {
    expect(parseKarteEventInput({ stage: "service", outcome: "completed", tags: ["late"], occurredOn: "2026-10-01" })).toEqual({
      stage: "service",
      outcome: "completed",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
    });
  });

  it("rejects an unknown stage, a non-string field and non-string tags", () => {
    expect(parseKarteEventInput({ stage: "after", outcome: "x", tags: [], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseKarteEventInput({ stage: "service", outcome: 1, tags: [], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseKarteEventInput({ stage: "service", outcome: "completed", tags: [1], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseKarteEventInput(null)).toBeNull();
  });
});

describe("parseRating", () => {
  it("passes integers through for the server to check and reads anything else as unrated", () => {
    expect(parseRating(4)).toBe(4);
    expect(parseRating(9)).toBe(9);
    expect(parseRating(null)).toBe(0);
    expect(parseRating("4")).toBe(0);
    expect(parseRating(3.5)).toBe(0);
  });
});
```

`src/app/api/karte/routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { KarteSchema, KarteStage, KarteStatus, ReliabilitySummarySchema } from "@/stub/karte/v1/service_pb";

const karteClient = vi.hoisted(() => ({
  createKarte: vi.fn(),
  getKarte: vi.fn(),
  updateKarteRating: vi.fn(),
  deleteKarte: vi.fn(),
  closeKarte: vi.fn(),
  reopenKarte: vi.fn(),
  addKarteEvent: vi.fn(),
  updateKarteEvent: vi.fn(),
  deleteKarteEvent: vi.fn(),
  listKartesByTarget: vi.fn(),
  listMyKartes: vi.fn(),
  listRecentKartes: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ karteClient }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })) }));

const root = await import("./route");
const one = await import("./[id]/route");
const rating = await import("./[id]/rating/route");
const close = await import("./[id]/close/route");
const reopen = await import("./[id]/reopen/route");
const events = await import("./[id]/events/route");
const event = await import("./events/[eventId]/route");
const byTarget = await import("./by-target/route");
const my = await import("./my/route");
const recent = await import("./recent/route");

const karte = create(KarteSchema, { id: "k-1", rating: 0, status: KarteStatus.OPEN });
const eventBody = { stage: "service", outcome: "completed", tags: ["late"], note: "遅刻", occurredOn: "2026-10-01" };
const eventMessage = { stage: KarteStage.SERVICE, outcome: "completed", tags: ["late"], note: "遅刻", occurredOn: "2026-10-01" };

function request(url: string, method: string, body?: unknown, signedIn = true) {
  const req = new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  for (const fn of Object.values(karteClient)) fn.mockReset().mockResolvedValue({ karte });
});

describe("POST /api/karte", () => {
  it("creates a karte from the target, an optional rating and the first event", async () => {
    const res = await root.POST(request("/api/karte", "POST", { targetProfileId: "guest-1", rating: null, event: eventBody }));

    expect(res.status).toBe(200);
    expect(karteClient.createKarte).toHaveBeenCalledWith({ targetProfileId: "guest-1", rating: 0, event: eventMessage }, expect.anything());
    expect((await res.json()).karte).toMatchObject({ id: "k-1", rating: null, status: "open" });
  });

  it("rejects a request without a well-formed event", async () => {
    const res = await root.POST(request("/api/karte", "POST", { targetProfileId: "guest-1", event: { stage: "after" } }));

    expect(res.status).toBe(400);
    expect(karteClient.createKarte).not.toHaveBeenCalled();
  });

  it("requires a signed-in viewer", async () => {
    const res = await root.POST(request("/api/karte", "POST", { targetProfileId: "guest-1", event: eventBody }, false));

    expect(res.status).toBe(401);
  });
});

describe("one karte", () => {
  it("reads and deletes a karte", async () => {
    await one.GET(request("/api/karte/k-1", "GET"), params({ id: "k-1" }));
    const deleted = await one.DELETE(request("/api/karte/k-1", "DELETE"), params({ id: "k-1" }));

    expect(karteClient.getKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
    expect(karteClient.deleteKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
    expect(await deleted.json()).toEqual({ ok: true });
  });

  it("rates, closes and reopens a karte", async () => {
    await rating.PATCH(request("/api/karte/k-1/rating", "PATCH", { rating: null }), params({ id: "k-1" }));
    await close.POST(request("/api/karte/k-1/close", "POST"), params({ id: "k-1" }));
    await reopen.POST(request("/api/karte/k-1/reopen", "POST"), params({ id: "k-1" }));

    expect(karteClient.updateKarteRating).toHaveBeenCalledWith({ karteId: "k-1", rating: 0 }, expect.anything());
    expect(karteClient.closeKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
    expect(karteClient.reopenKarte).toHaveBeenCalledWith({ karteId: "k-1" }, expect.anything());
  });

  it("adds, updates and deletes an event", async () => {
    await events.POST(request("/api/karte/k-1/events", "POST", { event: eventBody }), params({ id: "k-1" }));
    await event.PATCH(request("/api/karte/events/e-1", "PATCH", { event: eventBody }), params({ eventId: "e-1" }));
    const res = await event.DELETE(request("/api/karte/events/e-1", "DELETE"), params({ eventId: "e-1" }));

    expect(karteClient.addKarteEvent).toHaveBeenCalledWith({ karteId: "k-1", event: eventMessage }, expect.anything());
    expect(karteClient.updateKarteEvent).toHaveBeenCalledWith({ eventId: "e-1", event: eventMessage }, expect.anything());
    expect(karteClient.deleteKarteEvent).toHaveBeenCalledWith({ eventId: "e-1" }, expect.anything());
    expect((await res.json()).karte.id).toBe("k-1");
  });

  it("answers 500 when the server returns no karte", async () => {
    karteClient.closeKarte.mockResolvedValue({});

    const res = await close.POST(request("/api/karte/k-1/close", "POST"), params({ id: "k-1" }));

    expect(res.status).toBe(500);
  });
});

describe("karte lists", () => {
  it("lists a guest's kartes with the reliability", async () => {
    karteClient.listKartesByTarget.mockResolvedValue({
      kartes: [karte],
      nextCursor: "next",
      hasMore: true,
      reliability: create(ReliabilitySummarySchema, { averageRating: 3.8, raterCount: 8, karteCount: 12 }),
    });

    const res = await byTarget.GET(request("/api/karte/by-target?profile_id=guest-1&cursor=c", "GET"));
    const body = await res.json();

    expect(karteClient.listKartesByTarget).toHaveBeenCalledWith({ targetProfileId: "guest-1", limit: 20, cursor: "c" }, expect.anything());
    expect(body).toMatchObject({ nextCursor: "next", hasMore: true, reliability: { averageRating: 3.8, raterCount: 8, karteCount: 12 } });
    expect(body.kartes).toHaveLength(1);
  });

  it("requires the profile id for a guest's kartes", async () => {
    const res = await byTarget.GET(request("/api/karte/by-target", "GET"));

    expect(res.status).toBe(400);
  });

  it("lists my kartes and recent kartes", async () => {
    karteClient.listMyKartes.mockResolvedValue({ kartes: [karte], nextCursor: "", hasMore: false });
    karteClient.listRecentKartes.mockResolvedValue({ kartes: [], nextCursor: "", hasMore: false });

    const mine = await (await my.GET(request("/api/karte/my", "GET"))).json();
    const latest = await (await recent.GET(request("/api/karte/recent?cursor=c", "GET"))).json();

    expect(mine).toMatchObject({ hasMore: false, nextCursor: "" });
    expect(mine.kartes).toHaveLength(1);
    expect(latest.kartes).toEqual([]);
    expect(karteClient.listRecentKartes).toHaveBeenCalledWith({ limit: 20, cursor: "c" }, expect.anything());
  });
});
```

`src/modules/karte/hooks/useKarteMutations.test.ts`:

```ts
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/auth/fetch", () => ({ authFetch: mocks.authFetch }));

const { useKarteMutations } = await import("./useKarteMutations");

const hook: { current: ReturnType<typeof useKarteMutations> | null } = { current: null };
function Probe() {
  hook.current = useKarteMutations();
  return null;
}

const event = { stage: "service" as const, outcome: "completed", tags: [], note: "", occurredOn: "2026-10-01" };
let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.authFetch.mockReset().mockResolvedValue({ karte: { id: "k-1" } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useKarteMutations", () => {
  it("sends each change to its route and returns the karte", async () => {
    const calls: [string, unknown][] = [
      ["create", () => hook.current!.create("guest-1", null, event)],
      ["rating", () => hook.current!.updateRating("k-1", 4)],
      ["close", () => hook.current!.close("k-1")],
      ["reopen", () => hook.current!.reopen("k-1")],
      ["add", () => hook.current!.addEvent("k-1", event)],
      ["update", () => hook.current!.updateEvent("e-1", event)],
      ["remove event", () => hook.current!.removeEvent("e-1")],
    ];
    for (const [, run] of calls) {
      let result: unknown;
      await act(async () => {
        result = await (run as () => Promise<unknown>)();
      });
      expect(result).toEqual({ id: "k-1" });
    }

    expect(mocks.authFetch.mock.calls).toEqual([
      ["/api/karte", { method: "POST", body: { targetProfileId: "guest-1", rating: null, event } }],
      ["/api/karte/k-1/rating", { method: "PATCH", body: { rating: 4 } }],
      ["/api/karte/k-1/close", { method: "POST", body: undefined }],
      ["/api/karte/k-1/reopen", { method: "POST", body: undefined }],
      ["/api/karte/k-1/events", { method: "POST", body: { event } }],
      ["/api/karte/events/e-1", { method: "PATCH", body: { event } }],
      ["/api/karte/events/e-1", { method: "DELETE", body: undefined }],
    ]);
  });

  it("deletes a karte and reports whether it worked", async () => {
    let removed: boolean | undefined;
    await act(async () => {
      removed = await hook.current!.remove("k-1");
    });

    expect(removed).toBe(true);
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/karte/k-1", { method: "DELETE" });
  });

  it("keeps the server's message and returns null when a change fails", async () => {
    mocks.authFetch.mockRejectedValue(new Error("Rating required to close"));
    let result: unknown = "untouched";

    await act(async () => {
      result = await hook.current!.close("k-1");
    });

    expect(result).toBeNull();
    expect(hook.current!.error?.message).toBe("Rating required to close");
  });
});
```

`src/app/api/entry-update.test.ts` を、karte の部分を除いた次の内容にする。

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ReviewEntrySchema } from "@/stub/review/v1/service_pb";

const clients = vi.hoisted(() => ({
  reviewClient: { updateEntry: vi.fn() },
}));

vi.mock("@/lib/grpc", () => clients);
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const reviewRoute = await import("./review/[id]/route");

function patch(body: unknown) {
  const req = new NextRequest("http://localhost/api/review/e-1", { method: "PATCH", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return reviewRoute.PATCH(req, { params: Promise.resolve({ id: "e-1" }) });
}

beforeEach(() => {
  clients.reviewClient.updateEntry.mockReset().mockResolvedValue({ entry: create(ReviewEntrySchema, { id: "e-1" }) });
});

describe("PATCH /api/review/[id]", () => {
  it("sends an empty body through so the text can be cleared", async () => {
    await patch({ rating: 3, body: "" });

    expect(clients.reviewClient.updateEntry).toHaveBeenCalledWith({ entryId: "e-1", rating: 3, body: "" }, expect.anything());
  });

  it("leaves the body out when the request does not carry one", async () => {
    await patch({ rating: 3 });

    expect(clients.reviewClient.updateEntry).toHaveBeenCalledWith({ entryId: "e-1", rating: 3, body: undefined }, expect.anything());
  });
});
```

- [ ] **Step 3: 型・選択肢・変換を実装する**

`src/modules/karte/types.ts` を次の内容にする。

```ts
export type KarteStage = "reservation" | "service" | "aftercare";
export type KarteStatus = "open" | "closed";

export interface KarteEvent {
  id: string;
  stage: KarteStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface Karte {
  id: string;
  authorProfileId: string;
  authorUsername: string;
  authorAvatarUrl: string;
  targetProfileId: string;
  targetUsername: string;
  targetAvatarUrl: string;
  isMine: boolean;
  rating: number | null;
  status: KarteStatus;
  events: KarteEvent[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface KarteEventInput {
  stage: KarteStage;
  outcome: string;
  tags: string[];
  note: string;
  occurredOn: string;
}

export interface ReliabilitySummary {
  averageRating: number | null;
  raterCount: number;
  karteCount: number;
}

export interface KartePage {
  kartes: Karte[];
  nextCursor: string;
  hasMore: boolean;
}

export interface KartesByTargetPage extends KartePage {
  reliability: ReliabilitySummary;
}
```

`src/modules/karte/lib/catalog.ts`:

```ts
import type { KarteStage } from "../types";

export interface KarteChoice {
  code: string;
  label: string;
}

export const KARTE_STAGES: { code: KarteStage; label: string }[] = [
  { code: "reservation", label: "予約・問い合わせ" },
  { code: "service", label: "接客" },
  { code: "aftercare", label: "接客後" },
];

export const KARTE_OUTCOMES: Record<KarteStage, KarteChoice[]> = {
  reservation: [
    { code: "inquiry_only", label: "問い合わせのみ" },
    { code: "booked", label: "予約成立" },
    { code: "cancelled_with_notice", label: "キャンセル（連絡あり）" },
    { code: "no_show", label: "無断キャンセル・来店なし" },
    { code: "other", label: "その他" },
  ],
  service: [
    { code: "completed", label: "問題なく完了" },
    { code: "completed_with_issues", label: "問題はあったが完了" },
    { code: "ended_early", label: "途中終了" },
    { code: "other", label: "その他" },
  ],
  aftercare: [
    { code: "closed_without_issues", label: "問題なく対応終了" },
    { code: "next_booking_inquiry", label: "次回予約の相談" },
    { code: "inquiry_handled", label: "問い合わせ対応" },
    { code: "trouble_occurred", label: "トラブル発生" },
    { code: "trouble_resolved", label: "トラブル解決" },
    { code: "other", label: "その他" },
  ],
};

export const KARTE_TAGS: Record<KarteStage, KarteChoice[]> = {
  reservation: [
    { code: "smooth_contact", label: "連絡が円滑" },
    { code: "contact_problem", label: "返信・連絡に問題あり" },
    { code: "condition_mismatch", label: "予約条件の認識違い" },
    { code: "rescheduled", label: "日程変更" },
    { code: "advance_notice", label: "事前連絡あり" },
    { code: "unagreed_request", label: "合意していない要求あり" },
  ],
  service: [
    { code: "punctual", label: "時間遵守" },
    { code: "late", label: "遅刻あり" },
    { code: "payment_ok", label: "支払いに問題なし" },
    { code: "payment_trouble", label: "支払いトラブルあり" },
    { code: "smooth_communication", label: "コミュニケーションが円滑" },
    { code: "excessive_request", label: "合意条件を超える要求あり" },
  ],
  aftercare: [
    { code: "polite_contact", label: "丁寧な連絡あり" },
    { code: "excessive_contact", label: "連絡が頻繁・執拗" },
    { code: "personal_contact_request", label: "個人的な連絡先の要求" },
    { code: "condition_change_request", label: "約束した条件と異なる要求" },
    { code: "resolved", label: "問題が解決した" },
  ],
};

const NOTE_REQUIRED_OUTCOMES: Record<KarteStage, string[]> = {
  reservation: ["no_show"],
  service: ["ended_early"],
  aftercare: ["trouble_occurred"],
};

export const MAX_NOTE_LENGTH = 500;

export function isNoteRequired(stage: KarteStage, outcome: string): boolean {
  return NOTE_REQUIRED_OUTCOMES[stage].includes(outcome);
}

export function stageLabel(stage: KarteStage): string {
  return KARTE_STAGES.find((choice) => choice.code === stage)?.label ?? stage;
}

// A code dropped from the catalog may still sit in older events, so show the code instead of failing.
export function outcomeLabel(stage: KarteStage, code: string): string {
  return KARTE_OUTCOMES[stage].find((choice) => choice.code === code)?.label ?? code;
}

export function tagLabel(stage: KarteStage, code: string): string {
  return KARTE_TAGS[stage].find((choice) => choice.code === code)?.label ?? code;
}
```

`src/modules/karte/lib/dates.ts`:

```ts
// The sv-SE locale formats a date as YYYY-MM-DD, the format the server expects.
const JAPAN_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export function todayInJapan(now: Date = new Date()): string {
  return JAPAN_DATE.format(now);
}
```

`src/modules/karte/lib/mappers.ts` を次の内容にする。

```ts
import {
  KarteStage as KarteStageMessage,
  KarteStatus as KarteStatusMessage,
  type Karte as KarteMessage,
  type KarteEvent as KarteEventMessage,
  type ReliabilitySummary as ReliabilitySummaryMessage,
} from "@/stub/karte/v1/service_pb";
import type { Karte, KarteEvent, KarteEventInput, KarteStage, ReliabilitySummary } from "@/modules/karte/types";

const STAGE_TO_MESSAGE: Record<KarteStage, KarteStageMessage> = {
  reservation: KarteStageMessage.RESERVATION,
  service: KarteStageMessage.SERVICE,
  aftercare: KarteStageMessage.AFTERCARE,
};

function toIsoString(timestamp: { seconds: bigint } | undefined): string {
  return timestamp ? new Date(Number(timestamp.seconds) * 1000).toISOString() : "";
}

function stageFromMessage(stage: KarteStageMessage): KarteStage {
  if (stage === KarteStageMessage.SERVICE) return "service";
  if (stage === KarteStageMessage.AFTERCARE) return "aftercare";
  // FALLBACK: The server never sends an unspecified stage, so read one as a reservation instead of failing the whole list.
  return "reservation";
}

export function mapKarteEventToView(event: KarteEventMessage): KarteEvent {
  return {
    id: event.id,
    stage: stageFromMessage(event.stage),
    outcome: event.outcome,
    tags: [...event.tags],
    note: event.note || "",
    occurredOn: event.occurredOn,
    createdAt: toIsoString(event.createdAt),
    updatedAt: toIsoString(event.updatedAt),
  };
}

export function mapKarteToView(karte: KarteMessage): Karte {
  return {
    id: karte.id,
    authorProfileId: karte.authorProfileId,
    authorUsername: karte.authorUsername || "",
    authorAvatarUrl: karte.authorAvatarUrl || "",
    targetProfileId: karte.targetProfileId,
    targetUsername: karte.targetUsername || "",
    targetAvatarUrl: karte.targetAvatarUrl || "",
    isMine: !!karte.isMine,
    rating: karte.rating === 0 ? null : karte.rating,
    status: karte.status === KarteStatusMessage.CLOSED ? "closed" : "open",
    events: karte.events.map(mapKarteEventToView),
    createdAt: toIsoString(karte.createdAt),
    updatedAt: toIsoString(karte.updatedAt),
    closedAt: karte.closedAt ? toIsoString(karte.closedAt) : null,
  };
}

export function mapReliabilityToView(summary: ReliabilitySummaryMessage | undefined): ReliabilitySummary {
  const karteCount = summary?.karteCount ?? 0;
  return {
    averageRating: summary && karteCount > 0 ? summary.averageRating : null,
    raterCount: summary?.raterCount ?? 0,
    karteCount,
  };
}

export function eventInputToMessage(input: KarteEventInput) {
  return {
    stage: STAGE_TO_MESSAGE[input.stage],
    outcome: input.outcome,
    tags: input.tags,
    note: input.note,
    occurredOn: input.occurredOn,
  };
}
```

`src/modules/karte/lib/input.ts`:

```ts
import type { KarteEventInput, KarteStage } from "../types";

const STAGES: readonly string[] = ["reservation", "service", "aftercare"];

export function parseKarteEventInput(value: unknown): KarteEventInput | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.stage !== "string" || !STAGES.includes(input.stage)) return null;
  if (typeof input.outcome !== "string" || typeof input.occurredOn !== "string") return null;
  if (!Array.isArray(input.tags) || !input.tags.every((tag) => typeof tag === "string")) return null;
  return {
    stage: input.stage as KarteStage,
    outcome: input.outcome,
    tags: input.tags as string[],
    note: typeof input.note === "string" ? input.note : "",
    occurredOn: input.occurredOn,
  };
}

// Pass any integer through so the server, which owns the 1..5 rule, reports the error; anything else means unrated.
export function parseRating(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}
```

- [ ] **Step 4: BFF を実装する**

`src/app/api/karte/karte-response.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";
import { mapKarteToView } from "@/modules/karte/lib/mappers";
import type { Karte as KarteMessage } from "@/stub/karte/v1/service_pb";

type GrpcHeaders = Awaited<ReturnType<typeof buildGrpcHeaders>>;

export async function respondWithKarte(
  req: NextRequest,
  label: string,
  call: (headers: GrpcHeaders) => Promise<{ karte?: KarteMessage }>
) {
  try {
    const res = await call(await buildGrpcHeaders(req));
    if (!res.karte) {
      return NextResponse.json({ error: `${label} returned no karte` }, { status: 500 });
    }
    return NextResponse.json({ karte: mapKarteToView(res.karte) });
  } catch (error: unknown) {
    return handleApiError(error, label);
  }
}
```

`src/app/api/karte/route.ts` を次の内容にする。

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/karte/lib/mappers";
import { parseKarteEventInput, parseRating } from "@/modules/karte/lib/input";
import { respondWithKarte } from "./karte-response";

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const body = await req.json().catch(() => null);
  const targetProfileId = typeof body?.targetProfileId === "string" ? body.targetProfileId : "";
  const event = parseKarteEventInput(body?.event);
  if (!targetProfileId || !event) {
    return NextResponse.json({ error: "targetProfileId and event required" }, { status: 400 });
  }
  return respondWithKarte(req, "CreateKarte", (headers) =>
    karteClient.createKarte(
      { targetProfileId, rating: parseRating(body?.rating), event: eventInputToMessage(event) },
      { headers }
    )
  );
}
```

`src/app/api/karte/[id]/route.ts` を次の内容にする。

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { respondWithKarte } from "../karte-response";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  return respondWithKarte(req, "GetKarte", (headers) => karteClient.getKarte({ karteId: id }, { headers }));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const { id } = await params;
    await karteClient.deleteKarte({ karteId: id }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return handleApiError(error, "DeleteKarte");
  }
}
```

`src/app/api/karte/[id]/rating/route.ts`:

```ts
import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { parseRating } from "@/modules/karte/lib/input";
import { respondWithKarte } from "../../karte-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  return respondWithKarte(req, "UpdateKarteRating", (headers) =>
    karteClient.updateKarteRating({ karteId: id, rating: parseRating(body?.rating) }, { headers })
  );
}
```

`src/app/api/karte/[id]/close/route.ts`:

```ts
import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { respondWithKarte } from "../../karte-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  return respondWithKarte(req, "CloseKarte", (headers) => karteClient.closeKarte({ karteId: id }, { headers }));
}
```

`src/app/api/karte/[id]/reopen/route.ts`:

```ts
import { NextRequest } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { respondWithKarte } from "../../karte-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  return respondWithKarte(req, "ReopenKarte", (headers) => karteClient.reopenKarte({ karteId: id }, { headers }));
}
```

`src/app/api/karte/[id]/events/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/karte/lib/mappers";
import { parseKarteEventInput } from "@/modules/karte/lib/input";
import { respondWithKarte } from "../../karte-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const event = parseKarteEventInput(body?.event);
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
  return respondWithKarte(req, "AddKarteEvent", (headers) =>
    karteClient.addKarteEvent({ karteId: id, event: eventInputToMessage(event) }, { headers })
  );
}
```

`src/app/api/karte/events/[eventId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { requireAuth } from "@/lib/api-helpers";
import { eventInputToMessage } from "@/modules/karte/lib/mappers";
import { parseKarteEventInput } from "@/modules/karte/lib/input";
import { respondWithKarte } from "../../karte-response";

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { eventId } = await params;
  const body = await req.json().catch(() => null);
  const event = parseKarteEventInput(body?.event);
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });
  return respondWithKarte(req, "UpdateKarteEvent", (headers) =>
    karteClient.updateKarteEvent({ eventId, event: eventInputToMessage(event) }, { headers })
  );
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const { eventId } = await params;
  return respondWithKarte(req, "DeleteKarteEvent", (headers) => karteClient.deleteKarteEvent({ eventId }, { headers }));
}
```

`src/app/api/karte/by-target/route.ts` を次の内容にする。

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapKarteToView, mapReliabilityToView } from "@/modules/karte/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const targetProfileId = req.nextUrl.searchParams.get("profile_id") || "";
    if (!targetProfileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listKartesByTarget({ targetProfileId, limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      kartes: (res.kartes || []).map(mapKarteToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
      reliability: mapReliabilityToView(res.reliability),
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListKartesByTarget");
  }
}
```

`src/app/api/karte/my/route.ts` を次の内容にする。

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapKarteToView } from "@/modules/karte/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listMyKartes({ limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      kartes: (res.kartes || []).map(mapKarteToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyKartes");
  }
}
```

`src/app/api/karte/recent/route.ts` を、上の `my/route.ts` の `listMyKartes` を `listRecentKartes` に、`"ListMyKartes"` を `"ListRecentKartes"` に変えた内容にする（コードは次のとおり）。

```ts
import { NextRequest, NextResponse } from "next/server";
import { karteClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapKarteToView } from "@/modules/karte/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await karteClient.listRecentKartes({ limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      kartes: (res.kartes || []).map(mapKarteToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListRecentKartes");
  }
}
```

```bash
cd dystopia/frontend
git rm "src/app/api/karte/[id]/report/route.ts"
```

- [ ] **Step 5: hook を実装する**

`src/modules/karte/hooks/useKarteMutations.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { Karte, KarteEventInput } from "../types";

export function useKarteMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async <T>(fallback: string, request: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      return await request();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(fallback));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const send = useCallback(
    (url: string, method: string, body?: unknown) =>
      run("カルテを更新できませんでした", async () => (await authFetch<{ karte: Karte }>(url, { method, body })).karte),
    [run]
  );

  const karteUrl = (karteId: string) => `/api/karte/${encodeURIComponent(karteId)}`;
  const eventUrl = (eventId: string) => `/api/karte/events/${encodeURIComponent(eventId)}`;

  const create = useCallback(
    (targetProfileId: string, rating: number | null, event: KarteEventInput) =>
      send("/api/karte", "POST", { targetProfileId, rating, event }),
    [send]
  );
  const updateRating = useCallback(
    (karteId: string, rating: number | null) => send(`${karteUrl(karteId)}/rating`, "PATCH", { rating }),
    [send]
  );
  const close = useCallback((karteId: string) => send(`${karteUrl(karteId)}/close`, "POST"), [send]);
  const reopen = useCallback((karteId: string) => send(`${karteUrl(karteId)}/reopen`, "POST"), [send]);
  const addEvent = useCallback(
    (karteId: string, event: KarteEventInput) => send(`${karteUrl(karteId)}/events`, "POST", { event }),
    [send]
  );
  const updateEvent = useCallback(
    (eventId: string, event: KarteEventInput) => send(eventUrl(eventId), "PATCH", { event }),
    [send]
  );
  const removeEvent = useCallback((eventId: string) => send(eventUrl(eventId), "DELETE"), [send]);
  const remove = useCallback(
    async (karteId: string) =>
      (await run("カルテを削除できませんでした", () => authFetch<{ ok: boolean }>(karteUrl(karteId), { method: "DELETE" }))) !== null,
    [run]
  );

  return { create, updateRating, close, reopen, addEvent, updateEvent, removeEvent, remove, loading, error };
}
```

`src/modules/karte/hooks/useGuestKarte.ts` を次の内容にする。

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KartesByTargetPage, ReliabilitySummary } from "../types";

const NO_RELIABILITY: ReliabilitySummary = { averageRating: null, raterCount: 0, karteCount: 0 };

export function useGuestKarte(targetProfileId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: KartesByTargetPage | null): string | null => {
    if (!profileId || !targetProfileId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/karte/by-target?profile_id=${encodeURIComponent(targetProfileId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<KartesByTargetPage>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  return {
    kartes: pages.flatMap((p) => p.kartes || []),
    reliability: pages[0]?.reliability ?? NO_RELIABILITY,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`src/modules/karte/hooks/useMyKarte.ts` を次の内容にする。

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KartePage } from "../types";

export function useMyKarte() {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: KartePage | null): string | null => {
    if (!profileId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/my${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<KartePage>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  return {
    kartes: pages.flatMap((p) => p.kartes || []),
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`src/modules/karte/hooks/useRecentKarte.ts` を次の内容にする。

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import type { KartePage } from "../types";

export function useRecentKarte(enabled: boolean) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: KartePage | null): string | null => {
    if (!enabled || !profileId) return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/recent${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<KartePage>(getKey, fetcher, { revalidateOnFocus: false });

  const pages = data || [];
  return {
    kartes: pages.flatMap((p) => p.kartes || []),
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`src/modules/karte/hooks/index.ts` を次の内容にする。

```ts
export { useGuestKarte } from "./useGuestKarte";
export { useMyKarte } from "./useMyKarte";
export { useRecentKarte } from "./useRecentKarte";
export { useKarteMutations } from "./useKarteMutations";
```

```bash
cd dystopia/frontend
git rm src/modules/karte/hooks/useCreateKarte.ts src/modules/karte/hooks/useUpdateKarte.ts src/modules/karte/hooks/useDeleteKarte.ts src/modules/karte/hooks/useReportKarte.ts
```

- [ ] **Step 6: このタスクのテストが通ることを確認する**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte/lib src/modules/karte/hooks src/app/api/karte src/app/api/entry-update.test.ts`
Expected: PASS（catalog 5、dates 1、mappers 6、input 3、routes 12、useKarteMutations 3、entry-update 2）

- [ ] **Step 7: コミットする**

```bash
git add -A dystopia/frontend/src/stub/karte dystopia/frontend/src/modules/karte dystopia/frontend/src/app/api/karte dystopia/frontend/src/app/api/entry-update.test.ts
git status --short
git commit -s -m "feat(dystopia/frontend): carry the karte lifecycle through the API routes and hooks"
```

`git status --short` で、`src/stub` の `karte` 以外が stage されていないこと、`src/stub/billing` が残っていないことを確かめる。

---

### Task 7: Karte screens on the new shape

**Files**（パスは `dystopia/frontend/` から）:
- Create: `src/modules/karte/components/KarteEventFields.tsx`, `KarteEventFields.test.tsx`
- Create: `src/modules/karte/components/KarteRatingSelect.tsx`
- Modify: `src/modules/karte/components/KarteComposer.tsx`（全面書き換え）, Create: `KarteComposer.test.tsx`
- Modify: `src/modules/karte/components/KarteEntryCard.tsx`（全面書き換え）, `KarteEntryCard.test.tsx`（全面書き換え）, `KarteEntryCard.profile.test.tsx`
- Modify: `src/modules/karte/components/KarteAggregateHeader.tsx`（全面書き換え）, Create: `KarteAggregateHeader.test.tsx`
- Modify: `src/modules/karte/components/GuestKarteTab.tsx`
- Modify: `src/app/karte/my/page.tsx`, `src/app/page.tsx`, `src/app/page.test.tsx`, `src/app/page.feed-fetch.test.tsx`
- Modify: `src/app/dev/ui/karte/page.tsx`

**Interfaces:**
- Consumes: Task 6 の型・catalog・`todayInJapan`・hook
- Produces:
  - `KarteEventFields({ value: KarteEventInput, onChange })`、`emptyKarteEvent(today?: string): KarteEventInput`、`isKarteEventReady(event): boolean`
  - `KarteRatingSelect({ value: number | null, onChange, disabled? })`
  - `KarteComposer({ targetProfileId, onCreated? })`（props は変更なし。`ComposeToSheet` がそのまま使う）
  - `KarteEntryCard({ karte: Karte, mode: "my" | "target" | "recent", onChanged? })`（`entry` を `karte` に改名）
  - `KarteAggregateHeader({ reliability: ReliabilitySummary })`

- [ ] **Step 1: 失敗するテストを書く**

`src/modules/karte/components/KarteEventFields.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { KarteEventInput } from "../types";
import { KarteEventFields, emptyKarteEvent, isKarteEventReady } from "./KarteEventFields";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const latest: { value: KarteEventInput | null } = { value: null };

function Harness({ initial }: { initial: KarteEventInput }) {
  const [value, setValue] = useState(initial);
  latest.value = value;
  return createElement(KarteEventFields, { value, onChange: setValue });
}

let root: Root;
let container: HTMLElement;

async function render(initial: KarteEventInput) {
  await act(async () => root.render(createElement(Harness, { initial })));
}

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("KarteEventFields", () => {
  it("starts on the reservation stage with its first outcome and the given day", () => {
    expect(emptyKarteEvent("2026-10-16")).toEqual({ stage: "reservation", outcome: "inquiry_only", tags: [], note: "", occurredOn: "2026-10-16" });
  });

  it("moves to the first outcome of a new stage and drops the old stage's tags", async () => {
    await render({ ...emptyKarteEvent("2026-10-16"), tags: ["smooth_contact"] });
    const [stage] = Array.from(container.querySelectorAll("select"));

    await choose(stage, "service");

    expect(latest.value).toMatchObject({ stage: "service", outcome: "completed", tags: [] });
    expect(container.textContent).toContain("遅刻あり");
    expect(container.textContent).not.toContain("連絡が円滑");
  });

  it("marks the note as required for a serious outcome", async () => {
    await render({ ...emptyKarteEvent("2026-10-16"), outcome: "no_show" });

    expect(container.textContent).toContain("補足（必須）");
  });

  it("toggles a tag", async () => {
    await render(emptyKarteEvent("2026-10-16"));
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    await act(async () => checkbox.click());

    expect(latest.value?.tags).toEqual(["smooth_contact"]);
  });
});

describe("isKarteEventReady", () => {
  it("needs a day and a note for a serious outcome", () => {
    const base = emptyKarteEvent("2026-10-16");

    expect(isKarteEventReady(base)).toBe(true);
    expect(isKarteEventReady({ ...base, occurredOn: "" })).toBe(false);
    expect(isKarteEventReady({ ...base, outcome: "no_show", note: "  " })).toBe(false);
    expect(isKarteEventReady({ ...base, outcome: "no_show", note: "連絡なし" })).toBe(true);
  });
});
```

`src/modules/karte/components/KarteComposer.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { todayInJapan } from "../lib/dates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({ create: mocks.create, loading: false, error: null }),
}));

const { KarteComposer } = await import("./KarteComposer");

let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.create.mockReset().mockResolvedValue({ id: "k-1" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("KarteComposer", () => {
  it("leaves the rating unselected and creates the karte with the first event", async () => {
    const onCreated = vi.fn();
    await act(async () => root.render(createElement(KarteComposer, { targetProfileId: "guest-1", onCreated })));
    const rating = Array.from(container.querySelectorAll("select")).at(-1) as HTMLSelectElement;
    expect(rating.value).toBe("");

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mocks.create).toHaveBeenCalledWith("guest-1", null, {
      stage: "reservation",
      outcome: "inquiry_only",
      tags: [],
      note: "",
      occurredOn: todayInJapan(),
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("keeps the form when the server refuses the karte", async () => {
    mocks.create.mockResolvedValue(null);
    const onCreated = vi.fn();
    await act(async () => root.render(createElement(KarteComposer, { targetProfileId: "guest-1", onCreated })));

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onCreated).not.toHaveBeenCalled();
  });
});
```

`src/modules/karte/components/KarteEntryCard.test.tsx` を次の内容にする。

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Karte } from "../types";

vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({
    updateRating: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    addEvent: vi.fn(),
    remove: vi.fn(),
    loading: false,
    error: null,
  }),
}));

const { KarteEntryCard } = await import("./KarteEntryCard");

const karte: Karte = {
  id: "k-1",
  authorProfileId: "author-1",
  authorUsername: "cast_taro",
  authorAvatarUrl: "",
  targetProfileId: "target-1",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  isMine: false,
  rating: 4,
  status: "open",
  events: [
    { id: "e-1", stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" },
    { id: "e-2", stage: "service", outcome: "completed", tags: ["late", "smooth_communication"], note: "15分遅刻", occurredOn: "2026-10-02", createdAt: "", updatedAt: "" },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
};

const render = (props: Partial<Parameters<typeof KarteEntryCard>[0]> & { karte?: Karte }) =>
  renderToStaticMarkup(<KarteEntryCard karte={karte} mode="recent" {...props} />);

describe("KarteEntryCard identities", () => {
  it("shows and links both the author and the target in the recent list", () => {
    const html = render({ mode: "recent" });

    expect(html).toContain('href="/u/cast_taro"');
    expect(html).toContain('href="/u/guest_hanako"');
  });

  it("links the target in the own list and the author on a guest's profile", () => {
    expect(render({ mode: "my" })).toContain('href="/u/guest_hanako"');
    const onProfile = render({ mode: "target" });
    expect(onProfile).toContain('href="/u/cast_taro"');
    expect(onProfile).not.toContain('href="/u/guest_hanako"');
  });
});

describe("KarteEntryCard content", () => {
  it("shows the state, the rating and the latest event in words", () => {
    const html = render({});

    expect(html).toContain("記録中");
    expect(html).toContain("接客・問題なく完了");
    expect(html).toContain("遅刻あり・コミュニケーションが円滑");
    expect(html).toContain("15分遅刻");
    expect(html).toContain("ほか 1 件の出来事");
    expect(html).not.toContain("予約成立");
  });

  it("says unrated and closed when that is the state", () => {
    expect(render({ karte: { ...karte, rating: null } })).toContain("未評価");
    expect(render({ karte: { ...karte, status: "closed", closedAt: new Date().toISOString() } })).toContain("完了");
  });
});

describe("KarteEntryCard actions", () => {
  it("offers nothing on another cast's karte", () => {
    const html = render({ mode: "target" });

    expect(html).not.toContain("完了する");
    expect(html).not.toContain("削除");
    expect(html).not.toContain("報告");
  });

  it("offers adding, closing and deleting on an own open karte", () => {
    const html = render({ karte: { ...karte, isMine: true }, mode: "my" });

    expect(html).toContain("出来事を追加");
    expect(html).toContain("完了する");
    expect(html).toContain("削除");
    expect(html).not.toContain("再オープン");
  });

  it("disables closing an own karte without a rating and says why", () => {
    const html = render({ karte: { ...karte, isMine: true, rating: null }, mode: "my" });

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>完了する<\/button>/);
    expect(html).toContain("完了するには星を選んでください");
  });

  it("offers reopening and deleting on an own closed karte", () => {
    const html = render({ karte: { ...karte, isMine: true, status: "closed", closedAt: new Date().toISOString() }, mode: "my" });

    expect(html).toContain("再オープン");
    expect(html).toContain("削除");
    expect(html).not.toContain("出来事を追加");
    expect(html).not.toContain("完了する");
  });
});
```

`src/modules/karte/components/KarteEntryCard.profile.test.tsx`:

1. 2 つの `vi.mock(...)`（`useDeleteKarte` と `useReportKarte`）を次の 1 つに置き換える

```tsx
vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({ updateRating: vi.fn(), close: vi.fn(), reopen: vi.fn(), addEvent: vi.fn(), remove: vi.fn(), loading: false, error: null }),
}));
```

2. `const entry = { ... };` を次にする

```tsx
const entry: import("../types").Karte = {
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "persona_a",
  authorAvatarUrl: "",
  targetProfileId: "target-1",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  isMine: true,
  rating: 4,
  status: "open",
  events: [{ id: "e-1", stage: "service", outcome: "completed", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
};
```

3. `textOf` の呼び出しで渡す `{ entry, mode: ... }` と `{ entry: { ...entry, authorUsername: "" }, mode: "my" }` の `entry:` キーを `karte:` に変える（`{ karte: entry, mode: "my" }`、`{ karte: { ...entry, authorUsername: "" }, mode: "my" }`）

`src/modules/karte/components/KarteAggregateHeader.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KarteAggregateHeader } from "./KarteAggregateHeader";

describe("KarteAggregateHeader", () => {
  it("shows the average to one decimal with how many casts and kartes it comes from", () => {
    const html = renderToStaticMarkup(<KarteAggregateHeader reliability={{ averageRating: 3.75, raterCount: 8, karteCount: 12 }} />);

    expect(html).toContain("3.8 / 5.0");
    expect(html).toContain("8人が評価");
    expect(html).toContain("12件の完了済みカルテ");
  });

  it("says unrated when no karte is closed", () => {
    const html = renderToStaticMarkup(<KarteAggregateHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />);

    expect(html).toContain("未評価");
  });
});
```

`src/app/page.test.tsx` と `src/app/page.feed-fetch.test.tsx`: `useRecentKarte` の mock が返す値を、`entries` の代わりに `kartes` を持つものにする。`page.test.tsx` では `const emptyList = ...` の次の行に `const emptyKarte = { kartes: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn(), refresh: vi.fn() };` を追加し、`karteMocks.useRecentKarte.mockReturnValue(emptyList);` をすべて `karteMocks.useRecentKarte.mockReturnValue(emptyKarte);` にする。`page.feed-fetch.test.tsx` では `vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: () => emptyList }));` を `vi.mock("@/modules/karte/hooks/useRecentKarte", () => ({ useRecentKarte: () => ({ ...emptyList, kartes: [] }) }));` にする。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte/components src/app/page.test.tsx src/app/page.feed-fetch.test.tsx`
Expected: FAIL（`./KarteEventFields` を解決できない、`KarteEntryCard` の新しい props と表示、`KarteAggregateHeader` の表示）

- [ ] **Step 3: 部品を実装する**

`src/modules/karte/components/KarteRatingSelect.tsx`:

```tsx
"use client";

import { Select } from "@/components/ui/select";

interface KarteRatingSelectProps {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
}

export function KarteRatingSelect({ value, onChange, disabled }: KarteRatingSelectProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      予約・接客の信頼性
      <Select
        value={value === null ? "" : String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">未評価</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)}
            {"☆".repeat(5 - n)} ({n})
          </option>
        ))}
      </Select>
    </label>
  );
}
```

`src/modules/karte/components/KarteEventFields.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KARTE_OUTCOMES, KARTE_STAGES, KARTE_TAGS, MAX_NOTE_LENGTH, isNoteRequired } from "../lib/catalog";
import { todayInJapan } from "../lib/dates";
import type { KarteEventInput, KarteStage } from "../types";

export function emptyKarteEvent(today: string = todayInJapan()): KarteEventInput {
  return { stage: "reservation", outcome: KARTE_OUTCOMES.reservation[0].code, tags: [], note: "", occurredOn: today };
}

export function isKarteEventReady(event: KarteEventInput): boolean {
  if (event.occurredOn === "" || event.note.length > MAX_NOTE_LENGTH) return false;
  return !isNoteRequired(event.stage, event.outcome) || event.note.trim() !== "";
}

interface KarteEventFieldsProps {
  value: KarteEventInput;
  onChange: (next: KarteEventInput) => void;
}

export function KarteEventFields({ value, onChange }: KarteEventFieldsProps) {
  const toggleTag = (code: string) =>
    onChange({ ...value, tags: value.tags.includes(code) ? value.tags.filter((tag) => tag !== code) : [...value.tags, code] });

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        記録する段階
        <Select
          value={value.stage}
          onChange={(e) => {
            const stage = e.target.value as KarteStage;
            onChange({ ...value, stage, outcome: KARTE_OUTCOMES[stage][0].code, tags: [] });
          }}
        >
          {KARTE_STAGES.map((stage) => (
            <option key={stage.code} value={stage.code}>
              {stage.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        対応結果
        <Select value={value.outcome} onChange={(e) => onChange({ ...value, outcome: e.target.value })}>
          {KARTE_OUTCOMES[value.stage].map((outcome) => (
            <option key={outcome.code} value={outcome.code}>
              {outcome.label}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <legend className="mb-1">詳細タグ（任意）</legend>
        {KARTE_TAGS[value.stage].map((tag) => (
          <label key={tag.code} className="flex items-center gap-1">
            <input type="checkbox" checked={value.tags.includes(tag.code)} onChange={() => toggleTag(tag.code)} />
            {tag.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        {isNoteRequired(value.stage, value.outcome) ? "補足（必須）" : "補足（任意）"}
        <Textarea value={value.note} maxLength={MAX_NOTE_LENGTH} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        発生日
        <Input type="date" value={value.occurredOn} max={todayInJapan()} onChange={(e) => onChange({ ...value, occurredOn: e.target.value })} />
      </label>
    </div>
  );
}
```

`src/modules/karte/components/KarteComposer.tsx` を次の内容にする。

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { KarteEventFields, emptyKarteEvent, isKarteEventReady } from "./KarteEventFields";
import { KarteRatingSelect } from "./KarteRatingSelect";

interface KarteComposerProps {
  targetProfileId: string;
  onCreated?: () => void;
}

export function KarteComposer({ targetProfileId, onCreated }: KarteComposerProps) {
  const { create, loading, error } = useKarteMutations();
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!(await create(targetProfileId, rating, event))) return;
        setEvent(emptyKarteEvent());
        setRating(null);
        onCreated?.();
      }}
      className="flex flex-col gap-3 border-b border-border p-4"
    >
      <KarteEventFields value={event} onChange={setEvent} />
      <KarteRatingSelect value={rating} onChange={setRating} />
      <p className="text-xs text-text-secondary">星は記録中なら未評価のままにできます。完了するときに必要です。</p>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error.message}
        </p>
      )}
      <Button type="submit" size="sm" disabled={loading || !isKarteEventReady(event)}>
        カルテを作成
      </Button>
    </form>
  );
}
```

`src/modules/karte/components/KarteEntryCard.tsx` を次の内容にする。

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IdentityLink } from "@/components/ui/identity-link";
import { RatingStars } from "@/components/ui/rating-stars";
import { formatTimeAgo } from "@/lib/utils/date";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import type { Karte } from "../types";
import { KarteEventFields, emptyKarteEvent, isKarteEventReady } from "./KarteEventFields";
import { KarteRatingSelect } from "./KarteRatingSelect";

interface KarteEntryCardProps {
  karte: Karte;
  mode: "my" | "target" | "recent";
  onChanged?: () => void;
}

export function KarteEntryCard({ karte, mode, onChanged }: KarteEntryCardProps) {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const { updateRating, close, reopen, addEvent, remove, loading, error } = useKarteMutations();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(() => emptyKarteEvent());
  const writtenAsOtherProfile = mode === "my" && karte.authorProfileId !== activeProfileId;
  const identityUsername = mode === "my" ? karte.targetUsername : karte.authorUsername;
  const identityAvatarUrl = mode === "my" ? karte.targetAvatarUrl : karte.authorAvatarUrl;
  const latest = karte.events[karte.events.length - 1];
  const open = karte.status === "open";
  const afterChange = (result: unknown) => {
    if (result) onChanged?.();
  };

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {mode === "recent" ? (
          <>
            <IdentityLink username={karte.authorUsername} avatarUrl={karte.authorAvatarUrl} />
            <span className="text-text-secondary">→</span>
            <IdentityLink username={karte.targetUsername} avatarUrl={karte.targetAvatarUrl} />
          </>
        ) : (
          <IdentityLink username={identityUsername} avatarUrl={identityAvatarUrl} />
        )}
        <span className="text-text-secondary">{formatTimeAgo(karte.createdAt)}</span>
        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
          {open ? "記録中" : "完了"}
        </span>
      </div>
      {writtenAsOtherProfile && (
        <p className="mt-1 text-xs text-text-secondary">
          {karte.authorUsername ? `@${karte.authorUsername} として記録` : "削除したプロフィールで記録"}
        </p>
      )}
      <div className="mt-1">
        {karte.rating === null ? (
          <span className="text-sm text-text-secondary">未評価</span>
        ) : (
          <RatingStars value={karte.rating} className="text-base" />
        )}
      </div>
      {latest && (
        <div className="mt-2 text-sm">
          <p className="font-bold">
            {stageLabel(latest.stage)}・{outcomeLabel(latest.stage, latest.outcome)}
          </p>
          {latest.tags.length > 0 && (
            <p className="text-xs text-text-secondary">{latest.tags.map((tag) => tagLabel(latest.stage, tag)).join("・")}</p>
          )}
          {latest.note && <p className="mt-1 whitespace-pre-wrap">{latest.note}</p>}
        </div>
      )}
      {karte.events.length > 1 && <p className="mt-1 text-xs text-text-secondary">ほか {karte.events.length - 1} 件の出来事</p>}
      {karte.isMine && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {open && (
            <KarteRatingSelect
              value={karte.rating}
              disabled={loading}
              onChange={async (rating) => afterChange(await updateRating(karte.id, rating))}
            />
          )}
          {open && adding && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await addEvent(karte.id, draft))) return;
                setAdding(false);
                setDraft(emptyKarteEvent());
                onChanged?.();
              }}
              className="flex flex-col gap-2"
            >
              <KarteEventFields value={draft} onChange={setDraft} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading || !isKarteEventReady(draft)}>
                  追記する
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(false)}>
                  やめる
                </Button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-3 text-text-secondary">
            {open && !adding && (
              <button type="button" onClick={() => setAdding(true)} className="hover:text-text-primary">
                出来事を追加
              </button>
            )}
            {open && (
              <button
                type="button"
                disabled={loading || karte.rating === null}
                onClick={async () => afterChange(await close(karte.id))}
                className="hover:text-text-primary disabled:opacity-50"
              >
                完了する
              </button>
            )}
            {!open && (
              <button
                type="button"
                disabled={loading}
                onClick={async () => afterChange(await reopen(karte.id))}
                className="hover:text-text-primary"
              >
                再オープン
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                if (!confirm("このカルテを削除しますか？")) return;
                if (await remove(karte.id)) onChanged?.();
              }}
              className="hover:text-text-primary"
            >
              削除
            </button>
          </div>
          {open && karte.rating === null && <p className="text-xs text-text-secondary">完了するには星を選んでください</p>}
          {error && (
            <p className="text-xs text-error" role="alert">
              {error.message}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
```

`src/modules/karte/components/KarteAggregateHeader.tsx` を次の内容にする。

```tsx
import { RatingStars } from "@/components/ui/rating-stars";
import type { ReliabilitySummary } from "../types";

export function KarteAggregateHeader({ reliability }: { reliability: ReliabilitySummary }) {
  if (reliability.averageRating === null) {
    return <div className="px-4 py-3 text-sm text-text-secondary">未評価（完了したカルテはまだありません）</div>;
  }
  return (
    <div className="flex flex-col gap-1 px-4 py-3 text-sm">
      <p className="text-xs text-text-secondary">予約・接客の信頼性（参考評価）</p>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">{reliability.averageRating.toFixed(1)} / 5.0</span>
        <RatingStars value={reliability.averageRating} />
      </div>
      <p className="text-xs text-text-secondary">
        {reliability.raterCount}人が評価 · {reliability.karteCount}件の完了済みカルテ
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 画面を新しい形に合わせる**

`src/modules/karte/components/GuestKarteTab.tsx` を次の内容にする。

```tsx
"use client";

import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteAggregateHeader } from "./KarteAggregateHeader";
import { KarteComposer } from "./KarteComposer";
import { KarteEntryCard } from "./KarteEntryCard";

export function GuestKarteTab({ guestProfileId }: { guestProfileId: string }) {
  const { kartes, reliability, hasMore, loading, loadMore, refresh } = useGuestKarte(guestProfileId);

  return (
    <div>
      <KarteAggregateHeader reliability={reliability} />
      <KarteComposer targetProfileId={guestProfileId} onCreated={refresh} />
      {kartes.map((karte) => (
        <KarteEntryCard key={karte.id} karte={karte} mode="target" onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-text-secondary">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="block w-full px-4 py-3 text-sm text-text-secondary hover:text-text-primary"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
```

`src/app/karte/my/page.tsx`: `const { entries, hasMore, loading, loadMore, refresh } = useMyKarte();` を `const { kartes, hasMore, loading, loadMore, refresh } = useMyKarte();` にし、`{entries.map((e) => (<KarteEntryCard key={e.id} entry={e} mode="my" onChanged={refresh} />))}` を次にする。

```tsx
      {kartes.map((karte) => (
        <KarteEntryCard key={karte.id} karte={karte} mode="my" onChanged={refresh} />
      ))}
```

`src/app/page.tsx` の `karteContent` の `useMemo` を次にする。

```tsx
  const karteContent = useMemo(() => {
    if (karte.loading && karte.kartes.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (karte.error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    return (
      <>
        {karte.kartes.map((item) => (
          <KarteEntryCard key={item.id} karte={item} mode="recent" onChanged={karte.refresh} />
        ))}
        {karte.kartes.length === 0 && !karte.hasMore && (
          <p className="px-4 py-8 text-center text-text-secondary">まだカルテがありません</p>
        )}
        {karte.hasMore && (
          <div className="px-4 py-4 text-center">
            <Button variant="secondary" onClick={() => karte.loadMore()} disabled={karte.loading}>
              {karte.loading ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [karte.loading, karte.error, karte.kartes, karte.hasMore, karte.refresh, karte.loadMore]);
```

`src/app/dev/ui/karte/page.tsx` を次の内容にする。

```tsx
"use client";

import { KarteAggregateHeader } from "@/modules/karte/components/KarteAggregateHeader";
import { KarteComposer } from "@/modules/karte/components/KarteComposer";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import type { Karte } from "@/modules/karte/types";

const mockKartes: Karte[] = [
  {
    id: "k1",
    authorProfileId: "cast-demo",
    authorUsername: "yuna",
    authorAvatarUrl: "",
    targetProfileId: "guest-demo",
    targetUsername: "guest_demo",
    targetAvatarUrl: "",
    isMine: true,
    rating: null,
    status: "open",
    events: [
      { id: "e1", stage: "reservation", outcome: "booked", tags: ["smooth_contact"], note: "", occurredOn: "2026-10-10", createdAt: "", updatedAt: "" },
    ],
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-10T10:00:00Z",
    closedAt: null,
  },
  {
    id: "k2",
    authorProfileId: "cast-other",
    authorUsername: "sakura",
    authorAvatarUrl: "",
    targetProfileId: "guest-demo",
    targetUsername: "guest_demo",
    targetAvatarUrl: "",
    isMine: false,
    rating: 2,
    status: "closed",
    events: [
      { id: "e2", stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" },
      { id: "e3", stage: "service", outcome: "completed_with_issues", tags: ["late"], note: "30分遅刻", occurredOn: "2026-10-02", createdAt: "", updatedAt: "" },
    ],
    createdAt: "2026-10-01T14:30:00Z",
    updatedAt: "2026-10-02T14:30:00Z",
    closedAt: "2026-10-02T15:00:00Z",
  },
];

export default function DevUiKartePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteAggregateHeader</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          <KarteAggregateHeader reliability={{ averageRating: 3.8, raterCount: 8, karteCount: 12 }} />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-divider">
          <KarteAggregateHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteComposer (no live API)</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          <KarteComposer targetProfileId="guest-demo-noop" />
        </div>
      </section>

      <section className="flex flex-col">
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteEntryCard</h2>
        {mockKartes.map((karte) => (
          <KarteEntryCard key={karte.id} karte={karte} mode="target" />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: すべてのテストと型検査が通ることを確認する**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run`
Expected: すべて PASS

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec tsc --noEmit`
Expected: 出力なし

Run: `cd dystopia/frontend && /usr/bin/grep -rnE 'KarteEntry\b|KarteAggregate\b|KarteAccess|useCreateKarte|useUpdateKarte|useDeleteKarte|useReportKarte|mapKarteEntryToView|getMyAccess|reportEntry' src --include=*.ts --include=*.tsx | /usr/bin/grep -v '^src/stub/'`
Expected: 出力なし

- [ ] **Step 6: コミットする**

```bash
git add -A dystopia/frontend/src
git status --short
git commit -s -m "feat(dystopia/frontend): record, add to, close and reopen a karte from the existing screens"
```

---

### Task 8: Whole-branch verification

このタスクは実装担当ではなく、plan を進行するセッション（controller）が行う。

- [ ] **Step 1: monolith と frontend の全テスト、型検査、ビルド**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/karte-rspec.txt 2>&1; grep -E '^[0-9]+ examples' /tmp/karte-rspec.txt`
Expected: `0 failures`

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run && env -u NODE_OPTIONS pnpm exec tsc --noEmit && env -u NODE_OPTIONS pnpm build`
Expected: すべて成功

- [ ] **Step 2: 変更範囲を確かめる**

Run: `git diff --stat origin/refactor/dystopia-design-foundation -- proto dystopia/monolith | tail -3` と `git diff --name-only origin/refactor/dystopia-design-foundation -- dystopia/monolith proto | /usr/bin/grep -vE '(slices|spec/slices)/karte/|stubs/karte/|proto/dystopia/karte/|config/db/migrate/20261016|config/db/seeds|spec/config/db/seeds_spec.rb|identity/use_cases/account/purge_identity|identity/use_cases/account/purge_wiring_spec|identity/use_cases/account/purge_identity_spec'`
Expected: 2 つ目のコマンドは出力なし（karte と、spec に記載した退会処理・seed・migration 以外に変更がない）

Run: `git diff --name-only origin/refactor/dystopia-design-foundation -- dystopia/frontend/src/stub dystopia/monolith/stubs`
Expected: `karte` の stub だけ

- [ ] **Step 3: 実機で確認する**

使い捨て DB を作り、monolith と frontend を起動する（第 1 段の plan の Task 9 Step 5 と同じ手順。DB 名は `monolith_e2e`、gRPC は 9055、frontend は 3055、ブラウザは `http://localhost:3055`）。seed のキャスト（`+819000000101`〜`103`）とゲストでログインし、次を確かめる。

| 操作 | 期待する結果 |
|---|---|
| キャストでゲストのプロフィールを開く | カルテタブに「未評価（完了したカルテはまだありません）」と作成フォームが出る。星は「未評価」が選ばれている |
| 予約段階・予約成立でカルテを作成する | 一覧に「記録中」「未評価」「予約・問い合わせ・予約成立」のカードが出る |
| 「完了する」を見る | 押せない状態で、「完了するには星を選んでください」と出る |
| 出来事を追加（接客・途中終了、補足なし） | 追記ボタンが押せない。補足を書くと押せ、カードの最後の出来事が「接客・途中終了」になる |
| 星を 4 にして完了する | 「完了」に変わり、平均評価が「4.0 / 5.0」「1人が評価 · 1件の完了済みカルテ」になる |
| 別のキャストで同じゲストに星 2 のカルテを作って完了する | 平均評価が「3.0 / 5.0」「2人が評価 · 2件」になる |
| 最初のキャストで再オープンする | 平均評価が「2.0 / 5.0」「1人が評価 · 1件」になる |
| ホームのカルテタブ | 記録中のカルテも出る |
| ゲストでログインする | ナビ・作成メニュー・ホームのタブにカルテが出ない。`/karte/my` で「カルテはキャストだけが使えます」 |
| 作成メニュー → カルテ → ゲストを選ぶ → 作成 | シートの中で作成でき、トーストが出て閉じる |

monolith と frontend のログに ERROR がないことも確かめる。後片付けは第 1 段の plan の Task 9 Step 8 と同じ（server を止め、`monolith_e2e_test` を drop し、`next dev` が書き出した `AGENTS.md`・`CLAUDE.md` を消す）。

- [ ] **Step 4: push して PR を更新する**

```bash
git push
```

Draft PR #1542 の説明の `## Status` を、実施した検証（コマンドと結果）に書き換える。本番では deploy 時の migration で旧 3 表とその行が削除されることを、PR の説明に明記する。PR は Draft のままにする。
