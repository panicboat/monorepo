# Dystopia E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dystopia の閲覧範囲と権限の線引きを、CI の中で立ち上げた monolith・frontend・DB に対してブラウザから確かめる e2e テストを、GitHub Actions の定期実行と手動実行で回す。

**Architecture:** `dystopia/e2e/` に e2e-inc/e2e のテストパッケージを置く。`dystopia/e2e/bin/stack` が使い捨ての DB・monolith・frontend をローカルと CI の両方で同じ手順で起動する。テストの操作は `agent.act`（Bedrock の Claude）、確認は locator と `expect` で書き、`agent.act` の記録は GitHub Actions の cache に置いて run をまたいで再生する。

**Tech Stack:** `e2e@^0.23.0`、`@e2e-dev/web@^0.15.5`、`ai@^7`、`@ai-sdk/amazon-bedrock@^5`、pnpm 12.18.0、Node 26、Ruby 4.0.3、PostgreSQL 18.6、OpenTofu（platform リポジトリ）

**Spec:** `docs/superpowers/specs/2026-11-12-dystopia-e2e-design.md`（Issue #1992）

## Global Constraints

- 追加してよい npm 依存は `e2e`、`@e2e-dev/web`、`ai`、`@ai-sdk/amazon-bedrock` だけ（ユーザー承認済み）。他の依存が要るときは止めてユーザーに確認する。
- テストは `dystopia/docs/features/*.md` の Rules の 1 項目に対応させ、`describe` の名前を `<ファイル名> / <節の見出し>`（例: `posts.md / 閲覧できる範囲`）にする。
- 線引きの判定に `agent.assert` を使わない。確認は locator と `expect` だけで書く。
- 「見えない」の確認は、同じ画面で「見えるはずのもの」が見えたことを先に `expect(...).toBeVisible()` で確かめてから行う（Task 1 の `expectHiddenAfter`）。
- 状態を変えるテストは、テスト内で `createAccount` で作ったアカウントだけの状態を変える。seed アカウントの関係・設定を変えない。
- `agent.act` の指示文に実行ごとに変わる値を直書きしない。`{name}` の形で書き、`params` に入れる（`unique()` で包むのは実行ごとに変わる値だけ）。
- 各 `agent.act` のあとに、その結果を確かめる locator の `expect` を置く（e2e は確認の通った `act` だけを記録する）。
- ログイン・アカウント作成・オンボーディング・初回ツアーを閉じる操作はモデルを呼ばない（locator だけで書く）。
- 画面サイズは `web({ viewport: { width: 390, height: 844 } })` で固定する。
- `projectId` は `dystopia-e2e`。
- モデルは `createAmazonBedrock({ region: 'us-east-1' })('global.anthropic.claude-sonnet-4-6')`。
- ポートは monolith `127.0.0.1:9055`、frontend `3055`、ブラウザで開く URL は `http://localhost:3055`。
- seed アカウントのパスワードは `password`、新規登録の確認コードは `000000`、電話番号は `+81` から始まる形で入力する（偽 Cognito は正規化しない）。
- コード・コミットメッセージ・テスト名は英語。コメントは 1 行で、他のやり方を採らなかった理由だけを書き、タスクや修正への言及を書かない。
- コミットは `git commit -s`。`Co-Authored-By` を付けない。
- GitHub Actions の `uses:` は commit SHA で固定し、末尾にバージョンのコメントを付ける（`ensure-sha-pinned` チェック）。既存の workflow と `panicboat/.github` で使っている SHA を優先して流用する。
- 完了報告の前に、diff で追加したコメントを上の規則と突き合わせ、満たさないものを消す。

## Review Focus

- 偽 Cognito のユーザー表が `next start` の route ごとに分かれ、新規登録の確認で「認証コードが正しくありません」になる。→ Task 1 の `account.md / 新規登録` のテストで固定する。
- 「見えない」の確認が、画面の読み込み前や別の画面で通る。→ Task 1 の `expectHiddenAfter` と、その単体の失敗確認（Step 6）で固定する。
- `agent.act` が意図と違う道で目的を達成する（承認待ちの全件承認、別の相手のブロック）。→ Task 3 の承認のテストで「申請していない seed の承認待ち（saburo → mio）は変わらない」ことを、Task 3 のブロックのテストで「ブロックしていない相手の投稿は見える」ことを確かめる。
- 記録が保存されない（`unconfirmed`）まま CI が毎回モデルを呼ぶ。→ Task 7 の Step 7 で、2 回目の手動実行の summary に `replayed` が出ることを確かめる。
- 前の実行の DB が残ってテストが通ったり落ちたりする。→ Task 1 の `bin/stack up` は毎回 DB を drop してから作る。Step 8 で 2 回続けて `up` → テストが通ることを確かめる。

---

### Task 0: Bedrock-only role for the e2e workflow (platform repository)

**Files (repository `panicboat/platform`, 新しいブランチ `feat/bedrock-invoke-role` を origin/main から `.worktrees/feat-bedrock-invoke-role` に作る):**
- Modify: `aws/github-oidc-auth/modules/claude_code.tf`
- Modify: `aws/github-oidc-auth/modules/variables.tf`
- Modify: `aws/github-oidc-auth/modules/outputs.tf`
- Modify: `aws/github-oidc-auth/master/env.hcl`
- Modify: `aws/github-oidc-auth/master/terragrunt.hcl`
- Test: `aws/github-oidc-auth/modules/tests/`（既存の `.tftest.hcl` の形に合わせて追加）

**Interfaces:**
- Produces: IAM ロール `github-oidc-auth-master-github-actions-bedrock-invoke-role`（account `559744160976`）。trust は `repo:panicboat/monorepo:environment:dystopia-e2e`。権限は `claude_code_bedrock_models` の global 推論プロファイルへの `bedrock:InvokeModel` と `bedrock:InvokeModelWithResponseStream` だけ。

既存の claude-code ロールに subject を足すと、e2e の job が Claude の OAuth token の secret も読めてしまうため、Bedrock だけのロールを分ける。

- [ ] **Step 1: Write the failing test** — `bedrock_invoke_oidc_subjects = ["repo:panicboat/monorepo:environment:dystopia-e2e"]` と `claude_code_bedrock_models = ["anthropic.claude-sonnet-4-6"]` を渡した plan で、`aws_iam_role.bedrock_invoke[0]` の trust の `token.actions.githubusercontent.com:sub` がその subject で、role policy に `secretsmanager:GetSecretValue` が含まれないことを assert する。`bedrock_invoke_oidc_subjects = []` ではロールが作られないことも assert する。
- [ ] **Step 2: Run** `tofu test` in `aws/github-oidc-auth/modules`（既存テストの実行方法に従う）。Expected: FAIL（`bedrock_invoke` が未定義）。
- [ ] **Step 3: Implement** — variable `bedrock_invoke_oidc_subjects`（`list(string)`、default `[]`）、`aws_iam_role.bedrock_invoke` と `aws_iam_role_policy.bedrock_invoke`（`count = length(var.bedrock_invoke_oidc_subjects) > 0 ? 1 : 0`、ロール名 `${var.project_name}-${var.environment}-github-actions-bedrock-invoke-role`）、output `bedrock_invoke_role_arn`。policy は claude-code の最初の 2 statement と同じ locals を参照する。
- [ ] **Step 4: Run** `tofu test`。Expected: PASS。
- [ ] **Step 5: Wire master** — `env.hcl` に `bedrock_invoke_oidc_subjects = ["repo:panicboat/monorepo:environment:dystopia-e2e"]`、`terragrunt.hcl` の inputs に `bedrock_invoke_oidc_subjects = include.env.locals.bedrock_invoke_oidc_subjects` を足す。
- [ ] **Step 6: Commit, push, Draft PR** — `feat(aws/github-oidc-auth): add a Bedrock-only role for the dystopia e2e workflow`。PR 本文は platform のテンプレートに従い、`Refs panicboat/monorepo#1992` を入れる。`deploy` ラベルの terragrunt plan で、master にロール 1 つと policy 1 つが追加されるだけであることを確かめる。
- [ ] **Step 7: Hand off** — merge と apply はユーザーが行う。Task 7 の Step 6 はこの apply のあとに行う。

### Task 1: Package, local stack, and sign-in tests

**Files:**
- Create: `dystopia/e2e/package.json`、`dystopia/e2e/pnpm-workspace.yaml`、`dystopia/e2e/pnpm-lock.yaml`、`dystopia/e2e/tsconfig.json`、`dystopia/e2e/.gitignore`
- Create: `dystopia/e2e/e2e.config.ts`
- Create: `dystopia/e2e/bin/stack`
- Create: `dystopia/e2e/tests/support/seed.ts`、`dystopia/e2e/tests/support/session.ts`、`dystopia/e2e/tests/support/visibility.ts`
- Create: `dystopia/e2e/tests/account.e2e.ts`
- Create: `dystopia/e2e/README.md`

**Interfaces:**
- Produces:
  - `bin/stack up` / `bin/stack down`（bash）。`up` は DB の drop → create → migrate → seed、monolith と frontend の起動、準備完了の確認までを行い、終わると戻る。`down` は `up` が起動したプロセスを止め、DB を drop する。ログと PID は `dystopia/e2e/.e2e/stack/` に書く。
  - `tests/support/seed.ts`: `SEED.accounts.{yuna,mio,rin,taro,jiro,saburo,shiro,goro}`（`{ phone: string; username: string; displayName: string }`）と `SEED.posts`（下の本文の定数）。
  - `tests/support/session.ts`:
    - `signIn(fx: { app: App; screen: Screen }, phone: string): Promise<void>` — `/login` を開き、電話番号とパスワード `password` を入れて「ログイン」を押し、ホームに着いて初回ツアーを閉じるまで。
    - `switchUser(fx, phone): Promise<void>` — `app.clearState()` のあと `signIn`。
    - `createAccount(fx, role: 'cast' | 'guest'): Promise<{ phone: string; username: string; displayName: string }>` — 年齢確認「はい（18歳以上です）」→ 電話番号・パスワード `E2e-Password-1`・ロール・同意 →「SMS を送信」→ `#code` に `000000` →「登録を完了」→ 表示名・ユーザー名 →「完了」→ ホームで初回ツアーを閉じるまで。電話番号は `+8190` に 8 桁、ユーザー名は `e2e_` に英小文字と数字で、どちらも実行ごとに一意。表示名は `E2E <ユーザー名の末尾 6 文字>`。
  - `tests/support/visibility.ts`: `expectHiddenAfter(present: Locator, absent: Locator): Promise<void>` — `present` の `toBeVisible()` のあと `absent` の `toHaveCount(0)`。

`SEED.posts` に入れる本文（`dystopia/monolith/config/db/seeds/post/posts.rb` の固定文字列の先頭部分。`getByText(..., { exact: false })` で使う）:
- `yunaPublic`: `[Yuna/Public/Public] 新しいドレスを買いました`
- `yunaFollowers`: `[Yuna/Public/Private] フォロワー限定！来週のイベント情報`
- `mioPublicTimeLimited`: `[Mio/Private/Public] 今夜23時まで空いています`
- `mioFollowers`: `[Mio/Private/Private] メンバー限定の特別なお知らせ`
- `rinPublic`: `[Rin/Public/Public] カフェでまったり`
- `rinFollowers`: `[Rin/Public/Private] フォロワーさん限定のオフショット`

- [ ] **Step 1: Scaffold the package** — `package.json` は `"name": "dystopia-e2e"`、`"private": true`、`"packageManager": "pnpm@12.18.0"`、`"type": "module"`、scripts `"test": "e2e run"`、`"typecheck": "tsc --noEmit"`。`typescript` は frontend と同じ版を devDependency にする。`.gitignore` は `.e2e/` と `node_modules/`。`pnpm install` で `ERR_PNPM_IGNORED_BUILDS` が出たら `pnpm-workspace.yaml` の `allowBuilds` に `false` で明示する。
- [ ] **Step 2: Write `e2e.config.ts`** — Global Constraints の viewport・`projectId`・モデル、target の `app.url` は `process.env.APP_URL ?? 'http://localhost:3055'`（`command` は書かない）、`reporters: ['list', 'junit']`。`cache` は `process.env.CI` があれば `{ mode: 'read-write' }`、なければ指定しない。
- [ ] **Step 3: Write `bin/stack`** — 手順は spec の Current State と次の値に従う。
  - DB: `HANAMI_ENV=test DATABASE_URL=postgres://postgres:password@localhost:5432/monolith_e2e` で `hanami db drop`（無ければ無視）→ `create` → `migrate` → `seed`。Hanami はこの URL の DB 名に `_test` を付けるので、実体は `monolith_e2e_test`（`psql -l` で確かめる）。
  - monolith: `dystopia/monolith` で `.env` と `.env.test` を export し、`DATABASE_URL=postgres://postgres:password@localhost:5432/monolith_e2e_test`、`GRPC_BIND_ADDRESS=127.0.0.1:9055` を付けて `bundle exec ruby bin/grpc` を background で起動する。
  - frontend: `dystopia/frontend` で `env -u NODE_OPTIONS pnpm install --frozen-lockfile` → `pnpm build` → `COGNITO_ADAPTER=fake MONOLITH_URL=http://127.0.0.1:9055 INSECURE_COOKIES=true pnpm start --port 3055` を background で起動する。
  - 準備完了: `POST http://127.0.0.1:3055/api/identity/sign-in` に `{"phoneNumber":"+819000000101","password":"password"}` を送り、200 が返るまで 2 秒間隔で最大 180 秒待つ。超えたら両方のログの末尾を出して exit 1。
  - `down`: PID ファイルのプロセスを止める（gruf はプロセス名を書き換えるので名前では探さない）→ DB を drop。
- [ ] **Step 4: Write the failing tests in `tests/account.e2e.ts`**

```ts
describe('account.md / ログイン', () => {
  test('a seeded cast signs in and reaches the home feed', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await expect(fx.browser).toHaveURL('/');
    await fx.app.open(`/u/${SEED.accounts.yuna.username}`);
    await expect(fx.screen.getByText(SEED.posts.yunaPublic, { exact: false }).first()).toBeVisible();
  });
  test('a wrong password is rejected with the sign-in error message', async ({ app, screen }) => {
    // fill phone = SEED.accounts.yuna.phone, password = 'wrong-password', press ログイン
    await expect(screen.getByText('電話番号または認証コードが正しくありません')).toBeVisible();
  });
});
describe('account.md / 新規登録', () => {
  test('a new guest signs up with the confirmation code and completes onboarding', async (fx) => {
    const account = await createAccount(fx, 'guest');
    await fx.app.open(`/u/${account.username}`);
    await expect(fx.screen.getByText(account.displayName).first()).toBeVisible();
  });
});
```

- [ ] **Step 5: Run** `bin/stack up && pnpm exec e2e run tests/account.e2e.ts`（`dystopia/e2e` で、Ruby は `rbenv exec` 経由）。Expected: support の実装前なので FAIL。
- [ ] **Step 6: Implement `seed.ts`・`session.ts`・`visibility.ts`** — locator のラベル・ボタン名は `dystopia/frontend/src/app/login/page.tsx`、`signup/page.tsx`、`onboarding/page.tsx`、`modules/onboarding/lib/feature-tour-storage.ts` から取る。初回ツアーは「はじめる」が出たら押す（出ないこともあるので、出るのを短く待ってから判定する）。`expectHiddenAfter` に存在しない `present` を渡すと失敗することを、一時的なテストで確かめてから消す。
- [ ] **Step 7: Run** `pnpm exec e2e run tests/account.e2e.ts`。Expected: 3 tests PASS。`新規登録` が「認証コードが正しくありません」で落ちたら、偽 Cognito のユーザー表が route ごとに分かれている。修正せずに止め、再現手順とログをユーザーに報告する。
- [ ] **Step 8: Run twice** — `bin/stack up && pnpm exec e2e run tests/account.e2e.ts` をもう一度。Expected: PASS（DB が作り直されている）。最後に `bin/stack down` し、`lsof -nP -iTCP:9055 -sTCP:LISTEN` と `lsof -nP -iTCP:3055 -sTCP:LISTEN` が空であること。
- [ ] **Step 9: Write `README.md`** — 前提（PostgreSQL が `localhost:5432` に `postgres`/`password` で居ること、rbenv の Ruby、Bedrock を呼べる AWS の認証情報）、`bin/stack up` → `pnpm test` → `bin/stack down` の手順、記録（`.e2e/cache/`）がローカルでは commit しないものであること、CI の記録は GitHub Actions の cache にあること。
- [ ] **Step 10: Typecheck and commit** — `env -u NODE_OPTIONS pnpm exec tsc --noEmit` が exit 0。`git commit -s -m "feat(dystopia/e2e): add the e2e package with a local stack and sign-in tests"`

### Task 2: Post visibility tests

**Files:**
- Create: `dystopia/e2e/tests/posts.e2e.ts`

**Interfaces:**
- Consumes: `SEED`、`signIn`、`switchUser`、`createAccount`、`expectHiddenAfter`（Task 1）

各テストは対象のプロフィール `/u/<username>` を開いて確かめる。

- [ ] **Step 1: Write the tests**

```ts
describe('posts.md / 閲覧できる範囲', () => {
  test('a non-follower sees 全員 posts but not フォロワーのみ posts', async (fx) => {
    // jiro on /u/yuna
    await expectHiddenAfter(text(SEED.posts.yunaPublic), text(SEED.posts.yunaFollowers));
  });
  test('an approved follower sees フォロワーのみ posts', async (fx) => {
    // taro on /u/yuna
    await expect(text(SEED.posts.yunaFollowers)).toBeVisible();
  });
  test('a pending follower does not see フォロワーのみ posts', async (fx) => {
    // saburo on /u/mio
    await expectHiddenAfter(text(SEED.posts.mioPublicTimeLimited), text(SEED.posts.mioFollowers));
  });
  test('a blocked viewer sees the profile but none of its posts', async (fx) => {
    // taro on /u/rin (rin blocks taro)
    await expectHiddenAfter(fx.screen.getByText(SEED.accounts.rin.displayName).first(), text(SEED.posts.rinPublic));
  });
  test('a viewer blocked by nobody still sees the same profile posts', async (fx) => {
    // jiro on /u/rin
    await expect(text(SEED.posts.rinPublic)).toBeVisible();
  });
});
describe('posts.md / 時間限定投稿（表示期間）', () => {
  test('a post scheduled to start later is visible only to its author', async (fx) => {
    const cast = await createAccount(fx, 'cast');
    const body = unique(`e2e scheduled ${Date.now()}`);
    await fx.agent.act('create a post with the text {body} for everyone, shown from tomorrow at 12:00', { params: { body } });
    // author on /u/<cast.username>: post visible
    // switchUser to jiro, /u/<cast.username>: expectHiddenAfter(displayName, post body)
  });
});
```

  `text(s)` は `fx.screen.getByText(s, { exact: false }).first()` を返すファイル内の関数。`Date.now()` を使う値は `unique()` で包む。
- [ ] **Step 2: Run** `pnpm exec e2e run tests/posts.e2e.ts`（stack は起動済み）。Expected: 全部 PASS。落ちたら、テストの前提（seed の関係、画面の文言）か本当の不具合かを切り分け、本当の不具合なら修正せずにユーザーに報告する。
- [ ] **Step 3: Check the report** — `.e2e/report.json` で時間限定のテストの `agent.act` の `step.cache.write` が `saved` であること。`unconfirmed` なら、act の直後に結果を確かめる `expect` を足す。
- [ ] **Step 4: Commit** — `feat(dystopia/e2e): cover post visibility rules`

### Task 3: Follow and block tests

**Files:**
- Create: `dystopia/e2e/tests/follows-and-blocks.e2e.ts`

**Interfaces:**
- Consumes: Task 1 の support

承認制のテストでは、新しいキャスト C がプロフィールの編集で「フォローを承認制にする」をオンにし、フォロワーのみの投稿を 1 件作るところまでを `agent.act` で行う。

- [ ] **Step 1: Write the tests**

```ts
describe('follows-and-blocks.md / フォロー', () => {
  test('following a profile without approval takes effect immediately', async (fx) => {
    // new guest G: agent.act('follow {username}', { params: { username: SEED.accounts.rin.username } })
    // G on /u/rin: expect(text(SEED.posts.rinFollowers)).toBeVisible()
  });
});
describe('follows-and-blocks.md / 申請と承認', () => {
  test('a request stays pending until approved, and approving it leaves other requests pending', async (fx) => {
    // new guests G and H; new cast C turns approval on and posts {body} for followers only
    // G and H each request to follow C; G on /u/<C>: expectHiddenAfter(C displayName, body)
    // switchUser C: agent.act('approve the follow request from {username}', G)
    // switchUser G: body visible; switchUser H: expectHiddenAfter(C displayName, body)
  });
  test('a rejected request hides posts and can be sent again', async (fx) => {
    // new cast C (approval on, followers-only {body}); new guest G requests; C rejects G
    // G on /u/<C>: expectHiddenAfter(C displayName, body); G requests again; C approves; G sees body
  });
});
describe('follows-and-blocks.md / ブロック', () => {
  test('blocking hides posts and removes the follow, and unblocking shows posts without restoring the follow', async (fx) => {
    // new cast C posts {body} for everyone; new guest G follows C and sees body
    // switchUser C: agent.act('block {username}', G)
    // switchUser G: /u/<C> expectHiddenAfter(C displayName, body); /u/yuna sees SEED.posts.yunaPublic
    // G on /u/<G.username>/following: C displayName count 0 (after a visible heading of the page)
    // switchUser C: agent.act('unblock {username}', G)
    // switchUser G: /u/<C> body visible; /u/<G.username>/following: C displayName count 0
  });
});
```

  1 つの流れを複数の `test` に分けると順番に依存するので、流れごとに 1 つの `test` にまとめる。
- [ ] **Step 2: Run** `pnpm exec e2e run tests/follows-and-blocks.e2e.ts`。Expected: 全部 PASS。
- [ ] **Step 3: Check the report** — 全部の `agent.act` が `saved`。
- [ ] **Step 4: Commit** — `feat(dystopia/e2e): cover follow, approval, and block rules`

### Task 4: Profile lock tests

**Files:**
- Create: `dystopia/e2e/tests/profiles.e2e.ts`

**Interfaces:**
- Consumes: Task 1 の support

鍵で隠れるのは予定とクチコミ。最初の版ではクチコミで確かめる（予定は範囲外）。seed のクチコミには本文がないので、seed の確認ではクチコミのタブに出る書き手の表示名で判定する。

- [ ] **Step 1: Write the tests**

```ts
describe('profiles.md / 鍵とフォローの承認制', () => {
  test('an approved follower sees reviews on a locked profile', async (fx) => {
    // taro on /u/mio, レビューのタブ: expect(text(SEED.accounts.taro.displayName)).toBeVisible()
  });
  test('a non-follower and a pending follower do not see reviews on a locked profile', async (fx) => {
    // jiro, then saburo, on /u/mio レビューのタブ: expectHiddenAfter(mio displayName, taro displayName)
  });
  test('following a locked profile without approval reveals its reviews at once', async (fx) => {
    // new cast C turns the lock on, then turns approval off
    // new guest W writes a review on C with note {note}
    // new guest G on /u/<C>: expectHiddenAfter(C displayName, note)
    // G follows C; G sees note
  });
});
```

  クチコミのタブの開き方は `agent.act` ではなく locator で書く（タブ名は `dystopia/frontend/src/app/u/[username]/page.tsx` から取る）。
- [ ] **Step 2: Run** `pnpm exec e2e run tests/profiles.e2e.ts`。Expected: 全部 PASS、全部の `agent.act` が `saved`。
- [ ] **Step 3: Commit** — `feat(dystopia/e2e): cover profile lock rules`

### Task 5: Karte tests

**Files:**
- Create: `dystopia/e2e/tests/karte.e2e.ts`

**Interfaces:**
- Consumes: Task 1 の support

seed のカルテで本文として確かめられる文字列は、rin → shiro の補足 `到着が30分遅れた` だけ。

- [ ] **Step 1: Write the tests**

```ts
describe('karte.md / Rules', () => {
  test('any cast sees kartes written by other casts', async (fx) => {
    // yuna on /u/shiro カルテのタブ: expect(text('到着が30分遅れた')).toBeVisible()
  });
  test('a guest sees neither the karte tab nor karte contents', async (fx) => {
    // jiro on /u/shiro: expectHiddenAfter(shiro displayName, tab 'カルテ'); expect(text('到着が30分遅れた')).toHaveCount(0)
  });
  test('a karte a cast writes is visible to other casts', async (fx) => {
    // new guest G; new cast C writes a karte on G at the service stage with note {note}
    // switchUser yuna: /u/<G> カルテのタブ: note visible
  });
});
```

- [ ] **Step 2: Run** `pnpm exec e2e run tests/karte.e2e.ts`。Expected: 全部 PASS、全部の `agent.act` が `saved`。
- [ ] **Step 3: Commit** — `feat(dystopia/e2e): cover karte rules`

### Task 6: Review tests

**Files:**
- Create: `dystopia/e2e/tests/reviews.e2e.ts`

**Interfaces:**
- Consumes: Task 1 の support

- [ ] **Step 1: Write the tests**

```ts
describe('reviews.md / 作成', () => {
  test('a guest writes a review that other viewers see', async (fx) => {
    // new guest G writes a review on rin with note {note}; switchUser jiro: /u/rin クチコミのタブ: note visible
  });
  test('a cast cannot write a review', async (fx) => {
    // yuna on /u/rin クチコミのタブ: expectHiddenAfter(text(SEED.accounts.shiro.displayName), button 'このキャストのクチコミを書く')
  });
});
describe('reviews.md / 閲覧', () => {
  test('a review is hidden from a viewer who blocked its author', async (fx) => {
    // new guest G writes a review on rin with note {note}
    // new guest V blocks G; V on /u/rin クチコミのタブ: expectHiddenAfter(text(SEED.accounts.shiro.displayName), note)
  });
});
describe('reviews.md / 鍵付きのゲストの名前', () => {
  test("a locked guest's review shows the body but hides the name from non-followers", async (fx) => {
    // new guest G turns the lock on, writes a review on rin with note {note}
    // switchUser jiro: /u/rin クチコミのタブ: note visible, text('（非公開のゲスト）') visible, G displayName count 0
  });
});
```

- [ ] **Step 2: Run** `pnpm exec e2e run tests/reviews.e2e.ts`。Expected: 全部 PASS、全部の `agent.act` が `saved`。
- [ ] **Step 3: Commit** — `feat(dystopia/e2e): cover review rules`

### Task 7: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/dystopia-e2e.yaml`

**Interfaces:**
- Consumes: `dystopia/e2e/bin/stack up`（Task 1）、ロール `arn:aws:iam::559744160976:role/github-oidc-auth-master-github-actions-bedrock-invoke-role`（Task 0）

- [ ] **Step 1: Write the workflow** — 
  - `name: 'Dystopia E2E'`、`on: schedule: - cron: '0 18 * * *'`（日本時間 03:00）と `workflow_dispatch`。
  - `permissions: {}`。job の permissions は `contents: read` と `id-token: write`。
  - `concurrency: { group: dystopia-e2e, cancel-in-progress: false }`。
  - job は `runs-on: ubuntu-latest`、`environment: dystopia-e2e`、`timeout-minutes: 60`。
  - `services.postgres`: `postgres:18.6-alpine`、`POSTGRES_USER=postgres`、`POSTGRES_PASSWORD=password`、port `5432:5432`、`pg_isready` の health check。
  - steps: checkout → `ruby/setup-ruby`（`ruby-version: 4.0.3`、`working-directory: dystopia/monolith`、`bundler-cache: true`）→ pnpm と Node 26 → `dystopia/e2e` で `pnpm install --frozen-lockfile` → `pnpm exec e2e-web install chromium --with-deps` → `dystopia/e2e/bin/stack up` → `aws-actions/configure-aws-credentials`（上のロール、`aws-region: us-east-1`）→ `actions/cache/restore`（path `${{ runner.temp }}/e2e-cache`、key `dystopia-e2e-${{ github.run_id }}-${{ github.run_attempt }}`、restore-keys `dystopia-e2e-`）→ `pnpm exec e2e run --reporter list,junit`（env `CI=1`、`E2E_CACHE_DIR=${{ runner.temp }}/e2e-cache`、`E2E_TELEMETRY_DISABLED=1`、`APP_URL=http://localhost:3055`）→ `actions/cache/save`（`if: ${{ !cancelled() }}`、同じ path と key）→ `actions/upload-artifact`（`if: ${{ !cancelled() }}`、`dystopia/e2e/.e2e/report.json`、`junit.xml`、`results/`、`stack/`、retention 7 日）。
- [ ] **Step 2: Lint** — リポジトリの `lint-actions.yml` が使う actionlint を手元で実行し、エラーなし。
- [ ] **Step 3: Create the GitHub environment** — `gh api -X PUT repos/panicboat/monorepo/environments/dystopia-e2e`。Expected: 200。
- [ ] **Step 4: Commit and push** — `feat(dystopia): run the e2e tests on a schedule and on demand`。`git push -u origin HEAD`。
- [ ] **Step 5: Draft PR** — `gh pr create --draft`。タイトル `feat(dystopia): add e2e tests that run on a schedule`。本文は `panicboat/.github` の PR テンプレートに従い、先頭に `Closes #1992`。Task 0 の platform PR の apply が前提であることを書く。
- [ ] **Step 6: Dispatch from the branch** — Task 0 の apply 後に `gh workflow run dystopia-e2e.yaml --ref feat/dystopia-e2e`。Expected: job が成功し、artifact に `report.json` がある。workflow は default branch にないと dispatch できないので、できない場合はユーザーに伝えて merge 後に行う。
- [ ] **Step 7: Dispatch again** — 同じ ref でもう一度。Expected: run の summary の `Cache` 行に `replayed` があり、`missed` が 0。

### Task 8: Confirm the tests catch broken rules

**Files:** なし（一時的な変更だけで、commit しない）

- [ ] **Step 1** — 次の 5 か所を 1 つずつ一時的に壊し、そのたびに `bin/stack up && pnpm exec e2e run tests/<file>` で対応するテストが落ちることを確かめ、`git checkout -- <file>` で戻す。壊す場所は monolith の該当 slice の判定を grep で探す。
  - 投稿: フォロワーのみの投稿をフォローしていない人にも返す → `posts.e2e.ts` が落ちる
  - ブロック: ブロック関係の投稿の除外を外す → `posts.e2e.ts` か `follows-and-blocks.e2e.ts` が落ちる
  - 鍵: 鍵を通れる条件に承認待ちを含める → `profiles.e2e.ts` が落ちる
  - カルテ: ゲストにもカルテを返す → `karte.e2e.ts` が落ちる
  - クチコミ: 鍵付きのゲストの名前を伏せない → `reviews.e2e.ts` が落ちる
- [ ] **Step 2** — 結果（壊した箇所、落ちたテスト名、出力の抜粋）を PR のコメントに残す。`git status` が clean であること。
