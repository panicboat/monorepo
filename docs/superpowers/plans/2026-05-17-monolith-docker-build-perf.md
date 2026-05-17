# Monolith Docker Build Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith の `services/monolith/workspace/Dockerfile` を multi-stage + BuildKit cache mounts に書き換えて warm build を 1-3 分に短縮し、`.dockerignore` を新規作成して image / build context を軽量化する。本実装の main マージで Phase 2 plan Task 16 (= 次の release-please cycle での end-to-end 検証) も同時実証する。

**Architecture:** 1 PR で 2 ファイルを変更。Dockerfile は builder (gem install) と runner (runtime) の 2 stage に分割、apt と bundle に `--mount=type=cache` を当てる。`.dockerignore` は新規作成。workflow / Flux / kustomize は無変更で、既存 `cache-to: type=gha,mode=max` が cache mounts を GitHub Actions cache に保存する形で機能する。

**Tech Stack:**
- Dockerfile syntax `docker/dockerfile:1.7`
- BuildKit `--mount=type=cache`
- ruby:4.0.3-slim (base image、`ARG RUBY_VERSION` で集約)
- GitHub Actions: `docker/build-push-action` (既存)、`docker/setup-buildx-action` (既存)
- Conventional Commits: `perf(monolith):` で release-please patch bump を誘発

**Reference:**
- Spec: `docs/superpowers/specs/2026-05-17-monolith-docker-build-perf-design.md`
- Phase 2 plan: `docs/superpowers/plans/2026-05-17-release-driven-flux-deploy.md` (Task 16 の end-to-end フローを参照)

---

## File Structure

| File | Action | Role |
|---|---|---|
| `services/monolith/workspace/.dockerignore` | Create | 不要ファイル (`.git`, `log/`, `tmp/`, `spec/` 等) を除外、build context と image を軽量化 |
| `services/monolith/workspace/Dockerfile` | Modify | single-stage → multi-stage (builder + runner) + `# syntax=` directive + `ARG RUBY_VERSION` + apt/bundle に `--mount=type=cache` |

## Common Conventions

- worktree: `monorepo/.claude/worktrees/perf-monolith-docker-build-cache/` (既存、spec の commit が乗っている)
- ブランチ名: `perf/monolith-docker-build-cache`
- commit メッセージは Conventional Commits + `-s` (sign-off)、`Co-Authored-By` 禁止
- 初回 push は `git push -u origin HEAD`
- PR は `gh pr create --draft`、タイトルは英語

---

## PR: monolith Docker build perf

### Task 1: `.dockerignore` を新規作成

**Files:**
- Create: `services/monolith/workspace/.dockerignore`

- [ ] **Step 1.1: cwd を worktree に移動 + 現状確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/perf-monolith-docker-build-cache
ls services/monolith/workspace/.dockerignore 2>&1
```
Expected: `No such file or directory` (= 新規作成対象)

- [ ] **Step 1.2: `.dockerignore` を新規作成**

File: `services/monolith/workspace/.dockerignore`

Content:
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

- [ ] **Step 1.3: 内容確認**

Run:
```bash
cat services/monolith/workspace/.dockerignore
```
Expected: 上記 13 行が出力される。

### Task 2: Dockerfile を multi-stage + cache mounts に書き換え

**Files:**
- Modify: `services/monolith/workspace/Dockerfile`

- [ ] **Step 2.1: 現状確認**

Run:
```bash
cat services/monolith/workspace/Dockerfile
```
Expected: 単一 stage の 21 行程度 (FROM ruby:4.0.3-slim → apt-get install → bundle install → COPY → CMD)。

- [ ] **Step 2.2: Dockerfile を以下の内容で完全に置き換え**

File: `services/monolith/workspace/Dockerfile`

Content:
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

- [ ] **Step 2.3: 構文の sanity check (任意)**

`hadolint` がインストール済なら:
```bash
hadolint services/monolith/workspace/Dockerfile
```
Expected: warning は出る可能性 (例: DL3008 = apt-get で version pin 推奨)、ただし spec 範囲外。**エラーがなければ pass**。`hadolint` がなければスキップ。

- [ ] **Step 2.4: ローカル build の sanity check (任意)**

Docker / BuildKit がローカルで動くなら:
```bash
cd services/monolith/workspace
DOCKER_BUILDKIT=1 docker build -t monolith-perf-check:local --progress=plain .
```
Expected: builder stage の `apt-get install` と `bundle install` が実行される、runner stage の `apt-get install` (libpq5 + postgresql-client-17) が実行される、`COPY --from=builder /usr/local/bundle /usr/local/bundle` が成功する、最後に成功 message。

ローカル Docker が使えない (Colima 未起動等) ならスキップ。CI で同等の build が走るのでそれを待つ。

### Task 3: commit + push + draft PR

- [ ] **Step 3.1: 変更ファイル確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/perf-monolith-docker-build-cache
git status --short
```
Expected:
```
 M services/monolith/workspace/Dockerfile
?? services/monolith/workspace/.dockerignore
```

- [ ] **Step 3.2: commit**

Run:
```bash
git add services/monolith/workspace/Dockerfile services/monolith/workspace/.dockerignore
git commit -s -m "$(cat <<'EOF'
perf(monolith): multi-stage Dockerfile + BuildKit cache mounts

- Split Dockerfile into builder (gem install) and runner (runtime) stages.
- Mount apt and bundle caches via `--mount=type=cache` so warm builds skip
  the expensive `apt-get install` / `bundle install` work.
- Builder keeps build tools (build-essential, libpq-dev, git, libyaml-dev);
  runner only needs runtime libraries (libpq5, postgresql-client-17),
  shrinking the final image.
- Add `.dockerignore` to keep `.git`, log/, tmp/, spec/, test/, coverage/,
  node_modules/, vendor/bundle/, .bundle/, *.log, .rspec_status, the
  Dockerfile itself, and the .dockerignore out of the build context.

Existing GHA cache configuration (`cache-from: type=gha`,
`cache-to: type=gha,mode=max` in reusable--container-builder.yaml) is left
untouched and will persist the new cache mounts across runs.

Spec: docs/superpowers/specs/2026-05-17-monolith-docker-build-perf-design.md
EOF
)"
```
Expected: 2 files changed (1 modified Dockerfile, 1 created .dockerignore)、commit が作成される。

- [ ] **Step 3.3: push と draft PR 作成**

Run:
```bash
git push -u origin HEAD
gh pr create --draft --title "perf(monolith): multi-stage Dockerfile + BuildKit cache mounts" --body "$(cat <<'EOF'
## Summary

Speed up the monolith Docker build (currently 12-13 min cold) by switching to a multi-stage Dockerfile with BuildKit cache mounts. Also adds a previously-missing \`.dockerignore\`.

- **Dockerfile**: \`single-stage\` → \`builder + runner\`. Builder installs build tools and runs \`bundle install\` with \`--mount=type=cache\` on apt and bundle caches. Runner installs only runtime libraries (\`libpq5\`, \`postgresql-client-17\`) and copies the gems from the builder.
- **.dockerignore (new)**: keep \`.git\`, log/, tmp/, spec/, test/, coverage/, node_modules/, vendor/bundle/, .bundle/, *.log, .rspec_status, Dockerfile, .dockerignore out of the build context.

No changes to \`reusable--container-builder.yaml\`, \`auto-release--trigger.yaml\`, Flux ImagePolicy, kustomize overlays, or workflow-config.

## Expected impact

| Scenario | Before | After |
|---|---|---|
| Cold cache | ~13 min | ~8-10 min |
| Warm cache (Gemfile unchanged) | ~13 min | **~1-3 min** |
| Warm cache (Gemfile changed) | ~13 min | ~5-8 min |

Runner image is also expected to drop from ~1.5-2 GB to ~600-800 MB by dropping build tools.

## Phase 2 Task 16 integration

This PR is the natural trigger for the Phase 2 plan's Task 16 (= end-to-end verification of the release-driven Flux deploy). After merge:

1. release-please opens \`chore(main): release monolith 0.X.Y\` (patch bump from \`perf:\`).
2. Merging that PR creates the \`monolith-vX.Y.Z\` tag + GitHub Release.
3. \`auto-release--trigger.yaml\` fires on release event, builds \`ghcr.io/.../monolith:vX.Y.Z\`.
4. Flux ImagePolicy picks up the semver tag, ImageUpdateAutomation rewrites \`overlays/production/deployment.yaml\`, production rolls out.

The new container-build at step 3 is also the first build that will benefit from the cache mounts in this PR (assuming GHA cache survives between this PR's CI build and the release event run).

## Test plan

- [ ] CI passes (lint-actions / semantic-pull-request / CI Gatekeeper / container build for the PR)
- [ ] After merge, release-please opens a release PR for monolith
- [ ] After merging the release PR, \`auto-release--trigger.yaml\` succeeds and \`ghcr.io/panicboat/monorepo/monolith:vX.Y.Z\` exists
- [ ] Flux \`kubectl get imagepolicy monolith -n flux-system -o jsonpath='{.status.latestImage}'\` returns the new semver
- [ ] \`overlays/production/deployment.yaml\` is rewritten to the new semver by Flux
- [ ] \`kubectl rollout status deployment/monolith\` completes
- [ ] Build duration for the release event run is recorded for before/after comparison

## Spec

\`docs/superpowers/specs/2026-05-17-monolith-docker-build-perf-design.md\`
EOF
)"
```
Expected: PR URL が出力される。

### Task 4: PR CI build の成功確認

- [ ] **Step 4.1: PR の CI run を確認**

Run:
```bash
sleep 30
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh pr checks <PR番号> 2>&1 | head -20
```
Expected: 各 check の `pending` / `success` / `failure` 状況が出力される。container-build job (= main push 由来の build) が `pending` / `success` であること。

- [ ] **Step 4.2: container-build run の詳細確認 (失敗時のみ)**

container-build が `failure` の場合:
```bash
gh run list --workflow=reusable--container-builder.yaml --limit 1 --json databaseId --jq '.[].databaseId' | xargs -I {} gh run view {} --log-failed | tail -50
```
log から原因特定 (例: cache mount 構文エラー、bundler バージョン不一致、apt パッケージ名間違い)。

container-build が `success` なら次の step へ。

### Task 5: PR マージ (ユーザー操作)

- [ ] **Step 5.1: ユーザーが PR をレビュー + Ready & マージ**

完了の判断:
```bash
gh pr view <PR番号> --json state -q .state
```
Expected: `MERGED`

---

## Phase 2 Task 16 統合フェーズ (release-please cycle)

ここから先は **Phase 2 plan の Task 16 (end-to-end 検証)** と一致する。本 PR のマージが release-please cycle を誘発し、その全フローが Phase 2 設計の動作確認になる。

### Task 6: release-please PR の生成確認

- [ ] **Step 6.1: release-please workflow が main push を契機に走ることを待つ**

Run (PR マージから数分後):
```bash
gh run list --workflow=release.yml --limit 1 --json status,conclusion,createdAt --jq '.[]'
```
Expected: `status: completed`, `conclusion: success`

- [ ] **Step 6.2: monolith の release-please PR が open になることを確認**

Run:
```bash
gh pr list --state open --search "in:title chore(main): release monolith" --json number,title,headRefName --jq '.[]'
```
Expected: 1 件 hit (`chore(main): release monolith 0.1.1` または patch bump 後の version)。frontend の release-please PR は出ない (本 PR は monolith のみ変更)。

### Task 7: release-please PR マージ (ユーザー操作)

- [ ] **Step 7.1: ユーザーが release-please PR をレビュー + マージ**

完了の判断: `gh pr view <release PR番号> --json state -q .state` が `MERGED`

### Task 8: `auto-release--trigger.yaml` の release event 起動を確認

- [ ] **Step 8.1: workflow run の event と conclusion を確認**

Run (release-please PR マージから 1-2 分後):
```bash
sleep 60
gh run list --workflow=auto-release--trigger.yaml --limit 1 --json status,conclusion,event,databaseId --jq '.[]'
```
Expected: `event: release`, `status: completed` (まだ in_progress の可能性あり、その場合は数分待って再実行), `conclusion: success`

- [ ] **Step 8.2: container-build job の所要時間を記録 (build 高速化の効果測定)**

Run (run が completed になったら):
```bash
RUN_ID=$(gh run list --workflow=auto-release--trigger.yaml --limit 1 --json databaseId --jq '.[].databaseId')
gh api repos/panicboat/monorepo/actions/runs/${RUN_ID}/jobs \
  --jq '.jobs[] | select(.name | contains("container-build")) | .steps[] | select(.name == "Build and push Docker image") | {started_at, completed_at}'
```
Expected: `started_at` と `completed_at` が JSON で出力される。手元で時刻差を計算し、**改修前 12m53s と比較**。期待: cold cache でも 8-10 分以内、warm cache なら 1-3 分以内。

`gh run view --log` 系のコマンドは git pager 設定 (`-G` エラー) に当たる場合があるので、`gh api` 直接が確実。

### Task 9: ghcr に新 semver image が push されたことを確認

- [ ] **Step 9.1: ghcr API で tags 一覧を取得**

Run:
```bash
gh api /users/panicboat/packages/container/monorepo%2Fmonolith/versions \
  --jq '.[].metadata.container.tags[]' 2>&1 | grep -E '^v0\.[0-9]+\.[0-9]+$' | sort -V | tail -5
```
Expected: 直前の release-please で発行された semver (`v0.X.Y`) が含まれる。

`gh api` が `read:packages` scope 不足で `HTTP 403` を返した場合は、その時点で PR 1 のときと同じ制限。代替として `docker manifest inspect ghcr.io/panicboat/monorepo/monolith:vX.Y.Z` で存在確認 (ghcr public package なら anonymous 可)、もしくは workflow run の `conclusion: success` をもって push 成功と判定して次の step に進む。

### Task 10: Flux pickup + production rollout の確認

これは Flux の reconcile interval (ImageRepository: 5m, ImagePolicy: 10m, ImageUpdateAutomation: 30m) が走り終わるまで最大 ~45m 待つ必要がある。

- [ ] **Step 10.1: Flux ImagePolicy の `status.latestImage` を確認**

Run (release-please PR マージから ~15-30m 後):
```bash
kubectl get imagepolicy -n flux-system monolith -o jsonpath='{.status.latestImage}'
```
Expected: `ghcr.io/panicboat/monorepo/monolith:vX.Y.Z` (今回の新 semver)

`kubectl` 不在ならスキップ (= ユーザー側で確認)。

- [ ] **Step 10.2: `overlays/production/deployment.yaml` が新 semver に rewrite されたことを確認**

Run (Flux ImageUpdateAutomation interval ~30m 後):
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git fetch origin main --quiet
git --no-pager show origin/main:services/monolith/kubernetes/overlays/production/deployment.yaml 2>&1 | grep image:
```
Expected: `image: ghcr.io/panicboat/monorepo/monolith:vX.Y.Z`

`git --no-pager` でも `-G` エラーが出る場合は `git config --local --unset core.pager` などで一時 unset するか、ファイルシステム経由 (`grep image: services/monolith/kubernetes/overlays/production/deployment.yaml` を `git pull` 後のローカル checkout で実行) で代替。

Flux が rewrite していない場合は ImagePolicy が新 image を pickup しているのに ImageUpdateAutomation の commit が来ていない状態。30m 待っても来ないなら `kubectl logs -n flux-system deployment/image-automation-controller` 等で原因確認。

- [ ] **Step 10.3: production rollout の確認**

Run:
```bash
kubectl rollout status deployment/monolith
```
Expected: `deployment "monolith" successfully rolled out`

`ImagePullBackOff` が出たら ghcr の semver image を再確認 (Step 9.1)。

### Task 11: worktree cleanup

- [ ] **Step 11.1: PR 本体の worktree を削除**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git worktree remove .claude/worktrees/perf-monolith-docker-build-cache
git worktree prune
```
Expected: no error。

---

## Notes

- 本 PR が main にマージされた瞬間に「Phase 2 plan の Task 16」が自動的に開始される。Task 16 を独立に追跡する必要はなく、本 plan の Task 6-10 がそのまま Phase 2 Task 16 の検証に対応する。
- build 高速化の効果は Task 8.2 で記録する。改修前のベースライン (workflow_dispatch run 25975947040 = 12m53s) と直接比較できる。
- ローカルで Docker build を試せない環境 (Colima 未起動等) では Step 2.4 をスキップ。CI build (Task 4.1) で sanity を担保する。
- 本 plan 完了で Phase 2 monorepo 編は完全終了。frontend は別 spec、platform は Phase 2 保留中。
