# Schedule Cast-Only Writes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SaveSchedule` と `DeleteSchedule` が、キャスト以外のアカウントからの呼び出しを `PERMISSION_DENIED` で断る（issue #1676）。

**Architecture:** 判定は `Schedule::Grpc::ScheduleHandler` に置く。use case の呼び出し元は handler だけで、use case の spec はプロフィールの行を作らずに呼んでいるため、use case に置くと spec を全部作り直すことになる。role は使用中のプロフィールの持ち主のアカウントから `Profile::Slice["use_cases.get_role"]`（`visible_role_of`、`identity__accounts.role`）で引く。クチコミの作成（`review/use_cases/create_review.rb`）と同じ経路で、カルテの `AuthorizeCast` と同じ列を見る。`ListSchedules` は対象外（issue の期待に含まれない）。

**Tech Stack:** Ruby 3.4 / Hanami 2 / gruf 2.22.0 / RSpec

**Spec:** issue #1676（https://github.com/panicboat/monorepo/issues/1676）

## Global Constraints

- 作業ディレクトリは `dystopia/monolith`。rspec は `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > <scratchpad>/rspec.log 2>&1` で実行し、ログファイルを読む
- キャストの role の値は `2`（既存の `ROLE_CAST = 2` と同じ定数名で handler に持つ）
- 断るときの status は `GRPC::Core::StatusCodes::PERMISSION_DENIED`、details は `"キャストだけが予定を登録できます"`
- 判定は use case を呼ぶ前に行い、断ったときは予定の行も投稿も作らない・消さない
- コードコメントは英語で 1 行。タスクや issue への言及を書かない
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- お知らせ付き（`announce: true`）のゲストの保存: 予定の行も公開の投稿も作られない → Task 1 のテスト
- ゲストの削除: 既存の予定（キャストの予定）が消えない → Task 1 のテスト
- 使用中のプロフィールが空（`authenticate_user!` が通った後に profile がない）: `authenticate_user!` の既存の挙動に任せ、追加の分岐を作らない
- 無効化されたプロフィール: `visible_role_of` が nil を返すので断られる → 追加テストなし

---

### Task 1: Refuse schedule writes from non-cast accounts

**Files:**
- Modify: `dystopia/monolith/slices/schedule/grpc/schedule_handler.rb`
- Modify: `dystopia/monolith/spec/slices/schedule/grpc/schedule_handler_spec.rb`

**Interfaces:**
- Produces: `ScheduleHandler#save_schedule` と `#delete_schedule` が、use case を呼ぶ前に `authorize_cast!`（private）を呼ぶ。`authorize_cast!` は `get_role.call(profile_id: current_profile_id) == ROLE_CAST` でなければ `GRPC::BadStatus.new(PERMISSION_DENIED, "キャストだけが予定を登録できます")` を raise する

- [ ] **Step 1: Write the failing tests**

`schedule_handler_spec.rb` に `describe "a guest account"` を足す。既存の `guest`・`cast`・`act_as`・`save`・`db` を使う。gRPC のエラーは `expect { ... }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::PERMISSION_DENIED) }` の形で確かめる。

- `refuses to save a schedule`: `act_as(guest)` → `save("2026-10-20")` が PERMISSION_DENIED、details が `"キャストだけが予定を登録できます"`、`db[:schedule__schedules].count == 0`
- `refuses to save an announced schedule without creating a post`: `act_as(guest)` → `announce: true, announce_time: "09:00", announce_note: "hi"`, `work_date: "2099-10-24"` の保存が PERMISSION_DENIED、`db[:schedule__schedules].count == 0`、`db[:post__posts].where(author_profile_id: guest).count == 0`
- `refuses to delete a schedule`: `act_as(cast)` で `save("2026-10-20")` → `act_as(guest)` → `delete_schedule(work_date: "2026-10-20")` が PERMISSION_DENIED、`db[:schedule__schedules].select_map(:profile_id) == [cast]`

- [ ] **Step 2: Run the spec to verify the new tests fail**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/schedule/grpc/schedule_handler_spec.rb`
Expected: 新しい 3 件が FAIL（例外が起きない）、既存のテストは PASS

- [ ] **Step 3: Add `authorize_cast!` to `ScheduleHandler`**

`get_role` は `review/use_cases/create_review.rb` と同じく `@get_role ||= ::Profile::Slice["use_cases.get_role"]` の private メソッドにする。`save_schedule` と `delete_schedule` で `authenticate_user!` の直後に呼ぶ。

- [ ] **Step 4: Run the schedule specs to verify they pass**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/schedule`
Expected: 全件 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/schedule/grpc/schedule_handler.rb dystopia/monolith/spec/slices/schedule/grpc/schedule_handler_spec.rb
git commit -s -m "fix(dystopia/monolith): allow only cast accounts to save and delete schedules"
```
