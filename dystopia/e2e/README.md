# dystopia e2e

dystopia の monolith と frontend をつないだ状態で、ブラウザから仕様の線引きを確かめるテスト。
テストは e2e-inc/e2e（`e2e` と `@e2e-dev/web`）で書く。

## Prerequisites

- PostgreSQL が `localhost:5432` で動いていて、ユーザー `postgres`・パスワード `password` で接続できること。
- rbenv の Ruby で、`dystopia/monolith` の `bundle install` が済んでいること。
- Node.js と pnpm が `package.json` の `packageManager` の版で使えること。
- `agent` の手順を含むテストを動かすときは、Bedrock を呼べる AWS の認証情報があること。

## Running Locally

`dystopia/e2e` で次の順に実行する。

```bash
env -u NODE_OPTIONS pnpm install --frozen-lockfile
export E2E_TELEMETRY_DISABLED=1
eval "$(aws configure export-credentials --format env)"
bin/stack up
env -u NODE_OPTIONS pnpm test
bin/stack down
```

`aws configure export-credentials` の行は、`agent` の手順を含むテストを動かすときだけ要る。
e2e は `~/.aws` のプロファイルを読まず、環境変数の認証情報だけを使うため。
初回の実行では、e2e が Chromium を取得する。
1 つのファイルだけを動かすときは `env -u NODE_OPTIONS pnpm exec e2e run tests/account.e2e.ts` のように渡す。

## Local Stack

`bin/stack up` は次を行い、サインインが通るようになってから戻る。

- 使い捨ての DB を作り直し、migrate と seed を入れる。
- monolith と、`next build` した frontend を固定のポートで起動する。
- frontend は偽の Cognito を使う。

DB 名・ポート・ブラウザで開く URL は `bin/stack` と `e2e.config.ts` に書かれている。
別の URL に向けるときは `APP_URL` を設定する。

`bin/stack down` は `up` が起動したプロセスを止め、DB を消す。
ログと PID は `.e2e/stack/` に書かれる。
`up` が失敗したときは、両方のログの末尾を出したうえで `down` と同じ後片付けをする。

## Test Data

- seed のアカウントの電話番号・ユーザー名・表示名と投稿本文は `tests/support/seed.ts` にまとめてある。
- seed のパスワードと新規登録の確認コードは `tests/support/session.ts` にある。
- 状態を変えるテストは、テストの中で `createAccount` で作ったアカウントだけを使う。

## Replay Cache

`agent` の手順の記録は `.e2e/cache/` に保存され、次の実行から再生される。
ローカルの記録は commit しない。
CI の記録は GitHub Actions の cache に置かれる。

## Writing Tests

- `describe` の名前は `<仕様書のファイル名> / <節の見出し>`（例: `posts.md / 閲覧できる範囲`）にする。
  - 仕様を変えたときに、直すテストを見出しから探せるようにするため。
- 「見えない」ことは `expectHiddenAfter` で、見えるはずのものが見えたあとに確かめる。
  - 読み込み前や表示の失敗で、ないことの確認が誤って通るのを防ぐため。
- プロフィールのタブの中を確かめるときは、`?tab=` を付けた URL でタブを直接開く。
  - 選ばれているタブの中身だけが描画されるため。
- `agent.act` は必ず `actFromHome` でホームから始める。
  - 記録は開始時の URL も含むので、実行ごとに変わるプロフィールの URL から始めると毎回再生が外れる。
- 実行ごとに変わる値が画面に出る act では、`SIGNED_IN_AS`・`actorParams`・`targetParams` を使い、値を `unique()` の params で渡す。
  - 表示名や本文を指示に直書きすると、再生の終わりの確認が外れてモデルが毎回呼ばれる。
- act は、消えないもの（一覧に載った項目やスイッチの状態）が見える画面で終わらせ、トーストで終わらせない。
  - トーストは再生の終わりの確認までに消え、再生が外れる。
- 各 act の直後に、結果を確かめる locator の `expect` を置く。
  - e2e は、確認の通った act だけを記録する。
- act を複数含むテストには `RECORDING_TIMEOUT_MS` を付ける。
  - 記録を作る実行は手順ごとにモデルを待つので、既定のタイムアウトでは足りない。
- 状態を変えるのは、`createAccount` で作ったアカウントだけにする。
  - seed の関係を変えると、他のテストの前提が崩れる。
- act の指示には、画面のラベル（`プロフィールを編集` など）をあえて書く。
  - agent を意図した経路から外さないため。
  - ラベルを変えると、その act の記録が 1 回作り直しになる。

## CI

`.github/workflows/dystopia-e2e.yaml` が、毎日の定期実行と手動実行で e2e を回す。

- 実行のたびに `bin/stack up` で DB を作り直し、seed を入れ直す。
  - seed の投稿には seed 後 6 時間以内に期限が切れるものがあり、古い DB では閲覧の範囲のテストが崩れるため。
- 定期実行が落ちたら、run の artifact `dystopia-e2e` を見る。
  - `report.json` には、テストごとの結果と act ごとの記録の扱いが入っている。
  - `results/*/trace.md` には、落ちたテストの手順ごとの経過・記録の扱い・失敗時の画面が入っている。
  - `stack/*.log` には、monolith と frontend のログが入っている。
  - run のログの `Cache` の行で、再生・モデルへの引き継ぎ・外れの件数が分かる。
- main 以外のブランチからの手動実行は、main の記録を読む。
  - そこで保存した記録は main からは読めないため、main の定期実行には引き継がれない。
- CI では e2e の既定どおり、落ちたテストを 1 回だけやり直す。
  - やり直しは記録を再生せず、act をすべてモデルで実行する。
