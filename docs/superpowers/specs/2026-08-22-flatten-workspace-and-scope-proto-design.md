# Flatten workspace/ and scope proto per product

## Background

`services/` → `dystopia/` のリネーム (#1006) 直後に、3 つの構造的な課題が残っていることが分かった。

1. **`bin/codegen` がプロダクトごとに切り分けられていない** — リポジトリ直下の `bin/codegen` が `dystopia/monolith` と `dystopia/frontend` を直接列挙している。`proto/` も直下にありモノレポ横断の資産に見えるが、実際には 12 ドメイン (feed, identity, media, post, profile, social 等) すべてが dystopia のドメイン概念で、`system-components/holmes` は proto を一切参照していない。2 つ目のプロダクトが増えた時点で所有が曖昧になる。

2. **`.github/workflows/auto-release--trigger.yaml` の root 列挙が保守しづらい** — `for root in dystopia system-components; do ... if [ -d "$root/$SERVICE/workspace" ]` が、`workflow-config.yaml` が持つ知識を 2 つ重複させている: root の集合と、container stack の directory (`workspace`)。プロダクト root が増えるたびに手で編集が要り、workflow-config と静かに乖離しうる。

3. **`workflow-config.yaml` が目標構造を先取りしている** — ローカル未コミットの下書きが `docker: .` と `terragrunt: aws/envs/{environment}` を宣言しているが、実体は `workspace` と `terragrunt/envs/{environment}`。下書きは「こうしたい」という目標形であり、実体をそちらに合わせる。

3 件は独立した不具合ではなく、同一の再設計の別側面である。

## Decisions

| 論点 | 決定 | 理由 |
|---|---|---|
| `workspace/` の扱い | 廃止し service 直下にフラット化 | アプリ本体を service ルートに置き、`docker: .` を成立させる |
| proto の所有 | `proto/dystopia/` に product 名前空間を導入 | 所有を明示しつつ、`root: dystopia/{service}` にマッチしないため空振りラベルが出ない |
| proto の粒度 | product 単位のみ (ドメイン割りは現状維持) | monolith が提供・frontend が消費する共有契約なので、サービス単位の分割は成立しない |
| `buf.yaml` の位置 | `proto/dystopia/buf.yaml` へ移動 | buf v1 は入力ディレクトリを module root として扱うため、protos と同じ階層に置く |
| codegen ラッパー | `bin/codegen [product]` として直下に維持 | entry point を 1 つに保ちつつ product で分岐。`dystopia/bin/` に置くと `deploy:bin` の空振りラベルが出る |
| `terragrunt/` | `aws/` に改名 | platform の `aws/{service}/envs/{environment}` と規約を揃える |
| README 衝突 | 1 つに統合 | `{service}/README.md` と `workspace/README.md` が別内容で存在しフラット化で衝突する |
| container stack 名 | `docker` → `container` | 「stack 名 = reusable workflow の名詞」規則が 3 つ揃う (terragrunt-executor / kubernetes-builder / container-builder) |
| #2 の情報源 | `workflow-config.yaml` を yq で読む | README が source of truth と明言している。yq 4.53.3 は ubuntu runner に標準搭載 (VERIFIED) |

### 却下した案

- **`{category}/{service}` への root 一般化** — `label-dispatcher` の `PatternMatcher.extract_prefix` が先頭 literal を失い、`docs/foo/bar.md` のような任意の 2 階層パスを service として誤検知する。root は literal 先頭を維持する。
- **`release-please-config.json` を #2 の情報源にする** — packages キーが「リリース対象パス」と「tag になる component」の対応表を既に持っており jq だけで済むが、stack convention の source of truth は `workflow-config.yaml` である方が一貫する。
- **stack 名 `build`** — `reusable--kubernetes-builder.yaml` も "builder" であり、build という語が 2 つの stack にまたがって混乱する。
- **stack 名 `base`** — base image / base layer を連想させるが、これが作るのは最終的なアプリケーションイメージなので実態とずれる。
- **stack 名 `image` / `oci`** — 成果物として正確だが、`container` の方が既存の `reusable--container-builder.yaml` と一致し命名規則が揃う。

## Target Structure

```
proto/
  dystopia/
    buf.yaml
    feed/v1/  identity/v1/  media/v1/  post/v1/  profile/v1/  social/v1/ ...
bin/
  codegen                    # bin/codegen [product] / 引数なしで全 product
dystopia/
  monolith/                  # ← workspace/ の中身がすべてここへ
    <アプリ本体一式>
    CHANGELOG.md  README.md  README-ja.md
    kubernetes/overlays/{environment}/
    aws/envs/{environment}/  aws/modules/
  frontend/                  # 同上 (aws/ は持たない)
system-components/
  holmes/                    # 同上
```

移動規則は「`{service}/workspace/` の中身をすべて `{service}/` 直下へ上げ、`workspace/` を削除する」。個別ファイルは列挙しない (実体と乖離するため)。実際の中身は以下:

- **monolith** — `app/ bin/ config/ db/ lib/ public/ slices/ spec/ stubs/`、`Dockerfile .dockerignore .env .gitignore .rspec buf.gen.yaml config.ru docker-compose.yaml Gemfile Gemfile.lock Guardfile package.json package-lock.json Procfile.dev Rakefile README.md`
- **frontend** — `public/ src/`、`Dockerfile .dockerignore .gitignore buf.gen.yaml docker-compose.yaml eslint.config.mjs instrumentation.ts next.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml postcss.config.mjs tsconfig.json README.md`
- **holmes** — `internal/`、`Dockerfile .dockerignore .gitignore go.mod main.go` (`go.sum` は無い — 標準ライブラリのみに依存)

`frontend` に `aws/` が無いのは現状どおり (terragrunt stack を持たない)。`buf.gen.yaml` は monolith / frontend の両方にある。

### 衝突の有無 (VERIFIED)

`{service}/` 直下と `{service}/workspace/` 直下で名前が衝突するのは **monolith と frontend の `README.md` のみ**。`.gitignore` は workspace 側にしか無いため衝突しない。

## workflow-config.yaml

```yaml
stack_conventions:
  - root: dystopia/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        directory: aws/envs/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}

  - root: system-components/{service}
    stacks:
      - name: container
        directory: .
      - name: terragrunt
        directory: aws/envs/{environment}
        required_attributes: [aws_region, iam_role_plan, iam_role_apply]
      - name: kubernetes
        directory: kubernetes/overlays/{environment}
```

`environments` セクションは本 spec のスコープ外 (別途判断する)。

### `directory: .` の挙動 (VERIFIED)

`stack_conventions_for` は `"#{root}/#{directory}"` を組み立てるため、パターンは `dystopia/{service}/.` になる。

- `GenerateMatrix#stack_directory_exists?` → `File.directory?("<repo>/dystopia/monolith/.")` → true
- `working_directory` は `dystopia/monolith/.` (末尾 `/.` 付き) になる。GitHub Actions の `working-directory` でも docker build context でも有効
- `label-dispatcher` は `all_directory_patterns` に root 単体 (`dystopia/{service}`) も含む (`workflow_config.rb:160-163`) ため、service 配下の任意の変更を検出できる

## bin/codegen

対象サービスの決め方を **`bin/codegen` を持つサービスが codegen 対象** という規約にする。root の orchestrator は列挙せず discover するだけになる。

```bash
# bin/codegen [product]  — 引数なしなら proto/ 配下の全 product
for product in "${products[@]}"; do
  for svc in "$product"/*/; do
    [ -x "${svc}bin/codegen" ] || continue
    echo "[codegen] ${svc}"
    ( cd "$svc" && $RUN_PREFIX ./bin/codegen )
  done
done
```

現状 monolith だけが `bin/codegen` (Ruby, buf + grpc-tools) を持ち、frontend は `package.json` の `proto:gen` script を使っている。規約を成立させるため **`dystopia/frontend/bin/codegen` を新設**し、中身は `pnpm proto:gen` を呼ぶだけの薄いラッパーとする。

こうすると「どのサービスがどうやって codegen するか」の知識が各サービス内に閉じ、root には残らない。サービス追加時に `bin/codegen` を編集する必要がなくなる。

## Path Changes

| 対象 | 変更前 | 変更後 |
|---|---|---|
| monolith codegen (`bin/codegen:33`) | `buf generate ../../../proto` | `buf generate ../../proto/dystopia` |
| frontend (`package.json:12`) | `buf generate ../../../proto` | `buf generate ../../proto/dystopia` |
| container stack directory | `workspace` | `.` |
| terragrunt stack directory | `terragrunt/envs/{environment}` (コメントアウト) | `aws/envs/{environment}` (有効) |

`dystopia/{service}/` から `proto/dystopia/` への相対パスは `../../proto/dystopia`。service が 1 階層上がり、proto が 1 階層下がるため、`../../../proto` から 2 段変化する。

## CI Changes

### auto-release--trigger.yaml

root 列挙と `workspace` のハードコードを廃し、`workflow-config.yaml` から導出する。

```yaml
      - name: Resolve working directory
        id: resolve-dir
        env:
          SERVICE: ${{ steps.parse.outputs.service }}
        run: |
          set -euo pipefail
          # workflow-config.yaml が stack convention の source of truth。
          # root を列挙して {service} を展開し、実在するものを採用する。
          while IFS= read -r root_pattern; do
            dir="${root_pattern//\{service\}/$SERVICE}"
            if [ -d "$dir" ]; then
              echo "working-directory=$dir" >> "$GITHUB_OUTPUT"
              exit 0
            fi
          done < <(yq -r '.stack_conventions[].root' workflow-config.yaml)
          echo "::error::No directory found for service '$SERVICE' under any stack_conventions root in workflow-config.yaml"
          exit 1
```

新しいプロダクト root を追加するとき、編集するのは `workflow-config.yaml` だけになる。

### auto-label--deploy-trigger.yaml

stack 名の変更に追随する (2 箇所)。

- `contains(needs.deploy-trigger.outputs.targets, '"stack":"docker"')` → `'"stack":"container"'`
- `matrix.target.stack == 'docker'` → `matrix.target.stack == 'container'`

### .dockerignore

build context が `workspace/` から service 全体に広がるため、デプロイ関心事の変更で build cache が無効化される。各 service の `.dockerignore` に以下を追加する。

```
kubernetes/
aws/
CHANGELOG.md
README.md
README-ja.md
```

### docker-compose.yaml

monolith / frontend の `docker-compose.yaml` は `build: .` と `volumes: - .:/app` を使う。フラット化で `.` が service 全体を指すようになり、dev コンテナに `kubernetes/` や `aws/` もマウントされる。`.dockerignore` は build にしか効かないため volume mount には影響しない。

実害は「開発コンテナ内に不要なディレクトリが見える」だけで動作は壊れないため、本 spec では対応しない。気になる場合は mount を `.:/app` から個別指定に変える (別途判断)。

## Not Changing

以下は変更不要であることを確認済み。

- **Dockerfile の `COPY` パス** — 中身が丸ごと 1 階層上がるので相対位置は不変
- **release-please の package キー** — `dystopia/monolith` のまま。CHANGELOG.md も service 直下のまま
- **Flux の kustomize overlay パス** — service 直下からの相対位置は不変 (`./dystopia/{service}/kubernetes/overlays/production`)
- **terragrunt の `source = "../../modules"`** — `terragrunt/envs/{env}` → `aws/envs/{env}` は相対深度が同じ
- **deploy-actions 本体** — stack 名 `docker` はテストの fixture にしか現れず、本体コードは完全にデータ駆動 (VERIFIED)
- **`.github/renovate.json` の `datasourceTemplate: docker`** — Renovate の datasource 名であり stack 名とは無関係

## Risks

| リスク | 影響 | 緩和 |
|---|---|---|
| `git mv` の規模が大きく rename 検出が崩れる可能性 | レビューが困難になる | ディレクトリ単位で `git mv` し、内容変更を別コミットに分ける |
| build context 拡大による cache 無効化 | CI 時間の増加 | `.dockerignore` に deploy 関心事を追加 |
| proto 相対パスの 2 段変化を片方だけ直す | codegen が壊れる | monolith / frontend 両方を同一タスクで変更し、実際に codegen を走らせて検証 |
| stack 名変更の取りこぼし | deploy job が起動しない | `git grep '"stack":"docker"'` と `stack == 'docker'` の残存ゼロを確認 |

## Validation

- `git grep "workspace/"` の残存が意図した箇所のみ (docs/superpowers を除く)
- `bin/codegen dystopia` が実際に走り、Ruby / TypeScript の stub が再生成される
- `kubectl kustomize` が 3 overlay すべてで通る
- PR 上で `Dispatch Labels` が pass し、3 サービスの `Deploy Container` が起動する
- `auto-release--trigger.yaml` の working-directory 解決が新ロジックで正しい値を返す

## Out of Scope

- `workflow-config.yaml` の `environments` セクション (master 有効化 / develop・production の扱い) — 別途判断する
- platform リポジトリ側の `aws/{service}` stack convention 有効化 — PR #823 で revert 済み、再設計は別件
- `system-components` の分類そのものの見直し
