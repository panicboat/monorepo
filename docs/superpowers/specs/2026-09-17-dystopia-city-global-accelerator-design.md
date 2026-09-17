# Front dystopia.city's apex with a stable Global Accelerator alias

## Background

master アカウント (559744160976) が持つ `dystopia.city` の apex ALIAS レコードは、production の "application" ALB (共有 IngressGroup、`panicboat/platform` の `kubernetes/components/cilium/production/kustomization/application-ingress.yaml` が定義) の生 DNS 名を直接指している。この ALB は EKS クラスタが再作成される (`panicboat/platform` `docs/runbooks/eks-production-recreate.md`) たびに ARN・DNS 名とも変わる。現状はこの生 DNS 名を人手で書き換えて追従させており、external-dns の TXT 所有権マーカーも付いていない (2026-09-17 に master の Route53 を直接確認し、CloudTrail で「手動 DELETE 直後に external-dns route53-zone-access role が CREATE」という履歴も確認済み)。

この状態を解消するため、production 側に実体が変わっても名前が変わらない安定した窓口 (AWS Global Accelerator) を挟み、master の apex はその窓口だけを指す形にする。窓口の裏側 (どの ALB を向くか) の追従は production アカウント内だけで完結させ、master の Route53 は二度と書き換えない。

最初の実装は `panicboat/platform` の `aws/alb` Terragrunt stack (ACM 証明書を管理する共有スタック) に Global Accelerator と apex レコードを追加する形で行ったが、レビューで指摘を受け撤回した (`panicboat/platform` PR #960、該当コミットは revert 済み)。`aws/alb` は `system-components/pennyworth` の ALB IngressGroup (`group.name: application`) とも共有されている汎用スタックであり、特定プロダクト (`dystopia.city`) の apex 管理ロジックを持ち込むと `panicboat/platform` → `panicboat/monorepo` であるべき依存方向が逆転する。

`panicboat/monorepo` には `dystopia/infrastructure/aws/production` という dystopia 専用の Terragrunt stack が既に存在し (`docs/superpowers/specs/2026-09-06-dystopia-infrastructure-consolidation-design.md` で確立、Cognito/RDS を管理、production account に apply 済み・稼働中)、この種のプロダクト固有リソースの置き場所として適切。

## Decisions

| 論点 | 決定 | 理由 |
|---|---|---|
| 配置場所 | `dystopia/infrastructure/aws` (monorepo) に置く。`panicboat/platform` には置かない | 依存方向を `monorepo → platform` に保つ。`aws/alb` は pennyworth とも共有する汎用スタックであり、dystopia 固有の知識を持ち込まない |
| 安定した窓口の実装 | AWS Global Accelerator (Standard, IPv4, TCP:443 リスナー1本) | ALB の前段に立ち、背後の ALB が入れ替わっても Global Accelerator 自身の DNS 名は変わらない |
| ALB の参照方法 | `data "aws_lb"` をタグ (`ingress.k8s.aws/stack=application`, `elbv2.k8s.aws/cluster=eks-${var.environment}`) で検索 | ALB 名のランダムサフィックスは再作成のたび変わるため名前では引けない。`panicboat/platform` 側の実装時に実際の ALB ARN を正しく解決することを `terragrunt plan` で確認済み |
| master zone への書き込み | dystopia infra module に cross-account `aws.route53` provider を追加し、既存の `route53-zone-access` role (master account) を assume | 同ロールの trust policy は production account root を信頼しており、どの stack から assume しても良い。`aws/alb` で確立済みと同じパターン |
| zone ID の取得方法 | `panicboat/platform` の `aws/route53/lookup` モジュールをクロスリポジトリ参照せず、`data "aws_route53_zone" "dystopia_city"` を monorepo 側に直接複製する | 中身は data source 1つのみ。cross-repo module source (`git::` 参照) は version pinning と apply 時 fetch 依存を持ち込む。AWS 上のゾーン名という安定した契約面だけで platform と疎結合を保つ方がシンプル |
| 既存の未管理レコードの扱い | `allow_overwrite = true` で Terraform 管理下に奪取する | `aws/alb` の ACM 検証レコードで既に使われている確立済みパターンを踏襲 |
| `panicboat/platform` 側の変更 | `application` Ingress から `external-dns.alpha.kubernetes.io/hostname: dystopia.city` annotation を削除するのみ残す (PR #960 で対応済み) | Ingress 自体は共有 ALB の定義であり platform が持つのが適切。今後 external-dns がこの apex を触らないようにするため annotation 削除は必要 |

### 却下した案

- **`panicboat/platform` の `aws/alb` スタックに置く** — 最初の実装で試みてレビューで却下。依存方向が逆転する (Background 参照)
- **CloudFront で前段を作る** — CloudFront の ACM 証明書は us-east-1 固定で、現行の *.dystopia.city 証明書 (ap-northeast-1) を流用できない。動的アプリのためキャッシュ挙動を明示的に無効化する設計も必要
- **NLB + Elastic IP で前段を作る** — 最もシンプルだが、ALB の L7 機能 (host/path routing の IngressGroup) を維持するには ALB の前にもう一段 NLB を挟む構成になり、ホップが増える
- **`platform` の `route53/lookup` モジュールを `git::` source で直接参照する** — version pinning の複雑さと apply 時の外部 fetch 依存が増える。4行の data source を複製する方が単純で疎結合

## Target Structure

```
dystopia/
  infrastructure/
    aws/
      modules/
        terraform.tf         (変更: aws.route53 provider 追加)
        variables.tf         (変更: route53_zone_role_arn 追加)
        data.tf               (変更: aws_route53_zone.dystopia_city 追加)
        global_accelerator.tf (新規: accelerator/listener/endpoint_group/route53 apex record)
        outputs.tf            (変更: application_accelerator_dns_name 追加)
      production/
        env.hcl               (変更: route53_zone_role_arn 追加)
        terragrunt.hcl         (変更: route53_zone_role_arn を inputs に追加)
```

## Terraform Changes

- `modules/terraform.tf`: `panicboat/platform` の `aws/alb/modules/terraform.tf` と同じ形で `provider "aws" { alias = "route53" ... assume_role { role_arn = var.route53_zone_role_arn } }` を追加
- `modules/variables.tf`: `variable "route53_zone_role_arn"` を追加 (`aws/alb` と同じ description)
- `modules/data.tf`: `data "aws_route53_zone" "dystopia_city" { name = "dystopia.city." private_zone = false }` を `provider = aws.route53` で追加。`data "aws_lb" "application"` をタグ検索で追加 (Decisions 参照)
- `modules/global_accelerator.tf` (新規):
  - `aws_globalaccelerator_accelerator.dystopia_city` (name = `"dystopia-city-${var.environment}"`, ip_address_type = IPV4, enabled = true)
  - `aws_globalaccelerator_listener.dystopia_city` (TCP, port_range 443-443)
  - `aws_globalaccelerator_endpoint_group.dystopia_city` (endpoint_group_region = var.aws_region, endpoint_configuration に `data.aws_lb.application.arn` / `client_ip_preservation_enabled = true`)
  - `aws_route53_record.dystopia_city_apex` (`provider = aws.route53`, zone_id = `data.aws_route53_zone.dystopia_city.zone_id`, type A, alias に accelerator の dns_name/hosted_zone_id, `allow_overwrite = true`)
- `modules/outputs.tf`: `output "application_accelerator_dns_name"` を追加
- `production/env.hcl`: `route53_zone_role_arn = "arn:aws:iam::559744160976:role/route53-zone-access"` を追加
- `production/terragrunt.hcl`: inputs に `route53_zone_role_arn = include.env.locals.route53_zone_role_arn` を追加

ALB は IPv4 のみ (production 側で確認済み)、リスナーも 443 のみのため AAAA・追加リスナーは不要。

## Data Flow / Operational Behavior

- **通常時**: client → `dystopia.city` → Global Accelerator の静的 DNS 名 → production ALB → cilium gateway → HTTPRoute → `frontend` Service
- **ALB 入れ替え時 (EKS 再作成など、稀な操作)**: `dystopia/infrastructure/aws/production` で `terragrunt apply` を再実行するだけで、タグベース lookup が新しい ALB を自動検出し、Global Accelerator の endpoint group を更新する。master 側の Route53 レコードは一切変更不要 (Global Accelerator の DNS 名は不変のため)

## Risks

| リスク | 影響 | 緩和 |
|---|---|---|
| `client_ip_preservation_enabled = true` が VPC 内に `GlobalAccelerator` という名前の EC2 Security Group を自動作成する | `panicboat/platform` の `eks-production-recreate` runbook が VPC を destroy する際、このSGを事前に手動削除しないと `DependencyViolation` で teardown が止まる | このスペックでは対応しない (runbook は別リポジトリ)。実装後、ユーザー判断で `panicboat/platform` の `docs/runbooks/eks-production-recreate.md` §5 Failure handling に1行追記することを提案する |
| `dystopia/infrastructure/aws/production` は本番 state 適用済み・稼働中 | 新規リソース追加が既存 (RDS/Cognito 等) に意図しない diff を発生させる可能性 | 新規リソースは別ファイル (`global_accelerator.tf`) にのみ追加し、既存リソースには触れない。apply 前に `terragrunt plan` で既存リソースへの diff がゼロであることを確認する |
| `allow_overwrite = true` による既存レコードの奪取 | apply のタイミングで数秒程度の DNS 応答ギャップが生じうる (`panicboat/platform` での実装時にも同種の挙動を観測済み) | 実際の cutover (apply) タイミングは別途明示的に確認してから実行する |

## Validation

- `tofu validate`
- 実 `terragrunt plan` (production account、cross-account 含む) で新規4リソースのみが `create` になり、既存リソース (RDS/Cognito/Secrets Manager 等) に diff が出ないことを確認

## Out of Scope

- 実際の `terragrunt apply` (DNS cutover) — 別途明示的に確認してから実施
- external-dns の `--domain-filter=dystopia.city` 自体の削除 — 他ドメイン (panicboat.net) と domain-filter を共有しており、影響範囲の精査は別タスク
- `eks-production-recreate` runbook の Failure handling テーブルへの追記 — 提案のみ、実施は別途確認
- `panicboat/platform` PR #960 (Ingress annotation 削除) — 既に別 PR として提出済み、本 spec の対象外
