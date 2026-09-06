# Consolidate dystopia's per-service infrastructure into dystopia/infrastructure

## Background

`docs/superpowers/specs/2026-08-29-infrastructure-layout-design.md` established the
current layout: each service under `dystopia/{service}/` owns its own
`infrastructure/{aws,stripe}/{environment}/` Terragrunt stack. That refactor was a
deliberate decision, not an accident — it intentionally kept `dystopia/monolith` and
`dystopia/frontend` symmetrical with `system-components/{service}`, and it explicitly
wired `dystopia/monolith/infrastructure/aws/production` to read
`dystopia/frontend/infrastructure/aws/production`'s Cognito output via a Terragrunt
`dependency` block.

Separately, production infrastructure was never actually applied for `dystopia`.
`eks-production` was recreated in a new dedicated AWS account (337169763788) on
2026-09-04 (`panicboat/platform` `docs/runbooks/eks-production-recreate.md`). CI's
`terragrunt` stack only runs `apply` when a PR touching that path merges to `main`
(`.github/workflows/auto-label--deploy-trigger.yaml`); no such push happened after the
account switch, so the new account's `terragrunt-state-337169763788` S3 bucket has no
`dystopia/*` state, no RDS instance, and no Cognito user pool exist yet. The `dystopia`
namespace's `monolith`/`frontend` Deployments are also stuck at `replicas: 0` — a manual
mitigation from the 2026-09-04 recreate's node-churn incident (same runbook, §5) that
was never reverted.

While diagnosing that gap, it became clear the per-service split has a cost: `dystopia`
is still one product with exactly two deployable units (`frontend`, `monolith`) that
share the same Cognito user pool. Splitting Cognito (frontend) from RDS + the Cognito
admin-delete permission (monolith) into separate Terragrunt stacks forces a cross-directory
`dependency` block for something that isn't really a service boundary yet. No state has
been applied under either stack in the new account, so this is the last moment to change
the layout without a state migration.

This spec covers only the layout change. The actual first-time `terragrunt apply` /
Secrets Manager provisioning / pod restart to bring `dystopia` up on EKS is a separate,
already-agreed operational task that happens after this lands, unchanged in substance —
only the working directory moves.

## Decisions

| 論点 | 決定 | 理由 |
|---|---|---|
| 配置単位 | `dystopia/infrastructure/{aws,stripe}/{environment}` に集約。`dystopia/monolith/infrastructure/` と `dystopia/frontend/infrastructure/` は削除 | `dystopia` はまだ frontend/monolith の2デプロイ単位を持つ一つのプロダクト。Cognito (frontend) と RDS+Cognito 権限 (monolith) は同じ認証基盤の両面であり、サービス間 `dependency` で繋ぐより1つの state で持つ方が実態に合う |
| Terraform module | frontend の `user_pool.tf`/`sms_role.tf` と monolith の `main.tf`(RDS/SG/Secrets Manager container)/`pod_identity.tf` を1モジュールに統合 | `cognito_user_pool_arn` を module 外部入力にする必要が無くなり、`aws_cognito_user_pool.this.arn` を直接参照できる |
| `dependency "cognito"` block | 削除 | 同一 state 内になるため cross-stack 参照が不要になる |
| provider version 制約 | monolith 側 (`aws 6.60.0` 固定 / `random ~> 3.9`) に統一 | 2つの `terraform.tf` のうちより新しく厳格な方を採用。RDS module (`random_password`) を含むので `random` provider が必須 |
| workflow-config.yaml の discovery | `dystopia/{service}` 規約の `terragrunt id:aws`/`id:stripe` の `directory` を `infrastructure/aws/{environment}` → `aws/{environment}` (stripe 同様) に変更し、`services:` セクションを新設して `name: infrastructure` に対し `container`/`kubernetes` stack を無効化する `stack_conventions` override を追加 | `panicboat/deploy-actions` の `label-resolver` は `{service}` capture ベースで discovery する設計 (`all_directory_patterns` は `{service}` を含むパターンしか見ない)。`dystopia/infrastructure/` を単純に作ると `container` stack (`directory: .`) が `service="infrastructure"` として誤マッチし、存在しない Dockerfile を build しようとして CI が壊れる。ソースを直接確認して検証済み (下記 Validation) |
| root.hcl の project_name / state key | `project_name = "dystopia"`、state key `dystopia/infrastructure/${environment}/terraform.tfstate`(aws)、`dystopia/infrastructure-stripe/${environment}/terraform.tfstate`(stripe) | 新規パスなので state migration 不要。旧 `dystopia/monolith-stripe/...` 等の名残りを引き継がない |
| common_tags の組み方 | frontend 側のパターン (`include "root" { expose = true }` + `merge(include.root.locals.common_tags, include.env.locals.additional_tags)`) を採用 | monolith 側は `include.root` を expose せず `common_tags` を production/terragrunt.hcl で丸ごと再定義しており、結果的に root.hcl の `Project`/`ManagedBy`/`Repository`/`Component`/`Team` タグが shallow merge で握り潰されていた。2つの既存パターンを1つに統合する必要があり、より正しい方を採用する |

### 却下した案

- **`dystopia/infrastructure/` を作らず、`dystopia/{service}` 規約に `{service}="infrastructure"` を素朴に許容する** — `find_matching_conventions` は convention 単位でマッチするため、`container` stack の directory (`.`) が `dystopia/infrastructure` の存在だけで誤って matching conventions に入り、`services:` override 無しでは container build が発火する。回避には override が必須で、「素朴に許容する」だけでは成立しない
- **`dystopia` 直下ではなく新規トップレベルディレクトリ (`dystopia-infrastructure/`) に置く** — CI 側の懸念だけを見れば安全だが、ユーザーが意図した「`dystopia/infrastructure` 的な」配置と乖離する。`services:` override で `dystopia/{service}` 規約のまま安全に成立させられるため不要
- **`services:` override を使わず、`dystopia/{service}` 規約自体から `container`/`kubernetes` エントリを削除する** — frontend/monolith は今後も `container`/`kubernetes` stack を使い続けるため、規約自体から削除すると本来必要な2サービス分の discovery が壊れる
- **stripe stack も aws stack と統合して1つの state にする** — provider が異なる (aws vs stripe) ため、既存方針 (2026-08-29 spec) 通り state を分けたままにする。今回のスコープは「frontend/monolith 間の分割」の解消であり「provider 間の分割」は変更しない

## Target Structure

```
dystopia/
  infrastructure/
    aws/
      root.hcl
      modules/
        terraform.tf
        variables.tf
        user_pool.tf        (← frontend/infrastructure/aws/modules/user_pool.tf)
        sms_role.tf          (← frontend/infrastructure/aws/modules/sms_role.tf)
        main.tf              (← monolith/infrastructure/aws/modules/main.tf, cognito_user_pool_arn 参照を内部化)
        pod_identity.tf      (← monolith/infrastructure/aws/modules/pod_identity.tf)
        outputs.tf           (統合: user_pool_* / rds_* / secret_*)
      production/
        env.hcl
        terragrunt.hcl        (dependency block なし)
    stripe/
      root.hcl
      modules/
        terraform.tf          (中身は空 stub のまま移動)
      production/
        env.hcl
        terragrunt.hcl
  monolith/
    <アプリ本体, kubernetes/, ...>   (infrastructure/ 削除)
  frontend/
    <アプリ本体, kubernetes/, ...>   (infrastructure/ 削除)
```

`system-components/pennyworth` は無関係、無変更。

## workflow-config.yaml

```yaml
stack_conventions:
  - root: dystopia/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        id: aws
        directory: aws/{environment}          # was: infrastructure/aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: terragrunt
        id: stripe
        directory: stripe/{environment}        # was: infrastructure/stripe/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}

  - root: system-components/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        directory: infrastructure/aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}

services:
  - name: infrastructure
    stack_conventions:
      aws: dystopia/infrastructure/aws/{environment}
      stripe: dystopia/infrastructure/stripe/{environment}
```

`system-components/{service}` 規約は無変更(directory 名 `infrastructure/aws/{environment}` はそのまま — pennyworth は今回のスコープ外)。

新設した `services: [name: infrastructure]` は `stack_conventions` に `container`/`kubernetes` キーを含まないため、`WorkflowConfig#stack_conventions_for('infrastructure', 'container')` は空配列を返し、それらの stack は生成されない(`panicboat/deploy-actions` `action-scripts/shared/entities/workflow_config.rb` L45-55、`label-resolver/use_cases/generated_matrix.rb` の `stack_config_directory_exists?` 経由で確認済み)。discovery 自体は既存の `dystopia/{service}` root-alone パターン(`all_directory_patterns` が `{service}` を含む root をそのまま採用する仕様)で無償に成立するため、`stack_conventions_config` 側に新しい root を足す必要はない。

## Terraform Changes

- `main.tf` の `aws_iam_policy.monolith_cognito_admin_delete` の `Resource` を `var.cognito_user_pool_arn` → `aws_cognito_user_pool.this.arn` に変更
- `variables.tf` から `cognito_user_pool_arn` 変数を削除
- `pod_identity.tf` は無変更 (既に `var.environment` ベースで自己完結)
- `outputs.tf` は frontend/monolith 両方の output を1ファイルに統合

## Path Changes

| 対象 | 変更前 | 変更後 |
|---|---|---|
| aws stack 実体 | `dystopia/{monolith,frontend}/infrastructure/aws/production/` | `dystopia/infrastructure/aws/production/` |
| stripe stack 実体 | `dystopia/monolith/infrastructure/stripe/production/` | `dystopia/infrastructure/stripe/production/` |
| aws stack state key | `dystopia/monolith/production/terraform.tfstate`(未 apply)、`dystopia/frontend/production/terraform.tfstate`(未 apply) | `dystopia/infrastructure/production/terraform.tfstate`(新規) |
| stripe stack state key | `dystopia/monolith-stripe/production/terraform.tfstate`(未 apply) | `dystopia/infrastructure-stripe/production/terraform.tfstate`(新規) |
| `root.hcl` の `project_name` | monolith側 `"services"`、frontend側 `"frontend"` | `"dystopia"` |

state はどちらも未 apply (production account 337169763788 の S3 bucket に該当 key は存在しないことを事前確認済み) なので `terraform state mv` は不要。

## README updates

| ファイル | 更新 |
|---|---|
| `README.md` / `README-ja.md` | Deployment > Mechanics の `terragrunt` 行を `dystopia/infrastructure/{aws,stripe}/{environment}` に修正。`dystopia/monolith` が2 id を持つ、という記述を `dystopia/infrastructure` に付け替え |
| `dystopia/monolith/README.md` / `README-ja.md` | `infrastructure/aws/production/` `infrastructure/stripe/production/` の記述を削除し、`dystopia/infrastructure/` を参照する形に変更。`frontend/infrastructure/aws/production` への `dependency` 言及も削除 |
| `dystopia/frontend/README.md` / `README-ja.md` | 該当箇所があれば同様に更新(現状 grep ではヒットなし、diagram 等に無ければ変更不要) |

## Not Changing

- `dystopia/{monolith,frontend}/kubernetes/`、Dockerfile、container 定義 — 今回のスコープ外
- `system-components/pennyworth` 一式 — 無関係
- RDS のリソース定義自体(engine/instance_class/backup 設定等) — 移動のみ、値は変更しない
- Pod Identity の `namespace: dystopia` / `service_account: monolith` マッピング — k8s 側の構造は不変
- 本番への `terragrunt apply` 実行・Secrets Manager への値投入・pod scale up — 別タスク(本 spec の後続)

## Risks

| リスク | 影響 | 緩和 |
|---|---|---|
| `services:` override の key 名 (`aws`/`stripe`) が stack の `id` と一致していないと override が効かない | `container`/`kubernetes` の誤発火が再発する | `stack_conventions_for` は `id \|\| name` の値をキーに引くため、override の key を `terragrunt` の `id`(`aws`/`stripe`)に正確に合わせる。実装後に `bin/config-manager` 等で確認(Validation 参照) |
| common_tags の組み方をfrontend側パターンに統一したことで、実際にAWSへ適用されるタグが変わる | 既存の(まだ何も apply していない)想定タグ集合と差異が出るが実害は無い(まだ何もリソースが存在しない) | 適用前の変更であるため実質リスクなし。plan で新しいタグ集合を確認する |
| 統合 module の `outputs.tf` で名前衝突(frontend/monolith 双方に無かった重複 output 名)が無いか | terraform plan がエラーになる | 出力名は `user_pool_*` と `rds_*`/`secret_*` で prefix が分かれており衝突しない(確認済み) |

## Validation

- `terragrunt run -- init -backend=false && terragrunt run -- validate` を `dystopia/infrastructure/aws/production` と `dystopia/infrastructure/stripe/production` で実行し、HCL/Terraform 構文と `source = "../modules"` の解決を確認(2026-08-29 spec と同じ理由で、dependency block が無くなったため monolith 相当の制限は無くなり、両方とも通常の `-backend=false` 検証が可能)
- `git grep -rn "infrastructure/aws\|infrastructure/stripe\|dependency \"cognito\"" dystopia/` の残存が README 更新後にゼロであることを確認
- `panicboat/deploy-actions` の `action-scripts` を使い、`workflow-config.yaml` の新設定を `Entities::WorkflowConfig` に読み込ませ、`stack_conventions_for('infrastructure', 'container')` / `stack_conventions_for('infrastructure', 'kubernetes')` が `[]` を返し、`stack_conventions_for('infrastructure', 'aws')` / `('infrastructure', 'stripe')` が期待パスを返すことを確認( irb もしくは scratch spec で実行)
- 上記が確認できたら、Draft PR で label-dispatcher が実際に `deploy:infrastructure` label を付与し、`deploy-terragrunt` matrix に `aws`/`stripe` の2 target のみが現れ、`container`/`kubernetes` target が現れないことを CI 上で確認

## Out of Scope

- 本番 AWS への実際の `terragrunt apply`、RDS 起動、Secrets Manager 値投入、`kubectl scale` による pod 復旧 — 別タスクとして本 spec 承認後に実施
- Stripe Terraform provider の実装(現状 stub のまま移動するのみ)
- `system-components/pennyworth` のレイアウト変更
- 将来 `dystopia` を実際にマイクロサービス化する際の再分割設計(本 spec は「まだモノリスである現状」に最適化するものであり、将来分割時は改めて再設計する)
