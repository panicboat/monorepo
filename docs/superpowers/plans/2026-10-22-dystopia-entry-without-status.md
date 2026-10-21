# Dystopia Karte and Review without Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** カルテとクチコミから「記録中／完了」の状態をなくし、星が付いたものだけを平均評価に入れる。

**Architecture:** DB から `status`・`closed_at` を削除し、平均の集計を `rating IS NOT NULL` で絞る。完了・再オープンの RPC・use case・画面の操作を削除し、件数を「合計・未評価」にする。カルテとクチコミは同じ形に変える。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、buf protobuf、Next.js（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-22-dystopia-entry-without-status-design.md`

## Global Constraints

- 平均評価に入る条件は「星が付いていること」（`rating IS NOT NULL`）。計算方法（作成者ごとの平均の平均）は変えない
- 星の変更・出来事の追記・編集・削除は、作成者ならいつでもできる。最後の出来事を削除すると本体も削除する（今のまま）
- 自分の一覧の件数は「合計」「未評価」。proto は `{ int32 total_count = 1; int32 unrated_count = 2; }`
- 画面の文言（そのまま使う）: 星の下の説明「星を付けると平均評価に反映されます」（未評価）／「平均評価に反映されています」（星あり）。作成ボタン「カルテを作成」「クチコミを作成」。信頼性の見出し「N件の評価済みカルテ」「N件の評価済みクチコミ」。詳細の見出し「KARTE」（クチコミは今の見出しから「/ 記録中」「/ 完了」を外す）
- proto はその場で作り替える。スタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、変更した package（`karte.v1`・`review.v1`）の差分だけを commit する。ほかの package の差分は `git checkout` で戻し、未追跡の billing のスタブは消す
- コードコメントは英語で 1 行、task への言及なし。commit は `git commit -s`、`Co-Authored-By` は付けない、末尾に空行と `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5`
- monolith の検証: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <paths> > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`（test DB は migration を当ててから: `HANAMI_ENV=test bundle exec hanami db migrate`。structure.sql の pg_dump の失敗は無視してよく、structure.sql は commit しない）
- frontend の検証: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run <paths>` と `env -u NODE_OPTIONS pnpm exec tsc --noEmit`
- shell: `cat` は bat なので `command cat`。grep は `/usr/bin/grep`

## Review Focus

1. 星を外したカルテ: 平均から外れ、未評価に数えられる（Task 1 の spec で固定）
2. 星付きの今のデータ: migration のあと、記録中だったものも平均に入る（Task 1 の repository spec で、状態列のない状態の星付きが集計されることで固定）
3. 見えない相手のクチコミ: 自分の件数から今までどおり除かれる（Task 3 の spec で固定）
4. 未評価のカルテの詳細: 星を付けると説明が「平均評価に反映されています」に変わる（Task 2 の test で固定）
5. 完了・再オープンの BFF route を呼ぶ画面が残っていない（Task 2・4 で route と mutation を消し、tsc で固定）

---

作業場所は worktree `.worktrees/refactor-dystopia-entry-status`（ブランチ `refactor/dystopia-entry-status`）。設計書の commit が乗っている。

### Task 1: Karte backend

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261022000000_drop_karte_status.rb`
- Modify: `proto/dystopia/karte/v1/service.proto`、monolith の karte スタブ（`bin/codegen` の出力）
- Modify: `dystopia/monolith/slices/karte/` の relation・repository・handler・`load_own_karte`・`present_kartes`・`add_karte_event`・`update_karte_event`・`update_karte_rating`・`delete_karte_event`
- Delete: `slices/karte/use_cases/close_karte.rb`、`reopen_karte.rb`
- Modify: `spec/slices/karte/**`（`/usr/bin/grep -rln -E "close_karte|reopen_karte|CloseKarte|ReopenKarte|status|closed_at|open_count|closed_count" spec/slices/karte`）

**Interfaces:**
- Produces: proto `karte.v1` から `KarteStatus`・`Karte.status`・`Karte.closed_at`・`CloseKarte`・`ReopenKarte` がなくなり、`KarteCounts { total_count = 1; unrated_count = 2; }`。`counts_by_author` は `{ total:, unrated: }`

- [ ] **Step 1: Migration**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:"karte__kartes") do
      drop_constraint :closed_karte_rated
      drop_constraint :closed_at_matches_status
      drop_constraint :status_value
      drop_column :closed_at
      drop_column :status
    end
    run "DROP INDEX IF EXISTS karte.idx_karte_kartes_reliability"
    run <<~SQL
      CREATE INDEX idx_karte_kartes_reliability
        ON karte.kartes (target_profile_id, author_profile_id)
        WHERE rating IS NOT NULL
    SQL
  end

  down do
    raise Sequel::Error, "irreversible: karte statuses are not restored"
  end
end
```

`DROP INDEX` は、列の削除で索引がすでに消えている場合のために `IF EXISTS` を付ける。

- [ ] **Step 2: Specs first**

既存の spec から完了・再オープン・状態の確認を削除し、次の例を足す（書き方は `spec/slices/karte/use_cases/karte_lifecycle_spec.rb` と `spec/slices/karte/repositories/karte_repository_spec.rb` に合わせる）:

- 星付きのカルテだけが `reliability` に入り、星を外す（`update_karte_rating` で `rating: nil`）と外れる
- 星なしで作成したカルテに、出来事の追記・編集と星の変更ができる（状態の確認がない）
- `counts_by_author` が `{ total: 2, unrated: 1 }` を返す（星付き 1 件と星なし 1 件）
- handler の `ListMyKartes` の `counts` が `total_count`・`unrated_count` を返す
- handler に `close_karte`・`reopen_karte` がない（`expect(described_class.method_defined?(:close_karte)).to be false` などで、RPC の削除を固定する）

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/karte`
Expected: 足した例が FAIL

- [ ] **Step 3: Proto and stubs**

`proto/dystopia/karte/v1/service.proto` から `rpc CloseKarte`・`rpc ReopenKarte`・その request/response・`enum KarteStatus`・`Karte` の `status`（10）と `closed_at`（14）を削除する。削除した番号は `reserved 10, 14;` で予約する。`KarteCounts` を `{ int32 total_count = 1; int32 unrated_count = 2; }` にする（今の open/closed の番号は `reserved` で予約する）。`cd dystopia/monolith && bin/codegen` で再生成し、`karte` 以外の差分は戻す。

- [ ] **Step 4: Monolith**

- relation から `status`・`closed_at` を外す
- repository: `close`・`reopen` を削除する。`create` の `status: "open"` を外す。`reliability` の `status: "closed"` を `Sequel.~(rating: nil)`（`rating IS NOT NULL`）に替える。`counts_by_author` を次にする:

```ruby
      def counts_by_author(author_account_id:)
        # Remove the relation's implicit ORDER BY because PostgreSQL rejects it with aggregates.
        row = karte_records.dataset.unordered
          .where(author_account_id: author_account_id)
          .select(Sequel.function(:count).*.as(:total), Sequel.function(:count).*.filter(rating: nil).as(:unrated))
          .first
        { total: row[:total].to_i, unrated: row[:unrated].to_i }
      end
```

- `load_own_karte`: `require_open` の引数と確認を削除し、呼び出し側（追記・編集・星の変更・出来事の削除）から `require_open:` を外す
- `close_karte.rb`・`reopen_karte.rb` を削除し、handler の依存・`rpc` 行・`close_karte`・`reopen_karte` メソッドと `STATUS_TO_PROTO` を削除する
- `present_kartes` と handler の `karte_to_proto` から `status`・`closed_at` を外す。counts は `::Karte::V1::KarteCounts.new(total_count: counts[:total], unrated_count: counts[:unrated])`
- `/usr/bin/grep -rn -E "status|closed_at|require_open|close_karte|reopen_karte" slices/karte` で残りがないことを確かめる

- [ ] **Step 5: Run and commit**

Run: `HANAMI_ENV=test bundle exec hanami db migrate`（pg_dump の失敗は無視）、`HANAMI_ENV=test bundle exec rspec spec/slices/karte`、最後に全体 `HANAMI_ENV=test bundle exec rspec`
Expected: 0 failures（クチコミ側は Task 3 まで今のまま通る）

```bash
git add dystopia/monolith proto/dystopia/karte
git commit -s -m "refactor(dystopia): count rated kartes without an open or closed status

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

`dystopia/monolith/config/db/structure.sql` は commit しない。

### Task 2: Karte frontend

**Files:**
- Modify: frontend の karte スタブ（`pnpm proto:gen` の出力）
- Delete: `dystopia/frontend/src/app/api/karte/[id]/close/`、`dystopia/frontend/src/app/api/karte/[id]/reopen/`
- Modify: `src/modules/karte/types.ts`・`lib/mappers.ts`・`hooks/useKarteMutations.ts`・`hooks/useMyKarte.ts`・`components/KarteDetailSheet.tsx`・`KarteCard.tsx`・`KarteCreateForm.tsx`・`KarteEventForm.tsx`・`KarteReliabilityHeader.tsx`、`src/app/karte/my/page.tsx`、`src/app/dev/ui/karte/page.tsx`
- Modify: 関係するテスト（`/usr/bin/grep -rln -E "reopen|close\(|closedAt|\"closed\"|\"open\"|counts\.open|counts\.closed|記録中|完了" src --include=*.test.ts --include=*.test.tsx | /usr/bin/grep -i karte`）

**Interfaces:**
- Consumes: Task 1 の proto
- Produces: `Karte` 型に `status`・`closedAt` がない。`KarteCounts = { total: number; unrated: number }`。`useKarteMutations` に `close`・`reopen` がない

- [ ] **Step 1: Stubs**

`cd dystopia/frontend && env -u NODE_OPTIONS pnpm proto:gen`。`src/stub/karte/` 以外の差分は戻す。

- [ ] **Step 2: Tests first**

- `KarteDetailSheet.test.tsx`: 完了・再オープンのテストを削除する。次を足す:
  - 「完了する」「再オープン」のボタンがない
  - 未評価のとき「星を付けると平均評価に反映されます」、星ありのとき「平均評価に反映されています」
  - 未評価のカルテで星を選ぶと（`updateRating` が星付きのカルテを返す）説明が「平均評価に反映されています」に変わる（Review Focus 4）
  - 見出しが「KARTE」で「記録中」「完了」を含まない
  - 出来事の「編集」と「＋ 段階を追記する」が作成者に出る
- `KarteCard.test.tsx`: 状態の印（「記録中」「完了」）が出ない
- `KarteCreateForm.test.tsx`: 送信ボタンが「カルテを作成」
- `KarteReliabilityHeader.test.tsx`: 「N件の評価済みカルテ」
- `src/app/karte/my/page.test.tsx`: 件数の見出しが「合計」「未評価」で、`unrated` の値が出る
- `lib/mappers.test.ts`: counts を `{ total, unrated }` に変換する。`status`・`closedAt` を持たない
- `hooks/useKarteMutations.test.ts`: `close`・`reopen` を呼ぶ行を削除する

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/modules/karte src/app/karte src/app/api/karte`
Expected: 足したテストが FAIL

- [ ] **Step 3: Implement**

- `close`・`reopen` の BFF route のディレクトリを削除し、`routes.test.ts` の該当の例を削除する
- 型・mapper から `status`・`closedAt`・`KarteStatus` を削除し、counts を `{ total: counts?.totalCount ?? 0, unrated: counts?.unratedCount ?? 0 }` にする。`useMyKarte` の初期値も `{ total: 0, unrated: 0 }`
- `useKarteMutations` から `close`・`reopen` を削除する
- `KarteDetailSheet`: `isOpen`・`editable` の状態による分岐をなくし、作成者（`karte.isMine`）なら編集・追記・削除を出す。完了・再オープンのブロックと状態の印を削除し、星の下の説明を Global Constraints の文言にする。見出しを「KARTE」にする
- `KarteCard`: `StatusBadge` を削除する（タグはそのまま）
- `KarteCreateForm`: `submitLabel="カルテを作成"`
- `KarteEventForm`: 星の説明から完了に触れる文を削除する（「3.0 が標準。評価はカルテ全体につき 1 つです。」まで残す）
- `KarteReliabilityHeader`: 「{reliability.karteCount}件の評価済みカルテ」
- `src/app/karte/my/page.tsx`: 件数を `{ label: "合計", value: counts.total }, { label: "未評価", value: counts.unrated }`
- `src/app/dev/ui/karte/page.tsx`: サンプルから `status`・`closedAt` を外し、`submitLabel` を合わせる
- `/usr/bin/grep -rn -E "status|closedAt|reopen|記録中|完了" src/modules/karte src/app/karte src/app/api/karte | /usr/bin/grep -v "\.test\."` で残りを確かめる（`catalog.ts` の出来事の結果の「完了」は対象外）

- [ ] **Step 4: Run and commit**

Run: frontend の全 vitest と tsc
Expected: 全件 PASS（クチコミ側は今のまま）、tsc exit 0

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): drop the karte status from the screens

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 3: Review backend

Task 1 と同じ変更をクチコミに行う。違いだけを書く。

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261022000001_drop_review_status.rb`
- Modify: `proto/dystopia/review/v1/service.proto`、monolith の review スタブ、`dystopia/monolith/slices/review/`（Task 1 と同じ範囲に加えて `use_cases/list_my_reviews.rb`）
- Delete: `slices/review/use_cases/close_review.rb`、`reopen_review.rb`
- Modify: `spec/slices/review/**`

- [ ] **Step 1: Migration** — Task 1 の migration と同じ形で `review__reviews` から制約 `closed_review_rated`・`closed_at_matches_status`・`status_value` と列を削除し、`review.idx_review_reviews_summary` を `WHERE rating IS NOT NULL` で作り直す（down は irreversible）

- [ ] **Step 2: Specs first** — Task 1 の Step 2 と同じ例をクチコミで足す。加えて、見えない相手（停止・無効化）のクチコミが自分の件数に入らないことを確かめる（Review Focus 3。今の `list_my_reviews` の spec の書き方に合わせる）

- [ ] **Step 3: Proto and stubs** — Task 1 と同じ（`ReviewStatus`、`Review.status`・`closed_at`、`CloseReview`・`ReopenReview`、`ReviewCounts`）

- [ ] **Step 4: Monolith** — Task 1 と同じ。`list_my_reviews.rb` の件数は、`parties_and_statuses_by_account` を `parties_and_ratings_by_account`（`author_profile_id`・`target_profile_id`・`rating` を返す）に変え、`filter_visible_reviews.own` で絞ったあとに `total: rows.size, unrated: rows.count { |row| row.rating.nil? }` で数える。`summary`（平均）の `status: "closed"` を `rating IS NOT NULL` にする

- [ ] **Step 5: Run and commit** — Task 1 と同じ手順。commit message は `refactor(dystopia): count rated reviews without an open or closed status`

### Task 4: Review frontend

Task 2 と同じ変更をクチコミに行う（`src/modules/review/`、`src/app/reviews/my/page.tsx`、`src/app/api/review/[id]/close`・`reopen`、`ReviewSummaryHeader`、`CastReviewsTab` のテストなど）。文言は「クチコミを作成」「N件の評価済みクチコミ」。詳細シートの見出しから「/ 記録中」「/ 完了」を外す。

- [ ] **Step 1: Stubs** — `pnpm proto:gen`、`src/stub/review/` 以外の差分は戻す
- [ ] **Step 2: Tests first** — Task 2 の Step 2 と同じ項目をクチコミで
- [ ] **Step 3: Implement** — Task 2 の Step 3 と同じ項目をクチコミで
- [ ] **Step 4: Run and commit** — 全 vitest と tsc。commit message は `refactor(dystopia): drop the review status from the screens`

### Task 5: End-to-end check and the PR

- [ ] **Step 1: Run the suites** — monolith の全 rspec、frontend の全 vitest と tsc。Expected: 0 failures、全件 PASS、tsc exit 0

- [ ] **Step 2: Check it in the running app** — memory の `reference_local_e2e_run.md` の手順（使い捨て DB）で:
  1. キャストが星付きでカルテを作ると、すぐゲストのプロフィールの信頼性（平均）に入る
  2. 星なしで作ると平均に入らず、自分のカルテ一覧の「未評価」に数えられる。詳細で星を付けると平均に入り、未評価が減る
  3. 詳細シートに「完了する」「再オープン」がない
  4. ゲストがクチコミで 1〜3 を確かめる
  起動したプロセスは最後に止め、DB を消し、ポートが空いたことを確かめる

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --draft --base main --title "refactor(dystopia): drop the open and closed status from kartes and reviews" --body-file <scratchpad>/pr.md
```

PR 本文: Closes #1582、Why（完了の操作と完了忘れ）、What（ルール・DB・RPC・画面）、Verification、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と空行と session URL。
