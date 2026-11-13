# Dystopia E2E Coverage Design

## Intent

dystopia の e2e テスト（`dystopia/e2e/`、[前回の設計](2026-11-12-dystopia-e2e-design.md)）は、ログイン・投稿・フォローとブロック・プロフィール・カルテ・クチコミの線引きを確かめている。
前回見送った機能のうち、ユーザーが「壊れたら困る」と挙げたメッセージ・通知・検索・予定・メディア添付にも、同じ網を広げる。
守りたいのは機能が動くことではなく、「誰に何が見えるか・誰が何をできるか」の線引きだと、ユーザーが答えた。
メディア添付には S3 が要るので、CI の中で aws/aws-emulator を S3 の代わりに立てる。
S3 に aws-emulator を使うことは、ユーザーが指定した。

## Goals

- 次の線引きを、前回と同じやり方（`agent.act` で操作、locator の `expect` で確認）で確かめる。
  - メッセージ
    - どちらか一方でもブロックしていると、送れない。
      - 既存のメッセージは読める。
    - ゲストは、承認済みのフォロー先にしか送れない。
    - キャストは、フォローしていない相手にも送れる。
  - 通知（アプリ内の一覧）
    - 受信者が発火者をブロックしていると、通知が出ない。
    - 発火者が受信者をブロックしていても、通知は止まらない。
    - メンションされても、その投稿を閲覧できないプロフィールには通知が出ない。
  - 検索
    - ブロック関係にある相手の投稿と予定は、検索に出ない。
      - ユーザー検索には出る。
    - 鍵付きのキャストは、鍵を通れない閲覧者の予定検索に出ない。
      - ユーザー検索には出る。
    - 公開範囲がフォロワー限定の投稿は、承認済みのフォロワーが検索しても出ない。
  - 予定
    - 鍵付きのキャストの予定タブは、鍵を通れない閲覧者には内容の代わりに「フォローすると見られます」と伝える。
    - ブロック関係にあると、予定タブは空になり、案内も出ない。
    - ゲストには予定タブがなく、予定を登録できない。
  - メディア添付
    - 投稿に添付した画像は、その投稿を閲覧できる人に表示される。
    - 投稿を閲覧できない人には、画像も出ない。
    - 画面からのアップロードと表示が、S3 の署名付き URL を通して動く。
      - 線引きではないが、上の 2 つを確かめる前提として含める。
- 定期実行と手動実行の workflow を、そのまま使い続ける。

## Non-goals

- 足跡・ブックマーク・通報は今回も入れない。
  - ユーザーが壊れたら困る機能として挙げなかった。
- Web Push は確かめない。
  - CI のブラウザは Push サービスの購読を作れない。
- 動画、アバター・カバー画像、クチコミの出来事の添付は確かめない。
  - S3 を通る経路は投稿の画像と同じで、線引きの判定はそれぞれの機能で確かめ済みのため。
- メディアの削除と、S3 のオブジェクトのタグ・掃除は確かめない。
  - 利用者の画面に出る線引きではないため。
- aws-emulator で S3 の権限（バケットポリシー・署名の期限）を確かめない。
  - aws-emulator は自分の鍵で署名したリクエストを拒否せず、権限の検証には使えないと公式に書いている。

## Anti-goals

- 前回の設計の Anti-goals をそのまま引き継ぐ。
  - 「見えない」ことの確認が、画面の読み込み前や表示の失敗で誤って通ること。
  - 「見えない」「できない」の判定をモデルに任せること。
  - テストが実行の順番や、前の実行が残したデータに依存すること。
  - 画面を変えるたびに、テストの操作部分を人が直す必要があること。
- e2e のために monolith や frontend の製品コードを変えること。
- monolith や e2e が、本物の AWS の S3 に触れること。

## Current State

- e2e は `dystopia/e2e/` にあり、24 件のテストが CI で通っている。
  - 起動は `dystopia/e2e/bin/stack up|down`（DB の作り直し・seed・monolith・frontend）。
  - workflow は `.github/workflows/dystopia-e2e.yaml`（毎日 1 回と手動、記録は GitHub Actions の cache）。
  - 書き方の約束は `dystopia/e2e/README.md` の Writing Tests にある。
- `bin/grpc` は `HANAMI_ENV=production` を固定するので、monolith のメディアは S3 の adapter（`dystopia/monolith/lib/storage/s3_adapter.rb`）を通る。
  - adapter は `MEDIA_BUCKET_NAME` と `MEDIA_BUCKET_REGION` を読み、`Aws::S3::Client` を接続先の指定なしで作る。
  - そのため今の e2e の stack では、アップロード URL の発行が失敗する。
- frontend は、monolith が発行した署名付き URL へブラウザから `fetch` で PUT する（`dystopia/frontend/src/modules/profile/hooks/useMediaUpload.ts`）。
  - 表示は、投稿などを返すときに monolith が付けた署名付きの GET の URL を、画像の要素がそのまま読む。
  - frontend に Content Security Policy の設定はない。
- monolith の `aws-sdk-core` は 3.268.0 で、`AWS_ENDPOINT_URL` を読んで接続先を変える。
- seed には、ブロック（りん → たろう）、予定、メッセージのスレッド、通知の行がある（`dystopia/monolith/config/db/seeds/`）。
- 仕様は `dystopia/docs/features/` の `messages.md`（送信条件）、`notifications.md`（通知の種類の「発火しない条件」）、`search.md`（検索結果に出ない条件）、`schedules.md`（予定の見え方）、`media.md`（Rules）にある。

### aws-emulator

2026-11-13 に v1.0.336 を Docker で動かして確かめた。

- ブラウザから別のサイト経由で届いたリクエストを、意図的に拒否する。
  - `Origin` ヘッダー、または `same-origin` 以外の `Sec-Fetch-Site` ヘッダーが付いたリクエストは、403 の「Requests a browser sends from another site are refused」になる。
  - `--auth off` でも同じ。
- CORS の事前確認（`OPTIONS`）は 501（未実装）を返す。
- そのため、画面から署名付き URL への PUT も、画像の要素での表示も、そのままでは失敗する。
- monolith の Ruby SDK からのバケット作成・CORS 設定・署名付き URL の発行・タグ付けは通る。
  - ブラウザのヘッダーを付けない PUT と GET も通る。
- 署名は、リクエストの `Host` ヘッダーで検証される。
  - 接続先を中継のアドレスにして署名した URL は、中継がブラウザのヘッダーを外して転送すると検証を通る。
  - Chromium で `http://localhost:3055` のページから確かめた。
    - 中継への `fetch` の PUT は、CORS の事前確認を経て 200 になった。
    - 中継を指す署名付きの GET の URL を画像の要素に入れると、読み込みが完了した。
    - emulator の認証は有効のままだった。
- 起動のたびに新しいアクセスキーと証明書を `~/.aws/emulator/<port>/` に書き、停止で消す。
  - 状態はメモリにだけあり、停止で消える。
- 配布は `downloads.aws.com` の Linux のパッケージ（Debian・RPM）だけで、macOS では公式の Dockerfile からイメージを作って動かす。
  - 版を指定したパッケージは `https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/aws-emulator_<version>-1_amd64.deb`（RPM は `aws-emulator-<version>-1-<arch>.rpm`）から取れる。
  - 公式は、新しい版で結果が変わる場合は版を固定し、試してから上げるよう勧めている。
- telemetry は既定で有効で、`--telemetry off` で止まる。

### e2e File Upload

- e2e の agent は、ファイル入力にファイルを添付できる（`e2e/dist/agent/upload-paths.d.ts`）。
  - 添付できるのはプロジェクトのルートの下にある通常のファイルだけ。

## Design

### S3 on aws-emulator

- `bin/stack up` が aws-emulator を起動し、`down` が止める。
  - CI（Linux）は Debian パッケージを入れて直接起動する。
  - 手元（macOS）は、公式の Dockerfile から作ったイメージを Docker で起動する。
  - CI と手元で同じ版を使い、版は 1 か所で固定する。
    - Debian パッケージと Dockerfile の RPM は、どちらも版を指定した URL から取る。
  - 版の更新は Renovate で受ける。
    - `.github/renovate.json` の regex の custom manager で、aws/aws-emulator の GitHub release を追う。
  - どちらも `127.0.0.1` だけで待ち受け、`--telemetry off` を付ける。
  - 認証は有効のままにし、monolith は emulator が書いたアクセスキーで署名する。
- emulator の前に、ブラウザのリクエストを受ける中継を置く。
  - `dystopia/e2e` の中の小さな Node のスクリプトにする。
  - CORS の事前確認には、frontend の origin を許す応答を中継自身が返す。
  - それ以外のリクエストは、`Origin`・`Referer`・`Sec-Fetch-*` を外して emulator に転送し、応答に CORS のヘッダーを足す。
  - `Host` ヘッダーは書き換えない。
  - 中継は http で待ち受ける。
    - ブラウザと monolith に emulator の証明書を信頼させる設定が要らなくなるため。
- monolith の S3 の接続先を中継に向ける。
  - `bin/stack` が monolith の起動時に、`AWS_ENDPOINT_URL`・emulator のアクセスキーのファイル・`MEDIA_BUCKET_NAME`・`MEDIA_BUCKET_REGION` を渡す。
  - 本物の AWS の認証情報の環境変数は、monolith に渡さない。
  - region は emulator の既定（`us-east-1`）に合わせる。
- `bin/stack up` が、monolith の起動前にバケットを作る。
  - バケットの CORS は中継が引き受けるので、emulator には設定しない。
- `down` と起動失敗時の後始末で、中継と emulator も止める。
  - 起動したプロセスは、monolith・frontend と同じく PID ファイルで追う。
- CI の workflow では、`Start the stack` は Bedrock の認証より前にあるので、monolith に Bedrock の認証情報は渡らない。
  - この順番を保つ。

### Tests

- テストファイルは仕様書と同じ単位で足す（メッセージ・通知・検索・予定・メディア）。
- 前回の設計の Writing Tests と Test Data の約束に従う。
  - 状態を変えるテスト（メッセージの送信・ブロック・フォロー・投稿・予定の登録・画像の添付）は、そのテストの中で作ったアカウントを使う。
  - 「見えない」「送れない」の確認は、同じ画面で「見えるはず」「できるはず」のものを先に確かめてから行う。
- 「出ない」「できない」のテストは、確かめたい規則を外したときに落ちる組み立てにする。
  - 別の規則で先に止まって通るテストは、確かめたい規則を守らない。
  - 例: 受信者が発火者をブロックしていると、いいね・フォロー・投稿でのメンションは、ブロックによる閲覧やフォローの制限で先に止まる。
    - 通知のブロックの判定を確かめるには、その制限を受けない経路で発火させる（第三者の投稿へのコメントでのメンションなど。`add_comment.rb` は閲覧の可否を判定しない）。
- 通知の確認は、アプリ内の通知一覧に、発火者の名前と種類が出るか・出ないかで行う。
- 「ゲストは予定を登録できない」は、画面に予定タブと作成メニューの「予定」が出ないことで確かめる。
  - サーバーの拒否は rspec が確かめる。
    - カルテと同じく、画面が先に入口を隠すため、ブラウザの操作ではサーバーまで届かない。
- メディアの確認は、画像が実際に読み込まれたこと（画像の要素の読み込みの完了）まで確かめる。
  - 画像の要素があるだけでは、署名付き URL の取得に失敗していても通ってしまうため。
- 画像の添付も `agent.act` で行い、テスト用の小さな画像ファイルを `dystopia/e2e` に置く。

### CI Workflow

- 既存の `.github/workflows/dystopia-e2e.yaml` に、aws-emulator のパッケージを入れる step を足す。
  - インストールは `Start the stack` の前に行う。
- 新しい操作の記録は、merge 後の最初の定期実行または手動実行で作られる。
  - その 1 回だけ、新しい操作の分の Bedrock の呼び出しが増える。

## Decisions by the Designer

ユーザーと合意していない、私の判断で決めた点。

- aws-emulator の前に中継を置く。
  - 開発用の保存先（`Storage::LocalAdapter`）に切り替える案は、`bin/grpc` が本番の設定を固定するため製品コードの変更が要り、採らなかった。
  - 別の S3 互換ツールに替える案は、aws-emulator の指定に反するため採らなかった。
- aws-emulator の認証は有効のままにする。
  - 公式の案内が有効を勧めており、中継を置いても署名の検証は通る。
- aws-emulator の版は固定し、Renovate で上げる。
  - latest を毎回入れると、e2e のコードが変わらないまま定期実行が落ちうる。
  - 公式は最新の版にだけ修正を出すので、Renovate で追いつく。
- メディアの線引きは投稿の画像だけで確かめる。
- 「ゲストは予定を登録できない」は画面だけで確かめ、サーバーの拒否は rspec に任せる。

## Left to the Builder

- 各線引きを、どの視点（本人・フォロワー・フォローしていない人・ブロックした人とされた人・キャストとゲスト）で何ケース確かめるか。
- 中継と emulator のポート、中継のスクリプトの置き場所、Dockerfile の置き場所。
- 手元で Docker が動いていないときの `bin/stack up` の失敗のさせ方。
- 予定と検索のテストで、日付に依存しない予定の作り方（テストの中で今日以降の予定を登録するか、seed の予定を使うか）。
- 通知の一覧への反映を待つ方法。
- 完成時に、範囲の各機能で線引きを 1 か所わざと壊してテストが落ちることを手元で確かめる。
