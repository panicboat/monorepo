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

- DB `monolith_e2e_test` を作り直し、migrate と seed を入れる。
- monolith を `127.0.0.1:9055` で、frontend を `next build` のあと `3055` で起動する。
- frontend は偽の Cognito を使う。

`bin/stack down` は `up` が起動したプロセスを止め、DB を消す。
ログと PID は `.e2e/stack/` に書かれる。
`up` が失敗したときは、両方のログの末尾を出したうえで `down` と同じ後片付けをする。

ブラウザで開く URL は `http://localhost:3055` にする。
別の URL に向けるときは `APP_URL` を設定する。

## Test Data

- seed のアカウントには、`+819000000101` からの電話番号とパスワード `password` でログインできる。
- 新規登録の確認コードは `000000` で固定されている。
- 状態を変えるテストは、テストの中で `createAccount` で作ったアカウントだけを使う。

## Replay Cache

`agent` の手順の記録は `.e2e/cache/` に保存され、次の実行から再生される。
ローカルの記録は commit しない。
CI の記録は GitHub Actions の cache に置かれる。
