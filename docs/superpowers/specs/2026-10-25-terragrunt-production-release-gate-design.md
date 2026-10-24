# Terragrunt Production Release Gate Design

## Context

### Why

`dystopia` は今 `dystopia/lambda` で動いているが、これから `dystopia/{service}/infrastructure/aws` に stack を置いていく。
そのときに develop を挟み、module の変更が develop と production に同じ main merge で apply されないようにしたい。
production には、アプリ（monolith / frontend）のリリースと一緒に出すのが本来の形で、infrastructure は将来アプリごとに分解する予定がある（今回は分解しない）。
platform では同じ問題を panicboat/platform#1105 で解決しているので、同じ仕組みを monorepo に入れる。

### Current state

- `workflow-config.yaml` の terragrunt stack は paths に `dystopia/{service}/aws/{environment}` と `system-components/{service}/infrastructure/aws/{environment}` を持ち、環境は `production` だけ。`production` は `exclude` されている
- `auto-label--deploy-trigger.yaml` は terragrunt の target を PR で plan、main push で apply する（環境の区別なし）
- `release.yml` は `*/release-please-config.json` を見つけて matrix で release-please を回す。設定は `dystopia/monolith`・`dystopia/frontend`・`system-components/pennyworth` にある
- `auto-release--trigger.yaml` は release 公開を受けて、その service の container image を build して push する
- `deploy-dystopia-lambda.yaml` は main push で lambda の image build・`dystopia/lambda/aws/production` の apply・migration・アプリ更新を行う
- container stack（`dystopia/{service}`・`system-components/{service}`）は、service ディレクトリ配下のどの変更にも `deploy:{service}` を付ける（VERIFIED：deploy-actions v2.0.1 `PatternMatcher.extract_prefix`）。label-resolver はそのラベルを terragrunt の全環境に展開するので、module の変更も全環境の target になる
- develop（270242382571）と production（337169763788）のアカウントに state bucket `terragrunt-state-<account>` と lock table `terragrunt-state-locks` がある。develop の plan role は monorepo の `pull_request` と `main`、apply role は `main` と `environment:develop` を信頼している（VERIFIED：`aws iam get-role`）
- GitHub environment `production`（monorepo）は policy 0 個で、どの ref からも deploy できない（platform#1110）

## Goals

- develop は PR で plan、main merge で apply する
- production は、その service のアプリのリリース公開で apply する。release PR に production の plan を出す
- terragrunt stack を `{product}/{service}/infrastructure/aws/{environment}` に一本化する
- production は今は除外し、release PR は作られるが plan も apply もしない（platform と同じ）
- workflow のファイル名・`name` を platform#1113 と同じ規則に揃え、全 workflow の先頭に 1 行の説明コメントを置く
- README のパスをリンクにし、Deployment の Trigger を platform と同じ構成にする

## Non-goals

- infrastructure をアプリごとに分解すること
- `deploy-dystopia-lambda.yaml` を変えること（ユーザー決定：不可侵。ファイル名・`name`・コメントも含めて触らない）
- `dystopia/infrastructure` と `dystopia/lambda` を新しい仕組みで扱うこと（paths から外れ、CI の terragrunt の対象外になる）
- container image の build の仕組みを変えること

## Anti-goals

- main merge で production に apply される経路が残ること
- container だけの service（frontend など）の release 公開が、terragrunt の target がないことで失敗すること
- 既存の container build・kubernetes・lambda の deploy が壊れること

## Decisions

ユーザーと合意した事項。

- **develop を挟む**: develop は `apply_trigger: merge`、production は `apply_trigger: release`
- **release の単位はアプリ（release-please の component）**: `monolith-vX.Y.Z` の公開で、`{product}/monolith/infrastructure/aws/production` を apply する
- **terragrunt stack の paths は `{product}/{service}/infrastructure/aws/{environment}` だけ**: `dystopia/{service}/aws/{environment}` は削除する
- **`terragrunt-shared` は作らない**: container stack が service ディレクトリ配下の変更に `deploy:{service}` を付けるため
- **`dystopia/infrastructure` は扱わない**
- **lambda は不可侵**: `deploy-dystopia-lambda.yaml` は一切変えない。push の `paths` が `dystopia/monolith/**` を含むので、`dystopia/monolith/infrastructure/` だけの変更でも main merge で lambda の production deploy が走ることを許容する
- **`chore` と `refactor` もリリース対象にする**: infrastructure の `chore` / `refactor` が production に出る手段を持たせるため。monolith / frontend / pennyworth の設定に platform と同じ `changelog-sections` を足す。アプリのリリースにも Renovate の version bump などが載る
- **production は除外する**: `exclude: [{environment: production}]` を残す
- **GitHub environment `production`（monorepo）の policy を今のうちに tag `*-v*` 許可にする**: platform の `github/repository/master/monorepo.hcl` を変える（platform への別 PR）
- **空の stack で流れを通す**: `dystopia/monolith/infrastructure/aws/{develop,production}` をリソースのない stack として作る

## Design

### Environments

- `workflow-config.yaml` の terragrunt stack に `develop` を足し、両環境に `apply_trigger` を持たせる
  - `develop`：`ap-northeast-1`、`arn:aws:iam::270242382571:role/github-oidc-auth-develop-github-actions-{plan,apply}-role`、`apply_trigger: merge`
  - `production`：今の値のまま、`apply_trigger: release`
- `apply_trigger` が `merge` / `release` 以外か未設定なら CI で失敗させる（platform の `validate-apply-trigger.sh` と同じ）

### Label based deploy

- main push の resolver は `apply_trigger == 'merge'` の target にだけ apply を割り当てる（platform の action-type の式と同じ）
- PR では今どおり全 target を plan する

### Release

- release PR が開かれた・更新されたときに、その service の `apply_trigger: release` の環境を plan する
- release 公開（と tag を渡した `workflow_dispatch`）で、同じ環境を apply する。apply job は GitHub environment `production` を宣言し、`ref` に tag を渡す（platform と同じ）
- tag / branch から service を求め、`{product}/{service}/infrastructure/aws/{environment}` のうち存在する `release` の環境を target にする
  - service に `release` の環境ディレクトリがなければ `[]` を返して成功する（container だけの service のため。platform は失敗させるが、monorepo では release-please を container のリリースにも使っている）
  - `exclude` に一致する target は外す。target が空なら plan / apply の job を skip する
- 既存の container build はそのまま release 公開で動かす

### release-please の設定

- `release` の環境ディレクトリを持つ service は、`{product}/{service}/release-please-config.json` を持つことを CI で検査する
- release-please の各 package に、`apply_trigger: merge` の全環境について `{package}/infrastructure/aws/{environment}` を `exclude-paths` で並べ、develop だけの変更でリリースを作らない。CI でこの一覧を `workflow-config.yaml` と照合する
  - release-please v17.6.0 の `exclude-paths` は repo root からのパスで前方一致する（VERIFIED：platform#1105 の調査）
- 既存の monolith / frontend / pennyworth の設定に `exclude-paths` と `changelog-sections` を足す。`changelog-sections` は platform の `aws/<service>/release-please-config.json` と同じ（`feat`・`fix`・`perf`・`revert`・`refactor`・`chore` を表示し、`docs`・`style`・`test`・`build`・`ci` を隠す）
- `bootstrap-sha` は足さない。各設定は既に tag と manifest でリリースを重ねているので、release-please は前回の tag 以降の commit だけを見る

### Stacks

- `dystopia/monolith/infrastructure/aws/` に `root.hcl`・`modules/`（リソースなし）・`develop/`・`production/` を置く。state key は `dystopia/monolith/<environment>/terraform.tfstate`
- `system-components/pennyworth/infrastructure/aws/production` は paths に一致し続ける

### Workflow names

platform#1113 と同じ規則（起動のしかた + 役割）。job ID と concurrency group も新しい名前に揃える。

| 旧 | 新 | `name` |
|---|---|---|
| `auto-label--label-dispatcher.yaml` | `label-base-deploy--dispatcher.yaml` | Label Base Deploy - Dispatcher |
| `auto-label--deploy-trigger.yaml` | `label-base-deploy--resolver.yaml` | Label Base Deploy - Resolver |
| `release.yml` | `release--please.yaml` | Release - Please |
| `auto-release--trigger.yaml` | `release--build.yaml` | Release - Build |
| （新規） | `release--plan.yaml` | Release - Plan |
| （新規） | `release--deploy.yaml` | Release - Deploy |

- `deploy-dystopia-lambda.yaml` 以外の全 workflow の 1 行目に、何をする workflow かを英語 1 行のコメントで書く（ユーザー決定。workflow にはトップレベルの `description` がない）

### README

- 実在するパスを相対リンクにする（`{service}` を含むパス・複数あるファイル名・コードブロックはコード表記のまま）
- Deployment の Trigger を、platform と同じくイベントの表と `Targets` / `Releases` に分ける

## Constraints

- deploy-actions は v2.0.1（`1ab520e`）。独自の placeholder（`{product}`）を paths に書ける（VERIFIED：`PatternMatcher`）
- GitHub Actions は SHA 固定（`lint-actions.yml`）。新しい action を足さない
- release-please は GitHub App token で release PR を作るので、release PR でも `pull_request` workflow が動く
- release tag の形式は `<service>-vX.Y.Z`、release PR の branch は `release-please--branches--main--components--<service>`

## Left to the builder

- platform の `.github/scripts/terragrunt-release/` をどこまで流用するか（`{product}` を含む paths からの target の求め方、container だけの service の扱い）
- `reusable--terragrunt-executor.yaml` に `ref` と `github-environment` の入力を足す方法（platform と同じ形を推奨）
- 空の stack の `modules/` の最小構成（`terraform.tf` の `required_version` など）

## Calls made without the user

- lambda と `dystopia/infrastructure` は paths の削除で対象外になるので、`exclude` に lambda の rule は置かない
- container だけの service の release 公開は、terragrunt の target を `[]` にして成功させる
- label-dispatcher の release-please branch での skip は入れない。release PR は `CHANGELOG.md` と manifest しか変えず、container の検証を今どおり残すため
- production の除外を外したときの流れ（tag の checkout・`environment: production`・production の role）は、platform と同じく今回は実機で通さない
- `exclude` のコメント（eks-production teardown 中）は、release の仕組みを有効にするまで production を除外する、という内容に書き換える
- `dystopia/monolith/.dockerignore` に `infrastructure/` を足す（`aws/` と同じく、container image に infrastructure を入れないため）
- monorepo の container build は `release--deploy` ではなく `release--build` にする（terragrunt の apply と分けるため）

## Verification

- [ ] スクリプトのテストが通り、`validate-apply-trigger.sh` と `check-release-configs.sh` がリポジトリで成功する
- [ ] actionlint が新しいエラーを出さない
- [ ] 実装 PR で、`dystopia/monolith/infrastructure/aws/develop` の plan が走り、production の plan が出ない
- [ ] merge 後、develop が apply され、production は apply されない（lambda の production deploy は `deploy-dystopia-lambda.yaml` の paths により走る）
- [ ] monolith の release PR で `Release - Plan` の plan job が skip され、release 公開で `Release - Build` が今どおり image を build し、`Release - Deploy` の apply job が skip される
- [ ] frontend の release 公開で `Release - Deploy` が失敗しない
- [ ] platform 側の PR merge 後、monorepo の GitHub environment `production` の policy が tag `*-v*` になる
