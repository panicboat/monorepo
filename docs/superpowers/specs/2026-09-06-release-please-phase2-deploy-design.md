# release-please Phase 2: Infrastructure Production Deploy Trigger Design

## Overview

`panicboat/platform` で先に実施した release-please Phase 2([panicboat/platform#886](https://github.com/panicboat/platform/pull/886)、spec: `docs/superpowers/specs/2026-09-06-release-please-phase2-deploy-design.md` in that repo)と同じ問題を、`monorepo` の infrastructure(terragrunt: aws / stripe)側に適用する。

`monorepo` の container(Docker image)deploy は既に完成している。release-please は manifest mode で稼働中(`monolith`/`frontend`/`pennyworth` の3 component)、`auto-release--trigger.yaml` が `release: published` を起点に tag 名から component を特定し、semver タグ付き image を push、Flux `ImagePolicy`(`filterTags` で semver のみ pickup)が production への反映を担っている。**この経路は無変更**。

一方 infrastructure(terragrunt)側は、`workflow-config.yaml` の `environments` が空(develop はコメントアウト)のまま長らく放置されており、CI からは一切 deploy できない状態だった。ところが本 spec の検討中に **#1054(`chore(workflow-config): enable production for CI-driven deploy automation`)で production が有効化済み**になっており、`auto-label--deploy-trigger.yaml` 側には production を除外する仕組みが無いまま である。

`monorepo` は `production` 以外の environment を1つも持たない(develop は未整備)。そのため platform の `github-oidc-auth`(master と production の両方を持つ唯一の service)のような「稀な混入」ではなく、**`infrastructure/{aws,stripe}` を触る PR が merge されたら即座に production へ terragrunt apply が走る、というのが唯一のデフォルト挙動**になっている。#1054 以降まだ infrastructure/ を触った commit は無く実害は出ていないが、次に触られた瞬間に発火する。

## Scope

### In scope

- production 環境のみ(develop は未整備のため対象外、platform と同じ判断)
- `auto-label--deploy-trigger.yaml` の継続的パイプラインから production を確実に除外する(**最優先**)
- `dystopia/{monolith,frontend}` および `system-components/pennyworth` の terragrunt(aws、monolith のみ stripe も)を、release published を起点に production へ apply する

### Out of scope

- container(Docker image)deploy の経路 — 既に完成しているため無変更
- kubernetes stack — `dystopia/{service}/kubernetes/overlays/{environment}` は Flux の image automation が別途担っており、本 spec のスコープ外
- `develop` environment(未整備のため)

## 継続的パイプラインからの production 除外(最優先)

platform で最終的に採用した方式をそのまま踏襲する。`environments:` を明示的な allowlist にすると、develop が将来有効化されたときにこの workflow を再度手で直す必要が生じる(develop はまだ `workflow-config.yaml` に存在しないため `environments: 'develop'` のような直接指定も今は使えない)。

`auto-label--deploy-trigger.yaml` の `deploy-trigger` job:

- Label Resolver には `environments:` を指定しない(常に全 environment を解決させる)
- Label Resolver の後に、resolver が返した `targets` から `environment == "production"` のものだけを除いた JSON を作るフィルタステップを追加する
- job の `outputs.targets` / `outputs.has-targets` は、このフィルタ後の結果を指すように変更する

```yaml
      - name: Filter out production targets
        id: filter
        env:
          TARGETS: ${{ steps.resolver.outputs.targets }}
        run: |
          set -euo pipefail
          filtered=$(echo "$TARGETS" | jq -c '[.[] | select(.environment != "production")]')
          if [ "$(echo "$filtered" | jq 'length')" -gt 0 ]; then
            echo "has-targets=true" >> "$GITHUB_OUTPUT"
          else
            echo "has-targets=false" >> "$GITHUB_OUTPUT"
          fi
          echo "targets=$filtered" >> "$GITHUB_OUTPUT"
```

`deploy-trigger` job の `outputs`:

```yaml
    outputs:
      targets: ${{ steps.filter.outputs.targets }}
      has-targets: ${{ steps.filter.outputs.has-targets }}
```

これにより、container stack(environment を持たないため `environment` フィールドは常に `null` — `null != "production"` は真なので除外されず、従来通り継続的パイプラインで build される)には影響しない。

## release published → production terragrunt apply

既存の `auto-release--trigger.yaml` を拡張する。新規 workflow は作らない(`detect-component` job が既に tag パース・working-directory 解決の仕組みを持っているため)。

### 構造上の注意点

`platform` は `aws/{service}/production` という単一パターンだったが、`monorepo` の `stack_conventions` は次の2点で複雑になる。

1. root が2種類(`dystopia/{service}` と `system-components/{service}`)
2. `dystopia/{service}` の terragrunt stack は `aws` と `stripe` の**2つ**(`id: aws` / `id: stripe`)。`system-components/{service}` の terragrunt stack は1つ(`id` 指定なし、stack_id は `terragrunt` になる)

このため、tag から特定した `service` に対して「どの root にマッチしたか」「その root 配下の terragrunt stack(1つ or 複数)のうち `production` ディレクトリが実在するものはどれか」を都度解決する必要がある。

### 実装方針

`detect-component` job の `resolve-dir` ステップは、現在 `stack_conventions[].root` を1つずつ試して実在するディレクトリを探すループになっている。これを **`.github/release-please-config.json` の `packages` を直接引く方式に置き換える**。この config の `key`(例: `"dystopia/monolith"`)は component 名から path への対応そのものであり、release-please 自身が tag/release を作る際に使っている一次情報。ディレクトリを probe するより単純かつ確実(仮に同名 service が2つの root に存在するような取り違えも起きない)。

既存 `resolve-dir` ステップの置き換え:

```yaml
      - name: Resolve working directory
        id: resolve-dir
        env:
          SERVICE: ${{ steps.parse.outputs.service }}
        run: |
          set -euo pipefail
          # mikefarah/yq has no jq --arg; reference an env var via env(NAME) instead.
          path=$(yq -r \
            '.packages | to_entries[] | select(.value.component == env(SERVICE)) | .key' \
            .github/release-please-config.json)
          if [ -z "$path" ]; then
            echo "::error::No release-please package found with component '$SERVICE'"
            exit 1
          fi
          echo "working-directory=$path" >> "$GITHUB_OUTPUT"
```

(`detect-component` job の `outputs.working-directory` はそのまま、内部実装だけが変わる。)

その後、production 向け terragrunt target を JSON 配列として組み立てる新規 job `resolve-infra-targets` を追加する。root テンプレート(`dystopia/{service}` 等)は、`working-directory` の末尾から `service` 名を取り除いた文字列操作だけで求まる(`workflow-config.yaml` の `stack_conventions` を hardcode で列挙する必要はない)。

```yaml
  resolve-infra-targets:
    name: 'Resolve Production Infra Targets'
    needs: detect-component
    runs-on: ubuntu-latest
    # workflow_dispatch pre-exists as a "rebuild this component's image" escape
    # hatch (for container-build) and must not also trigger a production
    # terragrunt apply — only release published does.
    if: github.event_name == 'release'
    outputs:
      targets: ${{ steps.resolve.outputs.targets }}
      has-targets: ${{ steps.resolve.outputs.has-targets }}
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Resolve
        id: resolve
        env:
          SERVICE: ${{ needs.detect-component.outputs.service }}
          ROOT: ${{ needs.detect-component.outputs.working-directory }}
        run: |
          set -euo pipefail
          aws_region=$(yq '.environments[] | select(.environment == "production") | .stacks.terragrunt.aws_region' workflow-config.yaml)
          iam_role_apply=$(yq '.environments[] | select(.environment == "production") | .stacks.terragrunt.iam_role_apply' workflow-config.yaml)

          # Strip the trailing "/$SERVICE" off ROOT (e.g. "dystopia/monolith")
          # and put "{service}" back, recovering the stack_conventions.root template.
          root_pattern="${ROOT%"$SERVICE"}{service}"

          # If root_pattern matches no stack_conventions root at all, the
          # ROOT/SERVICE derivation itself is broken. Entering the loop below
          # with zero matches would be indistinguishable from "this component
          # legitimately has no terragrunt stack" (has-targets=false), silently
          # skipping the production deploy. Fail loudly instead.
          matched_root=$(ROOT_PATTERN="$root_pattern" yq -o=json -I=0 \
            '.stack_conventions[] | select(.root == env(ROOT_PATTERN))' workflow-config.yaml)
          if [ -z "$matched_root" ]; then
            echo "::error::No stack_conventions entry found for root pattern '$root_pattern' (derived from working-directory '$ROOT' and service '$SERVICE')"
            exit 1
          fi

          # Read one compact JSON object per stack (JSONL). TSV + bash's
          # `IFS=$'\t' read` silently drops a field when a stack has no
          # explicit id (tab is bash's IFS *whitespace*, so adjacent tabs
          # collapse instead of preserving the empty field) — hit in
          # practice for system-components' unnamed terragrunt stack.
          targets='[]'
          while IFS= read -r stack_json; do
            stack_name=$(echo "$stack_json" | jq -r '.name')
            [ "$stack_name" = "terragrunt" ] || continue
            stack_id=$(echo "$stack_json" | jq -r '.id // "terragrunt"')
            directory=$(echo "$stack_json" | jq -r '.directory')
            dir="${directory//\{environment\}/production}"
            full_dir="${ROOT}/${dir}"
            [ -d "$full_dir" ] || continue
            targets=$(echo "$targets" | jq -c \
              --arg service "$SERVICE" \
              --arg stack_id "$stack_id" \
              --arg dir "$full_dir" \
              --arg region "$aws_region" \
              --arg role "$iam_role_apply" \
              '. + [{"service":$service,"stack_id":$stack_id,"working_directory":$dir,"aws_region":$region,"iam_role_apply":$role}]')
          done < <(ROOT_PATTERN="$root_pattern" yq -o=json -I=0 '
            .stack_conventions[] | select(.root == env(ROOT_PATTERN)) | .stacks[]
          ' workflow-config.yaml)

          echo "targets=$targets" >> "$GITHUB_OUTPUT"
          if [ "$(echo "$targets" | jq 'length')" -gt 0 ]; then
            echo "has-targets=true" >> "$GITHUB_OUTPUT"
          else
            echo "has-targets=false" >> "$GITHUB_OUTPUT"
          fi

  deploy-infra:
    name: 'Deploy Infra (${{ matrix.target.service }}:${{ matrix.target.stack_id }})'
    needs: resolve-infra-targets
    if: needs.resolve-infra-targets.outputs.has-targets == 'true'
    strategy:
      matrix:
        target: ${{ fromJson(needs.resolve-infra-targets.outputs.targets) }}
      fail-fast: false
    uses: ./.github/workflows/reusable--terragrunt-executor.yaml
    with:
      service-name: ${{ matrix.target.service }}
      environment: production
      action-type: apply
      iam-role: ${{ matrix.target.iam_role_apply }}
      aws-region: ${{ matrix.target.aws_region }}
      working-directory: ${{ matrix.target.working_directory }}
      app-id: ${{ vars.APP_ID }}
    secrets:
      private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

`container-build` job(既存)は無変更、`resolve-infra-targets` / `deploy-infra` は並行して追加される新しい経路であり、互いに独立している。

### なぜ label-resolver / label-dispatcher を経由しないか

platform と同じ理由。`deploy:{service}` ラベルは environment を持たず、resolver は呼び出し時に渡された environment 集合を全部ループするだけなので、production を意図せず巻き込みうる。release published イベントは tag 名から component を直接特定できるので、この仕組みには一切触れずに済む。

## workflow-config.yaml

`production` は #1054 で既に有効化済み(本 spec での追加作業は不要)。IAM role / region は上記 `resolve-infra-targets` job が読む。

## Renovate との関係

platform と同様、Renovate の `semanticCommitType` は変更しない。release-please の既定動作(`feat`/breaking 以外でも patch bump)により、`chore` コミットも release 対象になる。

## Verification

- [ ] `auto-label--deploy-trigger.yaml` の `deploy-trigger` job が production を対象から除外している(`infrastructure/{aws,stripe}` を触る PR を merge しても production に apply されない)
- [ ] `monolith`/`frontend`/`pennyworth` いずれかの release PR をマージし release published すると、対応する service の production terragrunt(monolith は aws + stripe の両方)が apply される
- [ ] container build(既存経路)に影響がないことを確認する
- [ ] `frontend` は aws のみ、`pennyworth` は aws のみ(stripe は monolith だけ)であることを確認する
