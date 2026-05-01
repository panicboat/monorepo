# GitHub Actions SHA Pinning Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** panicboat 配下の 4 リポジトリ (`deploy-actions` / `panicboat-actions` / `monorepo` / `platform`) に SHA pinning 強制 + Conventional Commits 強制 + Renovate 自動 SHA pin 維持を導入し、`deploy-actions` には semver タグ運用 (release-please) を追加する。

**Architecture:** 4 リポ共通で `semantic-pull-request.yml` (PR タイトル検証) と `lint-actions.yml` (`zgosalvez/github-actions-ensure-sha-pinned-actions`) を追加し、`renovate.json` に `helpers:pinGitHubActionDigests` を足す。`deploy-actions` のみ `release.yml` + manifest を追加して semver タグを切る。既存 `@v4` 等は `pinact` ローカル実行で SHA pin に一括変換し、以降は Renovate に維持を委任する。

**Tech Stack:** GitHub Actions, Renovate, `zgosalvez/github-actions-ensure-sha-pinned-actions`, `amannn/action-semantic-pull-request`, `googleapis/release-please-action`, `pinact`, `actions/create-github-app-token`

---

## Pre-requisites

- 4 リポ (`deploy-actions`, `panicboat-actions`, `monorepo`, `platform`) のすべてに対する Admin 権限
- 既存 GitHub App (auto-approve / claude-code-action 等で使用中) の管理権限
- ローカル環境で `gh`, `git`, `brew`, `jq` が利用可能
- 各リポの作業開始前に `git status` が clean

## Phase ordering

```
Phase 0: platform — マージ戦略を Squash 強制 (allow_rebase_merge=false)
    │
    ▼
Phase 1: deploy-actions  (semver タグ運用の確立)
    │
    ▼
Phase 2: panicboat-actions  (Phase 1 と独立、いつでも実施可)
    │
    ▼
Phase 3a: monorepo  ┐
                    ├─ Phase 1 完了後、並列実施可
Phase 3b: platform  ┘
    │
    ▼
Phase 4: platform — Required check 追加
```

- **Phase 0** は Phase 1 開始前に完了させる (deploy-actions のマージ戦略が `release-please` の前提)
- **Phase 1** は Phase 3 より前に完了させる (`panicboat/deploy-actions/*@v1` 参照のため `v1.0.0` タグが必要)
- **Phase 2** は Phase 1 と独立、いつでも実施可
- **Phase 4** は Phase 1〜3b 全完了後に実施 (Required 化する check が main で 1 度成功している必要があるため)

---

## Phase 0: platform — マージ戦略を Squash 強制に

### Task P0.1: platform worktree 作成

**Files:**
- Create: `~/GitHub/panicboat/platform/.claude/worktrees/feat-merge-strategy/`

- [ ] **Step 1: 状態確認と worktree 作成**

```bash
cd ~/GitHub/panicboat/platform
git fetch origin
git status
grep -E '^\/?\.claude\/worktrees\/?$' .git/info/exclude || echo "/.claude/worktrees/" >> .git/info/exclude
git worktree add -b feat/squash-merge-only .claude/worktrees/feat-merge-strategy origin/main
cd .claude/worktrees/feat-merge-strategy
```

---

### Task P0.2: マージ戦略を Squash のみに変更

**Files:**
- Modify: `github/repository/modules/main.tf:17`

- [ ] **Step 1: 現状確認**

```bash
grep -n "allow_rebase_merge" github/repository/modules/main.tf
```

期待: `17:  allow_rebase_merge     = true`

- [ ] **Step 2: `true` → `false` に変更**

`github/repository/modules/main.tf` の `allow_rebase_merge` の行を以下に変更:

```diff
   allow_merge_commit     = false
   allow_squash_merge     = true
-  allow_rebase_merge     = true
+  allow_rebase_merge     = false
   allow_update_branch    = true
```

- [ ] **Step 3: 変更確認**

```bash
git diff github/repository/modules/main.tf
```

期待: 1 行の変更のみ (`true` → `false`)

---

### Task P0.3: PR 作成と terragrunt apply

- [ ] **Step 1: コミットと push**

```bash
git add github/repository/modules/main.tf
git commit -s -m "feat(github/repository): disable rebase merge for all panicboat repos"
git push -u origin HEAD
```

- [ ] **Step 2: ドラフト PR 作成**

```bash
gh pr create --draft --title "feat(github/repository): disable rebase merge for all panicboat repos" --body "$(cat <<'EOF'
## Summary
- Disable `allow_rebase_merge` for all repositories managed by `github/repository` module
- Enforces Squash-only merge strategy across all panicboat repos
- Required for upcoming `release-please` rollout in `deploy-actions` (commit history must align 1:1 with PR titles for Conventional Commits parsing)

Part of the SHA pinning rollout. See `monorepo:docs/superpowers/specs/2026-05-01-github-actions-sha-pinning-rollout-design.md`.

## Test plan
- [ ] Terragrunt plan shows `allow_rebase_merge: true → false` for all repos
- [ ] After merge, `gh repo view --json rebaseMergeAllowed` returns `false` for sample repos
EOF
)"
```

- [ ] **Step 3: terragrunt plan の結果を確認 (PR 上の deploy-trigger workflow)**

```bash
gh pr checks --watch
```

期待: terragrunt plan の job が success、plan 出力で `allow_rebase_merge: true → false` (× 6 リポ) が確認できる

- [ ] **Step 4: PR を Ready にしてマージ**

```bash
gh pr ready
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: terragrunt apply の結果を確認 (main の deploy-trigger workflow)**

```bash
gh run list --branch main --workflow=auto-label--deploy-trigger.yaml --limit 3
```

期待: 最新 run が success

- [ ] **Step 6: 実際のリポ設定を確認**

```bash
for repo in deploy-actions panicboat-actions monorepo platform ansible dotfiles; do
  echo -n "$repo: "
  gh repo view panicboat/$repo --json rebaseMergeAllowed --jq '.rebaseMergeAllowed'
done
```

期待: 全リポで `false`

---

### Task P0.4: worktree 削除

- [ ] **Step 1: worktree 削除**

```bash
cd ~/GitHub/panicboat/platform
git worktree remove .claude/worktrees/feat-merge-strategy
git branch -D feat/squash-merge-only 2>/dev/null
git worktree prune
```

---

## Phase 1: deploy-actions

### Task 1: Worktree 作成と App 事前準備の確認

**Files:**
- Create: `~/GitHub/panicboat/deploy-actions/.claude/worktrees/feat-sha-pin/`

- [ ] **Step 1: deploy-actions の状態確認**

```bash
cd ~/GitHub/panicboat/deploy-actions
git fetch origin
git status
git symbolic-ref refs/remotes/origin/HEAD --short  # → origin/main を期待
```

期待: working tree clean、main が default branch

- [ ] **Step 2: `.git/info/exclude` に worktree ディレクトリが入っていることを確認**

```bash
grep -E '^\/?\.claude\/worktrees\/?$' .git/info/exclude || echo "/.claude/worktrees/" >> .git/info/exclude
```

- [ ] **Step 3: worktree 作成**

```bash
git worktree add -b feat/sha-pin .claude/worktrees/feat-sha-pin origin/main
cd .claude/worktrees/feat-sha-pin
```

- [ ] **Step 4: GitHub App 設定状況の確認 (read-only)**

```bash
gh api repos/panicboat/deploy-actions/actions/variables/APP_ID --jq '.value' 2>&1 | head -3
gh secret list -R panicboat/deploy-actions | grep APP_PRIVATE_KEY || echo "missing"
```

- [ ] **Step 5: App 事前準備が未完了の場合は実施 (manual)**

`APP_ID` / `APP_PRIVATE_KEY` のいずれかが未設定なら、以下を手動で実施した上で Step 4 を再実行して両方が設定済みになることを確認する:

1. https://github.com/organizations/panicboat/settings/installations の既存 App を開く
2. "Repository access" に `panicboat/deploy-actions` を追加
3. "Permissions" で `Contents: Read & Write`, `Pull requests: Read & Write` を確認 (不足していれば追加して、利用側 install で permission accept)
4. App private key を再ダウンロード (既に手元にあれば不要)
5. `gh variable set APP_ID -R panicboat/deploy-actions --body "<APP_ID>"`
6. `gh secret set APP_PRIVATE_KEY -R panicboat/deploy-actions < private-key.pem`

---

### Task 2: (削除) — release-please は manifest mode を使わず、`release-type: simple` を with に直接渡す方式に簡略化したため bootstrap ファイル不要

---

### Task 3: semantic-pull-request workflow 追加

**Files:**
- Create: `.github/workflows/semantic-pull-request.yml`

- [ ] **Step 1: ファイル作成**

```yaml
name: Semantic Pull Request

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: amannn/action-semantic-pull-request@v6.1.1
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/semantic-pull-request.yml'))"
```

期待: エラーなし

---

### Task 4: lint-actions workflow 追加

**Files:**
- Create: `.github/workflows/lint-actions.yml`

- [ ] **Step 1: ファイル作成 (deploy-actions は allowlist 空)**

```yaml
name: Lint GitHub Actions

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - '.github/workflows/**'
      - '**/action.yml'
      - '**/action.yaml'

permissions:
  contents: read

jobs:
  ensure-sha-pinned:
    name: Ensure actions are pinned to SHAs
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: zgosalvez/github-actions-ensure-sha-pinned-actions@v5.0.4
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lint-actions.yml'))"
```

期待: エラーなし

---

### Task 5: release-please workflow 追加

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: ファイル作成**

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: googleapis/release-please-action@v4
        id: release
        with:
          token: ${{ steps.app-token.outputs.token }}
          release-type: simple

      - name: Checkout for major tag update
        if: ${{ steps.release.outputs.release_created }}
        uses: actions/checkout@v6.0.2
        with:
          token: ${{ steps.app-token.outputs.token }}
          fetch-depth: 0

      - name: Update major version tag
        if: ${{ steps.release.outputs.release_created }}
        env:
          GH_TOKEN: ${{ steps.app-token.outputs.token }}
        run: |
          git tag -f v${{ steps.release.outputs.major }} ${{ steps.release.outputs.tag_name }}
          git push origin v${{ steps.release.outputs.major }} --force
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```

期待: エラーなし

---

### Task 6: Renovate 設定更新

**Files:**
- Modify: `.github/renovate.json`

- [ ] **Step 1: `extends` に `helpers:pinGitHubActionDigests` を追加**

`jq` でインプレース追記:

```bash
jq '.extends += ["helpers:pinGitHubActionDigests"]' .github/renovate.json > .github/renovate.json.tmp \
  && mv .github/renovate.json.tmp .github/renovate.json
```

- [ ] **Step 2: 結果確認**

```bash
jq '.extends' .github/renovate.json
```

期待: 配列の末尾に `"helpers:pinGitHubActionDigests"` が追加されている

---

### Task 7: pinact で全 workflow を SHA pin 化

**Files:**
- Modify: `.github/workflows/semantic-pull-request.yml`
- Modify: `.github/workflows/lint-actions.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/check.yaml` (既存、変更があれば)

- [ ] **Step 1: pinact をインストール**

```bash
brew install pinact
pinact --version
```

期待: バージョン番号が表示される

- [ ] **Step 2: pinact 実行 (deploy-actions では ignore 設定不要)**

```bash
pinact run
```

期待: `.github/workflows/*` の `@v6.0.2` 等が `@<sha> # v6.0.2` 形式に変換される

- [ ] **Step 3: 変更内容を確認**

```bash
git diff .github/workflows/
```

期待: 新規 3 ファイル (`semantic-pull-request.yml`, `lint-actions.yml`, `release.yml`) の `uses:` がすべて SHA pin されている

- [ ] **Step 4: pinact をアンインストール**

```bash
brew uninstall pinact
```

- [ ] **Step 5: SHA pin の網羅性を確認**

```bash
grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ || echo "all SHA pinned"
```

期待: `all SHA pinned` が出力される (一致なし)。出力があれば pinact が処理しなかった行があるので個別に対応する。

---

### Task 8: コミットして PR 作成

**Files:**
- 全変更をコミット

- [ ] **Step 1: 変更内容を最終確認**

```bash
git status
git diff --stat
```

期待: 4 つの新規ファイル + `.github/renovate.json` の変更

- [ ] **Step 2: ステージングしてコミット**

```bash
git add .github/workflows/semantic-pull-request.yml \
        .github/workflows/lint-actions.yml \
        .github/workflows/release.yml \
        .github/workflows/check.yaml \
        .github/renovate.json
git commit -s -m "ci: add SHA pinning and release-please infrastructure"
```

- [ ] **Step 3: push してドラフト PR 作成**

```bash
git push -u origin HEAD
gh pr create --draft --title "ci: add SHA pinning and release-please infrastructure" --body "$(cat <<'EOF'
## Summary
- Add `semantic-pull-request.yml` to enforce Conventional Commits PR titles
- Add `lint-actions.yml` with `ensure-sha-pinned-actions` CI gate
- Add `release.yml` for semver tag automation
- Update `renovate.json` with `helpers:pinGitHubActionDigests`
- Convert all existing `uses:` to SHA pin via one-shot `pinact run`

Part of the SHA pinning rollout. See `docs/superpowers/specs/2026-05-01-github-actions-sha-pinning-rollout-design.md` (in `monorepo` repo).

## Test plan
- [ ] `Validate PR title` check passes on this PR
- [ ] `Ensure actions are pinned to SHAs` check passes
- [ ] After merge, `Release` workflow runs and opens an Initial Release PR
EOF
)"
```

- [ ] **Step 4: PR の CI 結果を確認**

```bash
gh pr checks --watch
```

期待: すべての check が success

- [ ] **Step 5: PR を Ready for review に変更**

```bash
gh pr ready
```

---

### Task 9: (削除) — マージ戦略は Phase 0、Required check は Phase 4 で Terragrunt 経由

---

### Task 10: PR をマージして release-please の Initial Release PR を待つ

- [ ] **Step 1: Task 8 の PR をマージ (Squash)**

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 2: main でのワークフロー実行を確認**

```bash
gh run list --branch main --limit 5
```

期待: `Lint GitHub Actions` と `Release` が main で実行される

- [ ] **Step 3: release-please が出した PR を確認**

```bash
gh pr list --search "release-please" --state open
```

期待: タイトルに `chore(main): release` を含む PR が 1 件存在

---

### Task 11: 初回リリースを v1.0.0 に指定してマージ

`release-please` は manifest の version (`0.0.0`) と Conventional Commit type から次のバージョンを計算する。`0.0.0` 起点で `feat:` が 1 つあれば次は `0.1.0` になるため、`1.0.0` で初回リリースしたい場合は `Release-As: 1.0.0` を commit message footer に含める必要がある。

**Files:**
- (main ブランチに空コミット 1 つを追加)

- [ ] **Step 1: 既存の release-please PR を確認 (まだマージしない)**

```bash
gh pr list --search "release-please" --state open
```

期待: タイトルに `chore(main): release` を含む PR が 1 件 (バージョンは `0.1.0` などになっているはず)

- [ ] **Step 2: main に空コミット (Release-As footer 付き) を push**

```bash
git checkout main && git pull
git commit --allow-empty -m "chore: trigger v1.0.0 release" -m "Release-As: 1.0.0"
git push origin main
```

- [ ] **Step 3: release-please workflow が新しい commit で再実行されることを確認**

```bash
gh run list --workflow=release.yml --limit 3
```

期待: 新しい run が in_progress または completed

- [ ] **Step 4: release-please PR が v1.0.0 に更新されたことを確認**

```bash
RP_PR=$(gh pr list --search "release-please" --state open --json number --jq '.[0].number')
gh pr view $RP_PR --json title,body --jq '{title, version_in_body: (.body | tostring | scan("Release notes for [0-9.]+"))}'
```

期待: title に `1.0.0` を含む

- [ ] **Step 5: PR の checks を確認**

```bash
gh pr checks $RP_PR --watch
```

期待: すべて success

- [ ] **Step 6: PR をマージ**

```bash
gh pr merge $RP_PR --squash
```

- [ ] **Step 7: タグが作成されたことを確認**

```bash
git fetch --tags
git tag -l "v1*" | sort -V
```

期待:
```
v1
v1.0.0
```

- [ ] **Step 8: GitHub Release を確認**

```bash
gh release list --limit 3
```

期待: `v1.0.0` の Release が `Latest` として作成されている

---

### Task 12: README の利用例を `@v1` に更新

**Files:**
- Modify: `README.md`
- Modify: `README-ja.md`
- Modify: `action-scripts/label-dispatcher/README.md`
- Modify: `action-scripts/label-dispatcher/README-ja.md`
- Modify: `action-scripts/label-resolver/README.md`
- Modify: `action-scripts/label-resolver/README-ja.md`

- [ ] **Step 1: `panicboat/monorepo` Bilingual README ルールに従い、両言語版を同時更新する点を意識する**

参照: `~/.claude/projects/-Users-takanokenichi-GitHub-panicboat/memory/MEMORY.md` の "Bilingual README pairs" メモ。`monorepo` 由来のルールだが、`deploy-actions` 配下の README も pair で存在するため同様に揃える。

- [ ] **Step 2: 全 README で `panicboat/deploy-actions/<sub>@main` を `@v1` に置換**

```bash
cd ~/GitHub/panicboat/deploy-actions/.claude/worktrees/feat-sha-pin
git checkout main
git pull
git checkout -b docs/readme-v1-references

# 対象ファイルでパターン検索
grep -rln 'panicboat/deploy-actions/[a-z-]*@main' README.md README-ja.md action-scripts/

# 一括置換 (BSD sed 用 -i ''、GNU sed 用は -i)
find README.md README-ja.md action-scripts/ -name '*.md' -type f -exec \
  sed -i '' -E 's|(panicboat/deploy-actions/[a-z-]+)@main|\1@v1|g' {} \;
```

- [ ] **Step 3: 変更内容を確認**

```bash
git diff README.md README-ja.md action-scripts/
grep -rn 'panicboat/deploy-actions/[a-z-]*@main' README.md README-ja.md action-scripts/ || echo "no @main references remain"
```

期待: `no @main references remain` が出力される

- [ ] **Step 4: コミットして PR 作成**

```bash
git add -u
git commit -s -m "docs: update README usage examples to use @v1"
git push -u origin HEAD
gh pr create --draft --title "docs: update README usage examples to use @v1" --body "Now that v1.0.0 is released, switch usage examples from @main to @v1."
gh pr ready
gh pr checks --watch
```

- [ ] **Step 5: マージ**

```bash
gh pr merge --squash --delete-branch
```

---

### Task 13: Phase 1 完了確認

- [ ] **Step 1: 全 Definition of Done 項目を確認**

```bash
cd ~/GitHub/panicboat/deploy-actions
git checkout main
git pull

# DoD 1: semantic-pull-request.yml が存在
test -f .github/workflows/semantic-pull-request.yml && echo "OK 1"

# DoD 2: lint-actions.yml が存在
test -f .github/workflows/lint-actions.yml && echo "OK 2"

# DoD 3: release.yml が存在
test -f .github/workflows/release.yml && echo "OK 3"

# DoD 4: renovate.json に helpers:pinGitHubActionDigests
jq -e '.extends | index("helpers:pinGitHubActionDigests")' .github/renovate.json && echo "OK 4"

# DoD 5: v1.0.0 と v1 タグ
git tag -l v1.0.0 v1 | wc -l | grep -q 2 && echo "OK 5"

# DoD 6: APP_ID/APP_PRIVATE_KEY 設定
gh variable list | grep -q APP_ID && echo "OK 6a"
gh secret list | grep -q APP_PRIVATE_KEY && echo "OK 6b"

# DoD 7: README が @v1 形式
! grep -rE 'panicboat/deploy-actions/[a-z-]+@main' README.md README-ja.md action-scripts/ && echo "OK 7"

# DoD 8: SHA 未 pin の uses: が存在しない
! grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ && echo "OK 8"
```

期待: `OK 1` から `OK 8` までがすべて出力される (allowlist 対象がないので例外なし)。Squash merge / Required check は Phase 0 / Phase 4 の DoD で別途確認。

- [ ] **Step 2: worktree を削除**

```bash
cd ~/GitHub/panicboat/deploy-actions
git worktree remove .claude/worktrees/feat-sha-pin
git branch -D feat/sha-pin docs/readme-v1-references 2>/dev/null
git worktree prune
```

---

## Phase 2: panicboat-actions

### Task 14: Worktree 作成

- [ ] **Step 1: 状態確認と worktree 作成**

```bash
cd ~/GitHub/panicboat/panicboat-actions
git fetch origin
git status
grep -E '^\/?\.claude\/worktrees\/?$' .git/info/exclude || echo "/.claude/worktrees/" >> .git/info/exclude
git worktree add -b feat/sha-pin .claude/worktrees/feat-sha-pin origin/main
cd .claude/worktrees/feat-sha-pin
```

- [ ] **Step 2: APP_ID / APP_PRIVATE_KEY が設定済みか確認**

```bash
gh variable list -R panicboat/panicboat-actions | grep APP_ID && echo "OK"
gh secret list -R panicboat/panicboat-actions | grep APP_PRIVATE_KEY && echo "OK"
```

期待: 両方 `OK` (既存 workflow で利用中のため設定済みのはず)

---

### Task 15: semantic-pull-request workflow 追加

**Files:**
- Create: `.github/workflows/semantic-pull-request.yml`

- [ ] **Step 1: ファイル作成 (deploy-actions と同内容)**

```yaml
name: Semantic Pull Request

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: amannn/action-semantic-pull-request@v6.1.1
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/semantic-pull-request.yml'))"
```

---

### Task 16: lint-actions workflow 追加 (allowlist あり)

**Files:**
- Create: `.github/workflows/lint-actions.yml`

- [ ] **Step 1: ファイル作成 (allowlist に `panicboat/panicboat-actions/`)**

```yaml
name: Lint GitHub Actions

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - '.github/workflows/**'
      - '**/action.yml'
      - '**/action.yaml'

permissions:
  contents: read

jobs:
  ensure-sha-pinned:
    name: Ensure actions are pinned to SHAs
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: zgosalvez/github-actions-ensure-sha-pinned-actions@v5.0.4
        with:
          allowlist: |
            panicboat/panicboat-actions/
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lint-actions.yml'))"
```

---

### Task 17: Renovate 設定更新

**Files:**
- Modify: `.github/renovate.json`

- [ ] **Step 1: `extends` に追加**

```bash
jq '.extends += ["helpers:pinGitHubActionDigests"]' .github/renovate.json > .github/renovate.json.tmp \
  && mv .github/renovate.json.tmp .github/renovate.json
```

- [ ] **Step 2: 結果確認**

```bash
jq '.extends' .github/renovate.json
```

期待: 末尾に `"helpers:pinGitHubActionDigests"` が追加

---

### Task 18: pinact で全 workflow を SHA pin 化 (panicboat-actions ignore)

**Files:**
- Modify: `.github/workflows/semantic-pull-request.yml`
- Modify: `.github/workflows/lint-actions.yml`
- Modify: `.github/workflows/auto-approve.yaml` (pinact の影響あれば)
- Modify: `.github/workflows/claude-code-action.yaml` (`panicboat/panicboat-actions/claude-run@main` は ignore)

- [ ] **Step 1: pinact をインストール**

```bash
brew install pinact
```

- [ ] **Step 2: 一時 ignore 設定を作成**

```bash
cat > /tmp/pinact.yaml <<'EOF'
ignore_actions:
  - name: panicboat/panicboat-actions/*
EOF
```

- [ ] **Step 3: pinact 実行**

```bash
pinact run --config /tmp/pinact.yaml
```

期待: `.github/workflows/*` の `@v6.0.2` 等が SHA pin に変換される。`panicboat/panicboat-actions/*@main` は変更されない

- [ ] **Step 4: 変更内容と allowlist 対象の温存を確認**

```bash
git diff .github/workflows/
grep -rn "panicboat/panicboat-actions/" .github/workflows/
```

期待: `claude-code-action.yaml` の `panicboat/panicboat-actions/claude-run@main` が `@main` のまま残っている

- [ ] **Step 5: pinact をアンインストール**

```bash
brew uninstall pinact
rm /tmp/pinact.yaml
```

- [ ] **Step 6: SHA pin の網羅性を確認 (allowlist 除外)**

```bash
grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ \
  | grep -v "panicboat/panicboat-actions/" \
  || echo "all SHA pinned (excluding allowlist)"
```

期待: `all SHA pinned (excluding allowlist)` が出力される

---

### Task 19: コミットして PR 作成

- [ ] **Step 1: ステージング・コミット・push**

```bash
git status
git add .github/workflows/ .github/renovate.json
git commit -s -m "ci: add SHA pinning enforcement and Conventional Commits validation"
git push -u origin HEAD
```

- [ ] **Step 2: PR 作成**

```bash
gh pr create --draft --title "ci: add SHA pinning enforcement and Conventional Commits validation" --body "$(cat <<'EOF'
## Summary
- Add `semantic-pull-request.yml` to enforce Conventional Commits PR titles
- Add `lint-actions.yml` with `ensure-sha-pinned-actions` CI gate (allowlist: `panicboat/panicboat-actions/`)
- Update `renovate.json` with `helpers:pinGitHubActionDigests`
- Convert all existing `uses:` (except self-references) to SHA pin via one-shot `pinact run`

Part of the SHA pinning rollout. See `panicboat/monorepo:docs/superpowers/specs/2026-05-01-github-actions-sha-pinning-rollout-design.md`.

## Test plan
- [ ] `Validate PR title` check passes
- [ ] `Ensure actions are pinned to SHAs` check passes (allowlist permits `panicboat/panicboat-actions/`)
EOF
)"
gh pr ready
gh pr checks --watch
```

- [ ] **Step 3: マージ**

```bash
gh pr merge --squash --delete-branch
```

---

### Task 20: (削除) — マージ戦略は Phase 0、Required check は Phase 4 で Terragrunt 経由

---

### Task 21: Phase 2 完了確認

- [ ] **Step 1: DoD 確認**

```bash
cd ~/GitHub/panicboat/panicboat-actions
git checkout main && git pull

test -f .github/workflows/semantic-pull-request.yml && echo "OK 1"
test -f .github/workflows/lint-actions.yml && echo "OK 2"
jq -e '.extends | index("helpers:pinGitHubActionDigests")' .github/renovate.json && echo "OK 3"

# 非 allowlist 対象がすべて SHA pin されている
RESULT=$(grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ | grep -v "panicboat/panicboat-actions/" || echo "")
test -z "$RESULT" && echo "OK 4"
```

期待: `OK 1` から `OK 4` までがすべて出力される。Squash merge / Required check は Phase 0 / Phase 4 の DoD で別途確認。

- [ ] **Step 2: worktree 削除**

```bash
cd ~/GitHub/panicboat/panicboat-actions
git worktree remove .claude/worktrees/feat-sha-pin
git branch -D feat/sha-pin 2>/dev/null
git worktree prune
```

---

## Phase 3a: monorepo

### Task 22: Worktree 作成 (既存の docs/sha-pin-rollout worktree とは別)

- [ ] **Step 1: 状態確認と worktree 作成**

```bash
cd ~/GitHub/panicboat/monorepo
git fetch origin
git status
grep -E '^\/?\.claude\/worktrees\/?$' .git/info/exclude || echo "/.claude/worktrees/" >> .git/info/exclude
git worktree add -b feat/sha-pin .claude/worktrees/feat-sha-pin origin/main
cd .claude/worktrees/feat-sha-pin
```

- [ ] **Step 2: APP_ID / APP_PRIVATE_KEY 確認**

```bash
gh variable list -R panicboat/monorepo | grep APP_ID && echo "OK"
gh secret list -R panicboat/monorepo | grep APP_PRIVATE_KEY && echo "OK"
```

---

### Task 23: semantic-pull-request workflow 追加

**Files:**
- Create: `.github/workflows/semantic-pull-request.yml`

- [ ] **Step 1: ファイル作成 (Phase 1 / 2 と同内容)**

```yaml
name: Semantic Pull Request

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: amannn/action-semantic-pull-request@v6.1.1
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/semantic-pull-request.yml'))"
```

---

### Task 24: lint-actions workflow 追加

**Files:**
- Create: `.github/workflows/lint-actions.yml`

- [ ] **Step 1: ファイル作成 (Phase 2 と同じ allowlist)**

```yaml
name: Lint GitHub Actions

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - '.github/workflows/**'
      - '**/action.yml'
      - '**/action.yaml'

permissions:
  contents: read

jobs:
  ensure-sha-pinned:
    name: Ensure actions are pinned to SHAs
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: zgosalvez/github-actions-ensure-sha-pinned-actions@v5.0.4
        with:
          allowlist: |
            panicboat/panicboat-actions/
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lint-actions.yml'))"
```

---

### Task 25: Renovate 設定更新

**Files:**
- Modify: `.github/renovate.json`

- [ ] **Step 1: `extends` に追加**

```bash
jq '.extends += ["helpers:pinGitHubActionDigests"]' .github/renovate.json > .github/renovate.json.tmp \
  && mv .github/renovate.json.tmp .github/renovate.json
jq '.extends' .github/renovate.json
```

期待: 末尾に `"helpers:pinGitHubActionDigests"` が追加

---

### Task 26: `panicboat/deploy-actions/*@main` を `@v1` に手動置換

**Files:**
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml` (など、参照箇所)
- Modify: `.github/workflows/auto-label--label-dispatcher.yaml`
- (`grep` で見つかった全ファイル)

- [ ] **Step 1: 対象ファイルの抽出**

```bash
grep -rln "panicboat/deploy-actions/[a-z-]*@main" .github/workflows/
```

- [ ] **Step 2: 一括置換**

```bash
find .github/workflows/ -name '*.yaml' -o -name '*.yml' | xargs \
  sed -i '' -E 's|(panicboat/deploy-actions/[a-z-]+)@main|\1@v1|g'
```

- [ ] **Step 3: 結果確認**

```bash
grep -rn "panicboat/deploy-actions/[a-z-]*@main" .github/workflows/ || echo "no @main references remain"
git diff .github/workflows/ | head -30
```

期待: `no @main references remain` が出力される

---

### Task 27: pinact で全 workflow を SHA pin 化

**Files:**
- Modify: 上記 + `.github/workflows/*.yaml` 全般 (pinact が SHA を解決)

- [ ] **Step 1: pinact をインストール**

```bash
brew install pinact
```

- [ ] **Step 2: 一時 ignore 設定**

```bash
cat > /tmp/pinact.yaml <<'EOF'
ignore_actions:
  - name: panicboat/panicboat-actions/*
EOF
```

- [ ] **Step 3: pinact 実行**

```bash
pinact run --config /tmp/pinact.yaml
```

期待: `panicboat/deploy-actions/<sub>@v1` が `@<sha> # v1.0.0` に変換され、外部 action もすべて SHA pin される

- [ ] **Step 4: 変更確認**

```bash
git diff --stat .github/workflows/
grep -rn "panicboat/" .github/workflows/ | head -20
```

期待:
- `panicboat/deploy-actions/<sub>@<sha> # v1.0.0` 形式に変換されている
- `panicboat/panicboat-actions/<sub>@main` は `@main` のまま

- [ ] **Step 5: pinact をアンインストール**

```bash
brew uninstall pinact
rm /tmp/pinact.yaml
```

- [ ] **Step 6: SHA pin の網羅性を確認**

```bash
RESULT=$(grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ | grep -v "panicboat/panicboat-actions/" || echo "")
test -z "$RESULT" && echo "all SHA pinned (excluding allowlist)" || echo "$RESULT"
```

期待: `all SHA pinned (excluding allowlist)` が出力される

---

### Task 28: コミットして PR 作成

- [ ] **Step 1: ステージング・コミット・push**

```bash
git status
git add .github/workflows/ .github/renovate.json
git commit -s -m "ci: pin GitHub Actions to SHAs and switch deploy-actions to @v1"
git push -u origin HEAD
```

- [ ] **Step 2: PR 作成**

```bash
gh pr create --draft --title "ci: pin GitHub Actions to SHAs and switch deploy-actions to @v1" --body "$(cat <<'EOF'
## Summary
- Add `semantic-pull-request.yml` to enforce Conventional Commits PR titles
- Add `lint-actions.yml` with `ensure-sha-pinned-actions` CI gate (allowlist: `panicboat/panicboat-actions/`)
- Update `renovate.json` with `helpers:pinGitHubActionDigests`
- Switch `panicboat/deploy-actions/*` references from `@main` to `@v1` (now that v1.0.0 is released)
- Convert all `uses:` (except `panicboat/panicboat-actions/*`) to SHA pin via one-shot `pinact run`

Part of the SHA pinning rollout. See `docs/superpowers/specs/2026-05-01-github-actions-sha-pinning-rollout-design.md`.

## Test plan
- [ ] `Validate PR title` check passes
- [ ] `Ensure actions are pinned to SHAs` check passes
- [ ] All existing CI checks pass (no regression in deploy / label workflows)
EOF
)"
gh pr ready
gh pr checks --watch
```

- [ ] **Step 3: マージ**

```bash
gh pr merge --squash --delete-branch
```

---

### Task 29: (削除) — マージ戦略は Phase 0、Required check は Phase 4 で Terragrunt 経由

---

### Task 30: Phase 3a 完了確認

- [ ] **Step 1: DoD 確認**

```bash
cd ~/GitHub/panicboat/monorepo
git checkout main && git pull

test -f .github/workflows/semantic-pull-request.yml && echo "OK 1"
test -f .github/workflows/lint-actions.yml && echo "OK 2"
jq -e '.extends | index("helpers:pinGitHubActionDigests")' .github/renovate.json && echo "OK 3"

# 非 allowlist 対象がすべて SHA pin
RESULT=$(grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ | grep -v "panicboat/panicboat-actions/" || echo "")
test -z "$RESULT" && echo "OK 4"

# panicboat/deploy-actions/*@main 参照ゼロ
! grep -rn "panicboat/deploy-actions/[a-z-]*@main" .github/workflows/ && echo "OK 5"

# panicboat/deploy-actions/* がすべて SHA + v1.x コメント形式
grep -rn "panicboat/deploy-actions/" .github/workflows/ | grep -v "@[0-9a-f]\{40\} # v1" && echo "FAIL 6" || echo "OK 6"
```

期待: `OK 1` から `OK 6` までがすべて出力される。Squash merge / Required check は Phase 0 / Phase 4 の DoD で別途確認。

- [ ] **Step 2: worktree 削除**

```bash
cd ~/GitHub/panicboat/monorepo
git worktree remove .claude/worktrees/feat-sha-pin
git branch -D feat/sha-pin 2>/dev/null
git worktree prune
```

---

## Phase 3b: platform

### Task 31: Worktree 作成

- [ ] **Step 1: 状態確認と worktree 作成**

```bash
cd ~/GitHub/panicboat/platform
git fetch origin
git status
grep -E '^\/?\.claude\/worktrees\/?$' .git/info/exclude || echo "/.claude/worktrees/" >> .git/info/exclude
git worktree add -b feat/sha-pin .claude/worktrees/feat-sha-pin origin/main
cd .claude/worktrees/feat-sha-pin
```

- [ ] **Step 2: APP_ID / APP_PRIVATE_KEY 確認**

```bash
gh variable list -R panicboat/platform | grep APP_ID && echo "OK"
gh secret list -R panicboat/platform | grep APP_PRIVATE_KEY && echo "OK"
```

---

### Task 32: semantic-pull-request workflow 追加

**Files:**
- Create: `.github/workflows/semantic-pull-request.yml`

- [ ] **Step 1: ファイル作成 (Phase 3a と同内容)**

```yaml
name: Semantic Pull Request

on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened]

permissions:
  contents: read

jobs:
  validate:
    name: Validate PR title
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: amannn/action-semantic-pull-request@v6.1.1
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/semantic-pull-request.yml'))"
```

---

### Task 33: lint-actions workflow 追加

**Files:**
- Create: `.github/workflows/lint-actions.yml`

- [ ] **Step 1: ファイル作成 (Phase 3a と同じ allowlist)**

```yaml
name: Lint GitHub Actions

on:
  push:
    branches: [main]
  pull_request:
    paths:
      - '.github/workflows/**'
      - '**/action.yml'
      - '**/action.yaml'

permissions:
  contents: read

jobs:
  ensure-sha-pinned:
    name: Ensure actions are pinned to SHAs
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: zgosalvez/github-actions-ensure-sha-pinned-actions@v5.0.4
        with:
          allowlist: |
            panicboat/panicboat-actions/
```

- [ ] **Step 2: YAML 妥当性確認**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lint-actions.yml'))"
```

---

### Task 34: Renovate 設定更新

**Files:**
- Modify: `.github/renovate.json`

- [ ] **Step 1: `extends` に追加**

```bash
jq '.extends += ["helpers:pinGitHubActionDigests"]' .github/renovate.json > .github/renovate.json.tmp \
  && mv .github/renovate.json.tmp .github/renovate.json
jq '.extends' .github/renovate.json
```

---

### Task 35: `panicboat/deploy-actions/*@main` を `@v1` に手動置換

**Files:**
- Modify: `.github/workflows/auto-label--label-dispatcher.yaml`
- Modify: その他、`grep` で見つかった全ファイル

- [ ] **Step 1: 対象ファイルの抽出**

```bash
grep -rln "panicboat/deploy-actions/[a-z-]*@main" .github/workflows/
```

- [ ] **Step 2: 一括置換**

```bash
find .github/workflows/ -name '*.yaml' -o -name '*.yml' | xargs \
  sed -i '' -E 's|(panicboat/deploy-actions/[a-z-]+)@main|\1@v1|g'
```

- [ ] **Step 3: 結果確認**

```bash
grep -rn "panicboat/deploy-actions/[a-z-]*@main" .github/workflows/ || echo "no @main references remain"
```

期待: `no @main references remain` が出力される

---

### Task 36: pinact で全 workflow を SHA pin 化

- [ ] **Step 1: pinact をインストール**

```bash
brew install pinact
```

- [ ] **Step 2: 一時 ignore 設定**

```bash
cat > /tmp/pinact.yaml <<'EOF'
ignore_actions:
  - name: panicboat/panicboat-actions/*
EOF
```

- [ ] **Step 3: pinact 実行**

```bash
pinact run --config /tmp/pinact.yaml
```

- [ ] **Step 4: 変更確認**

```bash
git diff --stat .github/workflows/
grep -rn "panicboat/" .github/workflows/ | head -20
```

期待:
- `panicboat/deploy-actions/<sub>@<sha> # v1.0.0` 形式
- `panicboat/panicboat-actions/<sub>@main` は `@main` のまま

- [ ] **Step 5: pinact をアンインストール**

```bash
brew uninstall pinact
rm /tmp/pinact.yaml
```

- [ ] **Step 6: SHA pin の網羅性を確認**

```bash
RESULT=$(grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ | grep -v "panicboat/panicboat-actions/" || echo "")
test -z "$RESULT" && echo "all SHA pinned (excluding allowlist)" || echo "$RESULT"
```

---

### Task 37: コミットして PR 作成

- [ ] **Step 1: ステージング・コミット・push**

```bash
git status
git add .github/workflows/ .github/renovate.json
git commit -s -m "ci: pin GitHub Actions to SHAs and switch deploy-actions to @v1"
git push -u origin HEAD
```

- [ ] **Step 2: PR 作成**

```bash
gh pr create --draft --title "ci: pin GitHub Actions to SHAs and switch deploy-actions to @v1" --body "$(cat <<'EOF'
## Summary
- Add `semantic-pull-request.yml` to enforce Conventional Commits PR titles
- Add `lint-actions.yml` with `ensure-sha-pinned-actions` CI gate (allowlist: `panicboat/panicboat-actions/`)
- Update `renovate.json` with `helpers:pinGitHubActionDigests`
- Switch `panicboat/deploy-actions/*` references from `@main` to `@v1`
- Convert all `uses:` (except `panicboat/panicboat-actions/*`) to SHA pin via one-shot `pinact run`

Part of the SHA pinning rollout. See `panicboat/monorepo:docs/superpowers/specs/2026-05-01-github-actions-sha-pinning-rollout-design.md`.

## Test plan
- [ ] `Validate PR title` check passes
- [ ] `Ensure actions are pinned to SHAs` check passes
- [ ] All existing CI checks pass (no regression)
EOF
)"
gh pr ready
gh pr checks --watch
```

- [ ] **Step 3: マージ**

```bash
gh pr merge --squash --delete-branch
```

---

### Task 38: (削除) — マージ戦略は Phase 0、Required check は Phase 4 で Terragrunt 経由

---

### Task 39: Phase 3b 完了確認

- [ ] **Step 1: DoD 確認**

```bash
cd ~/GitHub/panicboat/platform
git checkout main && git pull

test -f .github/workflows/semantic-pull-request.yml && echo "OK 1"
test -f .github/workflows/lint-actions.yml && echo "OK 2"
jq -e '.extends | index("helpers:pinGitHubActionDigests")' .github/renovate.json && echo "OK 3"

RESULT=$(grep -rE "uses:\s+\w+/\w+(/\w+)*@(v[0-9]|main)" .github/workflows/ | grep -v "panicboat/panicboat-actions/" || echo "")
test -z "$RESULT" && echo "OK 4"

! grep -rn "panicboat/deploy-actions/[a-z-]*@main" .github/workflows/ && echo "OK 5"
grep -rn "panicboat/deploy-actions/" .github/workflows/ | grep -v "@[0-9a-f]\{40\} # v1" && echo "FAIL 6" || echo "OK 6"
```

期待: `OK 1` から `OK 6` までがすべて出力される。Squash merge / Required check は Phase 0 / Phase 4 の DoD で別途確認。

- [ ] **Step 2: worktree 削除**

```bash
cd ~/GitHub/panicboat/platform
git worktree remove .claude/worktrees/feat-sha-pin
git branch -D feat/sha-pin 2>/dev/null
git worktree prune
```

---

## Phase 4: platform — Required check 追加

Phase 1〜3b 完了後に実施。Required に指定する check 名 (`Validate PR title`, `Ensure actions are pinned to SHAs`) は、各リポの main で 1 度でも success していないと branch protection 側で「unknown check」状態になるため、Phase 1〜3b の workflow PR がマージされていることが前提。

### Task P4.1: platform worktree 作成

- [ ] **Step 1: 状態確認と worktree 作成**

```bash
cd ~/GitHub/panicboat/platform
git fetch origin
git status
git worktree add -b feat/required-status-checks .claude/worktrees/feat-required-checks origin/main
cd .claude/worktrees/feat-required-checks
```

---

### Task P4.2: 4 リポの hcl に required_status_checks を追加

**Files:**
- Modify: `github/branch/envs/develop/deploy-actions.hcl`
- Modify: `github/branch/envs/develop/panicboat-actions.hcl`
- Modify: `github/branch/envs/develop/monorepo.hcl`
- Modify: `github/branch/envs/develop/platform.hcl`

- [ ] **Step 1: 既存 hcl の構造を確認**

```bash
cat github/branch/envs/develop/deploy-actions.hcl
```

期待: `branch_protection.main` が `merge(local.defaults.locals.branch_protection.main, {})` のような構造

- [ ] **Step 2: 4 ファイルを更新**

各ファイルの `merge(...)` の第 2 引数の `{}` を以下に置き換え:

```hcl
{
  required_status_checks = [
    "Validate PR title",
    "Ensure actions are pinned to SHAs",
  ]
}
```

例 (`deploy-actions.hcl`):

```hcl
locals {
  defaults = read_terragrunt_config("defaults.hcl")

  repository = {
    name              = "deploy-actions"
    branch_protection = {
      main = merge(
        local.defaults.locals.branch_protection.main,
        {
          required_status_checks = [
            "Validate PR title",
            "Ensure actions are pinned to SHAs",
          ]
        }
      )
    }
  }
}
```

panicboat-actions / monorepo / platform も同様に更新 (`name` のみ各リポ名に応じて変える)。

- [ ] **Step 3: 変更内容を確認**

```bash
git diff github/branch/envs/develop/
```

期待: 4 ファイルで `{}` が `required_status_checks` ブロックに置き換わっている

---

### Task P4.3: PR 作成と terragrunt apply

- [ ] **Step 1: コミットと push**

```bash
git add github/branch/envs/develop/
git commit -s -m "feat(github/branch): require Validate PR title and SHA pin checks on main"
git push -u origin HEAD
```

- [ ] **Step 2: ドラフト PR 作成**

```bash
gh pr create --draft --title "feat(github/branch): require Validate PR title and SHA pin checks on main" --body "$(cat <<'EOF'
## Summary
- Add `required_status_checks` to branch protection ruleset for `deploy-actions`, `panicboat-actions`, `monorepo`, `platform`
- Required checks: `Validate PR title`, `Ensure actions are pinned to SHAs`
- Both checks have run successfully on each repo's main following Phase 1〜3b completion

Part of the SHA pinning rollout. See `monorepo:docs/superpowers/specs/2026-05-01-github-actions-sha-pinning-rollout-design.md`.

## Test plan
- [ ] Terragrunt plan shows ruleset updates with new `required_check` entries for the 4 repos
- [ ] After apply, `gh api repos/<owner>/<repo>/branches/main/protection/required_status_checks` returns the 2 contexts for each repo
EOF
)"
```

- [ ] **Step 3: terragrunt plan の結果を確認**

```bash
gh pr checks --watch
```

期待: terragrunt plan の job が success、plan 出力で 4 リポの ruleset 更新が確認できる

- [ ] **Step 4: PR を Ready にしてマージ**

```bash
gh pr ready
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: terragrunt apply の結果を確認**

```bash
gh run list --branch main --workflow=auto-label--deploy-trigger.yaml --limit 3
```

期待: 最新 run が success

- [ ] **Step 6: 実際の branch protection を確認**

```bash
for repo in deploy-actions panicboat-actions monorepo platform; do
  echo "=== $repo ==="
  gh api repos/panicboat/$repo/branches/main/protection/required_status_checks --jq '.contexts'
done
```

期待: 全リポで `["Validate PR title", "Ensure actions are pinned to SHAs"]` を含む

---

### Task P4.4: worktree 削除

- [ ] **Step 1: worktree 削除**

```bash
cd ~/GitHub/panicboat/platform
git worktree remove .claude/worktrees/feat-required-checks
git branch -D feat/required-status-checks 2>/dev/null
git worktree prune
```

---

## Final Verification (全 Phase 完了後)

### Task 40: Renovate 自動追従の動作確認

- [ ] **Step 1: Renovate Dashboard で `pinDigest` PR の存在確認**

各リポで `gh pr list --label "🤖 renovate"` を実行し、pin/digest 系の PR が出ているかを確認する。出ていれば自動で automerge される (既存 packageRules による)。

```bash
for repo in deploy-actions panicboat-actions monorepo platform; do
  echo "=== $repo ==="
  gh pr list -R panicboat/$repo --label "🤖 renovate" --state open
done
```

- [ ] **Step 2: deploy-actions の patch リリースで利用側追従を確認 (任意)**

`deploy-actions` で軽微な fix コミットを 1 つ入れて main にマージ → release-please が `v1.0.1` Release PR を出す → マージ → `v1` タグが force-update される。その後、利用側 (monorepo / platform) で Renovate が `panicboat/deploy-actions/*` の SHA を更新する PR を出すことを確認する。

このタスクは任意 (検証のための実機確認)。実施しない場合は「Renovate のスケジュール (`before 4am every weekday`) を待つ」だけで自動的に動く。

---

## Self-Review (実施記録)

このプランの作成後、以下を確認した:

- **Spec coverage:** spec の Phase 0 / 1 / 2 / 3 / 4 / Verification / Definition of Done / Rollback / Risks の全セクションが Task に対応している
- **Placeholder scan:** `TBD`, `TODO` なし。`<sha>` プレースホルダは pinact が埋める設計のため意図的
- **Type consistency:** workflow ファイル名・job 名・check 名 (`Validate PR title`, `Ensure actions are pinned to SHAs`) は全 Task で一貫
- **Task numbering:** 設計変更で削除になった Task 9 / 20 / 29 / 38 は欠番として残し、Phase 0 / Phase 4 は `P0.x` / `P4.x` で識別

## Revision history

- 初版: `gh repo edit` でリポジトリ設定変更、`gh api` で branch protection 設定 (各 Phase 内)
- 修正: `platform/github/` の Terragrunt 管理に合わせて Phase 0 (マージ戦略変更) と Phase 4 (Required check 追加) を新設、各 Phase の `gh repo edit` / `gh api` タスクを削除
