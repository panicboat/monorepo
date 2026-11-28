# Dystopia Rust Media Pilot Design

Issue: #2092

## Intent

dystopia の monolith（Hanami 3 + gruf、Ruby 約 19,000 行・16 slice）を Rust に移すかを決めたい。
動機は次の 3 つ。

- 技術的な興味と、Rust の流行りに乗りたい。
- GC による処理の一時停止をなくし、応答時間のぶれを小さくしたい。
- 型を厳しくして、nil や型の取り違えを実行前に止めたい。

コードは主に AI エージェントが書き、ユーザーはレビューする。
書く速さが落ちる度合いと、GC がなくなる効果は、見積もりしかない。
そこで media slice の frontend 向けの RPC を Rust で作り、Ruby と並べて本番で動かし、実測してから先を決める。

試作の後の進め方は、試作の結果を見てユーザーが次のどれかに決める。

- 全部を書き直して一度に切り替える。
- slice ごとに少しずつ移す。
- Rust に移さない。

## Goals

- `media.v1.MediaService` の 3 つの RPC を、Rust の gRPC サーバーが本番の Lambda で提供する。
  - 利用者から見た挙動は [メディア](../../../dystopia/docs/features/media.md) の仕様のまま変えない。
- frontend の `mediaClient` の向き先を、環境変数で Ruby と Rust のどちらにも切り替えられる。
  - 環境変数が無ければ、今までどおり Ruby に向く。
- 先を決めるための測定値を集め、報告にまとめる（Measurements）。
- どちらの進め方に決まっても、試作の Rust サーバーをそのまま最初の一歩として使える置き場と構成にする。

## Non-goals

- Ruby の media slice を消さない。
  - post・profile・review とアカウントの削除処理からの呼び出しは、今までどおり Ruby の media を同じプロセスの中で呼ぶ。
- Ruby から Rust を gRPC で呼ぶつなぎ目は作らない。
  - つなぎ目が要るのは slice ごとに移す場合だけで、移し方が決まってから作る。
- media 以外の slice を Rust に移さない。
- DB の migration を Rust に移さない。
  - migration は今までどおり Hanami が持ち、Rust は既存の表を読み書きするだけにする。
- Ruby の GC を RPC ごとに記録する計測はしない。
  - 応答時間のぶれは、同じ RPC の Ruby と Rust の比較で見る。
- RPC の約 5% が約 1 秒かかる、未解明の遅延の調査はしない。
- 本番の Lambda で OpenTelemetry を有効にしない。
- EKS 用の manifest（`dystopia/frontend/kubernetes`・`dystopia/monolith/kubernetes`・`clusters/production/dystopia`）は変えない。
  - 環境変数が無ければ Ruby に向くので、EKS の構成はそのまま動く。

## Anti-goals

- 利用者から見た media の挙動が、Ruby と Rust のどちらに向けても変わること。
  - 特に、キーの形・配信 URL の署名時刻と有効期限・削除で行を残す条件・タグを付けてから行を作る順序。
- 試作を終えて先が決まった後も、同じ処理が Ruby と Rust の両方に残ること。
  - 続けるなら Ruby の media を、やめるなら Rust のサーバーを消す。
- 試作をやめるときに、戻す手順が環境変数の切り替え以外に要ること。

## Constraints

- 本番は frontend（Next.js）と monolith を 1 つの Lambda コンテナに同居させている（[dystopia/lambda](../../../dystopia/lambda/README.md)）。
  - Rust のサーバーも同じコンテナに入れる。
  - gRPC は `127.0.0.1` で待ち受け、コンテナの外には出さない。
  - Lambda の Runtime API が `127.0.0.1:9001` を使い、Ruby の gRPC が 50051 を使う。
  - メモリの 1024 MB を Next.js・Ruby・Rust で分け合う。
  - `image/start` は、起動したプロセスのどれかが終われば全体を終わらせる。
- イメージは CI の `ubuntu-26.04-arm` で `linux/arm64` として作る（`.github/workflows/deploy-dystopia-lambda.yaml`）。
- 外向きの通信は IPv6 と S3 の gateway endpoint だけ。
  - Rust の AWS SDK も、今の Ruby と同じ経路で S3 に届く必要がある。
- 開発と test では S3 を使わず、Ruby の `Storage::LocalAdapter` が `APP_URL` の `/storage/upload` と `/uploads` の URL を返す。
  - アップロードの受け取りと配信は、Ruby の `lib/middleware/local_uploader.rb` と `Rack::Static` が行う。
- frontend は `src/lib/grpc.ts` の 1 つの transport（`MONOLITH_URL`）で全 service の client を作っている。
- 認証は `lib/interceptors/authentication_interceptor.rb` が行う。
  - frontend が付ける `x-user-id`・`x-profile-id`・`x-request-id` を受け取る。
  - プロフィールは profile slice の `visible_profiles` から決める。
- monolith の検証はローカルの rspec が基準で、CI も rspec を回す（`.github/workflows/dystopia-monolith-test.yaml`）。

## Approaches

ユーザーと検討した進め方は次の 3 つ。

- **全部を書き直して一度に切り替える**
  - 2 つの言語が並ぶ期間がなく、最終形がきれいになる。
  - 切り替えるまで本番に何も出ず、途中で合わないと分かったときの損が一番大きい。
- **slice ごとに少しずつ移す**
  - 一歩ごとに本番で確かめられる。
  - 移し終えるまで 2 つの言語が並び、slice をまたぐ呼び出しを毎回 gRPC にする必要がある。
- **1 slice だけ試作してから、上の 2 つのどちらにするか決める**（採用）
  - 書く速さと GC の効果を、実測で決められる。
  - 合わなければ戻し、損は 1 slice 分で済む。

試作する slice には media を選んだ。

- 16 slice の中で唯一、他の slice を呼ばない。
- S3 の署名付き URL・タグ・削除を使うので、Rust の AWS SDK の使い勝手も確かめられる。
- bookmarks も候補だったが、一覧で post slice の投稿の組み立てを呼んでおり、Ruby 側に新しく内部用の RPC を作る必要があるので外した。

試作の間の Ruby の media の扱いは、次の 2 つから「残して並べる」を選んだ。

- **残して並べる**（採用）
  - Rust は frontend 向けの RPC だけを作り、frontend の向き先を環境変数で切り替える。
  - 内部用の RPC、各 slice の adapter の書き換え、task 用の Lambda の変更、プロフィール削除の transaction の扱いが要らない。
  - 同じビルドのまま、いつでも Ruby と Rust を比べ直せる。
  - 試作の間だけ、同じ処理が 2 か所にある。
- **消す**
  - media の実装を Rust だけにし、Ruby からは内部用の RPC で呼ぶ。
  - slice ごとに移す場合のつなぎ目も本番で確かめられるが、試作の範囲が大きくなる。

## Design

### Layout

- Rust のサーバーは `dystopia/server` に置く（私の判断）。
  - Cargo のプロジェクトで、1 つのバイナリが gRPC サーバーになる。
  - slice ごとにモジュールを分け、Ruby の slice と同じ名前にする（最初は `media` だけ）。
  - 移行が進んでも中身と合う名前にするため。
- proto は今の `proto/dystopia/media/v1/` を使い、Rust のコードは build 時に生成する。

### RPC

- `media.v1.MediaService` の 3 つの RPC（`GetUploadUrl`・`RegisterMedia`・`DeleteMedia`）を Rust が提供する。
- エラーの gRPC status、`error-reason` metadata、応答の各項目は、今の Ruby の handler と同じにする。
  - 仕様は [メディア](../../../dystopia/docs/features/media.md) の Rules と Lifecycle。
  - 細かい挙動は、Ruby の `spec/slices/media/` の spec が正解になる。
- Rust は `media.files` の表を Ruby と共有する。
  - Ruby と Rust のどちらが書いた行も、もう片方が読める形にする。

### Authentication

- Rust のサーバーに、今の `AuthenticationInterceptor` と同じ判定を作る。
  - `x-user-id` があればアカウントとする。
  - `x-profile-id` が空なら、そのアカウントの表示できるプロフィールがちょうど 1 つのときだけ、それを使う。
  - `x-profile-id` があれば、表示できるプロフィールで、かつそのアカウントのものであるときだけ使う。
    - そうでなければ「使えないプロフィール」として扱う。
  - `authenticate_user!` と同じ順で `UNAUTHENTICATED`・`PERMISSION_DENIED`・`FAILED_PRECONDITION` を返し、`error-reason` を付ける。
- プロフィールの判定は、Rust から profile schema の表を直接読んで行う（私の判断）。
  - 「表示できる」の条件は `visible_profiles` の定義に合わせる。
  - 試作では profile slice の持ち物を Rust が読むことを許す。
    - 先の進め方が決まったときに、この判定の置き場を決め直す。

### Storage

- 本番では S3 を使い、今の `Storage::S3Adapter` と同じ挙動にする。
  - アップロード URL の有効期限は 5 分。
  - 配信 URL は毎時の境界時刻で署名し、有効期限は 2 時間。
  - タグを付けられなければ、オブジェクトが無いものとして扱う。
  - 削除に失敗すれば、失敗として返す。
- 開発と test では、今の `LocalAdapter` と同じ形の URL を返し、ファイルは Ruby と同じ `public/uploads` の下で扱う。
  - アップロードの受け取りと配信は、今の Ruby の middleware に任せたままにする。
- どちらを使うかは環境変数で決める。

### Frontend

- `src/lib/grpc.ts` に Rust のサーバー向けの transport を足し、`mediaClient` だけを新しい環境変数で向け先を決める。
  - 環境変数が無ければ、`MONOLITH_URL` の transport を使う。

### Lambda

- `image/Dockerfile` に Rust の build の段を足し、バイナリだけを runner にコピーする。
- `image/start` で Rust のサーバーも起動し、3 つのどれかが終われば全体を終わらせる。
- Rust のポートは 50051 と 9001 を避ける。
- `aws/modules/lambda.tf` のアプリ用関数の環境変数で、`mediaClient` を Rust に向ける。
  - Ruby に戻すときは、この環境変数を外す。
- Rust のサーバーも、Ruby の access log と同じ項目の JSON を 1 RPC 1 行で標準出力に出す。
  - `time`・`request_id`・`method`・`service`・`account_id`・`profile_id`・`duration_ms`・`status`。
  - CloudWatch Logs で Ruby と同じ問い合わせで比べられるようにするため。

### Local and CI

- `dystopia/e2e/bin/stack` で Rust のサーバーも起動・停止し、e2e では `mediaClient` を Rust に向ける。
- Rust の CI を足す。
  - `cargo fmt --check`・`cargo clippy`・`cargo test`（Postgres を使うテストを含む）。
- `.github/workflows/deploy-dystopia-lambda.yaml` の build で、Rust を含んだイメージを作る。

## Measurements

集めた値は報告にまとめ、ユーザーが先を決める材料にする。

- **AI に書かせた体感**
  - 実装したタスクの数と、レビューで戻した回数。
  - Rust で書いた行数と、同じ機能の Ruby の行数（handler・use case・repository・presenter・storage）。
  - ユーザーの所感（読みやすさ、レビューの負担）。
- **ビルド時間**
  - CI での Rust のビルドとテストの時間。
  - イメージのビルド時間の、Rust を足す前後の差。
- **起動時間とメモリ**
  - Ruby と Rust のサーバーそれぞれの、起動してから待ち受けを始めるまでの時間と、待ち受け中の常駐メモリ。
  - Lambda の `REPORT` 行の `Init Duration` と `Max Memory Used` の、Rust を足す前後の差。
    - Ruby も起動し続けるので、この差は Rust を足した分の費用を表す。
- **応答時間のぶれ**
  - ローカルで負荷をかけて比べる（ユーザーが判断した）。
    - 本番は seed の 10 アカウントだけで、media の RPC の件数が少なく、p99 や GC の停止が見えないため。
  - 同じ DB と同じデータに対して、Ruby と Rust に、gRPC の負荷ツールで同じ件数・同じ並列数の要求を送る。
  - 対象は `media.v1.MediaService.GetUploadUrl` とする。
    - S3 への通信がなく、サーバーの処理だけを比べられるため。
  - 応答時間の p50・p95・p99 と最大値、処理できた件数を比べる。
  - 負荷ツールを入れる前に、ユーザーに確認する。

## Left to the builder

- Rust の crate の選定と版（tonic・prost・sqlx・aws-sdk-s3 など）。
  - lockfile と実際の API を確かめてから使う。
- Rust のポートと、frontend・Lambda に渡す環境変数の名前。
- sqlx でコンパイル時に SQL を照合する場合の、CI での扱い。
- PR の分け方。
