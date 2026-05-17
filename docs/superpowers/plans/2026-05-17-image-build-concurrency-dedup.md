# Image Build Concurrency Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `auto-label--deploy-trigger.yaml` の `deploy-container` job と `auto-release--trigger.yaml` の `container-build` job に同一 `concurrency` group (`image-build-${service}-${sha}`) を設定し、release-please PR マージ時の並列 image build を直列化して GHA cache hit を成立させる。

**Architecture:** 2 workflow file それぞれの image build job に `concurrency` block を追加するだけの最小変更。reusable workflow / Dockerfile / Flux / kustomize は無変更。GitHub Actions の `concurrency` 仕様 (= 同 group の job は 1 つしか走らず、後発は queued になる、`cancel-in-progress: false` で先発を待つ) により、先発の build が GHA cache push を終えてから後発が pull → BuildKit cache mounts (PR #627) が warm hit する。

**Tech Stack:**
- GitHub Actions `concurrency` (job level)
- 既存の `docker/build-push-action` + `cache-to/from: type=gha,mode=max` (変更なし)
- `reusable--container-builder.yaml` (call 側、変更なし)

**Reference:**
- Spec: `docs/superpowers/specs/2026-05-17-image-build-concurrency-dedup-design.md`
- Phase 2 Docker build perf spec / plan: `2026-05-17-monolith-docker-build-perf-*.md` (これが warm cache hit の前提)

---

## File Structure

| File | Action | Role |
|---|---|---|
| `.github/workflows/auto-label--deploy-trigger.yaml` | Modify | `deploy-container` job に `concurrency: image-build-${matrix.target.service}-${sha}` を追加 |
| `.github/workflows/auto-release--trigger.yaml` | Modify | `container-build` job に同一 group key の `concurrency` を追加 |

## Common Conventions

- worktree: `monorepo/.claude/worktrees/perf-image-build-concurrency-dedup/` (既存、spec の commit が乗っている)
- ブランチ名: `perf/image-build-concurrency-dedup`
- commit メッセージは Conventional Commits + `-s` (sign-off)、`Co-Authored-By` 禁止
- 初回 push は `git push -u origin HEAD`
- PR は `gh pr create --draft`、タイトルは英語

---

## PR: concurrency dedup

### Task 1: `auto-label--deploy-trigger.yaml` に concurrency 追加

**Files:**
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml`

- [ ] **Step 1.1: cwd 移動 + 該当 job の現状確認**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/perf-image-build-concurrency-dedup
grep -n "deploy-container:" .github/workflows/auto-label--deploy-trigger.yaml
```
Expected: `deploy-container:` 行の行番号が 1 つ出力される (例: `60:  deploy-container:`)。

- [ ] **Step 1.2: 該当 job の現状を確認 (周辺コンテキスト)**

Run:
```bash
sed -n '60,90p' .github/workflows/auto-label--deploy-trigger.yaml
```
Expected: `deploy-container` job 定義が見える。`strategy.matrix` で `target` を回し、`uses: ./.github/workflows/reusable--container-builder.yaml` を call している構造。

行番号は環境差で前後するので、`deploy-container` 周辺 30 行を見て構造を把握。

- [ ] **Step 1.3: `concurrency` block を追加 (Edit)**

`strategy:` block の直後 (= `uses:` 行の直前) に以下を挿入する。

Before:
```yaml
  deploy-container:
    name: 'Deploy Container (${{ matrix.target.service }})'
    needs: deploy-trigger
    if: |
      needs.deploy-trigger.outputs.has-targets == 'true' &&
      contains(needs.deploy-trigger.outputs.targets, '"stack":"docker"')
    strategy:
      matrix:
        target: ${{ fromJson(needs.deploy-trigger.outputs.targets) }}
    uses: ./.github/workflows/reusable--container-builder.yaml
```

After:
```yaml
  deploy-container:
    name: 'Deploy Container (${{ matrix.target.service }})'
    needs: deploy-trigger
    if: |
      needs.deploy-trigger.outputs.has-targets == 'true' &&
      contains(needs.deploy-trigger.outputs.targets, '"stack":"docker"')
    strategy:
      matrix:
        target: ${{ fromJson(needs.deploy-trigger.outputs.targets) }}
    concurrency:
      group: image-build-${{ matrix.target.service }}-${{ github.sha }}
      cancel-in-progress: false
    uses: ./.github/workflows/reusable--container-builder.yaml
```

- [ ] **Step 1.4: diff 確認**

Run:
```bash
git diff .github/workflows/auto-label--deploy-trigger.yaml
```
Expected: 3 行追加 (concurrency: + group: + cancel-in-progress:)、他に変更なし。

### Task 2: `auto-release--trigger.yaml` に concurrency 追加

**Files:**
- Modify: `.github/workflows/auto-release--trigger.yaml`

- [ ] **Step 2.1: 該当 job の現状確認**

Run:
```bash
cat .github/workflows/auto-release--trigger.yaml
```
Expected: `detect-component` と `container-build` 2 つの job が定義されている。`container-build` は `needs: detect-component` で、`uses: ./.github/workflows/reusable--container-builder.yaml` を call。

- [ ] **Step 2.2: `concurrency` block を追加 (Edit)**

`container-build` job 内の `needs:` 行の直後に追加。

Before:
```yaml
  container-build:
    needs: detect-component
    uses: ./.github/workflows/reusable--container-builder.yaml
    with:
      image-name: ${{ needs.detect-component.outputs.service }}
      ...
```

After:
```yaml
  container-build:
    needs: detect-component
    concurrency:
      group: image-build-${{ needs.detect-component.outputs.service }}-${{ github.sha }}
      cancel-in-progress: false
    uses: ./.github/workflows/reusable--container-builder.yaml
    with:
      image-name: ${{ needs.detect-component.outputs.service }}
      ...
```

- [ ] **Step 2.3: diff 確認**

Run:
```bash
git diff .github/workflows/auto-release--trigger.yaml
```
Expected: 3 行追加 (concurrency: + group: + cancel-in-progress:)、他に変更なし。

### Task 3: 両 workflow を actionlint で静的検証

- [ ] **Step 3.1: actionlint 実行**

Run:
```bash
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest -color \
  .github/workflows/auto-label--deploy-trigger.yaml \
  .github/workflows/auto-release--trigger.yaml
```
Expected: exit 0 / no output。

docker / docker daemon が使えない場合は `actionlint .github/workflows/auto-label--deploy-trigger.yaml .github/workflows/auto-release--trigger.yaml` (homebrew/aqua 経由) で代替。両方利用不可ならスキップして CI で確認。

### Task 4: commit + push + draft PR

- [ ] **Step 4.1: 変更ファイル確認**

Run:
```bash
git status --short
```
Expected:
```
 M .github/workflows/auto-label--deploy-trigger.yaml
 M .github/workflows/auto-release--trigger.yaml
```

- [ ] **Step 4.2: commit (heredoc, `-s`, NO `Co-Authored-By`)**

Run:
```bash
git add .github/workflows/auto-label--deploy-trigger.yaml .github/workflows/auto-release--trigger.yaml
git commit -s -m "$(cat <<'EOF'
perf(ci): serialize duplicate image builds via concurrency group

release-please PR マージ時、auto-label--deploy-trigger.yaml の
Deploy Container job と auto-release--trigger.yaml の container-build
job が同 commit / 同 service の image を並列ビルドし、GHA cache が
race することで PR #627 の BuildKit cache mounts が無効化されていた
(両方 cold cache 相当の 13 分超え)。

両 job に同じ concurrency group (image-build-<service>-<sha>) を設定し、
cancel-in-progress: false で queueing する。先発が GHA cache に push を
終えてから後発が pull する形になり、後発の build で cache mounts が
warm hit する。

別 commit / 別 service の build は別 group なので互いに block しない
(= 並列実行可能)。

Spec: docs/superpowers/specs/2026-05-17-image-build-concurrency-dedup-design.md
EOF
)"
```
Expected: 2 files changed, commit 作成。

- [ ] **Step 4.3: push + draft PR 作成**

Run:
```bash
git push -u origin HEAD
gh pr create --draft --title "perf(ci): serialize duplicate image builds via concurrency group" --body "$(cat <<'EOF'
## Summary

Resolve the parallel image-build duplication observed on release-please PR merges:

- \`auto-label--deploy-trigger.yaml\` Deploy Container job
- \`auto-release--trigger.yaml\` container-build job

Both fire on the same commit when a release-please PR is merged (one via main \`push\`, the other via \`release: published\`), build the identical Dockerfile in parallel, and race against the same GHA cache key. The net result so far has been that both builds run as cold cache (~13 min each, ARM runner time doubled), defeating the BuildKit cache mounts introduced in PR #627.

This PR adds an identical \`concurrency\` group to both jobs:

\`\`\`yaml
concurrency:
  group: image-build-\${{ <service> }}-\${{ github.sha }}
  cancel-in-progress: false
\`\`\`

Service is taken from \`matrix.target.service\` (deploy-trigger side) and \`needs.detect-component.outputs.service\` (release-trigger side). With this:

- Same commit + same service → second build is **queued** until the first completes
- Different services / different commits → still parallel (independent groups)

Expected runtime improvement after this PR (= next release-please merge cycle): first build ~13 min cold, second build **~1-3 min warm cache hit**.

## What does NOT change

- \`reusable--container-builder.yaml\`
- Dockerfile / .dockerignore
- Flux ImagePolicy / ImageUpdateAutomation
- Kustomize overlays
- workflow-config.yaml

## Test plan

- [ ] CI passes (lint-actions / semantic-pull-request / CI Gatekeeper)
- [ ] After merge, the next release-please PR merge shows the second image-build job as \`queued\` (= concurrency group serialization working)
- [ ] After the first build completes, the second build runs and finishes in 1-3 min (= cache mounts now warm hitting)

The verification is **only observable on the next release-please PR merge**, not on this PR itself (this PR is not a release-please PR, so no parallel build is triggered).

## Spec

\`docs/superpowers/specs/2026-05-17-image-build-concurrency-dedup-design.md\`
EOF
)"
```
Expected: PR URL 出力。

### Task 5: PR CI + マージ (ユーザー操作)

- [ ] **Step 5.1: CI 確認**

Run:
```bash
sleep 30
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh pr checks <PR番号> --json name,state,workflow --jq '.[] | "\(.workflow) / \(.name): \(.state)"'
```
Expected: 各 check が `SUCCESS` または `SKIPPED`。container-build は monorepo の他 service のうち PR で変更があったもののみ起動 (本 PR は workflow file のみ変更で services/ 配下に手を入れていないため、container-build job 自体起動しない見込み)。

- [ ] **Step 5.2: ユーザーが PR をマージ**

完了の判断: `gh pr view <PR番号> --json state -q .state` が `MERGED`

### Task 6: worktree cleanup

- [ ] **Step 6.1: worktree 削除**

Run:
```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
git worktree remove .claude/worktrees/perf-image-build-concurrency-dedup
git worktree prune
```
Expected: no error.

---

## Post-Implementation Verification

### Task 7: 次回 release-please PR マージで効果測定

本 PR 単独では effect 検証不可。次回の release-please PR マージ (= 自然な開発フローで `feat:` / `fix:` / `perf:` commit が main に来た後、release-please が PR を出してそれをマージ) で初めて並列 build シナリオが再現する。

- [ ] **Step 7.1: 次回 release-please PR マージを待つ**

通常の開発フローで次の release-please PR (例: `chore(main): release monolith 0.3.0`) がマージされるのを待つ。

- [ ] **Step 7.2: 並列 build run の取得**

release-please PR のマージ commit SHA を控えて:

Run:
```bash
COMMIT=<release-please マージ commit SHA>
cd /Users/takanokenichi/GitHub/panicboat/monorepo
gh api repos/panicboat/monorepo/actions/runs?head_sha=${COMMIT} \
  --jq '.workflow_runs[] | select(.name | test("Auto Label - Deploy Trigger|Auto Release - Trigger")) | {id, name, event, status, conclusion, created_at}'
```
Expected: 2 つの workflow run が出る。1 つは `event: push` (Auto Label - Deploy Trigger)、もう 1 つは `event: release` (Auto Release - Trigger)。

- [ ] **Step 7.3: 各 image-build job の timing 取得**

各 run ID について:

Run:
```bash
RUN_ID=<run_id>
gh api repos/panicboat/monorepo/actions/runs/${RUN_ID}/jobs \
  --jq '.jobs[] | select(.name | contains("container-build") or contains("Deploy Container")) | {name, status, started_at} as $job | .steps[] | select(.name == "Build and push Docker image") | {job_name: $job.name, started_at, completed_at, conclusion}'
```

期待値:
- 先発 build (= 早く started_at): ~13 分 (cold cache)
- 後発 build (= 遅く started_at): **~1-3 分** (warm cache hit)

両方が 13 分前後なら spec の効果が出ていない (= concurrency 設定誤り、または GHA cache の別問題)。

- [ ] **Step 7.4: 第 2 build の "queued" 状態の確認 (任意)**

GitHub Actions UI で release-please PR マージ直後を見ると、第 2 image-build job が `Waiting` (queued) 表示になっているはず。これは concurrency group 機能の動作確認。

CLI からは run 単位の status しか取れないが、`gh api repos/<repo>/actions/runs/<run_id>/jobs` の各 step に `queued` の wait time が含まれる場合あり。

### Task 8: 結果記録 + Phase 2 完全終了の宣言

Step 7.3 の timing 結果を記録。spec で立てた仮説:

| Build | 期待 | 実測 (Step 7.3) |
|---|---|---|
| 先発 | ~13 分 (cold) | 記録する |
| 後発 | **1-3 分 (warm)** | 記録する |

期待通りなら Phase 2 monorepo + Docker build perf + concurrency dedup の一連が完全完了。期待外なら別 spec で追加調査 (例: GHA cache key, BuildKit cache key の詳細確認、registry cache backend への移行など)。

---

## Notes

- 本 PR の効果は「次回の release-please PR マージ」で初めて観測される。本 PR 単独のマージでは並列 build が起きないため、何も変わらない (= 通常の main push の build が 1 つ走るだけ、concurrency group は単独で衝突なし)。
- `concurrency.group` の中で `${{ matrix.target.service }}` を参照しているが、これは reusable workflow の `uses:` を持つ matrix job では valid (GitHub Actions docs で支持されている)。
- `cancel-in-progress: false` を選んだ理由: release event 起動の build が cancel されると semver tag が生成されない (= ghcr に v0.X.Y が push されない、Flux ImagePolicy が pickup できない) ため、必ず queueing する必要がある。
- 本実装は Phase 2 plan の Task 16 (= Phase 2 monorepo の最後の検証) には**直接関係ない**。Phase 2 Task 16 は既に「monolith-v0.2.0 release が出て semver image が build され、Flux ImagePolicy が pickup できる構造になっている」を確認した時点で実質完了。本 spec はその上で「並列 build が cache を無効化していた」副次的問題を解消するもの。
