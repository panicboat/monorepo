# Dystopia Keep Reviews After A Party Leaves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロフィールの削除・purge でクチコミを消さず、当事者が有効でなくなっても役割つきの伏せた名前で見せ続ける。

**Architecture:** monolith の `review` slice からプロフィール purge を外し、`FilterVisibleReviews` の可視判定を「両当事者が有効」から、一覧ごとの page owner と対象の有効性に基づく判定へ作り直す。frontend は `ProfileName` に役割つきの代替文言を渡せるようにし、規約・プライバシーポリシー・削除確認文・docs を合わせる。

**Tech Stack:** Ruby 3.4 / Hanami 2 / ROM-SQL / RSpec（`dystopia/monolith`）、Next.js / React / vitest（`dystopia/frontend`）

**Spec:** `docs/superpowers/specs/2026-10-24-dystopia-keep-reviews-design.md`

## Global Constraints

- 伏せた名前の文言: クチコミの書き手・カルテの対象は `（無効なゲスト）`、クチコミの対象・カルテの作者は `（無効なキャスト）`、それ以外の画面は `（無効なユーザー）`（全角括弧）
- 別プロフィールで書いたときの表示: クチコミは `（無効なゲスト）として記録`、カルテは `（無効なキャスト）として記録`
- 有効でない当事者には、表示名・ユーザー名・アバター・プロフィールへのリンク・`@...` の併記を出さない。アバターの頭文字は `?`
- URL で直接開くクチコミは、閲覧者が見られる一覧（キャストのクチコミ一覧、ゲストの「書いたクチコミ」一覧、最近のクチコミ）のどれかに出るものに限る
- migration は作らない
- monolith の検証は `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec`（出力はファイルへ redirect して読む）。frontend は `cd dystopia/frontend && pnpm vitest run` と `pnpm exec tsc --noEmit --incremental false`
- コードコメントは英語 1 行、タスクや修正への言及なし。commit は `git commit -s`、`Co-Authored-By` は付けない
- 完了報告の前に、自分の diff に追加したコメントを読み直し、上の基準に合わないものを消す

## Review Focus

- 退会中（purge 前）の書き手: ブロックの行が残っているので、そのゲストとブロック関係にある閲覧者の一覧からは今どおり外れる → Task 2 のテストで固定
- 対象キャストが退会中のクチコミを、他人がゲストの「書いたクチコミ」一覧から URL で開く → 開ける（Task 2）
- 対象キャストが有効で鍵付き・未フォローのクチコミを、ゲストのページ経由の URL で開く → 開けない（Task 2）
- 作者アカウントが、対象キャストが削除済みのクチコミを編集・削除する → できる（Task 2）
- 投稿・DM などカルテ／クチコミ以外で相手がいないときの表示が `（無効なユーザー）` になる → Task 3 の `profile-name` テスト

---

### Task 1: Stop deleting reviews when a profile is purged

**Files:**
- Delete: `dystopia/monolith/slices/review/use_cases/purge_profile.rb`
- Delete: `dystopia/monolith/spec/slices/review/use_cases/purge_profile_spec.rb`
- Modify: `dystopia/monolith/slices/review/repositories/review_repository.rb`（`delete_by_profile` を削除）
- Modify: `dystopia/monolith/slices/profile/use_cases/purge_profile.rb:35`（`::Review::Slice["use_cases.purge_profile"]` を外す）
- Test: `dystopia/monolith/spec/slices/profile/use_cases/purge_profile_spec.rb`, `dystopia/monolith/spec/slices/review/repositories/review_repository_spec.rb`

**Interfaces:**
- Produces: `Review::UseCases::PurgeProfile` と `ReviewRepository#delete_by_profile` は存在しない

- [ ] **Step 1: テストを書き換える**
  - `purge_profile_spec.rb` の "resolves a purge for every slice that stores rows per profile" から `Review::UseCases::PurgeProfile` を外す
  - 同じファイルに追加: `it "keeps the reviews a purged profile wrote or received"` — ゲスト A がキャスト B に書いたクチコミ（出来事 1 件）を作り、`Profile::Slice["use_cases.purge_profile"].call(profile_id: A)` と `call(profile_id: B)` の後も `db[:review__reviews].count == 1` かつ `db[:review__events].count == 1`
  - `review_repository_spec.rb` の "deletes the reviews a profile wrote or received" を削除
  - `review/use_cases/purge_profile_spec.rb` を削除
- [ ] **Step 2: 失敗を確認** — `HANAMI_ENV=test bundle exec rspec spec/slices/profile/use_cases/purge_profile_spec.rb` で 2 件 FAIL
- [ ] **Step 3: 実装** — 上の Files のとおり削除・外す。`grep -rn "delete_by_profile\|Review::UseCases::PurgeProfile\|review.*purge_profile" slices spec` が review 由来で 0 件
- [ ] **Step 4: 通過を確認** — monolith の全 rspec が 0 failures
- [ ] **Step 5: Commit** — `feat(dystopia/monolith): keep reviews when a profile is purged`

### Task 2: Rebuild review visibility around the page owner and the target

**Files:**
- Modify: `dystopia/monolith/slices/review/use_cases/filter_visible_reviews.rb`
- Modify: `dystopia/monolith/slices/review/use_cases/get_review.rb`
- Modify: `dystopia/monolith/slices/review/use_cases/load_own_review.rb`
- Modify: `dystopia/monolith/slices/review/use_cases/list_my_reviews.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/list_reviews_spec.rb`, `dystopia/monolith/spec/slices/review/use_cases/review_lifecycle_spec.rb`

**Interfaces:**
- Consumes: Task 1（行が消えないこと）
- Produces（`FilterVisibleReviews`）:
  - `call(viewer_profile_id:, page_owner_profile_id:, reviews:) -> Array` — page owner の一覧に閲覧者が見られるものを返す。page owner が有効であることは呼び出し側（`ListReviewsByTarget` / `ListReviewsByAuthor`、今どおり）が確かめる
  - `recent(viewer_profile_id:, reviews:) -> Array`
  - `readable?(viewer_profile_id:, review:) -> Boolean` — その他の閲覧者が個別表示を開けるか
  - `own` と `parties_visible?` は削除

判定（spec の Visibility の表をそのまま実装する）:

| メソッド | 条件 |
|---|---|
| `call`（閲覧者 = page owner） | すべて返す |
| `call`（その他） | page owner に到達できる。相手側の当事者と双方向ブロックがない。page owner が書き手のときは、対象が有効なら対象に到達できること、対象が有効でなければ条件なし。page owner が対象のときは書き手の状態を問わない |
| `recent` | 対象が有効で到達できる。書き手・対象のどちらとも双方向ブロックがない |
| `readable?` | 対象が有効で `call(page_owner = 対象)` に残る、または書き手が有効で `call(page_owner = 書き手)` に残る |

「有効」は `Profile::Slice["use_cases.list_visible_profile_ids"]`、「到達」は今の `reachable_ids`（`filter_visible_posts`）を使う。

- `GetReview#visible?`: 作者アカウント → true。閲覧者が対象本人 → 対象が有効なら true。その他 → `readable?`
- `LoadOwnReview`: 当事者の有効性の判定を外す（作者アカウントの確認だけ残す）
- `ListMyReviews`: 一覧も件数もフィルタを通さない

- [ ] **Step 1: テストを書く・書き換える**（`list_reviews_spec.rb`）
  - 既存 "leaves out a review about a disabled cast" → `it "shows a review about a disabled cast on the guest's page"`: `expect(by_author(viewer_account: viewer_account, viewer: viewer)).to include(about_disabled[:id])`
  - 既存 "shows the author every review except the one about a disabled cast" → `it "shows the author every review"`: `eq([about_disabled[:id], about_blocked[:id], about_private[:id], plain[:id]])`
  - 既存 "leaves a review about a disabled cast out of the viewer's own counts as well as the list" → `it "lists and counts a review about a disabled cast among the viewer's own"`: `result[:reviews].length == 2`、`counts == { total: 2, unrated: 1 }`
  - 既存 "counts neither a rated nor an unrated review about a cast that is no longer visible" → `it "counts reviews about casts that are no longer visible"`: `counts == { total: 6, unrated: 3 }`
  - 追加 `it "keeps the reviews and the summary of a cast after the author is disabled, deactivated or purged"`: 3 人のゲストがそれぞれ評価 4・2・3 で書き、1 人目の profile に `disabled_at`、2 人目の account に `deactivated_at`、3 人目は `Profile::Slice["use_cases.purge_profile"].call(profile_id:)` → 別のゲスト閲覧者の `by_target` で 3 件、`summary == { average_rating: 3.0, rater_count: 3, review_count: 3 }`
  - 追加 `it "still hides a deactivated author's review from a viewer the author blocked"`: 書き手の account に `deactivated_at`、書き手が閲覧者をブロック → `by_target` の閲覧者の一覧は空
  - 追加 `it "shows a review about a purged cast on the guest's page"`: 対象キャストを `purge_profile` → 別の閲覧者の `by_author` に含まれる
  - 追加 `it "leaves a review whose cast is disabled out of recent reviews even when the author is active"` と `it "keeps a review whose author is disabled in recent reviews"`
- [ ] **Step 2: テストを書き換える**（`review_lifecycle_spec.rb`）
  - 既存 "reads a review whose cast is disabled as not found" → `it "reads a review whose cast is disabled through the guest's page and lets the author rate it"`: 別ゲストの `get_review` が成功し、作者の `update_review_rating(rating: 4)` が成功する
  - 追加 `it "reads a review of a private cast as not found through the guest's page too"`: 鍵付きキャストへのクチコミを、未フォローの別ゲストが `get_review` → `invalid("Review not found")`（書き手は有効で公開）
  - 追加 `it "lets the author delete a review whose cast was purged"`: 対象キャストを purge → 作者の `delete_review` が成功し、行が消える
  - 追加 `it "reads a review whose author is disabled for another viewer"`: 書き手に `disabled_at` → 別ゲストの `get_review` が成功し、`[:author]` が `nil`
- [ ] **Step 3: 失敗を確認** — 2 ファイルの rspec で上の新規・書き換えたテストが FAIL
- [ ] **Step 4: 実装** — 上の Interfaces と判定表のとおり
- [ ] **Step 5: 通過を確認** — monolith の全 rspec が 0 failures（並びに依存する spec は 2 回流して確認）
- [ ] **Step 6: Commit** — `feat(dystopia/monolith): keep showing reviews when a party is no longer active`

### Task 3: Name a missing party by role in the UI

**Files:**
- Modify: `dystopia/frontend/src/components/ui/profile-name.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewCard.tsx`, `ReviewDetailSheet.tsx`, `ReviewEventForm.tsx`
- Modify: `dystopia/frontend/src/modules/karte/components/KarteCard.tsx`, `KarteDetailSheet.tsx`, `KarteEventForm.tsx`
- Test: `dystopia/frontend/src/components/ui/profile-name.test.tsx`, `modules/review/components/ReviewCard.test.tsx`, `ReviewEventForm.test.tsx`, `modules/karte/components/KarteCard.test.tsx`, `KarteEventForm.test.tsx`

**Interfaces:**
- Produces（`components/ui/profile-name.tsx`）:
  - `export const MISSING_USER = "（無効なユーザー）"`, `export const MISSING_CAST = "（無効なキャスト）"`, `export const MISSING_GUEST = "（無効なゲスト）"`
  - `profileDisplayName(profile: ProfileSummaryView | null, missing: string = MISSING_USER): string`
  - `profileInitial(profile: ProfileSummaryView | null, missing?: string): string` — `profile` が `null` なら `"?"`、それ以外は今の `name.replace("@", "").slice(0, 1) || "?"`
  - `ProfileName` に `missing?: string` prop（既定 `MISSING_USER`）

- [ ] **Step 1: テストを書く・書き換える**
  - `profile-name.test.tsx`: `profileDisplayName(null)` と表示名・ユーザー名が空の要約が `（無効なユーザー）`。`profileDisplayName(null, MISSING_CAST)` が `（無効なキャスト）`。`profileInitial(null)` が `?`
  - `ReviewCard.test.tsx`: "削除したプロフィールで記録" → `（無効なゲスト）として記録`。"leaves the author unlinked..." の期待文言 → `（無効なゲスト）`。追加: `target: null` のとき `（無効なキャスト）` が出て、`@` の併記とキャストのプロフィールへのリンクが出ない。`author: null` のときアバターの頭文字が `?`
  - `KarteCard.test.tsx`: 同様に作者 `null` → `（無効なキャスト）` / `（無効なキャスト）として記録`、対象 `null` → `（無効なゲスト）`
  - `ReviewEventForm.test.tsx`: `削除したプロフィール` → `（無効なキャスト）`。`KarteEventForm.test.tsx`: → `（無効なゲスト）`
- [ ] **Step 2: 失敗を確認** — `pnpm vitest run src/components/ui/profile-name.test.tsx src/modules/review src/modules/karte` で FAIL
- [ ] **Step 3: 実装** — Interfaces のとおり。各カードの頭文字は `profileInitial` に置き換え、クチコミでは書き手に `MISSING_GUEST`・対象に `MISSING_CAST`、カルテでは作者に `MISSING_CAST`・対象に `MISSING_GUEST` を渡す。`KarteDetailSheet` と `ReviewDetailSheet` の `ProfileName` にも同じ役割の文言を渡す
- [ ] **Step 4: 通過を確認** — `pnpm vitest run` 全件 PASS、`pnpm exec tsc --noEmit --incremental false` exit 0、`grep -rn "削除したプロフィール" src` が 0 件
- [ ] **Step 5: Commit** — `feat(dystopia/frontend): name a missing party by its role`

### Task 4: Align the terms, the privacy policy and the delete confirmation

**Files:**
- Modify: `dystopia/frontend/src/modules/legal/content/terms.ts`, `privacy.ts`
- Modify: `dystopia/frontend/src/modules/profile/components/ProfileManager.tsx:190`
- Test: `dystopia/frontend/src/modules/legal/content/terms.test.ts`, `privacy.test.ts`, `references.test.ts`、`ProfileManager` のテスト（文言を見ていれば）

文言（このとおりに置き換える）:

- 利用規約 第6条の複数プロフィールの段落の最後の文 → 「プロフィールを削除しても、そのプロフィールで書いたクチコミと、そのプロフィールについて書かれたクチコミは残ります。この場合、削除したプロフィールの表示名、ユーザー名、アバターなどのプロフィールの情報は、表示されなくなります。」
- 利用規約 第11条の表示の段落（「クチコミの内容と、書いたゲストの…表示されます。」）の後ろに同じ段落内で追記（項番号を変えないため段落は増やさない）→ 「書いたゲストまたは対象のキャストが退会し、またはプロフィールを削除しても、クチコミは残ります。この場合、その利用者の表示名、ユーザー名、アバターなどのプロフィールの情報は表示されず、対象のキャストが表示されないクチコミは、書いたゲストのプロフィールを見ることができる利用者に表示されます。」
- 利用規約 第18条 第2項と第4項の「第5項と第6項に定めるもの」→「第5項から第7項までに定めるもの」
- 利用規約 第18条 第7項 → 「クチコミは、書いたゲストと対象のキャストのどちらが退会した場合も残ります。この場合、退会した利用者の表示名、ユーザー名、アバターなどのプロフィールの情報は、表示されなくなります。退会したゲストが書いたクチコミの評価は、対象のキャストの評価の集計（評価の平均、評価した人数および評価済みのクチコミの件数）に含まれます。」
- プライバシーポリシー 退会の段落の「次の2つの段落に定めるカルテと DM」（2 か所）→「次の3つの段落に定めるカルテ、DM およびクチコミ」
- プライバシーポリシー クチコミの段落 → 「クチコミは、書いたゲストと対象のキャストのどちらが退会し、またはプロフィールを削除した場合も残ります。この場合、退会した利用者または削除されたプロフィールの表示名、ユーザー名、アバターなどのプロフィールの情報は、表示されなくなります。書いたゲストが退会し、またはプロフィールを削除しても、そのクチコミの評価は、対象のキャストの評価の集計（評価の平均、評価した人数および評価済みのクチコミの件数）に含まれます（利用規約第6条第4項および第18条第7項）。」
- プライバシーポリシー 退会後の集計の段落: 箇条「キャストの評価の集計（…）」を外し、「（利用規約第18条第2項および第7項）」→「（利用規約第18条第2項）」
- `ProfileManager.tsx` の削除確認文 → 「このプロフィールの投稿・コメント・フォローが削除され、元に戻せません。相手に届いたメッセージは、送り主が表示されない状態で相手の側に残ります。カルテとクチコミの記録も残ります。」

- [ ] **Step 1: テストを書き換える** — `references.test.ts` の期待ラベルを `"利用規約 第18条: 第5項から第7項"`、`"プライバシーポリシー 第9節: 利用規約第18条第2項"` に。`terms.test.ts` / `privacy.test.ts` / ProfileManager のテストで旧文言を見ている箇所を新しい文言に
- [ ] **Step 2: 失敗を確認** — `pnpm vitest run src/modules/legal src/modules/profile` で FAIL
- [ ] **Step 3: 実装** — 上の文言どおりに置き換える
- [ ] **Step 4: 通過を確認** — `pnpm vitest run` 全件 PASS（`references.test.ts` の「すべての参照が実在する項を指す」を含む）、`grep -n "削除の対象になります" src/modules/legal/content/*.ts` にクチコミの文が残っていない
- [ ] **Step 5: Commit** — `docs(dystopia/frontend): state that reviews stay after a party leaves`

### Task 5: Update the feature docs

**Files:**
- Modify: `dystopia/docs/features/reviews.md`, `profiles.md`, `karte.md`, `account.md`

- [ ] **Step 1: 書き換える**
  - `reviews.md`: 閲覧の冒頭文と表を spec の Visibility の表に、評価と平均の「書き手プロフィールが削除されると平均から消える」を「書き手の状態にかかわらず平均に含まれる」に、編集の「両当事者が有効であることが必要」を削除、Lifecycle の削除・purge の 3 行を「プロフィールの削除・purge でクチコミは消えない。有効でない当事者は役割つきの伏せた名前で表示される」に、Interactions のプロフィール・アカウントの行も合わせる。「（無効なゲスト）」「（無効なキャスト）」の文言を書く
  - `profiles.md`: 削除で消えるものからクチコミを外し、「カルテは削除の対象に含まれず、残る」をクチコミも含む形に。Interactions のクチコミの行
  - `karte.md`: 「削除したプロフィールで記録」→ 作者がないときは「（無効なキャスト）」、対象がないときは「（無効なゲスト）」と表示
  - `account.md`: purge で消える範囲の説明がクチコミに触れていれば合わせる
- [ ] **Step 2: 確認** — `grep -rn "削除したプロフィールで記録\|クチコミが.*消える\|平均から消える" dystopia/docs` が 0 件
- [ ] **Step 3: Commit** — `docs(dystopia): describe reviews that stay after a party leaves`
