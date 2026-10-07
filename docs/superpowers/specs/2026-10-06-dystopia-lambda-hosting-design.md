# dystopia Lambda hosting design

## Context

dystopia は `eks-production` 上で運用する前提で作られているが、EKS は固定費が大きく、クラスタは既に撤去されている。production アカウント（337169763788）には default VPC しかなく、EKS・RDS・Cognito user pool・media バケットはいずれも存在しない。`dystopia/infrastructure` の Terraform state は空で、`workflow-config.yaml` は `environments: []` により CI のデプロイが止まっている。

本 spec は、EKS に戻すまでの間 dystopia を低い固定費で動かすための Lambda 構成を定める。EKS に戻す予定があるため、既存の EKS 向け資産は変更せず、Lambda 構成は別ディレクトリに追加する。

### Spike evidence

frontend と monolith を 1 つのコンテナに同居させた Lambda（arm64、VPC 内）を実環境で計測した。probe は fake adapter でのサインイン 1 回で、Next.js → gRPC `GetAccount` → RDS を通る。

| 項目 | 結果 |
|---|---|
| cold start の初回応答（1024 MB、23 回） | 4.3〜5.9 秒。Init Duration の中央値は 4.0 秒 |
| cold start の内訳 | Ruby の gRPC サーバー起動が約 3.9 秒、Next.js が約 1.3 秒 |
| warm 時の応答 | 55〜120ms |
| メモリ使用 | 最大 310 MB |
| 10 並列 | 10 環境が起動し、30 リクエスト全て 200 |
| 約 5 分半の放置後 | 凍結から復帰して全て 200。応答 220〜235ms |
| 15 分・30 分の放置後 | 環境が回収済みで cold start。全て 200 |

計測で判明した制約は次のとおり。

- Lambda の Runtime API が `127.0.0.1:9001` を使うため、monolith の gRPC 既定ポート 9001 は使えない
- 起動時に migration を流すと init の 10 秒制限を超えてやり直しになり、初回応答が 29.6 秒かかる
- 1 実行環境が DB 接続を 1 本持ち、環境が回収されるまで保持する
- 関数の削除直後に実行ロールを消すと、Lambda が VPC 内のネットワークインターフェースを片付けられず残る

## Goals

- `https://dystopia.city` で dystopia が動く
- 固定費を RDS と CloudFront 関連の少額に抑え、NAT と EKS の費用をなくす
- アプリのコード、release-please、GHCR へのイメージビルド、kubernetes マニフェスト、Flux 設定、`dystopia/infrastructure` を変更しない
- Lambda 構成を `dystopia/lambda` と workflow 1 本の削除で取り除ける

## Non-goals

- 課金（Stripe）。`api.stripe.com` は IPv6 で到達できず、本構成の外向き通信では届かない
- 定期実行の rake タスク（`billing:reconcile`、`account:purge_deactivated`）
- OpenTelemetry の送信先
- SMS sandbox の解除
- platform リポジトリの EKS 関連コードと残存シークレットの掃除
- EKS に戻す手順とデータの引き継ぎ
- Lambda 同時実行数の上限引き上げの申請

## Decisions

| 論点 | 決定 | 理由 |
|---|---|---|
| 実行形態 | frontend と monolith を 1 つの Lambda コンテナに同居 | Lambda Web Adapter は HTTP/1.1 しか中継できず、gRPC サーバーを単体の Lambda として公開できない。同居なら Next.js から `127.0.0.1` の gRPC に届き、アプリのコード変更が要らない |
| cold start | 約 5 秒を受け入れる | 追加費用なしで始められる。Provisioned Concurrency は月約 $11 で Fargate の最小構成と同水準になる |
| 外向き通信 | IPv6 の egress-only internet gateway のみ | 固定費ゼロで RDS を private に保てる。NAT instance は月約 $8、NAT Gateway は月約 $49 |
| S3 への経路 | gateway endpoint | 無料。SDK の dualstack 設定はコード変更が要り、環境変数で一括指定すると Cognito が DNS に存在しない dualstack ホスト名を引く |
| 入口 | CloudFront + Lambda Function URL | 静的ファイルをエッジでキャッシュし、ページ表示時の並列リクエストが Lambda に届かないようにする |
| Function URL の認証 | `NONE` | CloudFront の OAC はブラウザからの POST に body の SHA256 ヘッダを要求し、アプリの API 呼び出しが通らない。直接叩かれてもキャッシュを迂回されるだけで、認証はアプリが行う |
| デプロイのきっかけ | main への push | release-please の版はデプロイと切り離して現状維持 |
| Terraform の置き場 | `dystopia/lambda/aws`（新規） | `dystopia/infrastructure` は EKS の VPC とクラスタを data source で引いており apply できない。書き換えず残せば EKS に戻すときにそのまま使える |
| イメージの更新 | CI が `update-function-code` で行い、Terraform は `image_uri` を無視 | migration をアプリ更新より先に実行する順序を Terraform の 1 回の apply では表現できない |
| migration | 同じイメージの task 用関数を CI が呼ぶ | init の 10 秒制限を避ける。private な RDS には GitHub Actions から届かない |
| DB への手動操作 | task 用関数で `psql` を受ける | 踏み台もクラスタもなく、他に private な RDS へ入る手段がない |
| CI の組み込み方 | 専用 workflow。`workflow-config.yaml` は変更しない | 環境を再有効化すると `dystopia/infrastructure` や pennyworth の stack まで CI の対象に戻る |

### Rejected alternatives

- **monolith を HTTP 化して Lambda を 2 本に分ける** — 94 RPC の transport を書き換える必要があり、EKS に戻す前提と合わない
- **ECS Fargate** — gRPC がそのまま動きアプリ変更も不要だが、月 $9〜18 と入口の費用が固定でかかる。spike で Lambda が成立したため不採用
- **RDS を public にして Lambda を VPC の外に置く** — 構成は最も単純だが、送信元 IP を固定できず 5432 番を全世界に開けることになる
- **静的ファイルを S3 から配信する** — デプロイ直後の並列 cold start も解消できるが、CI にイメージからの取り出しと同期の手順が増える
- **API Gateway HTTP API のみ** — 静的ファイルも毎回 Lambda を通り、ページ表示のたびに並列の実行環境が立ち上がる
- **`dystopia/infrastructure` を Lambda 向けに書き換える** — 定義の重複は避けられるが、EKS 向けの構成が git 履歴にしか残らない

## Architecture

```
Browser
  │ https://dystopia.city
  ▼
CloudFront ── /_next/static/* はエッジでキャッシュ
  │ それ以外はキャッシュせず転送
  ▼
Lambda Function URL (auth NONE)
  ▼
Lambda dystopia-production (container, arm64, VPC 内)
  ├─ Lambda Web Adapter → Next.js :3000
  └─ Next.js → gRPC 127.0.0.1:50051 → monolith
                                         │
                                         ▼
                                   RDS PostgreSQL (private)
```

### Network

- dystopia 専用の VPC。IPv4 は `10.10.0.0/16`、IPv6 は Amazon 提供の `/56`
- private subnet を 3 AZ に 1 つずつ置き、全て dual-stack にする。public subnet、Internet Gateway、NAT は置かない
- route table は VPC 内の経路に加えて `::/0` を egress-only internet gateway に向ける
- S3 gateway endpoint を route table に関連付ける
- Lambda は `ipv6_allowed_for_dual_stack` を有効にする
- security group は Lambda 用と RDS 用の 2 つ。RDS 用は Lambda 用からの 5432 のみ許可する

| 通信先 | 用途 | 経路 |
|---|---|---|
| `cognito-idp.ap-northeast-1.amazonaws.com` | サインイン、JWKS 取得、ユーザー削除 | IPv6 |
| S3 | media の削除 | gateway endpoint |
| `api.stripe.com` | 課金 | なし（届かない） |

presigned URL の生成は署名計算だけでネットワークを使わない。ブラウザからのアップロードは S3 に直接届く。

### Runtime limits

- production アカウントの Lambda 同時実行数の上限は 10。11 件目からは 429 になる
- DB 接続は実行環境 1 つにつき 1 本。上限 10 のもとでは、デプロイ直後に古い環境が残っても 20 本程度に収まる
- Function URL の buffered モードはリクエストとレスポンスが各 6 MB まで。media は presigned URL で S3 に直接送るため該当しない
- `/api/messaging/stream`（SSE）は buffered モードでは使えない。現状は消費側が 6 秒ポーリングで、この route を呼ぶ箇所はない

## Layout

```
dystopia/
  infrastructure/        変更なし
  frontend/              変更なし
  monolith/              変更なし
  lambda/
    README.md
    image/
      Dockerfile         ビルドコンテキストは dystopia/
      Dockerfile.dockerignore
      start
      task.mjs
      tests/
    aws/
      root.hcl
      modules/
      production/
.github/workflows/
  deploy-dystopia-lambda.yaml
```

イメージ関連を `image/` に一段下げるのは、`dystopia/lambda/Dockerfile` に置くと `workflow-config.yaml` の規約 `dystopia/{service}` がコンテナビルド対象と見なすためである。現在は環境が空で規約は発火しないが、再有効化されても影響を受けない配置にする。一方 `dystopia/lambda/aws/production` は同じ規約の terragrunt stack には一致するため、環境を再有効化すると規約ベースのデプロイ経路もこの stack を plan / apply の対象にする。

## Infrastructure

`dystopia/lambda/aws/modules` の構成。state のキーは `dystopia/lambda/production/terraform.tfstate`。

| ファイル | 内容 |
|---|---|
| `network.tf` | VPC、subnet、egress-only internet gateway、route table、S3 gateway endpoint、security group |
| `rds.tf` | RDS（PostgreSQL 18.6、db.t4g.micro、非公開、削除保護あり）、subnet group、VPC 内の private zone と DNS 別名 |
| `cognito.tf` | user pool、BFF 用 client、SMS 用ロール |
| `s3.tf` | media バケット、public access block、CORS |
| `lambda.tf` | ECR リポジトリ、アプリ用関数、task 用関数、Function URL、実行ロール、ロググループ |
| `cdn.tf` | ACM 証明書（us-east-1）と検証レコード、CloudFront、`dystopia.city` の A / AAAA |
| `terraform.tf` | provider 3 つ（東京、us-east-1、management account の Route53） |
| `variables.tf` / `outputs.tf` | |

- Cognito・RDS・S3 のリソース名は `dystopia/infrastructure` と同じにする（user pool `dystopia-production`、バケット `dystopia-media-production`、DB 識別子 `monolith-production`）。アプリ設定と CORS を変えずに済む。2 つの stack を同時に apply することはできない
- Route53 は management account（559744160976）の `dystopia.city` ゾーンを `route53-zone-access` ロール経由で更新する。apex の A / AAAA は削除済みの ELB を指しているため `allow_overwrite` で置き換える
- `DATABASE_URL` は `random_password` と DNS 別名から組み立てて Lambda の環境変数に入れる。パスワードは state に加えて、関数の設定を読める利用者（`lambda:GetFunctionConfiguration` とコンソール）からも見える。RDS は private で VPC の外からは接続できないため受け入れる。URL にエスケープなしで埋め込むため、パスワードは英数字のみにする
- RDS は `deletion_protection` を有効にする。この stack は main への push のたびに無人で apply されるため、置換を伴う変更が入っても DB が消えないようにする
- 関数の `image_uri` は `ignore_changes` にし、作成時のみ `latest` タグを使う
- ECR は直近 10 イメージを残すライフサイクルを付ける
- ロググループの保持は 30 日

### Lambda functions

| | アプリ用 | task 用 |
|---|---|---|
| 名前 | `dystopia-production` | `dystopia-production-task` |
| アーキテクチャ | arm64 | arm64 |
| メモリ | 1024 MB | 1024 MB |
| タイムアウト | 30 秒 | 900 秒 |
| 起動コマンド | イメージの既定（`start`） | `node /app/lambda/task.mjs`（作業ディレクトリは `/app/monolith`） |
| 入口 | Function URL | なし（IAM での invoke のみ） |

両方とも同じ subnet と security group に置き、実行ロールを共有する。実行ロールには VPC 接続、Cognito の `AdminDeleteUser`、media バケットへの読み書きを付ける。

アプリ用関数の環境変数。

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | Terraform が組み立てる |
| `GRPC_BIND_ADDRESS` | `0.0.0.0:50051` |
| `MONOLITH_URL` | `http://127.0.0.1:50051` |
| `AWS_LWA_PORT` | `3000` |
| `AWS_LWA_READINESS_CHECK_PORT` | `50051` |
| `AWS_LWA_READINESS_CHECK_PROTOCOL` | `tcp` |
| `COGNITO_ADAPTER` | `aws` |
| `COGNITO_REGION` / `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` | Terraform のリソースから |
| `MEDIA_BUCKET_NAME` / `MEDIA_BUCKET_REGION` | Terraform のリソースから |
| `STRIPE_*` / `BILLING_*` | `disabled`（monolith の起動に値が必須のため） |
| `OTEL_SDK_DISABLED` | `true` |

readiness check を gRPC のポートに向けるのは、起動が遅い側（Ruby、約 3.9 秒）の完了を待つためである。Next.js は約 1.3 秒で先に待ち受ける。

task 用関数は `DATABASE_URL`、`STRIPE_*` / `BILLING_*`、`MEDIA_BUCKET_*`、`COGNITO_*` をアプリ用と同じ値で持つ（`hanami db migrate` がアプリの設定を読み込むため）。Lambda Web Adapter の設定はアプリ用と異なり、次の値にする。

| 変数 | 値 |
|---|---|
| `AWS_LWA_PORT` | `8080` |
| `AWS_LWA_READINESS_CHECK_PATH` | `/` |
| `AWS_LWA_ERROR_STATUS_CODES` | `500-599` |

### CloudFront

- 代替ドメイン名は `dystopia.city`。証明書は us-east-1 の ACM
- origin は Function URL。HTTPS のみ
- 既定の behavior はキャッシュ無効、Host 以外の全ヘッダ・cookie・クエリを転送、全メソッド許可
- `/_next/static/*` の behavior はマネージドの CachingOptimized
- viewer は HTTPS へリダイレクト

## Image

`dystopia/lambda/image/Dockerfile` はビルドコンテキストを `dystopia/` とする多段ビルド。

1. `node` で frontend を `pnpm build` し、standalone 出力を得る
2. `ruby` で monolith の gem を `bundle install` する
3. `ruby:slim` を実行用のベースにし、`node` のバイナリ、Lambda Web Adapter、monolith、frontend の standalone 出力、`start`、`task.mjs` を載せる

ベースイメージの版は `dystopia/frontend/Dockerfile` と `dystopia/monolith/Dockerfile` に合わせる。Lambda はマルチアーキのイメージを受け付けないため、arm64 単一で provenance を付けずに push する。

### start

- monolith の `bin/grpc` と Next.js の `server.js` を両方バックグラウンドで起動し、どちらかが終了したら全体を終了する。片方だけが落ちた環境にリクエストが流れ続けるのを防ぐ
- SIGTERM を受けたら両方に転送する
- migration は実行しない

### task.mjs

Node の標準ライブラリだけで書いた HTTP サーバー。Lambda Web Adapter が `aws lambda invoke` のイベントを HTTP の POST として渡す。渡し先のパスには依存せず、POST であればどのパスでも受け付ける。

| リクエスト本文 | 動作 |
|---|---|
| `{"task":"migrate"}` | `bundle exec hanami db migrate --no-dump` を実行 |
| `{"task":"psql","sql":"<SQL>"}` | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -P pager=off -c "<SQL>"` を実行 |

- コマンドは引数配列で起動し、シェルを経由しない
- 応答は JSON の `{"task", "exitCode", "output"}`。成功時は 200、コマンドが非ゼロで終了した場合・未知の `task`・JSON として読めない本文は 500 を返す
- `output` は標準出力と標準エラーの末尾 256 KiB まで。同期呼び出しの応答は 6 MB を超えられない
- ログには `task` と `exitCode` だけを出す。クエリ結果に個人情報が含まれうるため `output` は出さない
- `AWS_LWA_ERROR_STATUS_CODES=500-599` により、500 は invoke の失敗として呼び出し側に伝わる
- POST 以外のリクエストには 200 を返し、readiness check に使う

HTTP サーバーを挟むのは、イメージに Lambda Web Adapter が入っている以上、同じイメージの関数では adapter が必ず起動してイベントの受け口を握るためである。adapter を避けるには別イメージか Ruby 用のランタイム gem が要る。

## Deploy workflow

`.github/workflows/deploy-dystopia-lambda.yaml`。

| きっかけ | 動作 |
|---|---|
| PR で `dystopia/lambda/aws/**` を変更 | terragrunt plan（plan ロール） |
| main への push で `dystopia/frontend/**`、`dystopia/monolith/**`、`dystopia/lambda/**` を変更 | 下の 5 段階（apply ロール） |

1. ECR リポジトリだけを対象に terragrunt apply する
2. 統合イメージをビルドし、commit の SHA と `latest` をタグにして ECR に push する
3. 全体を terragrunt apply する。関数を新規に作る場合は手順 2 で push した `latest` が使われる
4. task 用関数のイメージを更新し、更新完了を待って `{"task":"migrate"}` で呼ぶ。失敗したら停止する
5. アプリ用関数のイメージを更新し、更新完了を待つ
6. アプリ用関数の Function URL に問い合わせ、2xx か 3xx が返らなければ失敗にする

- 手順 1 は初回のためにある。関数は作成時にイメージを必要とし、ECR が空だと作れない。2 回目以降は差分なしで通過する
- migration の成否は、invoke のエラー有無に加えて応答本文の `task` と `exitCode` で判定する。エラーの印が無いだけでは migration が実行された証拠にならない
- migration はアプリの更新より先に走るので、古いコードが新しいスキーマに一時的に触れる。破壊的なスキーマ変更は 2 回のデプロイに分ける
- 手順 6 は DNS と CloudFront を経由せず Function URL を直接叩く。起動できないイメージが成功扱いで残るのを防ぐ
- terragrunt apply は state の lock を 5 分まで待つ。PR の plan と重なっても即失敗しない
- `concurrency` でデプロイを直列にする
- 認証は既存の GitHub OIDC ロール（`github-oidc-auth-production-github-actions-plan-role` / `-apply-role`）

## Testing

| 対象 | 方法 |
|---|---|
| Terraform | `aws/modules/tests/*.tftest.hcl` で plan 結果を検査する。RDS が非公開であること、NAT Gateway と Internet Gateway がないこと、RDS の security group が Lambda の security group からの 5432 だけを許可すること、gRPC ポートが 50051 で readiness check と一致すること、task 用関数に Function URL がないこと |
| イメージ | `image/tests/` のスクリプトでコンテナをローカル起動する。読み取り専用のファイルシステムで fake adapter のサインインが 200 を返すこと、`task.mjs` の `migrate` が空の DB にスキーマを作ること、未知の `task` と失敗する SQL が 500 を返すこと |
| 本番 | 初回デプロイ後に下の順で確認する |

### Production verification order

1. Cognito への IPv6 接続。管理コマンドで作ったアカウントでサイトからサインインし、frontend → Cognito の `InitiateAuth` と JWKS 取得が通ることを確認する
2. media のアップロードと削除
3. `dystopia.city` の名前解決と HTTPS
4. cold start と warm 時の応答時間を Spike evidence の数値と比較する

## Risks

| リスク | 対応 |
|---|---|
| Cognito への IPv6 接続が実環境で通らない | 未検証。本番確認の最初に確かめ、通らなければ NAT instance を追加する |
| Lambda Web Adapter が invoke のイベントを HTTP の POST で渡す挙動 | README の環境変数表でしか確認していない。`task.mjs` をパスに依存しない実装にし、初回デプロイの migration で実際の挙動を確認する |
| 同時実行 10 の上限で 429 が出る | 上限の引き上げを申請する（本 spec の範囲外） |
| デプロイ直後の最初の訪問者に並列の cold start が起きる | CloudFront のキャッシュが空の間だけ発生する。受け入れる |
| stack を destroy する際にネットワークインターフェースが残る | 実行ロールは関数の削除後、インターフェースの解放を確認してから消す。手順を `README.md` に書く |

## Deferred

- EKS に戻すとき、RDS のデータ・Cognito のユーザー・media の持ち主は `dystopia/lambda` 側の state にある。引き継ぐなら state の移動かデータ移行が要り、作り直すなら不要。戻す時点で決める
- 課金を有効にする時点で、Stripe に届く IPv4 の出口（NAT instance など）を追加する
