# Dystopia E2E Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dystopia の e2e に、メッセージ・通知・検索・予定・メディア添付の線引きのテストを足し、S3 を aws-emulator と中継で CI の中に立てる。

**Architecture:** `bin/stack` が aws-emulator（CI は Debian パッケージ、macOS は Docker）と、ブラウザのヘッダーを外して転送する Node の中継を起動し、monolith の S3 の接続先を中継に向ける。
テストは前回と同じく、状態を変える操作は `agent.act`、確認は locator の `expect` で行う。
検索と予定のテストは seed だけを読み、メッセージ・通知・メディアのテストはテストの中で作ったアカウントで状態を変える。

**Tech Stack:** e2e-inc/e2e 0.23.0 + @e2e-dev/web 0.15.5、aws-emulator 1.0.338、Node（中継）、bash（`bin/stack`）、Renovate の regex custom manager。

**Spec:** `docs/superpowers/specs/2026-11-13-dystopia-e2e-coverage-design.md`

## Global Constraints

- monolith と frontend の製品コードを変えない。
- monolith にも e2e にも、本物の AWS の S3 を触らせない。
  - monolith のプロセスには `AWS_PROFILE`・`AWS_DEFAULT_PROFILE`・`AWS_ACCESS_KEY_ID`・`AWS_SECRET_ACCESS_KEY`・`AWS_SESSION_TOKEN` を渡さず、`AWS_CONFIG_FILE=/dev/null` にする。
  - `AWS_ENDPOINT_URL` は monolith とバケット作成のプロセスにだけ渡し、e2e の runner（Bedrock を呼ぶ）には渡さない。
- aws-emulator の版は `bin/stack` の `AWS_EMULATOR_VERSION="1.0.338"` の 1 か所で固定する。
- aws-emulator は `127.0.0.1` だけで待ち受け、`--telemetry off` を付け、認証は有効のまま（`--auth` を付けない）にする。
- ポートは emulator `9297`、中継 `9298`。バケットは `dystopia-media-e2e`、region は `us-east-1`。
- 新しい npm・gem の依存を足さない（中継は Node の標準モジュールだけで書く）。
- テストは `dystopia/e2e/README.md` の Writing Tests に従う。
  - `describe` は `<仕様書のファイル名> / <節の見出し>`。
  - act は `actFromHome` から始め、実行ごとに変わる値は `unique()` の params で渡す。
  - act の直後に locator の `expect` を置き、act を複数含むテストには `RECORDING_TIMEOUT_MS` を付ける。
  - 状態を変えるのは `createAccount` で作ったアカウントだけ。
  - 「見えない」「できない」は、同じ画面で見えるはずのものを先に確かめてから確かめる（`expectHiddenAfter` など）。
- 既存の act の指示文字列は 1 文字も変えない（変えると記録が作り直しになる）。
- コメントは英語 1 行、why-not だけ、タスクへの言及なし。意図的に握りつぶすところは `// SILENT:`（bash は `# SILENT:`）。
- commit は `git commit -s`、`Co-Authored-By` を付けない、メッセージは英語の Conventional Commits。

## Review Focus

- 手元に別の AWS の認証情報（`AWS_PROFILE` など）が入ったシェルで `bin/stack up` しても、monolith が本物の S3 に署名・接続しないこと（Task 1 の Step 4 で確かめる）。
- Docker が止まっている macOS で `bin/stack up` を叩いたとき、DB を触る前に理由の分かるメッセージで止まること（Task 1 の Step 5）。
- `bin/stack up` が途中で失敗したとき、emulator（Docker のコンテナを含む）と中継も止まり、次の `up` がポートの衝突で落ちないこと（Task 1 の Step 5）。
- 画像の「表示」を、要素があるだけでなく読み込みの完了で確かめること（署名付き URL の取得失敗で誤って通らない。Task 7）。
- 通知の「出ない」が、ブロック以外の規則（閲覧の可否・集約）で先に止まって通っていないこと（Task 4 の発火の順番と経路、Task 8 の壊して確かめる手順）。

---

### Task 1: aws-emulator and S3 relay in bin/stack

**Files:**
- Create: `dystopia/e2e/bin/s3-relay.mjs`
- Create: `dystopia/e2e/emulator/Dockerfile`
- Modify: `dystopia/e2e/bin/stack`

**Interfaces:**
- Produces: `bin/stack up` の後、`http://127.0.0.1:9298` が S3 の中継として動き、monolith の署名付き URL はこのアドレスを指す。
- Produces: `bin/stack install-emulator`（Linux 専用。CI の workflow が Task 2 で呼ぶ）。
- Produces: `.e2e/stack/` に `aws-emulator.log`・`s3-relay.log`、PID ファイル `aws-emulator.pid`（Linux）・`s3-relay.pid`。

- [ ] **Step 1: Write `bin/s3-relay.mjs`**
  - 環境変数 `RELAY_PORT`・`EMULATOR_PORT`・`ALLOWED_ORIGIN`・`EMULATOR_CA`（ca.pem のパス）を読み、どれかが無ければ exit 1。
  - `127.0.0.1:$RELAY_PORT` で http を待ち受ける。
  - `OPTIONS` には 204 と CORS のヘッダー（`access-control-allow-origin: $ALLOWED_ORIGIN`、`access-control-allow-methods: GET,PUT`、`access-control-allow-headers: content-type`、`access-control-max-age: 300`）を返す。
  - それ以外は `origin`・`referer`・`sec-fetch-*` を外したヘッダー（`host` はそのまま）で `https://127.0.0.1:$EMULATOR_PORT` に転送し、応答のヘッダーに `access-control-allow-origin` を足して返す。
  - 転送の失敗は 502。
  - 中身は設計書の Current State にある spike の中継と同じ形でよい。
- [ ] **Step 2: Write `emulator/Dockerfile`**
  - base は `public.ecr.aws/amazonlinux/amazonlinux:2023-minimal`。
  - `ARG AWS_EMULATOR_VERSION` と `ARG TARGETARCH` を取り、`TARGETARCH` を `amd64→x86_64`、`arm64→aarch64` に読み替えて `https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/aws-emulator-${AWS_EMULATOR_VERSION}-1-${arch}.rpm` を入れる。
  - uid 1000・`HOME=/home/emulator` で、`ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0", "--telemetry", "off"]`。
    - コンテナの中では `0.0.0.0` で待ち受け、`127.0.0.1` への限定は `docker run -p 127.0.0.1:9297:9297` で行う（このことを Dockerfile に 1 行コメントで書く）。
- [ ] **Step 3: Extend `bin/stack`**
  - 定数: `AWS_EMULATOR_VERSION="1.0.338"`、`EMULATOR_PORT=9297`、`RELAY_PORT=9298`、`MEDIA_BUCKET=dystopia-media-e2e`、`MEDIA_REGION=us-east-1`、`EMULATOR_HOME="$STACK_DIR/emulator-home"`、`EMULATOR_CONTAINER=dystopia-e2e-aws-emulator`。
  - emulator の資格情報は両方の方式で `$EMULATOR_HOME/.aws/emulator/$EMULATOR_PORT/` に出る形にする。
    - Linux は `HOME="$EMULATOR_HOME" aws-emulator -b 127.0.0.1 --telemetry off` を直接起動し、PID ファイルで追う。
    - それ以外は `docker build --build-arg AWS_EMULATOR_VERSION=... -t dystopia-e2e-aws-emulator:$AWS_EMULATOR_VERSION dystopia/e2e/emulator` の後、`docker run -d --name $EMULATOR_CONTAINER -p 127.0.0.1:9297:9297 -v "$EMULATOR_HOME:/home/emulator"` で起動し、ログは `docker logs` を `aws-emulator.log` に流す。
  - `install-emulator` サブコマンド: Linux でだけ動き、`dpkg --print-architecture` の値で `aws-emulator_${AWS_EMULATOR_VERSION}-1_${arch}.deb` を一時ディレクトリに落として `sudo apt-get install -y ./<file>` する。
  - `up` の順番: `stop_processes` → ポート（9055・3055・9297・9298）の確認 → 方式の前提の確認（Linux は `aws-emulator` が PATH にあること、それ以外は `docker info` が通ること。満たさなければ理由を出して exit 1） → `trap on_up_failure EXIT` → emulator の起動 → `https://127.0.0.1:9297/__admin/health` が `--cacert ca.pem` で 200 になるまで待つ（60 秒） → 中継の起動と待ち受けの確認 → バケット作成 → `prepare_database` → monolith → frontend → `wait_until_ready`。
  - S3 の環境は 1 つの関数（例: `run_with_s3_env`）にまとめ、monolith の起動とバケット作成の両方で使う。
    - 外す: Global Constraints の AWS の変数。
    - 渡す: `AWS_ENDPOINT_URL=http://127.0.0.1:9298`、`AWS_SHARED_CREDENTIALS_FILE=<emulator の credentials>`、`AWS_CONFIG_FILE=/dev/null`、`AWS_REGION=us-east-1`、`MEDIA_BUCKET_NAME`、`MEDIA_BUCKET_REGION=us-east-1`。
    - credentials の profile 名が `default` でなければ、その名前を `AWS_PROFILE` に入れる（生成されたファイルを見て決める）。
  - バケット作成は monolith のディレクトリで `run_with_s3_env "${BUNDLE_EXEC[@]}" ruby -e 'require "aws-sdk-s3"; Aws::S3::Client.new.create_bucket(bucket: ENV.fetch("MEDIA_BUCKET_NAME"))'`。バケットの CORS は設定しない。
  - `stop_processes` は frontend → monolith → 中継 → emulator の順。Docker の方式は `docker rm -f "$EMULATOR_CONTAINER"`（無ければ黙って通す）。
  - `print_logs` と `wait_until_ready` の生存確認に中継と emulator を足す。
  - 中継の起動は `ALLOWED_ORIGIN=http://localhost:${FRONTEND_PORT}`、`EMULATOR_CA=<ca.pem>` を付けて `env -u NODE_OPTIONS node "$E2E_DIR/bin/s3-relay.mjs"`。
- [ ] **Step 4: Verify the stack**
  - `cd dystopia/e2e && AWS_PROFILE=does-not-exist bin/stack up` → `stack is ready at http://localhost:3055`。
    - 存在しない profile を付けても通ることで、monolith とバケット作成に手元の AWS の変数が届いていないことを確かめる。
  - `curl -s -o /dev/null -w '%{http_code} %header{access-control-allow-origin}\n' -X OPTIONS -H 'Origin: http://localhost:3055' -H 'Access-Control-Request-Method: PUT' http://127.0.0.1:9298/dystopia-media-e2e/k` → `204 http://localhost:3055`。
  - monolith の署名で中継を通す: monolith のディレクトリで、Step 3 と同じ環境で `Aws::S3::Presigner` の PUT の URL を出し、`curl -X PUT -H 'Origin: http://localhost:3055' -H 'Sec-Fetch-Site: cross-site' -H 'Content-Type: image/png' --data-binary @<任意のファイル> '<URL>'` → 200。同じキーの GET の URL も `Origin` 付きで 200。
- [ ] **Step 5: Verify teardown and failure paths**
  - `bin/stack down` の後、`lsof -nP -iTCP:9297 -sTCP:LISTEN`・`lsof -nP -iTCP:9298 -sTCP:LISTEN` が空、macOS では `docker ps -a --filter name=dystopia-e2e-aws-emulator -q` が空。
  - Docker Desktop を止めて `bin/stack up` → DB を作り直す前に、Docker が要る理由を出して exit 1。
  - monolith の起動を失敗させる（例: `MONOLITH_DB_URL` を一時的に壊す）と、`up` が後片付けし、ポート 9297・9298 も空く。確かめたら元に戻す。
- [ ] **Step 6: Commit** — `feat(dystopia/e2e): run S3 on aws-emulator behind a relay in the e2e stack`

### Task 2: CI install step, Renovate and README

**Files:**
- Modify: `.github/workflows/dystopia-e2e.yaml`
- Modify: `.github/renovate.json`
- Modify: `dystopia/e2e/README.md`

**Interfaces:**
- Consumes: `bin/stack install-emulator`（Task 1）、`AWS_EMULATOR_VERSION="<version>"` の行（Task 1）。

- [ ] **Step 1: Workflow** — `Install PostgreSQL 18 client` の後、`Start the stack` の前に step `Install aws-emulator`（`run: bin/stack install-emulator`）を足す。`Start the stack` が `Configure AWS credentials` より前にある順番は変えない。
- [ ] **Step 2: Renovate**
  - `customManagers` に regex の manager を足す: `managerFilePatterns` は `/(^|/)dystopia/e2e/bin/stack$/`、`matchStrings` は `AWS_EMULATOR_VERSION="(?<currentValue>[^"]+)"`、`depNameTemplate` は `aws/aws-emulator`、`datasourceTemplate` は `github-releases`、`extractVersionTemplate` は `^v(?<version>.+)$`。
  - `packageRules` に `matchDepNames: ["aws/aws-emulator"]` で `automerge: false` と `schedule: ["before 6am on monday"]` を足す。
    - e2e は PR では回らないので、自動 merge すると試さずに上がる。release が 1 日に何度も出るので、週 1 回にまとめる。
  - 既存の項目と同じく `description` を付ける。
- [ ] **Step 3: README**
  - Local Stack に、`up` が aws-emulator と中継を起動すること、macOS では Docker が要ること、版は `bin/stack` で固定し Renovate で上げることを足す。
  - なぜ中継が要るか（emulator がブラウザ由来のリクエストを拒否する）を 1〜2 文で足す。
  - CI に、workflow が aws-emulator のパッケージを入れることを足す。
- [ ] **Step 4: Verify**
  - `npx --yes --package renovate renovate-config-validator .github/renovate.json` → エラーなし。
  - `actionlint .github/workflows/dystopia-e2e.yaml`（入っていれば）→ エラーなし。
- [ ] **Step 5: Commit** — `ci(dystopia/e2e): install aws-emulator and track its version with Renovate`

### Task 3: Messages

**Files:**
- Create: `dystopia/e2e/tests/support/social.ts`
- Create: `dystopia/e2e/tests/support/messages.ts`
- Create: `dystopia/e2e/tests/messages.e2e.ts`
- Modify: `dystopia/e2e/tests/follows-and-blocks.e2e.ts`

**Interfaces:**
- Produces（`support/social.ts`）:
  - `requireApproval(fx: ActFixtures, cast: SeedAccount): Promise<void>` — `createApprovalCast` の中の承認制の act と、その直後の `toBeChecked` の確認をそのまま移したもの。
  - `decideRequest(fx, decision: '承認' | '拒否', owner, requester, bystander?)` — `follows-and-blocks.e2e.ts` から指示文字列を変えずに移したもの。
- Produces（`support/messages.ts`）:
  - `BLOCKED_NOTICE = 'この相手とはメッセージを送受信できません'`、`FOLLOW_REQUIRED_NOTICE = '相手をフォローするとメッセージを送れます'`。
  - `sendFromProfile(fx: ActFixtures, sender: SeedAccount, recipient: SeedAccount, body: string): Promise<void>` — act の指示は `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, tap メッセージ, write {body} into メッセージ本文, tap 送信, and check that {body} is listed`。直後に `text(fx, body)` が見えることを確かめる。
  - `replyInThread(fx, sender, counterpart, body)` — act の指示は `${SIGNED_IN_AS}open メッセージ, open the thread with {targetName}, write {body} into メッセージ本文, tap 送信, and check that {body} is listed`。直後に同じ確認。
  - `openThread(fx: SessionFixtures, counterpart: SeedAccount): Promise<void>` — `/messages` を開き、`counterpart.displayName` を含むスレッドのリンク（`href` が `/messages/` で始まる行）を押し、見出しの「とのメッセージ」が出るまで待つ。
  - `messageInput(fx)` — ラベル `メッセージ本文` の入力欄。

- [ ] **Step 1: Move the helpers** — `requireApproval` と `decideRequest` を `support/social.ts` に移し、`follows-and-blocks.e2e.ts` は `createApprovalCast` を `createAccount` → `requireApproval` → `post` で組み直す。`pnpm typecheck` → 通る。
- [ ] **Step 2: Write `messages.e2e.ts`**

```ts
describe('messages.md / 送信条件', () => {
  test('a block in either direction stops sending, and the existing messages stay readable', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    // guest = createAccount('guest'), cast = createAccount('cast')
    // cast: sendFromProfile(cast → guest, body)  (cast needs no follow)
    // cast: changeBlock(cast, guest, 'ブロック')
    // cast: openThread(guest) → expect text(body) visible, text(BLOCKED_NOTICE) visible, messageInput count 0
    // guest: openThread(cast) → expect text(body) visible, text(BLOCKED_NOTICE) visible, messageInput count 0
  });

  test('a guest can send only after the follow is approved, and a cast can send without a follow', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    // guest = createAccount('guest'); cast = createAccount('cast') + requireApproval(cast)
    // cast: sendFromProfile(cast → guest, castBody)
    // guest: openThread(cast) → text(castBody) visible, text(FOLLOW_REQUIRED_NOTICE) visible, messageInput count 0
    // guest: follow(cast) → openProfile(cast) → button 申請中 visible
    // guest: openThread(cast) → text(castBody) visible, text(FOLLOW_REQUIRED_NOTICE) visible, messageInput count 0
    // cast: decideRequest('承認', cast, guest)
    // guest: openThread(cast) → messageInput visible, text(FOLLOW_REQUIRED_NOTICE) count 0
    // guest: replyInThread(guest → cast, guestBody)
    // cast: openThread(guest) → text(guestBody) visible
  });
});
```

  - 本文は `e2e message ${Date.now()}` の形で、テストごとに変える。
  - 送信者側の画面の「送れない」は、サーバーが返す送信制限（`send_restriction.rb`）で決まる案内文と入力欄の有無で確かめる。プロフィールの「メッセージ」ボタンの有無では確かめない（画面だけの判定で、サーバーの規則を外しても通るため）。
- [ ] **Step 3: Run** — `cd dystopia/e2e && bin/stack up && pnpm exec e2e run tests/messages.e2e.ts tests/follows-and-blocks.e2e.ts` → 全部 PASS。`follows-and-blocks` の act が `replayed`（記録の作り直しがない）こと。
- [ ] **Step 4: Commit** — `test(dystopia/e2e): cover who can send messages`

### Task 4: Notifications

**Files:**
- Create: `dystopia/e2e/tests/support/notifications.ts`
- Create: `dystopia/e2e/tests/notifications.e2e.ts`

**Interfaces:**
- Consumes: `post`・`POST_FOR_EVERYONE`・`POST_FOR_FOLLOWERS`（`support/posts.ts`）、`changeBlock`（`support/act.ts`）。
- Produces:
  - `MENTIONED = 'あなたをメンションしました'`。
  - `notificationRows(fx: SessionFixtures, actor: SeedAccount, action: string): Locator` — 通知一覧の 1 行（`EntryCard` の根の要素）のうち、`actor.displayName` と `action` の両方を含むもの。
  - `openNotifications(fx: SessionFixtures): Promise<void>` — `/notifications` を開き、「未読 」で始まる件数の表示が出るまで待つ。
  - `commentWithMention(fx: ActFixtures, commenter: SeedAccount, postAuthor: SeedAccount, postBody: string, body: string): Promise<void>` — act の指示は `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, open the post {postBody}, write {body} into コメント内容, send it, and check that {body} is listed`（`postBody` と `body` は `unique()`）。直後に `text(fx, body)` を確かめる。

- [ ] **Step 1: Write `notifications.e2e.ts`**

```ts
describe('notifications.md / 通知の種類', () => {
  test('a block by the receiver stops notifications from the blocked actor, and a block by the actor does not', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    // receiver, blocked, blocker, author = createAccount(...)   (author is a cast, the others guests)
    // author: post(POST_FOR_EVERYONE, authorBody)
    // receiver: changeBlock(receiver, blocked, 'ブロック')
    // blocker: changeBlock(blocker, receiver, 'ブロック')
    // blocker: commentWithMention(blocker → author's post, `... @${receiver.username}`)
    // blocked: commentWithMention(blocked → author's post, `... @${receiver.username}`)
    // receiver: openNotifications → expectHiddenAfter(notificationRows(blocker, MENTIONED), notificationRows(blocked, MENTIONED))
  });

  test('a mention does not notify a profile that cannot view the post', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    // receiver = createAccount('guest'); author = createAccount('cast')
    // author: post(POST_FOR_FOLLOWERS, `e2e followers mention ${stamp} @${receiver.username}`)
    // author: post(POST_FOR_EVERYONE, `e2e public mention ${stamp} @${receiver.username}`)
    // receiver: openNotifications → notificationRows(author, MENTIONED).first() visible, then toHaveCount(1)
  });
});
```

  - 経路は、ブロックによる閲覧の制限を受けないもの（第三者の投稿へのコメントでのメンション）にする。`add_comment.rb` はコメントする人の閲覧の可否を見ず、メンションの判定は受信者が第三者の投稿を見られるかだけを見るため、`emit.rb` のブロックの判定だけが効く。
  - 1 つ目のテストは、見えるはずの `blocker` を先に、見えないはずの `blocked` を後に発火させる。
    - 2 つの通知が 1 行に集約される場合でも、ブロックの判定を外すと最新の発火者が `blocked` になって落ちる。
  - 2 つ目のテストは、同じ投稿者の 2 つの投稿の通知が別の行になる（対象が投稿ごと）ことを使い、行の数で確かめる。
  - 通知は発火の処理の中で同期的に作られるので、act の後に一覧を開けば足りる。待ちを足さない。
- [ ] **Step 2: Run** — `pnpm exec e2e run tests/notifications.e2e.ts` → 全部 PASS。
- [ ] **Step 3: Commit** — `test(dystopia/e2e): cover when notifications are suppressed`

### Task 5: Search

**Files:**
- Modify: `dystopia/e2e/tests/support/seed.ts`
- Create: `dystopia/e2e/tests/search.e2e.ts`

**Interfaces:**
- Produces（`seed.ts`）: `SEED.schedules = { mio: '20:00 〜 04:00', rin: '15:00 〜 23:00' }`（`config/db/seeds/schedule/schedules.rb` の時刻。画面の表記に合わせる）。
- Produces（`search.e2e.ts` の中だけ）: `businessDate(offsetDays: number): string` — 日本時間から 5 時間引いた日付（seed の営業日の今日）に `offsetDays` を足した `YYYY-MM-DD`。

- [ ] **Step 1: Write `search.e2e.ts`** — すべて seed のアカウントで、`signIn` と URL だけを使い、act を使わない。

```ts
// rin has seed schedules on business days 0, 1, 3, 4 and 5, and mio on 0, 2, 3 and 5, so day 3 has both and stays inside the search range at any hour.
const SCHEDULE_DAY = businessDate(3);
// An empty prefecture is 全国; without it the viewer's own prefecture would hide the other casts by area.
const scheduleSearch = (q = '') => `/search?${new URLSearchParams({ q, tab: 'schedules', prefecture: '', date: SCHEDULE_DAY })}`;

describe('search.md / 検索結果に出ない条件', () => {
  test('a blocked profile is missing from post and schedule search but present in user search', async (fx) => {
    // taro (rin blocks taro)
    // /search?q=/Public/Public]&tab=posts → expectHiddenAfter(text(SEED.posts.yunaPublic), text(SEED.posts.rinPublic))
    // scheduleSearch() → expectHiddenAfter(text('みお'), text('りん'))
    // /search?q=rin&tab=users → text('@rin') visible
  });

  test('a locked cast is missing from schedule search for a viewer who cannot pass the lock but present in user search', async (fx) => {
    // jiro (no follow to mio)
    // scheduleSearch() → expectHiddenAfter(text('りん'), text('みお'))
    // /search?q=mio&tab=users → text('@mio') visible
  });

  test('a followers-only post is missing from post search even for an approved follower', async (fx) => {
    // taro (approved follower of yuna)
    // /search?q=[Yuna/Public/&tab=posts → expectHiddenAfter(text(SEED.posts.yunaPublic), text(SEED.posts.yunaFollowers))
  });
});
```

  - 予定検索の結果の行は表示名で探す。行に表示名が出ない作りなら、行の中で必ず出る識別子（`@<username>` など）に替える。
- [ ] **Step 2: Run** — `pnpm exec e2e run tests/search.e2e.ts` → 全部 PASS。
- [ ] **Step 3: Commit** — `test(dystopia/e2e): cover what search hides by block, lock and audience`

### Task 6: Schedules

**Files:**
- Create: `dystopia/e2e/tests/schedules.e2e.ts`

**Interfaces:**
- Consumes: `SEED.schedules`（Task 5）。

- [ ] **Step 1: Write `schedules.e2e.ts`** — すべて seed のアカウントで、act を使わない。予定タブは `/u/<username>?tab=schedule` で直接開く。

```ts
const LOCKED_NOTICE = 'フォローすると見られます';
const NO_SCHEDULES = '予定はありません';

describe('schedules.md / 予定の見え方', () => {
  test('a locked cast shows its schedules to an approved follower', async (fx) => {
    // taro → /u/mio?tab=schedule → text(SEED.schedules.mio) visible
  });

  test('a locked cast tells a viewer without a follow and a pending follower to follow instead of listing schedules', async (fx) => {
    // jiro → /u/mio?tab=schedule → expectHiddenAfter(text(LOCKED_NOTICE), text(SEED.schedules.mio))
    // saburo (pending) → same
  });

  test('a block leaves the schedule tab empty without the follow notice', async (fx) => {
    // jiro → /u/rin?tab=schedule → text(SEED.schedules.rin) visible
    // taro → /u/rin?tab=schedule → text(NO_SCHEDULES) visible, then text(SEED.schedules.rin) count 0 and text(LOCKED_NOTICE) count 0
  });
});

describe('schedules.md / 登録できるユーザー', () => {
  test('a guest has no schedule tab and no 予定 in the compose menu or the bottom menu', async (fx) => {
    // yuna → /u/yuna → tab 予定 visible; open 作成メニュー → item 予定 visible   (the locators work)
    // taro → /u/taro → expectHiddenAfter(tab 投稿, tab 予定); bottom menu link 予定 count 0
    // taro → open 作成メニュー → expectHiddenAfter(item 投稿, item 予定)
  });
});
```

  - 作成メニューは `作成メニュー` のボタンで開く。項目と下段メニューの role は `FlowerMenu`・`BottomTab` の実際の要素に合わせる。
  - サーバーがゲストの登録を拒否することは rspec が確かめるので、ここでは画面の入口だけを確かめる。
- [ ] **Step 2: Run** — `pnpm exec e2e run tests/schedules.e2e.ts` → 全部 PASS。
- [ ] **Step 3: Commit** — `test(dystopia/e2e): cover who sees and edits schedules`

### Task 7: Post image media

**Files:**
- Create: `dystopia/e2e/fixtures/post-image.png`
- Create: `dystopia/e2e/tests/support/media.ts`
- Create: `dystopia/e2e/tests/media.e2e.ts`

**Interfaces:**
- Consumes: `bin/stack` の中継 `http://127.0.0.1:9298`（Task 1）、`follow`（`support/act.ts`）。
- Produces:
  - `RELAY_ORIGIN = 'http://127.0.0.1:9298'`。
  - `POST_WITH_IMAGE_FOR_FOLLOWERS = \`${SIGNED_IN_AS}open the compose menu, choose 投稿, write {body} as the post text, tap 画像/動画を追加 and attach fixtures/post-image.png, wait until the image preview appears, turn on the フォロワーのみ switch, and post it\``。
  - `loadedMediaImages(fx: BrowserActFixtures, body: string): Promise<number>` — `fx.browser.evaluate` で、本文 `body` を含む `article` の中の `img` のうち、`src` が `RELAY_ORIGIN` で始まり `complete && naturalWidth > 0` のものの数を返す。

- [ ] **Step 1: Add the fixture** — 64×64 の単色の PNG（数百バイト）を `fixtures/post-image.png` に置く。生成は Node の標準モジュール（`zlib`）で書いた使い捨てのスクリプトで行い、スクリプトは commit しない。
- [ ] **Step 2: Write `media.e2e.ts`**

```ts
describe('media.md / Rules', () => {
  test('a post image loads for viewers who can see the post and stays away from those who cannot', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    // follower = createAccount('guest'); cast = createAccount('cast')
    // cast: actFromHome(POST_WITH_IMAGE_FOR_FOLLOWERS, { ...actorParams(cast), body: unique(body) })
    // cast: openProfile(cast) → text(body) visible; expect.poll(() => loadedMediaImages(fx, body)).toBe(1)
    // follower: follow(cast) → openProfile(cast) → text(body) visible; expect.poll(...).toBe(1)
    // jiro (seed, no follow): openProfile(cast) → expectHiddenAfter(text(EMPTY_POSTS_MESSAGE), text(body)); loadedMediaImages(fx, body) is 0
  });
});
```

  - 画像は、要素があることではなく読み込みの完了（`complete && naturalWidth > 0`）で確かめる。
  - `src` が中継で始まることも条件に入れ、アップロード前のプレビュー（`blob:`）やアバターを数えない。
- [ ] **Step 3: Run** — `pnpm exec e2e run tests/media.e2e.ts` → PASS。`.e2e/stack/s3-relay.log` か emulator のログに PUT と GET が残っている。
- [ ] **Step 4: Commit** — `test(dystopia/e2e): cover post images through S3 on aws-emulator`

### Task 8: Break each line and run everything

**Files:** なし（製品コードを一時的に壊して戻す。commit しない）

- [ ] **Step 1: Break one line per feature** — 1 つずつ壊し、対応するテストだけを流して FAIL を確かめ、`git checkout -- <file>` で戻してから次へ進む。monolith を変えたら `bin/stack up` で起動し直す。
  - メッセージ: `slices/messaging/use_cases/send_restriction.rb` のブロックの判定を外す → `messages.e2e.ts` の 1 つ目が FAIL。
  - 通知: `slices/notifications/use_cases/emit.rb` のブロックの判定（受信者が発火者をブロック）を外す → `notifications.e2e.ts` の 1 つ目が FAIL。
  - 検索: 予定検索の鍵の除外を外す → `search.e2e.ts` の鍵のテストが FAIL。
  - 予定: 予定の一覧の鍵の判定を外す → `schedules.e2e.ts` の鍵のテストが FAIL。
  - メディア: `lib/storage/s3_adapter.rb` の `download_url` を空文字を返すようにする → `media.e2e.ts` が FAIL。
  - 外す箇所が見つからない、または外しても落ちないときは、テストの組み立てを直してから同じ手順をやり直す。
- [ ] **Step 2: Full run** — `bin/stack up && pnpm exec e2e run && pnpm typecheck && bin/stack down` → 全部 PASS、型エラーなし、`git status` で製品コードの差分なし。
- [ ] **Step 3: Self-check comments** — `git diff origin/main...HEAD` で足したコメントを Global Constraints と突き合わせ、合わないものを直して commit する。
- [ ] **Step 4: Push and Draft PR** — `git push -u origin HEAD`、リポジトリの PR テンプレートに従って `gh pr create --draft`（タイトル例: `test(dystopia/e2e): cover messages, notifications, search, schedules and media`）。新しい act の記録は merge 後の最初の CI で作られ、その 1 回だけ Bedrock の呼び出しが増えることを本文に書く。
