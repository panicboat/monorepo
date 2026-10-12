# Dystopia Karte Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` または `superpowers:executing-plans` を使用し、チェックボックス順に実装する。実行方式はユーザーの選択に従う。

**Goal:** バックエンドとの連携を維持し、参照HTMLに沿ったサイト全体のUIと出来事を蓄積できるカルテを提供する。

**Architecture:** 既存カルテ親テーブルを拡張し、子の出来事と親ロックで記録・完了・集計を一致させる。gRPC、BFF、SWR、画面の順に契約をそろえ、共通パネルと既存の認証・プロフィール境界へ接続する。投稿・メッセージ詳細は並列・インターセプトルートを使い、直接URLを開いた場合のページ表示を維持する。

**Tech Stack:** リポジトリのmanifest・lockfileに従うNext.js、React、TypeScript、Radix Dialog、SWR、Vitest、Ruby、Hanami、ROM/Sequel、gRPC、Buf。PostgreSQLはDockerで実行する。

**Spec:** [Dystopia karte experience design](../specs/dystopia-karte-experience-design.md)

## Global Constraints

- 既存の投稿・メッセージ・プロフィール・レビュー等のリクエスト項目を、参照HTMLの少ない入力項目に合わせて削らない。
- 新しいポーリングや常駐処理は追加しない。既存のプロフィール別キャッシュとメッセージのプロバイダーを維持する。
- 所有アカウントIDはクライアントへ公開しない。閲覧・作成は全キャスト、変更は所有アカウント、ゲストは拒否する。
- 発生日は日本の当日を初期値とし、実在する日付だけを保存する。補足は出来事ごとに500文字まで、評価は未評価または1〜5の整数とする。
- 新着は作成日時・IDの降順、出来事は段階内で発生日・記録日時・IDの昇順とする。
- 既存の行・メモ・評価・識別子・記録者・対象・日時・通報情報を保持し、発生日や段階を捏造しない。
- 依存関係を追加しない。既存実装と実際のライブラリsignatureを確認してから使う。
- 会話は日本語、コード・コメント・コミットは英語、ドキュメントは英語見出し・日本語本文とする。追加コメントは1行で制約を説明する。
- コミットは必ず`git commit -s`、`Co-Authored-By`を付けない。独立ブランチ`feat/dystopia-karte-experience`とDraft PR #1522を使用する。
- 各タスクはテストの失敗を確認し、実装後の成功を確認してからコミットする。全タスクと接続受け入れが完了するまで実装完了と報告しない。

## Review Focus

1. 絵文字500文字、閏日、不正な暦日、日本の午前0時を挟む入力をフロントとバックエンドで同じ条件として扱う（Task 1、7）。
2. 評価の省略・`null`・0・文字列・真偽値を区別し、複数プロフィールと複数出来事が評価者の重みを増やさない（Task 4、5）。
3. 完了と追記の並行処理、他カルテの出来事ID、所有者の別プロフィールで、記録の状態と権限を守る（Task 3）。
4. 戻る・進む・別画面への移動・保存中のプロフィール切り替えで、パネルや取得結果が別プロフィールへ残らない（Task 6、8、11）。
5. 出勤の一部失敗・全件失敗・保存中のプロフィール切り替えで、成功した日を保持し、失敗日だけを再試行する（Task 13）。

## File Map

下記の`BE`は`dystopia/monolith`、`FE`は`dystopia/frontend`を表す。タスク内のファイルはこの接頭辞からの正確な相対パスで指定する。

| Boundary | Files and responsibility |
|---|---|
| Contract and validation | `proto/dystopia/karte/v1/service.proto`、`BE/slices/karte/domain/event_rules.rb`、`FE/src/modules/karte/lib/event-catalog.ts`、`validation.ts`: 輸送契約、段階候補、入力条件 |
| Storage | `BE/config/db/migrate/20261012000000_add_karte_events_and_entry_status.rb`、`BE/slices/karte/relations/entries.rb`・`events.rb`、`repositories/entry_repository.rb`・`event_repository.rb`: 保持する移行、親ロック、出来事、集計 |
| Application | `BE/slices/karte/use_cases/`、`domain/errors.rb`、`presenters/entry_presenter.rb`、`grpc/karte_handler.rb`: 認可、保存後の全体検証、状態遷移、RPC |
| Web data | `FE/src/app/api/karte/`、`FE/src/modules/karte/types.ts`・`lib/mappers.ts`・`hooks/`: presence、HTTPエラー、取得・変更・再取得 |
| Shared interface | `FE/src/components/ui/side-sheet.tsx`・`rating-input.tsx`、`FE/src/lib/motion/RouteFade.tsx`、`FE/src/components/shell/`、`FE/src/app/globals.css`: パネル、評価入力、動き、テーマ、配置 |
| Karte interface | `FE/src/modules/karte/components/`、ホーム・自分のカルテ・ゲストプロフィール: 作成、詳細、出来事、状態、一覧、集計 |
| Connected interface | 作成導線、投稿・メッセージ詳細ルート、既存レビュー・プロフィール、`FE/src/modules/schedule/components/ScheduleBulkEditor.tsx`: 既存操作と複数日編集 |

## Execution Environment

Task 1の準備として、既存依存関係と専用Docker DBを用意する。Rubyはインストール済みの4.0.7を`RBENV_VERSION=4.0.7 rbenv exec`で選択し、BundlerはRuby互換のインストール済み4.0.20を使い、Gemの依存は`Gemfile.lock`の版に固定する。フロントはworktree内で`pnpm install --frozen-lockfile`、Rubyは`BUNDLE_FROZEN=true`でインストールする。既存lockfileとmanifestが一致しない場合は原因を特定して報告し、無関係な依存更新で解消しない。

Docker contextは専用のColima profile `dystopia-karte-468d`を使う。起動は`colima start --profile dystopia-karte-468d --runtime docker --activate=false --ssh-config=false --cpus 4 --memory 8`。イメージ名は`BE/docker-compose.yaml`の`services.db.image`から読み、task固有コンテナ`dystopia-karte-468d-db`を`127.0.0.1`の動的ポートへ公開する。Docker ComposeやネイティブPostgreSQLは使用しない。

実行エージェントが起動処理の終了と`pg_isready`の成功を待ち、失敗はコマンド出力と`docker logs`で確認する。同じコンテナ内でもRSpec用`dystopia_karte_test`と接続受け入れ用`dystopia_karte_acceptance`は別DBとし、`DATABASE_URL`を明示する。RSpecのtruncationは専用テストDBだけへ向ける。Stripe等の必須設定はローカル検証専用の値を使い、ユーザーの環境ファイルから資格情報をコピーしない。

各DBへ`HANAMI_ENV=test RBENV_VERSION=4.0.7 rbenv exec bundle exec hanami db migrate`を実行する。以下の`BE: bundle exec rspec ...`は、専用DB・必須設定を渡したこのRuby選択で実行する。`FE: pnpm ...`はworktreeのフロントディレクトリで実行する。バックグラウンドのサーバー・コンテナは実行エージェントが終了を待ち、受け入れ後に自分で起動したものを停止する。

## Contract Decisions

### Events and ratings

`KarteStage = "booking" | "service" | "after_service"`、`KarteStatus = "open" | "closed"`とする。以下の識別子は仕様の日本語候補の順序に対応する。両言語の検証で同じ候補を使い、未知の値・段階不一致・重複タグを拒否する。

| Stage | Outcomes | Tags |
|---|---|---|
| `booking` | `inquiry`, `confirmed`, `cancelled_contacted`, `no_show`, `other` | `smooth_contact`, `contact_issue`, `terms_mismatch`, `date_change`, `advance_notice`, `unagreed_request` |
| `service` | `completed`, `completed_with_issues`, `ended_early`, `other` | `on_time`, `late`, `payment_ok`, `payment_trouble`, `smooth_communication`, `beyond_agreement` |
| `after_service` | `completed`, `next_booking`, `inquiry`, `trouble`, `resolved`, `other` | `polite_contact`, `persistent_contact`, `personal_contact_request`, `terms_mismatch`, `resolved` |

補足必須は`booking/no_show`、`service/ended_early`、`after_service/trouble`と、`unagreed_request`・`payment_trouble`・`beyond_agreement`・`after_service/terms_mismatch`のタグとする。文字数はUnicode code pointで数え、空白のみの補足は空と判定する。星1では出来事または過去のメモに補足が必要とする。

フロントの`KarteEventInput`は`{stage, outcome, tags: string[], note: string, occurredOn: string}`。`KarteEvent`はこれに`id, entryId, createdAt, updatedAt`を加える。Rubyの入力Hashは同じ項目をsnake_caseで持ち、`occurred_on`を検証してDBのdateへ変換する。更新は出来事入力の全項目を受け取り、部分更新は行わない。

`KarteEntry`は既存の公開項目に`rating: number | null, status, closedAt: string | null, events: KarteEvent[], latestEvent: KarteEvent | null, eventCount: number`を持つ。一覧の`events`は空配列、詳細・変更応答は全出来事を持つ。`KarteAggregate`は`{count, avgRating: number | null, authorCount, ratedCount}`、`KarteCounts`は`{total, open, closed}`とする。

### Protobuf presence

既存フィールド番号を維持する。`KarteEntry.rating=6`、`CreateEntryRequest.rating=2`、`UpdateEntryRequest.rating=2`をoptionalにする。`KarteEntry`へ`status=14, closed_at=15, events=16, latest_event=17, event_count=18`、`CreateEntryRequest.first_event=4`を追加する。`Aggregate.avg_rating=2`はoptional、`author_count=3, rated_count=4`を追加する。`ListMyEntriesRequest.status=3`は省略・空文字が全件、`ListMyEntriesResponse.counts=4`を追加する。

`KarteEventInput`は`stage=1, outcome=2, tags=3, note=4, occurred_on=5`、`KarteEvent`は`id=1, entry_id=2, stage=3, outcome=4, tags=5, note=6, occurred_on=7, created_at=8, updated_at=9`。`GetEntry(entry_id)`、`AddEvent(entry_id,event)`、`UpdateEvent(entry_id,event_id,event)`、`DeleteEvent(entry_id,event_id)`、`CloseEntry(entry_id)`、`ReopenEntry(entry_id)`のRPCを追加し、すべて`entry`を返す。

JSONの省略は未変更、`null`は解除、整数1〜5は設定。BFFは`null`をpresenceのある0へ変換する。Ruby更新Hashはキーの不存在・`nil`・整数でこの三状態を保持する。新規作成の未指定・`null`は未評価とする。JSONの数値0、文字列、真偽値は400、protobufの明示0は未評価とする。

## Task 1: Event Contract and Input Rules

**Files:** Modify `proto/dystopia/karte/v1/service.proto`、`BE/stubs/karte/v1/service_pb.rb`・`service_services_pb.rb`、`FE/src/stub/karte/v1/service_pb.ts`、`FE/src/modules/karte/types.ts`。Create `BE/slices/karte/domain/errors.rb`・`event_rules.rb`、`BE/spec/slices/karte/domain/event_rules_spec.rb`、`FE/src/modules/karte/lib/event-catalog.ts`・`validation.ts`・`validation.test.ts`。

**Interfaces:** `Karte::Domain::Errors::{Validation, Access, NotFound, Conflict}`。`EventRules.validate_event!(input) -> normalized Hash`、`validate_entry!(rating:, body:, events:) -> nil`。TSは`validateEvent(input: unknown): Record<string,string>`、`validateKarte(input: unknown): Record<string,string>`、`japanToday(now?: Date): string`を公開する。`types.ts`へKarteStage、KarteStatus、KarteEventInput、KarteEventを追加し、候補のコードと日本語ラベルは`eventCatalog`から取得する。

タスクのテストコード内の結果変数は、各specのfixtureと実処理から作る。Rubyは既存`ProfileFixtures`、Reactは既存`createRoot`/`act`/`vi.mock`を使い、追加のテストライブラリや共通fixture abstractionは作らない。

- [x] **Step 1:** 既存のRSpec・Vitestの書式で検証テストを追加する。省略可能評価、段階別候補、補足条件、文字数、実在日付、日本の日付境界を固定する。

```ts
it("uses Japan's date across midnight", () => expect(japanToday(new Date("2026-10-11T15:00:00Z"))).toBe("2026-10-12"));
it("accepts 500 emoji and rejects 501", () => {
  const input = {stage: "booking", outcome: "confirmed", tags: [], note: "😀".repeat(500), occurredOn: "2028-02-29"} as const;
  expect(validateEvent({...input, tags: []})).toEqual({});
  expect(validateEvent({...input, tags: [], note: "😀".repeat(501)})).toHaveProperty("note");
  expect(validateEvent({...input, tags: [], occurredOn: "2026-02-29"})).toHaveProperty("occurredOn");
});
```

- [x] **Step 2:** `FE: pnpm test src/modules/karte/lib/validation.test.ts`と`BE: bundle exec rspec spec/slices/karte/domain/event_rules_spec.rb`を実行する。未定義の検証関数・クラスでFAILすることを確認する。
- [x] **Step 3:** 上記signatureと契約表を実装する。Rubyは実在日付とIntegerを検証する。TSの500文字は`Array.from(note).length`で数え、不正な入力を切り捨てない。候補ラベルはIssue #1519と照合する。専用環境の準備もこのタスク内で完了する。
- [x] **Step 4:** 両テストが0 failuresになることを確認する。`buf lint proto/dystopia`、`FE: pnpm proto:gen`、`BE: RBENV_VERSION=4.0.7 rbenv exec bundle exec ruby bin/codegen`を実行し、生成差分がカルテ契約だけであることを確認する。optional評価のRuby `has_rating?`とTS presenceを実際の生成コードで確認する。
- [x] **Step 5:** 指定した契約・検証・テスト・生成ファイルだけをstageし、`git commit -s -m "feat(dystopia): define karte events and input rules"`を実行する。

## Task 2: Preserving Storage and Event Repository

**Files:** Create `BE/config/db/migrate/20261012000000_add_karte_events_and_entry_status.rb`、`BE/slices/karte/relations/events.rb`、`BE/slices/karte/repositories/event_repository.rb`、`BE/spec/slices/karte/repositories/event_repository_spec.rb`、`BE/spec/slices/karte/migration_spec.rb`。Modify `BE/slices/karte/relations/entries.rb`、`repositories/entry_repository.rb`、`BE/spec/slices/karte/repositories/entry_repository_spec.rb`。

**Interfaces:** `EntryRepository#create(..., rating: nil, body: nil, status: "open", closed_at: nil)`、`transaction { ... }`、`locking_entry(entry_id) { |entry| ... }`。`EventRepository#create(entry_id:, input:)`、`update(entry_id:, event_id:, input:)`、`delete(entry_id:, event_id:)`、`list_by_entry(entry_id:)`、`summaries(entry_ids:) -> {entry_id => {latest_event:, event_count:}}`。各変更は同一DB transactionに参加する。

- [x] **Step 1:** Docker DBで移行前の行を用意し、移行後の保持を検証する。既存の評価・本文・著者・対象・日時・通報件数を比較し、出来事が作られないことを検証する。別カルテのevent IDを更新・削除できない、過去日順・同日ID順、親削除後の子削除も追加する。

```ruby
it "preserves legacy content without inventing events" do
  expect(migrated_row.slice(:id, :rating, :body, :author_account_id, :author_profile_id, :target_profile_id, :created_at, :updated_at, :reported_count)).to eq(legacy_row.slice(:id, :rating, :body, :author_account_id, :author_profile_id, :target_profile_id, :created_at, :updated_at, :reported_count))
  expect(migrated_row[:status]).to eq("closed")
  expect(events_for_legacy).to eq([])
end
```

- [x] **Step 2:** `BE: bundle exec rspec spec/slices/karte/migration_spec.rb spec/slices/karte/repositories/event_repository_spec.rb`。専用の移行検証用DBへ旧schemaを構築するテスト内のfixtureを使い、未実装のstatus/eventsでFAILを確認する。
- [x] **Step 3:** ALTERで評価をnullable、既存行をclosed、以後のdefaultをopenにする。既存完了日時は元の更新日時を用い、元の日時列は変更しない。statusはopen/closedのCHECKを持つ。eventsはuuid PK、親FKのON DELETE CASCADE、stage/outcome/tags/note/date/timestampsと`(entry_id, created_at DESC, id DESC)`のindexを持つ。タグは既存の`Sequel.pg_jsonb`パターンに従う。親ロックは既存の`ProfileRepository#locking_account`と同じDB transactionと`FOR UPDATE`を使う。
- [x] **Step 4:** タスクのRSpecが0 failuresになることを確認する。summariesは件数のGROUP BYと最新出来事の一括取得を使用し、1件と20件でイベント取得SQL数が増えないテストを通す。移行検証用DBはこのテストが作成・終了・削除を所有する。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): persist karte events without losing existing records"`。

## Task 3: Owned Mutations and Lifecycle

**Files:** Modify `BE/slices/karte/use_cases/create_entry.rb`・`update_entry.rb`・`delete_entry.rb`と対応spec。Create 同ディレクトリの`mutate_entry.rb`・`add_event.rb`・`update_event.rb`・`delete_event.rb`・`close_entry.rb`・`reopen_entry.rb`と対応する`BE/spec/slices/karte/use_cases/*_spec.rb`、`lifecycle_concurrency_spec.rb`。Modify `BE/spec/spec_helper.rb`。

**Interfaces:** `MutateEntry#call(viewer_account_id:, entry_id:, require_open: true) { |locked_entry| ... }`は認可・存在・所有権・状態を確認して親ロック内で実行する。Createは`call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating: nil, body: nil, first_event:)`。Updateは`call(viewer_account_id:, entry_id:, attrs:)`。Add/UpdateEventは`event:`、Update/DeleteEventは`event_id:`を受け取る。Close/Reopen/Deleteは`viewer_account_id:, entry_id:`、削除以外は親を返す。

- [x] **Step 1:** 保存後の全内容検証、最後の出来事削除拒否、完了内容の変更拒否、同状態操作の日時保持、他アカウント拒否、同アカウント別プロフィール許可、旧形式の再オープンをテストする。閉じた旧形式への同状態操作は入力条件を遡及適用しない。

```ruby
it "does not change timestamps when closing an already closed entry" do
  expect(close_entry.call(viewer_account_id: owner_id, entry_id: closed_entry.id).updated_at).to eq(closed_entry.updated_at)
end
it "rejects an append that obtains the lock after completion" do
  expect(append_error).to be_a(Karte::Domain::Errors::Conflict)
  expect(event_repo.list_by_entry(entry_id: entry.id).length).to eq(event_count_before)
end
```

- [x] **Step 2:** `BE: bundle exec rspec spec/slices/karte/use_cases/create_entry_spec.rb spec/slices/karte/use_cases/update_entry_spec.rb spec/slices/karte/use_cases/close_entry_spec.rb spec/slices/karte/use_cases/lifecycle_concurrency_spec.rb`。不足するfirst_event/ロック/状態拒否でFAILを確認する。
- [x] **Step 3:** 親と最初の出来事をtransactionで保存する。内容変更は親ロック内で行い、確定前に全体の補足条件を検証する。完了・再オープンは冪等、再オープンは入力条件の再検証を行わない。deleteは状態を問わず所有者だけ許可する。event操作は必ずparent IDとevent IDの組で探す。
- [x] **Step 4:** `BE: bundle exec rspec spec/slices/karte/use_cases`が0 failuresになることを確認する。競合テストだけ`:committed_database`でtruncationを選び、他のspecは既存transactionを維持する。2接続をQueueで同期し、両スレッドを親テストがjoin/valueで待ち、例外をテストへ返す。DBのstatement/lock timeoutと親の待機timeoutを設定し、失敗時もensureで自分のスレッドを終了・回収する。追記→完了と完了→追記の両順序で確定状態を確認する。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): enforce karte ownership and lifecycle under a row lock"`。

## Task 4: Queries, Presentation and Account-Weighted Aggregates

**Files:** Modify `BE/slices/karte/repositories/entry_repository.rb`、`use_cases/list_entries_by_target.rb`・`list_my_entries.rb`・`list_recent_entries.rb`と対応spec。Create `BE/slices/karte/use_cases/get_entry.rb`、`presenters/entry_presenter.rb`と対応spec。

**Interfaces:** `aggregate(target_profile_id:) -> {count:, avg_rating: nil | Float, author_count:, rated_count:}`、`counts_by_author(author_account_id:) -> {total:, open:, closed:}`、`list_by_author(..., status: nil)`。`EntryPresenter#call(entries:, viewer_account_id:, include_events: false) -> Array<Hash>`で既存の公開項目と新項目を組み立てる。GetEntryは`call(viewer_account_id:, entry_id:) -> Hash`。

- [x] **Step 1:** 同一アカウントの星5を3件、別アカウントの星1を1件、未評価完了・記録中・複数出来事をfixtureにし、集計を固定する。削除プロフィール、読み取り専用cast、guest拒否、状態別件数、作成時刻が同じcursor、追記後に新着順が変わらないことを追加する。

```ruby
it "weights accounts equally rather than entries, profiles or events" do
  expect(repo.aggregate(target_profile_id: target_id)).to eq(count: 6, avg_rating: 3.0, author_count: 2, rated_count: 4)
end
it "distinguishes unrated charts from an empty target" do
  expect(unrated_aggregate).to eq(count: 1, avg_rating: nil, author_count: 0, rated_count: 0)
end
```

- [x] **Step 2:** `BE: bundle exec rspec spec/slices/karte/repositories/entry_repository_spec.rb spec/slices/karte/use_cases/list_entries_by_target_spec.rb spec/slices/karte/use_cases/get_entry_spec.rb`。現行単純平均・不足するdetail/countsでFAILを確認する。
- [x] **Step 3:** 完了・評価ありの親をowner accountでGROUP BYし、その平均を等重みで平均する。総件数は全状態、rated_countは対象親数、author_countは対象アカウント数とする。出来事を集計JOINへ入れない。既存プロフィール・メディアの一括解決とイベントsummariesをPresenterへ集約し、detailだけ全イベントを取得する。
- [x] **Step 4:** `BE: bundle exec rspec spec/slices/karte/repositories spec/slices/karte/use_cases`が0 failures。平均・件数がcursorやlimitで変化しない、event追加や別プロフィールが重みを変えない、1件と20件で関連取得呼び出し数が増えないことを確認する。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): query karte details and account-weighted ratings"`。

## Task 5: gRPC, BFF and Frontend Data

**Files:** Modify `BE/slices/karte/grpc/karte_handler.rb`、`BE/spec/slices/karte/grpc/karte_handler_spec.rb`、`FE/src/app/api/karte/route.ts`・`[id]/route.ts`・`by-target/route.ts`・`my/route.ts`・`recent/route.ts`、`FE/src/modules/karte/types.ts`・`lib/mappers.ts`・既存hooksとindex。Create `FE/src/modules/karte/lib/api-errors.ts`、`FE/src/app/api/karte/routes.test.ts`、`[id]/events/route.ts`・`[id]/events/[eventId]/route.ts`・`[id]/close/route.ts`・`[id]/reopen/route.ts`、`FE/src/modules/karte/hooks/useKarte.ts`・`useKarteEvents.ts`・`useKarteLifecycle.ts`・`mutations.test.tsx`。

**Interfaces:** `useCreateKarte().create({targetProfileId,rating,firstEvent})`、`useUpdateKarte().update(id,{rating?,body?})`、`useKarte(id)`、`useKarteEvents(id).{add(event),update(eventId,event),remove(eventId)}`、`useKarteLifecycle(id).{close(),reopen()}`。変更は`Promise<KarteEntry>`を返し、失敗はErrorを返す。取得は既存のSWR構成、変更は既存`authFetch`を使う。`useMyKarte(status: "all" | KarteStatus)`はcountsを返す。

- [x] **Step 1:** 評価presence、strict JSON入力、全RPC/HTTPルートの所有権・状態・出来事・レスポンス変換をテストする。変更フックの二重送信防止、エラー伝播と完了待ちも固定する。

```ts
it("preserves omitted, cleared and set rating values", async () => {
  expect(rpcRatingFor({})).toEqual({});
  expect(rpcRatingFor({rating: null})).toEqual({rating: 0});
  expect(rpcRatingFor({rating: 5})).toEqual({rating: 5});
});
```

- [x] **Step 2:** `FE: pnpm test src/app/api/karte src/modules/karte/lib/mappers.test.ts src/modules/karte/hooks/mutations.test.tsx`、`BE: bundle exec rspec spec/slices/karte/grpc/karte_handler_spec.rb`。評価解除・新RPC・エラー区分でFAILを確認する。上記テスト内の`rpcRatingFor`は実ルートにmock clientを渡して得たrequestを返すfixtureとする。
- [x] **Step 3:** handlerは`has_rating?`で省略を判定し、明示0をnilへ変換する。BFFはJSONの型とvalidationを検証し、feature-local `handleKarteApiError(error,context)`でFAILED_PRECONDITIONだけ409へ変換する。全体の`grpc-errors.ts`は変更しない。未評価・平均なしはレスポンスでnull、owner IDは返さない。
- [x] **Step 4:** 指定したVitest/RSpecが0 failures。401/403/404/409/400と再試行可能な取得失敗を固定し、文字列`"3"`・false・0、不正なJSON、配列やnullのリクエスト本体を400として拒否する。フックは開始時のprofileを保持し、別profileや破棄済みUIへ結果を適用しない。`FE: pnpm exec tsc --noEmit`で新契約の呼び出し箇所を列挙し、Task 7〜9の変更対象へ対応付ける。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): connect karte lifecycle through gRPC and the BFF"`。

## Task 6: Shared Panels, Motion and Shell

**Files:** Create `FE/src/components/ui/side-sheet.tsx`・`side-sheet.test.tsx`、`FE/src/lib/motion/useBackDismiss.ts`・`useBackDismiss.test.tsx`・`RouteFade.tsx`・`RouteFade.test.tsx`。Modify `FE/src/app/globals.css`、`FE/src/components/ui/button.tsx`・`tab.tsx`・`input.tsx`・`textarea.tsx`・`select.tsx`・`toggle.tsx`・`page-header.tsx`、`FE/src/components/shell/AppShell.tsx`・`TopBar.tsx`・`SideNav.tsx`・`BottomTab.tsx`・`Drawer.tsx`・`SuggestedUsersPane.tsx`と既存対応tests。

**Interfaces:** `SideSheet({open,onOpenChange,title,children,footer?,onBack?,historyMode?: "managed" | "route"})`。`useBackDismiss({open,onDismiss,enabled})`はmanagedパネルだけ同URLの履歴を一つ所有する。`RouteFade({children,transitionKey})`はDOMを再利用してフェードし、childrenをkeyで再マウントしない。

- [x] **Step 1:** 実Radixでタイトル、フォーカス、Esc、背景、戻る、退出アニメーション、reduced motionをテストする。既存shellテストへproviderのmount回数とキャッシュ境界の維持を追加する。

```ts
it("dismisses with Back without leaving the underlying page", async () => {
  expect(window.location.pathname).toBe("/karte/my");
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
it("keeps page state when only the transition key changes", () => expect(pageMounts).toBe(1));
```

- [x] **Step 2:** `FE: pnpm test src/components/ui/side-sheet.test.tsx src/lib/motion src/components/shell`。新パネル・履歴所有・フェードが未実装でFAILすることを確認する。
- [x] **Step 3:** 参照HTMLの配色・余白・幅を既存セマンティックトークンへ適用する。Radix Root/Portal/Overlay/Content/Title/Closeを使い、open=false後もCSS exitをRadixに完了させる。内部段階の戻るとパネルを閉じる操作は別にする。履歴フックは自分のmarkerだけを戻し、popstateで二度戻さない。フェードは160msのopacity変更、終了・破棄時にcancelし、reduced motion時は実行しない。
- [x] **Step 4:** 指定したVitestが0 failures。既存の`AppShell.switch`・`layout`・`recovery`とFlowerMenuのジェスチャーテストを通す。モバイル全幅、PCの参照幅、安全領域、`md`/`xl`の表示境界を実ブラウザ確認の項目へ登録する。CSS値とDialog APIはインストール済み版の実コードで確認する。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): align shared panels and navigation with the connected interface"`。

## Task 7: Karte Event and Rating Forms

**Files:** Create `FE/src/components/ui/rating-input.tsx`・`rating-input.test.tsx`、`FE/src/modules/karte/components/KarteEventForm.tsx`・`KarteEventForm.test.tsx`・`KarteComposer.test.tsx`。Modify `FE/src/modules/karte/components/KarteComposer.tsx`。

**Interfaces:** `RatingInput({value: number | null,onChange,allowUnrated,disabled?})`。`KarteEventForm({value: KarteEventInput,onChange,errors?,disabled?})`。`KarteComposer({targetProfileId,onCreated(entry)})`はTask 5のcreateを使い、成功時だけ通知する。

- [x] **Step 1:** 初期予約・未選択結果・日本の当日・未評価、段階変更後の結果/タグリセット、日付/補足保持、星解除、補足必須、保存失敗時入力保持をテストする。

```ts
it("retains date and note while resetting stage choices", () => {
  expect(formValue).toMatchObject({stage: "service", outcome: "", tags: [], note: "予約時の補足", occurredOn: "2026-10-11"});
});
it("does not default the chart rating to three", () => expect(submittedRating).toBeNull());
```

- [x] **Step 2:** `FE: pnpm test src/components/ui/rating-input.test.tsx src/modules/karte/components/KarteEventForm.test.tsx src/modules/karte/components/KarteComposer.test.tsx`。現行のrating=3、body-only入力でFAILを確認する。
- [x] **Step 3:** 段階別の候補と日付入力、複数タグ、補足、任意評価を実装する。「3が標準」「予約・接客の信頼性」「未評価にする」を操作の説明として表示する。500 code pointをカウンターと検証に使い、入力の自動切り捨てを行わない。処理中は送信を無効化し、失敗はフォームへ返す。
- [x] **Step 4:** 指定Vitestが0 failures。実ルートのcreate requestがtargetProfileId・rating・firstEventを持つことを確認し、別プロフィールへ切り替えた後に旧フォームのonCreatedを実行しないテストを通す。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): compose karte events with optional ratings"`。

## Task 8: Karte Details and Lifecycle Panel

**Files:** Create `FE/src/modules/karte/components/KarteDetailSheet.tsx`・`KarteDetailSheet.test.tsx`・`KarteEventTimeline.tsx`・`KarteEventTimeline.test.tsx`。Modify `FE/src/modules/karte/components/KarteEntryCard.tsx`と既存2つのtests。

**Interfaces:** `KarteDetailSheet({entryId: string | null,onOpenChange,onChanged(entryId)})`、`KarteEventTimeline({events,onEdit?,onDelete?,readOnly})`。Cardは既存identity/profile注記を維持し、`onOpen(entryId)`で親の一つのdetailへ接続する。編集段階は同じSheet内の表示切り替えで行う。

- [x] **Step 1:** 段階別・過去日順、過去のメモ、他cast読み取り専用、所有者の追記/編集/削除/評価変更/完了/再オープン、最後の出来事削除拒否、取得再試行、保存失敗時入力保持を検証する。

```ts
it("reopens without losing events or rating", () => expect(latestEntry).toMatchObject({status: "open", rating: 4, eventCount: 2}));
it("does not render the completed account's panel after a profile switch", () => expect(document.querySelector('[role="dialog"]')).toBeNull());
```

- [x] **Step 2:** `FE: pnpm test src/modules/karte/components/KarteDetailSheet.test.tsx src/modules/karte/components/KarteEventTimeline.test.tsx src/modules/karte/components/KarteEntryCard`。未実装のdetail/状態操作でFAILを確認する。
- [x] **Step 3:** 詳細の全イベントを取得し、編集フォームはTask 7を再利用する。closedでは内容編集を隠し、再オープンと確認付き親削除だけを所有者へ表示する。成功後は返った詳細で更新して関連一覧・集計を再取得する。閉じたフォームの保存エラーは既存toastへ渡し、別profileのパネルを更新しない。通報と記録者/対象リンクは既存処理を維持する。
- [x] **Step 4:** 指定Vitestが0 failures。同一アカウント別プロフィールの注記と編集権限、closed競合409で再取得と入力保持、1つのpanel内で段階戻るができることを確認する。
- [x] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): manage karte events and lifecycle in the detail panel"`。

## Task 9: Karte Discovery and Entry Points

**Files:** Modify `FE/src/app/page.tsx`・`page.test.tsx`、`FE/src/app/karte/my/page.tsx`・`page.test.tsx`、`FE/src/app/u/[username]/page.tsx`・`page.test.tsx`、`FE/src/modules/karte/components/GuestKarteTab.tsx`・`KarteAggregateHeader.tsx`、`FE/src/components/compose/ComposeLauncher.tsx`と既存tests。Create `FE/src/modules/karte/components/GuestKarteTab.test.tsx`・`KarteAggregateHeader.test.tsx`。

**Interfaces:** 一覧ページは`openedEntryId`を一つだけ持ちTask 8へ渡す。作成入口は対象を選択する既存RecipientPickerまたはプロフィールの既知targetをTask 7へ渡す。自分のfilterは`all/open/closed`、件数は全体counts、ゲストの集計はTask 5のAggregateを使う。

- [ ] **Step 1:** 作成直後のopenカードをホームで表示、自分のfilter/全体counts、guestの平均を最初に表示、未評価と0件の区別、cast/guestの作成候補、既知targetで宛先選択を省略することを固定する。

```ts
it("shows equal-account averages with rater and rated-chart counts", () => {
  expect(headerText).toContain("3.0");
  expect(headerText).toContain("2人");
  expect(headerText).toContain("4件");
});
```

- [ ] **Step 2:** `FE: pnpm test src/app/page.test.tsx src/app/karte/my/page.test.tsx 'src/app/u/[username]/page.test.tsx' src/modules/karte/components/GuestKarteTab.test.tsx src/modules/karte/components/KarteAggregateHeader.test.tsx src/components/compose`。旧集計/未実装filterでFAILを確認する。
- [ ] **Step 3:** ホームはサマリー、自分は状態別管理、guestは平均と内訳を優先する。無限一覧は作成日時cursorを維持し、filter変更時に以前のページを混ぜない。関連作成・状態変更・削除が成功した後だけ一覧/集計を再取得する。アクセス失敗は空一覧として表示しない。
- [ ] **Step 4:** 指定Vitestが0 failures、`FE: pnpm exec tsc --noEmit`が終了コード0。FlowerMenuタップ/スライド/キーボードとguestのreview導線を既存テストで確認する。
- [ ] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): surface karte summaries and account-weighted guest ratings"`。

## Task 10: Connected Composition and Editing

**Files:** Modify `FE/src/components/compose/ComposeToDialog.tsx`・`ComposeLauncher.tsx`と対応tests、`FE/src/modules/post/components/PostComposerModal.tsx`とPostComposer既存tests、`FE/src/modules/review/components/ReviewComposer.tsx`・`ReviewEntryCard.tsx`と対応tests、`FE/src/modules/profile/components/EditProfileModal.tsx`・`ProfileManager.tsx`と対応tests。Create `FE/src/modules/messaging/components/MessageDraft.tsx`・`MessageDraft.test.tsx`。

**Interfaces:** 作成・編集はTask 6のSideSheet、reviewはTask 7のRatingInputを使う。`MessageDraft({recipientProfileId,onSent(threadId)})`は既存`POST /api/messaging/messages`へ`{recipientProfileId,content}`を送る。既存PostComposer、プロフィールpayload builder、review mutationの公開signatureは維持する。

- [ ] **Step 1:** 既存作成・編集テストを拡張し、投稿本文/添付/公開範囲、review評価/本文/表示設定、プロフィール画像/基本/身体/SNS/公開設定がリクエストに残ることを確認する。メッセージは宛先選択だけで送信せず、本文送信後に保存済みthreadを開く。フォロー必須条件を維持する。

```ts
it("sends the first message through the existing recipient endpoint", () => expect(sentBody).toEqual({recipientProfileId: "guest-1", content: "予約について相談したいです"}));
it("retains the message draft after a failed send", () => expect(draftText).toBe("予約について相談したいです"));
```

- [ ] **Step 2:** `FE: pnpm test src/components/compose src/modules/post/components src/modules/review/components src/modules/profile/components src/modules/messaging/components/MessageDraft.test.tsx`。旧modal配置・初回message入力でFAILを確認する。
- [ ] **Step 3:** 作成・編集をSideSheetへ接続し、内部フォームと既存request項目を維持する。評価入力は共通RatingInputを使いreviewの必須評価は変更しない。複数の作成操作は既存kind unionで排他的に表示し、編集は同じパネル内の段階変更で行う。メッセージは送信成功後のthreadIdへ移動し、既存の送信制限エラーを表示する。
- [ ] **Step 4:** 指定Vitestと`FE: pnpm exec tsc --noEmit`が終了コード0。プロフィール・投稿の全payload項目が既存テストと一致し、保存失敗で入力と添付を保持し、閉じた画面へ保存結果を適用しないことを確認する。
- [ ] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): connect composition and editing panels to existing flows"`。

## Task 11: Detail Routes and Provider Retention

**Files:** Modify `FE/src/app/layout.tsx`・`messages/layout.tsx`・`posts/[id]/page.tsx`・`messages/[id]/page.tsx`、`FE/src/components/shell/AppShell.tsx`と既存対応tests。Create `FE/src/modules/post/components/PostDetail.tsx`・`PostDetail.test.tsx`、`FE/src/modules/messaging/components/MessageThread.tsx`・`MessageThread.test.tsx`、`FE/src/app/@detail/default.tsx`・`@detail/(.)posts/[id]/page.tsx`・`@detail/[[...catchAll]]/page.tsx`、`FE/src/app/messages/@thread/default.tsx`・`@thread/(.)[id]/page.tsx`・`@thread/[[...catchAll]]/page.tsx`、`FE/src/app/detail-routes.test.tsx`。

**Interfaces:** `PostDetail({postId})`と`MessageThread({threadId})`は直接URL/パネルで同じ実処理を使う。root layout/AppShellは`detail: ReactNode`、messages layoutは`thread: ReactNode`を受け取る。detail slotはプロフィール別SWR境界内、thread slotは既存の単一MessagingPollingProvider内へ配置する。

- [ ] **Step 1:** 既存pageテストを共有詳細へ移し、返信・送信・既読・media表示を確認する。slotの開閉、null route、プロフィール境界、providerの保持をテストする。

```ts
it("does not duplicate the messaging provider when opening a thread panel", () => expect(providerMounts).toBe(1));
it("clears the intercepted slot on a profile switch to home", () => expect(detailSlot).toBeNull());
```

- [ ] **Step 2:** `FE: pnpm test src/modules/post/components/PostDetail.test.tsx src/modules/messaging/components/MessageThread.test.tsx 'src/app/messages/[id]/page.test.tsx' src/app/detail-routes.test.tsx src/components/shell`。共有詳細・slot/providerの不足でFAILを確認する。
- [ ] **Step 3:** intercept routeはTask 6のSideSheetのhistoryMode=routeで`router.back()`を使い、追加の履歴を作らない。optional catch-allとdefaultはnull、通常pageは共有詳細のページ表示とする。プロフィール切り替え時にはdetailも既存holdの対象とする。メッセージpollingは既存providerとuseMessagesに任せ、新しいtimerを追加しない。
- [ ] **Step 4:** 指定Vitestと`FE: pnpm exec tsc --noEmit`が終了コード0。実Nextブラウザで一覧→詳細→Back→Forward、直接URL/再読込→詳細ページ、パネルから別画面→null slotを確認する。既存message送信制限と既読処理を実HTTP経路で維持する。
- [ ] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): preserve detail URLs and providers in side panels"`。

## Task 12: Connected Screen Layouts

**Files:** Modify `FE/src/app/search/page.tsx`・`notifications/page.tsx`・`messages/page.tsx`・`footprints/page.tsx`・`bookmarks/page.tsx`・`ranking/page.tsx`・`settings/page.tsx`・`settings/blocks/page.tsx`・`settings/follow-requests/page.tsx`・`settings/reviews/page.tsx`・`reviews/my/page.tsx`と既存対応tests、`FE/src/modules/profile/components/ProfileHeader.tsx`・`ProfileHeader.test.tsx`。

**Interfaces:** Task 6のtokens・共有UIを各routeへ適用する。検索/通知/足跡/ブックマーク/ランキング/設定の既存取得・変更フックと公開signatureは維持する。

- [ ] **Step 1:** 各既存テストにリクエストの対象ID、絞り込み、未読、ブックマーク、follow/block、review表示設定の維持を追加する。

```ts
it("keeps the search filter connected to its request", () => expect(requestSearchParams.get("type")).toBe(selectedType));
it("marks the selected notification through its existing action", () => expect(markRead).toHaveBeenCalledWith(notificationId));
```

- [ ] **Step 2:** `FE: pnpm test src/app/search src/app/notifications src/app/messages src/app/footprints src/app/bookmarks src/app/ranking src/app/settings src/app/reviews/my src/modules/profile/components/ProfileHeader.test.tsx`。変更対象の配置・操作条件でFAILを確認する。
- [ ] **Step 3:** 共通tokens/部品で参照HTMLの一覧・ヘッダー・タブ・プロフィール配置へ合わせ、取得/変更フックを維持する。空状態・取得失敗・再試行は各既存画面の実データ状態を表示する。
- [ ] **Step 4:** 指定Vitestと`FE: pnpm exec tsc --noEmit`が終了コード0。全対象routeをdark/lightと3つの幅で確認し、長い本文・media・未読・一覧の続きが操作できることを確認する。
- [ ] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): align connected screen layouts and controls"`。

## Task 13: Schedule Bulk Editing

**Files:** Modify `FE/src/modules/schedule/components/ScheduleSection.tsx`・`ScheduleSection.test.tsx`。Create `FE/src/modules/schedule/components/ScheduleBulkEditor.tsx`・`ScheduleBulkEditor.test.tsx`、`FE/src/modules/schedule/hooks/useBulkSchedule.ts`・`useBulkSchedule.test.tsx`。

**Interfaces:** `ScheduleBulkEditor({profileId,onClose,onSaved})`は2週間内の選択日を持つ。`useBulkSchedule().apply({dates,startTime,endTime,off}) -> Promise<{succeeded: string[], failed: {date:string,error:Error}[]}>`は既存の`useSaveSchedule`/`useDeleteSchedule`だけを呼ぶ。選択外の日・別profileは変更しない。

- [ ] **Step 1:** 日付A/B/CのBだけ失敗、全件失敗、offによる削除、翌日までの時間帯、保存中profile切り替えをテストする。既存1日編集も維持する。

```ts
it("retains only failed dates for retry", () => {
  expect(selectedDates).toEqual(["2026-10-13"]);
  expect(result.succeeded).toEqual(["2026-10-12", "2026-10-14"]);
  expect(onClose).not.toHaveBeenCalled();
});
it("keeps every request on the initiating profile", () => expect(requestProfileIds).toEqual(["cast-1", "cast-1", "cast-1"]));
```

- [ ] **Step 2:** `FE: pnpm test src/modules/schedule/components src/modules/schedule/hooks/useBulkSchedule.test.tsx`。複数日編集・一部失敗の不足でFAILを確認する。
- [ ] **Step 3:** Bulk操作は開始時に全日分の有限requestを作り`Promise.allSettled`で全完了を待つ。成功日を再取得し、失敗日だけ選択を残す。offは削除を呼び、永続する「休み」状態を作らない。profileが変わったら後続のUI適用を止める。
- [ ] **Step 4:** 指定Vitestと`FE: pnpm exec tsc --noEmit`が終了コード0。全件成功だけで成功通知と閉じる操作が起こり、一部成功を未保存として巻き戻さないことを確認する。実画面で14日選択・失敗日だけの再試行・再取得結果を確認する。
- [ ] **Step 5:** 対象ファイルだけをstageし、`git commit -s -m "feat(dystopia): support schedule bulk editing with partial failure recovery"`。

## Task 14: Connected Acceptance and Branch Review

**Files:** 失敗を起こした上記ファイルと対応テストだけを修正する。検証結果・判断はDraft PR descriptionへ記載し、プロダクト内の説明や恒久ドキュメントへ実行履歴を追加しない。

**Interfaces:** 全タスクの実HTTP→gRPC→Docker PostgreSQL、既存認証、cast/guest、複数プロフィール、全画面の接続を検証する。rootがサーバー/DBとreviewの完了・エラーを所有する。

- [ ] **Step 1:** 未検証の受け入れケースを列挙し、動作を再現する既存Vitest/RSpecを追加する。バグ修正前は「X が Y を引き起こす。なぜなら Z」で根本原因を報告する。根本原因が不明なまま修正しない。

```ts
it("keeps a saved chart after refetch and excludes it from the average when reopened", () => {
  expect(refetchedEntry).toMatchObject({status: "open", rating: 5, eventCount: 2});
  expect(refetchedAggregate.ratedCount).toBe(0);
});
```

- [ ] **Step 2:** 追加テストが対象の不具合でFAILすることを確認してから修正する。新しい不具合がなければTask 1〜13のテストでこの段階の条件を満たす。
- [ ] **Step 3:** 専用acceptance DBにfixtureを作り、既存の認証経路でローカルfrontend/backendを接続する。認証を迂回する製品コードや新しい依存を追加しない。castで作成→同段階追記→過去日追記→評価解除/設定→完了→再オープン→再完了→削除、別owned profileで変更、別cast閲覧/変更拒否、guest拒否を実行し、HTTP結果とDocker DBの保存内容を照合する。
- [ ] **Step 4:** `FE: pnpm exec tsc --noEmit`、変更ファイルの`pnpm exec eslint <files>`、`pnpm test`、`pnpm build`、`BE: bundle exec rspec`、`buf lint proto/dystopia`、`git diff --check`が終了コード0となることを確認する。360/768/1440px、dark/light/reduced motionで主要画面、パネルscroll、入力欄、media、FlowerMenu、戻る/進むを実ブラウザで確認する。読み取り・書き込み失敗とschedule一部失敗を確認し、再取得後の値が保存内容と一致するまで完了扱いしない。
- [ ] **Step 5:** 選ばれた実行skillの独立reviewを実施し、指摘に対する再現テスト・修正・必要な再検証を完了する。追加コメント全件、非対象変更、生成差分、account ID公開、依存追加をdiffで確認する。残る修正を`git commit -s`し、`git push`後にDraft PR #1522の英語titleとWhy中心のdescriptionを最終実装へ更新する。コマンド・出力付きVERIFIED、読解のREASONED、未確認のASSUMEDを分け、起動したプロセスとコンテナを停止して結果を報告する。

## Coverage and Sources

| Spec section | Owning tasks |
|---|---|
| Shell, theme, motion, focus, reduced motion | 6、10、11、12、14 |
| Karte entry points, recording, details, lifecycle | 1、3、7、8、9 |
| Storage, ownership, legacy migration | 2、3、4 |
| Aggregation, pagination, deleted profiles | 4、5、9 |
| RPC/BFF contracts and error responses | 1、5 |
| Existing connected flows and schedule | 10、11、12、13 |
| Async ownership, errors, profile isolation | 3、5、6、7、8、10、11、13、14 |
| Backend/frontend/connected verification | 各タスクのテストと14 |

並列slotはsoft navigationで残るため、閉じる遷移に一致するnull routeが必要となる。直接アクセス時の通常ページとBack/Forwardを同じURLで扱う構成は[Next.js Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)と[Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)に従う。退出中にContentを親から破棄しない構成は[Radix Animation](https://www.radix-ui.com/primitives/docs/guides/animation)、focus/Esc/titleは[Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)に従う。
