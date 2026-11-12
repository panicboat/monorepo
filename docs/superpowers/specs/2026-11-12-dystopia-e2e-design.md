# Dystopia E2E Test Design

Issue: #1992

## Intent

dystopia はある程度の機能がそろい、これからも機能の追加と画面の作り替えが続く。
そのときに「誰に何が見えるか・誰が何をできるか」の線引きを、気づかずに壊すことを防ぎたい。
unit spec は個々の判定を確かめるが、画面までつないだときの漏れや隠れすぎは通り抜ける（過去の dogfood で、unit spec を通った本番の不具合が見つかっている）。
monolith・frontend・DB をつないだ状態でブラウザから操作し、線引きを確かめる e2e テストを用意する。
画面を作り替えてもテストを直す手間が小さく済むことを重視する。

## Goals

- GitHub Actions の定期実行と手動実行で、e2e テストが CI の中で完結して回る。
- 最初の版で、次の線引きを確かめる。
  - ログイン
  - 投稿の閲覧できる範囲（公開・鍵・時間限定）
  - フォロー（申請と承認）とブロック
  - プロフィールの鍵と、他人から見えるか
  - カルテ（キャストだけが見られる・書ける）
  - クチコミ（ゲストだけが書ける・閲覧の範囲・鍵付きのゲストの名前）
- ボタンの名前や操作の手順が変わっても、操作の部分は人が直さずに通り続ける。
- 線引きを壊したら、テストが落ちる。

## Non-goals

- PR ごとの実行はしない。
  - 定期実行と手動実行で始めると、ユーザーが判断した。
- 本番や develop 環境に向けては流さない。
  - CI の中で立ち上げた使い捨ての環境だけに流す。
- 次の機能は最初の版に入れない。
  - メッセージ、通知、足跡、ブックマーク、検索、予定、通報
  - 範囲に入れた機能のうち、画像や動画の添付が絡む部分
    - CI に S3 がないため。
  - 後回しにした機能は、最初の版の形が固まってから同じやり方で足す。
- 見た目（レイアウト・色）の確認はしない。

## Anti-goals

- 「見えない」ことの確認が、画面の読み込み前や表示の失敗で誤って通ること。
- 「見えない」「できない」の判定をモデルに任せること。
- テストが実行の順番や、前の実行が残したデータに依存すること。
- 画面を変えるたびに、テストの操作部分を人が直す必要があること。

## Current State

- CI でテストを実行する workflow はまだない（`.github/workflows` に rspec・vitest を呼ぶものがない）。
- frontend には偽の Cognito がある（`COGNITO_ADAPTER=fake`、`dystopia/frontend/src/lib/cognito/fake.ts`）。
  - seed の 10 アカウントに `+819000000101`〜`+819000000110`、パスワード `password` でログインできる。
    - 101〜103 がキャスト、104〜107 がゲスト、108 が退会済みのゲスト、109・110 がオンボーディング途中のキャストとゲスト。
  - 新規登録の確認コードは `000000` で固定。
  - 偽 Cognito のユーザーは frontend のプロセスのメモリにだけある。
- monolith も Cognito を呼ぶが、最初の版の範囲の操作では呼ばれない。
  - monolith の Cognito の呼び出しは、退会後の削除処理・未完了の登録の掃除・`ReleaseIncompleteSignUp` RPC だけにある（`dystopia/monolith/slices/identity/use_cases/account/`）。
  - `ReleaseIncompleteSignUp` RPC を呼ぶのは frontend の本物の Cognito の adapter で、偽 Cognito は自分のメモリで処理する（`dystopia/frontend/src/lib/cognito/fake.ts`）。
  - `bin/grpc` は `HANAMI_ENV=production` を固定するので、monolith は本物の Cognito の adapter を選ぶ（`dystopia/monolith/lib/cognito.rb`）。
    - adapter は最初の呼び出しで作られるので、呼ばれなければ AWS には触れない。
- monolith の seed（`dystopia/monolith/config/db/seeds.rb`）は、アカウント・プロフィール・フォロー・ブロック・投稿・カルテ・クチコミなどを固定の ID で入れる。
- 手元での起動手順は確立している。
  - 使い捨ての DB に migrate と seed を入れ、`bin/grpc` と frontend を起動する。
  - `bin/grpc` は `HANAMI_ENV=production` と `RACK_ENV=production` を自分で設定するので、`.env` と `.env.test` を export してから起動する。
  - frontend は `next build` と `next start` に `INSECURE_COOKIES=true` を付けると、http でも cookie が保存される（`dystopia/frontend/src/lib/auth/cookies.ts`）。
  - ブラウザは `127.0.0.1` ではなく `localhost` で開く。
    - next dev は `127.0.0.1` からの開発用リソースを遮断し、hydration されない。
- 仕様は `dystopia/docs/features/*.md` の Rules の節に書かれている。
  - `posts.md` の「閲覧できる範囲」「時間限定投稿」、`follows-and-blocks.md` の「フォロー」「申請と承認」「ブロック」、`profiles.md` の「鍵とフォローの承認制」「他人から見えるか」、`karte.md` の Rules、`reviews.md` の「作成」「閲覧」「鍵付きのゲストの名前」が最初の版の範囲に当たる。
- GitHub Actions から Bedrock を呼ぶロールは master アカウントにある。
  - `github-oidc-auth-master-github-actions-claude-code-role` が、`environment:claude-code-action` の subject だけを信頼している（platform リポジトリの `aws/github-oidc-auth/master/env.hcl`）。
  - 使えるモデルは Haiku 4.5 と Sonnet 4.6（同じ `env.hcl` の `claude_code_bedrock_models`）。

## Design

### Tool

- テストは e2e-inc/e2e（npm の `e2e` と `@e2e-dev/web`）で書く。
  - 画面を作り替えても操作の部分が壊れにくいことを、ユーザーが重視した。
  - 中身は Playwright の上に乗ったランナーで、locator と `expect` で書いた部分はモデルを呼ばない。
  - 1.0 前で、minor release の間で API と設定が変わりうる。
    - Renovate の更新で書き直しが入ることを受け入れる。
- 追加する依存は次のとおり。
  - `e2e`、`@e2e-dev/web`、`ai`、`@ai-sdk/amazon-bedrock`
- telemetry は `E2E_TELEMETRY_DISABLED=1` で止める。

### Writing Tests

- 操作（ログイン後の画面遷移、投稿、フォロー、ブロック、鍵の切り替え、カルテやクチコミを書く）は `agent.act` で書く。
  - ボタンの名前や手順が変わっても、agent が今の画面から目的を達成する操作を探し直す。
- 確認は `expect` と locator で書く。
  - 判定の対象は、画面の作りに依存しない「seed やテストで作った投稿本文・ユーザー名が画面にあるか・ないか」にする。
  - `agent.assert` は線引きの判定に使わない。
- 「見えない」ことの確認は、同じ画面で「見えるはずのもの」が表示されたことを先に確かめてから行う。
  - 読み込み前や表示の失敗で、ないことの確認が誤って通るのを防ぐため。
- 各テストは、`dystopia/docs/features/*.md` の Rules の 1 項目に対応させ、テスト名から対応する項目が分かるようにする。
  - 仕様を変えたときに、どのテストを直すかを追えるようにするため。
- テストファイルは仕様書と同じ単位（投稿・フォローとブロック・プロフィール・カルテ・クチコミ・ログイン）で分ける。

### Test Data

- CI の実行ごとに、空の DB に migrate と seed を入れる。
- 状態を変えないテスト（閲覧の範囲を確かめるだけのテスト）は、seed のアカウントとデータを使う。
- 状態を変えるテスト（フォロー・ブロック・鍵の切り替え・カルテやクチコミの作成）は、そのテストの中で新しいアカウントを作って使う。
  - 他のテストが使う seed の関係を変えないため。
  - アカウントの作成とオンボーディングは、モデルを呼ばない手順（locator での操作、または frontend の API route の呼び出し）で行う。
- 実行のたびに変わる値（新しいアカウントの電話番号・ユーザー名・投稿本文）を `agent.act` の指示に入れるときは、e2e の `unique()` か params で渡す。
  - 指示の文字列が変わると、記録の再生が毎回外れるため。
- テストは実行の順番に依存しない。

### Replay Cache

- `agent.act` の操作の記録は、GitHub Actions の cache に置く。
  - 記録を人がレビューせず CI が自動で更新していく形で、ユーザーが合意した。
- CI では e2e の設定を `cache: 'read-write'` にし、`E2E_CACHE_DIR` を runner 上のディレクトリに向ける。
- 実行前に `actions/cache/restore` で最新の記録を戻し、実行後に `actions/cache/save` で保存する。
  - cache のキーは上書きできないので、run ごとに新しいキー（`run_id` と `run_attempt` を含む）で保存し、prefix の一致で最新を戻す。
  - 保存はテストが落ちても行う（`if: ${{ !cancelled() }}`）。
    - e2e は、落ちた試行でも確かめ終えたステップの記録を残し、壊れた記録を消すため。
- 記録が再生できなくなったとき（画面の変更）は、agent が引き継いで操作し、そのあとの確認が通れば新しい記録が保存される。
- 記録のキーには project id と app の identity が入るので、`projectId` を設定で固定する。
- `--strict-cache` は使わない。
- GitHub の cache は 7 日間アクセスがないと消える。
  - 定期実行が毎日あるので保たれる。
  - 消えた場合は全部の操作が agent の実行になり、モデルの呼び出しが増えるだけでテストは通る。

### Model

- `agent.act` は Bedrock の Claude を使う。
- 認証は GitHub Actions の OIDC で master アカウントのロールを引き受ける。
- 既存のロールは `environment:claude-code-action` の subject だけを信頼しているので、e2e 用の GitHub environment を新設し、その subject を platform リポジトリで追加する。
  - `claude-code-action` の流用ではなく専用の environment にすると、ユーザーが選んだ。
  - platform の PR を先に出して apply し、それまで e2e の workflow は Bedrock の認証で落ちる。

### CI Workflow

- `.github/workflows/` に dystopia の e2e 用の workflow を 1 つ追加する。
- 起動は `schedule`（毎日 1 回）と `workflow_dispatch`。
- `concurrency` で同時に 1 本だけ走らせ、走っている実行は取り消さない。
  - 定期実行と手動実行が重なると、記録の保存が上書きし合うため。
- 1 つの job の中で次の順に進める。
  1. PostgreSQL を service container で起動する（`dystopia/monolith/docker-compose.yaml` と同じイメージ）。
  2. monolith の DB を作り、migrate と seed を入れる。
  3. monolith を `bin/grpc` で background に起動する。
  4. frontend を `next build` し、`COGNITO_ADAPTER=fake`・`MONOLITH_URL`・`INSECURE_COOKIES=true` を付けて `next start` で background に起動する。
  5. 両方が応答するまで待つ。
  6. Chromium を `e2e-web install chromium --with-deps` で入れる。
  7. 記録を戻し、e2e を実行し、記録を保存する。
  8. e2e のレポート（`.e2e/report.json`・`.e2e/junit.xml`・`.e2e/results`）と、monolith・frontend のログを artifact に上げる。
- background で起動した monolith と frontend は、job の終了で runner ごと止まる。
  - 完了を待つのは e2e の実行で、エラーは e2e のレポートと、artifact に上げた monolith・frontend のログに届く。
- 定期実行が落ちたことは、GitHub の workflow 失敗の通知で知る。
- 手動実行は、どのブランチからでも行える。
  - GitHub の cache は、main で保存したものをどのブランチからも読めるが、他のブランチで保存したものは main から読めない。
  - そのため、他のブランチの手動実行は main の記録を使い、そこで保存した記録は main の定期実行には引き継がれない。
  - 定期実行は main で走るので、main の記録は定期実行が育てる。

## Decisions by the Designer

ユーザーと合意していない、私の判断で決めた点。

- 置き場所は `dystopia/e2e/` にし、frontend とは別の pnpm パッケージにする。
  - e2e の依存を frontend の build に入れないため。
- 定期実行は毎日 1 回、日本時間の深夜にする。
- モデルは Sonnet 4.6 にする。
  - 記録の再生でほとんどのステップはモデルを呼ばず、画面の変更後の引き継ぎで操作を探し直す精度を優先する。
- ブラウザの画面サイズは 390×844 で固定する。
  - 利用者は主にスマートフォンで使う。
  - e2e は記録と違う画面サイズでは再生できない（`viewport-changed`）。
- 失敗の通知は GitHub の既定の通知だけにし、Slack などには送らない。

## Left to the Builder

- 各仕様書の Rules の項目を、どの視点（本人・フォロワー・フォローしていない人・ブロックした人とされた人・キャストとゲスト）で何ケース確かめるか。
- 状態を変えるテストで使う、アカウント作成とオンボーディングの手順の実装方法（locator か API route か）。
- workflow のファイル名、GitHub environment の名前、Node・Ruby のバージョンの取り方。
- frontend と monolith を起動したあとの待ち方。
- `dystopia/{service}` を見る label-base-deploy の判定が、`dystopia/e2e/` をデプロイ対象として拾わないことの確認と、拾う場合の対処。
- e2e のステップの予算（時間・モデルの呼び出し回数）の設定。
- 最初の版の完成時に、範囲の各機能で線引きを 1 か所わざと壊してテストが落ちることを手元で確かめる。
