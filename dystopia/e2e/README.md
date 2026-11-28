# dystopia e2e

dystopia の monolith と frontend をつないだ状態で、サーバーの判断がブラウザの画面まで届くかを確かめるテスト。
テストは e2e-inc/e2e（`e2e` と `@e2e-dev/web`）で書く。

## Scope

- e2e は、見せてはいけないものを見せないことと、させてはいけない操作をさせないことを確かめる。
  - 漏れたときの損害がいちばん大きく、本物のログインと通信を通さないと分からない壊れ方があるため。
    - monolith の rspec と frontend の vitest は相手の側を偽物に差し替えるので、使うプロフィールの取り違えのような、つなぎ目のずれを見つけられない。
- 仕様書（`dystopia/docs/features/`）が誰かに見せない・させないと定めるものは、それぞれ 1 回は e2e で確かめる。
  - サーバーが一覧から行を除くだけのものも含める。
  - 同じものが複数の画面に出るときは、どれか 1 つの画面で確かめる。
    - e2e は 1 本ごとに時間がかかるため。
- 個々の操作の権限（他人の投稿の削除など）は、monolith の rspec で確かめる。
  - どの API も同じ経路でログイン中のアカウントと使うプロフィールを確かめるので、e2e ではその経路を、別のアカウントのプロフィールとして送った要求が拒否されることで確かめる。
- 画面に出ないもの（同じアカウントのプロフィール同士の結びつきなど）は、e2e では確かめない。
- 見えるべきものが見えること・できるべき操作ができることは、壊れても利用者が気づけないものだけを確かめる。
  - 壊れて見えなくなったものは、使っている人が気づいて知らせるため。
  - 通知とメッセージは、届かなくても、送った人も受け取る人も気づけない。
- ログインと登録は、ほかのテストの土台として確かめる。

## Prerequisites

- PostgreSQL が `localhost:5432` で動いていて、ユーザー `postgres`・パスワード `password` で接続できること。
- rbenv の Ruby で、`dystopia/monolith` の `bundle install` が済んでいること。
- rustup が使え、`dystopia/server/rust-toolchain.toml` の版の Rust を入れられること。
- Node.js と pnpm が `package.json` の `packageManager` の版で使えること。

## Running Locally

`dystopia/e2e` で次の順に実行する。

```bash
env -u NODE_OPTIONS pnpm install --frozen-lockfile
export E2E_TELEMETRY_DISABLED=1
bin/stack up
env -u NODE_OPTIONS pnpm test
bin/stack down
```

初回の実行では、e2e が Chromium を取得する。
1 つのファイルだけを動かすときは `env -u NODE_OPTIONS pnpm exec e2e run tests/account.e2e.ts` のように渡す。

## Local Stack

`bin/stack up` は次を行い、サインインが通るようになってから戻る。

- 使い捨ての DB を作り直し、migrate と seed を入れる。
- monolith・`cargo build --release` した Rust の server・`next build` した frontend を固定のポートで起動する。
- frontend は偽の Cognito を使う。
- frontend は media の gRPC を server に向ける。

DB 名・ポート・ブラウザで開く URL は `bin/stack` と `e2e.config.ts` に書かれている。
別の URL に向けるときは `APP_URL` を設定する。

`bin/stack down` は `up` が起動したプロセスを止め、DB を消す。
ログと PID は `.e2e/stack/` に書かれる。
`up` が失敗したときは、3 つのログの末尾を出したうえで `down` と同じ後片付けをする。

## Test Data

- seed のアカウントの電話番号・ユーザー名・表示名と投稿本文は `tests/support/seed.ts` にまとめてある。
- seed のパスワードと新規登録の確認コードは `tests/support/session.ts` にある。
- 状態を変えるテストは、テストの中で `createAccount` で作ったアカウントだけを使う。

## Writing Tests

- 操作は locator で書き、`agent` は使わない。
  - `agent` はモデルを呼ぶので、記録を作るたびと、画面のラベルを変えて記録が外れるたびに費用がかかるため。
- `describe` の名前は `<仕様書のファイル名> / <節の見出し>`（例: `profiles.md / 他人から見えるか`）にする。
  - 仕様を変えたときに、直すテストを見出しから探せるようにするため。
- 「見えない」ことは `expectHiddenAfter` で、見えるはずのものが見えたあとに確かめる。
  - 読み込み前や表示の失敗で、ないことの確認が誤って通るのを防ぐため。
- 「見えない」ことを確かめる前に、同じテストの中で、見てよい人には同じものが見えることを確かめる。
  - 探す文言を書き間違えたり seed が変わったりしても、ないことの確認は通ってしまうため。
- プロフィールのタブの中を確かめるときは、`?tab=` を付けた URL でタブを直接開く。
  - 選ばれているタブの中身だけが描画されるため。
- 状態を変えるのは、`createAccount` で作ったアカウントだけにする。
  - seed の関係を変えると、他のテストの前提が崩れる。

## CI

`.github/workflows/dystopia-e2e.yaml` が、毎日の定期実行と手動実行で e2e を回す。

- 実行のたびに `bin/stack up` で DB を作り直し、seed を入れ直す。
  - テストが作るアカウントと投稿を、前の実行から持ち越さないため。
- 定期実行が落ちたら、run の artifact `dystopia-e2e` を見る。
  - `report.json` には、テストごとの結果が入っている。
  - `results/*/trace.md` には、落ちたテストの手順ごとの経過と失敗時の画面が入っている。
  - `stack/*.log` には、monolith・server・frontend のログが入っている。
- CI では e2e の既定どおり、落ちたテストを 1 回だけやり直す。
