# dystopia Lambda hosting

## What

EKS に戻すまでの間、dystopia を AWS Lambda で動かすための構成。frontend（Next.js）と monolith（gRPC）を 1 つのコンテナイメージに同居させ、CloudFront と Lambda Function URL の後ろで動かす。

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js :3000
                                                                    └→ gRPC 127.0.0.1:50051 → RDS
```

設計の全体と各選択の理由は `docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md` にある。

## Layout

| パス | 内容 |
|---|---|
| `image/Dockerfile` | 統合イメージ。ビルドコンテキストは `dystopia/` |
| `image/start` | アプリ用関数の起動スクリプト。gRPC と Next.js を起動し、片方が終了したら全体を終了する |
| `image/task.mjs` | task 用関数の HTTP サーバー。migration と SQL の実行を受ける |
| `aws/modules` | Terraform。VPC、RDS、Cognito、S3、ECR、Lambda、CloudFront |
| `aws/production` | Terragrunt の production 設定 |

`dystopia/infrastructure` は EKS 向けの構成で、この構成とは同じ名前のリソースを定義している。2 つを同時に apply することはできない。

## Constraints

- gRPC のポートは 50051。Lambda の Runtime API が `127.0.0.1:9001` を使うため、monolith の既定値 9001 は使えない
- migration は起動時に実行しない。Lambda の初期化は 10 秒で打ち切られる
- 外向き通信は IPv6 と S3 gateway endpoint だけ。IPv4 でしか到達できない Stripe には届かないため、課金は動かない
- アカウントの Lambda 同時実行数の上限が、同時に処理できるリクエスト数の上限になる
- 静かな時間帯の最初のリクエストは cold start で約 5 秒かかる

## Deploy

main への push で `.github/workflows/deploy-dystopia-lambda.yaml` が次の順に実行する。

1. ECR リポジトリだけを apply する
2. イメージをビルドし、commit の SHA と `latest` のタグで push する
3. 全体を apply する
4. task 用関数を新しいイメージに更新し、migration を実行する
5. アプリ用関数を新しいイメージに更新する

migration が失敗すると 5 は実行されない。migration はアプリより先に反映されるため、破壊的なスキーマ変更は 2 回のデプロイに分ける。

関数が動かすイメージは workflow が決める。Terraform は関数の作成時に `latest` を使い、以後は `image_uri` を変更しない。

## Operations

task 用関数 `dystopia-production-task` は IAM で `lambda:InvokeFunction` を持つ利用者だけが呼べる。

migration を手動で実行する。

```bash
aws lambda invoke --function-name dystopia-production-task \
  --cli-binary-format raw-in-base64-out --cli-read-timeout 900 \
  --payload '{"task":"migrate"}' /dev/stdout
```

SQL を実行する。

```bash
aws lambda invoke --function-name dystopia-production-task \
  --cli-binary-format raw-in-base64-out \
  --payload "$(jq -nc --arg sql 'select count(*) from identity.accounts' '{task:"psql",sql:$sql}')" /dev/stdout
```

応答の `exitCode` が 0 以外のとき、invoke の結果に `FunctionError` が付く。`output` は末尾 256 KiB までを返す。

ログは CloudWatch Logs の `/aws/lambda/dystopia-production` と `/aws/lambda/dystopia-production-task` にある。

## Tests

```bash
sh dystopia/lambda/aws/modules/tests/contract_test.sh
(cd dystopia/lambda/aws/modules && tofu test)
node --test dystopia/lambda/image/tests/task.test.mjs
bash dystopia/lambda/image/tests/image_test.sh
```

`image_test.sh` は Docker を使う。イメージのビルドを含むため、初回は 10 分ほどかかる。

## Teardown

- Cognito user pool は削除保護が有効なので、destroy の前に `deletion_protection` を `INACTIVE` にして apply する
- Lambda は VPC 内のネットワークインターフェースを実行ロールの権限で片付ける。destroy では関数の直後にロールも消えるため、インターフェースが `available` のまま残って security group と subnet の削除が止まることがある。その場合は次のコマンドで削除する

```bash
aws ec2 describe-network-interfaces \
  --filters 'Name=description,Values=AWS Lambda VPC ENI-dystopia-production*' Name=status,Values=available \
  --query 'NetworkInterfaces[].NetworkInterfaceId' --output text \
  | xargs -n 1 aws ec2 delete-network-interface --network-interface-id
```
