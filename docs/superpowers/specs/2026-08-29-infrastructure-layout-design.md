# Reshape infrastructure layout across monorepo and platform

## Background

現在、各サービスの Terragrunt stack は 2 リポで以下のように配置されている。

- `panicboat/monorepo`: `dystopia/{service}/aws/{root.hcl, modules/, envs/{environment}/}` および `system-components/{service}/aws/...`。frontend は Cognito、monolith は RDS + Cognito Pod Identity、holmes は監視系。
- `panicboat/platform`: `aws/{service}/{root.hcl, modules/, envs/{environment}/}` および `github/{service}/...`、`kubernetes/components/{service}/{environment}/`。

以下 3 点の構造課題が同時に浮かんでいる。

1. **monolith が Stripe SaaS を利用し始めた**（`dystopia/monolith/slices/billing/`）が、Stripe 由来のリソースを IaC 管理するディレクトリが無い。AWS と Stripe は provider が別で state を混ぜたくない。
2. **`envs/` 層は semantic を運んでいない**。`envs/production/` の "envs" は付加情報を持たず、パス深度と読解負荷だけ増やす。`root.hcl` の env 導出は path 末尾 1 要素で行っており、`envs/` を消しても env の解決ロジックは無影響。
3. **provider を並べて置く受け皿が欲しい**。Stripe が入る場所を `aws/` と並列に置ける semantics（例: `infrastructure/aws/`, `infrastructure/stripe/`）にしておくと、将来 provider が増えても既存 IaC 領域が動かずに済む。

3 件は独立ではなく、単一の再設計の別側面である。

さらに、Stripe stack を CI に載せるためには `workflow-config.yaml` の `stack_conventions` に同一サービス下で 2 つの Terragrunt entry（AWS と Stripe）を持たせる必要がある。`panicboat/deploy-actions` v1.2.0 は同一 `name` の stack エントリを silent dedupe する仕様のため、そのままでは Stripe 側が CI から見えない。deploy-actions 側の拡張が本 refactor の必要条件になる。

## Decisions

| 論点 | 決定 | 理由 |
|---|---|---|
| provider 束ね | `infrastructure/{provider}/` を導入 | `aws/` と `stripe/` を peer 配置する semantics を明示。今後の provider（gcp 等）追加も同じ層に置ける |
| envs/ 層 | 廃止し `infrastructure/{provider}/{environment}/` に平坦化 | `envs/` は情報を運ばず、path 末尾 1 要素で env を導出する root.hcl の解釈と両立可能 |
| Stripe stack の実体 | ディレクトリと空 scaffold のみ | root.hcl / 空 modules / production/{env.hcl, terragrunt.hcl} を敷き、CI で no-op apply が通る形にする。実 provider 導入は別 PR |
| stack name の統一 | 両 terragrunt entry の `name` は `terragrunt` のまま | reusable workflow の dispatch は name で決まる。Stripe も terragrunt-executor を通す |
| Instance identity | `stack_conventions[].stacks[].id`（optional）を新設 | GH Actions の step `id:` と同じく、disambiguation が要る時に付与する。unique 制約は convention 内 |
| 重複時の挙動 | `id || name` が unique でなければ loading error | v1.2.0 の silent dedupe を廃止し、fail-fast で修正を促す |
| deploy-actions | v1.3.0 として上流に PR | 拡張は backward-compatible。既存 config は id を書かなければ従来動作 |
| platform 側の再構成 | 同じ envs/ 廃止を平行実施 | 統一規約に揃える。cross-service lookup を持つ stack は `source` の相対を 1 段浅く直す |

### 却下した案

- **stack name を `terragrunt-aws` / `terragrunt-stripe` に分ける** — reusable workflow (`reusable--terragrunt-executor.yaml`) の dispatch は stack name で判定される。name を割ると deploy-trigger.yaml の 2 箇所（`contains(...'"stack":"terragrunt"')` と `matrix.target.stack == 'terragrunt'`）を条件式のまま拡張し続ける必要が出て、entry 追加ごとに CI YAML を触ることになる。identity は `id` で持たせる方が clean。
- **`infrastructure/` は付けず peer に `aws/` `stripe/` を並べる** — 深さは 1 段減るが、"どのグルーピングか" が消える。今後 non-IaC 直下フォルダとの区別も曖昧になる。
- **envs/ を残したまま Stripe だけ追加** — envs/ の情報空虚問題は残る。今回の refactor で決着させる方が cleanup 一度で済む。
- **`id` を required にする** — GH Actions の step id と同じく、disambiguation が要らない時は書かずに済むのが慣習として自然。required だと `id: kubernetes` `id: container` などの trivial 記述が全 config に増える。
- **id 未指定・name 重複時に silent dedupe** — v1.2.0 の罠を残すことになる。本 refactor の発端がこの挙動なので同じ轍を踏まない。
- **id を directory から auto-derive** — 生成される id が読みづらく、config を眺めた時に identity が自明でなくなる。

## Target Structure

### monorepo

```
dystopia/
  monolith/
    infrastructure/
      aws/
        root.hcl
        modules/
        production/
          env.hcl
          terragrunt.hcl
      stripe/                          ← 新規
        root.hcl
        modules/
        production/
          env.hcl
          terragrunt.hcl
    <アプリ本体, kubernetes/, ...>
  frontend/
    infrastructure/
      aws/
        root.hcl
        modules/
        production/{env.hcl, terragrunt.hcl}
    <アプリ本体, kubernetes/, ...>
system-components/
  holmes/
    infrastructure/
      aws/
        root.hcl
        modules/
        production/{env.hcl, terragrunt.hcl}
    <アプリ本体, kubernetes/, ...>
```

### platform

```
aws/
  {service}/                            # eks, alb, vpc, github-oidc-auth, ...
    root.hcl
    modules/
    {environment}/                      ← 旧 envs/{environment}/
      env.hcl
      terragrunt.hcl
github/
  {service}/                            # repository, branch
    root.hcl
    modules/
    {environment}/
      env.hcl
      terragrunt.hcl
kubernetes/
  components/
    {service}/
      {environment}/                    # 既存どおり (envs/ なし)
```

## workflow-config.yaml

### monorepo/workflow-config.yaml

```yaml
stack_conventions:
  - root: dystopia/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        id: aws                                          # ← id 追加
        directory: infrastructure/aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: terragrunt
        id: stripe                                       # ← id 追加、monolith のみ実体を持つ
        directory: infrastructure/stripe/{environment}
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
```

`system-components/{service}` 側は Stripe を持たないため single terragrunt entry のまま。id 未指定で `name` fallback となる。

### platform/workflow-config.yaml

```yaml
stack_conventions:
  - root: "aws/{service}"
    stacks:
      - name: terragrunt
        directory: "{environment}"                       # 旧 "envs/{environment}"
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]

  - root: "github/{service}"
    stacks:
      - name: terragrunt
        directory: "{environment}"
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]

  - root: "kubernetes/components/{service}"
    stacks:
      - name: kubernetes
        directory: "{environment}"
```

platform は同一 convention 内で `name: terragrunt` が重複することは無いので id 追加は不要。convention をまたぐ `aws/{service}/terragrunt` と `github/{service}/terragrunt` は片方のみ実在するサービスばかりで、`find_matching_conventions` が実在 root だけを返すため衝突しない（monorepo と同じ挙動）。

## deploy-actions v1.3.0 拡張

### 新設: `stacks[].id`

- optional。未指定なら `name` にフォールバック
- convention 内で `id || name` が unique（fallback 込みで衝突検査）
- GH Actions の step `id:` と同じく、識別が要らない時は書かない

### Identity resolution

同一 convention の `stacks` 内で、各エントリの identity は `id || name`（id が無ければ name に fallback）で決まる。この identity 値が convention 内で unique であれば OK、重複すれば loading error。`name` の重複自体は禁止されず、`id` で distinguish されていれば許容される。

| entries | identity | 判定 |
|---|---|---|
| `name: terragrunt, id: aws` と `name: terragrunt, id: stripe` | `aws` と `stripe` | 別物 → **許容**（monolith の想定 use case） |
| `name: terragrunt` と `name: terragrunt`（両方 id 無し） | `terragrunt` と `terragrunt` | 重複 → **loading error** |
| `name: terragrunt, id: aws` と `name: terragrunt`（片方だけ id） | `aws` と `terragrunt` | 別物 → 許容だが読みづらい。README で「複数エントリなら両方に id を書くのが推奨」と 1 行添える |
| `name: kubernetes` と `name: terragrunt, id: kubernetes` | `kubernetes` と `kubernetes` | 重複 → **loading error** |

`name` は「どの reusable workflow へ dispatch するか」を決める category、`id` は「convention 内での instance identity」という役割分離。monorepo/monolith の `name: terragrunt, id: aws` と `name: terragrunt, id: stripe` は、reusable--terragrunt-executor.yaml に同一 dispatch されつつ working_directory と matrix.target.stack_id で下流が識別できる構造になる。

**convention をまたぐ dedupe は変えない**: 上表の unique 制約は「同一 convention 内」に閉じたスコープであり、`aws/{service}` convention と `github/{service}` convention のように**別々の convention**がそれぞれ 1 個ずつ `name: terragrunt`（id 無し）を持つケース（platform の既存構成）は対象外。この場合の matrix 生成側の dedupe（`matching_conventions.flat_map { ... }.uniq { |s| s['id'] || s['name'] }`）は convention をまたいで動作するため、id が両方とも無ければ identity は両方とも `'terragrunt'` になり、v1.2.0 と同じく「1 target・first wins」のまま変わらない（VERIFIED: scratch 環境で実行し確認）。新しい複数 target 機能は「同一 convention 内で `id` により明示的に区別する」場合にのみ働く。

### `WorkflowConfig` (shared/entities/workflow_config.rb)

| 場所 | 変更 |
|---|---|
| L19-23 `stack_attributes_for(env, id_or_name)` | `env.stacks[id]` を優先し、無ければ `env.stacks[name]` に fallback。どちらも解決しない場合は `nil` ではなく必ず `{}` を返す（`DeploymentTarget.new(attributes: nil)` の crash を防ぐ） |
| L26-33 `required_attributes_for(id_or_name)` | 同じく id 優先、name fallback |
| L36-63 `stack_conventions_for(service, stack)` | 現状 `.find { |s| s['name'] == stack }` を `.find { |s| (s['id'] || s['name']) == stack }` に変更（**訂正**: 当初「削除」の予定だったが、`config-manager`（`config_manager_controller.rb:75` の `test_service_configuration`）がこの API を `stack_convention_for` 経由で直接呼んでおり、削除すると `bin/config-manager test` が壊れることが plan 作成時の検証で判明した。identity ベースの matching に変えることで維持する） |
| L114-145 `validate!` | 各 convention の `stacks` で `id || name` が unique であることを検査。重複時 `stack_conventions[i].stacks has duplicate identity '<value>' (entries with the same 'name' need distinct 'id' values)` を raise |

### `ConfigManagerController` (config-manager/controllers/config_manager_controller.rb)

plan 作成時に発見した既存バグ（VERIFIED、scratch 環境で再現・修正確認済み）: `test_service_configuration`（`bin/config-manager test <service> <env>` の実装）は `stack_directories[stack_def['name']] = ...` のように **`stack_def['name']` だけをキー**にしてハッシュを組み立てている。convention 内に `name: terragrunt` が 2 エントリ（`id: aws` / `id: stripe`）あると、同じキーに 2 回書き込まれ後勝ちで片方が消える。`stack_def['id'] || stack_def['name']` をキーにするよう修正する。

### `DeploymentTarget` (shared/entities/deployment_target.rb)

| 場所 | 変更 |
|---|---|
| L6 `FIXED_RESERVED_KEYS` | `stack_id` を追加 |
| L8-9 `attr_reader` | `stack_id` を追加 |
| L11-36 `initialize` | `stack_id:` キーワード引数を追加。未指定なら `stack` の値をコピー |
| L38-47 `to_matrix_item` | 出力 hash に `stack_id: stack_id` を追加 |

`==` / `hash` は現状の `[service, environment, stack, working_directory]` で識別できるので変更不要。

### `GenerateMatrix` (label-resolver/use_cases/generated_matrix.rb)

| 場所 | 変更 |
|---|---|
| L69-116 `generate_targets_for_service` | `matching_conventions.flat_map { \|c\| c['stacks'] \|\| [] }.uniq { \|s\| s['id'] \|\| s['name'] }` に変更。以降 `stack_name` の代わりに `stack_config` を引き回す |
| L244-270 `generate_deployment_target` | 引数を `stack_name` から `stack_config`（name, id, directory 込み）に変更。stack_config の `directory` で `expand → File.directory?` を行い、生成する DeploymentTarget に `stack_id` を渡す |
| L274-293 `full_pattern_for` | stack_config を受け取る形にリファクタ |
| L363-398 `extract_root_from_working_dir` | 単一 convention 内に同名 stack が複数ある可能性を考慮した走査に |

### spec

| 場所 | 変更 |
|---|---|
| `spec/label-resolver/use_cases/generate_matrix_spec.rb:524-575` | 既存 "dedupes by stack name" テストは仕様変更で不適合。id 未指定・name 重複 → validation error の negative test に置換。同一 name + 異なる id → 2 target の positive test を追加 |
| `spec/shared/entities/workflow_config_spec.rb` | id fallback、convention 内 unique 検査の test を追加 |
| `spec/shared/entities/deployment_target_spec.rb` | `stack_id` フィールドの test、`to_matrix_item` への出現、id 未指定時の fallback を追加 |
| `spec/factories.rb` | factory 定義に `stack_id` を追加 |
| `CHANGELOG.md` | v1.3.0 エントリ。id フィールド追加と backward compatibility、silent dedupe 廃止の note |

### 互換性

- 既存 config（platform の 3 convention、monorepo の refactor 前 config）で `id` を書かない限り挙動は不変
- `env.stacks[stack_name]` は fallback パスとして残るので既存 attributes 解決も不変
- `id: aws` を書いた時のみ、attributes を `env.stacks.aws` に置く選択肢が生まれる（現行 `env.stacks.terragrunt` にも fallback するので段階的移行が可能）
- **唯一の breaking**: `id` 未指定で `name` 重複を書いていた config は v1.3.0 以降 loading error になる。platform / monorepo の refactor 前 config はこの状態を作っていないため実質影響なし

## Path Changes

### monorepo — Terragrunt

| 対象 | 変更前 | 変更後 |
|---|---|---|
| terragrunt stack directory | `aws/envs/{environment}` | `infrastructure/aws/{environment}` |
| stripe stack directory | （無し） | `infrastructure/stripe/{environment}` |
| `terragrunt.hcl` の `source` | `../../modules` | `../modules` |
| monolith → frontend の `dependency.config_path` | `../../../../frontend/aws/envs/production` | `../../../../frontend/infrastructure/aws/production` |
| `root.hcl` の path parsing (`element(path_parts, -1)`) | 変更不要 | 末尾要素方式は不変 |
| `root.hcl` の state key (`dystopia/{service}/${env}/terraform.tfstate`) | 変更不要 | env 名は不変、state migration 不要 (VERIFIED) |

### platform — Terragrunt

| pattern | 旧 source | 新 source |
|---|---|---|
| ローカルモジュールのみ (`iam-service-linked-roles`, `github-oidc-auth`, `vpc`, `cost-management`, `github/{repository,branch}`) | `../../modules` | `../modules` |
| cross-service lookup + go-getter subdir (`eks-traces`, `eks-metrics`, `alb`, `eks-secrets`, `eks-holmesgpt`, `eks-karpenter`, `eks`, `eks-logs`, `route53`) | `../../..//{svc}/modules` | `../..//{svc}/modules` |

`root.hcl` の env 導出と state key は monorepo と同じ理由で不変。

### monorepo — Stripe scaffold

Stripe stack は空 scaffold を敷く。

- `dystopia/monolith/infrastructure/stripe/root.hcl` — monolith の aws/root.hcl を base に、`local.project_name = "monolith-stripe"`、state key を `dystopia/monolith-stripe/${local.environment}/terraform.tfstate` に、common tags に `Component = "monolith-stripe"` を設定
- `dystopia/monolith/infrastructure/stripe/modules/terraform.tf` — `terraform { required_version = ">= 1.x" }` のみ。Stripe provider 宣言は本 refactor に含めず別 PR
- `dystopia/monolith/infrastructure/stripe/production/env.hcl` — aws/production/env.hcl と同構造。`Purpose = "monolith-stripe"`
- `dystopia/monolith/infrastructure/stripe/production/terragrunt.hcl` — aws 版から `dependency "cognito"` と cognito 用 inputs を除いたもの。`source = "../modules"`、remote_state の key は `dystopia/monolith-stripe/${include.env.locals.environment}/terraform.tfstate`

これで `terragrunt validate/plan/apply` が空リソース状態で通り、CI matrix で no-op として扱われる。

## CI Changes

### monorepo

- `.github/workflows/*.yaml` — 変更不要。deploy-actions の pin を v1.2.0 → v1.3.0（commit SHA）に更新するのみ
- `workflow-config.yaml` — 上記 "monorepo/workflow-config.yaml" セクションに準拠

### platform

- `.github/workflows/*.yaml` — 同じく deploy-actions の pin を v1.3.0 に更新
- `workflow-config.yaml` — 上記 "platform/workflow-config.yaml" セクションに準拠

### platform 側のスクリプト・config 書き換え

以下は `envs/` ハードコードが残っている箇所（全て `envs/` を削除する形で修正）。

- `scripts/eks-lifecycle/lib/30-destroy-stacks.sh` — `aws/${stack}/envs/${ENV}` → `aws/${stack}/${ENV}`
- `scripts/eks-lifecycle/lib/common.sh` — `aws/eks/envs/${ENV}/env.hcl` → `aws/eks/${ENV}/env.hcl`
- `scripts/kubernetes-hydrate/hydrate-component.sh` — `aws/eks/envs/${env}/env.hcl` → `aws/eks/${env}/env.hcl`
- `.github/renovate.json` — regex `/^aws/eks/envs/.+/env\.hcl$/` → `/^aws/eks/.+/env\.hcl$/`

## README / docs updates

### monorepo

| ファイル | 更新 |
|---|---|
| `README.md` / `README-ja.md` | "Stacks" 一覧に `terragrunt` を追加。monolith が `aws` / `stripe` の 2 id を持つ点を注記 |
| `dystopia/monolith/README.md` / `README-ja.md` | 新レイアウト `infrastructure/{aws,stripe}/production/` の説明を追加。Stripe scaffold の意図（空 modules で no-op apply）を 1 行触れる |
| `dystopia/frontend/README.md` / `README-ja.md` | 現状 `aws/envs/` への直接言及は無いが、diagram / 例示に差分があれば更新 |
| `system-components/holmes/README.md` / `README-ja.md` | 同上 |

### platform

| ファイル | 更新 |
|---|---|
| `README.md` / `README-ja.md` | ツリー例と表 (`aws/{service}/envs/{environment}` → `aws/{service}/{environment}`, github 側も同様)。root.hcl 参照文言も追随 |
| `aws/iam-service-linked-roles/README.md` | 見出し `## envs/production のみを使う` → `## production 環境のみを使う`。本文 `envs/production` `envs/staging` から `envs/` を削除 |
| `aws/eks/README.md` | 例示コマンド `cd aws/eks/envs/production` → `cd aws/eks/production`。`envs/production/env.hcl` → `production/env.hcl` |
| `scripts/eks-lifecycle/README.md` | 例示 `cd aws/$stack/envs/production` → `cd aws/$stack/production` |

### deploy-actions

| ファイル | 更新 |
|---|---|
| `README.md` / `README-ja.md` | `stack_conventions` 例に `id` を optional として追記、fallback ルール、convention 内 unique 制約、silent dedupe 廃止を明記。matrix output 表に `stack_id` 行、JSON 例に `"stack_id"` を追加 |
| `action-scripts/config-manager/README.md` / `README-ja.md` | 同上。id を含む config スキーマ、validate ルール |
| `action-scripts/label-resolver/README.md` / `README-ja.md` | matrix item 例に `stack_id` 追加、「same `name` with different `id` produces multiple targets」を明示 |
| `action-scripts/label-dispatcher/README.md` / `README-ja.md` | 例示パス `services/auth/aws/envs/develop/main.tf` → `services/auth/aws/develop/main.tf` |
| `CHANGELOG.md` | v1.3.0 エントリ (id フィールド追加、backward compatibility、silent dedupe 廃止) |

README を触るスタンス:

- 現状の記述（What）を更新するのが主。表・パス・例示は「現在の状態」を書く場所なので新レイアウトに追随する
- Why の追記は最低限。「なぜ id を入れたか」は deploy-actions CHANGELOG に一度書き、README は宣言型で書き足す
- 「以前は envs/ でした」等のマイグレーション記録は残さない（AGENTS.md の "現在の状態を表す名前をつける" 準拠）

## Not Changing

- **terraform state**（S3 backend の key） — env 名が path 末尾のまま `production` として抽出されるので不変。state migration 不要 (VERIFIED)
- **root.hcl の env 抽出ロジック** — `element(path_parts, -1)` は末尾要素方式で `envs/` 有無に依存しない
- **`kubernetes/overlays/{environment}` / `kubernetes/components/{service}/{environment}`** — 既に flat で envs/ が無い。無変更
- **既存 provider の Terraform modules 内部** — module 内部の `.tf` は relative import せず自己完結しているため無変更
- **release-please の package キー** — service ルートは変わらないので不変
- **Flux の kustomize overlay パス** — kubernetes/overlays 配下は不変
- **panicboat/deploy-actions の他消費者への影響** — 探索した限り monorepo と platform のみが利用。deploy-actions v1.3.0 は既存 config で id を書かない限り 100% backward-compatible（唯一の破壊点は "id 未指定 + name 重複" だが、両リポの refactor 前 config はこの状態を作っていない）

## Risks

| リスク | 影響 | 緩和 |
|---|---|---|
| deploy-actions v1.3.0 リリースが遅れる、または PR がマージされない | monorepo/platform の CI 移行が blocked | 上流 PR を先に投げ、review 進捗と並行して monorepo/platform 側の branch を準備。手元では local git ref を tag として一時 pin し validate |
| terragrunt の `source` 相対 path の書き換え漏れ | plan/apply が失敗 | 変更対象の terragrunt.hcl を grep して洗い出し、`terragrunt hclvalidate && terragrunt init` を各 stack で回す |
| monolith → frontend の `dependency.config_path` 更新漏れ | monolith terragrunt が cognito output を解決できず fail | `terragrunt plan --terragrunt-log-level=info` で dependency 解決ログを確認 |
| Stripe scaffold の terragrunt が空 modules で validate 失敗 | CI の deploy-terragrunt job が fail | terraform 側で `terraform { required_version = ">= 1.x" }` のみ持たせ、resource ゼロで plan/apply が no-op で通ることを実測して確認 |
| deploy-actions の silent dedupe を残す config が他に存在 | 発火時に validation error で fail-fast | 検査は monorepo / platform 内のみ確認。他リポは deploy-actions を消費していないことを事前検索で verify 済み |
| README 更新で古い記述が残る | doc drift | grep で `envs/` `aws/envs/` `envs/production` を全リポでゼロ確認 |
| workflow-config validation が deploy-actions 更新前に config を先出しすると壊す | fail-fast が deploy time に起きる | monorepo / platform の PR はデプロイ順序を明確化: deploy-actions v1.3.0 リリース → 各リポで pin 更新 → workflow-config 変更 |
| `environments:` に sibling directory 名と衝突する env（例: `modules`, `lookup`）を追加すると label-resolver が誤って target 生成する | terragrunt が `terragrunt.hcl` の無いディレクトリで init しようとして runtime fail | env 名は sibling directory（`modules`, `lookup`, `root.hcl` などの静的ファイル/ディレクトリ）と衝突させない。この規約は README に注記。将来的には deploy-actions に「terragrunt stack なら `terragrunt.hcl` 存在必須」のガードを入れる余地あり（今回の scope 外） |

## Validation

- `git grep -F "aws/envs" -- ':!.claude/worktrees' ':!docs/superpowers'` の残存ゼロ（monorepo）
- `git grep -E 'envs/(production|master|develop)' -- ':!.claude/worktrees' ':!docs/superpowers'` の残存ゼロ（両リポ）
### terragrunt 検証コマンド (実測で確定)

`terragrunt hclvalidate` は terragrunt 1.1.3 で廃止されており（`terragrunt hcl validate` に改名、未知コマンドの forward も停止）、`terragrunt init` を backend 付きで走らせると実 AWS の S3 / DynamoDB に到達する。ローカル検証では以下を使う。

- 全 stack: `terragrunt hcl validate` — HCL 構文。monolith ではこれが `dependency` block を実際に解決し、frontend config を読んで mock outputs 適用の警告を出す（＝ `config_path` が正しいことの証明になる）
- dependency を持たない stack (frontend / holmes / stripe): `terragrunt run -- init -backend=false` → `terragrunt run -- validate`。`source = "../modules"` が新しい深さで解決することを実証する
- monolith: `-backend=false` では `dependency` が解決できず `Unknown variable; There is no variable named "dependency"` で落ちるため init/validate は行わない。代わりに `test -d ../modules` と `test -f ../../../../frontend/infrastructure/aws/production/terragrunt.hcl` で構造検証する
- **ローカルでは実行しない**: backend 付き `terragrunt init`、`terragrunt plan`、`terragrunt apply`。実 state に対する plan 検証は CI もしくは開発者の手元に委ねる（既知の限界として PR に明記する）

対象 stack:

- monorepo: `dystopia/monolith/infrastructure/aws/production`、`dystopia/monolith/infrastructure/stripe/production`、`dystopia/frontend/infrastructure/aws/production`、`system-components/holmes/infrastructure/aws/production`
- platform: aws 側 (`aws/{svc}/{production または master または develop}/`) と github 側 (`github/{svc}/master/`)。env 名はサービスごとに異なる（`production`: alb, eks 群, vpc, iam-service-linked-roles、`master`: cost-management, route53, github-oidc-auth, github/repository, github/branch、`develop`/`production`: github-oidc-auth）ため、`find aws github -name env.hcl` で発見して全網羅する
- deploy-actions: `cd action-scripts && bundle exec rspec`（追加 spec 込みで green）
- deploy-actions: `bin/config-manager validate` を platform の workflow-config.yaml に対して実行し、既存 config が変更後も success で通ることを確認（VERIFIED: 現行 config で事前に success 確認済み）
- deploy-actions: monorepo の workflow-config.yaml は `environments: []` が空のままなので `bin/config-manager validate` は本 refactor 前後を問わず `"No environments defined"` で fail する（VERIFIED: 現行 config で再現確認済み、本 refactor と無関係の pre-existing 状態）。id validation 自体は scratch config（`environments:` を populate した最小構成）に対して `bin/config-manager validate` または rspec で確認する
- monorepo / platform の PR で label-dispatcher / label-resolver actions が実 CI で新 config を解決できることを Draft PR で verify
- monorepo: `deploy:monolith` label 付き PR で terragrunt matrix に AWS / Stripe の 2 target が現れることを Draft PR で verify

## Out of Scope

- Stripe Terraform provider（`stripe/stripe`）の導入と実 resource（webhook endpoint / products / prices 等）の宣言 — 別 PR
- CI の Stripe 用 secret 供給（AWS Secrets Manager 経由の `stripe_secret_ref` 等の attributes 拡張）— 実 provider 導入 PR と同時
- monorepo の `environments:` セクション本格化（develop 有効化含む）— 別途判断
- platform の master 環境の `stacks:` を id ベースに移す作業（`env.stacks.terragrunt` を保つ限り fallback で動くため急がない）
- deploy-actions の他機能（例: `id` を required にする将来の major bump）— 本 refactor では optional のまま
