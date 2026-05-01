# GitHub Actions SHA Pinning Rollout

## Goal

panicboat 配下のリポジトリ群（`deploy-actions` / `panicboat-actions` / `monorepo` / `platform`）の GitHub Actions 参照を、`@v4` 等のメジャーバージョン指定から **コミット SHA + バージョンコメント** 形式に揃える。同時に、SHA pin が継続的に維持される仕組み（CI gate + Renovate 自動更新 + Conventional Commits 強制 + semver タグ運用）を組み込む。`argo-workflows` がすでに到達している運用を panicboat 配下に展開する。

## Scope

- **対象リポジトリ**: `deploy-actions`, `panicboat-actions`, `monorepo`, `platform`
- **対象ファイル**: 各リポの `.github/workflows/**` および `**/action.yml` / `**/action.yaml`
- **追加コンポーネント** (各リポ共通):
  - `semantic-pull-request.yml` — PR タイトルの Conventional Commits 検証
  - `lint-actions.yml` — `zgosalvez/github-actions-ensure-sha-pinned-actions` による SHA pin 強制
  - `.github/renovate.json` への `helpers:pinGitHubActionDigests` 追加
- **追加コンポーネント** (`deploy-actions` のみ):
  - `release-please.yml` — `googleapis/release-please-action` による semver タグ運用
- **ワンショット移行**: `pinact` をローカルで一度実行し、既存の `@v4` 等を SHA pin に変換する PR を出す。`pinact` 自体は CI に常駐させず実行後にアンインストールする。

## Non-Goals

- `argo-workflows` への変更（既に同等の構成済み）
- `PAYSLIP` / `ansible` / `dotfiles` への変更（GitHub Actions workflow なし）
- panicboat 配下リポ間で Conventional Commits の subject 形式を強制する（`subjectPattern` 等の追加制約は入れず、`amannn/action-semantic-pull-request` のデフォルト動作で運用）
- `panicboat/panicboat-actions/*` のリリース運用（雑 action 扱いで `@main` 運用継続）
- `pinact` の CI 常駐（Renovate `helpers:pinGitHubActionDigests` と役割が重複するため）
- 既存の Renovate `packageRules` / `automerge` 戦略の変更（既存設定を流用）

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Conventional Commits 強制                                        │
│   amannn/action-semantic-pull-request                           │
│   PR タイトルが feat:/fix:/chore: 等で始まらないと CI 失敗       │
│   + マージ戦略は Squash 必須（リポジトリ設定）                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SHA pinning 強制                                                 │
│   zgosalvez/github-actions-ensure-sha-pinned-actions            │
│   workflow 内の uses: が SHA でないと CI 失敗                    │
│   panicboat/panicboat-actions/* は allowlist で除外              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SHA pin 維持（継続自動化）                                        │
│   Renovate（既存）+ helpers:pinGitHubActionDigests              │
│   ・既存の @v4 等を SHA pin に変換する PR を生成                  │
│   ・新規追加された action も自動で SHA pin                        │
│   ・patch/digest は automerge で main に取り込み                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ リリース運用（deploy-actions のみ）                               │
│   googleapis/release-please-action                              │
│   ・main の Conventional Commits を読んで Release PR を自動生成  │
│   ・マージで semver タグ + GitHub Release + CHANGELOG            │
│   ・利用側は panicboat/deploy-actions/<sub>@<sha> # v1.x.x      │
└─────────────────────────────────────────────────────────────────┘
```

4 つのコンポーネントは疎結合で、各々独立して revert できる。

## Components

### 1. `.github/workflows/semantic-pull-request.yml`（4 リポ共通）

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
        uses: actions/create-github-app-token@<sha> # v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: amannn/action-semantic-pull-request@<sha> # v6.1.1
        env:
          GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}
        # with: なし — argo-workflows と同じデフォルト動作で運用
```

`pull_request_target` を使うため Renovate / fork PR でも secrets が利用可能。Required check に登録する。

### 2. `.github/workflows/lint-actions.yml`（4 リポ共通）

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
      - uses: actions/checkout@<sha> # v6.0.2
      - uses: zgosalvez/github-actions-ensure-sha-pinned-actions@<sha> # v5.0.4
        with:
          allowlist: |
            <リポごとの allowlist — 下表参照>
```

#### Allowlist matrix

| リポ | allowlist |
|---|---|
| `deploy-actions` | (空) |
| `panicboat-actions` | `panicboat/panicboat-actions/` |
| `monorepo` | `panicboat/panicboat-actions/` |
| `platform` | `panicboat/panicboat-actions/` |

`panicboat/deploy-actions/*` はどのリポでも allowlist に入れない（Phase 1 完了後に semver タグが切られるため SHA pin 可能）。

### 3. `.github/workflows/release-please.yml`（`deploy-actions` のみ）

```yaml
name: Release Please

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
        uses: actions/create-github-app-token@<sha> # v3.1.1
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: googleapis/release-please-action@<sha> # v4.x.x
        id: release
        with:
          token: ${{ steps.app-token.outputs.token }}
          release-type: simple

      - name: Checkout for major tag update
        if: ${{ steps.release.outputs.release_created }}
        uses: actions/checkout@<sha> # v6.0.2
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

- `release-type: simple` を採用（リポ全体で 1 つの semver、`version.txt` のみ更新）
- メジャータグ (`v1`) を別 step で force-update し、利用側が `@v1` で参照しても Renovate が SHA を自動追従できるようにする

#### 補助ファイル

`.release-please-manifest.json`:

```json
{
  ".": "0.0.0"
}
```

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "simple",
  "include-component-in-tag": false,
  "packages": {
    ".": {}
  }
}
```

#### 必要な GitHub App 設定（`deploy-actions` 限定の事前作業）

| 項目 | 設定先 |
|---|---|
| `vars.APP_ID` | deploy-actions の Repository variables |
| `secrets.APP_PRIVATE_KEY` | deploy-actions の Repository secrets |
| App installation | App 管理画面で deploy-actions を install 対象に追加 |
| App permissions | `Contents: R/W`, `Pull requests: R/W` |

既存 App（auto-approve / claude-code-action 等で使用中）を流用する。

### 4. `.github/renovate.json` への変更（4 リポ共通）

```diff
   "extends": [
     "config:base",
     ":semanticCommits",
     ":separateMajorReleases",
     "group:monorepos",
-    "group:recommended"
+    "group:recommended",
+    "helpers:pinGitHubActionDigests"
   ],
```

既存 `packageRules` の `pin/digest` automerge ルールが効くため、`helpers:pinGitHubActionDigests` で生成される PR は自動マージされる。

### 5. リポジトリ設定変更（4 リポ共通）

| 項目 | 設定 |
|---|---|
| Allow merge commits | OFF |
| Allow squash merging | ON |
| Allow rebase merging | OFF |
| Required status check | `Validate PR title` を追加 |

Squash merge 強制により、main の履歴が PR タイトルと 1:1 対応する。`release-please` の入力として一貫した履歴が得られる。

リポジトリ設定変更には各リポの Admin 権限が必要。Phase 開始前にリポジトリ管理者と調整する。

## Repository-by-repository plan

| リポ | semantic-PR | lint-actions | renovate.json | release-please | App token 事前準備 | allowlist |
|---|---|---|---|---|---|---|
| `deploy-actions` | 追加 | 追加 | 追加 | 追加 | 必要 | (空) |
| `panicboat-actions` | 追加 | 追加 | 追加 | — | 既設 | `panicboat/panicboat-actions/` |
| `monorepo` | 追加 | 追加 | 追加 | — | 既設 | `panicboat/panicboat-actions/` |
| `platform` | 追加 | 追加 | 追加 | — | 既設 | `panicboat/panicboat-actions/` |

## Rollout Plan

### Phase 1: deploy-actions

| Step | 内容 |
|---|---|
| 1.1 | App 事前準備: `vars.APP_ID` / `secrets.APP_PRIVATE_KEY` 登録、deploy-actions リポを App に install、permissions 確認 |
| 1.2 | 4 つの workflow + `.release-please-manifest.json` + `release-please-config.json` + Renovate `extends` 追加 + リポジトリ設定変更（1 PR） |
| 1.3 | `pinact` ローカル実行（後述）で既存 `uses:` を SHA pin に変換する PR をマージ |
| 1.4 | release-please が出す Initial Release PR で `Release-As: 1.0.0` を指定してマージ → `v1.0.0` + `v1` タグ作成 |
| 1.5 | `README.md` / `README-ja.md` の利用例を `@main` → `@v1` に更新する PR |

### Phase 2: panicboat-actions

| Step | 内容 |
|---|---|
| 2.1 | `semantic-pull-request.yml` + `lint-actions.yml`（allowlist: `panicboat/panicboat-actions/`）+ Renovate `extends` 追加 + リポジトリ設定変更（1 PR） |
| 2.2 | `pinact` ローカル実行（`panicboat/panicboat-actions/*` は ignore）で SHA pin PR をマージ |

### Phase 3: monorepo / platform（並列）

| Step | 内容 |
|---|---|
| 3.x.1 | `semantic-pull-request.yml` + `lint-actions.yml`（allowlist: `panicboat/panicboat-actions/`）+ Renovate `extends` 追加 + リポジトリ設定変更（1 PR） |
| 3.x.2 | `panicboat/deploy-actions/*@main` を `@v1` に手書き置換 → `pinact` ローカル実行（`panicboat/panicboat-actions/*` は ignore）で SHA pin に変換 → 1 PR でマージ |
| 3.x.3 | 必要に応じて README 更新 |

Phase 1 を最初にやる理由: Phase 3 の `panicboat/deploy-actions/*` 参照を SHA pin するには deploy-actions 側に semver タグが切られている必要があるため。

### `pinact` ワンショット実行手順

```bash
# 1) インストール（一時利用のみ）
brew install pinact

# 2) ignore 設定（リポにはコミットせず /tmp に置く）
cat > /tmp/pinact.yaml <<'EOF'
ignore_actions:
  - name: panicboat/panicboat-actions/*
EOF

# 3) 実行
pinact run --config /tmp/pinact.yaml

# 4) PR 作成（Conventional Commits 必須）
gh pr create --title "ci: pin GitHub Actions to SHAs" --draft

# 5) アンインストール（環境をクリーンに保つ）
brew uninstall pinact
rm /tmp/pinact.yaml
```

`deploy-actions` では `--config` 指定不要（ignore 対象なし）。以降の維持は Renovate `helpers:pinGitHubActionDigests` に完全委任する。

## Verification

### Phase 1: deploy-actions

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | `lint-actions` が main で green | `gh run list -w lint-actions.yml --branch main` |
| 2 | semantic-pull-request が non-conventional title PR をブロック | `Update README` 等のタイトルでテスト PR を出して CI 失敗を確認 |
| 3 | semantic-pull-request が conventional title PR を許可 | `chore: test` でテスト PR の CI 成功を確認 |
| 4 | release-please が Initial Release PR を出す | Phase 1 マージ後、main への次のコミットで PR が出ることを確認 |
| 5 | `v1.0.0` + `v1` タグ作成 | `gh release list -L 5` / `git ls-remote --tags origin v1*` |
| 6 | Renovate が SHA pin PR を出す（pinact 残漏れがあれば） | `gh pr list --label "🤖 renovate"` で `pinDigest` PR を確認 |

### Phase 2: panicboat-actions

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | `lint-actions` が main で green（`panicboat/panicboat-actions/claude-run@main` を許容） | `gh run list -w lint-actions.yml --branch main` |
| 2 | semantic-pull-request 動作 | テスト PR で確認 |
| 3 | pinact 後の SHA pin PR が CI を通過してマージされる | PR の checks がすべて green |

### Phase 3: monorepo / platform

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | `lint-actions` が main で green | `gh run list -w lint-actions.yml --branch main` |
| 2 | `panicboat/deploy-actions/*@main` が `@v1` + SHA pin に変換される | `grep -r "panicboat/deploy-actions" .github/workflows` で `@v1` 形式のみ残ることを確認 |
| 3 | semantic-pull-request 動作 | テスト PR で確認 |
| 4 | Renovate が deploy-actions の patch リリースに自動追従 | deploy-actions で `v1.0.1` をリリース → Renovate が SHA 更新 PR を起こすことを確認 |

## Definition of Done

**全リポ共通:**

- [ ] `.github/workflows/semantic-pull-request.yml` が存在し、main で green
- [ ] `.github/workflows/lint-actions.yml` が存在し、main で green
- [ ] `.github/renovate.json` の `extends` に `helpers:pinGitHubActionDigests` を含む
- [ ] リポジトリ設定で Squash merge のみ許可
- [ ] `Validate PR title` が Required check に登録されている
- [ ] `grep -rE "uses:\s+\w+/\w+@(v[0-9]|main)" .github/workflows/` の出力が allowlist 対象のみ

**`deploy-actions` 追加:**

- [ ] `.github/workflows/release-please.yml` が存在し、main で green
- [ ] `v1.0.0` タグと `v1` メジャータグが存在
- [ ] `vars.APP_ID` / `secrets.APP_PRIVATE_KEY` が設定されている
- [ ] README の利用例が `@v1` 形式

**Phase 3 完了時の追加:**

- [ ] `monorepo` / `platform` 内の `panicboat/deploy-actions/*@main` 参照がゼロ
- [ ] `monorepo` / `platform` 内の `panicboat/deploy-actions/*` がすべて `@<sha> # v1.x.x` 形式

## Rollback

| 問題 | 戻し方 |
|---|---|
| `lint-actions` が誤検知で main を赤にする | Required check 指定を解除し、allowlist を調整。workflow 自体は残す |
| `release-please` の挙動が想定と異なる | `release-please.yml` を削除する PR。既に切られたタグ・リリースは残す（消すと利用側の `@v1` 参照が壊れる） |
| `semantic-pull-request` が運用フローを阻害 | Required check から外し、advisory な扱いに変更（PR をブロックしない） |
| `pinact` 一括 PR で何かが壊れた | 該当 PR を revert し、個別に問題のある action だけ手動修正 |

各 Phase が独立して revert 可能なため、Phase 1 失敗時に Phase 2/3 は影響を受けない。

## Risks

| リスク | 対応 |
|---|---|
| Phase 1 中、`deploy-actions` 利用側で `@v1` に切り替わるまで `@main` 参照が残る | 既存挙動と同じなので影響なし。Phase 3 で順次 `@v1` 化 |
| `helpers:pinGitHubActionDigests` 追加直後、Renovate が大量の SHA pin PR を出す | `prConcurrentLimit: 15` で律速。`pinact` 先行一括変換でこれを軽減 |
| `release-please` が初回バージョンを `0.x.x` で始めてしまう | 初回 Release PR で `Release-As: 1.0.0` を指定 |
| Squash merge 強制が既存の merge commit 運用と衝突 | 各リポは既に Renovate `automergeStrategy: squash` を使用中のため影響は限定的 |
| `panicboat-actions` の `@main` が破壊的変更で利用側を壊す | 受容（雑 action の前提）。テストカバレッジ強化は別タスク |
| `pull_request_target` トリガーで App 秘密鍵が fork PR から漏出するリスク | `actions/checkout` でユーザー提供コードを取得しないため秘密鍵は workflow 内で完結（リスクなし） |

## Future Work

- `panicboat-actions` への semver タグ運用導入（必要性が出てきた時点で再検討）
- `release-please` のサブディレクトリごと独立 versioning（`deploy-actions` の各 sub-action を個別バージョニングしたくなった時点で）
- `dependabot` の `github-actions` 設定追加（Renovate 障害時の冗長化として）
