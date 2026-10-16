# Dystopia Karte Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カルテの画面を #1517 のモックの形（要約のカード、詳細シート、作成・追記・編集のフォーム、信頼性の見出し、件数つきの自分のカルテ）に作り直し、一覧の並び順を最後の動き（ホームは最新の出来事の発生日）にする。

**Architecture:** monolith は `karte.kartes` に並び順の 2 列を足し、`Karte` に表示名と最後の動きの日時、`ListMyKartesResponse` に件数を足す。frontend は、要約だけの `KarteCard` と、操作をすべて持つ `KarteDetailSheet`（第 1 段の `SideSheet`）を作り、一覧ごとに開いているカルテの id を持つ。操作のあとは、一覧と詳細の hook が登録した取り直し関数を `revalidateKarte()` でまとめて呼ぶ。

**Tech Stack:** Hanami 2 + ROM-SQL 3.7 + Sequel 5.99 + PostgreSQL 18 / gruf (gRPC) / buf / Next.js 16 + protobuf-es v2 + connect / SWR 2.5.1 / zustand / vitest 5 + happy-dom

**Spec:** `docs/superpowers/specs/2026-10-16-dystopia-karte-screens-design.md`

## Global Constraints

- 作業ディレクトリは worktree（`/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/refactor-dystopia-design-foundation`）。ブランチは `feat/dystopia-karte-screens`
- Ruby のコマンドは `dystopia/monolith` で `rbenv exec bundle exec ...` として実行する
- rspec は `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt` で実行する（stderr に大量の warning が出るためファイルへ出す）。test DB は `monolith_test`
- migration は `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec hanami db migrate` で test DB に流す。最後に出る pg_dump の version 不一致のエラーは無視してよい。`config/db/structure.sql` の差分は commit しない（`git checkout -- config/db/structure.sql`）
- frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` として実行する
- proto のスタブは `karte` package の差分だけを commit する。生成で出た他 package の差分は `git checkout --` で戻し、未追跡の `dystopia/frontend/src/stub/billing` は削除する
- 並び順: ゲスト別と自分の一覧は `last_activity_at DESC, id DESC`。新着は `last_occurred_on DESC, created_at DESC, id DESC`
- `last_activity_at` を進めるのは、作成・出来事の追加・完了・再オープンだけ。出来事の編集・削除と星の変更では進めない
- `last_occurred_on` は、作成と出来事の追加・編集・削除のたびに、そのカルテの出来事の発生日の最大値にする
- 件数（`KarteCounts`）は `ListMyKartes` の cursor のない最初のページでだけ数え、続きのページでは 0 を返す
- 画面の文言は spec の表のとおりに一字一句合わせる（各 Task に転記済み）
- 第 1 段の constraint（作成ボタンの花形メニュー、FAB、ブレークポイントを変えない）を守る
- 第 2 段の業務ルール（星は完了するときに必須、補足必須の対応結果、出来事は 1 件以上、作成者だけが操作できる）を変えない
- 依存を追加しない
- コードコメントは英語・1 行・「なぜ他のやり方を採らなかったか」だけ。タスクや変更への言及を書かない。`// FALLBACK:`・`# FALLBACK:` などのマーカー規約に従う
- コミットは `git commit -s`。`Co-Authored-By` を付けない。メッセージは英語
- DB を使う spec は、同じ example の中で作った行の並びを比べるとき、並び順の列を明示的に更新してから比べる（同じ transaction 内では `now()` が同値になるため）
- happy-dom のテストで zustand の store の値を変えるときは、`renderToStaticMarkup` ではなく `createRoot` + `act` で描く（`renderToStaticMarkup` は store の初期値でしか描かない）
- frontend の `tsc --noEmit` は Task 3 の後は Task 6 が終わるまで失敗しうる（型を広げ、古い部品を Task 6 で消すため）。Task 3〜5 では自分のテストファイルだけを vitest で確かめる

## Review Focus

- 別の並び順の cursor や壊れた cursor を渡されたら、500 にせず最初のページを返す（Task 1）
- さかのぼった日付の出来事を追記しても、`last_occurred_on` は下がらない。最大の出来事を消すと下がる（Task 1）
- 続きのページを読んでいる間に先頭へ上がったカルテが、2 ページ目にも出たとき、一覧に同じカルテを 2 つ描かない（Task 3）
- 詳細シートを開いている間に、他のタブでそのカルテが削除されたら、シートを閉じる（Task 5）
- 補足必須の対応結果で、空白だけの補足では保存ボタンを押せない（Task 4）

---

## File Structure

monolith（`dystopia/monolith/`）:

| ファイル | 責務 | Task |
|---|---|---|
| `config/db/migrate/20261017000000_add_karte_ordering_columns.rb` | 並び順の 2 列と索引 | 1 |
| `slices/karte/relations/kartes.rb` | 2 列の定義 | 1 |
| `slices/karte/repositories/karte_repository.rb` | 並び順ごとの一覧と cursor、列の更新、件数 | 1, 2 |
| `slices/karte/use_cases/{add,update,delete}_karte_event.rb`, `close_karte.rb`, `reopen_karte.rb`, `create_karte.rb` | 列の更新 | 1 |
| `slices/karte/use_cases/page_kartes.rb`, `list_recent_kartes.rb` | 並び順に応じた cursor | 1 |
| `proto/dystopia/karte/v1/service.proto` | 表示名・最後の動き・件数 | 2 |
| `slices/karte/use_cases/present_kartes.rb`, `list_my_kartes.rb`, `grpc/karte_handler.rb` | 表示名・最後の動き・件数を返す | 2 |

frontend（`dystopia/frontend/src/`）:

| ファイル | 責務 | Task |
|---|---|---|
| `stub/karte/v1/service_pb.ts` | 生成 | 3 |
| `modules/karte/types.ts`, `lib/mappers.ts`, `app/api/karte/my/route.ts` | 新しい項目と件数 | 3 |
| `modules/karte/lib/revalidate.ts` | 取り直し関数の登録と `revalidateKarte()` | 3 |
| `modules/karte/lib/uniqueKartes.ts` | 一覧の id 重複の除去 | 3 |
| `modules/karte/hooks/useKarte.ts` | 1 件取得 | 3 |
| `modules/karte/hooks/use{My,Guest,Recent}Karte.ts`, `useKarteMutations.ts` | 登録、重複除去、件数、操作後の取り直し | 3 |
| `modules/karte/components/KarteRatingInput.tsx` | 星のボタン | 4 |
| `modules/karte/components/KarteEventForm.tsx` | 作成・追記・編集のフォーム | 4 |
| `modules/karte/components/KarteReliabilityHeader.tsx` | 信頼性の見出し | 4 |
| `modules/karte/components/KarteCard.tsx` | 要約のカード | 4 |
| `modules/karte/components/KarteDetailSheet.tsx` | 詳細シート | 5 |
| `modules/karte/components/KarteList.tsx` | カードの一覧と詳細シートの開閉 | 5 |
| `components/compose/ComposeToSheet.tsx` | 新しいフォームと、選び済みのゲスト | 6 |
| `modules/karte/components/GuestKarteTab.tsx`, `app/page.tsx`, `app/karte/my/page.tsx`, `app/u/[username]/page.tsx`, `app/dev/ui/karte/page.tsx` | 画面の差し替え | 6 |

削除（Task 6）: `KarteEntryCard.tsx`・`KarteComposer.tsx`・`KarteEventFields.tsx`・`KarteRatingSelect.tsx`・`KarteAggregateHeader.tsx` と、それぞれのテスト。

---

### Task 1: Ordering columns

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261017000000_add_karte_ordering_columns.rb`
- Modify: `dystopia/monolith/slices/karte/relations/kartes.rb`
- Modify: `dystopia/monolith/slices/karte/repositories/karte_repository.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/create_karte.rb`, `add_karte_event.rb`, `update_karte_event.rb`, `delete_karte_event.rb`, `close_karte.rb`, `reopen_karte.rb`, `page_kartes.rb`, `list_recent_kartes.rb`
- Test: `dystopia/monolith/spec/slices/karte/repositories/karte_repository_spec.rb`, `spec/slices/karte/use_cases/karte_lifecycle_spec.rb`, `spec/slices/karte/use_cases/list_kartes_spec.rb`

**Interfaces:**
- Consumes: 第 2 段の `KarteRepository`（`create`・`close`・`reopen`・`touch`・`lock`・`list_*`）、`PageKartes#call(rows:, limit:, viewer_account_id:)`
- Produces:
  - 列 `karte.kartes.last_activity_at`（timestamptz）・`last_occurred_on`（date）、relation の属性 `last_activity_at`・`last_occurred_on`
  - `KarteRepository#create(author_account_id:, author_profile_id:, target_profile_id:, rating:, occurred_on: nil)`
  - `KarteRepository#record_activity(id)`、`#refresh_last_occurred_on(id)`
  - `KarteRepository#cursor_for(karte, order:)`（`order` は `:activity` か `:occurred`）
  - `PageKartes#call(rows:, limit:, viewer_account_id:, order: :activity)`

- [ ] **Step 1: Write the migration**

`dystopia/monolith/config/db/migrate/20261017000000_add_karte_ordering_columns.rb`:

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Defaults keep inserts from the previous app working until the app is replaced after this migration.
    alter_table(:"karte__kartes") do
      add_column :last_activity_at, :timestamptz, null: false, default: Sequel.lit("now()")
      add_column :last_occurred_on, :date, null: false, default: Sequel.lit("CURRENT_DATE")
    end

    run <<~SQL
      UPDATE karte.kartes
        SET last_activity_at = updated_at,
            last_occurred_on = COALESCE(
              (SELECT max(occurred_on) FROM karte.events WHERE karte.events.karte_id = karte.kartes.id),
              CURRENT_DATE
            )
    SQL

    run "DROP INDEX karte.idx_karte_kartes_target_created"
    run "DROP INDEX karte.idx_karte_kartes_author_created"
    run "DROP INDEX karte.idx_karte_kartes_created"
    run <<~SQL
      CREATE INDEX idx_karte_kartes_target_activity
        ON karte.kartes (target_profile_id, last_activity_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_author_activity
        ON karte.kartes (author_account_id, last_activity_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_karte_kartes_recent_occurred
        ON karte.kartes (last_occurred_on DESC, created_at DESC, id DESC)
    SQL
  end

  down do
    run "DROP INDEX karte.idx_karte_kartes_target_activity"
    run "DROP INDEX karte.idx_karte_kartes_author_activity"
    run "DROP INDEX karte.idx_karte_kartes_recent_occurred"
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
    alter_table(:"karte__kartes") do
      drop_column :last_occurred_on
      drop_column :last_activity_at
    end
  end
end
```

- [ ] **Step 2: Run the migration on the test DB over an existing row and check the columns**

migration の前に、既存の行の代わりに 1 行入れておく:

```bash
DB=postgres://postgres:password@localhost:5432/monolith_test
psql $DB -c "INSERT INTO karte.kartes (id, author_account_id, author_profile_id, target_profile_id, status, updated_at) VALUES ('01990000-0000-7000-8000-000000000001', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'open', '2026-10-01 09:00:00+09')"
psql $DB -c "INSERT INTO karte.events (id, karte_id, stage, outcome, occurred_on) VALUES (gen_random_uuid(), '01990000-0000-7000-8000-000000000001', 'reservation', 'booked', '2026-09-28'), (gen_random_uuid(), '01990000-0000-7000-8000-000000000001', 'service', 'completed', '2026-09-30')"
```

Run:

```bash
cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec hanami db migrate; git checkout -- config/db/structure.sql 2>/dev/null
psql $DB -c '\d karte.kartes' | grep -E "last_|idx_"
psql $DB -At -c "SELECT last_activity_at = updated_at, last_occurred_on FROM karte.kartes WHERE id = '01990000-0000-7000-8000-000000000001'"
psql $DB -c "DELETE FROM karte.kartes WHERE id = '01990000-0000-7000-8000-000000000001'"
```

Expected:
- `last_activity_at`・`last_occurred_on` の 2 列と、`idx_karte_kartes_target_activity`・`idx_karte_kartes_author_activity`・`idx_karte_kartes_recent_occurred`・`idx_karte_kartes_reliability` の 4 索引が出る。`*_created` の索引は出ない
- 入れておいた行が `t|2026-09-30`（最後の動きは `updated_at`、発生日は出来事の最大値）
- 最後の `DELETE` で出来事も一緒に消える（`ON DELETE CASCADE`）

- [ ] **Step 3: Add the attributes to the relation**

`dystopia/monolith/slices/karte/relations/kartes.rb` の `attribute :updated_at, Types::Time` の次に足す:

```ruby
        attribute :last_activity_at, Types::Time
        attribute :last_occurred_on, Types::Date
```

- [ ] **Step 4: Write the failing repository specs**

`dystopia/monolith/spec/slices/karte/repositories/karte_repository_spec.rb` を次のように変える。

`def set_created_at(record, time)` の helper を、次の helper に置き換える:

```ruby
  def set_order(record, **attrs)
    db[:karte__kartes].where(id: record.id).update(attrs)
  end

  def column(record, name)
    db[:karte__kartes].where(id: record.id).get(name)
  end
```

`describe "#create"` の中に足す:

```ruby
    it "starts the ordering at its creation and its first event's date" do
      record = repo.create(
        author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7,
        target_profile_id: target, rating: nil, occurred_on: Date.new(2026, 9, 30)
      )

      expect(record.last_occurred_on).to eq(Date.new(2026, 9, 30))
      expect(record.last_activity_at).to eq(record.created_at)
    end
```

`describe "listing"` の 2 つの example を、次の `describe "listing"` に置き換える:

```ruby
  describe "listing" do
    it "lists the kartes about a guest by the last activity, and continues from the cursor" do
      now = Time.now
      first = karte
      second = karte
      third = karte
      set_order(first, last_activity_at: now - 100)
      set_order(second, last_activity_at: now - 300)
      set_order(third, last_activity_at: now - 200)
      karte(target_profile_id: SecureRandom.uuid_v7)

      page = repo.list_by_target(target_profile_id: target, limit: 2)
      expect(page.map(&:id)).to eq([first.id, third.id, second.id])

      rest = repo.list_by_target(target_profile_id: target, limit: 2, cursor: repo.cursor_for(page[1], order: :activity))
      expect(rest.map(&:id)).to eq([second.id])
    end

    it "lists the kartes of an author account by the last activity" do
      now = Time.now
      author = SecureRandom.uuid_v7
      older = karte(author_account_id: author)
      newer = karte(author_account_id: author)
      karte
      set_order(older, last_activity_at: now - 200, created_at: now - 50)
      set_order(newer, last_activity_at: now - 100, created_at: now - 300)

      expect(repo.list_by_author(author_account_id: author, limit: 20).map(&:id)).to eq([newer.id, older.id])
    end

    it "lists the recent kartes by the latest event's date, then by creation within a day, and continues from the cursor" do
      now = Time.now
      day_old = karte
      today_early = karte
      today_late = karte
      set_order(day_old, last_occurred_on: Date.new(2026, 10, 14), created_at: now - 10)
      set_order(today_early, last_occurred_on: Date.new(2026, 10, 15), created_at: now - 300)
      set_order(today_late, last_occurred_on: Date.new(2026, 10, 15), created_at: now - 200)

      page = repo.list_recent(limit: 1)
      expect(page.map(&:id)).to eq([today_late.id, today_early.id])

      rest = repo.list_recent(limit: 1, cursor: repo.cursor_for(page[0], order: :occurred))
      expect(rest.map(&:id)).to eq([today_early.id, day_old.id])
    end

    it "reads a cursor of another ordering or a broken one as the first page" do
      record = karte
      other_ordering = repo.cursor_for(record, order: :occurred)

      expect(repo.list_by_target(target_profile_id: target, limit: 20, cursor: other_ordering).map(&:id)).to eq([record.id])
      expect(repo.list_recent(limit: 20, cursor: repo.cursor_for(record, order: :activity)).map(&:id)).to eq([record.id])
      expect(repo.list_recent(limit: 20, cursor: "not-a-cursor").map(&:id)).to eq([record.id])
    end
  end

  describe "#record_activity and #refresh_last_occurred_on" do
    it "moves the last activity to now" do
      record = karte
      set_order(record, last_activity_at: Time.now - 3600)

      repo.record_activity(record.id)

      expect(column(record, :last_activity_at)).to be > Time.now - 60
    end

    it "sets the latest date to the newest event's date and leaves it when the karte has no events" do
      record = karte
      db[:karte__events].insert(id: SecureRandom.uuid_v7, karte_id: record.id, stage: "service", outcome: "completed", occurred_on: Date.new(2026, 10, 3))
      db[:karte__events].insert(id: SecureRandom.uuid_v7, karte_id: record.id, stage: "reservation", outcome: "booked", occurred_on: Date.new(2026, 9, 28))

      repo.refresh_last_occurred_on(record.id)
      expect(column(record, :last_occurred_on)).to eq(Date.new(2026, 10, 3))

      db[:karte__events].where(karte_id: record.id).delete
      repo.refresh_last_occurred_on(record.id)
      expect(column(record, :last_occurred_on)).to eq(Date.new(2026, 10, 3))
    end
  end

  describe "#close and #reopen ordering" do
    it "moves the last activity on closing and on reopening" do
      record = karte(rating: 4)
      set_order(record, last_activity_at: Time.now - 3600)
      repo.close(record.id)
      expect(column(record, :last_activity_at)).to be > Time.now - 60

      set_order(record, last_activity_at: Time.now - 3600)
      repo.reopen(record.id)
      expect(column(record, :last_activity_at)).to be > Time.now - 60
    end

    it "leaves the last activity on a rating change" do
      record = karte
      past = Time.now - 3600
      set_order(record, last_activity_at: past)

      repo.update_rating(record.id, 3)

      expect(column(record, :last_activity_at)).to be_within(1).of(past)
    end
  end
```

- [ ] **Step 5: Run the repository spec to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/repositories/karte_repository_spec.rb > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（`unknown keyword: :occurred_on`、`unknown keyword: :order`、`undefined method 'record_activity'` など）

- [ ] **Step 6: Implement the repository**

`dystopia/monolith/slices/karte/repositories/karte_repository.rb` の `create`・`close`・`reopen`・`list_*`・`cursor_for`・`page` を次のように変える（`find`・`update_rating`・`lock`・`touch`・`delete`・`reliability`・private の `update` はそのまま）。

```ruby
      def create(author_account_id:, author_profile_id:, target_profile_id:, rating:, occurred_on: nil)
        attrs = {
          id: SecureRandom.uuid_v7,
          author_account_id: author_account_id,
          author_profile_id: author_profile_id,
          target_profile_id: target_profile_id,
          rating: rating,
          status: "open"
        }
        attrs[:last_occurred_on] = occurred_on if occurred_on
        karte_records.command(:create).call(attrs)
      end
```

```ruby
      def close(id)
        update(id, status: "closed", closed_at: Time.now, last_activity_at: Time.now)
      end

      def reopen(id)
        update(id, status: "open", closed_at: nil, last_activity_at: Time.now)
      end

      def record_activity(id)
        karte_records.by_pk(id).command(:update).call(last_activity_at: Time.now, updated_at: Time.now)
      end

      def refresh_last_occurred_on(id)
        latest = karte_records.dataset.db[:karte__events].where(karte_id: id).max(:occurred_on)
        karte_records.dataset.where(id: id).update(last_occurred_on: latest) if latest
      end
```

```ruby
      def list_by_target(target_profile_id:, limit:, cursor: nil)
        page_by_activity(karte_records.where(target_profile_id: target_profile_id), limit, cursor)
      end

      def list_by_author(author_account_id:, limit:, cursor: nil)
        page_by_activity(karte_records.where(author_account_id: author_account_id), limit, cursor)
      end

      def list_recent(limit:, cursor: nil)
        page_by_occurred(karte_records, limit, cursor)
      end

      def cursor_for(karte, order:)
        if order == :occurred
          encode_cursor(last_occurred_on: karte.last_occurred_on.iso8601, created_at: karte.created_at.iso8601(6), id: karte.id)
        else
          encode_cursor(last_activity_at: karte.last_activity_at.iso8601(6), id: karte.id)
        end
      end
```

private の `def page(scope, limit, cursor)` を消し、次の 4 つを足す:

```ruby
      def page_by_activity(scope, limit, cursor)
        after = activity_cursor(cursor)
        if after
          at = after[:last_activity_at]
          last_id = after[:id]
          scope = scope.where { (last_activity_at < at) | ((last_activity_at =~ at) & (id < last_id)) }
        end
        scope.order { [last_activity_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def page_by_occurred(scope, limit, cursor)
        after = occurred_cursor(cursor)
        if after
          on = after[:last_occurred_on]
          at = after[:created_at]
          last_id = after[:id]
          scope = scope.where {
            (last_occurred_on < on) |
              ((last_occurred_on =~ on) & ((created_at < at) | ((created_at =~ at) & (id < last_id))))
          }
        end
        scope.order { [last_occurred_on.desc, created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def activity_cursor(cursor)
        decoded = decode_cursor(cursor, keys: [:last_activity_at, :id])
        return nil unless decoded&.values&.all?

        { last_activity_at: Time.parse(decoded[:last_activity_at]), id: decoded[:id] }
      rescue ArgumentError, TypeError
        # FALLBACK: Read a cursor of another ordering or a broken one as the first page.
        nil
      end

      def occurred_cursor(cursor)
        decoded = decode_cursor(cursor, keys: [:last_occurred_on, :created_at, :id])
        return nil unless decoded&.values&.all?

        { last_occurred_on: Date.parse(decoded[:last_occurred_on]), created_at: decoded[:created_at], id: decoded[:id] }
      rescue ArgumentError, TypeError
        # FALLBACK: Read a cursor of another ordering or a broken one as the first page.
        nil
      end
```

`decode_cursor`（`lib/concerns/cursor_pagination.rb`）は `created_at` だけを `Time` に戻し、他のキーは文字列のまま返す。値が欠けたキーは `nil` になる。

- [ ] **Step 7: Run the repository spec to verify it passes**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/repositories/karte_repository_spec.rb > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: PASS（0 failures）

- [ ] **Step 8: Write the failing use case specs**

`dystopia/monolith/spec/slices/karte/use_cases/karte_lifecycle_spec.rb` の `def invalid(message)` の次に helper を足す:

```ruby
  def column(karte, name) = Hanami.app["db.gateway"].connection[:karte__kartes].where(id: karte[:id]).get(name)
  def set_activity(karte, time) = Hanami.app["db.gateway"].connection[:karte__kartes].where(id: karte[:id]).update(last_activity_at: time)
  def event_on(date) = event_input.merge(occurred_on: date)
```

ファイル末尾の `end` の直前に足す:

```ruby
  describe "ordering" do
    it "moves the karte up on adding an event, closing and reopening, but not on editing an event or the rating" do
      karte = create
      past = Time.now - 3600

      set_activity(karte, past)
      uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_on("2026-10-02"))
      expect(column(karte, :last_activity_at)).to be > Time.now - 60

      set_activity(karte, past)
      event_id = column_events(karte).first
      uc(:update_karte_event).call(viewer_account_id: cast_account, event_id: event_id, event: event_on("2026-10-01"))
      uc(:update_karte_rating).call(viewer_account_id: cast_account, karte_id: karte[:id], rating: 4)
      expect(column(karte, :last_activity_at)).to be_within(1).of(past)

      uc(:close_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])
      expect(column(karte, :last_activity_at)).to be > Time.now - 60

      set_activity(karte, past)
      uc(:reopen_karte).call(viewer_account_id: cast_account, karte_id: karte[:id])
      expect(column(karte, :last_activity_at)).to be > Time.now - 60
    end

    it "keeps the latest date at the newest event's date" do
      karte = create
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 1))

      uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_on("2026-09-20"))
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 1))

      newest = uc(:add_karte_event).call(viewer_account_id: cast_account, karte_id: karte[:id], event: event_on("2026-10-05"))
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 5))

      newest_id = newest[:events].find { |e| e[:occurred_on] == Date.new(2026, 10, 5) }[:id]
      uc(:delete_karte_event).call(viewer_account_id: cast_account, event_id: newest_id)
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 1))

      first_id = newest[:events].find { |e| e[:occurred_on] == Date.new(2026, 10, 1) }[:id]
      uc(:update_karte_event).call(viewer_account_id: cast_account, event_id: first_id, event: event_on("2026-10-03"))
      expect(column(karte, :last_occurred_on)).to eq(Date.new(2026, 10, 3))
    end
  end

  def column_events(karte)
    Hanami.app["db.gateway"].connection[:karte__events].where(karte_id: karte[:id]).order(:created_at, :id).select_map(:id)
  end
```

`dystopia/monolith/spec/slices/karte/use_cases/list_kartes_spec.rb` の `write` helper の `db[:karte__kartes].where(id: karte[:id]).update(created_at: created_at)` を次に替える:

```ruby
    db[:karte__kartes].where(id: karte[:id]).update(created_at: created_at, last_activity_at: created_at)
```

同じファイルの `it "refuses a guest viewer and a malformed target id"` の前に足す:

```ruby
  it "pages the recent kartes by the latest event's date" do
    now = Time.now
    older = write(account: cast_account, profile: persona, rating: nil, created_at: now - 20)
    newer = write(account: cast_account, profile: persona, rating: nil, created_at: now - 10)
    db[:karte__kartes].where(id: older[:id]).update(last_occurred_on: Date.new(2026, 10, 9))
    db[:karte__kartes].where(id: newer[:id]).update(last_occurred_on: Date.new(2026, 10, 8))

    page = uc(:list_recent_kartes).call(viewer_account_id: cast_account, limit: 1, cursor: nil)
    expect(page[:kartes].map { |k| k[:id] }).to eq([older[:id]])

    rest = uc(:list_recent_kartes).call(viewer_account_id: cast_account, limit: 1, cursor: page[:next_cursor])
    expect(rest[:kartes].map { |k| k[:id] }).to eq([newer[:id]])
  end
```

- [ ] **Step 9: Run the use case specs to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte/use_cases > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（`ordering` の 2 例と、新着のページの例。`PageKartes` がまだ `cursor_for(karte)` を 1 引数で呼ぶため、一覧の例も `missing keyword: :order` で落ちる）

- [ ] **Step 10: Update the use cases**

`create_karte.rb` の `karte_repo.create(` に `occurred_on: attrs[:occurred_on]` を足す:

```ruby
          karte = karte_repo.create(
            author_account_id: viewer_account_id,
            author_profile_id: viewer_profile_id,
            target_profile_id: target_profile_id,
            rating: rating,
            occurred_on: attrs[:occurred_on]
          )
```

`add_karte_event.rb` の `karte_repo.touch(locked.id)` を次の 2 行に替える:

```ruby
          karte_repo.record_activity(locked.id)
          karte_repo.refresh_last_occurred_on(locked.id)
```

`update_karte_event.rb` と `delete_karte_event.rb` の `karte_repo.touch(locked.id)` の次の行に足す:

```ruby
          karte_repo.refresh_last_occurred_on(locked.id)
```

`page_kartes.rb` の `call` を次に替える:

```ruby
      def call(rows:, limit:, viewer_account_id:, order: :activity)
        has_more = rows.length > limit
        visible = rows.first(limit)
        {
          kartes: present_kartes.call(kartes: visible, viewer_account_id: viewer_account_id),
          next_cursor: has_more ? karte_repo.cursor_for(visible.last, order: order) : nil,
          has_more: has_more
        }
      end
```

`list_recent_kartes.rb` の最後の行を次に替える:

```ruby
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id, order: :occurred)
```

`close_karte.rb` と `reopen_karte.rb` は repository の `close`・`reopen` が `last_activity_at` を進めるので変えない。

- [ ] **Step 11: Run the karte specs to verify they pass**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: PASS（0 failures）

- [ ] **Step 12: Run the whole monolith suite**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: 0 failures（`purge_wiring_spec.rb` と `profile_lifecycle_spec.rb` は `occurred_on` を渡さずに `create` を呼ぶが、既定値で通る）

- [ ] **Step 13: Commit**

```bash
cd dystopia/monolith
git checkout -- config/db/structure.sql 2>/dev/null
git add config/db/migrate/20261017000000_add_karte_ordering_columns.rb slices/karte spec/slices/karte
git commit -s -m "feat(dystopia/monolith): order kartes by their last activity and the feed by the latest event date"
```

---
### Task 2: Display names, last activity and my counts over RPC

**Files:**
- Modify: `proto/dystopia/karte/v1/service.proto`
- Generate: `dystopia/monolith/stubs/karte/v1/service_pb.rb`
- Modify: `dystopia/monolith/slices/karte/repositories/karte_repository.rb`
- Modify: `dystopia/monolith/slices/karte/use_cases/present_kartes.rb`, `list_my_kartes.rb`
- Modify: `dystopia/monolith/slices/karte/grpc/karte_handler.rb`
- Test: `dystopia/monolith/spec/slices/karte/repositories/karte_repository_spec.rb`, `spec/slices/karte/use_cases/karte_lifecycle_spec.rb`, `spec/slices/karte/use_cases/list_kartes_spec.rb`, `spec/slices/karte/grpc/karte_handler_spec.rb`

**Interfaces:**
- Consumes: Task 1 の relation の `last_activity_at`
- Produces:
  - proto: `Karte.last_activity_at = 15`（Timestamp）・`author_display_name = 16`・`target_display_name = 17`、`message KarteCounts { int32 total_count = 1; int32 open_count = 2; int32 closed_count = 3; }`、`ListMyKartesResponse.counts = 4`
  - `KarteRepository#counts_by_author(author_account_id:)` → `{ total:, open:, closed: }`
  - `ListMyKartes#call` の戻り値に `counts: { total:, open:, closed: }`（cursor がなければ数え、あれば 0）
  - `PresentKartes` の Hash に `author_display_name`・`target_display_name`・`last_activity_at`

- [ ] **Step 1: Change the proto**

`proto/dystopia/karte/v1/service.proto` の `message Karte` の `google.protobuf.Timestamp closed_at = 14;` の次に足す:

```proto
  google.protobuf.Timestamp last_activity_at = 15;
  string author_display_name = 16;
  string target_display_name = 17;
```

`message ListMyKartesResponse` の前に足す:

```proto
message KarteCounts {
  int32 total_count = 1;
  int32 open_count = 2;
  int32 closed_count = 3;
}
```

`message ListMyKartesResponse` に足す:

```proto
  KarteCounts counts = 4;
```

- [ ] **Step 2: Regenerate the monolith stubs**

Run: `cd dystopia/monolith && rbenv exec bundle exec ruby bin/codegen && git status --short stubs`
Expected: `stubs/karte/v1/service_pb.rb` が変更される。`karte` 以外の stub に差分が出たら `git checkout -- stubs/<その package>` で戻す

- [ ] **Step 3: Write the failing specs**

`spec/slices/karte/repositories/karte_repository_spec.rb` の `describe "#reliability"` の前に足す:

```ruby
  describe "#counts_by_author" do
    it "counts the account's kartes by state, across its profiles, leaving other accounts out" do
      author = SecureRandom.uuid_v7
      karte(author_account_id: author)
      karte(author_account_id: author, author_profile_id: SecureRandom.uuid_v7)
      closed(rating: 4, author_account_id: author)
      karte

      expect(repo.counts_by_author(author_account_id: author)).to eq(total: 3, open: 2, closed: 1)
      expect(repo.counts_by_author(author_account_id: SecureRandom.uuid_v7)).to eq(total: 0, open: 0, closed: 0)
    end
  end
```

`spec/slices/karte/use_cases/karte_lifecycle_spec.rb` の `describe "creating"` の中に足す:

```ruby
    it "presents the display names and the last activity" do
      named_cast = create_account_with_profile(account_id: cast_account, username: "yuna", display_name: "ゆな")
      named_guest = create_account_with_profile(account_id: create_account(role: 1), username: "hanako", display_name: "はなこ")

      karte = create(profile: named_cast, target: named_guest)

      expect(karte).to include(author_display_name: "ゆな", target_display_name: "はなこ")
      expect(karte[:last_activity_at]).to eq(karte[:created_at])
    end
```

`spec/slices/karte/use_cases/list_kartes_spec.rb` の `it "lists the viewer's own kartes across the account's profiles"` の次に足す:

```ruby
  it "counts the viewer's kartes on the first page only" do
    write(account: cast_account, profile: persona, rating: nil, created_at: Time.now - 20)
    write(account: cast_account, profile: persona, rating: 3, close: true, created_at: Time.now - 10)
    write(account: other_cast_account, profile: other_persona, rating: nil)

    first = uc(:list_my_kartes).call(viewer_account_id: cast_account, limit: 1, cursor: nil)
    expect(first[:counts]).to eq(total: 2, open: 1, closed: 1)

    rest = uc(:list_my_kartes).call(viewer_account_id: cast_account, limit: 1, cursor: first[:next_cursor])
    expect(rest[:counts]).to eq(total: 0, open: 0, closed: 0)
  end
```

`spec/slices/karte/grpc/karte_handler_spec.rb` の `describe "the list RPCs"` の中に足す:

```ruby
    it "returns the display names, the last activity and my counts" do
      act_as(cast_account, persona_a)
      created = create_karte

      expect(created.author_display_name).to eq("User")
      expect(created.target_display_name).to eq("User")
      expect(created.last_activity_at).not_to be_nil

      mine = handler_for(::Karte::V1::ListMyKartesRequest.new).list_my_kartes
      expect([mine.counts.total_count, mine.counts.open_count, mine.counts.closed_count]).to eq([1, 1, 0])
    end
```

（`create_account_with_profile` の既定の表示名は `"User"`。`spec/support/profile_fixtures.rb`）

- [ ] **Step 4: Run the specs to verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: FAIL（`undefined method 'counts_by_author'`、`author_display_name` が含まれない、`counts` が nil など 4 例）

- [ ] **Step 5: Implement**

`karte_repository.rb` の `reliability` の前に足す:

```ruby
      def counts_by_author(author_account_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with GROUP BY.
        by_status = karte_records.dataset.unordered
          .where(author_account_id: author_account_id)
          .group_and_count(:status)
          .to_a
          .to_h { |row| [row[:status], row[:count]] }
        open = by_status.fetch("open", 0)
        closed = by_status.fetch("closed", 0)
        { total: open + closed, open: open, closed: closed }
      end
```

`present_kartes.rb` の `present` の Hash を次に替える（`author_username` の次に表示名、`closed_at` の次に最後の動き）:

```ruby
        {
          id: karte.id,
          author_profile_id: karte.author_profile_id,
          author_username: author&.username || "",
          author_display_name: author&.display_name || "",
          author_avatar_url: avatar_url(author),
          target_profile_id: karte.target_profile_id,
          target_username: target&.username || "",
          target_display_name: target&.display_name || "",
          target_avatar_url: avatar_url(target),
          is_mine: karte.author_account_id == viewer_account_id,
          rating: karte.rating,
          status: karte.status,
          events: events.map { |event| present_event(event) },
          created_at: karte.created_at,
          updated_at: karte.updated_at,
          closed_at: karte.closed_at,
          last_activity_at: karte.last_activity_at
        }
```

`list_my_kartes.rb` の `call` を次に替える:

```ruby
      NO_COUNTS = { total: 0, open: 0, closed: 0 }.freeze

      def call(viewer_account_id:, limit:, cursor:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        limit = page_kartes.limit_for(limit)
        rows = karte_repo.list_by_author(author_account_id: viewer_account_id, limit: limit, cursor: cursor)
        counts = cursor.nil? ? karte_repo.counts_by_author(author_account_id: viewer_account_id) : NO_COUNTS
        page_kartes.call(rows: rows, limit: limit, viewer_account_id: viewer_account_id).merge(counts: counts)
      end
```

`karte_handler.rb` の `list_my_kartes` の最後の行を次に替える:

```ruby
        counts = result[:counts]
        ::Karte::V1::ListMyKartesResponse.new(
          **page_to_proto(result),
          counts: ::Karte::V1::KarteCounts.new(total_count: counts[:total], open_count: counts[:open], closed_count: counts[:closed])
        )
```

`karte_handler.rb` の `karte_to_proto` に足す（`author_username:` の次に `author_display_name:`、`target_username:` の次に `target_display_name:`、`closed_at:` の次に `last_activity_at:`）:

```ruby
          author_display_name: karte[:author_display_name],
```

```ruby
          target_display_name: karte[:target_display_name],
```

```ruby
          closed_at: timestamp(karte[:closed_at]),
          last_activity_at: timestamp(karte[:last_activity_at])
```

（`closed_at:` の行の末尾にカンマを足す）

- [ ] **Step 6: Run the karte specs to verify they pass**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/karte > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: PASS（0 failures）

- [ ] **Step 7: Run the whole monolith suite**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: 0 failures

- [ ] **Step 8: Commit**

```bash
git add proto/dystopia/karte/v1/service.proto dystopia/monolith/stubs/karte dystopia/monolith/slices/karte dystopia/monolith/spec/slices/karte
git status --short
git commit -s -m "feat(dystopia/monolith): return display names, the last activity and my karte counts"
```

`git status --short` に karte 以外の stub が残っていたら、commit の前に `git checkout --` で戻す。

---
### Task 3: Frontend data layer

**Files:**
- Generate: `dystopia/frontend/src/stub/karte/v1/service_pb.ts`
- Modify: `dystopia/frontend/src/modules/karte/types.ts`, `lib/mappers.ts`, `lib/mappers.test.ts`
- Modify: `dystopia/frontend/src/app/api/karte/my/route.ts`
- Create: `dystopia/frontend/src/modules/karte/lib/revalidate.ts`, `lib/revalidate.test.tsx`
- Create: `dystopia/frontend/src/modules/karte/lib/uniqueKartes.ts`, `lib/uniqueKartes.test.ts`
- Create: `dystopia/frontend/src/modules/karte/hooks/useKarte.ts`, `hooks/useKarte.test.tsx`
- Modify: `dystopia/frontend/src/modules/karte/hooks/useMyKarte.ts`, `useMyKarte.test.ts`, `useGuestKarte.ts`, `useRecentKarte.ts`, `useKarteMutations.ts`, `useKarteMutations.test.ts`, `index.ts`

**Interfaces:**
- Consumes: Task 2 の proto（`Karte.lastActivityAt`・`authorDisplayName`・`targetDisplayName`、`KarteCounts`、`ListMyKartesResponse.counts`）
- Produces:
  - 型: `Karte` に `authorDisplayName: string`・`targetDisplayName: string`・`lastActivityAt: string`。`KarteCounts { total: number; open: number; closed: number }`、`MyKartePage extends KartePage { counts: KarteCounts }`
  - `revalidateKarte(): Promise<unknown[]>`、`useKarteRevalidation(refresh: () => unknown): void`（`modules/karte/lib/revalidate.ts`）
  - `uniqueKartes(kartes: Karte[]): Karte[]`（`modules/karte/lib/uniqueKartes.ts`）
  - `useKarte(karteId: string | null, initial?: Karte)` → `{ karte: Karte | null; gone: boolean; error: unknown; refresh: () => void }`
  - `useMyKarte()` の戻り値に `counts: KarteCounts`
  - `useKarteMutations()` は成功・失敗のどちらでも `revalidateKarte()` を呼ぶ。戻り値の形は変えない

- [ ] **Step 1: Regenerate the frontend stub**

Run:

```bash
cd dystopia/frontend && env -u NODE_OPTIONS pnpm proto:gen && git status --short src/stub
```

Expected: `src/stub/karte/v1/service_pb.ts` が変更される。他の package の stub の差分は `git checkout -- src/stub/<package>` で戻し、未追跡の `src/stub/billing` があれば `rm -rf src/stub/billing` で消す。

- [ ] **Step 2: Write the failing mapper and data tests**

`src/modules/karte/lib/mappers.test.ts` の import を次に替える:

```ts
import { KarteCountsSchema, KarteEventSchema, KarteSchema, KarteStage, KarteStatus, ReliabilitySummarySchema } from "@/stub/karte/v1/service_pb";
import { eventInputToMessage, mapCountsToView, mapKarteToView, mapReliabilityToView } from "./mappers";
```

`describe("mapKarteToView", ...)` の中に足す:

```ts
  it("maps the display names and the last activity", () => {
    const view = mapKarteToView(
      create(KarteSchema, {
        id: "k-1",
        authorDisplayName: "ゆな",
        targetDisplayName: "はなこ",
        lastActivityAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
      })
    );

    expect(view.authorDisplayName).toBe("ゆな");
    expect(view.targetDisplayName).toBe("はなこ");
    expect(view.lastActivityAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
```

ファイル末尾に足す:

```ts
describe("mapCountsToView", () => {
  it("maps the counts and reads missing counts as zero", () => {
    expect(mapCountsToView(create(KarteCountsSchema, { totalCount: 3, openCount: 2, closedCount: 1 }))).toEqual({ total: 3, open: 2, closed: 1 });
    expect(mapCountsToView(undefined)).toEqual({ total: 0, open: 0, closed: 0 });
  });
});
```

`src/modules/karte/lib/uniqueKartes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Karte } from "../types";
import { uniqueKartes } from "./uniqueKartes";

const karte = (id: string, rating: number | null = null) => ({ id, rating }) as Karte;

describe("uniqueKartes", () => {
  it("keeps the first of each id in order", () => {
    const first = karte("a", 4);

    expect(uniqueKartes([first, karte("b"), karte("a", 1), karte("c")])).toEqual([first, karte("b"), karte("c")]);
  });
});
```

`src/modules/karte/lib/revalidate.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { revalidateKarte, useKarteRevalidation } from "./revalidate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Registered({ refresh }: { refresh: () => unknown }) {
  useKarteRevalidation(refresh);
  return null;
}

describe("revalidateKarte", () => {
  it("calls every registered refresh and stops calling one after it unmounts", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement("div", null, createElement(Registered, { refresh: first }), createElement(Registered, { refresh: second })));
    });

    await revalidateKarte();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(createElement(Registered, { refresh: first }));
    });
    await revalidateKarte();
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    await revalidateKarte();
    expect(first).toHaveBeenCalledTimes(2);
  });
});
```

`src/modules/karte/hooks/useKarte.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("@/lib/swr", () => ({ fetcher: mocks.fetcher }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "p-1" }),
}));

const { useKarte } = await import("./useKarte");
const { revalidateKarte } = await import("../lib/revalidate");

const initial = { id: "k-1", rating: null } as Karte;
const hook: { current: ReturnType<typeof useKarte> | null } = { current: null };
function Probe() {
  hook.current = useKarte("k-1", initial);
  return null;
}

async function mount() {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe)));
  });
  return root;
}

beforeEach(() => {
  mocks.fetcher.mockReset();
});

describe("useKarte", () => {
  it("shows the karte it was given, then the one it read", async () => {
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 4 } });
    const root = await mount();

    expect(mocks.fetcher).toHaveBeenCalledWith("/api/karte/k-1");
    expect(hook.current!.karte).toEqual({ id: "k-1", rating: 4 });
    expect(hook.current!.gone).toBe(false);
    await act(async () => root.unmount());
  });

  it("reads again when the karte data is revalidated", async () => {
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 4 } });
    const root = await mount();
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 2 } });

    await act(async () => {
      await revalidateKarte();
    });

    expect(hook.current!.karte).toEqual({ id: "k-1", rating: 2 });
    await act(async () => root.unmount());
  });

  it("reports a karte deleted elsewhere as gone", async () => {
    mocks.fetcher.mockRejectedValue(new AppError("VALIDATION", "Karte not found", 400));
    const root = await mount();

    expect(hook.current!.gone).toBe(true);
    await act(async () => root.unmount());
  });
});
```

`src/modules/karte/hooks/useMyKarte.test.ts` の `vi.mock("@/lib/swr", ...)` の次に足す（hook が `useEffect` を使うようになり、コンポーネントの外で呼ぶこのテストでは動かないため）:

```ts
vi.mock("../lib/revalidate", () => ({ useKarteRevalidation: vi.fn() }));
```

同じファイルの `mocks` と `swr/infinite` の mock を次に替える（返す `data` をテストごとに差し替えるため）:

```ts
const mocks = vi.hoisted(() => ({
  getKey: undefined as ((index: number, prev: unknown) => string | null) | undefined,
  state: { activeProfileId: "p-1" as string | null, role: "cast" as string | null },
  data: undefined as unknown,
}));

vi.mock("swr/infinite", () => ({
  default: (getKey: (index: number, prev: unknown) => string | null) => {
    mocks.getKey = getKey;
    return { data: mocks.data, error: undefined, size: 1, setSize: vi.fn(), isLoading: false, isValidating: false, mutate: vi.fn() };
  },
}));
```

ファイル末尾に足す:

```ts
describe("useMyKarte counts", () => {
  it("takes the counts from the first page and drops a karte repeated on a later page", () => {
    mocks.state = { activeProfileId: "p-1", role: "cast" };
    mocks.data = [
      { kartes: [{ id: "a" }, { id: "b" }], hasMore: true, nextCursor: "c1", counts: { total: 3, open: 2, closed: 1 } },
      { kartes: [{ id: "b" }, { id: "c" }], hasMore: false, nextCursor: "", counts: { total: 0, open: 0, closed: 0 } },
    ];

    const result = useMyKarte();

    expect(result.counts).toEqual({ total: 3, open: 2, closed: 1 });
    expect(result.kartes.map((k) => k.id)).toEqual(["a", "b", "c"]);
    mocks.data = undefined;
  });
});
```

`src/modules/karte/hooks/useKarteMutations.test.ts` の `vi.mock("@/lib/auth/fetch", ...)` の次に足す:

```ts
const revalidate = vi.hoisted(() => ({ revalidateKarte: vi.fn() }));
vi.mock("../lib/revalidate", () => revalidate);
```

`describe("useKarteMutations", ...)` の中に足す:

```ts
  it("refreshes the karte data after a change, whether it worked or not", async () => {
    revalidate.revalidateKarte.mockClear();
    await act(async () => {
      await hook.current!.close("k-1");
    });
    expect(revalidate.revalidateKarte).toHaveBeenCalledTimes(1);

    mocks.authFetch.mockRejectedValue(new Error("Karte is closed"));
    await act(async () => {
      await hook.current!.addEvent("k-1", event);
    });
    expect(revalidate.revalidateKarte).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte > /tmp/karte-vitest.txt 2>&1; tail -15 /tmp/karte-vitest.txt`
Expected: FAIL（`mapCountsToView`・`uniqueKartes`・`revalidate`・`useKarte` が見つからない、`counts` が undefined、`revalidateKarte` が呼ばれない）

- [ ] **Step 4: Implement types, mappers and the my-karte route**

`src/modules/karte/types.ts` の `Karte` に足す（`authorUsername` の次に `authorDisplayName`、`targetUsername` の次に `targetDisplayName`、`closedAt` の次に `lastActivityAt`）:

```ts
  authorDisplayName: string;
```

```ts
  targetDisplayName: string;
```

```ts
  lastActivityAt: string;
```

ファイル末尾に足す:

```ts
export interface KarteCounts {
  total: number;
  open: number;
  closed: number;
}

export interface MyKartePage extends KartePage {
  counts: KarteCounts;
}
```

`src/modules/karte/lib/mappers.ts` の import に `type KarteCounts as KarteCountsMessage` と、types からの `KarteCounts` を足し、`mapKarteToView` の戻り値に足す:

```ts
    authorDisplayName: karte.authorDisplayName || "",
```

```ts
    targetDisplayName: karte.targetDisplayName || "",
```

```ts
    lastActivityAt: toIsoString(karte.lastActivityAt),
```

ファイル末尾に足す:

```ts
export function mapCountsToView(counts: KarteCountsMessage | undefined): KarteCounts {
  return { total: counts?.totalCount ?? 0, open: counts?.openCount ?? 0, closed: counts?.closedCount ?? 0 };
}
```

`src/app/api/karte/my/route.ts` の import を `import { mapCountsToView, mapKarteToView } from "@/modules/karte/lib/mappers";` に替え、応答に足す:

```ts
      counts: mapCountsToView(res.counts),
```

- [ ] **Step 5: Implement revalidation and de-duplication**

`src/modules/karte/lib/revalidate.ts`:

```ts
"use client";

import { useEffect } from "react";

// SWR's matcher mutate skips useSWRInfinite keys, so each karte hook registers its own refresh here instead.
const refreshers = new Set<() => unknown>();

export function revalidateKarte(): Promise<unknown[]> {
  return Promise.all([...refreshers].map((refresh) => refresh()));
}

export function useKarteRevalidation(refresh: () => unknown): void {
  useEffect(() => {
    refreshers.add(refresh);
    return () => {
      refreshers.delete(refresh);
    };
  }, [refresh]);
}
```

`src/modules/karte/lib/uniqueKartes.ts`:

```ts
import type { Karte } from "../types";

export function uniqueKartes(kartes: Karte[]): Karte[] {
  const seen = new Set<string>();
  return kartes.filter((karte) => {
    if (seen.has(karte.id)) return false;
    seen.add(karte.id);
    return true;
  });
}
```

- [ ] **Step 6: Implement the hooks**

`src/modules/karte/hooks/useKarte.ts`:

```ts
"use client";

import useSWR from "swr";
import { AppError } from "@/lib/errors";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { useKarteRevalidation } from "../lib/revalidate";
import type { Karte } from "../types";

const NOT_FOUND = "Karte not found";

export function useKarte(karteId: string | null, initial?: Karte) {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const key = profileId && karteId ? `/api/karte/${encodeURIComponent(karteId)}` : null;
  const { data, error, mutate } = useSWR<{ karte: Karte }>(key, fetcher, {
    revalidateOnFocus: false,
    fallbackData: initial ? { karte: initial } : undefined,
  });
  useKarteRevalidation(mutate);

  return {
    karte: data?.karte ?? null,
    gone: error instanceof AppError && error.message === NOT_FOUND,
    error,
    refresh: () => mutate(),
  };
}
```

`src/modules/karte/hooks/useMyKarte.ts` を次に替える:

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useKarteRevalidation } from "../lib/revalidate";
import { uniqueKartes } from "../lib/uniqueKartes";
import type { KarteCounts, MyKartePage } from "../types";

const NO_COUNTS: KarteCounts = { total: 0, open: 0, closed: 0 };

export function useMyKarte() {
  const profileId = useAuthStore((s) => s.activeProfileId);
  const role = useAuthStore(selectRole);

  const getKey = (pageIndex: number, prev: MyKartePage | null): string | null => {
    if (!profileId || role !== "cast") return null;
    if (prev && !prev.hasMore) return null;
    const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `/api/karte/my${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<MyKartePage>(getKey, fetcher, { revalidateOnFocus: false });
  useKarteRevalidation(mutate);

  const pages = data || [];
  return {
    kartes: uniqueKartes(pages.flatMap((p) => p.kartes || [])),
    counts: pages[0]?.counts ?? NO_COUNTS,
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`src/modules/karte/hooks/useGuestKarte.ts` と `useRecentKarte.ts` に次を加える:

- import に `import { useKarteRevalidation } from "../lib/revalidate";` と `import { uniqueKartes } from "../lib/uniqueKartes";`
- `useSWRInfinite(...)` の呼び出しの次の行に `useKarteRevalidation(mutate);`
- 戻り値の `kartes: pages.flatMap((p) => p.kartes || []),` を `kartes: uniqueKartes(pages.flatMap((p) => p.kartes || [])),` に替える

`src/modules/karte/hooks/useKarteMutations.ts` の import に `import { revalidateKarte } from "../lib/revalidate";` を足し、`run` の `finally` を次に替える:

```ts
    } finally {
      setLoading(false);
      void revalidateKarte();
    }
```

`src/modules/karte/hooks/index.ts` に足す:

```ts
export { useKarte } from "./useKarte";
```

- [ ] **Step 7: Run the karte tests to verify they pass**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte src/app/api > /tmp/karte-vitest.txt 2>&1; tail -15 /tmp/karte-vitest.txt`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd dystopia/frontend
git status --short src/stub
git add src/stub/karte src/modules/karte src/app/api/karte/my/route.ts
git commit -s -m "feat(dystopia/frontend): read a single karte, my counts and refresh every karte view after a change"
```

`git status --short src/stub` に karte 以外が出ていたら、commit の前に戻す。

---
### Task 4: Rating input, event form, reliability header and card

**Files:**
- Modify: `dystopia/frontend/src/modules/karte/lib/dates.ts`, `lib/dates.test.ts`
- Create: `dystopia/frontend/src/modules/karte/components/KarteRatingInput.tsx`, `KarteRatingInput.test.tsx`
- Create: `dystopia/frontend/src/modules/karte/components/KarteEventForm.tsx`, `KarteEventForm.test.tsx`
- Create: `dystopia/frontend/src/modules/karte/components/KarteReliabilityHeader.tsx`, `KarteReliabilityHeader.test.tsx`
- Create: `dystopia/frontend/src/modules/karte/components/KarteStatusBadge.tsx`
- Create: `dystopia/frontend/src/modules/karte/components/KarteCard.tsx`, `KarteCard.test.tsx`

**Interfaces:**
- Consumes: Task 3 の `Karte`（`authorDisplayName`・`targetDisplayName`・`lastActivityAt`）、`lib/catalog.ts` の `KARTE_STAGES`・`KARTE_OUTCOMES`・`KARTE_TAGS`・`MAX_NOTE_LENGTH`・`isNoteRequired`・`stageLabel`・`outcomeLabel`・`tagLabel`、`lib/dates.ts` の `todayInJapan`
- Produces:
  - `formatMonthDay(date: string): string`（`"2026-10-04"` → `"10/4"`、`lib/dates.ts`）
  - `KarteRatingInput({ value: number | null; onChange: (next: number | null) => void; disabled?: boolean })`
  - `KarteGuest { displayName: string; username: string; avatarUrl: string }`、`emptyKarteEvent(today?: string): KarteEventInput`、`isKarteEventReady(event: KarteEventInput): boolean`、`KarteEventForm({ guest; value; onChange; rating?: { value: number | null; onChange }; submitLabel; submitting; error: string | null; onSubmit: () => void })`（すべて `KarteEventForm.tsx` から export）
  - `KarteReliabilityHeader({ reliability: ReliabilitySummary })`
  - `KarteStatusBadge({ status: KarteStatus })`
  - `KarteCard({ karte: Karte; variant: "feed" | "guest" | "mine"; onOpen: (karte: Karte) => void })`

- [ ] **Step 1: Write the failing tests**

`src/modules/karte/lib/dates.test.ts` の import を `import { formatMonthDay, todayInJapan } from "./dates";` に替え、末尾に足す:

```ts
describe("formatMonthDay", () => {
  it("shows a date as month/day without leading zeros", () => {
    expect(formatMonthDay("2026-10-04")).toBe("10/4");
    expect(formatMonthDay("2026-01-15")).toBe("1/15");
  });
});
```

`src/modules/karte/components/KarteRatingInput.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { KarteRatingInput } from "./KarteRatingInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(value: number | null, onChange: (next: number | null) => void) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(KarteRatingInput, { value, onChange }));
  });
  return container;
}

const star = (container: HTMLElement, n: number) => container.querySelector(`button[aria-label="${n}つ星"]`) as HTMLButtonElement;

describe("KarteRatingInput", () => {
  it("chooses the pressed star", async () => {
    const onChange = vi.fn();
    const container = await mount(null, onChange);

    star(container, 4).click();

    expect(onChange).toHaveBeenCalledWith(4);
    expect(container.querySelectorAll("button")).toHaveLength(5);
  });

  it("clears the rating when the chosen star is pressed again and marks the chosen one", async () => {
    const onChange = vi.fn();
    const container = await mount(3, onChange);

    expect(star(container, 3).getAttribute("aria-pressed")).toBe("true");
    expect(star(container, 4).getAttribute("aria-pressed")).toBe("false");
    star(container, 3).click();

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

`src/modules/karte/components/KarteEventForm.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { KarteEventInput } from "../types";
import { KarteEventForm, emptyKarteEvent, isKarteEventReady } from "./KarteEventForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const guest = { displayName: "はなこ", username: "hanako", avatarUrl: "" };

function Harness({ initial, withRating, onSubmit }: { initial: KarteEventInput; withRating: boolean; onSubmit: (event: KarteEventInput, rating: number | null) => void }) {
  const [value, setValue] = useState(initial);
  const [rating, setRating] = useState<number | null>(null);
  return createElement(KarteEventForm, {
    guest,
    value,
    onChange: setValue,
    rating: withRating ? { value: rating, onChange: setRating } : undefined,
    submitLabel: "保存",
    submitting: false,
    error: null,
    onSubmit: () => onSubmit(value, rating),
  });
}

async function mount(initial: KarteEventInput, withRating = false, onSubmit = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(Harness, { initial, withRating, onSubmit }));
  });
  return container;
}

const buttonNamed = (container: HTMLElement, name: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === name) as HTMLButtonElement;

async function setValue(element: HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

describe("KarteEventForm", () => {
  it("shows the guest and that the record is shared with every cast", async () => {
    const container = await mount(emptyKarteEvent("2026-10-16"));

    expect(container.textContent).toContain("はなこ");
    expect(container.textContent).toContain("@hanako · すべてのキャストに共有");
  });

  it("resets the outcome and the tags when the stage changes", async () => {
    const container = await mount({ ...emptyKarteEvent("2026-10-16"), outcome: "no_show", tags: ["late_reply"] });

    await act(async () => buttonNamed(container, "接客").click());

    expect(buttonNamed(container, "接客").getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("completed");
    expect(Array.from(container.querySelectorAll('button[aria-pressed="true"]')).map((b) => b.textContent)).toEqual(["接客"]);
  });

  it("toggles a tag", async () => {
    const container = await mount(emptyKarteEvent("2026-10-16"));

    await act(async () => buttonNamed(container, "連絡が円滑").click());
    expect(buttonNamed(container, "連絡が円滑").getAttribute("aria-pressed")).toBe("true");

    await act(async () => buttonNamed(container, "連絡が円滑").click());
    expect(buttonNamed(container, "連絡が円滑").getAttribute("aria-pressed")).toBe("false");
  });

  it("requires a note that is not only spaces for an outcome that needs one", async () => {
    const container = await mount({ ...emptyKarteEvent("2026-10-16"), outcome: "no_show" });

    expect(container.textContent).toContain("補足（必須）");
    expect(buttonNamed(container, "保存").disabled).toBe(true);

    await setValue(container.querySelector("textarea")!, "   ");
    expect(buttonNamed(container, "保存").disabled).toBe(true);

    await setValue(container.querySelector("textarea")!, "連絡なし");
    expect(buttonNamed(container, "保存").disabled).toBe(false);
  });

  it("shows the given event's values for editing", async () => {
    const container = await mount({ stage: "aftercare", outcome: "trouble_occurred", tags: ["excessive_contact"], note: "何度も連絡", occurredOn: "2026-10-03" });

    expect(buttonNamed(container, "接客後").getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("trouble_occurred");
    expect(buttonNamed(container, "連絡が頻繁・執拗").getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("何度も連絡");
    expect((container.querySelector('input[type="date"]') as HTMLInputElement).value).toBe("2026-10-03");
  });

  it("asks for the rating only when given one, without a default, and submits it", async () => {
    const withoutRating = await mount(emptyKarteEvent("2026-10-16"));
    expect(withoutRating.querySelector('button[aria-label="1つ星"]')).toBeNull();

    const onSubmit = vi.fn();
    const container = await mount(emptyKarteEvent("2026-10-16"), true, onSubmit);
    expect(container.textContent).toContain("3.0 が標準。評価はカルテ全体につき 1 つです。星は完了するときに必要です");
    expect(container.querySelector('button[aria-pressed="true"][aria-label$="つ星"]')).toBeNull();

    await act(async () => (container.querySelector('button[aria-label="4つ星"]') as HTMLButtonElement).click());
    await act(async () => buttonNamed(container, "保存").click());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }), 4);
  });
});

describe("isKarteEventReady", () => {
  it("refuses a missing date and a note over 500 characters", () => {
    expect(isKarteEventReady({ ...emptyKarteEvent("2026-10-16"), occurredOn: "" })).toBe(false);
    expect(isKarteEventReady({ ...emptyKarteEvent("2026-10-16"), note: "あ".repeat(501) })).toBe(false);
    expect(isKarteEventReady(emptyKarteEvent("2026-10-16"))).toBe(true);
  });
});
```

`src/modules/karte/components/KarteReliabilityHeader.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KarteReliabilityHeader } from "./KarteReliabilityHeader";

describe("KarteReliabilityHeader", () => {
  it("shows the average, the raters and the closed kartes", () => {
    const html = renderToStaticMarkup(<KarteReliabilityHeader reliability={{ averageRating: 3.75, raterCount: 2, karteCount: 3 }} />);

    expect(html).toContain("3.8");
    expect(html).toContain("5段階中 4.0");
    expect(html).toContain("予約・接客の信頼性（参考評価）");
    expect(html).toContain("2人が評価 · 3件の完了済みカルテ");
  });

  it("shows a dash and unrated before any closed karte", () => {
    const html = renderToStaticMarkup(<KarteReliabilityHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />);

    expect(html).toContain("—");
    expect(html).toContain("未評価");
    expect(html).toContain("0人が評価 · 0件の完了済みカルテ");
  });
});
```

`src/modules/karte/components/KarteCard.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "persona-a" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { KarteCard } = await import("./KarteCard");

const event = (id: string, overrides: Partial<Karte["events"][number]> = {}): Karte["events"][number] => ({
  id, stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", ...overrides,
});

const karte = (overrides: Partial<Karte> = {}): Karte => ({
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "yuna",
  authorDisplayName: "ゆな",
  authorAvatarUrl: "",
  targetProfileId: "guest-1",
  targetUsername: "hanako",
  targetDisplayName: "はなこ",
  targetAvatarUrl: "",
  isMine: true,
  rating: null,
  status: "open",
  events: [
    event("e-1"),
    event("e-2", { stage: "service", outcome: "ended_early", tags: ["late", "payment_trouble", "excessive_request"], note: "30分で帰った", occurredOn: "2026-10-14" }),
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
  lastActivityAt: new Date().toISOString(),
  ...overrides,
});

async function mount(props: { karte: Karte; variant: "feed" | "guest" | "mine"; onOpen?: (k: Karte) => void }) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(KarteCard, { onOpen: vi.fn(), ...props }));
  });
  return container;
}

describe("KarteCard", () => {
  it("summarizes the karte with its latest event, state and two tags", async () => {
    const text = (await mount({ karte: karte(), variant: "feed" })).textContent;

    expect(text).toContain("KARTE / キャストからゲストへ");
    expect(text).toContain("ゆな");
    expect(text).toContain("はなこ");
    expect(text).toContain("@hanako");
    expect(text).toContain("未評価");
    expect(text).toContain("10/14 · 接客 · 途中終了 — 30分で帰った");
    expect(text).toContain("記録中");
    expect(text).toContain("遅刻あり");
    expect(text).toContain("支払いトラブルあり");
    expect(text).not.toContain("合意条件を超える要求あり");
  });

  it("shows the rating and the closed state", async () => {
    const text = (await mount({ karte: karte({ rating: 4, status: "closed", closedAt: new Date().toISOString() }), variant: "feed" })).textContent;

    expect(text).toContain("★ 4.0");
    expect(text).toContain("完了");
    expect(text).not.toContain("記録中");
  });

  it("leaves the dash out when the latest event has no note", async () => {
    const text = (await mount({ karte: karte({ events: [event("e-1")] }), variant: "feed" })).textContent;

    expect(text).toContain("10/1 · 予約・問い合わせ · 予約成立");
    expect(text).not.toContain(" — ");
  });

  it("opens the karte from its summary", async () => {
    const onOpen = vi.fn();
    const subject = karte();
    const container = await mount({ karte: subject, variant: "feed", onOpen });

    (container.querySelector("button") as HTMLButtonElement).click();

    expect(onOpen).toHaveBeenCalledWith(subject);
  });

  it("links to the guest except on the guest's own profile", async () => {
    const feed = await mount({ karte: karte(), variant: "feed" });
    const guest = await mount({ karte: karte(), variant: "guest" });

    expect(feed.querySelector('a[href="/u/hanako"]')?.textContent).toBe("ゲストのプロフィールを見る →");
    expect(guest.textContent).not.toContain("ゲストのプロフィールを見る");
  });

  it("names the profile a karte of my list was written as when it is not the current one", async () => {
    const other = await mount({ karte: karte({ authorProfileId: "persona-b", authorUsername: "yuna_osaka" }), variant: "mine" });
    const deleted = await mount({ karte: karte({ authorProfileId: "persona-gone", authorUsername: "" }), variant: "mine" });
    const current = await mount({ karte: karte(), variant: "mine" });

    expect(other.textContent).toContain("@yuna_osaka として記録");
    expect(deleted.textContent).toContain("削除したプロフィールで記録");
    expect(current.textContent).not.toContain("として記録");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte/lib/dates.test.ts src/modules/karte/components/KarteRatingInput.test.tsx src/modules/karte/components/KarteEventForm.test.tsx src/modules/karte/components/KarteReliabilityHeader.test.tsx src/modules/karte/components/KarteCard.test.tsx > /tmp/karte-vitest.txt 2>&1; tail -15 /tmp/karte-vitest.txt`
Expected: FAIL（各モジュールが見つからない、`formatMonthDay` がない）

- [ ] **Step 3: Implement the date helper**

`src/modules/karte/lib/dates.ts` の末尾に足す:

```ts
export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}
```

- [ ] **Step 4: Implement the rating input**

`src/modules/karte/components/KarteRatingInput.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface KarteRatingInputProps {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}

export function KarteRatingInput({ value, onChange, disabled }: KarteRatingInputProps) {
  return (
    <div role="group" aria-label="予約・接客の信頼性" className="flex gap-1">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star}つ星`}
          aria-pressed={value === star}
          onClick={() => onChange(value === star ? null : star)}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg text-2xl disabled:opacity-50",
            value !== null && star <= value ? "text-rating" : "text-text-muted hover:text-text-secondary"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement the event form**

`src/modules/karte/components/KarteEventForm.tsx`:

```tsx
"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { KARTE_OUTCOMES, KARTE_STAGES, KARTE_TAGS, MAX_NOTE_LENGTH, isNoteRequired } from "../lib/catalog";
import { todayInJapan } from "../lib/dates";
import type { KarteEventInput } from "../types";
import { KarteRatingInput } from "./KarteRatingInput";

export interface KarteGuest {
  displayName: string;
  username: string;
  avatarUrl: string;
}

export function emptyKarteEvent(today: string = todayInJapan()): KarteEventInput {
  return { stage: "reservation", outcome: KARTE_OUTCOMES.reservation[0].code, tags: [], note: "", occurredOn: today };
}

export function isKarteEventReady(event: KarteEventInput): boolean {
  if (event.occurredOn === "" || event.note.length > MAX_NOTE_LENGTH) return false;
  return !isNoteRequired(event.stage, event.outcome) || event.note.trim() !== "";
}

const CHIP = "min-h-11 rounded-full border px-4 text-sm";
const chipClass = (selected: boolean) =>
  cn(CHIP, selected ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary hover:text-text-primary");

interface KarteEventFormProps {
  guest: KarteGuest;
  value: KarteEventInput;
  onChange: (next: KarteEventInput) => void;
  rating?: { value: number | null; onChange: (next: number | null) => void };
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function KarteEventForm({ guest, value, onChange, rating, submitLabel, submitting, error, onSubmit }: KarteEventFormProps) {
  const toggleTag = (code: string) =>
    onChange({ ...value, tags: value.tags.includes(code) ? value.tags.filter((tag) => tag !== code) : [...value.tags, code] });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
        <Avatar src={guest.avatarUrl || undefined} fallback={guest.displayName.slice(0, 1) || "?"} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text-primary">{guest.displayName}</p>
          <p className="truncate text-xs text-text-secondary">@{guest.username} · すべてのキャストに共有</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text-primary">記録する段階</legend>
        <div className="flex flex-wrap gap-2">
          {KARTE_STAGES.map((stage) => (
            <button
              key={stage.code}
              type="button"
              aria-pressed={value.stage === stage.code}
              onClick={() => onChange({ ...value, stage: stage.code, outcome: KARTE_OUTCOMES[stage.code][0].code, tags: [] })}
              className={chipClass(value.stage === stage.code)}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        対応結果
        <Select value={value.outcome} onChange={(e) => onChange({ ...value, outcome: e.target.value })}>
          {KARTE_OUTCOMES[value.stage].map((outcome) => (
            <option key={outcome.code} value={outcome.code}>
              {outcome.label}
            </option>
          ))}
        </Select>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text-primary">詳細タグ（任意）</legend>
        <div className="flex flex-wrap gap-2">
          {KARTE_TAGS[value.stage].map((tag) => (
            <button
              key={tag.code}
              type="button"
              aria-pressed={value.tags.includes(tag.code)}
              onClick={() => toggleTag(tag.code)}
              className={chipClass(value.tags.includes(tag.code))}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        {isNoteRequired(value.stage, value.outcome) ? "補足（必須）" : "補足（任意）"}
        <Textarea
          value={value.note}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="具体的な出来事や補足を記録してください"
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        発生日
        <Input type="date" value={value.occurredOn} max={todayInJapan()} onChange={(e) => onChange({ ...value, occurredOn: e.target.value })} />
      </label>

      {rating && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-text-primary">予約・接客の信頼性</legend>
          <KarteRatingInput value={rating.value} onChange={rating.onChange} />
          <p className="mt-1 text-xs text-text-secondary">3.0 が標準。評価はカルテ全体につき 1 つです。星は完了するときに必要です</p>
        </fieldset>
      )}

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting || !isKarteEventReady(value)}>
        {submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Implement the reliability header and the status badge**

`src/modules/karte/components/KarteReliabilityHeader.tsx`:

```tsx
import { RatingStars } from "@/components/ui/rating-stars";
import type { ReliabilitySummary } from "../types";

export function KarteReliabilityHeader({ reliability }: { reliability: ReliabilitySummary }) {
  const average = reliability.averageRating;

  return (
    <section aria-label="予約・接客の信頼性" className="flex items-center gap-5 border-b border-border px-4 py-4">
      <div className="flex min-w-16 flex-col items-center gap-1">
        <p className="text-4xl font-bold leading-none text-text-primary">{average === null ? "—" : average.toFixed(1)}</p>
        {average === null ? (
          <p className="text-xs text-text-secondary">未評価</p>
        ) : (
          <RatingStars value={Math.round(average)} className="text-sm" />
        )}
      </div>
      <div className="text-sm">
        <p className="font-bold text-text-primary">予約・接客の信頼性（参考評価）</p>
        <p className="text-text-secondary">
          {reliability.raterCount}人が評価 · {reliability.karteCount}件の完了済みカルテ
        </p>
      </div>
    </section>
  );
}
```

`src/modules/karte/components/KarteStatusBadge.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { KarteStatus } from "../types";

export function KarteStatusBadge({ status }: { status: KarteStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-bold",
        status === "open" ? "border-warning/50 bg-warning/10 text-warning" : "border-success-text/50 bg-success-text/10 text-success-text"
      )}
    >
      {status === "open" ? "記録中" : "完了"}
    </span>
  );
}
```

- [ ] **Step 7: Implement the card**

`src/modules/karte/components/KarteCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/utils/date";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import { formatMonthDay } from "../lib/dates";
import type { Karte, KarteEvent } from "../types";
import { KarteStatusBadge } from "./KarteStatusBadge";

export function karteEventLine(event: KarteEvent): string {
  const line = `${formatMonthDay(event.occurredOn)} · ${stageLabel(event.stage)} · ${outcomeLabel(event.stage, event.outcome)}`;
  return event.note ? `${line} — ${event.note}` : line;
}

export function profileName(displayName: string, username: string): string {
  return displayName || (username ? `@${username}` : "削除したプロフィール");
}

interface KarteCardProps {
  karte: Karte;
  variant: "feed" | "guest" | "mine";
  onOpen: (karte: Karte) => void;
}

export function KarteCard({ karte, variant, onOpen }: KarteCardProps) {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const latest = karte.events[karte.events.length - 1];
  const writtenAsOtherProfile = variant === "mine" && karte.authorProfileId !== activeProfileId;

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <Avatar
          src={karte.authorAvatarUrl || undefined}
          fallback={profileName(karte.authorDisplayName, karte.authorUsername).replace("@", "").slice(0, 1) || "?"}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-text-secondary">KARTE / キャストからゲストへ</p>
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <span className="truncate font-bold text-text-primary">{profileName(karte.authorDisplayName, karte.authorUsername)}</span>
            <span className="shrink-0 text-text-secondary">· {formatTimeAgo(karte.lastActivityAt)}</span>
          </p>
          {writtenAsOtherProfile && (
            <p className="text-xs text-text-secondary">
              {karte.authorUsername ? `@${karte.authorUsername} として記録` : "削除したプロフィールで記録"}
            </p>
          )}
          <button
            type="button"
            onClick={() => onOpen(karte)}
            className="mt-2 block w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-accent/60"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                <span className="font-bold text-text-primary">{profileName(karte.targetDisplayName, karte.targetUsername)}</span>
                {karte.targetUsername && <span className="ml-1 text-xs text-text-secondary">@{karte.targetUsername}</span>}
              </span>
              <span className={karte.rating === null ? "shrink-0 text-sm text-text-secondary" : "shrink-0 text-sm font-bold text-rating"}>
                {karte.rating === null ? "未評価" : `★ ${karte.rating.toFixed(1)}`}
              </span>
            </span>
            {latest && <span className="mt-1 line-clamp-2 block text-sm text-text-primary">{karteEventLine(latest)}</span>}
            <span className="mt-2 flex flex-wrap gap-1.5">
              <KarteStatusBadge status={karte.status} />
              {latest?.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                  {tagLabel(latest.stage, tag)}
                </span>
              ))}
            </span>
          </button>
          {variant !== "guest" && karte.targetUsername && (
            <Link href={`/u/${karte.targetUsername}`} className="mt-2 inline-block text-sm text-accent hover:underline">
              ゲストのプロフィールを見る →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS

- [ ] **Step 9: Commit**

```bash
cd dystopia/frontend
git add src/modules/karte/lib/dates.ts src/modules/karte/lib/dates.test.ts src/modules/karte/components/KarteRatingInput.tsx src/modules/karte/components/KarteRatingInput.test.tsx src/modules/karte/components/KarteEventForm.tsx src/modules/karte/components/KarteEventForm.test.tsx src/modules/karte/components/KarteReliabilityHeader.tsx src/modules/karte/components/KarteReliabilityHeader.test.tsx src/modules/karte/components/KarteStatusBadge.tsx src/modules/karte/components/KarteCard.tsx src/modules/karte/components/KarteCard.test.tsx
git commit -s -m "feat(dystopia/frontend): add the karte card, event form, rating input and reliability header"
```

---
### Task 5: Detail sheet and karte list

**Files:**
- Create: `dystopia/frontend/src/modules/karte/components/KarteDetailSheet.tsx`, `KarteDetailSheet.test.tsx`
- Create: `dystopia/frontend/src/modules/karte/components/KarteList.tsx`, `KarteList.test.tsx`

**Interfaces:**
- Consumes: Task 3 の `useKarte`・`useKarteMutations`、Task 4 の `KarteCard`・`karteEventLine`・`profileName`・`KarteEventForm`・`emptyKarteEvent`・`KarteRatingInput`・`KarteStatusBadge`、第 1 段の `SideSheet`（`open`・`onOpenChange`・`title`・`onBack`・`stepKey`）、`useToastStore((s) => s.show)`
- Produces:
  - `KarteDetailSheet({ karte: Karte; open: boolean; onClose: () => void })`
  - `KarteList({ kartes: Karte[]; variant: "feed" | "guest" | "mine"; hasMore: boolean; loading: boolean; onLoadMore: () => void; empty: string })`

- [ ] **Step 1: Write the failing tests**

`src/modules/karte/components/KarteDetailSheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  current: null as Karte | null,
  gone: false,
  toast: vi.fn(),
  mutations: {
    updateRating: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("../hooks/useKarte", () => ({ useKarte: () => ({ karte: mocks.current, gone: mocks.gone, error: undefined, refresh: vi.fn() }) }));
vi.mock("../hooks/useKarteMutations", () => ({ useKarteMutations: () => ({ ...mocks.mutations, loading: false, error: null }) }));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { KarteDetailSheet } = await import("./KarteDetailSheet");

const event = (id: string, overrides: Partial<Karte["events"][number]> = {}): Karte["events"][number] => ({
  id, stage: "reservation", outcome: "booked", tags: ["smooth_contact"], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", ...overrides,
});

const karte = (overrides: Partial<Karte> = {}): Karte => ({
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "yuna",
  authorDisplayName: "ゆな",
  authorAvatarUrl: "",
  targetProfileId: "guest-1",
  targetUsername: "hanako",
  targetDisplayName: "はなこ",
  targetAvatarUrl: "",
  isMine: true,
  rating: null,
  status: "open",
  events: [event("e-1"), event("e-2", { stage: "service", outcome: "ended_early", tags: [], note: "30分で帰った", occurredOn: "2026-10-14" })],
  createdAt: "",
  updatedAt: "",
  closedAt: null,
  lastActivityAt: "",
  ...overrides,
});

let root: Root;
let onClose: ReturnType<typeof vi.fn>;
const confirmDialog = vi.fn();

async function mount(subject: Karte) {
  mocks.current = subject;
  onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(KarteDetailSheet, { karte: subject, open: true, onClose }));
  });
}

const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label || b.getAttribute("aria-label") === label) as HTMLButtonElement | undefined;
const click = async (label: string) => {
  await act(async () => {
    button(label)!.click();
  });
};

beforeEach(() => {
  mocks.gone = false;
  mocks.toast.mockReset();
  for (const fn of Object.values(mocks.mutations)) fn.mockReset().mockResolvedValue(karte());
  mocks.mutations.remove.mockResolvedValue(true);
  vi.stubGlobal("confirm", confirmDialog);
  confirmDialog.mockReset().mockReturnValue(true);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("KarteDetailSheet", () => {
  it("shows the karte's state, author and every event in order", async () => {
    await mount(karte());

    expect(text()).toContain("カルテの詳細");
    expect(text()).toContain("KARTE / 記録中");
    expect(text()).toContain("@hanako · 記録者 ゆな");
    expect(text()).toContain("記録中のため平均評価には含まれません");
    expect(text()).toContain("予約から接客後までの記録");
    expect(text().indexOf("予約成立")).toBeLessThan(text().indexOf("途中終了"));
    expect(text()).toContain("30分で帰った");
    expect(text()).toContain("連絡が円滑");
  });

  it("gives the author of an open karte the rating, event edits, appending and closing", async () => {
    await mount(karte());

    expect(button("4つ星")).toBeDefined();
    expect(button("＋ 段階を追記する")).toBeDefined();
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "編集")).toHaveLength(2);
    expect(button("完了する")!.disabled).toBe(true);
    expect(text()).toContain("完了するには星を選んでください");
    expect(button("このカルテを削除")).toBeDefined();
  });

  it("gives another cast no operations", async () => {
    await mount(karte({ isMine: false }));

    expect(button("4つ星")).toBeUndefined();
    expect(button("編集")).toBeUndefined();
    expect(button("＋ 段階を追記する")).toBeUndefined();
    expect(button("完了する")).toBeUndefined();
    expect(button("このカルテを削除")).toBeUndefined();
  });

  it("gives the author of a closed karte reopening and deleting only", async () => {
    await mount(karte({ status: "closed", rating: 4, closedAt: "2026-10-15T00:00:00Z" }));

    expect(text()).toContain("KARTE / 完了");
    expect(text()).toContain("完了済みの評価は平均に反映されます");
    expect(button("再オープン")).toBeDefined();
    expect(button("編集")).toBeUndefined();
    expect(button("4つ星")).toBeUndefined();
    expect(button("このカルテを削除")).toBeDefined();
  });

  it("keeps the only event from being deleted and says why", async () => {
    await mount(karte({ events: [event("e-1")] }));

    expect(button("削除")!.disabled).toBe(true);
    expect(text()).toContain("出来事は 1 件以上必要です");
  });

  it("saves a rating from the stars", async () => {
    await mount(karte());

    await click("4つ星");

    expect(mocks.mutations.updateRating).toHaveBeenCalledWith("k-1", 4);
  });

  it("closes a rated karte in place and confirms it", async () => {
    await mount(karte({ rating: 4 }));

    await click("完了する");

    expect(mocks.mutations.close).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("カルテを完了しました。平均評価へ反映します");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reopens a closed karte and confirms it", async () => {
    await mount(karte({ status: "closed", rating: 4, closedAt: "2026-10-15T00:00:00Z" }));

    await click("再オープン");

    expect(mocks.mutations.reopen).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("カルテを再オープンしました。集計から一時除外します");
  });

  it("appends a stage in a step of the sheet and comes back", async () => {
    await mount(karte());

    await click("＋ 段階を追記する");
    expect(text()).toContain("カルテに追記");
    expect(text()).toContain("@hanako · すべてのキャストに共有");

    await click("この段階を追記");
    expect(mocks.mutations.addEvent).toHaveBeenCalledWith("k-1", expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }));
    expect(mocks.toast).toHaveBeenCalledWith("カルテに追記しました");
    expect(text()).toContain("予約から接客後までの記録");
  });

  it("goes back from the append step without saving", async () => {
    await mount(karte());

    await click("＋ 段階を追記する");
    await click("前に戻る");

    expect(text()).toContain("予約から接客後までの記録");
    expect(mocks.mutations.addEvent).not.toHaveBeenCalled();
  });

  it("edits an event with its values filled in", async () => {
    await mount(karte());

    await act(async () => {
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "編集")[1].click();
    });
    expect(text()).toContain("出来事を編集");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("30分で帰った");

    await click("出来事を更新");
    expect(mocks.mutations.updateEvent).toHaveBeenCalledWith("e-2", expect.objectContaining({ stage: "service", outcome: "ended_early", note: "30分で帰った" }));
    expect(mocks.toast).toHaveBeenCalledWith("出来事を更新しました");
  });

  it("deletes an event after confirming", async () => {
    await mount(karte());

    await act(async () => {
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "削除")[0].click();
    });

    expect(mocks.mutations.removeEvent).toHaveBeenCalledWith("e-1");
    expect(mocks.toast).toHaveBeenCalledWith("出来事を削除しました");
  });

  it("deletes the karte after confirming and closes", async () => {
    await mount(karte());

    await click("このカルテを削除");

    expect(confirmDialog).toHaveBeenCalledWith("このカルテを削除しますか？");
    expect(mocks.mutations.remove).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("カルテを削除しました");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the karte was deleted elsewhere", async () => {
    mocks.gone = true;
    await mount(karte());

    expect(onClose).toHaveBeenCalled();
  });
});
```

`src/modules/karte/components/KarteList.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const opened = vi.hoisted(() => ({ props: null as null | { karte: Karte; open: boolean; onClose: () => void } }));

vi.mock("./KarteCard", () => ({
  KarteCard: ({ karte, onOpen }: { karte: Karte; onOpen: (k: Karte) => void }) => (
    <button type="button" onClick={() => onOpen(karte)}>
      card:{karte.id}
    </button>
  ),
}));
vi.mock("./KarteDetailSheet", () => ({
  KarteDetailSheet: (props: { karte: Karte; open: boolean; onClose: () => void }) => {
    opened.props = props;
    return <div>sheet:{props.karte.id}:{String(props.open)}</div>;
  },
}));

const { KarteList } = await import("./KarteList");

async function mount(props: Partial<Parameters<typeof KarteList>[0]> = {}) {
  const container = document.createElement("div");
  const onLoadMore = vi.fn();
  await act(async () => {
    createRoot(container).render(
      createElement(KarteList, {
        kartes: [{ id: "k-1" } as Karte, { id: "k-2" } as Karte],
        variant: "feed",
        hasMore: false,
        loading: false,
        onLoadMore,
        empty: "カルテはまだありません",
        ...props,
      })
    );
  });
  return { container, onLoadMore };
}

const button = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement;

describe("KarteList", () => {
  it("opens the pressed karte in the detail sheet and closes it", async () => {
    opened.props = null;
    const { container } = await mount();
    expect(container.textContent).not.toContain("sheet:");

    await act(async () => button(container, "card:k-2").click());
    expect(container.textContent).toContain("sheet:k-2:true");

    await act(async () => opened.props!.onClose());
    expect(container.textContent).toContain("sheet:k-2:false");
  });

  it("says when there is nothing and loads more on request", async () => {
    const empty = await mount({ kartes: [] });
    expect(empty.container.textContent).toContain("カルテはまだありません");

    const { container, onLoadMore } = await mount({ hasMore: true });
    await act(async () => button(container, "もっと見る").click());
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("does not say there is nothing while loading", async () => {
    const { container } = await mount({ kartes: [], loading: true });

    expect(container.textContent).toContain("読み込み中…");
    expect(container.textContent).not.toContain("カルテはまだありません");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte/components/KarteDetailSheet.test.tsx src/modules/karte/components/KarteList.test.tsx > /tmp/karte-vitest.txt 2>&1; tail -15 /tmp/karte-vitest.txt`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: Implement the detail sheet**

`src/modules/karte/components/KarteDetailSheet.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { useToastStore } from "@/stores/toastStore";
import { useKarte } from "../hooks/useKarte";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import { formatMonthDay } from "../lib/dates";
import type { Karte, KarteEventInput } from "../types";
import { profileName } from "./KarteCard";
import { KarteEventForm, emptyKarteEvent } from "./KarteEventForm";
import { KarteRatingInput } from "./KarteRatingInput";
import { KarteStatusBadge } from "./KarteStatusBadge";

type Step = { kind: "detail" } | { kind: "append" } | { kind: "edit"; eventId: string };

const TITLES = { detail: "カルテの詳細", append: "カルテに追記", edit: "出来事を編集" } as const;

interface KarteDetailSheetProps {
  karte: Karte;
  open: boolean;
  onClose: () => void;
}

export function KarteDetailSheet({ karte: initial, open, onClose }: KarteDetailSheetProps) {
  const { karte: current, gone } = useKarte(open ? initial.id : null, initial);
  const karte = current ?? initial;
  const { updateRating, close, reopen, addEvent, updateEvent, removeEvent, remove, loading, error } = useKarteMutations();
  const showToast = useToastStore((s) => s.show);
  const [step, setStep] = useState<Step>({ kind: "detail" });
  const [appendDraft, setAppendDraft] = useState<KarteEventInput>(() => emptyKarteEvent());
  const [editDraft, setEditDraft] = useState<KarteEventInput>(() => emptyKarteEvent());

  useEffect(() => {
    if (open && gone) onClose();
  }, [open, gone, onClose]);

  const isOpen = karte.status === "open";
  const editable = karte.isMine && isOpen;
  const guest = { displayName: profileName(karte.targetDisplayName, karte.targetUsername), username: karte.targetUsername, avatarUrl: karte.targetAvatarUrl };
  const confirmed = async (request: () => Promise<unknown>, message: string) => {
    const result = await request();
    if (result) showToast(message);
    return result;
  };

  const startEdit = (eventId: string) => {
    const target = karte.events.find((event) => event.id === eventId);
    if (!target) return;
    setEditDraft({ stage: target.stage, outcome: target.outcome, tags: target.tags, note: target.note, occurredOn: target.occurredOn });
    setStep({ kind: "edit", eventId });
  };

  const body = () => {
    if (step.kind === "append") {
      return (
        <KarteEventForm
          guest={guest}
          value={appendDraft}
          onChange={setAppendDraft}
          submitLabel="この段階を追記"
          submitting={loading}
          error={error?.message ?? null}
          onSubmit={async () => {
            if (!(await confirmed(() => addEvent(karte.id, appendDraft), "カルテに追記しました"))) return;
            setAppendDraft(emptyKarteEvent());
            setStep({ kind: "detail" });
          }}
        />
      );
    }
    if (step.kind === "edit") {
      return (
        <KarteEventForm
          guest={guest}
          value={editDraft}
          onChange={setEditDraft}
          submitLabel="出来事を更新"
          submitting={loading}
          error={error?.message ?? null}
          onSubmit={async () => {
            if (await confirmed(() => updateEvent(step.eventId, editDraft), "出来事を更新しました")) setStep({ kind: "detail" });
          }}
        />
      );
    }
    return (
      <div className="flex flex-col gap-5">
        {error && (
          <p className="text-sm text-error" role="alert">
            {error.message}
          </p>
        )}
        <p className="text-xs font-bold tracking-wide text-text-secondary">KARTE / {isOpen ? "記録中" : "完了"}</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Avatar src={karte.targetAvatarUrl || undefined} fallback={guest.displayName.replace("@", "").slice(0, 1) || "?"} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-bold text-text-primary">{guest.displayName}</p>
              <p className="truncate text-xs text-text-secondary">
                {karte.targetUsername ? `@${karte.targetUsername} · ` : ""}記録者 {profileName(karte.authorDisplayName, karte.authorUsername)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-3xl font-bold text-text-primary">
              {karte.rating === null ? "—" : karte.rating.toFixed(1)} <span className="text-base text-rating">★</span>
            </p>
            <KarteStatusBadge status={karte.status} />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {isOpen ? "記録中のため平均評価には含まれません" : "完了済みの評価は平均に反映されます"}
          </p>
          {editable && (
            <div className="mt-3">
              <KarteRatingInput value={karte.rating} disabled={loading} onChange={(rating) => void updateRating(karte.id, rating)} />
            </div>
          )}
        </div>

        <section>
          <h3 className="mb-3 text-sm font-bold text-text-primary">予約から接客後までの記録</h3>
          <ol className="flex flex-col gap-3">
            {karte.events.map((event) => (
              <li key={event.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-bold text-text-primary">
                  {stageLabel(event.stage)} · {outcomeLabel(event.stage, event.outcome)}
                </p>
                {event.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                        {tagLabel(event.stage, tag)}
                      </span>
                    ))}
                  </div>
                )}
                {event.note && <p className="mt-2 whitespace-pre-wrap text-text-primary">{event.note}</p>}
                <p className="mt-2 text-xs text-text-secondary">発生日 {formatMonthDay(event.occurredOn)}</p>
                {editable && (
                  <div className="mt-2 flex gap-4 text-sm text-text-secondary">
                    <button type="button" onClick={() => startEdit(event.id)} className="hover:text-text-primary">
                      編集
                    </button>
                    <button
                      type="button"
                      disabled={loading || karte.events.length <= 1}
                      onClick={() => {
                        if (!confirm("この出来事を削除しますか？")) return;
                        void confirmed(() => removeEvent(event.id), "出来事を削除しました");
                      }}
                      className="hover:text-text-primary disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {editable && karte.events.length <= 1 && <p className="mt-2 text-xs text-text-secondary">出来事は 1 件以上必要です</p>}
        </section>

        {editable && (
          <Button type="button" variant="secondary" onClick={() => setStep({ kind: "append" })}>
            ＋ 段階を追記する
          </Button>
        )}

        {karte.isMine && (
          <div className="flex flex-col gap-2 border-t border-divider pt-4">
            {isOpen ? (
              <>
                <Button
                  type="button"
                  disabled={loading || karte.rating === null}
                  onClick={() => void confirmed(() => close(karte.id), "カルテを完了しました。平均評価へ反映します")}
                >
                  完了する
                </Button>
                {karte.rating === null && <p className="text-xs text-text-secondary">完了するには星を選んでください</p>}
              </>
            ) : (
              <Button
                type="button"
                disabled={loading}
                onClick={() => void confirmed(() => reopen(karte.id), "カルテを再オープンしました。集計から一時除外します")}
              >
                再オープン
              </Button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                if (!confirm("このカルテを削除しますか？")) return;
                if (!(await remove(karte.id))) return;
                showToast("カルテを削除しました");
                onClose();
              }}
              className="min-h-11 text-sm text-error hover:underline disabled:opacity-50"
            >
              このカルテを削除
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={TITLES[step.kind]}
      onBack={step.kind === "detail" ? undefined : () => setStep({ kind: "detail" })}
      stepKey={step.kind}
    >
      {body()}
    </SideSheet>
  );
}
```

- [ ] **Step 4: Implement the list**

`src/modules/karte/components/KarteList.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import type { Karte } from "../types";
import { KarteCard } from "./KarteCard";
import { KarteDetailSheet } from "./KarteDetailSheet";

interface Opened {
  karte: Karte;
  session: number;
  open: boolean;
}

interface KarteListProps {
  kartes: Karte[];
  variant: "feed" | "guest" | "mine";
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  empty: string;
}

export function KarteList({ kartes, variant, hasMore, loading, onLoadMore, empty }: KarteListProps) {
  // Keep the opened karte after closing: dropping it would unmount the sheet before it slides out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const close = useCallback(() => setOpened((current) => current && { ...current, open: false }), []);

  return (
    <div>
      {kartes.map((karte) => (
        <KarteCard
          key={karte.id}
          karte={karte}
          variant={variant}
          onOpen={(chosen) => setOpened((current) => ({ karte: chosen, session: (current?.session ?? 0) + 1, open: true }))}
        />
      ))}
      {!loading && kartes.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-secondary">{empty}</p>}
      {loading && <div className="px-4 py-3 text-sm text-text-secondary">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="block w-full px-4 py-3 text-sm text-text-secondary hover:text-text-primary"
        >
          もっと見る
        </button>
      )}
      {opened && <KarteDetailSheet key={opened.session} karte={opened.karte} open={opened.open} onClose={close} />}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd dystopia/frontend
git add src/modules/karte/components/KarteDetailSheet.tsx src/modules/karte/components/KarteDetailSheet.test.tsx src/modules/karte/components/KarteList.tsx src/modules/karte/components/KarteList.test.tsx
git commit -s -m "feat(dystopia/frontend): open a karte in a detail sheet that holds every author operation"
```

---
### Task 6: Screens on the new parts

**Files:**
- Create: `dystopia/frontend/src/modules/karte/components/KarteCreateForm.tsx`, `KarteCreateForm.test.tsx`
- Modify: `dystopia/frontend/src/components/compose/ComposeToSheet.tsx`, `ComposeToSheet.test.tsx`
- Modify: `dystopia/frontend/src/modules/karte/components/GuestKarteTab.tsx`
- Create: `dystopia/frontend/src/modules/karte/components/GuestKarteTab.test.tsx`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`
- Modify: `dystopia/frontend/src/app/page.tsx`
- Modify: `dystopia/frontend/src/app/karte/my/page.tsx`, `page.test.tsx`
- Modify: `dystopia/frontend/src/app/dev/ui/karte/page.tsx`
- Modify: `dystopia/frontend/src/app/globals.test.ts`
- Delete: `dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx`, `KarteEntryCard.test.tsx`, `KarteEntryCard.profile.test.tsx`, `KarteEntryCard.refresh.test.tsx`, `KarteComposer.tsx`, `KarteComposer.test.tsx`, `KarteEventFields.tsx`, `KarteEventFields.test.tsx`, `KarteRatingSelect.tsx`, `KarteAggregateHeader.tsx`, `KarteAggregateHeader.test.tsx`

**Interfaces:**
- Consumes: Task 3 の `useGuestKarte`・`useMyKarte`（`counts`）・`useRecentKarte`・`useKarteMutations`、Task 4 の `KarteEventForm`・`emptyKarteEvent`・`KarteReliabilityHeader`・`KarteCard`・`KarteRatingInput`、Task 5 の `KarteList`
- Produces:
  - `KarteCreateForm({ target: SocialProfileView; onCreated: () => void })`
  - `ComposeToSheet` の props に `initialTarget?: SocialProfileView`（渡すとゲストを選ぶ画面を出さず、戻るボタンも出さない）
  - `GuestKarteTab({ guest: SocialProfileView })`

- [ ] **Step 1: Write the failing tests**

`src/modules/karte/components/KarteCreateForm.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../hooks/useKarteMutations", () => ({ useKarteMutations: () => ({ create: mocks.create, loading: false, error: null }) }));

const { KarteCreateForm } = await import("./KarteCreateForm");

const target = { profileId: "guest-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" as const };

async function mount(onCreated: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(KarteCreateForm, { target, onCreated }));
  });
  return container;
}

const submit = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "記録中のカルテを作成") as HTMLButtonElement;

beforeEach(() => {
  mocks.create.mockReset();
});

describe("KarteCreateForm", () => {
  it("creates an open karte for the guest with the chosen rating", async () => {
    mocks.create.mockResolvedValue({ id: "k-1" });
    const onCreated = vi.fn();
    const container = await mount(onCreated);

    await act(async () => (container.querySelector('button[aria-label="3つ星"]') as HTMLButtonElement).click());
    await act(async () => submit(container).click());

    expect(mocks.create).toHaveBeenCalledWith("guest-1", 3, expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }));
    expect(onCreated).toHaveBeenCalled();
  });

  it("keeps the form when creating fails", async () => {
    mocks.create.mockResolvedValue(null);
    const onCreated = vi.fn();
    const container = await mount(onCreated);

    await act(async () => submit(container).click());

    expect(mocks.create).toHaveBeenCalledWith("guest-1", null, expect.anything());
    expect(onCreated).not.toHaveBeenCalled();
    expect(submit(container)).toBeDefined();
  });
});
```

`src/components/compose/ComposeToSheet.test.tsx` を次のように変える。

`vi.mock("@/modules/karte/components/KarteComposer", ...)` を次に替える:

```tsx
vi.mock("@/modules/karte/components/KarteCreateForm", () => ({
  KarteCreateForm: ({ target: chosen, onCreated }: { target: SocialProfileView; onCreated: () => void }) => {
    mocks.created = onCreated;
    return <div>karte-form:{chosen.profileId}:{chosen.displayName}</div>;
  },
}));
```

`mount` に `initialTarget` を渡せるようにする:

```tsx
async function mount(kind: "message" | "karte" | "review", open = true, initialTarget?: SocialProfileView) {
  const onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = () =>
    act(async () => {
      root.render(createElement(ComposeToSheet, { kind, open, onClose, initialTarget }));
    });
```

（`mount` の残りはそのまま）

`it("moves on to the karte form for the chosen guest, and back to the list", ...)` の `expect(document.body.textContent).toContain("たろう");` と `expect(document.body.textContent).toContain("karte-composer:guest-1");` の 2 行を次の 1 行に替える:

```tsx
    expect(document.body.textContent).toContain("karte-form:guest-1:たろう");
```

`it("confirms a saved karte entry and closes", ...)` の期待値を `[["記録中のカルテを作成しました"]]` に替える。

`it("shows nothing while closed", ...)` の前に足す:

```tsx
  it("opens straight on the karte form for a guest chosen beforehand, without going back to the list", async () => {
    const view = await mount("karte", true, target);

    expect(document.body.textContent).toContain("karte-form:guest-1:たろう");
    expect(document.body.textContent).not.toContain("カルテを書くゲストを選ぶ");
    expect(button("前に戻る")).toBeUndefined();
    await view.unmount();
  });
```

`src/modules/karte/components/GuestKarteTab.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SocialProfileView } from "@/modules/social/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../hooks/useGuestKarte", () => ({
  useGuestKarte: () => ({
    kartes: [],
    reliability: { averageRating: 4, raterCount: 1, karteCount: 2 },
    hasMore: false,
    loading: false,
    loadMore: vi.fn(),
  }),
}));
vi.mock("./KarteList", () => ({
  KarteList: ({ variant, empty }: { variant: string; empty: string }) => <div>list:{variant}:{empty}</div>,
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, initialTarget }: { kind: string; open: boolean; initialTarget?: SocialProfileView }) => (
    <div>compose:{kind}:{String(open)}:{initialTarget?.profileId}</div>
  ),
}));

const { GuestKarteTab } = await import("./GuestKarteTab");

const guest: SocialProfileView = { profileId: "guest-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" };

describe("GuestKarteTab", () => {
  it("shows the reliability above the guest's kartes and writes a karte for this guest", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(GuestKarteTab, { guest }));
    });

    expect(container.textContent).toContain("4.0");
    expect(container.textContent).toContain("1人が評価 · 2件の完了済みカルテ");
    expect(container.textContent).toContain("list:guest:カルテはまだありません");
    expect(container.textContent).not.toContain("compose:");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "このゲストのカルテを書く") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("compose:karte:true:guest-1");
  });
});
```

`src/app/karte/my/page.test.tsx` を次のように変える。

`vi.mock("@/modules/karte/hooks/useMyKarte", ...)` を次に替える:

```tsx
vi.mock("@/modules/karte/hooks/useMyKarte", () => ({
  useMyKarte: () => ({ kartes: [], counts: { total: 3, open: 2, closed: 1 }, hasMore: false, loading: false, loadMore: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/modules/karte/components/KarteList", () => ({
  KarteList: ({ variant, empty }: { variant: string; empty: string }) => <div>list:{variant}:{empty}</div>,
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({ ComposeToSheet: () => null }));
```

`it("renders a description of what this page is", ...)` の `expect(html).toContain("ゲストについて書いたレビューの管理・共有");` を次に替える:

```tsx
    expect(html).toContain("自分が作成したカルテの一覧。ホームの「カルテ」は全キャストの新着です。");
```

`it("shows the page to a cast", ...)` の末尾に足す:

```tsx
    expect(html).toContain("＋ カルテを作成");
    expect(html).toMatch(/3<\/p><p[^>]*>自分のカルテ/);
    expect(html).toMatch(/2<\/p><p[^>]*>記録中/);
    expect(html).toMatch(/1<\/p><p[^>]*>完了/);
    expect(html).toContain("list:mine:自分のカルテはまだありません");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte/components/KarteCreateForm.test.tsx src/components/compose/ComposeToSheet.test.tsx src/modules/karte/components/GuestKarteTab.test.tsx src/app/karte/my/page.test.tsx > /tmp/karte-vitest.txt 2>&1; tail -15 /tmp/karte-vitest.txt`
Expected: FAIL

- [ ] **Step 3: Implement the create form and the compose sheet**

`src/modules/karte/components/KarteCreateForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { SocialProfileView } from "@/modules/social/types";
import { useKarteMutations } from "../hooks/useKarteMutations";
import { KarteEventForm, emptyKarteEvent } from "./KarteEventForm";

interface KarteCreateFormProps {
  target: SocialProfileView;
  onCreated: () => void;
}

export function KarteCreateForm({ target, onCreated }: KarteCreateFormProps) {
  const { create, loading, error } = useKarteMutations();
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);

  return (
    <KarteEventForm
      guest={{ displayName: target.displayName, username: target.username, avatarUrl: target.avatarUrl }}
      value={event}
      onChange={setEvent}
      rating={{ value: rating, onChange: setRating }}
      submitLabel="記録中のカルテを作成"
      submitting={loading}
      error={error?.message ?? null}
      onSubmit={async () => {
        if (await create(target.profileId, rating, event)) onCreated();
      }}
    />
  );
}
```

`src/components/compose/ComposeToSheet.tsx` を次のように変える:

- import の `import { KarteComposer } from "@/modules/karte/components/KarteComposer";` を `import { KarteCreateForm } from "@/modules/karte/components/KarteCreateForm";` に替える
- `SAVED_MESSAGE` を `{ karte: "記録中のカルテを作成しました", review: "レビューを投稿しました" } as const` に替える
- `ComposeToSheetProps` に `initialTarget?: SocialProfileView;` を足し、関数の引数を `{ kind, open, onClose, initialTarget }` に替える
- `const [target, setTarget] = useState<SocialProfileView | null>(null);` を `useState<SocialProfileView | null>(initialTarget ?? null);` に替える
- `SideSheet` の `onBack={composeKind ? () => setTarget(null) : undefined}` を `onBack={composeKind && !initialTarget ? () => setTarget(null) : undefined}` に替える
- `{target && composeKind && (...)}` の中身を次に替える（カルテはフォームがゲストを表示するので、上のゲストの行はレビューだけに出す）:

```tsx
      {target && composeKind === "karte" && <KarteCreateForm target={target} onCreated={saved} />}

      {target && composeKind === "review" && (
        <>
          <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
            <Avatar src={target.avatarUrl || undefined} fallback={target.displayName.slice(0, 1) || "?"} size="sm" />
            <span className="min-w-0 truncate text-sm font-bold text-text-primary">{target.displayName}</span>
            <span className="truncate text-xs text-text-secondary">@{target.username}</span>
          </div>
          <ReviewComposer targetProfileId={target.profileId} onCreated={saved} />
        </>
      )}
```

- [ ] **Step 4: Implement the guest tab and pass the guest from the profile page**

`src/modules/karte/components/GuestKarteTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import type { SocialProfileView } from "@/modules/social/types";
import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteList } from "./KarteList";
import { KarteReliabilityHeader } from "./KarteReliabilityHeader";

interface Composing {
  session: number;
  open: boolean;
}

export function GuestKarteTab({ guest }: { guest: SocialProfileView }) {
  const { kartes, reliability, hasMore, loading, loadMore } = useGuestKarte(guest.profileId);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);

  return (
    <div>
      <KarteReliabilityHeader reliability={reliability} />
      <KarteList kartes={kartes} variant="guest" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="カルテはまだありません" />
      <div className="px-4 py-4">
        <Button
          type="button"
          className="w-full"
          onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
        >
          このゲストのカルテを書く
        </Button>
      </div>
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="karte"
          open={composing.open}
          initialTarget={guest}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
```

`src/app/u/[username]/page.tsx` の `<GuestKarteTab guestProfileId={profile.id} />` を次に替える:

```tsx
<GuestKarteTab
  guest={{
    profileId: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isPrivate: profile.isPrivate,
    role: "guest",
  }}
/>
```

- [ ] **Step 5: Use the list on the home tab**

`src/app/page.tsx` の import の `import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";` を `import { KarteList } from "@/modules/karte/components/KarteList";` に替え、`const karteContent = useMemo(...)` を次に替える:

```tsx
  const karteContent = useMemo(() => {
    if (karte.error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    return (
      <KarteList
        kartes={karte.kartes}
        variant="feed"
        hasMore={karte.hasMore}
        loading={karte.loading}
        onLoadMore={karte.loadMore}
        empty="まだカルテがありません"
      />
    );
  }, [karte.error, karte.kartes, karte.hasMore, karte.loading, karte.loadMore]);
```

`Button` の import がこの変更で使われなくなったら消す（`grep -n "<Button" src/app/page.tsx` で確かめる）。

- [ ] **Step 6: Rebuild my karte page**

`src/app/karte/my/page.tsx` を次に替える:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { useMyKarte } from "@/modules/karte/hooks/useMyKarte";
import { KarteList } from "@/modules/karte/components/KarteList";
import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";

export function MyKarteHeader() {
  return <PageHeader title="自分のカルテ" description="自分が作成したカルテの一覧。ホームの「カルテ」は全キャストの新着です。" />;
}

interface Composing {
  session: number;
  open: boolean;
}

export default function MyKartePage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { kartes, counts, hasMore, loading, loadMore } = useMyKarte();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);

  if (!isHydrated) {
    return <div className="px-4 py-3 text-sm text-text-secondary">読み込み中…</div>;
  }

  if (role !== "cast") {
    return (
      <div className="p-4 text-sm">
        <p>カルテはキャストだけが使えます。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }

  const summary = [
    { label: "自分のカルテ", value: counts.total },
    { label: "記録中", value: counts.open },
    { label: "完了", value: counts.closed },
  ];

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <MyKarteHeader />
      </header>
      <div className="px-4 py-3">
        <Button type="button" onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}>
          ＋ カルテを作成
        </Button>
      </div>
      <div className="grid grid-cols-3 border-y border-border text-center">
        {summary.map((item) => (
          <div key={item.label} className="py-3">
            <p className="text-xl font-bold text-text-primary">{item.value}</p>
            <p className="text-xs text-text-secondary">{item.label}</p>
          </div>
        ))}
      </div>
      <KarteList kartes={kartes} variant="mine" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="自分のカルテはまだありません" />
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="karte"
          open={composing.open}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
```


- [ ] **Step 7: Replace the dev catalog**

`src/app/dev/ui/karte/page.tsx` を次に替える:

```tsx
"use client";

import { useState } from "react";
import { KarteCard } from "@/modules/karte/components/KarteCard";
import { KarteEventForm, emptyKarteEvent } from "@/modules/karte/components/KarteEventForm";
import { KarteRatingInput } from "@/modules/karte/components/KarteRatingInput";
import { KarteReliabilityHeader } from "@/modules/karte/components/KarteReliabilityHeader";
import type { Karte } from "@/modules/karte/types";

const mockKartes: Karte[] = [
  {
    id: "k1",
    authorProfileId: "cast-demo",
    authorUsername: "yuna",
    authorDisplayName: "ゆな",
    authorAvatarUrl: "",
    targetProfileId: "guest-demo",
    targetUsername: "guest_demo",
    targetDisplayName: "ゲスト",
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
    lastActivityAt: "2026-10-10T10:00:00Z",
  },
  {
    id: "k2",
    authorProfileId: "cast-other",
    authorUsername: "sakura",
    authorDisplayName: "さくら",
    authorAvatarUrl: "",
    targetProfileId: "guest-demo",
    targetUsername: "guest_demo",
    targetDisplayName: "ゲスト",
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
    lastActivityAt: "2026-10-02T15:00:00Z",
  },
];

export default function DevUiKartePage() {
  const [event, setEvent] = useState(() => emptyKarteEvent());
  const [rating, setRating] = useState<number | null>(null);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 bg-bg p-6 text-text-primary">
      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteReliabilityHeader</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          <KarteReliabilityHeader reliability={{ averageRating: 3.8, raterCount: 8, karteCount: 12 }} />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-divider">
          <KarteReliabilityHeader reliability={{ averageRating: null, raterCount: 0, karteCount: 0 }} />
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteCard</h2>
        <div className="overflow-hidden rounded-lg border border-divider">
          {mockKartes.map((karte) => (
            <KarteCard key={karte.id} karte={karte} variant="feed" onOpen={() => {}} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteRatingInput</h2>
        <KarteRatingInput value={rating} onChange={setRating} />
      </section>

      <section>
        <h2 className="pb-3 text-sm font-bold text-text-secondary">KarteEventForm</h2>
        <KarteEventForm
          guest={{ displayName: "ゲスト", username: "guest_demo", avatarUrl: "" }}
          value={event}
          onChange={setEvent}
          rating={{ value: rating, onChange: setRating }}
          submitLabel="記録中のカルテを作成"
          submitting={false}
          error={null}
          onSubmit={() => {}}
        />
      </section>
    </main>
  );
}
```


- [ ] **Step 8: Delete the old parts and move the typography guard**

```bash
cd dystopia/frontend/src/modules/karte/components
git rm KarteEntryCard.tsx KarteEntryCard.test.tsx KarteEntryCard.profile.test.tsx KarteEntryCard.refresh.test.tsx KarteComposer.tsx KarteComposer.test.tsx KarteEventFields.tsx KarteEventFields.test.tsx KarteRatingSelect.tsx KarteAggregateHeader.tsx KarteAggregateHeader.test.tsx
cd ../../../..
grep -rn "KarteEntryCard\|KarteComposer\|KarteEventFields\|KarteRatingSelect\|KarteAggregateHeader" src
```

Expected: `src/app/globals.test.ts` だけが出る。

`src/app/globals.test.ts` の `readSource("src/modules/karte/components/KarteEntryCard.tsx"),` を `readSource("src/modules/karte/components/KarteDetailSheet.tsx"),` に替え、`'className="flex flex-wrap gap-3 text-sm text-text-secondary"'` を `'className="mt-2 flex gap-4 text-sm text-text-secondary"'` に替える（出来事の「編集」「削除」の行。操作の文字を `text-sm` 以上に保つ確認）。

- [ ] **Step 9: Run every frontend check**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/karte-vitest.txt 2>&1; tail -6 /tmp/karte-vitest.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit > /tmp/karte-tsc.txt 2>&1; echo "tsc exit $?"; tail -20 /tmp/karte-tsc.txt
```

Expected: vitest がすべて通る。`tsc exit 0`。

- [ ] **Step 10: Commit**

```bash
cd dystopia/frontend
git add -A src/modules/karte src/components/compose src/app
git status --short
git commit -s -m "feat(dystopia/frontend): show kartes as summary cards with a detail sheet on every karte screen"
```

`git status --short` に `src/` 以外の変更や意図しないファイルが出ていたら、commit の前に取り除く。

---

### Task 7: Whole-branch verification

**Files:** なし（検証と PR）

- [ ] **Step 1: Run the monolith suite**

Run: `cd dystopia/monolith && HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/karte-rspec.txt 2>&1; tail -5 /tmp/karte-rspec.txt`
Expected: 0 failures

- [ ] **Step 2: Run the frontend checks and the production build**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/karte-vitest.txt 2>&1; tail -6 /tmp/karte-vitest.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit $?"
env -u NODE_OPTIONS pnpm exec next build > /tmp/karte-build.txt 2>&1; echo "build exit $?"; tail -5 /tmp/karte-build.txt
```

Expected: vitest 全件通過、`tsc exit 0`、`build exit 0`

- [ ] **Step 3: Check the scope**

Run: `git diff --stat feat/dystopia-karte-lifecycle...HEAD` と `git status --short`
Expected: 変更が File Structure の表と spec・plan に収まる。`config/db/structure.sql`、karte 以外の stub、`dystopia/frontend/AGENTS.md`・`CLAUDE.md` が含まれない。作業ツリーが clean

- [ ] **Step 4: Check on a real browser**

使い捨て DB を作り、monolith と frontend を起動する（手順はメモリ `reference_local_e2e_run.md` のとおり）。seed のキャスト（`+819000000101`・`+819000000102`）とゲスト（`+819000000104`）でログインし、次を確かめる。

| 操作 | 期待 |
|---|---|
| キャストがゲストのプロフィールのカルテタブを開く | 見出しに「—」「未評価」「0人が評価 · 0件の完了済みカルテ」、下に「このゲストのカルテを書く」 |
| 「このゲストのカルテを書く」→ 予約・問い合わせ／予約成立で作成 | ゲストを選ぶ画面を経ずにフォームが開く。トースト「記録中のカルテを作成しました」、カードに「記録中」「未評価」「予約・問い合わせ · 予約成立」 |
| カードを押す | 右から詳細シート。「KARTE / 記録中」「記録中のため平均評価には含まれません」、「完了する」が押せず「完了するには星を選んでください」 |
| 「＋ 段階を追記する」→ 接客／途中終了 | 補足が空の間は「この段階を追記」が押せない。補足を入れて保存するとトースト「カルテに追記しました」、詳細に戻り出来事が 2 件 |
| 出来事の「編集」で補足を変えて保存 | トースト「出来事を更新しました」、補足が変わる |
| 星 4 → 「完了する」 | シートは開いたまま「KARTE / 完了」、トースト「カルテを完了しました。平均評価へ反映します」。シートを閉じると見出しが「4.0」「1人が評価 · 1件の完了済みカルテ」 |
| 別のキャストで同じゲストのカルテを開く | 詳細シートに操作が出ない |
| 最初のキャストが「再オープン」 | トースト「カルテを再オープンしました。集計から一時除外します」、見出しが「—」に戻る |
| 自分のカルテ | 件数の欄が「自分のカルテ」「記録中」「完了」の正しい数。「＋ カルテを作成」でゲストを選ぶところから作成できる |
| 自分のカルテで古いカルテに追記 | そのカルテが一覧の先頭に上がる |
| ホームのカルテタブ | 最新の出来事の発生日の新しい順に並ぶ。カードから「ゲストのプロフィールを見る →」で移動できる |
| 「このカルテを削除」 | 確認のあとトースト「カルテを削除しました」、シートが閉じ、一覧から消える |
| ゲストでログイン | ナビ・作成メニュー・ホームのタブにカルテが出ない |

monolith と frontend のログに ERROR がないことを確かめる。確認後、サーバーを止め、使い捨て DB を削除し、`dystopia/frontend/AGENTS.md`・`CLAUDE.md` が生成されていれば消す。

- [ ] **Step 5: Push and open the draft PR**

```bash
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-karte-lifecycle --title "feat(dystopia): rebuild the karte screens around summary cards and a detail sheet" --body-file <説明のファイル>
```

PR の説明には、Why（#1517 と #1519 の画面）、Decisions（spec の表）、検証（Step 1〜4 のコマンドと結果）、`Refs #1517`・`Refs #1519` を書く。PR は Draft のままにする。
