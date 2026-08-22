# Flatten workspace/ and scope proto per product — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 各サービスの `workspace/` を廃止して service 直下にフラット化し、`proto/` を `proto/dystopia/` に product 名前空間化し、CI の root 列挙を `workflow-config.yaml` から導出するようにする。

**Architecture:** monorepo のトップレベルは「プロダクト名 (`dystopia`) = 一般ユーザー向け」と「`system-components` = 内部向け」の 2 軸。service 直下がアプリケーションのルートになり、`kubernetes/` と `aws/` がデプロイ関心事として並ぶ。proto は product ごとの buf module になる。

**Tech Stack:** Git (mv), buf v1, Ruby/Bundler, pnpm, GitHub Actions, yq 4.x, Flux CD, release-please

**Spec:** `docs/superpowers/specs/2026-08-22-flatten-workspace-and-scope-proto-design.md`

## Global Constraints

- コミットには必ず `-s` (`--signoff`) を付ける。`Co-Authored-By` は付けない。
- PR タイトルは英語かつ conventional commits 形式（`Validate PR title` check がある）。
- `docs/superpowers/` 配下は履歴なので **書き換えない**。`git grep` の残存確認時は除外する。
- ファイル名リストを `xargs` に渡すときは必ず `git grep -lz ... | xargs -0` を使う。macOS の `git grep -l` は日本語パス (`docs/ドメイン/`) を C-style escape で出力し、NUL 区切りでない `xargs` が復元できず `sed` が "No such file or directory" で落ちる。
- 各タスクは完了時点でリポジトリが機能する状態を保つ。特に proto の参照パスは、移動と同じコミットで必ず辻褄を合わせる。
- `.github/renovate.json` の `datasourceTemplate: docker` / `versioningTemplate: docker` は Renovate の datasource 名であり stack 名とは無関係。**変更しない**。

---

### Task 1: workspace/ を service 直下にフラット化する

**Files:**
- Move: `dystopia/monolith/workspace/*` → `dystopia/monolith/`
- Move: `dystopia/frontend/workspace/*` → `dystopia/frontend/`
- Move: `system-components/holmes/workspace/*` → `system-components/holmes/`
- Modify: `dystopia/monolith/bin/codegen:33`
- Modify: `dystopia/frontend/package.json:12`
- Modify: `bin/codegen:24,27`
- Modify: `.github/workflows/auto-release--trigger.yaml:51-57`

**Interfaces:**
- Produces: service 直下がアプリケーションルートになる。以降の全タスクがこれを前提にする。
- Produces: proto 参照が `../../../proto` から `../../proto` に変わる (service が 1 階層上がったため)。Task 2 でさらに `../../proto/dystopia` になる。

**Note:** `{service}/` と `{service}/workspace/` で名前が衝突するのは monolith と frontend の `README.md` のみ (VERIFIED)。README のマージは Task 5 で行うため、このタスクでは **workspace 側を `README.workspace.md` に一時退避**して衝突を回避する。

- [ ] **Step 1: 3 サービスの workspace 中身を 1 階層上げる**

```bash
for svc in dystopia/monolith dystopia/frontend system-components/holmes; do
  if [ -f "$svc/README.md" ] && [ -f "$svc/workspace/README.md" ]; then
    git mv "$svc/workspace/README.md" "$svc/workspace/README.workspace.md"
  fi
  # dotfile を含めて全件移動する
  for f in "$svc"/workspace/* "$svc"/workspace/.[!.]*; do
    [ -e "$f" ] || continue
    git mv "$f" "$svc/"
  done
  rmdir "$svc/workspace"
done
```

- [ ] **Step 2: workspace/ が消え中身が上がったことを確認**

Run: `ls -d dystopia/*/workspace system-components/*/workspace 2>/dev/null || echo "OK: no workspace dirs left"`
Expected: `OK: no workspace dirs left`

Run: `ls dystopia/monolith/Dockerfile dystopia/frontend/package.json system-components/holmes/go.mod`
Expected: 3 つとも存在する

- [ ] **Step 3: `/workspace` を含むパス参照を一括で詰める**

`workspace` を含むファイルは 24 件あり、docs / README / CI / ソースコメントに散在する。絶対パスとしての `/workspace` (WORKDIR 等) も `github.workspace` も存在しない (VERIFIED) ため、`/workspace` の除去は一括で安全に行える。`pnpm-workspace` は `/` が前に付かないので影響を受けない。

```bash
git grep -lz "/workspace" -- . ':!docs/superpowers' ':!*node_modules*' ':!pnpm-lock.yaml' \
  | xargs -0 sed -i '' 's|/workspace||g'
```

- [ ] **Step 4: proto 参照を 1 階層分ぶん詰める**

Step 3 の一括置換は `/workspace` しか消さないので、proto への相対パスは別途詰める。

`dystopia/monolith/bin/codegen` の 33 行目:

```ruby
system("buf generate ../../../proto")
```

を以下に変更する:

```ruby
system("buf generate ../../proto")
```

同ファイル 32 行目のコメント `# Input: ../../../proto (relative to workspace)` を以下に変更する:

```ruby
# Input: ../../proto (relative to the service root)
```

`dystopia/frontend/package.json` の 12 行目:

```json
    "proto:gen": "buf generate ../../../proto"
```

を以下に変更する:

```json
    "proto:gen": "buf generate ../../proto"
```

- [ ] **Step 5: スラッシュを伴わない `workspace` を個別に直す**

Step 3 の一括置換は `/workspace` しか消さないため、以下が残る。1 件ずつ直す。

**`.github/workflows/auto-release--trigger.yaml:57`** — エラーメッセージの文言:

```yaml
          echo "::error::No workspace directory found for service '$SERVICE' under dystopia/ or system-components/"
```
→
```yaml
          echo "::error::No directory found for service '$SERVICE' under dystopia/ or system-components/"
```

**`README.md:17` / `README-ja.md:17`** — ディレクトリツリーの行を削除する:

```
│       ├── workspace/   # Application source
```
(README-ja.md は `│       ├── workspace/   # アプリケーションソース`)

削除後、直前の `│   └── {service}/` の下は `├── kubernetes/` から始まる。

**`dystopia/monolith/README.md:75` / `README-ja.md:75`** — `cd workspace` の行を削除する。サービス直下が既にアプリケーションルートなので不要:

```bash
cd workspace
bundle install
bundle exec hanami server
```
→
```bash
bundle install
bundle exec hanami server
```

**`dystopia/frontend/README.md:93` / `README-ja.md:92`** — 同様に `cd workspace` の行を削除する。

**`proto/README.md:24`** — 文言のみ:

```
Each service workspace maintains its own `buf.gen.yaml` configuration
```
→
```
Each service maintains its own `buf.gen.yaml` configuration
```

**変更してはならないもの** — `system-components/holmes/README.md:28` の `Install to workspace.` は **Slack のワークスペース**を指しており、ディレクトリとは無関係。そのまま残す。

- [ ] **Step 6: codegen が動くことを実際に確認する**

Run: `bin/codegen`
Expected: `[codegen] done.` で終了し、exit code 0。`git status --short` に stub の差分が出ないこと (= 生成結果が既存と一致する)

- [ ] **Step 7: workspace 参照の残存を確認**

Run: `git grep -n "workspace" -- . ':!docs/superpowers' ':!*node_modules*' ':!pnpm-lock.yaml' | grep -vE "pnpm-workspace|Install to workspace" || echo "OK: no workspace references left"`
Expected: `OK: no workspace references left`（`pnpm-workspace.yaml` は pnpm の機能名なので除外）

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -s -m "refactor: flatten workspace/ into the service root

service 直下をアプリケーションルートにし、kubernetes/ と aws/ が
デプロイ関心事として並ぶ形にする。workflow-config の container stack
を directory: . にするための前提。README の衝突は README.workspace.md
に一時退避してあり、Task 5 でマージする。"
```

---

### Task 2: proto を product 名前空間に移す

**Files:**
- Move: `proto/{buf.yaml,bookmarks,discovery,feed,footprints,identity,karte,media,messaging,notifications,post,profile,social}` → `proto/dystopia/`
- Modify: `dystopia/monolith/bin/codegen:33`
- Modify: `dystopia/frontend/package.json:12`

**Interfaces:**
- Consumes: Task 1 が作った service 直下のレイアウト
- Produces: `proto/dystopia/` が dystopia の buf module になる。`root: dystopia/{service}` にマッチしないため空振りラベルが出ない。

**Note:** buf v1 は入力ディレクトリを module root として扱うため、`buf.yaml` も一緒に移動する。`proto/README.md` と `proto/README-ja.md` は product 横断の説明なので `proto/` 直下に残す。

- [ ] **Step 1: proto の中身を product ディレクトリへ移す**

```bash
mkdir -p proto/dystopia
for d in proto/*/; do
  name=$(basename "$d")
  [ "$name" = "dystopia" ] && continue
  git mv "$d" proto/dystopia/
done
git mv proto/buf.yaml proto/dystopia/buf.yaml
```

- [ ] **Step 2: 移動結果を確認**

Run: `ls proto/ && echo "---" && ls proto/dystopia/ | head -5`
Expected: `proto/` には `dystopia README-ja.md README.md` のみ。`proto/dystopia/` に `buf.yaml` とドメインディレクトリが入っている

- [ ] **Step 3: proto 参照を product 込みに変える**

`dystopia/monolith/bin/codegen` の 33 行目:

```ruby
system("buf generate ../../proto")
```

を以下に変更する:

```ruby
system("buf generate ../../proto/dystopia")
```

同ファイル 32 行目のコメントも `# Input: ../../proto/dystopia (relative to the service root)` に変更する。

`dystopia/frontend/package.json` の 12 行目:

```json
    "proto:gen": "buf generate ../../proto"
```

を以下に変更する:

```json
    "proto:gen": "buf generate ../../proto/dystopia"
```

- [ ] **Step 4: proto/README.md の記述を product 名前空間に合わせる**

`proto/README.md` の 7 行目は proto がリポジトリ横断の資産である前提で書かれており、移動後は不正確になる:

```
This directory contains the shared Protocol Buffers (`.proto`) definitions for the entire repository. Use this single source of truth to define APIs and data structures shared across services.
```
→
```
This directory holds Protocol Buffers (`.proto`) definitions, namespaced per product (`dystopia/`, ...). Each product directory is its own buf module and is the single source of truth for the APIs shared between that product's services.
```

11 行目:

```
1.  **Edit**: Modify or add `.proto` files in this directory.
```
→
```
1.  **Edit**: Modify or add `.proto` files under the product's directory (e.g. `dystopia/`).
```

`proto/README-ja.md` に対応する記述があれば同様に直す。

- [ ] **Step 5: codegen が動くことを実際に確認する**

Run: `bin/codegen`
Expected: `[codegen] done.` で終了し exit code 0。`git status --short` に stub の差分が出ないこと

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -s -m "refactor(proto): scope protos under a product namespace

proto/ 直下はモノレポ横断の資産に見えるが、12 ドメインすべてが dystopia
のドメイン概念で system-components/holmes は proto を参照していない。
proto/dystopia/ に移して所有を明示する。buf v1 は入力ディレクトリを
module root として扱うため buf.yaml も一緒に移動する。
proto/dystopia は root: dystopia/{service} にマッチしないので
空振りラベルは出ない。"
```

---

### Task 3: terragrunt/ を aws/ に改名する

**Files:**
- Move: `dystopia/monolith/terragrunt/` → `dystopia/monolith/aws/`
- Move: `system-components/holmes/terragrunt/` → `system-components/holmes/aws/`

**Interfaces:**
- Produces: terragrunt stack の directory が `aws/envs/{environment}` になり、platform の `aws/{service}/envs/{environment}` と規約が揃う。Task 6 の workflow-config 変更がこれを前提にする。

**Note:** `terragrunt.hcl` の `source = "../../modules"` は `terragrunt/envs/{env}` → `aws/envs/{env}` で相対深度が変わらないため変更不要 (VERIFIED)。`frontend` は terragrunt を持たないため対象外。

- [ ] **Step 1: ディレクトリを改名**

```bash
git mv dystopia/monolith/terragrunt dystopia/monolith/aws
git mv system-components/holmes/terragrunt system-components/holmes/aws
```

- [ ] **Step 2: 改名結果と相対パスの健全性を確認**

Run: `ls -d dystopia/monolith/aws/envs/* system-components/holmes/aws/envs/*`
Expected: それぞれ `production` が出る

Run: `grep -rn 'source *= *"' dystopia/monolith/aws/envs system-components/holmes/aws/envs`
Expected: `../../modules` を指しており、`ls dystopia/monolith/aws/modules system-components/holmes/aws/modules` が実在する

- [ ] **Step 3: terragrunt という語がパスとして残っていないか確認**

Run: `git grep -n "terragrunt/" -- . ':!docs/superpowers' ':!*node_modules*' || echo "OK: no terragrunt/ paths left"`
Expected: `OK: no terragrunt/ paths left`（`.terragrunt-cache` 等の生成物は gitignore 対象）

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -s -m "refactor(terragrunt): rename terragrunt/ to aws/

platform の aws/{service}/envs/{environment} と規約を揃える。
terragrunt.hcl の source = \"../../modules\" は相対深度が変わらないため
変更不要。"
```

---

### Task 4: bin/codegen を discover 方式にする

**Files:**
- Create: `dystopia/frontend/bin/codegen`
- Modify: `bin/codegen` (全面書き換え)

**Interfaces:**
- Consumes: Task 1〜2 が確定させた service 直下レイアウトと `proto/dystopia/`
- Produces: 「`bin/codegen` を持つサービスが codegen 対象」という規約。サービス追加時に root の `bin/codegen` を編集する必要がなくなる。

- [ ] **Step 1: frontend に bin/codegen ラッパーを新設**

`dystopia/frontend/bin/codegen` を以下の内容で作成する:

```bash
#!/usr/bin/env bash
# Regenerate TypeScript proto stubs via @bufbuild/protoc-gen-es.
#
# Why this exists: the repo-root orchestrator discovers codegen targets by
# looking for an executable bin/codegen in each service, so the pnpm script
# needs a file to be discovered through.

set -euo pipefail
cd "$(dirname "$0")/.."
exec pnpm proto:gen
```

実行権限を付ける:

```bash
chmod +x dystopia/frontend/bin/codegen
```

- [ ] **Step 2: root の bin/codegen を discover 方式に書き換える**

`bin/codegen` を以下の内容で全面的に置き換える:

```bash
#!/usr/bin/env bash
# Regenerate proto stubs for one product, or for every product.
#
# Usage:
#   bin/codegen            # all products under proto/
#   bin/codegen dystopia   # one product
#
# Why this exists: a proto change must regenerate every consumer's stubs at
# once, otherwise they drift. Targets are discovered rather than listed —
# a service opts in by providing an executable bin/codegen — so adding a
# service does not require editing this file.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ -z "${NODE_OPTIONS+x}" ]; then
  # Pass through.
  RUN_PREFIX=""
else
  # The cmux harness sets NODE_OPTIONS for its own preload; unset for tool runs.
  RUN_PREFIX="env -u NODE_OPTIONS"
fi

if [ "$#" -gt 0 ]; then
  products=("$@")
else
  products=()
  for d in proto/*/; do
    products+=("$(basename "$d")")
  done
fi

ran=0
for product in "${products[@]}"; do
  if [ ! -d "proto/$product" ]; then
    echo "[codegen] no proto module for product '$product' (expected proto/$product)" >&2
    exit 1
  fi
  if [ ! -d "$product" ]; then
    echo "[codegen] no service tree for product '$product'" >&2
    exit 1
  fi
  for svc in "$product"/*/; do
    [ -x "${svc}bin/codegen" ] || continue
    echo "[codegen] ${svc}"
    ( cd "$svc" && $RUN_PREFIX ./bin/codegen )
    ran=$((ran + 1))
  done
done

if [ "$ran" -eq 0 ]; then
  echo "[codegen] no codegen targets found" >&2
  exit 1
fi

echo "[codegen] done. ($ran target(s))"
```

- [ ] **Step 3: 全 product での実行を確認**

Run: `bin/codegen`
Expected: `[codegen] dystopia/frontend/` と `[codegen] dystopia/monolith/` の両方が出て `[codegen] done. (2 target(s))` で終わる。`git status --short` に stub の差分が出ないこと

- [ ] **Step 4: product 指定での実行を確認**

Run: `bin/codegen dystopia`
Expected: 同上で exit code 0

Run: `bin/codegen nonexistent; echo "exit=$?"`
Expected: `no proto module for product 'nonexistent'` が stderr に出て `exit=1`

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -s -m "refactor(codegen): discover targets instead of listing them

サービスは実行可能な bin/codegen を置くことで codegen 対象になる。
どのサービスがどう codegen するかの知識が各サービス内に閉じ、root の
orchestrator から消える。frontend は pnpm proto:gen を呼ぶ薄い
ラッパーを新設して規約に乗せた。"
```

---

### Task 5: README を統合する

**Files:**
- Modify: `dystopia/monolith/README.md`
- Delete: `dystopia/monolith/README.workspace.md`
- Modify: `dystopia/frontend/README.md`
- Delete: `dystopia/frontend/README.workspace.md`

**Interfaces:**
- Consumes: Task 1 が `README.workspace.md` に退避した内容

**Note:** `README-ja.md` は本タスクの対象外。`README.workspace.md` は英語主体で `-ja` 版が存在せず、翻訳は別作業になるため。統合後も `README-ja.md` は既存内容のまま残す。

- [ ] **Step 1: monolith の README を統合**

`dystopia/monolith/README.md` を、以下の見出し構成になるように書き換える。本文は両ファイルから **逐語的に移す**（要約しない）。

```
# Monolith (🌸 Hanami + gRPC)
## 💡 Role                          ← 既存 README.md より
## 🔗 Architecture / Dependencies   ← 既存 README.md より
### Design Philosophy               ← README.workspace.md より (信念/妥協/設計方針を含む)
### Slice Structure                 ← 既存 README.md より
### Directory Structure             ← README.workspace.md より
### Slice Communication Pattern     ← 既存 README.md より
### Authentication                  ← 既存 README.md より
## ⚙️ Environment Variables         ← 既存 README.md より
## 🚀 Running Locally
### Requirements                    ← README.workspace.md より
### Install Dependencies            ← README.workspace.md より
### Database Setup                  ← README.workspace.md より
### Bulk Seed Data                  ← README.workspace.md より
### Run the gRPC server             ← README.workspace.md より
## Proto Generation                 ← README.workspace.md より
## Testing                          ← README.workspace.md より
## Useful links                     ← README.workspace.md より
```

既存 README.md の 1 行目 `# Monolith` は workspace 側の `# Monolith (🌸Hanami + gRPC)` に寄せる。2 行目の `**English** | [🇯🇵 日本語](README-ja.md)` は残す。

`README.workspace.md` 内の `# From dystopia/monolith directory` のようなパス記述が `workspace` を含んでいたら service 直下基準に直す。

- [ ] **Step 2: frontend の README を統合**

`dystopia/frontend/README.md` に、`README.workspace.md` の `## Proto Generation` セクションを **逐語的に** 追記する（末尾、`## 🚀 Running Locally` の後）。

`README.workspace.md` の他のセクション (`## Overview` / `## Getting Started` / `### Running Locally`) は既存 README.md の `## 💡 Role` と `## 🚀 Running Locally` と重複するため **破棄する**。

- [ ] **Step 3: 退避ファイルを削除**

```bash
git rm dystopia/monolith/README.workspace.md dystopia/frontend/README.workspace.md
```

- [ ] **Step 4: 統合結果を確認**

Run: `grep -c "^#" dystopia/monolith/README.md dystopia/frontend/README.md`
Expected: monolith は 17 前後、frontend は 9 前後（コードブロック内の `#` コメントも数えるため厳密一致は求めない）

Run: `ls dystopia/*/README.workspace.md 2>/dev/null || echo "OK: no leftover"`
Expected: `OK: no leftover`

Run: `git grep -n "Proto Generation" -- dystopia/monolith/README.md dystopia/frontend/README.md`
Expected: 両方でヒットする

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -s -m "docs: merge workspace READMEs into the service READMEs

workspace/ フラット化で衝突した 2 つの README を 1 つに統合する。
README-ja.md は workspace 側に -ja 版が無く翻訳が別作業になるため
本コミットでは触らない。"
```

---

### Task 6: workflow-config.yaml と CI を更新する

**Files:**
- Modify: `workflow-config.yaml`
- Modify: `.github/workflows/auto-release--trigger.yaml:47-58`
- Modify: `.github/workflows/auto-label--deploy-trigger.yaml:82,92`

**Interfaces:**
- Consumes: Task 1 (service 直下)、Task 3 (`aws/envs/`) が確定させたレイアウト
- Produces: stack 名が `container` になり、`workflow-config.yaml` が root の唯一の情報源になる

**Note:** stack 名 `docker` は deploy-actions 本体には存在せずテストの fixture にしか現れないため、deploy-actions 側の改修は不要 (VERIFIED)。

- [ ] **Step 1: workflow-config.yaml の stack_conventions を差し替える**

`workflow-config.yaml` の `stack_conventions:` セクション全体を以下に置き換える:

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

`environments:` セクションは **変更しない**（本 plan のスコープ外）。

- [ ] **Step 2: auto-release--trigger.yaml の root 列挙を workflow-config 由来にする**

`.github/workflows/auto-release--trigger.yaml` の `Resolve working directory` step の `run:` ブロック全体を以下に置き換える:

```yaml
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

- [ ] **Step 3: auto-label--deploy-trigger.yaml の stack 名を追随させる**

82 行目:

```yaml
      contains(needs.deploy-trigger.outputs.targets, '"stack":"docker"')
```

を以下に変更する:

```yaml
      contains(needs.deploy-trigger.outputs.targets, '"stack":"container"')
```

92 行目:

```yaml
      image-name: ${{ matrix.target.stack == 'docker' && matrix.target.service || '' }}
```

を以下に変更する:

```yaml
      image-name: ${{ matrix.target.stack == 'container' && matrix.target.service || '' }}
```

- [ ] **Step 4: root 解決ロジックをローカルで検証する**

Run:
```bash
for SERVICE in monolith frontend holmes nonexistent; do
  printf "%-12s -> " "$SERVICE"
  found=""
  while IFS= read -r root_pattern; do
    dir="${root_pattern//\{service\}/$SERVICE}"
    if [ -d "$dir" ]; then found="$dir"; break; fi
  done < <(yq -r '.stack_conventions[].root' workflow-config.yaml)
  echo "${found:-NOT FOUND}"
done
```
Expected:
```
monolith     -> dystopia/monolith
frontend     -> dystopia/frontend
holmes       -> system-components/holmes
nonexistent  -> NOT FOUND
```

- [ ] **Step 5: stack 名の取りこぼしを確認**

Run: `git grep -n '"stack":"docker"\|stack == .docker.\|name: docker' -- . ':!docs/superpowers' || echo "OK: no docker stack references left"`
Expected: `OK: no docker stack references left`

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -s -m "refactor(ci): derive roots from workflow-config and rename docker stack

auto-release--trigger.yaml の root 列挙と workspace のハードコードを廃し
yq で workflow-config.yaml から導出する。新しいプロダクト root の追加で
編集するのが workflow-config.yaml だけになる。

stack 名 docker -> container は 'stack 名 = reusable workflow の名詞'
規則を揃えるため (terragrunt-executor / kubernetes-builder /
container-builder)。deploy-actions 本体は stack 名を持たずデータ駆動
なので改修不要。"
```

---

### Task 7: .dockerignore とドキュメントを更新して PR を出す

**Files:**
- Modify: `dystopia/monolith/.dockerignore`
- Modify: `dystopia/frontend/.dockerignore`
- Modify: `system-components/holmes/.dockerignore`
- Modify: `README.md`, `README-ja.md`

**Interfaces:**
- Consumes: 全タスクの成果

- [ ] **Step 1: build context 拡大に備えて .dockerignore を更新**

3 サービスそれぞれの `.dockerignore` の末尾に以下を追記する:

```
# Deployment concerns — not part of the image build context.
kubernetes/
aws/
CHANGELOG.md
README.md
README-ja.md
```

`frontend` には `aws/` が無いが、将来追加された場合に備えて同じブロックを入れる。

- [ ] **Step 2: root README の構造図と stack 名を更新**

`README.md` と `README-ja.md` の 52 行目付近:

```
  Resolver -->|stack: docker| Builder[container-builder]
```

を以下に変更する:

```
  Resolver -->|stack: container| Builder[container-builder]
```

同 2 ファイル内でディレクトリ構成を示している箇所 (15 行目付近の tree) に `workspace/` が残っていれば削り、`proto/dystopia/` を反映する。

- [ ] **Step 3: 全体の残存参照を最終確認**

Run: `git grep -n "workspace" -- . ':!docs/superpowers' ':!*node_modules*' ':!pnpm-lock.yaml' | grep -vE "pnpm-workspace|Install to workspace" || echo "OK"`
Expected: `OK`

Run: `git grep -n "docker\b" -- workflow-config.yaml .github/workflows/ || echo "OK: no docker stack refs"`
Expected: `OK: no docker stack refs`

- [ ] **Step 4: kustomize build が通ることを確認**

```bash
for d in dystopia/monolith dystopia/frontend system-components/holmes; do
  kubectl kustomize "$d/kubernetes/overlays/production" > /dev/null && echo "$d OK" || echo "$d FAILED"
done
```
Expected: 3 つとも `OK`

- [ ] **Step 5: codegen の最終確認**

Run: `bin/codegen && git status --short`
Expected: `[codegen] done. (2 target(s))`、`git status --short` に stub の差分が出ない

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -s -m "chore: update dockerignore and docs for the new layout"
```

- [ ] **Step 7: push して Draft PR を作成**

```bash
git push -u origin HEAD
gh pr create --draft --title "refactor: flatten workspace/ and scope proto per product" --body "$(cat <<'EOF'
## Summary
- 各サービスの `workspace/` を廃止し service 直下をアプリケーションルートにした
- `proto/` を `proto/dystopia/` に product 名前空間化 (buf.yaml も module root として移動)
- `terragrunt/` を `aws/` に改名し platform の規約と揃えた
- `bin/codegen` を discover 方式に変更 (サービスは実行可能な `bin/codegen` を置くことで対象になる)
- `auto-release--trigger.yaml` の root 列挙を廃し `workflow-config.yaml` から yq で導出
- stack 名 `docker` → `container` (reusable workflow の名詞と揃える)

Spec: `docs/superpowers/specs/2026-08-22-flatten-workspace-and-scope-proto-design.md`

## Test plan
- [x] `bin/codegen` が全 product で走り stub に差分が出ないことを確認
- [x] `kubectl kustomize` が 3 overlay すべてで通ることを確認
- [x] root 解決ロジックが monolith / frontend / holmes を正しく引き当てることを確認
- [ ] CI で `Dispatch Labels` が pass し 3 サービスの `Deploy Container` が起動すること
- [ ] CI で kustomize build が通ること
EOF
)"
```

- [ ] **Step 8: CI の結果を確認**

PR 番号を取得する:

```bash
gh pr list --head refactor/flatten-workspace-and-scope-proto --json number --jq '.[0].number'
```

Run: `gh pr checks <上で得た番号> --watch --interval 20`
Expected: 全 check が pass。特に `Dispatch Labels` の出力で 3 サービスが検出され、`Deploy Container (monolith)` / `(frontend)` / `(holmes)` が起動していること

---

## Self-Review

**1. Spec coverage:** spec の Decisions 表 9 項目すべてにタスクが対応している。
- workspace 廃止 → Task 1 / proto 所有・粒度・buf.yaml → Task 2 / terragrunt→aws → Task 3
- codegen ラッパー → Task 4 / README 統合 → Task 5 / container stack 名・#2 の情報源 → Task 6
- `.dockerignore` → Task 7

**2. Placeholder scan:** Task 7 Step 8 の `<上で得た番号>` は直前に取得コマンドを示しているため実行時に解決可能。それ以外に TBD / TODO なし。

**3. Type consistency:** proto の参照パスが Task 1 で `../../proto`、Task 2 で `../../proto/dystopia` と 2 段階で変わる。これは各タスク完了時点でリポジトリが機能する状態を保つための意図的な設計で、Global Constraints に明記済み。両タスクとも Step で実際に `bin/codegen` を走らせて検証する。

**4. 既知のギャップ:** `README-ja.md` は Task 5 の統合対象外 (workspace 側に -ja 版が無いため)。統合後の README.md と内容がずれるが、翻訳は別作業とする。
