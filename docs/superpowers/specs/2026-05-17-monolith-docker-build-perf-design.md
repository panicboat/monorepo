# Monolith Docker Build Performance Design

## Overview

monolith service の Docker image build を multi-stage build + BuildKit cache mounts に切り替え、初回 build 後の連続 build を劇的に短縮する。同時に runtime image サイズも削減する。

直近の `monolith-v0.1.0` semver build (workflow_dispatch run 25975947040) は 12 分 53 秒 (= 全体 job 時間の 97%) を `Build and push Docker image` step が占めており、cold cache state からの `apt-get install` + `bundle install` の再実行が支配的だった。

この spec は Dockerfile + .dockerignore のみを変更する小さな改修であり、変更を main にマージすることで Phase 2 plan の Task 16 (= 次の release-please cycle で end-to-end 検証) も同時に実証する。

## Goal

- Warm cache (前回 build から Gemfile 不変) で **build step 1-3 分以内**
- Cold cache (GHA cache 失効) でも multi-stage の並列化により現状より改善
- runtime image サイズを **~600-800 MB** に削減 (現状 single-stage で build tool 含むため 1.5-2 GB 想定)
- Dockerfile 外の変更 (workflow / Flux / kustomize) はゼロ

## Scope

### In scope

- `services/monolith/workspace/Dockerfile` (修正): single-stage → multi-stage (builder + runner) + BuildKit cache mounts
- `services/monolith/workspace/.dockerignore` (新規作成、現状ファイル不在): 不要ファイルを除外して COPY コスト削減

### Out of scope

- `frontend` service の Dockerfile (同様パターンが効くが、frontend の build 時間は許容範囲内のため別途検討)
- `.github/workflows/reusable--container-builder.yaml` の cache 設定 (既存の `cache-from/to: type=gha,mode=max` がそのまま BuildKit cache mounts に効く)
- runtime のコマンド / 起動方法の変更 (`./bin/grpc` `./bin/start` などは deployment.yaml の command で override されており、Dockerfile CMD は実質使われていない)
- non-root user 化、HEALTHCHECK 追加などの security / observability 改善 (将来別 spec)

## Current State

### Dockerfile (現状)

```dockerfile
FROM ruby:4.0.3-slim

RUN apt-get update -qq && \
    apt-get install -y build-essential libpq-dev git libyaml-dev postgresql-client-17

WORKDIR /app

COPY Gemfile Gemfile.lock ./
# TODO: re-enable `bundle config set --local frozen true` once google-protobuf gemspec supports Ruby 4.0
RUN bundle install

COPY . .

EXPOSE 9001

CMD ["./bin/grpc"]
```

### 計測 (run 25975947040: workflow_dispatch で monolith-v0.1.0 を build)

- Set up Docker Buildx: 8s
- **Build and push Docker image: 12m53s** ← ボトルネック
- 他 step: 合算で約 20s

### Gemfile / Gemfile.lock の確認

- `gem ..., git:` / `github:` ソースなし
- `GIT` セクションなし (lockfile)
- → runner stage に `git` を含めなくても bundler が gem を解決可能

### .dockerignore の現状

`services/monolith/workspace/.dockerignore` は存在しない (ファイル不在を確認済)。本 spec で新規作成する。

## Target Architecture

### Dockerfile (改修後)

```dockerfile
# syntax=docker/dockerfile:1.7
ARG RUBY_VERSION=4.0.3

# =============================================================================
# Builder stage: install gems with cache mounts
# =============================================================================
FROM ruby:${RUBY_VERSION}-slim AS builder

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential libpq-dev git libyaml-dev

WORKDIR /app
COPY Gemfile Gemfile.lock ./

ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_JOBS=4 \
    BUNDLE_RETRY=3
# TODO: re-enable `bundle config set --local frozen true` once google-protobuf gemspec supports Ruby 4.0
RUN --mount=type=cache,target=/var/cache/bundle,sharing=locked \
    bundle install

# =============================================================================
# Runner stage: runtime image
# =============================================================================
FROM ruby:${RUBY_VERSION}-slim AS runner

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      libpq5 postgresql-client-17

WORKDIR /app
ENV BUNDLE_PATH=/usr/local/bundle
COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY . .

EXPOSE 9001
CMD ["./bin/grpc"]
```

### `.dockerignore` (新規作成)

```
.git
log/
tmp/
spec/
test/
coverage/
node_modules/
vendor/bundle/
.bundle/
*.log
.rspec_status
.dockerignore
Dockerfile
```

## Component Design

### A. `# syntax=` directive

`# syntax=docker/dockerfile:1.7` を先頭に追加。BuildKit の `--mount=type=cache` 構文を有効化する。

### B. `ARG RUBY_VERSION`

Ruby base image のバージョンを ARG にして builder / runner で共有。バージョン更新を 1 箇所で済ませる。

### C. Builder stage

- apt cache を `/var/cache/apt` と `/var/lib/apt` に mount (`sharing=locked` で並列 build の安全性確保)
- `rm -f /etc/apt/apt.conf.d/docker-clean` で debian の apt 後始末をスキップ (cache を残すため)
- `--no-install-recommends` で apt の不要 dependency を除外、image / cache 軽量化
- runtime に不要な build-essential / libpq-dev / git / libyaml-dev のみ install
- `BUNDLE_PATH=/usr/local/bundle` を export し、gem を image layer に焼き込む
- `--mount=type=cache,target=/var/cache/bundle` は bundler の **ダウンロード cache** (`.bundle` cache) として機能。実 gem は `/usr/local/bundle` に install される (= layer に残る)

### D. Runner stage

- 同じ base image (`ruby:${RUBY_VERSION}-slim`) を使い、bundler ランタイムバージョン不一致を防ぐ
- runtime に必要な library (`libpq5`、`postgresql-client-17`) のみ install
- builder で install した `/usr/local/bundle` 配下の gem を `COPY --from=builder` で持ち込む
- `COPY . .` でアプリケーションコードを copy (`.dockerignore` で除外済のものは含まれない)

### E. `.dockerignore`

- `.git`: 巨大、runtime 不要
- `log/`、`tmp/`: 開発時のログ / 一時ファイル
- `spec/`、`test/`、`coverage/`、`.rspec_status`: テスト関連 (runtime 不要)
- `node_modules/`、`vendor/bundle/`、`.bundle/`: ローカルでの依存 install 痕跡 (image には builder stage で install したものが入る)
- `*.log`: 開発時のログ
- `Dockerfile`、`.dockerignore`: image に含める必要なし

## Cache Behavior

### BuildKit cache mounts (mount=type=cache)

- apt: GHA runner 上の BuildKit が `/var/cache/apt` を「build cache 専用 volume」として永続化。同一 runner / 同一 cache backend (gha) で次回 build 時に再利用
- bundle: 同様に `/var/cache/bundle` が永続化される

### GHA cache (`cache-from/to: type=gha,mode=max`)

`reusable--container-builder.yaml` 既存設定。BuildKit の cache layer (mount cache 含む) を GitHub Actions cache に push/pull する。runner instance を跨いでも cache が共有される。

### 効果

| シナリオ | 現状 | 改修後 |
|---|---|---|
| 初回 build (GHA cache empty) | ~13 分 | ~8-10 分 (multi-stage 並列化分の改善) |
| 2 回目以降 (Gemfile 不変) | ~13 分 (現状の cache は機能していなかった) | **~1-3 分** (apt + bundle cache hit) |
| 2 回目以降 (Gemfile 変更あり) | ~13 分 | ~5-8 分 (apt cache hit、bundle install のみ走る) |

「現状の cache は機能していなかった」根拠: workflow_dispatch run 25975947040 が 12m53s かかった。この run は PR #623 merge 後初の build で、PR #623 マージ commit の sha は記録されている。GHA cache は `cache-from: type=gha` でリポジトリ全体の cache を pull するが、`type=raw` / `type=sha` tag の layer はあっても、本質的に `apt-get install` / `bundle install` の RUN layer が cache hit していなければ毎回 fresh 実行になる。Dockerfile の write-once layer (= `apt-get install` の hash) が cache hit するには「同じ apt-get install コマンド」「同じ FROM image」が成立する必要があり、これは成立しているはずなので、おそらく cache が古いか、initial cold の状態だった。改修後は `--mount=type=cache` で **mount volume として cache** されるため、layer cache とは独立に高速化される。

## Risks and Mitigations

| Risk | 緩和策 |
|---|---|
| `bundle install` で git-sourced gem が混入していると runner stage に git がなく runtime で fail | 事前確認済 (Gemfile / Gemfile.lock に git source なし)。将来 git source gem を追加する場合は runner stage の apt install に git を戻す必要があり、レビュー時に検出 |
| runner stage の `libpq5` / `postgresql-client-17` が runtime で不足 | 現状の Dockerfile が `libpq-dev` / `postgresql-client-17` を install しており、これらは dev header 込みのため runner は header 不要の `libpq5` で十分。`postgresql-client-17` はそのまま runner にも install (= runtime で `psql` を使う可能性ありと想定) |
| `--mount=type=cache` が BuildKit でないと動作しない | GitHub Actions の `docker/build-push-action` は BuildKit を有効化 (`Set up Docker Buildx` step で確認済)。`# syntax=docker/dockerfile:1.7` directive で構文も guaranteed |
| Image サイズ削減で `du -sh` や別管理の image size 警告に引っかかる | 現状の運用に image size 警告システムは存在しない (確認時点)。削減はメリット |
| Dockerfile の CMD (`./bin/grpc`) と deployment.yaml の command (`./bin/start`) の不一致 | deployment.yaml の command が override するため image CMD は実質関係ない (現状もそう)。本 spec ではこの不一致を整合させない (out of scope) |
| `.dockerignore` で誤って必要ファイルを除外 | 列挙したエントリは保守的に runtime 不要なもののみ。`spec/`/`test/` は GitHub Actions の test job 用なので image には不要 (= test は別 workflow で実行) |

## Implementation Order

1 PR で完結:

1. `services/monolith/workspace/Dockerfile` を multi-stage + cache mounts に書き換え
2. `services/monolith/workspace/.dockerignore` を新規作成
3. `perf(monolith):` で commit、PR (draft) を作成
4. PR の CI で build が走り、cold cache でも問題なく成功することを確認
5. PR を Ready & マージ
6. release-please が `chore(main): release monolith 0.X.Y` PR を出すのを待つ
7. release-please PR をマージ → `monolith-vX.Y.Z` tag + GitHub Release が生成
8. `auto-release--trigger.yaml` が release event で自動起動 → `ghcr.io/.../monolith:vX.Y.Z` を build/push
9. Flux ImagePolicy が pickup → ImageUpdateAutomation が `overlays/production/deployment.yaml` を rewrite → production rollout
10. kubectl 経由で rollout 完了確認

ステップ 6-10 が Phase 2 plan の Task 16 (end-to-end 検証) に相当する。

## Verification

### PR 上の CI (実装直後)

`reusable--container-builder.yaml` 経由で `Build and push Docker image` step が成功すれば実装的に通る。PR の CI は cold cache での build が中心 (GHA cache が PR 用 scope では空のことが多い) で、ここでは「multi-stage build が成立する」だけを確認する。

### main マージ後 (Phase 2 Task 16 統合)

```bash
# 1. release-please PR が出ることを確認
gh pr list --state open --search "in:title chore(main): release monolith"

# 2. PR マージ後、release event 起動の workflow を確認
sleep 60
gh run list --workflow=auto-release--trigger.yaml --limit 1 --json status,conclusion,event --jq '.[]'
# 期待: event: release, conclusion: success

# 3. ghcr に新 semver image が存在
gh api /users/panicboat/packages/container/monorepo%2Fmonolith/versions \
  --jq '.[].metadata.container.tags[]' | grep -E '^v0\.[0-9]+\.[0-9]+$'

# 4. Flux pickup + production rollout (最大 ~45m 待つ)
kubectl get imagepolicy -n flux-system monolith -o jsonpath='{.status.latestImage}'
git show origin/main:services/monolith/kubernetes/overlays/production/deployment.yaml | grep image:
kubectl rollout status deployment/monolith
```

### Build 高速化の効果測定

PR マージ後の release event 起動 build (= 改修後の初回 production build) と、その次の release event 起動 build (= 改修後の warm cache build) の所要時間を比較:

- 改修後の初回 (cold cache): 期待 8-10 分以内
- 改修後の 2 回目以降 (warm cache, Gemfile 不変): 期待 1-3 分

これは自然な release cycle で観測される。

## Future Work (Out of Scope)

- frontend Dockerfile への同パターン適用 (Next.js は SSR runtime で必要 dependency が異なる、別 spec)
- non-root user 化 (`USER` directive)
- HEALTHCHECK directive 追加
- image vulnerability scanning (Trivy 等)
- `bundle config set --local frozen true` の re-enable (= google-protobuf gemspec が Ruby 4.0 対応してから、Gemfile の TODO コメント参照)
- multi-arch build (現状 ARM のみ、AMD64 も build するか別判断)
