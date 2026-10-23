# Account Purge Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 退会から 30 日が過ぎたアカウントの purge を本番で毎日実行し、purge とプロフィール削除で、そのプロフィールがアップロードした画像・動画とサムネイルの S3 オブジェクトも消す（issue #1673）。

**Architecture:** `Media::UseCases::PurgeProfile` は、行を消す前に、そのプロフィールがアップロードした全ファイルの `media_key` と `thumbnail_key` を `Storage.delete` で消す。`PurgeProfile` はアカウントの purge とプロフィール削除の両方から呼ばれるので、どちらでもファイルが消える（ユーザー決定）。S3 を先に消し、行を後に消す。`Profile::UseCases::PurgeProfile` は全 slice を 1 つの transaction で消すので、途中で失敗すると行は戻り、S3 だけが消えた状態になる。そのとき行は消えていないので、次の実行で同じファイルをもう一度消して（S3 の DeleteObject は存在しないキーでも成功する）最後まで進む。行を消した後（commit の後）に S3 を消す案は、S3 の失敗でファイルが参照のないまま残り、やり直しの手がかりも消えるので採らない。本番では、task 関数（`dystopia/lambda/image/task.mjs`）が `{"task":"purge_deactivated"}` を受けて `bundle exec rake account:purge_deactivated` を実行する。EventBridge Scheduler が毎日 04:00（Asia/Tokyo）に task 関数を呼ぶ。失敗は task 関数の CloudWatch Logs（`{"task":"purge_deactivated","exitCode":1}`）に残り、翌日の実行でやり直す。

**Tech Stack:** Ruby 3.4 / Hanami 2 / RSpec / Node.js（node:test）/ OpenTofu 1.12.6 / hashicorp/aws 6.69.1 / TypeScript（frontend の文面）

**Spec:** issue #1673（https://github.com/panicboat/monorepo/issues/1673）

## Global Constraints

- rspec は `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > <scratchpad>/rspec.log 2>&1` を実行し、ログファイルを読む
- task 関数が受ける task 名は `purge_deactivated`、実行するコマンドは `["bundle", ["exec", "rake", "account:purge_deactivated"]]`
- スケジュールは `cron(0 4 * * ? *)`、`schedule_expression_timezone = "Asia/Tokyo"`、`retry_policy` の `maximum_retry_attempts = 0`（purge は冪等で、失敗しても翌日やり直す。既定の再試行は 24 時間で最大 185 回）
- EKS 向けの `dystopia/infrastructure` は変更しない
- コードコメントは英語で 1 行。タスクや issue への言及を書かない
- 利用規約・プライバシーポリシーの本文は日本語。既存の文体（「です・ます」、条項の参照の書き方）に合わせる
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- サムネイルのないファイル（`thumbnail_key` が nil）: 本体だけ消し、`Storage.delete(key: nil)` を呼ばない → Task 1 のテスト
- `Storage.delete` が例外を出した: 行を消さずに例外が上がる → Task 1 のテスト
- 他のプロフィールがアップロードしたファイル: 消さない → Task 1 のテスト
- purge が一部のアカウントで失敗した（rake が abort で exit 1）: task 関数は exitCode 1 を返し、HTTP 500 になる → Task 2 のテスト（既存の失敗時のテストと同じ形）
- 未知の task 名: 今と同じく `unknown task` → 既存のテストのまま

---

### Task 1: Delete the uploaded files when a profile is purged

**Files:**
- Modify: `dystopia/monolith/slices/media/repositories/media_repository.rb`
- Modify: `dystopia/monolith/slices/media/use_cases/purge_profile.rb`
- Modify: `dystopia/monolith/spec/slices/media/use_cases/purge_profile_spec.rb`
- Test: `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb`（あれば追記、なければ作成）

**Interfaces:**
- Produces: `MediaRepository#keys_by_uploader(profile_id) -> Array<String>`（そのプロフィールの全ファイルの `media_key` と `thumbnail_key` のうち nil でないもの）。`Media::UseCases::PurgeProfile#call(profile_id:)` の signature は変えない

- [ ] **Step 1: Write the failing specs**

`purge_profile_spec.rb` は repo の double ではなく DB を使う（`type: :database`）形に書き換える。`media__files` に行を直接入れる（`Hanami.app["db.gateway"].connection[:media__files].insert(...)`、必須列はマイグレーション `grep -rn "media__files\|:files" dystopia/monolith/config/db/migrate` で確かめる）。`Storage` は `allow(Storage).to receive(:delete)` で受ける。

- `deletes the files and thumbnails the profile uploaded, then the rows`: profile-1 のファイル 2 件（片方だけ `thumbnail_key` あり）と profile-2 のファイル 1 件 → `Storage.delete` が profile-1 の 3 つのキーだけで呼ばれる、profile-1 の行は 0 件、profile-2 の行は 1 件残る
- `keeps the rows when a file cannot be deleted`: `Storage.delete` が `raise "s3 down"` → 例外が上がり、profile-1 の行は 2 件のまま

`media_repository_spec.rb` に `keys_by_uploader` のテストを 1 件: 上と同じデータで profile-1 の 3 キーを返す（順不同、`match_array`）。

- [ ] **Step 2: Run the specs to verify they fail**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/media`
Expected: 新しいテストが FAIL（`keys_by_uploader` が未定義、`Storage.delete` が呼ばれない）

- [ ] **Step 3: Implement `keys_by_uploader` and call `Storage.delete` for each key in `PurgeProfile#call` before `repo.delete_by_uploader`**

`PurgeProfile` に「S3 を行より先に消す理由」を 1 行コメントで書く（行が残れば次の実行でやり直せる）。

- [ ] **Step 4: Run the media, profile and identity specs**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/media spec/slices/profile spec/slices/identity`
Expected: 全件 PASS

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/media dystopia/monolith/spec/slices/media
git commit -s -m "fix(dystopia/monolith): delete the uploaded files when a profile is purged"
```

### Task 2: Run the account purge every day in production

**Files:**
- Modify: `dystopia/lambda/image/task.mjs`（`commandFor`）
- Modify: `dystopia/lambda/image/tests/task.test.mjs`
- Modify: `dystopia/lambda/aws/modules/lambda.tf`（スケジュールと、その IAM role を足す。ファイルが長くなるなら `dystopia/lambda/aws/modules/schedule.tf` を作る）
- Modify: `dystopia/lambda/aws/modules/tests/hosting.tftest.hcl`

**Interfaces:**
- Consumes: なし（Task 1 とは独立）
- Produces: `aws_scheduler_schedule.purge_deactivated`（target は `aws_lambda_function.task.arn`、input は `jsonencode({ task = "purge_deactivated" })`）と、`scheduler.amazonaws.com` が引き受ける IAM role（`lambda:InvokeFunction` を `aws_lambda_function.task.arn` に限る）

- [ ] **Step 1: Write the failing node test**

`task.test.mjs` の既存の migrate のテストと同じ形で:
- `runs the account purge`: `POST {"task":"purge_deactivated"}` → status 200、`json.task == "purge_deactivated"`、`json.exitCode == 0`、output に `[exec]`・`[rake]`・`[account:purge_deactivated]` が順に出る（bundle の stub が引数を `[%s]` で出す）

- [ ] **Step 2: Run it to verify it fails**

Run（`dystopia/lambda/image` で）: `node --test tests/task.test.mjs`
Expected: 新しいテストが FAIL（`unknown task`、status 500）

- [ ] **Step 3: Add `purge_deactivated` to `commandFor`**

- [ ] **Step 4: Run the node test to verify it passes**

Run: `node --test tests/task.test.mjs`
Expected: 全件 pass

- [ ] **Step 5: Add the schedule and its role, and a tofu test**

`hosting.tftest.hcl` に、既存の run block の書き方で assert を足す: スケジュールの `schedule_expression == "cron(0 4 * * ? *)"`、`schedule_expression_timezone == "Asia/Tokyo"`、`target[0].input == jsonencode({ task = "purge_deactivated" })`、`target[0].retry_policy[0].maximum_retry_attempts == 0`、`flexible_time_window[0].mode == "OFF"`。

- [ ] **Step 6: Validate**

Run（`dystopia/lambda/aws/modules` で）: `tofu fmt -check && tofu init -backend=false -input=false > /dev/null && tofu test`
Expected: fmt の差分なし、`tofu test` が全件 pass

- [ ] **Step 7: Commit**

```bash
git add dystopia/lambda/image dystopia/lambda/aws/modules
git commit -s -m "feat(dystopia/lambda): run the account purge every day"
```

### Task 3: Update the privacy policy on file deletion

**Files:**
- Modify: `dystopia/frontend/src/modules/legal/content/privacy.ts`（「保存期間と削除」の 2 段落）
- Test: `dystopia/frontend/src/modules/legal/content/*.test.ts`（文面のテストがあれば、それに合わせて直す）

**Interfaces:**
- Consumes: Task 1 の挙動（プロフィール削除と退会したアカウントの削除で、そのプロフィールがアップロードしたファイルが消える）

- [ ] **Step 1: Replace the file paragraph**

「アップロードされた画像と動画のファイル（アバターとカバー画像を含みます）は、そのファイルを使った投稿やプロフィールを削除した後も残る場合があります。」を次の文に置き換える:

「アップロードされた画像と動画のファイル（アバターとカバー画像を含みます）は、そのファイルを使った投稿を削除し、またはアバターやカバー画像を変更した後も残る場合があります。プロフィールを削除したとき、および退会したアカウントの情報を削除するときは、そのプロフィールでアップロードしたファイルも削除します。」

- [ ] **Step 2: Remove the remaining-files sentence from the deactivation paragraph**

退会の段落から「前の段落の画像と動画のファイルも、残る場合があります。」の 1 文だけを削除する。他の文は変えない。

- [ ] **Step 3: Verify**

Run（`dystopia/frontend` で）: `pnpm exec tsc --noEmit --incremental false` と `pnpm exec vitest run src/modules/legal`
Expected: 型エラーなし、legal のテストが全件 pass（テストがなければ vitest は "No test files found" で、それを報告する）

- [ ] **Step 4: Commit**

```bash
git add dystopia/frontend/src/modules/legal
git commit -s -m "docs(dystopia/frontend): state that profile and account deletion remove uploaded files"
```
