# Release Environment Rule Design

## Context

### Why

terragrunt の環境をいつ適用するかは、workflow-config の `apply_trigger`（`merge` / `release`）で環境ごとに宣言している。
実際の値は、monorepo も platform も「production は `release`、それ以外は `merge`」で揃っていて、shared workflow も production が `release` 以外なら CI を失敗させている。
宣言できる自由度が実際には使われておらず、k8s の stack には `apply_trigger` がないので、terragrunt だけが宣言を持つずれも生んでいる。
`apply_trigger` をやめ、「production はリリース、それ以外は merge」という規則に揃える（#1748 の検討の中でユーザーが決定）。

### Current state

- `apply_trigger` を読んでいるのは panicboat/.github だけ（deploy-actions は読まない。VERIFIED: deploy-actions を grep）
  - `scripts/terragrunt-release/validate-apply-trigger.sh`: 値が `merge` / `release` 以外か、production が `release` でなければ失敗する
  - `scripts/terragrunt-release/release-targets.sh`: `apply_trigger == "release"` の環境を Release - Plan / Deploy の対象にする
  - `scripts/terragrunt-release/check-release-configs.sh`: `apply_trigger != "release"` の環境のディレクトリを release-please の `exclude-paths` に求める
  - `.github/workflows/reusable--label-base-deploy--resolver.yaml`: `main` への push で `matrix.target.apply_trigger == 'merge'` の target だけ apply する。同じ job で `validate-apply-trigger.sh` も実行する
  - `.github/workflows/reusable--test-terragrunt-release.yaml`: `validate-apply-trigger.sh` と `check-release-configs.sh` を実行する
  - `scripts/terragrunt-release/test.sh`・`scripts/workflows/test.sh`: 上の振る舞いのテスト
- workflow-config の `apply_trigger`
  - monorepo の terragrunt: develop は `merge`、production は `release`
  - platform の terragrunt: master・develop は `merge`、production は `release`
- monorepo の `kustomize` stack と platform の `helmfile` stack は `apply_trigger` を持たない。どちらも CI は適用せず、Flux が反映する
- workflow のコメント・README（monorepo・platform・panicboat/.github）が `apply_trigger` を説明している

## Goals

- workflow-config から `apply_trigger` をなくす
- terragrunt の環境は、名前が `production` ならリリースの publish で、それ以外なら `main` への merge で適用される
- 今の適用のタイミングを変えない（今の値が規則と一致しているため）

## Non-goals

- platform の `kubernetes/`（helmfile）をリリースで反映すること。今と同じく merge で Flux が反映する
- `exclude` の仕組みと値を変えること
  - monorepo と platform の `exclude: [{environment: production}]` は残す。production がリリースで実際に適用されるかは、今と同じく `exclude` で止まったまま

## Anti-goals

- production の環境が `main` への merge で適用される経路ができること
- 移行の途中で、どちらかのリポジトリの CI が失敗し続けること

## Decisions

ユーザーと合意した事項。

- **`apply_trigger` を workflow-config から外す**: monorepo と platform の両方
- **規則は「production はリリース、それ以外は merge」**: 環境名 `production` を shared workflow が特別に扱う
- **platform の helmfile は作り変えない**: CI が適用しない stack なので、この規則の対象外になる

## Design

### panicboat/.github

- `release-targets.sh`: 対象の環境を `production` にする
- `check-release-configs.sh`: `exclude-paths` に求める環境を `production` 以外にする
- `reusable--label-base-deploy--resolver.yaml`: apply の条件を `matrix.target.environment != 'production'` にし、`Validate apply_trigger` の step を消す
- `validate-apply-trigger.sh` を消し、`reusable--test-terragrunt-release.yaml` から呼び出しを消す
- テストを規則に合わせて書き換える（`apply_trigger` を持たない config で、production がリリース、それ以外が merge になること）
- workflow の 1 行目のコメントと README の `apply_trigger` の記述を、規則の説明に書き換える
- 規則の環境名 `production` は、各スクリプトと workflow で同じ値を使う（1 か所に定数として置けるなら置く）

### monorepo / platform

- `workflow-config.yaml` の terragrunt stack から `apply_trigger` を消す
- `.github/workflows/` の 1 行目のコメントと README の `apply_trigger` の記述を、規則の説明に書き換える
- panicboat/.github の参照を、この変更を含むリリースに更新する

### Rollout

1. panicboat/.github の変更を merge し、release PR をユーザーが merge してリリースする
   - 新しい shared workflow は `apply_trigger` を読まないので、`apply_trigger` が残っている config でも同じように動く
2. monorepo と platform で、shared workflow の参照をそのリリースの SHA に更新し、同じ PR で `apply_trigger` を消す
   - 参照の更新は Renovate を待たずに手で行う。Renovate の PR が先に来た場合は、そちらに `apply_trigger` の削除を載せてもよい

## Constraints

- GitHub Actions は SHA 固定（`lint-actions.yml`）
- 各リポジトリは panicboat/.github を SHA 固定の参照で呼ぶ。参照の更新は Renovate でも行われる

## Left to the builder

- 環境名 `production` を定数として 1 か所に置く方法（スクリプトと workflow の式で共有できるか）
- panicboat/.github のリリースの種類（今の consumer の振る舞いは変わらない）

## Calls made without the user

- `validate-apply-trigger.sh` は、`apply_trigger` が残っていないかを検査する形にせず消す。両リポジトリから同時に消し、読む処理もなくなるため
- monorepo の #1748（release gated k8s manifests）とは独立した変更として、別の PR で進める。monorepo では #1748 の PR と同じ stack に積む
- 設計書と実装 plan は #1748 のブランチ（`feat/release-gated-k8s-manifests`）に commit する

## Verification

- [ ] panicboat/.github の `scripts/terragrunt-release/test.sh` と `scripts/workflows/test.sh` が通る
- [ ] `apply_trigger` を消した monorepo と platform の workflow-config に対して、`release-targets.sh --all` が今と同じ target を返す
- [ ] `apply_trigger` を消した monorepo と platform の workflow-config に対して、`check-release-configs.sh` が成功する
- [ ] monorepo の PR で develop の plan が走り、merge 後に develop が apply され、production は apply されない
- [ ] actionlint が新しいエラーを出さない
