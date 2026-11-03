# dystopia infrastructure layers design

## Context

dystopia の production は Lambda で動いている（`docs/superpowers/specs/2026-10-06-dystopia-lambda-hosting-design.md`）。`dystopia/lambda/aws` の 1 stack が VPC・RDS・Cognito・media 用 S3・ECR・Lambda・CloudFront・ACM を 1 つの state に持つ。

EKS 向けの `dystopia/infrastructure` も、同じ名前の RDS・user pool・media 用バケットを定義し、VPC は platform の `vpc-production` を data source で引く。2 つの stack は共存できず、Lambda から EKS に移るには全リソースを壊すか state を移すしかない。

本 spec は、共有の基盤を platform に、プロダクトのデータと実行環境を monorepo に分け、実行環境だけを入れ替えられる構成に作り直す。

### Current state (2026-11-03)

production アカウント（337169763788）を読み取り専用で確認した結果。

| 項目 | 結果 | 確認方法 |
|---|---|---|
| platform `aws/vpc/production` | 未 apply（state はあるがリソース 0） | state ファイルの `resources` の件数 |
| VPC | `dystopia-production`（10.10.0.0/16）と default VPC のみ | `ec2 describe-vpcs` |
| NAT Gateway / `private-trust-production` | 存在しない | `ec2 describe-nat-gateways`、`ec2 describe-security-groups` |
| Lambda → Cognito の IPv6 経路 | 通っている。`InitiateAuth`（2026-11-03）と `SignUp`（2026-10-10）の送信元が VPC の IPv6 アドレス（`2406:da14:...`）、user agent が `aws-sdk-js` | CloudTrail `lookup-events` |

platform の VPC は新規作成になり、rename や NAT 無効化で影響を受ける既存の利用者はいない。IPv6 経路は 2026-10-06 の spec で未検証とされていたが、本番で通ることを確認済みのため、同じ構成を platform の private subnet で再現する。

## Goals

- 実行環境（Lambda / 将来の EKS）を入れ替えても、VPC とデータ層（RDS・Cognito・media 用 S3）の state に触らずに済む
- VPC は platform が持ち、全プロダクトで共有する
- RDS はプロダクトごとに分け、各プロダクトのサービス（dystopia では monolith）が持つ
- NAT Gateway を作らず、固定費を現状と同程度に抑える
- 将来 NAT Gateway（単一、のちに AZ ごと）を、subnet を作り直さずに追加できる
- 作り直し後も `https://dystopia.city` で dystopia が Lambda 上で動く
- 本 spec で作る・作り直すリソースの名前に環境名を含めない。環境は AWS アカウントで分かれており、名前での区別は不要

## Non-goals

- 既存データの引き継ぎ。RDS・Cognito・S3 の中身は全て捨てる
- EKS への移行そのもの、EKS 用の実行層
- develop 環境の構築
- platform・monorepo の production を CI の apply 対象に戻すこと
- 課金（Stripe）。IPv4 の外向き経路がないため引き続き届かない
- アプリのコード変更
- 稼働中の `platform/aws/github-oidc-auth` の IAM ロールと、`platform/aws/eks*` 自身のリソース名から環境名を外すこと。切り替え手順の設計が要るため別 spec で扱う

## Anti-goals

- EKS に移るときにデータ層や VPC の destroy・state 移行が必要になる構成
- 今の時点で NAT Gateway の固定費が発生する構成
- 将来の NAT 追加で subnet の置換が起きる構成

## Decisions

### Decided with the user

| 論点 | 決定 |
|---|---|
| 責務の分割 | 共有の基盤（VPC）は platform、プロダクトのデータと実行環境は monorepo |
| 実行環境を入れ替えても残すもの | VPC と DB。Cognito と media 用 S3 も同じく残す |
| RDS の所有者 | プロダクトごとに分離し、monolith のデータ層に置く |
| Cognito の所有者 | monolith のデータ層。frontend はその出力を参照する |
| 既存リソース | 全て捨てて作り直す |
| NAT Gateway | 今は作らない。将来は単一 NAT、さらに AZ ごとの NAT もメンテナンスを入れて導入しうる |
| IPv6 | 残す。VPC 内の Lambda は public IPv4 を持てず、NAT なしで Cognito に届く無料の経路が IPv6 の egress-only internet gateway だけのため |
| IPv6 を付ける subnet | private subnet のみ |
| 将来の EKS ノード | private subnet に置き、NAT Gateway 経由で外に出る |
| `dystopia/infrastructure` | 削除する。EKS に戻るときは git 履歴を参考に実行層として作り直す |
| platform VPC の apply | 手元から手動で行う |
| monorepo の develop | `workflow-config.yaml` で exclude する |
| terragrunt stack のパス規約 | `{service}/infrastructure/aws/{environment}` を `{service}/aws/{environment}` に変える。既存の frontend と pennyworth も移す |
| 命名 | 環境名を外す。S3 バケットのみ全 AWS で一意な名前が要るためアカウント ID を付ける。対応表は「Naming」 |
| Cognito client 名 | `dystopia`。client は 1 つで、接尾辞で区別する相手がない |
| 共通 SG 名 | `internal`。`default` は VPC 既定の SG と名前が衝突し、`private` は private subnet と紛らわしい |

### Builder's calls made during design

| 論点 | 決定 | 理由 |
|---|---|---|
| 実行層の置き場所 | `dystopia/lambda/aws` のまま | frontend と monolith を 1 コンテナに同居させるため、実行層はサービス単位ではなくプロダクト単位になる |
| platform VPC の参照方法 | data source（Name タグ `vpc` と Tier タグ） | リポジトリをまたぐため terragrunt `dependency` は使えない。既存の `dystopia/infrastructure` と `platform/aws/vpc/lookup` と同じ方式 |
| データ層 → 実行層の参照方法 | terragrunt `dependency` で monolith stack の出力を受け取る | 同じリポジトリ・同じアカウント・同じ state バケットにあり、DB パスワードのような data source で引けない値も渡せる |
| RDS への接続許可 | platform の `internal` security group を RDS と Lambda の両方に付ける | 自己参照の ingress で相互に通る。将来の EKS ノードも platform 側で同じ SG を付けており（`platform/aws/eks/modules/main.tf`）、データ層を変えずに RDS へ届く |
| RDS の subnet | platform が作る database subnet と DB subnet group（`vpc`） | database subnet は専用の route table を持ち、NAT の追加・AZ ごとの切り替えの影響を受けない |
| `single_nat_gateway` | `true` のまま | private の route table 数は `single_nat_gateway` だけで決まり（module 6.7.3 `main.tf` の `nat_gateway_count`）、NAT の有無で変わらない |
| `internal` の IPv6 egress | platform 側で `::/0` の egress rule を追加する | 現在は IPv4 の egress しかなく、Lambda に付けても IPv6 で Cognito に出られない |

## Architecture

```
platform (aws/vpc/production)
  VPC vpc  10.0.0.0/16 + Amazon 提供 IPv6 /56
  ├─ public subnet   x3  IPv4 のみ  → Internet Gateway   （将来 NAT GW / LB の置き場）
  ├─ private subnet  x3  dual-stack → ::/0 egress-only IGW（将来 0.0.0.0/0 → NAT GW）
  ├─ database subnet x3  IPv4 のみ  → VPC 内のみ。DB subnet group vpc
  ├─ S3 gateway endpoint（private route table）
  └─ SG internal（自己参照 ingress、IPv4 / IPv6 egress）

monorepo
  dystopia/monolith/aws/production                  … データ層
    RDS, private zone dystopia.local, Cognito, media S3
  dystopia/lambda/aws/production                    … 実行層
    ECR, Lambda x2, Function URL, CloudFront, ACM, apex DNS, Scheduler
```

| 通信 | 経路 |
|---|---|
| Lambda → Cognito | private subnet の IPv6 → egress-only IGW |
| Lambda → S3 | gateway endpoint |
| Lambda → RDS | VPC 内（internal SG） |
| Lambda → Stripe 等の IPv4 のみの宛先 | なし（NAT 導入まで届かない） |

## Platform changes

`platform/aws/vpc/modules`:

- `module "vpc"` に IPv6 を追加する: `enable_ipv6 = true`、`private_subnet_ipv6_prefixes = [0, 1, 2]`、`private_subnet_assign_ipv6_address_on_creation = true`、`create_egress_only_igw = true`
- `enable_nat_gateway` を変数化し、production では `false` にする。`single_nat_gateway` は `true` のまま
- private subnet の DNS64 は `enable_nat_gateway` に合わせる（現在は無効）。NAT64 がないまま DNS64 を有効にすると、IPv4 のみの宛先に合成 AAAA が返り、その通信は egress-only IGW で捨てられるため
- 共通 SG を `internal` に改名し（Terraform のリソース名も `aws_security_group.internal`）、`::/0` の egress rule を追加する。`lookup` の出力キー `security_groups.private_trust` も `security_groups.internal` にし、`aws/eks/modules/main.tf`・`aws/eks-karpenter/modules/main.tf` の参照とテスト（`tests/*.tftest.hcl`、`aws/eks/tests/security-group-contract.sh`）を合わせる
- Karpenter の EC2NodeClass（`kubernetes/components/karpenter/production/kustomization/ec2nodeclass.yaml`）の SG セレクタ `Name: private-trust-production` を `Name: internal` にし、`kubernetes/components/karpenter/tests/security-group-selectors.sh` を合わせる。hydrate 済みの `kubernetes/manifests` は CI の hydrator が更新する
- 環境名を名前から外す（「Naming」の対応表）。`lookup` から `environment` 変数を削除し、`aws/eks/modules/lookups.tf` と `aws/eks-karpenter/modules/lookups.tf` の受け渡しも削除する
- 既存の module tests（`modules/tests`、`lookup/tests`）を変更に合わせて更新し、IPv6 と NAT 無効の振る舞いをテストに加える

NAT を無効にすると `nat_public_ips` 出力は空になる。platform 内で参照している箇所はない。

## Monorepo changes

### Data layer: `dystopia/monolith/aws`

既存の空 stack（`dystopia/monolith/infrastructure/aws`）を `dystopia/monolith/aws` に移して書く。`dystopia/lambda/aws/modules` の `rds.tf`・`cognito.tf`・`s3.tf` を移し、ネットワークを platform 参照に置き換える。

- RDS（PostgreSQL 18.6、db.t4g.micro、単一 AZ、非公開、`deletion_protection = true`）。subnet group は platform の `vpc`、SG は `internal`
- DB マスターパスワードは `random_password`（英数字のみ。`DATABASE_URL` にエスケープなしで埋め込むため）
- private hosted zone `dystopia.local` を platform の VPC に関連付け、`monolith-db.dystopia.local` を RDS に向ける
- Cognito user pool、client、SMS 用ロール。名前以外の設定値は現行の `cognito.tf` と同じ
- media 用 S3 バケット、public access block、CORS
- 出力: DB の接続情報（host 別名・port・db 名・ユーザー・パスワード。パスワードは sensitive）、user pool ID / ARN、client ID、バケット名 / ARN
- provider に `random` を追加する
- `production/env.hcl` に `domain_name` を持たせ、CORS の許可元に使う

### Runtime layer: `dystopia/lambda/aws`

- `network.tf` を削除し、VPC・private subnet・`internal` を data source で引く
- `rds.tf`・`cognito.tf`・`s3.tf` を削除し、`production/terragrunt.hcl` の `dependency "monolith"` から値を受け取る。plan 用に `mock_outputs` を置く
- Lambda 2 本の `vpc_config` は private subnet と `internal` を使い、`ipv6_allowed_for_dual_stack = true` を維持する
- IAM ポリシーの Cognito・S3 の ARN、`shared_environment` の値を dependency の出力に置き換える
- ECR・Lambda・Function URL・CloudFront・ACM・apex DNS・Scheduler・VAPID 鍵は名前以外現行のまま

### Removals and CI

- `dystopia/infrastructure` を丸ごと削除する
- `workflow-config.yaml` の `aws` stack の `exclude` に `environment: develop` を追加する
- `workflow-config.yaml` の `aws` stack の `path` を `aws/{environment}` に変える
- `dystopia/frontend/infrastructure/aws` を `dystopia/frontend/aws` に移す。state は存在しない
- `system-components/pennyworth/infrastructure/aws` を `system-components/pennyworth/aws` に移す。state のキーはパスから決まるため（`root.hcl` の `get_path_from_repo_root()`）、production の state（Secrets Manager 2 件）を新しいキーへ移し、移動後の plan が差分なしになることを確認する
- `dystopia/lambda/aws/production` は新しい規約（`dystopia/{service}/aws/{environment}`）にも一致する。production を CI の対象に戻すと、規約ベースの経路と専用 workflow の両方が apply しうる。今は exclude 中のため本 spec では扱わず、production を戻すときに解消する
- `.github/workflows/deploy-dystopia-lambda.yaml` の `APP_FUNCTION`・`TASK_FUNCTION` を新しい関数名にする。PR の plan が dependency の state を読めることを確認する
- `dystopia/lambda/README.md`、`dystopia/monolith/README.md`・`README-ja.md` など、構成やパスに触れている README を新しい構成に合わせる。CHANGELOG は履歴なので変えない

## Naming

`Environment` タグと state のキーには環境名が残る。どちらも名前ではなく、アカウントと state を区別する属性である。

### platform `aws/vpc`

| リソース | 変更前 | 変更後 |
|---|---|---|
| VPC | `vpc-production` | `vpc` |
| subnet（module が命名） | `vpc-production-{public,private,db}-<az>` | `vpc-{public,private,db}-<az>` |
| DB subnet group | `vpc-production` | `vpc` |
| default SG の Name タグ | `default-vpc-production-locked` | `default-vpc-locked` |
| S3 gateway endpoint | `vpce-s3-production` | `vpce-s3` |
| 共通 SG | `private-trust-production` | `internal` |
| `vpc/lookup` の入力 | `environment`（必須） | 削除 |

### Data layer `dystopia/monolith/aws`

| リソース | 変更前 | 変更後 |
|---|---|---|
| RDS | `monolith-production` | `monolith` |
| RDS の subnet group | `monolith-production` | 作らない（platform の `vpc`） |
| Cognito user pool | `dystopia-production` | `dystopia` |
| Cognito client | `dystopia-production-bff` | `dystopia` |
| SMS 用 IAM ロール / ExternalId | `dystopia-production-cognito-sms` | `dystopia-cognito-sms` |
| media 用 S3 | `dystopia-media-production` | `dystopia-media-337169763788` |
| private zone / DB 別名 | `dystopia.local` / `monolith-db.dystopia.local` | 変更なし |

### Runtime layer `dystopia/lambda/aws`

| リソース | 変更前 | 変更後 |
|---|---|---|
| Lambda（アプリ用） | `dystopia-production` | `dystopia` |
| Lambda（task 用） | `dystopia-production-task` | `dystopia-task` |
| ロググループ | `/aws/lambda/dystopia-production{,-task}` | `/aws/lambda/dystopia{,-task}` |
| Lambda 実行ロール / ポリシー | `dystopia-production-lambda` / `dystopia-production-lambda-app` | `dystopia-lambda` / `dystopia-lambda-app` |
| Scheduler 用ロール / ポリシー | `dystopia-production-scheduler` / `dystopia-production-scheduler-invoke-task` | `dystopia-scheduler` / `dystopia-scheduler-invoke-task` |
| スケジュール | `dystopia-production-purge-deactivated` | `dystopia-purge-deactivated` |
| CloudFront のコメント | `dystopia production` | `dystopia` |
| ECR | `dystopia` | 変更なし |
| VPC・subnet・SG など（`network.tf`） | `dystopia-production*` | 削除（platform のものを使う） |

## Cutover

実行環境の操作は全て手元から行う。各段の完了条件を満たしてから次へ進む。monorepo の PR を merge すると deploy workflow が実行層を apply するため、旧 stack の destroy とデータ層の apply は merge 前に終える。

1. platform VPC の apply: platform の PR を merge 後、`platform/aws/vpc/production` で手元から apply。完了条件: private subnet に IPv6 CIDR があり、private route table に `::/0` → egress-only IGW があり、NAT Gateway がない。新しい VPC は旧 VPC（10.10.0.0/16）と名前も CIDR も重ならないため、旧 stack の稼働中に作ってよい
2. 現行 stack の削除準備: AWS CLI で RDS `monolith-production` の削除保護と、user pool `dystopia-production` の削除保護を外す。media バケットと ECR リポジトリを空にする。完了条件: 両方の削除保護が無効、バケットとリポジトリが空
3. 現行 stack の destroy: main の `dystopia/lambda/aws/production`（旧コード）で `terragrunt destroy`。完了条件: destroy 成功、旧関数（`dystopia-production`・`dystopia-production-task`）の ENI が残っていない（Lambda の ENI 回収が遅れると VPC 削除が失敗するため、失敗時は README の Teardown の手順で ENI を消して再実行する）
4. データ層の apply: monorepo の PR のブランチで `dystopia/monolith/aws/production` を手元から apply。完了条件: RDS `monolith` が available、出力 `database_host` が `monolith-db.dystopia.local`
5. monorepo の PR を merge する。deploy workflow が実行層を apply し、migration とアプリ更新を行う。完了条件: workflow の Verify ステップ成功、`https://dystopia.city` でサインアップから投稿まで通る
6. pennyworth の state 移動: production の state を新しいキーへコピーし、`system-components/pennyworth/aws/production` の plan が差分なしになることを確認してから旧キーを消す

手順 2 の開始から手順 5 の merge 直前まで deploy workflow を無効にする（その間に dystopia/frontend・monolith・lambda への変更が main に入ると、workflow が旧コードで実行層を apply するため）。

手順 3 から 5 までの間、dystopia は停止する。データを捨てる前提のため許容する。

手順 3 以降で失敗したときは、旧 stack に戻さず新しい構成のまま直す。データは捨てる前提で、戻しても守るものがないため。

## Left to the builder

- platform と monorepo の PR の分け方と merge 順（platform の VPC が先に存在しないと monorepo のデータ層は plan できない）
- terragrunt `dependency` の `mock_outputs` の内容と、`mock_outputs_allowed_terraform_commands` の範囲
- モジュールのテスト（`tftest.hcl`）の構成。既存の `dystopia/lambda/aws/modules/tests/hosting.tftest.hcl` を新構成に合わせて直す
- S3 バケット名・user pool 名の再利用が削除直後に失敗した場合の待ち方
