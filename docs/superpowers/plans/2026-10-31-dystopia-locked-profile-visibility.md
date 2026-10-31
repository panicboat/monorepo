# Dystopia locked profile visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 鍵をかけると、フォローしていない人から予定とクチコミが見えなくなるようにする。

**Architecture:** 鍵を通れるかの判定を `Social` の use case 1 つにまとめ、予定とクチコミの use case がそれを呼ぶ。
画面は自分で判定せず、サーバーが返す `hidden_by_lock` と `author_hidden` に従う。
追加する proto の項目はすべて新しい番号なので、古い画面とも共存できる。

**Tech Stack:** Hanami slices, ROM-SQL, gRPC (Gruf), buf, RSpec, Next.js, SWR, vitest

**Spec:** `docs/superpowers/specs/2026-10-31-dystopia-locked-profile-visibility-design.md`

## Global Constraints

- 鍵の定義: 「鍵をかけると、フォローしていない人から予定とクチコミが見えなくなる。」
- 鍵を通れるのは、鍵がオフ、本人（使用中のプロフィールが同じ）、承認済みフォロワーだけ。判定はプロフィール単位。
- 案内の文言は `フォローすると見られます`、伏せた書き手の表示は `（非公開のゲスト）`。
- 規約とポリシーの本文は変えない（`terms.ts`・`privacy.ts` を diff に含めない）。
- 画面に鍵の判定を書かない。
- Commit は `git commit -s`、`Co-Authored-By` は付けない、コメントは英語で 1 行、タスクへの言及を書かない。
- `bin/codegen` と `pnpm proto:gen` は無関係な stub にも差分を出す。`review` と `schedule` の stub だけを commit し、他の差分は `git checkout` で戻し、billing の未追跡 stub は消す。
- monolith の CI は rspec を回さない。`dystopia/monolith` で `HANAMI_ENV=test bundle exec rspec <path> > /tmp/rspec.log 2>&1` を実行してファイルを読む。
- frontend の型検査は `pnpm exec tsc --noEmit --incremental false`。

## Review Focus

- ブロックの関係にある閲覧者が鍵付きプロフィールを開く: フォローできないので案内を出さない（`hidden_by_lock` は false、内容と平均は出さない）。→ Task 2・Task 3
- 承認待ちの閲覧者: フォロワーとして扱わない。→ Task 1
- 書き手が無効で、かつ鍵付き: 「（無効なゲスト）」を優先する（`author_hidden` は false）。→ Task 4
- 書いたゲストが同じアカウントの別プロフィールを使っている: `is_mine` なので名前は見えるが、対象キャストの一覧はそのプロフィールの鍵の判定に従う。→ Task 4
- 鍵で落ちる行が多いページ送り: 「最近のクチコミ」と「書いたクチコミ」で、ページが埋まるまで先を読み、`has_more` が正しい。→ Task 3

---

## Task 1: Lock judgment

**Files:**
- Modify: `dystopia/monolith/slices/profile/repositories/profile_repository.rb`（`visible_follow_approval_required_ids` の隣）
- Create: `dystopia/monolith/slices/profile/use_cases/list_locked_profile_ids.rb`
- Create: `dystopia/monolith/slices/social/use_cases/list_lock_passable_profile_ids.rb`
- Test: `dystopia/monolith/spec/slices/social/use_cases/lock_passable_profile_ids_spec.rb`

**Interfaces:**
- Produces: `Social::Slice["use_cases.list_lock_passable_profile_ids"].call(viewer_profile_id:, profile_ids:) -> Set<String>`
  - 無効なプロフィールは鍵なしとして扱う（戻り値に含む）。無効の扱いは各 use case の既存の判定に任せる。

- [ ] **Step 1: Write the failing test**

`create_account_with_profile(is_private: true)` と `follow_repo.follow(follower_profile_id:, followee_profile_id:, status:)` で組み立てる。

```ruby
it "passes an unlocked profile for anyone, nil viewer included"
it "passes a locked profile for the profile itself"
it "passes a locked profile for an approved follower"
it "does not pass a locked profile for a pending follower"
it "does not pass a locked profile for an unrelated viewer or a nil viewer"
it "does not pass a locked profile for another profile of the same account"
it "passes a disabled locked profile" # disabled_at を入れた行
it "reflects the lock turned off without any data change"
# 各例: expect(uc.call(viewer_profile_id: viewer, profile_ids: [target])).to include(target) / not_to include(target)
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/social/use_cases/lock_passable_profile_ids_spec.rb > /tmp/rspec.log 2>&1`
Expected: FAIL（`use_cases.list_lock_passable_profile_ids` がない）

- [ ] **Step 3: Implement**

- `ProfileRepository#visible_locked_ids(ids)`: `visible_follow_approval_required_ids` と同じ形で `is_private: true`。
- `Profile::UseCases::ListLockedProfileIds#call(profile_ids:)`: `ListFollowApprovalRequiredIds` と同じ形。
- `Social::UseCases::ListLockPassableProfileIds#call(viewer_profile_id:, profile_ids:)`: `ids` を文字列に揃え、`ids - locked` に、viewer 本人と、`follow_repo.status_batch` が `"approved"` の相手を足した `Set` を返す。viewer が nil のときは `status_batch` を呼ばない。

- [ ] **Step 4: Run the test and confirm that it passes**

Run: 同じコマンド。Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/profile dystopia/monolith/slices/social dystopia/monolith/spec/slices/social/use_cases/lock_passable_profile_ids_spec.rb
git commit -s -m "feat(dystopia): decide who passes a profile lock"
```

## Task 2: Schedules

**Files:**
- Modify: `proto/dystopia/schedule/v1/schedule_service.proto`（`ListSchedulesResponse` に `bool hidden_by_lock = 2;`）
- Modify: `dystopia/monolith/stubs/schedule/v1/schedule_service_pb.rb`、`dystopia/frontend/src/stub/schedule/v1/schedule_service_pb.ts`（生成）
- Modify: `dystopia/monolith/slices/schedule/use_cases/list_schedules.rb`、`dystopia/monolith/slices/schedule/grpc/schedule_handler.rb`
- Modify: `dystopia/monolith/slices/discovery/use_cases/search_schedules.rb`（`candidate_ids`）
- Test: `dystopia/monolith/spec/slices/schedule/use_cases/list_schedules_spec.rb`、`dystopia/monolith/spec/slices/schedule/grpc/schedule_handler_spec.rb`、`dystopia/monolith/spec/slices/discovery/use_cases/search_schedules_spec.rb`

**Interfaces:**
- Consumes: `use_cases.list_lock_passable_profile_ids`
- Produces: `ListSchedules#hidden_by_lock?(profile_id:, viewer_profile_id:) -> bool`、proto の `ListSchedulesResponse.hidden_by_lock`
  - `call` の戻り値は配列のまま（呼び出し元の spec を変えないため）。

- [ ] **Step 1: Write the failing tests**

```ruby
# list_schedules_spec.rb, describe "lock": is_private の cast に予定を 1 件保存した状態
it "returns no rows and hides by lock for a viewer who does not follow" # list == [], hidden_by_lock? == true
it "does the same for a pending follower"
it "returns rows for an approved follower and the owner"                 # size == 1, hidden_by_lock? == false
it "does not report the lock to a blocked viewer"                        # list == [], hidden_by_lock? == false
it "does not report the lock when the viewer profile is nil"             # false
it "follows the lock being turned off without data changes"

# schedule_handler_spec.rb
it "sets hidden_by_lock on the response for a viewer who cannot pass"

# search_schedules_spec.rb
it "excludes a locked cast from a viewer who does not follow"
it "includes a locked cast for an approved follower and the cast itself"
it "excludes a locked cast from a pending follower"
it "keeps the page full and has_more correct when locked casts are excluded" # limit: 1 で鍵付きを挟む
```

- [ ] **Step 2: Run the tests and confirm that they fail**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/schedule spec/slices/discovery/use_cases/search_schedules_spec.rb > /tmp/rspec.log 2>&1`
Expected: FAIL

- [ ] **Step 3: Add the proto field and generate the stubs**

Run: `bin/codegen`（monolith）、`pnpm proto:gen`（frontend）。
Expected: `git status` で schedule の stub に差分がある。Global Constraints のとおり他の差分を戻す。

- [ ] **Step 4: Implement**

- `ListSchedules#call`: 既存の 3 つの早期 return の後に、鍵を通れなければ `[]`。
- `ListSchedules#hidden_by_lock?`: viewer がある、ブロックの関係にない、プロフィールがある、鍵を通れない、のすべてで true。
- handler: `hidden_by_lock: list_schedules_uc.hidden_by_lock?(...)` を足す。
- `SearchSchedules#candidate_ids`: 既存の絞り込みの後で `list_lock_passable_profile_ids` に含まれる id だけ残す。`schedule_repo.search` の前なのでページングは崩れない。

- [ ] **Step 5: Run the tests and confirm that they pass**

Run: 同じコマンド、加えて `spec/slices/api_input_validation_spec.rb spec/slices/profile/visibility_wiring_spec.rb`。Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add proto/dystopia/schedule dystopia/monolith/stubs/schedule dystopia/frontend/src/stub/schedule dystopia/monolith/slices/schedule dystopia/monolith/slices/discovery dystopia/monolith/spec/slices/schedule dystopia/monolith/spec/slices/discovery
git commit -s -m "feat(dystopia): hide schedules of a locked cast from viewers who do not follow"
```

## Task 3: Review visibility

**Files:**
- Modify: `proto/dystopia/review/v1/service.proto`（`ListReviewsByTargetResponse` に `bool hidden_by_lock = 5;`、`ListReviewsByAuthorResponse` に `bool hidden_by_lock = 4;`）
- Modify: `dystopia/monolith/stubs/review/v1/service_pb.rb`、`dystopia/frontend/src/stub/review/v1/service_pb.ts`（生成）
- Modify: `dystopia/monolith/slices/review/use_cases/filter_visible_reviews.rb`、`list_reviews_by_target.rb`、`list_reviews_by_author.rb`
- Modify: `dystopia/monolith/slices/review/grpc/review_handler.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/locked_reviews_spec.rb`（新規。`list_reviews_spec.rb` の `write`・`by_target` の形に合わせる）

**Interfaces:**
- Consumes: `use_cases.list_lock_passable_profile_ids`
- Produces:
  - `FilterVisibleReviews#lock_passable?(viewer_profile_id:, profile_id:) -> bool`
  - `FilterVisibleReviews#blocked?(viewer_profile_id:, profile_id:) -> bool`
  - `ListReviewsByTarget#call` と `ListReviewsByAuthor#call` の戻り値に `hidden_by_lock:`（常に true か false）

- [ ] **Step 1: Write the failing test**

```ruby
describe "the list of a locked cast" do
  it "returns nothing, NO_SUMMARY and hidden_by_lock for a viewer who cannot pass"
  # result == { reviews: [], next_cursor: nil, has_more: false, summary: NO_SUMMARY, hidden_by_lock: true }
  it "does the same for a pending follower"
  it "returns the reviews and the summary of all reviews for a follower, the reviews of a locked guest included"
  it "returns them for the cast itself"
  it "hides the summary and does not report the lock to a blocked viewer" # NO_SUMMARY, hidden_by_lock: false
end

describe "the list of an unlocked cast" do
  it "keeps the summary for every viewer and hidden_by_lock false"
end

describe "the written reviews of a locked guest" do
  it "returns nothing and hidden_by_lock for a viewer who cannot pass"
  it "returns all of them to the guest, locked casts included"
end

describe "the written reviews of an unlocked guest" do
  it "drops reviews of a locked cast the viewer does not follow"
  it "keeps them when the target cast is disabled"
  it "fills the page past dropped reviews and reports has_more correctly"
end

describe "recent reviews" do
  it "drops reviews of a locked cast the viewer does not follow, and keeps them for a follower"
  it "fills the page past dropped reviews and reports has_more correctly"
end

describe "a single review" do
  it "raises Errors::Invalid for a viewer who cannot pass the lock of the cast or the guest"
  it "returns it when one of the lists would show it"   # 鍵なしゲスト + 鍵付きキャスト、ゲストの一覧からも落ちるので不可 / 鍵付きゲスト + 鍵なしキャストは可
  it "returns it to the target cast and the author account"
end
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/locked_reviews_spec.rb > /tmp/rspec.log 2>&1`
Expected: FAIL

- [ ] **Step 3: Add the proto fields and generate the stubs**

Task 2 と同じ手順。Expected: review の stub に差分がある。

- [ ] **Step 4: Implement**

- `FilterVisibleReviews#call`: `viewer == page_owner` の早期 return の次で、ページの持ち主の鍵を通れなければ `[]`。`authored` の絞り込みで、対象キャストが `active` なら `reachable` に加えて鍵も通れることを条件にする。
- `FilterVisibleReviews#recent`: 最後の `select` で対象キャストの鍵も条件にする。
- `readable?` は `call` を使うので変えない。
- `ListReviewsByTarget#call`・`ListReviewsByAuthor#call`: `visible?` の次で鍵を通れなければ、ページを読まずに空を返す（`hidden_by_lock: !blocked?`、target は `summary: NO_SUMMARY` も）。他の return には `hidden_by_lock: false`。
- handler: `list_reviews_by_target` と `list_reviews_by_author` で `hidden_by_lock: result[:hidden_by_lock]` を渡す。

- [ ] **Step 5: Run the tests and confirm that they pass**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/review spec/slices/profile/visibility_wiring_spec.rb > /tmp/rspec.log 2>&1`
Expected: PASS（既存の「ブロックしても平均は同じ」も鍵なしなら変わらない）

- [ ] **Step 6: Commit**

```bash
git add proto/dystopia/review dystopia/monolith/stubs/review dystopia/frontend/src/stub/review dystopia/monolith/slices/review dystopia/monolith/spec/slices/review
git commit -s -m "feat(dystopia): hide reviews and ratings of a locked cast or guest from viewers who do not follow"
```

## Task 4: Masked authors

**Files:**
- Modify: `proto/dystopia/review/v1/service.proto`（`Review` に `bool author_hidden = 20;`）と生成した review の stub
- Modify: `dystopia/monolith/slices/review/use_cases/present_reviews.rb`、`page_reviews.rb`、`get_review.rb`、`list_reviews_by_target.rb`、`list_reviews_by_author.rb`、`list_recent_reviews.rb`
- Modify: `dystopia/monolith/slices/review/grpc/review_handler.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/locked_reviews_spec.rb`、`dystopia/monolith/spec/slices/review/grpc/` の既存 handler spec（なければ新規）

**Interfaces:**
- Consumes: `use_cases.list_lock_passable_profile_ids`
- Produces:
  - `PresentReviews#call(reviews:, viewer_account_id:, viewer_profile_id: nil)`、結果に `author_hidden:`
  - `PageReviews#call(..., viewer_profile_id: nil)`
  - 既定値を nil にするのは、作成・更新・`ListMyReviews` がすべて自分のクチコミ（`is_mine`）で伏せる対象にならないため。渡し忘れは伏せる側に倒れる。

- [ ] **Step 1: Write the failing test**

```ruby
describe "the author of a review by a locked guest on an unlocked cast" do
  # 伏せるとき: author nil, author_profile_id "", author_hidden true、rating と events はそのまま
  it "is masked for a viewer who cannot pass the guest's lock, in the cast list, recent reviews and a single review"
  it "is masked for a pending follower"
  it "is shown to a follower of the guest"
  it "is shown to the target cast"
  it "is shown to the author account, on another profile of the same account too" # is_mine
end

it "reports a disabled author as missing, not masked, even when locked" # author nil, author_hidden false, author_profile_id は今のまま
it "does not mask the author of an unlocked guest"
it "keeps the masked id out of the proto" # handler: author_profile_id == "" かつ author が未設定
```

- [ ] **Step 2: Run the test and confirm that it fails**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/review > /tmp/rspec.log 2>&1`
Expected: FAIL

- [ ] **Step 3: Add the proto field and generate the stubs**

Task 2 と同じ手順。

- [ ] **Step 4: Implement**

- `PresentReviews#present`: 伏せる条件は、`summaries[author]` があって `is_private`、かつ `is_mine` でない、かつ閲覧者が対象キャスト本人でない、かつ鍵を通れない。
- 判定用の `list_lock_passable_profile_ids` は、`call` の中で書き手の id をまとめて 1 回だけ呼ぶ。
- `PageReviews` は `viewer_profile_id` を `present_reviews` に渡し、target・author・recent の use case と `GetReview` から渡す。
- handler: `review_to_proto` に `author_hidden: review[:author_hidden]`。

- [ ] **Step 5: Run the tests and confirm that they pass**

Run: `HANAMI_ENV=test bundle exec rspec spec/slices/review spec/slices/profile/visibility_wiring_spec.rb > /tmp/rspec.log 2>&1`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add proto/dystopia/review dystopia/monolith/stubs/review dystopia/frontend/src/stub/review dystopia/monolith/slices/review dystopia/monolith/spec/slices/review
git commit -s -m "feat(dystopia): mask the name of a locked guest on reviews"
```

## Task 5: Screens

**Files:**
- Create: `dystopia/frontend/src/components/ui/locked-notice.tsx`
- Modify: `dystopia/frontend/src/components/ui/profile-name.tsx`（`export const HIDDEN_GUEST = "（非公開のゲスト）";`）
- Modify: `dystopia/frontend/src/app/api/schedule/list/route.ts`、`dystopia/frontend/src/app/api/review/by-target/route.ts`、`by-author/route.ts`
- Modify: `dystopia/frontend/src/modules/schedule/hooks/useSchedules.ts`、`components/ScheduleTab.tsx`
- Modify: `dystopia/frontend/src/modules/review/types.ts`、`lib/mappers.ts`、`hooks/useCastReviews.ts`、`hooks/useAuthorReviews.ts`
- Modify: `dystopia/frontend/src/modules/review/components/CastReviewsTab.tsx`、`AuthorReviewsTab.tsx`、`ReviewCard.tsx`、`ReviewDetailSheet.tsx`
- Modify: `dystopia/frontend/src/modules/profile/components/EditProfileSheet.tsx:268`
- Test: 同じ場所の `*.test.tsx`、`dystopia/frontend/src/app/api/review/routes.test.ts`、`dystopia/frontend/src/modules/review/lib/mappers.test.ts`

**Interfaces:**
- Consumes: proto の `hiddenByLock`・`authorHidden`
- Produces:
  - `LockedNotice()`: `フォローすると見られます` を `ReviewList` の空表示と同じクラス（`px-4 py-8 text-center text-sm text-text-secondary`）で出す。
  - `Review.authorHidden: boolean`、`ReviewPage.hiddenByLock?: boolean`
  - `useSchedules` / `useCastReviews` / `useAuthorReviews` の戻り値に `hiddenByLock: boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// ScheduleTab.test.tsx
it("shows the notice instead of the days and the footnote when hidden by lock"); // "フォローすると見られます" あり、"未設定" なし
// CastReviewsTab.test.tsx
it("shows the notice instead of the summary and the list when hidden by lock");   // "list:" なし、"利用の満足度" なし
it("keeps the write button for a guest when hidden by lock");                     // "このキャストのクチコミを書く" あり
// AuthorReviewsTab.test.tsx
it("shows the notice when hidden by lock");
// ReviewCard.test.tsx / ReviewDetailSheet.test.tsx
it("shows （非公開のゲスト） without a profile link when the author is hidden");
it("keeps （無効なゲスト） when the author is missing and not hidden");
// mappers.test.ts
it("maps authorHidden");
// routes.test.ts と schedule の route の test
it("passes hiddenByLock through");
```

- [ ] **Step 2: Run the tests and confirm that they fail**

Run: `pnpm exec vitest run src/modules/schedule src/modules/review src/app/api/review src/app/api/schedule`
Expected: FAIL

- [ ] **Step 3: Implement**

- route: `hiddenByLock: !!res.hiddenByLock` を足す。
- `useCastReviews`・`useAuthorReviews`: `hiddenByLock: !!pages[0]?.hiddenByLock`。`useSchedules`: `!!data?.hiddenByLock`。
- `ScheduleTab`: 隠れているときは見出しと `LockedNotice` だけを出す。
- `CastReviewsTab`: 隠れているときは `ReviewSummaryHeader` と `ReviewList` の代わりに `LockedNotice`。書くボタンと `ComposeToSheet` は変えない。
- `ReviewCard:40`・`ReviewDetailSheet:123`: `missing={review.authorHidden ? HIDDEN_GUEST : MISSING_GUEST}`。
- `EditProfileSheet:268` の文言は次にする（テストに元の文があれば合わせる）。

```text
プロフィールに鍵マークが付き、フォローしていない人から予定とクチコミが見えなくなります。フォローは承認制になります。投稿を見られる人は、投稿ごとの公開範囲で決まります
```

- [ ] **Step 4: Run the tests and confirm that they pass**

Run: `pnpm exec vitest run` と `pnpm exec tsc --noEmit --incremental false`
Expected: 全件 PASS、exit 0

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src
git commit -s -m "feat(dystopia): tell viewers that a lock hides schedules and reviews"
```

## Task 6: Specs and final verification

**Files:**
- Modify: `dystopia/docs/features/profiles.md:69-85`、`follows-and-blocks.md:23-24,146-149`、`reviews.md:37` と閲覧の表と平均、`schedules.md` の見え方の表と冒頭、`search.md` の予定検索の表、`dystopia/docs/data-model.md:68,83`

- [ ] **Step 1: Rewrite the specs**

設計書の Rules の内容で書き直す。1 文 1 行、箇条書きは 1 項目 1 文で補足は下の階層、表のセルの改行は `<br>`。
`posts.md` の「鍵は閲覧可否に関係しない」と、`search.md:22` のプロフィール検索の行は今も正しいので変えない。
`follows-and-blocks.md:146-147` の理由は、公開範囲が届かない情報を鍵が絞る、という設計書の理由に置き換える。
`data-model.md` の `is_private` は `"フォローしていない人から予定とクチコミを隠すか"` にする。

- [ ] **Step 2: Run everything**

Run: `HANAMI_ENV=test bundle exec rspec > /tmp/rspec.log 2>&1`（monolith）、`pnpm exec vitest run` と `pnpm exec tsc --noEmit --incremental false`（frontend）。
Expected: すべて pass。`git diff origin/docs/dystopia-timeless-legal-text --stat -- dystopia/frontend/src/modules/legal` が空。

- [ ] **Step 3: Check the real screens**

`reference_local_e2e_run` のメモの手順で monolith と frontend を起動し、鍵付きキャストとフォローしていないゲストの組み合わせで次を確かめる。
- 予定タブとクチコミタブに案内が出て、クチコミを書くボタンは残る。
- 予定検索に出ない。
- フォローして承認すると内容が見える。
- 鍵付きゲストのクチコミが、鍵なしキャストの一覧で「（非公開のゲスト）」になる。

- [ ] **Step 4: Commit and open the Draft PR**

```bash
git add dystopia/docs
git commit -s -m "docs(dystopia): describe what a locked profile hides"
git push -u origin HEAD
gh pr create --draft --base docs/dystopia-timeless-legal-text --title "feat(dystopia): hide schedules and reviews of a locked profile from viewers who do not follow"
```

PR 本文は `panicboat/.github` のテンプレートに従い、`Closes #1809` を先頭に書く。
`### Documents` は `ドキュメント` だけにチェックする。
