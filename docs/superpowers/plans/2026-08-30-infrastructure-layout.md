# Infrastructure Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `infrastructure/{provider}/{env}/` layout in monorepo (with a Stripe scaffold under monolith), remove the `envs/` layer in platform, and extend `panicboat/deploy-actions` to v1.3.0 with an optional `stacks[].id` field so a service can carry multiple terragrunt entries with distinct working directories.

**Architecture:** Three sequential phases across three git repositories. Phase 1 releases `deploy-actions` v1.3.0 with backward-compatible `id` addition and identity-collision validation. Phase 2 reshapes monorepo directories (`aws/envs/{env}` → `infrastructure/aws/{env}`, add `infrastructure/stripe/` scaffold, update workflow-config with `id: aws` / `id: stripe`) and pins v1.3.0. Phase 3 flattens platform's `aws/{svc}/envs/{env}` → `aws/{svc}/{env}` (github/ too), updates workflow-config, scripts, and Renovate rule, and pins v1.3.0.

**Tech Stack:** Ruby 3.x (deploy-actions, RSpec, FactoryBot), Terragrunt + OpenTofu (both repos), YAML (workflow-config), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-29-infrastructure-layout-design.md`

## Global Constraints

- **deploy-actions**: `id` は optional。convention 内で `id || name` が unique（fallback 込み検査）。silent dedupe は廃止し validation error に。既存 config で `id` を書かない限り挙動不変。
- **State migration 不要**: `envs/` 削除および `infrastructure/` 挿入で terragrunt state key（`{repo}/{service}/${env}`）は不変（末尾 `${env}` を root.hcl の `element(path_parts, -1)` で導出）。
- **relative depth 保持**: monolith → frontend の `dependency.config_path` は新旧いずれも `../../../../` (4 段)。
- **branch/worktree**: 各 phase は該当リポの `.claude/worktrees/refactor-infrastructure-layout/`（branch `refactor/infrastructure-layout`）で作業。deploy-actions と platform の worktree は phase 開始時に `git worktree add -b refactor/infrastructure-layout .claude/worktrees/refactor-infrastructure-layout origin/main` で作成。monorepo は本 plan と同じ worktree を使用。
- **commit**: `git commit -s`（sign-off）。`Co-Authored-By` 付与禁止。commit title は English、Conventional Commits (`feat` / `fix` / `refactor` / `docs` / `chore` / `test`)。
- **push**: 一区切りついたら `git push -u origin HEAD` で tracking、その後 `gh pr create --draft` で Draft PR。

## File Structure

### Phase 1: deploy-actions

**Modify:**
- `action-scripts/shared/entities/workflow_config.rb` — id 一意性 validation、`stack_attributes_for` / `required_attributes_for` / `stack_conventions_for` の identity ベース解決（fallback 込み）
- `action-scripts/shared/entities/deployment_target.rb` — add `stack_id` field
- `action-scripts/config-manager/controllers/config_manager_controller.rb` — `test_service_configuration` を identity ベースの key に修正（plan 作成時に発見した既存バグの修正、詳細は Task 1.4）
- `action-scripts/label-resolver/use_cases/generated_matrix.rb` — iterate stack instances (name + id + directory)、副次的に dead code (旧 `stack_directory_exists?` / `generate_deployment_target` / `full_pattern_for` / `create_deployment_target`) を削除
- `action-scripts/spec/shared/entities/workflow_config_spec.rb` — id fallback / unique validation / `stack_conventions_for` identity tests
- `action-scripts/spec/shared/entities/deployment_target_spec.rb` — stack_id field / matrix output tests
- `action-scripts/spec/config-manager/controllers/config_manager_controller_spec.rb` — identity ベース key の positive test
- `action-scripts/spec/label-resolver/use_cases/generate_matrix_spec.rb` — id-based positive test を追加（既存 L524-575 の assertion は不変、title のみ更新）
- `action-scripts/spec/factories.rb` — add stack_id trait
- `README.md`, `README-ja.md` — id 導入、matrix output に stack_id、silent dedupe 廃止
- `action-scripts/config-manager/README.md`, `README-ja.md` — 同上
- `action-scripts/label-resolver/README.md`, `README-ja.md` — 同上
- `action-scripts/label-dispatcher/README.md`, `README-ja.md` — 同上、例示パスの envs/ 削除
- `CHANGELOG.md` — v1.3.0 entry

### Phase 2: monorepo

**Move (git mv):**
- `dystopia/frontend/aws/` → `dystopia/frontend/infrastructure/aws/`（root.hcl, modules/, envs/production/ を配下ごと。envs/production は infrastructure/aws/production に平坦化）
- `dystopia/monolith/aws/` → `dystopia/monolith/infrastructure/aws/`（同様）
- `system-components/holmes/aws/` → `system-components/holmes/infrastructure/aws/`（同様）

**Create:**
- `dystopia/monolith/infrastructure/stripe/root.hcl`
- `dystopia/monolith/infrastructure/stripe/modules/terraform.tf`
- `dystopia/monolith/infrastructure/stripe/production/env.hcl`
- `dystopia/monolith/infrastructure/stripe/production/terragrunt.hcl`

**Modify:**
- 各 `terragrunt.hcl` の `source = "../../modules"` → `"../modules"`
- `dystopia/monolith/infrastructure/aws/production/terragrunt.hcl` の `dependency "cognito".config_path` を `../../../../frontend/aws/envs/production` → `../../../../frontend/infrastructure/aws/production`
- `workflow-config.yaml` — stack_conventions を `infrastructure/{aws,stripe}/{env}` に差し替え、monolith 用に `id: aws` / `id: stripe` の 2 terragrunt entry
- `.github/workflows/auto-label--label-dispatcher.yaml`, `.github/workflows/auto-label--deploy-trigger.yaml` — deploy-actions ピンを v1.3.0 の commit SHA に更新
- `README.md`, `README-ja.md` — Stacks 一覧に terragrunt 追加、monolith の 2 id 注記
- `dystopia/monolith/README.md`, `README-ja.md` — 新レイアウト説明、Stripe scaffold の意図 1 行
- `dystopia/frontend/README.md`, `README-ja.md` — 差分あれば
- `system-components/holmes/README.md`, `README-ja.md` — 差分あれば

### Phase 3: platform

**Move (git mv):**
- `aws/{svc}/envs/{env}/` → `aws/{svc}/{env}/` — 対象: alb, cost-management, eks, eks-holmesgpt, eks-karpenter, eks-logs, eks-metrics, eks-secrets, eks-traces, github-oidc-auth, iam-service-linked-roles, karpenter, route53, vpc
- `github/{svc}/envs/{env}/` → `github/{svc}/{env}/` — 対象: repository, branch

**Modify:**
- ローカルモジュールのみの terragrunt.hcl（iam-service-linked-roles / github-oidc-auth / vpc / cost-management / github/repository / github/branch）: `source = "../../modules"` → `"../modules"`
- cross-service lookup + go-getter subdir の terragrunt.hcl（eks-traces / eks-metrics / alb / eks-secrets / eks-holmesgpt / eks-karpenter / eks / eks-logs / route53）: `source = "../../..//{svc}/modules"` → `"../..//{svc}/modules"`
- `workflow-config.yaml` — 全 convention の `directory: "envs/{environment}"` → `"{environment}"`
- `.github/workflows/auto-label--label-dispatcher.yaml`, `.github/workflows/auto-label--deploy-trigger.yaml` — deploy-actions ピンを v1.3.0 の commit SHA に更新
- `scripts/eks-lifecycle/lib/30-destroy-stacks.sh` — `aws/${stack}/envs/${ENV}` → `aws/${stack}/${ENV}`
- `scripts/eks-lifecycle/lib/common.sh` — `aws/eks/envs/${ENV}/env.hcl` → `aws/eks/${ENV}/env.hcl`
- `scripts/kubernetes-hydrate/hydrate-component.sh` — `aws/eks/envs/${env}/env.hcl` → `aws/eks/${env}/env.hcl`
- `.github/renovate.json` — regex `/^aws/eks/envs/.+/env\.hcl$/` → `/^aws/eks/.+/env\.hcl$/`
- `README.md`, `README-ja.md` — ツリー例 + 表の envs/ 削除
- `aws/iam-service-linked-roles/README.md` — 見出しと本文の envs/ 削除
- `aws/eks/README.md` — 例示コマンド / パス の envs/ 削除
- `scripts/eks-lifecycle/README.md` — 例示 envs/ 削除

---

## Phase 1: deploy-actions v1.3.0

作業リポ: `/Users/takanokenichi/GitHub/panicboat/deploy-actions`

### Task 1.0: worktree 準備

**Files:** worktree の物理作成のみ。ファイル編集なし。

**Interfaces:** N/A

- [ ] **Step 1: worktree 作成**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/deploy-actions
git fetch origin
git worktree add -b refactor/infrastructure-layout \
  .claude/worktrees/refactor-infrastructure-layout origin/main
```
Expected: `Preparing worktree ...` および `HEAD is now at <sha>`。

- [ ] **Step 2: .git/info/exclude 更新**

`/.claude/worktrees/` が exclude に無ければ追加。

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/deploy-actions
grep -qxF '/.claude/worktrees/' .git/info/exclude || \
  printf '\n/.claude/worktrees/\n' >> .git/info/exclude
```

- [ ] **Step 3: 以降の作業ディレクトリを worktree に切替**

以降 Phase 1 の全 task は `/Users/takanokenichi/GitHub/panicboat/deploy-actions/.claude/worktrees/refactor-infrastructure-layout` を作業ディレクトリとする。

---

### Task 1.1: `DeploymentTarget` に `stack_id` field を追加

**Files:**
- Modify: `action-scripts/shared/entities/deployment_target.rb`
- Test: `action-scripts/spec/shared/entities/deployment_target_spec.rb`
- Modify: `action-scripts/spec/factories.rb`

**Interfaces:**
- Consumes: 既存 `Entities::DeploymentTarget.new(service:, stack:, working_directory:, ...)`
- Produces:
  - `Entities::DeploymentTarget#stack_id` — String, `stack_id:` キーワード引数（optional）、未指定なら `stack` と同じ値
  - `Entities::DeploymentTarget#to_matrix_item` は hash key `:stack_id` を追加
  - `Entities::DeploymentTarget::FIXED_RESERVED_KEYS` に `'stack_id'` を追加
  - factory `:deployment_target` は default で `stack_id { stack }`、trait `:with_stack_id` を追加

- [ ] **Step 1: 失敗テストを書く**

`action-scripts/spec/shared/entities/deployment_target_spec.rb` の末尾（`RSpec.describe` ブロック内）に追加:

```ruby
  describe '#stack_id' do
    it 'defaults to stack when not provided' do
      target = described_class.new(
        service: 'monolith',
        stack: 'terragrunt',
        working_directory: 'dystopia/monolith/infrastructure/aws/production'
      )
      expect(target.stack_id).to eq('terragrunt')
    end

    it 'accepts an explicit stack_id distinct from stack' do
      target = described_class.new(
        service: 'monolith',
        stack: 'terragrunt',
        stack_id: 'aws',
        working_directory: 'dystopia/monolith/infrastructure/aws/production'
      )
      expect(target.stack_id).to eq('aws')
    end
  end

  describe '#to_matrix_item' do
    it 'exposes stack_id in the matrix output' do
      target = described_class.new(
        service: 'monolith',
        stack: 'terragrunt',
        stack_id: 'stripe',
        working_directory: 'dystopia/monolith/infrastructure/stripe/production'
      )
      item = target.to_matrix_item
      expect(item[:stack_id]).to eq('stripe')
    end

    it 'exposes stack_id equal to stack when not explicitly set' do
      target = described_class.new(
        service: 'monolith',
        stack: 'kubernetes',
        working_directory: 'dystopia/monolith/kubernetes/overlays/production'
      )
      item = target.to_matrix_item
      expect(item[:stack_id]).to eq('kubernetes')
    end
  end

  describe 'FIXED_RESERVED_KEYS' do
    it 'includes stack_id so captures cannot collide with it' do
      expect(Entities::DeploymentTarget::FIXED_RESERVED_KEYS).to include('stack_id')
    end

    it 'raises when captures collide with stack_id' do
      expect {
        described_class.new(
          service: 'foo',
          stack: 'terragrunt',
          working_directory: 'foo/bar',
          captures: { 'stack_id' => 'boom' }
        )
      }.to raise_error(ArgumentError, /reserved DeploymentTarget field/)
    end
  end
```

- [ ] **Step 2: 失敗確認**

Run:
```bash
cd action-scripts && bundle exec rspec spec/shared/entities/deployment_target_spec.rb
```
Expected: 上記 5 example が fail（`stack_id` メソッド無し、matrix item に key 無し、FIXED_RESERVED_KEYS に含まれず）。既存 example は pass のまま。

- [ ] **Step 3: 実装を追加**

`action-scripts/shared/entities/deployment_target.rb` を編集:

L6 `FIXED_RESERVED_KEYS` に `stack_id` を追加:
```ruby
    FIXED_RESERVED_KEYS = %w[service environment stack stack_id working_directory stack_convention_root].freeze
```

L8-9 `attr_reader` に `stack_id` を追加:
```ruby
    attr_reader :service, :environment, :stack, :stack_id,
                :working_directory, :stack_convention_root, :attributes, :captures
```

L11-14 `initialize` シグネチャに `stack_id:` を追加、`@stack_id` の代入を追加:
```ruby
    def initialize(service:, stack:, working_directory:,
                   environment: nil, stack_convention_root: nil,
                   stack_id: nil,
                   attributes: {}, captures: {})
      raise ArgumentError, "service is required"           if service.nil?           || service.empty?
      raise ArgumentError, "stack is required"             if stack.nil?             || stack.empty?
      raise ArgumentError, "working_directory is required" if working_directory.nil? || working_directory.empty?

      attr_keys = attributes.keys.map(&:to_s)
      captures.each_key do |raw_key|
        key = raw_key.to_s
        if FIXED_RESERVED_KEYS.include?(key)
          raise ArgumentError, "captures key '#{key}' collides with a reserved DeploymentTarget field"
        end
        if attr_keys.include?(key)
          raise ArgumentError, "captures key '#{key}' collides with an attributes key"
        end
      end

      @service               = service
      @environment           = environment
      @stack                 = stack
      @stack_id              = stack_id || stack
      @working_directory     = working_directory
      @stack_convention_root = stack_convention_root
      @attributes            = attributes.freeze
      @captures              = captures.freeze
    end
```

L38-47 `to_matrix_item` に `stack_id` を追加:
```ruby
    def to_matrix_item
      {
        service: service,
        environment: environment,
        stack: stack,
        stack_id: stack_id,
        working_directory: working_directory,
        stack_convention_root: stack_convention_root,
      }.merge(attributes.transform_keys(&:to_sym))
       .merge(captures.transform_keys(&:to_sym))
    end
```

- [ ] **Step 4: factory に stack_id を追加**

`action-scripts/spec/factories.rb` L20-55 の `:deployment_target` を編集:

```ruby
  factory :deployment_target, class: 'Entities::DeploymentTarget' do
    service { "test-service" }
    environment { "develop" }
    stack { "terragrunt" }
    stack_id { stack }
    working_directory { "test-service/terragrunt/develop" }
    stack_convention_root { "test-service" }
    attributes do
      {
        "aws_region" => "ap-northeast-1",
        "iam_role_plan" => "arn:aws:iam::123456789012:role/plan-role",
        "iam_role_apply" => "arn:aws:iam::123456789012:role/apply-role"
      }
    end

    initialize_with do
      new(
        service: service,
        environment: environment,
        stack: stack,
        stack_id: stack_id,
        working_directory: working_directory,
        stack_convention_root: stack_convention_root,
        attributes: attributes
      )
    end

    trait :kubernetes do
      stack { "kubernetes" }
      stack_id { "kubernetes" }
      working_directory { "test-service/kubernetes/overlays/develop" }
      attributes { {} }
    end

    trait :staging do
      environment { "staging" }
      working_directory { "test-service/terragrunt/staging" }
    end

    trait :with_stripe_id do
      stack_id { "stripe" }
      working_directory { "test-service/infrastructure/stripe/develop" }
    end
  end
```

- [ ] **Step 5: 再テスト**

Run:
```bash
cd action-scripts && bundle exec rspec spec/shared/entities/deployment_target_spec.rb
```
Expected: 全 example PASS。

- [ ] **Step 6: 全体 rspec 実行 (回帰チェック)**

Run:
```bash
cd action-scripts && bundle exec rspec
```
Expected: 全 example PASS（この時点で `stack_id` はデフォルトで `stack` と同値なので、既存の matrix item 消費側の spec も壊れない）。

- [ ] **Step 7: commit**

```bash
git add action-scripts/shared/entities/deployment_target.rb \
        action-scripts/spec/shared/entities/deployment_target_spec.rb \
        action-scripts/spec/factories.rb
git commit -s -m "feat(deployment_target): add stack_id field with default fallback

Adds a stack_id attribute that defaults to stack when omitted, exposed
via to_matrix_item so downstream matrix consumers can distinguish
multiple stack instances that share the same reusable-workflow name."
```

---

### Task 1.2: `WorkflowConfig#validate!` で identity 一意検査を追加

**Files:**
- Modify: `action-scripts/shared/entities/workflow_config.rb:114-145`
- Test: `action-scripts/spec/shared/entities/workflow_config_spec.rb`

**Interfaces:**
- Consumes: `Entities::WorkflowConfig.new(config_hash)`（既存）
- Produces: `WorkflowConfig#validate!` は各 convention の `stacks` の中で `stack['id'] || stack['name']` が unique であることを検査。重複時は `raise StandardError, "Configuration validation failed: stack_conventions[<i>].stacks has duplicate identity '<value>' (entries with the same 'name' need distinct 'id' values)"` を発生。

- [ ] **Step 1: 失敗テストを書く**

`action-scripts/spec/shared/entities/workflow_config_spec.rb` の末尾に追加:

```ruby
  describe 'identity uniqueness (id || name) within a convention' do
    let(:environments) do
      [{ 'environment' => 'production', 'stacks' => {} }]
    end

    it 'accepts two entries with the same name but distinct ids' do
      expect {
        described_class.new(
          'environments' => environments,
          'stack_conventions' => [
            {
              'root' => 'dystopia/{service}',
              'stacks' => [
                { 'name' => 'terragrunt', 'id' => 'aws',    'directory' => 'infrastructure/aws/{environment}' },
                { 'name' => 'terragrunt', 'id' => 'stripe', 'directory' => 'infrastructure/stripe/{environment}' }
              ]
            }
          ]
        )
      }.not_to raise_error
    end

    it 'accepts two entries with the same id in different conventions' do
      expect {
        described_class.new(
          'environments' => environments,
          'stack_conventions' => [
            { 'root' => 'aws/{service}',    'stacks' => [{ 'name' => 'terragrunt', 'directory' => '{environment}' }] },
            { 'root' => 'github/{service}', 'stacks' => [{ 'name' => 'terragrunt', 'directory' => '{environment}' }] }
          ]
        )
      }.not_to raise_error
    end

    it 'rejects duplicate name without id in the same convention' do
      expect {
        described_class.new(
          'environments' => environments,
          'stack_conventions' => [
            {
              'root' => 'dystopia/{service}',
              'stacks' => [
                { 'name' => 'terragrunt', 'directory' => 'a/{environment}' },
                { 'name' => 'terragrunt', 'directory' => 'b/{environment}' }
              ]
            }
          ]
        )
      }.to raise_error(StandardError, /duplicate identity 'terragrunt'/)
    end

    it 'rejects when one entry has an id that collides with another entry name' do
      expect {
        described_class.new(
          'environments' => environments,
          'stack_conventions' => [
            {
              'root' => 'dystopia/{service}',
              'stacks' => [
                { 'name' => 'kubernetes', 'directory' => 'kubernetes/overlays/{environment}' },
                { 'name' => 'terragrunt', 'id' => 'kubernetes', 'directory' => 'infrastructure/aws/{environment}' }
              ]
            }
          ]
        )
      }.to raise_error(StandardError, /duplicate identity 'kubernetes'/)
    end
  end
```

- [ ] **Step 2: 失敗確認**

Run:
```bash
cd action-scripts && bundle exec rspec spec/shared/entities/workflow_config_spec.rb -e "identity uniqueness"
```
Expected: 4 example 中、後半 2 個の raise_error テストが fail（現状は silent に通してしまう）。

- [ ] **Step 3: 実装を追加**

`action-scripts/shared/entities/workflow_config.rb` L114-145 の `validate!` を編集して uniqueness チェックを追加:

```ruby
    def validate!
      errors = []

      errors << "Missing required section: environments" unless raw_config['environments']
      errors << "Missing required section: stack_conventions" unless raw_config['stack_conventions']

      if raw_config['environments']
        raw_config['environments'].each_with_index do |env, index|
          unless env['environment']
            errors << "Environment at index #{index} missing required field: environment"
          end
        end
      end

      if raw_config['stack_conventions']
        unless raw_config['stack_conventions'].is_a?(Array)
          errors << "stack_conventions must be an array"
        else
          raw_config['stack_conventions'].each_with_index do |conv, index|
            unless conv['root']
              errors << "stack_conventions[#{index}] missing required field: root"
            end
            unless conv['stacks']
              errors << "stack_conventions[#{index}] missing required field: stacks"
            end

            stacks = conv['stacks'] || []
            seen = {}
            stacks.each do |stack|
              identity = stack['id'] || stack['name']
              next unless identity
              if seen.key?(identity)
                errors << "stack_conventions[#{index}].stacks has duplicate identity '#{identity}' (entries with the same 'name' need distinct 'id' values)"
                break
              end
              seen[identity] = true
            end
          end
        end
      end

      raise StandardError, "Configuration validation failed: #{errors.join(', ')}" unless errors.empty?
    end
```

- [ ] **Step 4: 再テスト**

Run:
```bash
cd action-scripts && bundle exec rspec spec/shared/entities/workflow_config_spec.rb
```
Expected: 全 example PASS。

- [ ] **Step 5: 全体 rspec (回帰チェック)**

Run:
```bash
cd action-scripts && bundle exec rspec
```
Expected: 全 example PASS。

- [ ] **Step 6: commit**

```bash
git add action-scripts/shared/entities/workflow_config.rb \
        action-scripts/spec/shared/entities/workflow_config_spec.rb
git commit -s -m "feat(workflow_config): validate identity uniqueness within convention

Identity is 'id || name' per stack entry; duplicates in the same
convention now raise a Configuration validation failure so users learn
to disambiguate with an id instead of silently dropping the entry."
```

---

### Task 1.3: `stack_attributes_for` / `required_attributes_for` / `stack_conventions_for` に identity ベースの解決を追加

**Files:**
- Modify: `action-scripts/shared/entities/workflow_config.rb:19-33` (`stack_attributes_for`, `required_attributes_for`), `:36-63` (`stack_conventions_for`)
- Test: `action-scripts/spec/shared/entities/workflow_config_spec.rb`

**Interfaces:**
- Consumes: `WorkflowConfig#stack_attributes_for(env_name, stack_name)`, `WorkflowConfig#required_attributes_for(stack_name)`, `WorkflowConfig#stack_conventions_for(service_name, stack)`
- Produces: 3 API とも引数を `stack_key`（`id || name`）として受け取る。`stack_attributes_for` は `env.dig('stacks', stack_key)` を最優先、無ければ `stack_conventions` を走査して該当エントリの `name` を fallback key として `env.dig('stacks', name)` を試し、どちらも無ければ必ず `{}` を返す（`nil` を返さない）。`stack_conventions_for` は `convention['stacks']&.find { |s| (s['id'] || s['name']) == stack }` に変更し、convention 内で `id` により個別解決できるようにする。

**設計ノート（重要）**: 元の design spec（`docs/superpowers/specs/2026-08-29-infrastructure-layout-design.md` の「deploy-actions v1.3.0 拡張」節）では `stack_conventions_for` を「削除」する案を書いていたが、plan 作成時に検証した結果、`config-manager`（`config_manager_controller.rb:75` の `test_service_configuration`）がこの API を直接呼んでおり、削除すると `bin/config-manager test` が壊れることが判明した（VERIFIED: scratch 環境で patch を適用し実行して確認）。そのため本 Task では削除ではなく「identity ベースの matching に変更」で維持する。spec 文書側もこの訂正を反映済み（plan 作成と同じセッションで修正・commit 済み）。

**同じ検証で判明したもう1つのバグ**: `stack_attributes_for` の元の実装案（`env.dig('stacks', name) || {} if name`）は、`name` が `nil` のとき Ruby の後置 `if` が式全体を `nil` にしてしまい、`DeploymentTarget.new(attributes: nil)` が `NoMethodError: undefined method 'keys' for nil` で crash することを実行して確認した。Step 3 のコードはこれを `return {} unless name` で防ぐ形に修正済み。

- [ ] **Step 1: 失敗テストを書く**

`spec/shared/entities/workflow_config_spec.rb` の末尾に追加:

```ruby
  describe '#stack_attributes_for with id fallback' do
    let(:env_hash) do
      {
        'environments' => [
          {
            'environment' => 'production',
            'stacks' => {
              'terragrunt' => { 'aws_region' => 'ap-northeast-1', 'iam_role_plan' => 'arn:plan', 'iam_role_apply' => 'arn:apply' }
            }
          }
        ],
        'stack_conventions' => [
          {
            'root' => 'dystopia/{service}',
            'stacks' => [
              { 'name' => 'terragrunt', 'id' => 'aws',    'directory' => 'infrastructure/aws/{environment}' },
              { 'name' => 'terragrunt', 'id' => 'stripe', 'directory' => 'infrastructure/stripe/{environment}' }
            ]
          }
        ]
      }
    end

    it 'returns attributes keyed on id when present' do
      env_hash['environments'][0]['stacks']['aws'] = { 'aws_region' => 'us-east-1' }
      config = described_class.new(env_hash)
      expect(config.stack_attributes_for('production', 'aws')).to include('aws_region' => 'us-east-1')
    end

    it 'falls back to attributes keyed on name when id key is absent' do
      config = described_class.new(env_hash)
      expect(config.stack_attributes_for('production', 'aws')).to include('iam_role_plan' => 'arn:plan')
    end

    it 'returns {} when neither id nor name resolves' do
      config = described_class.new(env_hash)
      expect(config.stack_attributes_for('production', 'nonexistent')).to eq({})
    end

    it 'returns {} (not nil) when the bare name no longer resolves because every entry sharing it has an id' do
      # env_hash's convention has two entries both named 'terragrunt', each with
      # its own id (aws / stripe) and no third entry left with a bare 'terragrunt'
      # identity. Querying by the old bare name must degrade to {}, not nil,
      # or DeploymentTarget.new(attributes: nil) blows up downstream.
      config = described_class.new(env_hash)
      result = config.stack_attributes_for('production', 'terragrunt')
      expect(result).to eq({})
      expect { Entities::DeploymentTarget.new(service: 'x', stack: 'terragrunt', working_directory: 'y', attributes: result) }
        .not_to raise_error
    end
  end

  describe '#stack_conventions_for with id' do
    let(:dual_id_hash) do
      {
        'environments' => [{ 'environment' => 'production', 'stacks' => {} }],
        'stack_conventions' => [
          {
            'root' => 'dystopia/{service}',
            'stacks' => [
              { 'name' => 'terragrunt', 'id' => 'aws',    'directory' => 'infrastructure/aws/{environment}' },
              { 'name' => 'terragrunt', 'id' => 'stripe', 'directory' => 'infrastructure/stripe/{environment}' }
            ]
          }
        ]
      }
    end

    it 'resolves each id to its own directory pattern independently' do
      config = described_class.new(dual_id_hash)
      expect(config.stack_conventions_for('monolith', 'aws')).to eq(['dystopia/{service}/infrastructure/aws/{environment}'])
      expect(config.stack_conventions_for('monolith', 'stripe')).to eq(['dystopia/{service}/infrastructure/stripe/{environment}'])
    end

    it 'no longer resolves the bare name once every entry sharing it has an id' do
      config = described_class.new(dual_id_hash)
      expect(config.stack_conventions_for('monolith', 'terragrunt')).to eq([])
    end

    it 'still resolves by name when no entry declares an id (backward compatible)' do
      data = {
        'environments' => [{ 'environment' => 'production', 'stacks' => {} }],
        'stack_conventions' => [
          { 'root' => 'aws/{service}', 'stacks' => [{ 'name' => 'terragrunt', 'directory' => 'envs/{environment}' }] }
        ]
      }
      config = described_class.new(data)
      expect(config.stack_conventions_for('eks', 'terragrunt')).to eq(['aws/{service}/envs/{environment}'])
    end
  end

  describe '#required_attributes_for with id fallback' do
    let(:conv) do
      {
        'environments' => [{ 'environment' => 'production', 'stacks' => {} }],
        'stack_conventions' => [
          {
            'root' => 'dystopia/{service}',
            'stacks' => [
              { 'name' => 'terragrunt', 'id' => 'aws', 'directory' => 'infrastructure/aws/{environment}', 'required_attributes' => %w[aws_region] },
              { 'name' => 'terragrunt', 'id' => 'stripe', 'directory' => 'infrastructure/stripe/{environment}', 'required_attributes' => %w[stripe_secret_ref] }
            ]
          }
        ]
      }
    end

    it 'returns the required attributes of the entry matched by id' do
      config = described_class.new(conv)
      expect(config.required_attributes_for('stripe')).to eq(%w[stripe_secret_ref])
    end

    it 'falls back to name match when id is not found' do
      config = described_class.new(conv)
      expect(config.required_attributes_for('terragrunt')).to eq(%w[aws_region])
    end
  end
```

- [ ] **Step 2: 失敗確認**

Run:
```bash
cd action-scripts && bundle exec rspec spec/shared/entities/workflow_config_spec.rb -e "id fallback" -e "stack_conventions_for with id"
```
Expected: id を key として引く example群、nil-guard の example、`stack_conventions_for with id` の example が fail。name だけで偶然通るものと backward-compatible の例のみ pass の状態。

- [ ] **Step 3: 実装を追加**

`action-scripts/shared/entities/workflow_config.rb` L19-33 (`stack_attributes_for`/`required_attributes_for`) と L36-63 (`stack_conventions_for`) を編集:

```ruby
    # Get stack-specific attribute hash for an environment+stack pair.
    # Looks up by the stack's id first (matching stack_conventions[].stacks[].id);
    # falls back to the stack's name so existing configs without id keep working.
    # Always returns a Hash (never nil) so DeploymentTarget.new(attributes:) never
    # receives nil even when the bare name no longer resolves to any entry.
    def stack_attributes_for(env_name, stack_key)
      env = environments[env_name]
      return {} unless env

      by_id = env.dig('stacks', stack_key)
      return by_id if by_id

      name = stack_name_for(stack_key)
      return {} unless name

      env.dig('stacks', name) || {}
    end

    # Get required attribute keys declared for a stack in stack_conventions.
    # Same id-first fallback semantics as stack_attributes_for.
    def required_attributes_for(stack_key)
      stack_conventions_config.each do |convention|
        stack = (convention['stacks'] || []).find { |s| (s['id'] || s['name']) == stack_key }
        next unless stack
        return stack['required_attributes'] || []
      end

      # Fallback: match by name when no id-based hit
      stack_conventions_config.each do |convention|
        stack = (convention['stacks'] || []).find { |s| s['name'] == stack_key }
        next unless stack
        return stack['required_attributes'] || []
      end
      []
    end

    # Get directory conventions for a service and stack with hierarchical structure.
    # Matches by identity (id || name) so two entries that share a name but carry
    # distinct ids resolve to their own directory independently. Kept (not deleted,
    # despite the original design spec's "delete" note) because config-manager's
    # test_service_configuration calls this transitively via stack_convention_for.
    def stack_conventions_for(service_name, stack)
      service_config = services[service_name]
      if service_config && service_config['stack_conventions']
        if service_config['stack_conventions'][stack]
          return [service_config['stack_conventions'][stack]]
        else
          return []
        end
      end

      patterns = []
      stack_conventions_config.each do |convention|
        root_pattern = convention['root']
        stack_config = convention['stacks']&.find { |s| (s['id'] || s['name']) == stack }
        next unless stack_config

        if root_pattern.nil? || root_pattern.empty?
          patterns << stack_config['directory']
        else
          patterns << "#{root_pattern}/#{stack_config['directory']}"
        end
      end
      patterns
    end
```

同 file の末尾（`private` の前）に helper を追加:

```ruby
    # Resolve stack_key (which is 'id || name' in v1.3.0) to the original
    # stack name for fallback lookups against env.stacks[name].
    def stack_name_for(stack_key)
      stack_conventions_config.each do |convention|
        (convention['stacks'] || []).each do |stack|
          identity = stack['id'] || stack['name']
          return stack['name'] if identity == stack_key
        end
      end
      nil
    end
```

- [ ] **Step 4: 再テスト**

Run:
```bash
cd action-scripts && bundle exec rspec spec/shared/entities/workflow_config_spec.rb
```
Expected: 全 example PASS。

- [ ] **Step 5: 全体 rspec (回帰チェック)**

Run:
```bash
cd action-scripts && bundle exec rspec
```
Expected: 全 example PASS。

- [ ] **Step 6: commit**

```bash
git add action-scripts/shared/entities/workflow_config.rb \
        action-scripts/spec/shared/entities/workflow_config_spec.rb
git commit -s -m "feat(workflow_config): identity-first lookup for attributes and conventions

stack_attributes_for, required_attributes_for, and stack_conventions_for
now resolve by identity (id when present, name otherwise) so a
convention can carry two entries that share a name but point at
different directories. stack_attributes_for always returns a Hash,
never nil, so DeploymentTarget.new(attributes:) can't blow up on a
stale bare-name lookup after ids are introduced."
```

---

### Task 1.4: `config-manager` の service test を identity ベースに修正

**Files:**
- Modify: `action-scripts/config-manager/controllers/config_manager_controller.rb:69-80`
- Test: `action-scripts/spec/config-manager/controllers/config_manager_controller_spec.rb`

**Interfaces:**
- Consumes: `WorkflowConfig#stack_convention_for(service_name, stack_key)`, `WorkflowConfig#stack_attributes_for(env_name, stack_key)`（ともに Task 1.3 で identity ベースに変更済み）
- Produces: `ConfigManagerController#test_service_configuration` が生成する `stack_directories` / `stack_attributes` ハッシュのキーが `stack_def['id'] || stack_def['name']` になる

**発見した不具合（VERIFIED）**: `test_service_configuration`（`bin/config-manager test <service> <env>` の実装）は現状 `stack_directories[stack_name] = ...` / `stack_attributes[stack_name] = ...` と `stack_def['name']` だけをキーにしている。convention 内に `name: terragrunt` が 2 エントリ（`id: aws` / `id: stripe`）ある場合、このループは同じキー `'terragrunt'` に 2 回書き込むため **後勝ちで片方が消える**。scratch 環境で実際にこのロジックを再現し、`id` ベースにキーを変えることで両方が別エントリとして残ることを確認済み。

- [ ] **Step 1: 失敗テストを書く**

`action-scripts/spec/config-manager/controllers/config_manager_controller_spec.rb` の `describe '#test_service_configuration'` ブロック内、既存の `context 'with stack names other than terragrunt/kubernetes'` の直後に追加:

```ruby
    context 'with two stack entries sharing a name but distinct ids' do
      before do
        allow(config_client).to receive(:load_workflow_config).and_return(config)
        allow(config).to receive_message_chain(:services, :key?).with(service_name).and_return(true)
        allow(config).to receive_message_chain(:environments, :key?).with(environment).and_return(true)
        allow(config).to receive_message_chain(:services, :[]).with(service_name).and_return({
          'name' => service_name
        })
        allow(config).to receive(:stack_convention_for).with(service_name, 'aws').and_return('dystopia/{service}/infrastructure/aws/{environment}')
        allow(config).to receive(:stack_convention_for).with(service_name, 'stripe').and_return('dystopia/{service}/infrastructure/stripe/{environment}')
        allow(config).to receive(:stack_conventions_config).and_return([
          {
            'root' => 'dystopia/{service}',
            'stacks' => [
              { 'name' => 'terragrunt', 'id' => 'aws',    'directory' => 'infrastructure/aws/{environment}' },
              { 'name' => 'terragrunt', 'id' => 'stripe', 'directory' => 'infrastructure/stripe/{environment}' }
            ]
          }
        ])
        allow(config).to receive(:stack_attributes_for).with(environment, 'aws').and_return({ 'aws_region' => 'ap-northeast-1' })
        allow(config).to receive(:stack_attributes_for).with(environment, 'stripe').and_return({ 'stripe_secret_ref' => '/panicboat/stripe/api-key' })
        allow(presenter).to receive(:present_service_test_result)
      end

      it 'keeps both entries distinct instead of the second overwriting the first' do
        controller.test_service_configuration(service_name: service_name, environment: environment)

        expect(presenter).to have_received(:present_service_test_result).with(
          hash_including(
            stack_directories: {
              'aws'    => "dystopia/#{service_name}/infrastructure/aws/#{environment}",
              'stripe' => "dystopia/#{service_name}/infrastructure/stripe/#{environment}"
            },
            stack_attributes: {
              'aws'    => { 'aws_region' => 'ap-northeast-1' },
              'stripe' => { 'stripe_secret_ref' => '/panicboat/stripe/api-key' }
            }
          )
        )
      end
    end
```

- [ ] **Step 2: 失敗確認**

Run:
```bash
cd action-scripts && bundle exec rspec spec/config-manager/controllers/config_manager_controller_spec.rb -e "distinct ids"
```
Expected: FAIL。現状の実装は `stack_directories['terragrunt']` / `stack_attributes['terragrunt']` に後勝ちで 1 件しか残らないため、期待する 2 キーのハッシュと一致しない。

- [ ] **Step 3: 実装を修正**

`action-scripts/config-manager/controllers/config_manager_controller.rb:69-80` を編集:

```ruby
          # Collect directories and attributes per stack declared in stack_conventions.
          # Keyed by identity (id || name) so two entries sharing a name but
          # carrying distinct ids (e.g. terragrunt/aws + terragrunt/stripe)
          # don't clobber each other in these display-only hashes.
          stack_directories = {}
          stack_attributes = {}
          config.stack_conventions_config.each do |convention|
            (convention['stacks'] || []).each do |stack_def|
              stack_key = stack_def['id'] || stack_def['name']
              stack_directories[stack_key] = config.stack_convention_for(service_name, stack_key)
                &.gsub('{service}', service_name)
                &.gsub('{environment}', environment)
              stack_attributes[stack_key] = config.stack_attributes_for(environment, stack_key)
            end
          end
```

- [ ] **Step 4: 再テスト**

Run:
```bash
cd action-scripts && bundle exec rspec spec/config-manager/controllers/config_manager_controller_spec.rb
```
Expected: 全 example PASS（既存の "with valid service and environment" / "with stack names other than terragrunt/kubernetes" は id 未指定なので `stack_key == stack_def['name']` のまま変わらず通る）。

- [ ] **Step 5: 全体 rspec (回帰チェック)**

Run:
```bash
cd action-scripts && bundle exec rspec
```
Expected: 全 example PASS。

- [ ] **Step 6: commit**

```bash
git add action-scripts/config-manager/controllers/config_manager_controller.rb \
        action-scripts/spec/config-manager/controllers/config_manager_controller_spec.rb
git commit -s -m "fix(config-manager): key service-test output by identity, not bare name

test_service_configuration built stack_directories/stack_attributes
keyed by stack_def['name'] alone, so two convention entries sharing a
name (e.g. two terragrunt entries distinguished only by id) silently
clobbered each other -- the second write won. Key by id || name
instead so bin/config-manager test shows both."
```

---

### Task 1.5: `GenerateMatrix` を stack instance ベースに書き換え

**Files:**
- Modify: `action-scripts/label-resolver/use_cases/generated_matrix.rb`
- Test: `action-scripts/spec/label-resolver/use_cases/generate_matrix_spec.rb`

**Interfaces:**
- Consumes: `WorkflowConfig#stack_conventions_config`（unchanged）, `WorkflowConfig#stack_attributes_for(env, stack_key)`（Task 1.3）, `Entities::DeploymentTarget.new(..., stack_id:)`（Task 1.1）
- Produces: matrix に含まれる各 target の `stack` は既存どおり stack `name`、加えて `stack_id`（`id || name`）と `working_directory`（instance ごとに異なる）を持つ。`generate_targets_for_service` の内部データ構造は「stack instance = `{name, id, directory, required_attributes}`」で走査。

- [ ] **Step 1: 失敗テストを書く**

`spec/label-resolver/use_cases/generate_matrix_spec.rb` の末尾に新 context を追加:

```ruby
  context 'when a convention has two stacks sharing name but distinct id' do
    let(:target_environments) { ['production'] }
    let(:env_config) do
      {
        'environment' => 'production',
        'stacks' => {
          'terragrunt' => {
            'aws_region' => 'ap-northeast-1',
            'iam_role_plan' => 'arn:aws:iam::123456789012:role/plan-role',
            'iam_role_apply' => 'arn:aws:iam::123456789012:role/apply-role'
          }
        }
      }
    end

    before do
      allow(config).to receive(:environment_config).with('production').and_return(env_config)
      allow(config).to receive(:stack_attributes_for).and_return(env_config['stacks']['terragrunt'])
      allow(config).to receive(:services).and_return({ 'monolith' => {} })

      allow(config).to receive(:stack_conventions_config).and_return([
        {
          'root' => 'dystopia/{service}',
          'stacks' => [
            { 'name' => 'terragrunt', 'id' => 'aws',    'directory' => 'infrastructure/aws/{environment}' },
            { 'name' => 'terragrunt', 'id' => 'stripe', 'directory' => 'infrastructure/stripe/{environment}' }
          ]
        }
      ])

      allow(File).to receive(:directory?).and_return(true)
    end

    it 'generates one target per stack instance' do
      labels = [Entities::DeployLabel.from_service(service: 'monolith')]
      result = use_case.execute(deploy_labels: labels, target_environments: target_environments)

      expect(result).to be_success
      expect(result.deployment_targets.length).to eq(2)

      dirs = result.deployment_targets.map(&:working_directory).sort
      expect(dirs).to eq([
        'dystopia/monolith/infrastructure/aws/production',
        'dystopia/monolith/infrastructure/stripe/production'
      ])

      ids = result.deployment_targets.map(&:stack_id).sort
      expect(ids).to eq(%w[aws stripe])

      # Both targets share the stack name so they route to the same reusable workflow
      expect(result.deployment_targets.map(&:stack).uniq).to eq(['terragrunt'])
    end
  end
```

**既存の L524-575 テストは変更しない（重要な訂正）**。当初この plan の下書きでは、L524-575 の「with same stack name in multiple matching conventions」テスト（`aws/{service}` と `github/{service}` の 2 convention がどちらも `name: terragrunt`・id 無しを持つケース）の assertion を「2 target 生成される」に差し替える案を書いていたが、scratch 環境で実際にこのシナリオを実行して検証した結果、**実装（Step 3 のコード）はこのケースで 1 target のみ生成する**ことを確認した（VERIFIED）。

理由: `stack_configs = matching_conventions.flat_map { |c| c['stacks'] || [] }.uniq { |s| s['id'] || s['name'] }` は matching した convention 全体を横断して `id || name` で dedupe する。両エントリとも `id` が無ければ identity は両方とも `'terragrunt'` になり `.uniq` が最初の 1 件だけを残す。これは v1.2.0 の元の意図的な仕様（コメント「dedup by stack name (first wins) so duplicate stack names across conventions don't multiply targets」）をそのまま引き継いだ動作であり、`docs/superpowers/specs/2026-08-29-infrastructure-layout-design.md` の Identity resolution 節が言う「同一 convention の stacks 内で」の unique 制約とも整合する（convention をまたぐ dedupe は元々 validate! のスコープ外であり、意図的に変えていない）。

新しい複数 target 機能（Task 1.1-1.5 で作る）が対象にしているのは「**同一 convention 内**で `id` により明示的に区別されたエントリ」（monolith の aws/stripe のように）だけであり、「convention をまたいで同名・id 無し」の従来ケースは今回のスコープ外で挙動不変。よって既存テストの assertion は変更せず、テスト名と本文中のコメントだけ「stack name」→「identity (id || name)」の用語に更新する:

L524-575 の `context 'with same stack name in multiple matching conventions'` 内の `it 'dedupes by stack name and generates a single terragrunt target'` の title のみ更新（本文の assertion は不変）:

```ruby
      it 'dedupes by identity (id || name) and generates a single terragrunt target' do
        result = use_case.execute(deploy_labels: deploy_labels, target_environments: target_environments)

        expect(result).to be_success
        expect(result.deployment_targets.length).to eq(1)
        expect(result.deployment_targets.first.stack).to eq('terragrunt')
      end
```

- [ ] **Step 2: 失敗確認**

Run:
```bash
cd action-scripts && bundle exec rspec spec/label-resolver/use_cases/generate_matrix_spec.rb
```
Expected: 新規 context（"two stacks sharing name but distinct id"）が fail（`stack_id` メソッド未実装のため）。L524-575 の it は title 変更のみで assertion は不変なので、Step 3 実装前でも旧実装のまま pass するはず — pass のままで問題ない。

- [ ] **Step 3: 実装を書き換える**

`action-scripts/label-resolver/use_cases/generated_matrix.rb` の変更ポイント:

**L69-116 `generate_targets_for_service` を書き換え**（`stack_configs = matching_conventions.flat_map { |c| c['stacks'] || [] }.uniq { |s| s['id'] || s['name'] }` に変更し、`stack_name` の代わりに `stack_config` を各 helper に渡す）:

```ruby
      def generate_targets_for_service(deploy_label, config)
        targets = []

        matching_conventions = find_matching_conventions(deploy_label.service, config)
        return targets if matching_conventions.empty?

        # v1.3.0: dedupe by identity (id || name). Two entries with the
        # same name and distinct id yield two separate stack instances,
        # each pointing at its own directory. WorkflowConfig#validate!
        # already rejects duplicate identities within a convention.
        stack_configs = matching_conventions.flat_map { |c| c['stacks'] || [] }.uniq { |s| s['id'] || s['name'] }

        stack_configs.each do |stack_config|
          stack_name      = stack_config['name']
          stack_id        = stack_config['id'] || stack_name
          stack_directory = stack_config['directory']

          is_environment_specific = stack_directory&.include?('{environment}')

          if is_environment_specific
            @target_environments.each do |env|
              env_config = config.environment_config(env)
              unless env_config
                raise "environment configuration not found for: #{env} (should have been caught by validate_config)"
              end

              if stack_config_directory_exists?(deploy_label.service, env, stack_config, config)
                target = generate_deployment_target_for_instance(deploy_label, env, stack_config, config)
                targets << target if target
              end
            end
          else
            first_env = @target_environments.first
            if stack_config_directory_exists?(deploy_label.service, first_env, stack_config, config)
              target = generate_deployment_target_for_instance(deploy_label, nil, stack_config, config)
              targets << target if target
            end
          end
        end

        targets
      end
```

**新規: instance ベースの directory 存在チェックと target 生成:**

`generate_targets_for_service` の直後に追加:

```ruby
      # v1.3.0: check the directory for a specific stack instance (as opposed
      # to falling back to WorkflowConfig#stack_conventions_for, which cannot
      # differentiate multiple stack instances that share a name).
      def stack_config_directory_exists?(service_name, environment, stack_config, config)
        full_pattern = full_pattern_for_stack_config(stack_config, config)
        return false unless full_pattern

        begin
          expanded = expand_directory_pattern(full_pattern, service_name, environment)
        rescue Entities::UnresolvedPlaceholderError
          return false
        end
        return false unless expanded

        File.directory?(File.join(find_repository_root, expanded))
      end

      # v1.3.0: build a DeploymentTarget for a specific stack instance,
      # propagating stack_id and using the instance's own directory pattern
      # rather than the first match by name.
      def generate_deployment_target_for_instance(deploy_label, target_environment, stack_config, config)
        full_pattern = full_pattern_for_stack_config(stack_config, config)
        return nil unless full_pattern

        begin
          candidate_dir = expand_directory_pattern(full_pattern, deploy_label.service, target_environment)
        rescue Entities::UnresolvedPlaceholderError
          return nil
        end
        return nil unless candidate_dir

        full_path = File.join(find_repository_root, candidate_dir)
        return nil unless File.directory?(full_path)

        stack_name = stack_config['name']
        stack_id   = stack_config['id'] || stack_name

        captures = extract_captures(full_pattern, candidate_dir)

        Entities::DeploymentTarget.new(
          service: deploy_label.service,
          environment: target_environment,
          stack: stack_name,
          stack_id: stack_id,
          working_directory: candidate_dir,
          stack_convention_root: extract_root_from_working_dir(candidate_dir, deploy_label.service, target_environment, config),
          attributes: target_environment ? config.stack_attributes_for(target_environment, stack_id) : {},
          captures: captures
        )
      end

      # v1.3.0: locate the convention entry for a specific stack instance,
      # returning its "root/directory" full pattern. Matches by identity
      # (id || name) plus directory so instances with the same name are
      # not conflated.
      def full_pattern_for_stack_config(stack_config, config)
        wanted_identity  = stack_config['id'] || stack_config['name']
        wanted_directory = stack_config['directory']

        config.stack_conventions_config.each do |convention|
          (convention['stacks'] || []).each do |candidate|
            candidate_identity = candidate['id'] || candidate['name']
            next unless candidate_identity == wanted_identity
            next unless candidate['directory'] == wanted_directory

            root_pattern = convention['root']
            return root_pattern.nil? || root_pattern.empty? ? wanted_directory : "#{root_pattern}/#{wanted_directory}"
          end
        end
        nil
      end
```

**L152-165 旧 `stack_directory_exists?` は削除**。`generate_targets_for_service` の書き換えでこのメソッドへの呼び出しが無くなり（新しい `stack_config_directory_exists?` に置き換わる）、他に呼び出し元が無い（VERIFIED: grep で確認、呼び出しは元々 `generate_targets_for_service` 内の 2 箇所のみだった）ため丸ごと削除する。

**L244-270 旧 `generate_deployment_target` は削除**（新しい `generate_deployment_target_for_instance` が置き換える）。呼び出し元は `generate_targets_for_service` のみで、上記で切り替え済み。

**L274-293 旧 `full_pattern_for` は削除**（新しい `full_pattern_for_stack_config` が置き換える）。呼び出し元は `extract_captures` 経由のみ。

**L310-321 旧 `create_deployment_target` は削除**。`generate_deployment_target_for_instance` が `Entities::DeploymentTarget.new` を直接呼ぶため、この共有 helper への呼び出しが無くなる（VERIFIED: 削除後に grep して呼び出し元ゼロを確認）。

**L299-308 `extract_captures` の呼び出し形は変更なし**（`full_match_pattern, working_dir` を受け取る）。ただし呼び出し元は `full_pattern_for_stack_config(stack_config, config)` を渡す。

**L177-241 `detect_available_stacks` は触らない**。このメソッドは今回の書き換え対象 (`generate_targets_for_service`) から呼ばれておらず、本 refactor 前から既に呼び出し元ゼロの死んだコードだった（VERIFIED: grep で `detect_available_stacks` の呼び出しが定義行以外に存在しないことを確認）。本 refactor が原因で死んだわけではないため、無関係なクリーンアップとして触らない。

- [ ] **Step 4: 再テスト**

Run:
```bash
cd action-scripts && bundle exec rspec spec/label-resolver/use_cases/generate_matrix_spec.rb
```
Expected: 全 example PASS。

- [ ] **Step 5: 全体 rspec (回帰チェック)**

Run:
```bash
cd action-scripts && bundle exec rspec
```
Expected: 全 example PASS。

- [ ] **Step 6: commit**

```bash
git add action-scripts/label-resolver/use_cases/generated_matrix.rb \
        action-scripts/spec/label-resolver/use_cases/generate_matrix_spec.rb
git commit -s -m "feat(generate_matrix): iterate stack instances via id-based identity

Matrix generation now dedupes stack configs by (id || name), letting a
single convention declare multiple entries with the same name but
distinct ids. Each instance produces its own DeploymentTarget with the
instance's own working_directory and stack_id."
```

---

### Task 1.6: deploy-actions README と CHANGELOG を更新

**Files:**
- Modify: `README.md`, `README-ja.md`
- Modify: `action-scripts/config-manager/README.md`, `action-scripts/config-manager/README-ja.md`
- Modify: `action-scripts/label-resolver/README.md`, `action-scripts/label-resolver/README-ja.md`
- Modify: `action-scripts/label-dispatcher/README.md`, `action-scripts/label-dispatcher/README-ja.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: v1.3.0 の実装（Task 1.1-1.5）
- Produces: 公開 doc 上で `id` の存在、identity fallback、convention 内 unique 制約、matrix output の `stack_id` を明示

- [ ] **Step 1: `README.md` の `stack_conventions` 例に id を追記**

`README.md` L82-90 付近の stack_conventions サンプルを編集。既存の例（`stacks: [{ name: aws, ... }, { name: kubernetes, ... }]`）に対して `id` は書かず、直後に「Multiple instances of the same stack name」小節を新設し、以下例を追加:

```yaml
# When a service needs two instances of the same stack (e.g. one Terragrunt
# stack for AWS resources and one for Stripe), give each entry a distinct `id`.
# `id` is optional; when omitted it falls back to `name`. Within a single
# convention, `id || name` must be unique.
stack_conventions:
  - root: "dystopia/{service}"
    stacks:
      - name: terragrunt
        id: aws
        directory: infrastructure/aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: terragrunt
        id: stripe
        directory: infrastructure/stripe/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
```

- [ ] **Step 2: `README.md` の matrix output 表と JSON 例に stack_id を追加**

L158 付近の表:
```
| `stack_id`             | Fixed | Instance identity (`id \|\| name`). Defaults to `stack` when `id` is not set. |
```
の行を追加。

L188 付近の JSON 例:
```json
{
  "service": "api",
  "environment": "develop",
  "stack": "terragrunt",
  "stack_id": "terragrunt",
  "working_directory": "payments/api/aws/develop",
  "stack_convention_root": "payments/api",
  ...
}
```
に `"stack_id"` 行を追加。

- [ ] **Step 3: `README-ja.md` に Step 1-2 の日本語版を反映**

`README.md` と対応する箇所を同内容で日本語版に反映。

- [ ] **Step 4: `action-scripts/config-manager/README.md` / `README-ja.md` に id の schema 記載を追加**

L99 付近の stack_conventions サンプル直下に、id フィールドの説明と convention 内 unique 制約、silent dedupe 廃止 (v1.3.0 breaking) の note を追加。

- [ ] **Step 5: `action-scripts/label-resolver/README.md` / `README-ja.md` に stack_id 追記**

L140 付近の stack_conventions 例に id を含めた形の例を追加。matrix item の shape 例に `stack_id` を追加。「Same `name` with different `id` produces multiple targets」の 1 段落を追加。

- [ ] **Step 6: `action-scripts/label-dispatcher/README.md` / `README-ja.md` の例示パスを修正**

L166-167 の `services/auth/aws/envs/develop/main.tf` および `services/{service}/aws/envs/{environment}` から `envs/` を削除:
- `services/auth/aws/develop/main.tf`
- `services/{service}/aws/{environment}`

同 README-ja.md も同様。

- [ ] **Step 7: `CHANGELOG.md` に v1.3.0 エントリを追加**

先頭の `# Changelog` の直下に:

```markdown
## v1.3.0

### Added
- `stack_conventions[].stacks[].id` (optional): identifier for a stack
  instance within a convention. Enables a single service to carry multiple
  stack entries that share the same reusable-workflow `name` (e.g. two
  terragrunt stacks: one for AWS, one for Stripe).
- Matrix output now includes `stack_id` (defaults to `stack` when `id` is
  not set).
- `WorkflowConfig#stack_attributes_for` and `#required_attributes_for` now
  accept the identity (`id || name`) and fall back to the stack's `name`
  so existing configs migrate incrementally.

### Changed
- **Breaking**: entries within a single convention that share the same
  `name` and have no `id` now raise a validation error instead of being
  silently deduplicated. Add distinct `id` values to keep both entries.
```

- [ ] **Step 8: 全体 rspec (docs 変更なので回帰は起きないが確認)**

Run:
```bash
cd action-scripts && bundle exec rspec
```
Expected: 全 example PASS。

- [ ] **Step 9: commit**

```bash
git add README.md README-ja.md CHANGELOG.md \
        action-scripts/config-manager/README.md action-scripts/config-manager/README-ja.md \
        action-scripts/label-resolver/README.md action-scripts/label-resolver/README-ja.md \
        action-scripts/label-dispatcher/README.md action-scripts/label-dispatcher/README-ja.md
git commit -s -m "docs: document stack_conventions.id and matrix stack_id for v1.3.0"
```

---

### Task 1.7: Draft PR

- [ ] **Step 1: push**

Run:
```bash
git push -u origin refactor/infrastructure-layout
```

- [ ] **Step 2: Draft PR 作成**

Run:
```bash
gh pr create --draft --title "feat: introduce stacks[].id for multi-instance conventions (v1.3.0)" --body "$(cat <<'EOF'
## Summary

- Adds optional \`stack_conventions[].stacks[].id\` field. Identity is \`id || name\`, unique per convention.
- Adds \`stack_id\` to matrix output (defaults to \`stack\`).
- Replaces v1.2.0's silent same-name dedupe with a validation error.
- \`stack_attributes_for\` / \`required_attributes_for\` now look up by identity with a fallback to the stack's name.

## Motivation

Downstream (monorepo) will introduce a Stripe stack alongside the existing AWS stack under a single service, both routed through the terragrunt reusable workflow. Same \`name: terragrunt\` with distinct \`id: aws\` / \`id: stripe\` lets the matrix generator emit two separate targets without renaming the reusable-workflow dispatch category.

## Test plan

- [ ] All existing specs pass
- [ ] New specs added for identity uniqueness (validation error)
- [ ] New specs added for two-instance target generation
- [ ] \`bin/config-manager validate\` accepts existing v1.2.0 configs unchanged
EOF
)"
```

- [ ] **Step 3: PR URL を控える**

release tag 用の commit SHA を控える（次 phase の workflow pin 更新で使う）。

---

## Phase 2: monorepo refactor

作業リポ: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-infrastructure-layout`（本 plan と同じ worktree）

**前提**: Phase 1 の Draft PR を投げてタグ相当の commit SHA を得たあと、v1.3.0 が merge/release されるまでは monorepo 側の pin 更新はこの SHA で先行しても良い（fail-fast の validation は id を書いた config だけが引くため）。

### Task 2.1: frontend の aws/ を infrastructure/aws/ に move

**Files:**
- Move: `dystopia/frontend/aws/root.hcl` → `dystopia/frontend/infrastructure/aws/root.hcl`
- Move: `dystopia/frontend/aws/modules/` → `dystopia/frontend/infrastructure/aws/modules/`
- Move: `dystopia/frontend/aws/envs/production/env.hcl` → `dystopia/frontend/infrastructure/aws/production/env.hcl`
- Move: `dystopia/frontend/aws/envs/production/terragrunt.hcl` → `dystopia/frontend/infrastructure/aws/production/terragrunt.hcl`
- Delete (empty after move): `dystopia/frontend/aws/`

**Interfaces:**
- Produces: `dystopia/frontend/infrastructure/aws/production/` に terragrunt stack が存在。root.hcl / modules は 1 段浅い相対に対応済み

- [ ] **Step 1: infrastructure ディレクトリを作成**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/refactor-infrastructure-layout
mkdir -p dystopia/frontend/infrastructure
```

- [ ] **Step 2: aws/ ツリーを infrastructure/aws/ に git mv**

Run:
```bash
git mv dystopia/frontend/aws dystopia/frontend/infrastructure/aws
```

- [ ] **Step 3: envs/production を production に flatten**

Run:
```bash
git mv dystopia/frontend/infrastructure/aws/envs/production dystopia/frontend/infrastructure/aws/production
rmdir dystopia/frontend/infrastructure/aws/envs
```
Expected: `envs/` ディレクトリが空になり削除される。中身は `dystopia/frontend/infrastructure/aws/{root.hcl, modules/, production/{env.hcl, terragrunt.hcl}}`。

- [ ] **Step 4: terragrunt.hcl の source を修正**

`dystopia/frontend/infrastructure/aws/production/terragrunt.hcl` L11-13 を編集:
```hcl
terraform {
  source = "../modules"
}
```
（`../../modules` → `../modules`）

- [ ] **Step 5: terragrunt validate**

Run:
```bash
cd dystopia/frontend/infrastructure/aws/production
terragrunt hclvalidate
terragrunt init
terragrunt validate
cd -
```
Expected: 全て成功。

- [ ] **Step 6: commit**

```bash
git add dystopia/frontend
git commit -s -m "refactor(frontend): move aws/ to infrastructure/aws/ and flatten envs

git mv keeps history; state key unchanged because root.hcl derives env
from path tail. terragrunt.hcl source shortened by one level."
```

---

### Task 2.2: holmes の aws/ を infrastructure/aws/ に move

**Files:**
- Move: `system-components/holmes/aws/` 配下を `system-components/holmes/infrastructure/aws/` に

**Interfaces:**
- Produces: `system-components/holmes/infrastructure/aws/production/` に terragrunt stack が存在

- [ ] **Step 1: infrastructure ディレクトリを作成**

Run:
```bash
mkdir -p system-components/holmes/infrastructure
```

- [ ] **Step 2: aws/ ツリーを infrastructure/aws/ に git mv**

Run:
```bash
git mv system-components/holmes/aws system-components/holmes/infrastructure/aws
```

- [ ] **Step 3: envs/production を production に flatten**

Run:
```bash
git mv system-components/holmes/infrastructure/aws/envs/production system-components/holmes/infrastructure/aws/production
rmdir system-components/holmes/infrastructure/aws/envs
```

- [ ] **Step 4: 未追跡の holmes/terragrunt/ (v1.2.0 時代の cache 残骸) を削除**

Run:
```bash
[ -d system-components/holmes/terragrunt ] && rm -rf system-components/holmes/terragrunt
```
理由: `.terragrunt-cache` のみを含む untracked ディレクトリで、`.gitignore` の `.terragrunt-cache/` で除外済みだが親ディレクトリ自体は残っていた。今回の refactor で新規 stack は `infrastructure/aws/production/` に作られるため役目を終える。

- [ ] **Step 5: terragrunt.hcl の source を修正**

`system-components/holmes/infrastructure/aws/production/terragrunt.hcl` の `source = "../../modules"` を `"../modules"` に。

- [ ] **Step 6: terragrunt validate**

Run:
```bash
cd system-components/holmes/infrastructure/aws/production
terragrunt hclvalidate
terragrunt init
terragrunt validate
cd -
```
Expected: 全て成功。

- [ ] **Step 7: commit**

```bash
git add system-components/holmes
git commit -s -m "refactor(holmes): move aws/ to infrastructure/aws/ and flatten envs"
```

---

### Task 2.3: monolith の aws/ を infrastructure/aws/ に move + dependency 更新

**Files:**
- Move: `dystopia/monolith/aws/` 配下を `dystopia/monolith/infrastructure/aws/` に
- Modify: `dystopia/monolith/infrastructure/aws/production/terragrunt.hcl` — dependency config_path 更新

**Interfaces:**
- Consumes: Task 2.1 の frontend infrastructure/aws/production（output `user_pool_arn`）
- Produces: `dystopia/monolith/infrastructure/aws/production/` に terragrunt stack、frontend への dependency は新パス

- [ ] **Step 1: infrastructure ディレクトリを作成**

Run:
```bash
mkdir -p dystopia/monolith/infrastructure
```

- [ ] **Step 2: aws/ ツリーを infrastructure/aws/ に git mv**

Run:
```bash
git mv dystopia/monolith/aws dystopia/monolith/infrastructure/aws
```

- [ ] **Step 3: envs/production を production に flatten**

Run:
```bash
git mv dystopia/monolith/infrastructure/aws/envs/production dystopia/monolith/infrastructure/aws/production
rmdir dystopia/monolith/infrastructure/aws/envs
```

- [ ] **Step 4: terragrunt.hcl の source と dependency.config_path を修正**

`dystopia/monolith/infrastructure/aws/production/terragrunt.hcl` を編集:

- L11-13 の `source = "../../modules"` → `"../modules"`
- L14-21 の `dependency "cognito" { config_path = "../../../../frontend/aws/envs/production" ...}` の `config_path` を `"../../../../frontend/infrastructure/aws/production"` に

（相対深度は 4 段のまま。frontend の Task 2.1 移動後を指す）

- [ ] **Step 5: terragrunt validate**

Run:
```bash
cd dystopia/monolith/infrastructure/aws/production
terragrunt hclvalidate
terragrunt init
terragrunt validate
cd -
```
Expected: 全て成功。frontend の state を参照する dependency も解決できる。

- [ ] **Step 6: commit**

```bash
git add dystopia/monolith
git commit -s -m "refactor(monolith): move aws/ to infrastructure/aws/ and flatten envs

Retargets the cognito dependency config_path to frontend's new
infrastructure/aws/production location; relative depth stays at four
levels because both stacks moved together."
```

---

### Task 2.4: Stripe scaffold を作成

**Files:**
- Create: `dystopia/monolith/infrastructure/stripe/root.hcl`
- Create: `dystopia/monolith/infrastructure/stripe/modules/terraform.tf`
- Create: `dystopia/monolith/infrastructure/stripe/production/env.hcl`
- Create: `dystopia/monolith/infrastructure/stripe/production/terragrunt.hcl`

**Interfaces:**
- Produces: `dystopia/monolith/infrastructure/stripe/production/` で `terragrunt validate/plan` が resource ゼロで通る空 scaffold

- [ ] **Step 1: root.hcl を書く**

Create `dystopia/monolith/infrastructure/stripe/root.hcl`:

```hcl
# root.hcl - Root Terragrunt configuration for monolith Stripe stack

locals {
  project_name = "monolith-stripe"

  path_parts  = split("/", path_relative_to_include())
  environment = element(local.path_parts, length(local.path_parts) - 1)

  common_tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "terragrunt"
    Repository  = "monorepo"
    Component   = "monolith-stripe"
    Team        = "panicboat"
  }
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "terragrunt-state-${get_aws_account_id()}"
    key            = "dystopia/monolith-stripe/${local.environment}/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terragrunt-state-locks"
    encrypt        = true
  }
}

inputs = {
  project_name = local.project_name
  environment  = local.environment
  common_tags  = local.common_tags
  aws_region   = "ap-northeast-1"
}
```

- [ ] **Step 2: 空 module を書く**

Create `dystopia/monolith/infrastructure/stripe/modules/terraform.tf`:

```hcl
terraform {
  required_version = ">= 1.0"
}
```

- [ ] **Step 3: env.hcl を書く**

Create `dystopia/monolith/infrastructure/stripe/production/env.hcl`:

```hcl
# env.hcl - Production environment configuration for monolith Stripe stack
locals {
  environment = "production"
  aws_region  = "ap-northeast-1"
  additional_tags = {
    CostCenter   = "production"
    Owner        = "panicboat"
    Purpose      = "monolith-stripe"
    AutoShutdown = "enabled"
  }
}
```

- [ ] **Step 4: terragrunt.hcl を書く**

Create `dystopia/monolith/infrastructure/stripe/production/terragrunt.hcl`:

```hcl
include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path   = "env.hcl"
  expose = true
}

terraform {
  source = "../modules"
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "terragrunt-state-${get_aws_account_id()}"
    key            = "dystopia/monolith-stripe/${include.env.locals.environment}/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terragrunt-state-locks"
    encrypt        = true
  }
}

inputs = {
  aws_region = include.env.locals.aws_region
  common_tags = merge(
    {
      Environment = include.env.locals.environment
    },
    include.env.locals.additional_tags
  )
}
```

- [ ] **Step 5: terragrunt validate**

Run:
```bash
cd dystopia/monolith/infrastructure/stripe/production
terragrunt hclvalidate
terragrunt init
terragrunt validate
terragrunt plan -detailed-exitcode
cd -
```
Expected: `hclvalidate` / `init` / `validate` 成功。`plan -detailed-exitcode` は resource 0 で `exit 0`（no changes）。

- [ ] **Step 6: commit**

```bash
git add dystopia/monolith/infrastructure/stripe
git commit -s -m "feat(monolith/stripe): add empty Stripe Terragrunt scaffold

An empty modules/terraform.tf lets terragrunt plan/apply succeed as a
no-op so the stack sits in workflow-config from day one. Stripe
provider and real resources land in a follow-up PR."
```

---

### Task 2.5: workflow-config.yaml を更新

**Files:**
- Modify: `workflow-config.yaml`

**Interfaces:**
- Consumes: Phase 1 の v1.3.0 semantics
- Produces: monorepo 側の stack_conventions が新レイアウト + id 付き

- [ ] **Step 1: workflow-config.yaml を書き換え**

`workflow-config.yaml` を編集し `stack_conventions:` セクション全体を置換:

```yaml
stack_conventions:
  - root: dystopia/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        id: aws
        directory: infrastructure/aws/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: terragrunt
        id: stripe
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

- [ ] **Step 2: yq で syntax チェック**

Run:
```bash
yq -e '.stack_conventions[].stacks[] | select(.name == "terragrunt") | .id' workflow-config.yaml
```
Expected: `aws` `stripe` が出力される（順不同）。system-components/{service} の terragrunt entry は id 未指定なので null になり得るが、`select(.name == "terragrunt")` は monorepo 側なので dystopia の 2 entries が出れば OK。

- [ ] **Step 3: commit**

```bash
git add workflow-config.yaml
git commit -s -m "chore(workflow-config): switch to infrastructure/{aws,stripe}/{env}

Splits the terragrunt stack into two id-keyed instances so monolith
can carry AWS and Stripe Terragrunt stacks side by side. Other
services keep a single unnamed-id terragrunt entry."
```

---

### Task 2.6: deploy-actions pin を v1.3.0 に更新

**Files:**
- Modify: `.github/workflows/auto-label--label-dispatcher.yaml:36`
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml:48`

**Interfaces:**
- Consumes: Phase 1 の commit SHA（Task 1.7 で取得済み）
- Produces: 両 workflow が v1.3.0 の label-dispatcher / label-resolver を使う

- [ ] **Step 1: pin 対象の新 SHA を決める**

deploy-actions のマージ済み commit SHA（Phase 1 の PR がマージされた時点の SHA、または Draft のうちは Draft branch tip）を取得:
```bash
cd /Users/takanokenichi/GitHub/panicboat/deploy-actions
git rev-parse origin/main
```
または Draft branch tip:
```bash
git rev-parse origin/refactor/infrastructure-layout
```

得た SHA を `<NEW_SHA>` として次 step で使う。

- [ ] **Step 2: workflow YAML の pin を書き換え**

`.github/workflows/auto-label--label-dispatcher.yaml` L36:
```yaml
        uses: panicboat/deploy-actions/label-dispatcher@<NEW_SHA> # v1.3.0
```

`.github/workflows/auto-label--deploy-trigger.yaml` L48:
```yaml
        uses: panicboat/deploy-actions/label-resolver@<NEW_SHA> # v1.3.0
```

- [ ] **Step 3: commit**

```bash
git add .github/workflows/auto-label--label-dispatcher.yaml \
        .github/workflows/auto-label--deploy-trigger.yaml
git commit -s -m "chore(ci): pin deploy-actions to v1.3.0 for stacks[].id"
```

---

### Task 2.7: monorepo README を更新

**Files:**
- Modify: `README.md`, `README-ja.md`
- Modify: `dystopia/monolith/README.md`, `dystopia/monolith/README-ja.md`
- Modify: `dystopia/frontend/README.md`, `dystopia/frontend/README-ja.md`
- Modify: `system-components/holmes/README.md`, `system-components/holmes/README-ja.md`

**Interfaces:**
- Produces: docs が新レイアウトを反映

- [ ] **Step 1: 各 README で `aws/envs/` の残存を検査**

Run:
```bash
git grep -F "aws/envs" -- ':!docs/superpowers' ':!.claude/worktrees'
```
Expected: ヒットなし（既に move されている）。

- [ ] **Step 2: `README.md` の Stacks 一覧に terragrunt を追加**

L63 の Stacks リストに terragrunt を追記:

```markdown
- **Stacks** (see `stack_conventions` in `workflow-config.yaml`):
  - `container` → builds `dystopia/{service}` or `system-components/{service}` and pushes to GHCR.
  - `terragrunt` → runs `terragrunt plan/apply` under `dystopia/{service}/infrastructure/{aws,stripe}/{environment}` or `system-components/{service}/infrastructure/aws/{environment}`. `dystopia/monolith` carries two instances (`id: aws` and `id: stripe`); other services carry a single AWS instance.
  - `kubernetes` → posts a kustomize diff on the PR. Apply is delegated to Flux; CI does not run `kubectl apply`.
```

- [ ] **Step 3: `README-ja.md` に同内容を反映**

L63 相当の日本語 Stacks リストに terragrunt を追記。

- [ ] **Step 4: `dystopia/monolith/README.md` を更新**

新レイアウトを反映。既存文言に応じて 1 節追加または既存の infra 記述を書き直す:

```markdown
## Infrastructure

Terragrunt stacks live under `infrastructure/`:

- `infrastructure/aws/production/` — RDS, Cognito Pod Identity, IAM policies (depends on `dystopia/frontend/infrastructure/aws/production` for the Cognito user pool ARN).
- `infrastructure/stripe/production/` — empty scaffold; Stripe Terraform provider and resources land in a follow-up PR.
```

`dystopia/monolith/README-ja.md` にも同内容を反映。

- [ ] **Step 5: `dystopia/frontend/README.md` と `system-components/holmes/README.md` の差分確認**

Run:
```bash
git grep -F "aws/envs\|aws/production" dystopia/frontend/README.md dystopia/frontend/README-ja.md system-components/holmes/README.md system-components/holmes/README-ja.md
```
Expected: 現状ヒットなし想定。ヒットがあれば `infrastructure/aws/production` に書き換える。

- [ ] **Step 6: commit**

```bash
git add README.md README-ja.md dystopia/monolith/README.md dystopia/monolith/README-ja.md
git commit -s -m "docs(monorepo): reflect infrastructure/{aws,stripe}/{env} layout"
```

（frontend/holmes README に差分が発生した場合は同 commit に含める）

---

### Task 2.8: Draft PR

- [ ] **Step 1: push**

Run:
```bash
git push -u origin refactor/infrastructure-layout
```

- [ ] **Step 2: Draft PR 作成**

Run:
```bash
gh pr create --draft --title "refactor(infrastructure): move to infrastructure/{provider}/{env} + Stripe scaffold" --body "$(cat <<'EOF'
## Summary

- Move each service's \`aws/{root.hcl, modules/, envs/{env}}\` to \`infrastructure/aws/{env}/\` (envs/ layer dropped).
- Add empty Stripe scaffold under \`dystopia/monolith/infrastructure/stripe/production/\`.
- Split monolith's terragrunt entry into \`id: aws\` and \`id: stripe\` in \`workflow-config.yaml\`.
- Pin deploy-actions to v1.3.0 (requires the id-based dedupe fix).

## Test plan

- [ ] \`terragrunt hclvalidate && terragrunt init && terragrunt validate\` for frontend / monolith(aws) / monolith(stripe) / holmes production stacks
- [ ] \`terragrunt plan -detailed-exitcode\` for stripe: expect exit 0 (no changes)
- [ ] Label-resolver in CI produces a matrix with two terragrunt targets for monolith (aws + stripe) and one for frontend / holmes
- [ ] Existing terragrunt state key is unchanged (RDS, Cognito, holmes)
EOF
)"
```

---

## Phase 3: platform refactor

作業リポ: `/Users/takanokenichi/GitHub/panicboat/platform/.claude/worktrees/refactor-infrastructure-layout`

### Task 3.0: worktree 準備

- [ ] **Step 1: worktree 作成**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/platform
git fetch origin
git worktree add -b refactor/infrastructure-layout \
  .claude/worktrees/refactor-infrastructure-layout origin/main
```

- [ ] **Step 2: .git/info/exclude 更新**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/platform
grep -qxF '/.claude/worktrees/' .git/info/exclude || \
  printf '\n/.claude/worktrees/\n' >> .git/info/exclude
```

- [ ] **Step 3: 以降の作業ディレクトリを worktree に切替**

以降 Phase 3 の全 task は `/Users/takanokenichi/GitHub/panicboat/platform/.claude/worktrees/refactor-infrastructure-layout` を作業ディレクトリとする。

---

### Task 3.1: platform の全 aws service を envs/ 剥がす

**Files:**
- Move: 各 `aws/{svc}/envs/{env}/` → `aws/{svc}/{env}/`（対象: alb, cost-management, eks, eks-holmesgpt, eks-karpenter, eks-logs, eks-metrics, eks-secrets, eks-traces, github-oidc-auth, iam-service-linked-roles, karpenter, route53, vpc）
- Modify: 各 stack の `terragrunt.hcl` の `source`

**Interfaces:**
- Produces: 全 aws stack が `aws/{svc}/{env}/` パス。terragrunt が新パスから validate 通る

- [ ] **Step 1: 全 aws service で envs/ 直下の env dirs を親に move**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/platform/.claude/worktrees/refactor-infrastructure-layout
for svc_envs in aws/*/envs; do
  svc=$(dirname "$svc_envs")
  for env_dir in "$svc_envs"/*/; do
    env_name=$(basename "$env_dir")
    git mv "$env_dir" "$svc/$env_name"
  done
  rmdir "$svc_envs"
done
```
Expected: 全 `aws/{svc}/envs/` が空になり削除される。中身は `aws/{svc}/{env-name}/` に上がる。

- [ ] **Step 2: aws 配下の terragrunt.hcl の source を 1 段浅くする（generic）**

envs/ を剥がしたことで terragrunt.hcl の在り処が 1 段浅くなる。`../../modules` → `../modules`、`../../..//` → `../..//` を aws 配下の全 terragrunt.hcl に一括適用する:

Run:
```bash
ruby -i.bak -pe '
  gsub(%r{source = "../../modules"}, %q{source = "../modules"});
  gsub(%r{source = "../../..//}, %q{source = "../..//});
' $(find aws -name terragrunt.hcl -not -path '*/.terragrunt-cache/*')
find aws -name 'terragrunt.hcl.bak' -delete
```
Expected: source が 1 段浅くなる。他パターン（例: 独自の相対 path）があれば validate 段階で発覚する。

- [ ] **Step 3: 全 aws stack で terragrunt hclvalidate**

Run:
```bash
for f in $(find aws -name terragrunt.hcl -not -path '*/.terragrunt-cache/*'); do
  dir=$(dirname "$f")
  echo "=== $dir ==="
  ( cd "$dir" && terragrunt hclvalidate ) || { echo "FAIL $dir"; exit 1; }
done
```
Expected: 全 stack で成功。

- [ ] **Step 4: commit**

```bash
git add aws
git commit -s -m "refactor(platform/aws): drop envs/ layer, shorten terragrunt source paths

git mv keeps history; state keys unchanged because root.hcl derives
env from path tail. Local-module sources go from ../../modules to
../modules; go-getter subdir sources go from ../../..//{svc}/modules
to ../..//{svc}/modules."
```

---

### Task 3.2: platform github/ 配下の envs/ 剥がす

**Files:**
- Move: `github/repository/envs/master/` → `github/repository/master/`
- Move: `github/branch/envs/master/` → `github/branch/master/`
- Modify: 各 stack の `terragrunt.hcl` の `source`

- [ ] **Step 1: envs/ 直下の env dirs を親に move**

Run:
```bash
for svc_envs in github/*/envs; do
  svc=$(dirname "$svc_envs")
  for env_dir in "$svc_envs"/*/; do
    env_name=$(basename "$env_dir")
    git mv "$env_dir" "$svc/$env_name"
  done
  rmdir "$svc_envs"
done
```

- [ ] **Step 2: terragrunt.hcl の source を書き換え**

Run:
```bash
for f in github/repository/master/terragrunt.hcl github/branch/master/terragrunt.hcl; do
  sed -i.bak 's|source = "../../modules"|source = "../modules"|' "$f"
  rm "$f.bak"
done
```

- [ ] **Step 3: terragrunt validate**

Run:
```bash
for f in github/repository/master/terragrunt.hcl github/branch/master/terragrunt.hcl; do
  dir=$(dirname "$f")
  ( cd "$dir" && terragrunt hclvalidate )
done
```
Expected: 両 stack で成功。

- [ ] **Step 4: commit**

```bash
git add github
git commit -s -m "refactor(platform/github): drop envs/ layer, shorten terragrunt source paths"
```

---

### Task 3.3: workflow-config.yaml を更新

**Files:**
- Modify: `workflow-config.yaml`

- [ ] **Step 1: stack_conventions を書き換え**

`workflow-config.yaml` L23-39 の `stack_conventions:` を編集し、`directory: "envs/{environment}"` を `"{environment}"` に:

```yaml
stack_conventions:
  - root: "aws/{service}"
    stacks:
      - name: terragrunt
        directory: "{environment}"
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

- [ ] **Step 2: commit**

```bash
git add workflow-config.yaml
git commit -s -m "chore(workflow-config): drop envs/ from stack_conventions directories"
```

---

### Task 3.4: deploy-actions pin を v1.3.0 に更新

**Files:**
- Modify: `.github/workflows/auto-label--label-dispatcher.yaml:36`
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml:47`

- [ ] **Step 1: pin 対象 SHA を取得**

Phase 1 の PR がマージ済みなら:
```bash
cd /Users/takanokenichi/GitHub/panicboat/deploy-actions && git rev-parse origin/main
```

- [ ] **Step 2: workflow YAML の pin を書き換え**

`.github/workflows/auto-label--label-dispatcher.yaml` L36 と `.github/workflows/auto-label--deploy-trigger.yaml` L47 の `panicboat/deploy-actions/label-{dispatcher,resolver}@<OLD_SHA>` を `@<NEW_SHA>` に、コメントを `# v1.3.0` に更新。

- [ ] **Step 3: commit**

```bash
git add .github/workflows/auto-label--label-dispatcher.yaml \
        .github/workflows/auto-label--deploy-trigger.yaml
git commit -s -m "chore(ci): pin deploy-actions to v1.3.0"
```

---

### Task 3.5: scripts と renovate.json の envs/ 削除

**Files:**
- Modify: `scripts/eks-lifecycle/lib/30-destroy-stacks.sh`
- Modify: `scripts/eks-lifecycle/lib/common.sh`
- Modify: `scripts/kubernetes-hydrate/hydrate-component.sh`
- Modify: `.github/renovate.json`

- [ ] **Step 1: 30-destroy-stacks.sh を修正**

`scripts/eks-lifecycle/lib/30-destroy-stacks.sh` L91, L100, L103 の `aws/${stack}/envs/${ENV}` を `aws/${stack}/${ENV}` に。

- [ ] **Step 2: common.sh を修正**

`scripts/eks-lifecycle/lib/common.sh` L86 の `aws/eks/envs/${ENV}/env.hcl` を `aws/eks/${ENV}/env.hcl` に。

- [ ] **Step 3: hydrate-component.sh を修正**

`scripts/kubernetes-hydrate/hydrate-component.sh` L30 の `aws/eks/envs/${env}/env.hcl` を `aws/eks/${env}/env.hcl` に。

- [ ] **Step 4: renovate.json を修正**

`.github/renovate.json` L108 の regex `"/^aws/eks/envs/.+/env\\.hcl$/"` を `"/^aws/eks/.+/env\\.hcl$/"` に。

- [ ] **Step 5: 修正の網羅確認**

Run:
```bash
git grep -F 'envs/' -- scripts .github
```
Expected: ヒットなし（もし他に残っていれば追加修正）。

- [ ] **Step 6: commit**

```bash
git add scripts/eks-lifecycle/lib/30-destroy-stacks.sh \
        scripts/eks-lifecycle/lib/common.sh \
        scripts/kubernetes-hydrate/hydrate-component.sh \
        .github/renovate.json
git commit -s -m "chore(scripts): drop envs/ from lifecycle / hydrate scripts and renovate rule"
```

---

### Task 3.6: platform README を更新

**Files:**
- Modify: `README.md`, `README-ja.md`
- Modify: `aws/iam-service-linked-roles/README.md`
- Modify: `aws/eks/README.md`
- Modify: `scripts/eks-lifecycle/README.md`

- [ ] **Step 1: `README.md` を更新**

L20 の tree コメント:
```
├── aws/                 # Terragrunt stacks per service ({environment})
```
（`(envs/{environment})` → `({environment})`）

L43-44 の表:
```
| AWS infrastructure | `aws/{service}/{environment}` | Terragrunt + OpenTofu (`reusable--terragrunt-executor.yaml`) |
| GitHub configuration | `github/{service}/{environment}` | Terragrunt + OpenTofu (`reusable--terragrunt-executor.yaml`) |
```
（`envs/` を削除）

- [ ] **Step 2: `README-ja.md` に同内容を反映**

L20, L43-44 相当の日本語箇所を同様に修正。

- [ ] **Step 3: `aws/iam-service-linked-roles/README.md` を更新**

L5 の見出し `## envs/production のみを使う` → `## production 環境のみを使う`
L7 の本文の `envs/production 以外の環境ディレクトリ (envs/staging 等)` → `production 以外の環境ディレクトリ (staging 等)`

- [ ] **Step 4: `aws/eks/README.md` を更新**

L21 `envs/production/env.hcl` → `production/env.hcl`
L83 `cd aws/eks/envs/production` → `cd aws/eks/production`
L111 の本文 `envs/production/env.hcl` → `production/env.hcl`

- [ ] **Step 5: `scripts/eks-lifecycle/README.md` を更新**

L79 の例示 `cd aws/$stack/envs/production` → `cd aws/$stack/production`

- [ ] **Step 6: envs/ 残存の最終確認**

Run:
```bash
git grep -E 'envs/(production|master|develop)' -- ':!.claude/worktrees' ':!docs/superpowers'
git grep -F 'aws/envs' -- ':!.claude/worktrees' ':!docs/superpowers'
```
Expected: 両 grep ともヒットなし。

- [ ] **Step 7: commit**

```bash
git add README.md README-ja.md \
        aws/iam-service-linked-roles/README.md \
        aws/eks/README.md \
        scripts/eks-lifecycle/README.md
git commit -s -m "docs(platform): drop envs/ from tree, tables, and examples"
```

---

### Task 3.7: Draft PR

- [ ] **Step 1: push**

Run:
```bash
git push -u origin refactor/infrastructure-layout
```

- [ ] **Step 2: Draft PR 作成**

Run:
```bash
gh pr create --draft --title "refactor(infrastructure): drop envs/ layer across aws/ and github/" --body "$(cat <<'EOF'
## Summary

- Move each service's \`{aws,github}/{svc}/envs/{env}/\` to \`{aws,github}/{svc}/{env}/\` (git mv preserves history).
- Update terragrunt source paths one level shallower for local-only modules; go-getter subdir sources go from \`../../..//{svc}/modules\` to \`../..//{svc}/modules\`.
- Update \`workflow-config.yaml\` stack_conventions directories from \`envs/{environment}\` to \`{environment}\`.
- Update lifecycle scripts, hydrate script, and Renovate regex to drop \`envs/\`.
- Pin deploy-actions to v1.3.0.

## Test plan

- [ ] \`terragrunt hclvalidate\` passes on every stack (aws / github)
- [ ] Terraform state keys unchanged (verified: root.hcl derives env from path tail)
- [ ] Label-resolver in CI produces the expected matrix
- [ ] \`scripts/eks-lifecycle/lib/*.sh\` still resolves \`env.hcl\` on the new paths
- [ ] Renovate PR against \`aws/eks/production/env.hcl\` fires with the new regex
EOF
)"
```

---

## Post-merge checklist (順序保存)

以下は各 PR merge 後にリポ横断で行う確認事項。全 Phase 完了後にまとめて実施。

- [ ] Phase 1 (deploy-actions) が merge され v1.3.0 として release される
- [ ] Phase 2 (monorepo) の pin が v1.3.0 の release SHA を指していることを最終確認、必要ならピンだけ再 commit
- [ ] Phase 3 (platform) も同様に pin を最終確認
- [ ] monorepo main への merge 直後、`deploy:monolith` PR で terragrunt matrix に AWS / Stripe の 2 target が出ることを実 CI で確認
- [ ] platform main への merge 直後、既存 service（例: `deploy:eks-traces`）が正しく target 生成されることを確認
