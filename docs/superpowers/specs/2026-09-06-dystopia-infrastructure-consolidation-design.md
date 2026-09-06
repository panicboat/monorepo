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

Separately, `dystopia/monolith/infrastructure/stripe/production/` (added by the 2026-08-29
refactor as scaffolding for the not-yet-implemented billing slice's IaC) has zero resources
today — just `terraform { required_version = ">= 1.0" }`. The billing slice's application
code already exists (`dystopia/monolith/slices/billing/`), but its Stripe API access is
necessarily independent of this empty stack today, since the stack provisions nothing. There
is nothing to move.

## Decisions

| 論点 | 決定 | 理由 |
|---|---|---|
| 配置単位 | `dystopia/infrastructure/aws/{environment}` に集約。`dystopia/monolith/infrastructure/` と `dystopia/frontend/infrastructure/` は削除 | `dystopia` はまだ frontend/monolith の2デプロイ単位を持つ一つのプロダクト。Cognito (frontend) と RDS+Cognito 権限 (monolith) は同じ認証基盤の両面であり、サービス間 `dependency` で繋ぐより1つの state で持つ方が実態に合う |
| Stripe stack | 移動せず削除 | `dystopia/monolith/infrastructure/stripe/` は resource ゼロの空 stub。実 Stripe 統合が要るタイミングで4ファイル程度を作り直せば足りる。今回のスコープは「frontend/monolith 間の分割解消」であり、存在しない資産を運ぶ理由がない |
| Terraform module | frontend の `user_pool.tf`/`sms_role.tf` と monolith の `main.tf`(RDS/SG/Secrets Manager container)/`pod_identity.tf` を1モジュールに統合 | `cognito_user_pool_arn` を module 外部入力にする必要が無くなり、`aws_cognito_user_pool.this.arn` を直接参照できる |
| `dependency "cognito"` block | 削除 | 同一 state 内になるため cross-stack 参照が不要になる |
| provider version 制約 | monolith 側 (`aws 6.60.0` 固定 / `random ~> 3.9`) に統一 | 2つの `terraform.tf` のうちより新しく厳格な方を採用。RDS module (`random_password`) を含むので `random` provider が必須 |
| workflow-config.yaml の discovery | `dystopia/{service}` 規約の `terragrunt id:aws` の `directory` を `infrastructure/aws/{environment}` → `aws/{environment}` に変更するのみ。`id: stripe` entry は削除 | `panicboat/deploy-actions` の `label-resolver` は `{service}` capture ベースで discovery する (`dystopia/infrastructure/aws/{environment}` は `service="infrastructure"` として自然に一致する)。`container`/`kubernetes` stack も同じ規約内で `service="infrastructure"` に対して評価されるが、対策は下記の通り monorepo 自身の reusable workflow 側で行う (deploy-actions/workflow-config.yaml の責務ではない) |
| `container` stack の誤発火対策 | `.github/workflows/reusable--container-builder.yaml` に Dockerfile 存在チェックを追加し、無ければ build/push 系ステップを skip | `dystopia/infrastructure` ディレクトリの存在だけで `container` stack (`directory: .`) が `service="infrastructure"` にマッチし、`deploy-container` job が呼ばれる。実際に何を build するか (Dockerfile の有無) は deploy-actions の関知することではなく、build を実行する monorepo 自身の reusable workflow の責務。ここで吸収するのが責務分離として正しい |
| root.hcl の project_name / state key | `project_name = "dystopia"`、state key `dystopia/infrastructure/${environment}/terraform.tfstate` | 新規パスなので state migration 不要。旧 `dystopia/monolith/...` `dystopia/frontend/...` の名残りを引き継がない |
| common_tags の組み方 | frontend 側のパターン (`include "root" { expose = true }` + `merge(include.root.locals.common_tags, include.env.locals.additional_tags)`) を採用 | monolith 側は `include.root` を expose せず `common_tags` を production/terragrunt.hcl で丸ごと再定義しており、結果的に root.hcl の `Project`/`ManagedBy`/`Repository`/`Component`/`Team` タグが shallow merge で握り潰されていた。2つの既存パターンを1つに統合する必要があり、より正しい方を採用する |

### 却下した案

- **`workflow-config.yaml` に `services: [name: infrastructure]` の `stack_conventions` override を追加し、`container`/`kubernetes` stack を無効化する** — 最初に検討した案。動作はするが、「`dystopia/infrastructure` が container として buildable かどうか」を deploy-actions 側の config で表現することになり、責務が逆転する。実際に build を試みる/試みないの判断は monorepo 自身の `reusable--container-builder.yaml` が持つべきで、discovery 層(deploy-actions)の関知することではない
- **`panicboat/deploy-actions` に `marker_file` 的な仕組み(directory 存在に加えてファイル存在も見る)を追加する** — 同様に汎用 discovery ロジックに「Dockerfile を見る」という container 固有の知識を持ち込むことになり、deploy-actions の責務外。かつ別リポの release サイクルを挟むため今回のスコープには重い
- **`dystopia/infrastructure/` を作らず、`dystopia/{service}` 規約に `{service}="infrastructure"` を素朴に許容する** — `find_matching_conventions` は convention 単位でマッチするため、`container` stack の directory (`.`) が `dystopia/infrastructure` の存在だけで誤って matching conventions に入り、何も対策しなければ container build が発火する。対策自体は必要で、上記の通り monorepo 側の reusable workflow で行う
- **`dystopia` 直下ではなく新規トップレベルディレクトリ (`dystopia-infrastructure/`) に置く** — ユーザーが意図した「`dystopia/infrastructure` 的な」配置と乖離する。reusable workflow 側の対策で `dystopia/{service}` 規約のまま安全に成立するため不要
- **`dystopia/{service}` 規約自体から `container`/`kubernetes` エントリを削除する** — frontend/monolith は今後も `container`/`kubernetes` stack を使い続けるため、規約自体から削除すると本来必要な2サービス分の discovery が壊れる
- **stripe を空 stub のまま `dystopia/infrastructure/stripe/` に移動する** — 中身が無い資産をわざわざ運ぶ理由がない。削除して実際に必要になった時に作り直す方が単純

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
      # id: stripe entry は削除 (Stripe stack 自体を削除するため)
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
```

`system-components/{service}` 規約は無変更(directory 名 `infrastructure/aws/{environment}` はそのまま — pennyworth は今回のスコープ外)。`services:` セクションは追加しない。

`dystopia/infrastructure/aws/production` が存在することで、変更後の規約は `service="infrastructure"` を自然に discover する(root-alone パターン)。この規約の `container`/`kubernetes` stack も `service="infrastructure"` に対して評価されるが、`kubernetes` は対応ディレクトリ(`dystopia/infrastructure/kubernetes/overlays/production`)を作らないため素通しで一致せず、`container` は次項の reusable workflow 側の対策で無害化する。discovery 層(workflow-config.yaml / deploy-actions)には手を入れない。

## CI Workflow Changes

`.github/workflows/reusable--container-builder.yaml` の `build-and-push` job に、checkout 直後 Dockerfile 存在チェックを追加し、以降の login/buildx/build-push ステップを `if:` で gate する。

```yaml
      - name: Checkout repository
        uses: actions/checkout@...

      - name: Check for Dockerfile
        id: dockerfile
        run: |
          if [ -f "${{ inputs.working-directory }}/Dockerfile" ]; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Log in to the Container registry
        if: steps.dockerfile.outputs.exists == 'true'
        ...
      - name: Set up Docker Buildx
        if: steps.dockerfile.outputs.exists == 'true'
        ...
      - name: Extract metadata (tags, labels) for Docker
        if: steps.dockerfile.outputs.exists == 'true'
        ...
      - name: Build and push Docker image
        if: steps.dockerfile.outputs.exists == 'true'
        ...
```

`deploy-container` job 自体(`auto-label--deploy-trigger.yaml`)は無変更 — `working-directory: dystopia/infrastructure` で呼ばれても、reusable workflow 内で no-op になるだけで job 自体は green で終わる。

## Terraform Changes

- `main.tf` の `aws_iam_policy.monolith_cognito_admin_delete` の `Resource` を `var.cognito_user_pool_arn` → `aws_cognito_user_pool.this.arn` に変更
- `variables.tf` から `cognito_user_pool_arn` 変数を削除
- `pod_identity.tf` は無変更 (既に `var.environment` ベースで自己完結)
- `outputs.tf` は frontend/monolith 両方の output を1ファイルに統合

## Path Changes

| 対象 | 変更前 | 変更後 |
|---|---|---|
| aws stack 実体 | `dystopia/{monolith,frontend}/infrastructure/aws/production/` | `dystopia/infrastructure/aws/production/` |
| stripe stack 実体 | `dystopia/monolith/infrastructure/stripe/production/` | (削除) |
| aws stack state key | `dystopia/monolith/production/terraform.tfstate`(未 apply)、`dystopia/frontend/production/terraform.tfstate`(未 apply) | `dystopia/infrastructure/production/terraform.tfstate`(新規) |
| `root.hcl` の `project_name` | monolith側 `"services"`、frontend側 `"frontend"` | `"dystopia"` |

state はどちらも未 apply (production account 337169763788 の S3 bucket に該当 key は存在しないことを事前確認済み) なので `terraform state mv` は不要。

## README updates

| ファイル | 更新 |
|---|---|
| `README.md` / `README-ja.md` | Deployment > Mechanics の `terragrunt` 行を `dystopia/infrastructure/aws/{environment}` に修正。「`dystopia/monolith` は2 id (`aws`/`stripe`) を持つ」という記述を削除し、`dystopia/infrastructure` が frontend/monolith 共有の AWS リソース(Cognito・RDS)を1 stack で持つ旨に書き換え |
| `dystopia/monolith/README.md` / `README-ja.md` | `infrastructure/aws/production/` `infrastructure/stripe/production/` の記述を削除し、`dystopia/infrastructure/` を参照する形に変更。`frontend/infrastructure/aws/production` への `dependency` 言及も削除。Stripe scaffold の説明も削除(stub 自体を削除するため) |
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
| `reusable--container-builder.yaml` の `if:` gate の書き損じ | 本物の Dockerfile がある service (`monolith`/`frontend`/`pennyworth`) の build まで skip されてしまう | Draft PR で3サービス全ての container job が従来通り build/push されることを確認してからマージする |
| common_tags の組み方をfrontend側パターンに統一したことで、実際にAWSへ適用されるタグが変わる | 既存の(まだ何も apply していない)想定タグ集合と差異が出るが実害は無い(まだ何もリソースが存在しない) | 適用前の変更であるため実質リスクなし。plan で新しいタグ集合を確認する |
| 統合 module の `outputs.tf` で名前衝突(frontend/monolith 双方に無かった重複 output 名)が無いか | terraform plan がエラーになる | 出力名は `user_pool_*` と `rds_*`/`secret_*` で prefix が分かれており衝突しない(確認済み) |
| billing slice が空 stub の Stripe stack に何らかの形で暗黙依存していないか | stub 削除で気づかれずに壊れる | stub は resource ゼロ (`terraform { required_version = ">= 1.0" }` のみ) で何も provision していないため、削除しても既存動作に影響しないことを確認済み(下記 Validation) |

## Validation

- `terragrunt run -- init -backend=false && terragrunt run -- validate` を `dystopia/infrastructure/aws/production` で実行し、HCL/Terraform 構文と `source = "../modules"` の解決を確認(2026-08-29 spec と同じ理由で、dependency block が無くなったため monolith 相当の制限は無くなり、通常の `-backend=false` 検証が可能)
- `git grep -rn "infrastructure/aws\|infrastructure/stripe\|dependency \"cognito\"" dystopia/` の残存が README 更新後にゼロであることを確認
- `git grep -rn "stripe" dystopia/monolith/slices/billing dystopia/monolith/lib` で Stripe stack (terraform) 側への参照が無い(app 側は Stripe API を直接叩いており、terraform stub とは無関係)ことを確認
- Draft PR で label-dispatcher が実際に `deploy:infrastructure` label を付与し、`deploy-terragrunt` matrix に `aws` の1 target のみが現れることを CI 上で確認
- 同じ Draft PR で `deploy-container` matrix に `infrastructure` target が現れても、`reusable--container-builder.yaml` が Dockerfile 無しで gracefully skip し、job が green で終わることを確認
- 同じ Draft PR で `monolith`/`frontend`/`pennyworth` の container build が従来通り実行されることを確認(gate の書き損じが無いことの回帰確認)

## Out of Scope

- 本番 AWS への実際の `terragrunt apply`、RDS 起動、Secrets Manager 値投入、`kubectl scale` による pod 復旧 — 別タスクとして本 spec 承認後に実施
- Stripe Terraform provider の実装、および実際に必要になった時の scaffold 再作成
- `system-components/pennyworth` のレイアウト変更
- 将来 `dystopia` を実際にマイクロサービス化する際の再分割設計(本 spec は「まだモノリスである現状」に最適化するものであり、将来分割時は改めて再設計する)
