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
そこで media slice だけを Rust で作り直して本番で動かし、実測してから先を決める。

試作の後の進め方は、試作の結果を見てユーザーが次のどれかに決める。

- 全部を書き直して一度に切り替える。
- slice ごとに少しずつ移す。
- Rust に移さない。

## Goals

- media slice の機能を、Rust の gRPC サーバーが本番の Lambda で提供する。
  - 利用者から見た挙動は [メディア](../../../dystopia/docs/features/media.md) の仕様のまま変えない。
- Ruby の media slice のコードを消し、media の実装が Rust だけにある状態にする。
- 先を決めるための測定値を集め、報告にまとめる（Measurements）。
- どちらの進め方に決まっても、試作の Rust サーバーをそのまま最初の一歩として使える置き場と構成にする。

## Non-goals

- media 以外の slice を Rust に移さない。
- DB の migration を Rust に移さない。
  - migration は今までどおり Hanami が持ち、Rust は既存の表を読み書きするだけにする。
- Ruby の GC を RPC ごとに記録する計測はしない。
  - 応答時間のぶれは、media の RPC の Ruby と Rust の比較で見る。
- RPC の約 5% が約 1 秒かかる、未解明の遅延の調査はしない。
- 本番の Lambda で OpenTelemetry を有効にしない。
- EKS 用の manifest（`dystopia/frontend/kubernetes`・`dystopia/monolith/kubernetes`・`clusters/production/dystopia`）は変えない。
  - 今は Lambda だけで動いているため、ユーザーが判断した。
  - 試作の間、EKS の構成では media が動かない。
  - 続けると決めたときに、EKS 用にも Rust のサーバーを足す。

## Anti-goals

- 利用者から見た media の挙動が変わること。
  - 特に、キーの形・配信 URL の署名時刻と有効期限・削除で行を残す条件・タグを付けてから行を作る順序。
- 「メディアを ID で取得する API はない」という仕様が崩れること。
  - Ruby から呼ぶための内部用の RPC が、ブラウザから届く経路に出ること。
- 同じ処理が Ruby と Rust の両方に残ること。
- 試作をやめるときに、戻す手順が revert 以外に要ること。

## Constraints

- 本番は frontend（Next.js）と monolith を 1 つの Lambda コンテナに同居させている（[dystopia/lambda](../../../dystopia/lambda/README.md)）。
  - Rust のサーバーも同じコンテナに入れる。
  - gRPC は `127.0.0.1` で待ち受け、コンテナの外には出さない。
  - Lambda の Runtime API が `127.0.0.1:9001` を使い、Ruby の gRPC が 50051 を使う。
  - メモリの 1024 MB を Next.js・Ruby・Rust で分け合う。
  - `image/start` は、起動したプロセスのどれかが終われば全体を終わらせる。
- アカウントの削除処理は task 用の Lambda（`image/task.mjs`）で `rake account:purge_deactivated` として動く。
  - プロフィールの削除の中で media の削除を呼ぶので、task 用の Lambda にも Rust のサーバーが要る。
- イメージは CI の `ubuntu-26.04-arm` で `linux/arm64` として作る（`.github/workflows/deploy-dystopia-lambda.yaml`）。
- 外向きの通信は IPv6 と S3 の gateway endpoint だけ。
  - Rust の AWS SDK も、今の Ruby と同じ経路で S3 に届く必要がある。
- 開発と test では S3 を使わず、Ruby の `Storage::LocalAdapter` が `APP_URL` の `/storage/upload` と `/uploads` の URL を返す。
  - アップロードの受け取りと配信は、Ruby の `lib/middleware/local_uploader.rb` と `Rack::Static` が行う。
- frontend は `src/lib/grpc.ts` の 1 つの transport（`MONOLITH_URL`）で全 service の client を作っている。
- slice をまたぐ呼び出しは、同じプロセスの中で `X::Slice["..."]` を呼んでいる。
  - media は他の slice を呼ばない。
  - media を呼ぶのは次の 4 か所。
    - `post/adapters/media_adapter.rb`
    - `profile/adapters/media_adapter.rb`
    - `review/adapters/media_adapter.rb`
    - `profile/use_cases/purge_profile.rb`
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
  - 合わなければ revert で戻し、損は 1 slice 分で済む。

試作する slice には media を選んだ。

- 16 slice の中で唯一、他の slice を呼ばない。
- 呼ばれる側の入口は、ほぼ各 slice の `media_adapter.rb` にまとまっている。
- S3 の署名付き URL・タグ・一括削除を使うので、Rust の AWS SDK の使い勝手も確かめられる。
- bookmarks も候補だったが、一覧で post slice の投稿の組み立てを呼んでおり、Ruby 側に新しく内部用の RPC を作る必要があるので外した。

## Design

### Layout

- Rust のサーバーは `dystopia/server` に置く。
  - Cargo のプロジェクトで、1 つのバイナリが gRPC サーバーになる。
  - slice ごとにモジュールを分け、Ruby の slice と同じ名前にする（最初は `media` だけ）。
  - 名前は私の判断で、移行が進んでも中身と合う名前にした。
- proto は今の `proto/dystopia/media/v1/` を使い、Rust のコードは build 時に生成する。

### Public RPC

- `media.v1.MediaService` の 3 つの RPC（`GetUploadUrl`・`RegisterMedia`・`DeleteMedia`）を Rust が提供する。
- エラーの gRPC status、`error-reason` metadata、応答の各項目は、今の Ruby の handler と同じにする。
  - 仕様は [メディア](../../../dystopia/docs/features/media.md) の Rules と Lifecycle。
  - 細かい挙動は、Ruby の `spec/slices/media/` の spec が正解になる。

### Internal RPC

- Ruby から呼ぶための内部用の service を、新しい proto として定義する。
  - 例: `media.v1.MediaInternalService`。
  - RPC は今の同じプロセス内の呼び出しに 1 対 1 で対応させる。
    - `GetMediaBatch`: ID の一覧から、配信 URL 付きのメディアを返す。
    - `SelectOwnedMediaIds`: ID の一覧のうち、指定したプロフィールがアップロードしたものを返す。
    - `DiscardMedia`: ID の一覧のメディアのファイルと行を消す。
    - `PurgeProfile`: プロフィールのファイルと行を全部消し、1 つでも消せなければエラーを返す。
- frontend はこの service の client を作らない。
  - ブラウザから届く経路は Next.js の API route だけなので、client が無ければ届かない。
  - 「メディアを ID で取得する API はない」という仕様を守るため。
- 内部用の RPC は認証の metadata を求めない。
  - `127.0.0.1` でしか待ち受けないため。

### Authentication

- Rust のサーバーに、今の `AuthenticationInterceptor` と同じ判定を作る。
  - `x-user-id` があればアカウントとする。
  - `x-profile-id` が空なら、そのアカウントの表示できるプロフィールがちょうど 1 つのときだけ、それを使う。
  - `x-profile-id` があれば、表示できるプロフィールで、かつそのアカウントのものであるときだけ使う。
    - そうでなければ「使えないプロフィール」として扱う。
  - `authenticate_user!` と同じ順で `UNAUTHENTICATED`・`PERMISSION_DENIED`・`FAILED_PRECONDITION` を返し、`error-reason` を付ける。
- プロフィールの判定は、Rust から profile schema の表を直接読んで行う。
  - 「表示できる」の条件は `visible_profiles` の定義に合わせる。
  - 試作では profile slice の持ち物を Rust が読むことを許す。
    - 先の進め方が決まったときに、この判定の置き場を決め直す。

### Storage

- 本番では S3 を使い、今の `Storage::S3Adapter` と同じ挙動にする。
  - アップロード URL の有効期限は 5 分。
  - 配信 URL は毎時の境界時刻で署名し、有効期限は 2 時間。
  - 一括削除は 1,000 件ずつで、1 件でも失敗すれば失敗として返す。
  - タグを付けられなければ、オブジェクトが無いものとして扱う。
- 開発と test では、今の `LocalAdapter` と同じ形の URL を返し、ファイルは Ruby と同じ `public/uploads` の下で扱う。
  - アップロードの受け取りと配信は、今の Ruby の middleware に任せたままにする。
- どちらを使うかは環境変数で決める。

### Ruby side

- `slices/media/` と、media だけが使う Ruby のコード（`lib/storage` の S3 部分など）を消す。
  - 他の slice が `Storage` を使っていないかは、消す前に grep で確かめる。
- 4 か所の呼び出し元は、内部用の RPC を呼ぶ gRPC client に替える。
  - adapter の外から見た戻り値の形は変えない。
  - Rust に届かないときは例外にし、呼び出し元の RPC を失敗させる。
- `profile/use_cases/purge_profile.rb` の transaction は、media の削除を含まなくなる。
  - Rust の `PurgeProfile` は別の接続で commit するため。
  - 後の削除が失敗して rollback すると、media の行とファイルだけが消えた状態が残る。
  - 対策は設けない（私の判断）。
    - 今も S3 のファイルは transaction の外で消えている。
    - 各削除はやり直せて、profile の行が最後に消えるので、次の削除処理で最後まで進む。
    - 失敗が重なったときだけ起きる狭いケースのため。
- media の spec は Rust のテストに移し、Ruby からは消す。
- post・profile・review の spec のうち media を使うものは、内部用の RPC の client を偽物に差し替えて回す。

### Frontend

- `src/lib/grpc.ts` に Rust のサーバー向けの transport を足し、`mediaClient` だけをそれに向ける。
- 接続先は新しい環境変数で渡す。

### Lambda

- `image/Dockerfile` に Rust の build の段を足し、バイナリだけを runner にコピーする。
- `image/start` で Rust のサーバーも起動し、3 つのどれかが終われば全体を終わらせる。
- `image/task.mjs` は、`purge_deactivated` を実行する前に Rust のサーバーを起動し、終わったら止める。
- Rust のポートは 50051 と 9001 を避ける。
- Rust のサーバーも、Ruby の access log と同じ項目の JSON を 1 RPC 1 行で標準出力に出す。
  - `time`・`request_id`・`method`・`service`・`account_id`・`profile_id`・`duration_ms`・`status`。
  - CloudWatch Logs で Ruby と同じ問い合わせで比べられるようにするため。

### Local and CI

- `dystopia/e2e/bin/stack` で Rust のサーバーも起動・停止する。
- Rust の CI を足す。
  - `cargo fmt --check`・`cargo clippy`・`cargo test`（Postgres を使うテストを含む）。
- `.github/workflows/deploy-dystopia-lambda.yaml` の build で、Rust を含んだイメージを作る。

## Measurements

切り替えの前に Ruby の基準値を取り、切り替えの後に同じものを Rust で取る。
集めた値は報告にまとめ、ユーザーが先を決める材料にする。

- **AI に書かせた体感**
  - 実装したタスクの数と、レビューで戻した回数。
  - Rust で足した行数と、Ruby で消した行数。
  - ユーザーの所感（読みやすさ、レビューの負担）。
- **ビルド時間**
  - CI での Rust のビルドとテストの時間。
  - イメージのビルド時間の、切り替えの前後の差。
- **起動時間とメモリ**
  - Lambda の `REPORT` 行の `Init Duration` と `Max Memory Used` の、切り替えの前後の差。
  - Rust のサーバーが起動してから待ち受けを始めるまでの時間。
- **応答時間のぶれ**
  - ローカルで負荷をかけて比べる（ユーザーが判断した）。
    - 本番は seed の 10 アカウントだけで、media の RPC の件数が少なく、p99 や GC の停止が見えないため。
  - 同じ DB と同じデータに対して、切り替え前の Ruby と Rust に、gRPC の負荷ツールで同じ件数・同じ並列数の要求を送る。
  - 対象は `media.v1.MediaService.GetUploadUrl` とする。
    - 両方の実装にあり、S3 への通信がないため。
  - 応答時間の p50・p95・p99 と最大値、処理できた件数を比べる。
  - 負荷ツールを入れる前に、ユーザーに確認する。
- **gRPC を挟む費用**
  - 投稿・プロフィール・クチコミを返す RPC は、同じプロセスの呼び出しが gRPC 越しになる。
  - メディア付きの投稿の一覧を返す RPC に、同じ負荷ツールで切り替えの前後に同じ要求を送り、応答時間の差を見る。

## Left to the builder

- Rust の crate の選定と版（tonic・prost・sqlx・aws-sdk-s3 など）。
  - lockfile と実際の API を確かめてから使う。
- 内部用の service の proto の名前と、message の形。
- Rust のポートと、frontend・Ruby に渡す環境変数の名前。
- sqlx でコンパイル時に SQL を照合する場合の、CI での扱い。
- PR の分け方。
- Ruby の spec で使う偽物の client の作り方。
