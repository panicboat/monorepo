# services/ → dystopia/ Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `services/` ディレクトリを `dystopia/` にリネームし、`workflow-config.yaml` の `root: dystopia/{service}` 規約を実体と一致させる。

**Architecture:** monorepo のトップレベル分類を「プロダクト名 (`dystopia`) = 一般ユーザー向け」と「`system-components` = 内部向け」の2軸に揃える。`workflow-config.yaml` は既に `dystopia/{service}` を宣言済みなので、config ではなくディレクトリ側を合わせる。Flux の GitOps ディレクトリ (`clusters/production/services/`) も同じ命名に揃える。

**Tech Stack:** Git (mv), GitHub Actions (workflow yaml), Flux CD (Kustomization manifests), release-please (config + manifest), Terragrunt (S3 backend key)

**Spec:** 本 plan は会話内で合意した設計に基づく（独立した spec ファイルなし）。設計判断の要点:
- `{category}/{service}` への一般化は **却下**。`label-dispatcher` の `PatternMatcher.extract_prefix` が先頭 literal を失うと `docs/foo/bar.md` のような任意の2階層パスを service として誤検知するため。root は literal 先頭を維持する。
- terragrunt state key も同時にリネームする。production account の S3 state bucket には `platform/*` しか存在せず、monorepo 由来の state (`services/*`) は未作成のため **state 移行は不要**（VERIFIED: `aws s3 ls s3://terragrunt-state-337169763788/ --recursive`）。
- release-please の `component` はパス非依存 (`monolith` / `frontend`) なので **tag 名は変わらない**。config / manifest のパスキーのみ追随させる。

## Global Constraints

- コミットには必ず `-s` (`--signoff`) を付ける。`Co-Authored-By` は付けない。
- PR タイトルは英語かつ conventional commits 形式（`Validate PR title` check がある）。
- `docs/superpowers/` 配下の過去の plan / spec は履歴なので **書き換えない**。`git grep` の残存確認時は除外する。
- `system-components/` 配下は今回のリネーム対象外。ただし state key の `services/template/` だけは意味的な誤りなので `system-components/template/` に直す。
- 変更後 `git grep "services/"` の結果が「`docs/superpowers/` 配下のみ」になることを最終確認とする。

---

### Task 1: ディレクトリを移動する

**Files:**
- Move: `services/` → `dystopia/`
- Move: `clusters/production/services/` → `clusters/production/dystopia/`

**Interfaces:**
- Produces: `dystopia/{frontend,monolith}/` と `clusters/production/dystopia/{frontend,monolith}/` という新しいパス。以降の全タスクがこれを前提にする。

- [ ] **Step 1: services/ を dystopia/ に移動**

```bash
git mv services dystopia
```

- [ ] **Step 2: Flux の GitOps ディレクトリを移動**

```bash
git mv clusters/production/services clusters/production/dystopia
```

- [ ] **Step 3: 移動結果を確認**

Run: `git status --short && ls dystopia/ clusters/production/dystopia/`
Expected: `dystopia/` に `README.md frontend monolith`、`clusters/production/dystopia/` に `frontend monolith` が入っている。`git status` は rename として認識されている（`R  services/... -> dystopia/...`）。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -s -m "refactor: move services/ to dystopia/

workflow-config.yaml が既に root: dystopia/{service} を宣言しているため、
ディレクトリ側を規約に合わせる。dystopia は一般ユーザー向けプロダクト、
system-components は内部向けという分類を明示する。"
```

---

### Task 2: Flux manifest のパスを更新する

**Files:**
- Modify: `clusters/production/dystopia/frontend/image-automation.yaml`
- Modify: `clusters/production/dystopia/frontend/service.yaml`
- Modify: `clusters/production/dystopia/monolith/image-automation.yaml`
- Modify: `clusters/production/dystopia/monolith/service.yaml`

**Interfaces:**
- Consumes: Task 1 が作った `dystopia/` パス
- Produces: Flux が reconcile する kustomize overlay パスが `./dystopia/{service}/kubernetes/overlays/production` になる

- [ ] **Step 1: 現在の参照を確認**

Run: `git grep -n "services/" -- clusters/`
Expected: 4件ヒットする（frontend/monolith × image-automation/service）

- [ ] **Step 2: パスを一括置換**

```bash
sed -i '' 's|\./services/|./dystopia/|g' \
  clusters/production/dystopia/frontend/image-automation.yaml \
  clusters/production/dystopia/frontend/service.yaml \
  clusters/production/dystopia/monolith/image-automation.yaml \
  clusters/production/dystopia/monolith/service.yaml
```

- [ ] **Step 3: 置換結果を確認**

Run: `git grep -n "dystopia/" -- clusters/ && git grep -n "services/" -- clusters/ || echo "OK: no services/ left"`
Expected: `dystopia/` が4件、`services/` が0件

- [ ] **Step 4: コミット**

```bash
git add clusters/
git commit -s -m "refactor(flux): point Kustomization paths at dystopia/"
```

---

### Task 3: CI workflow と release-please のパスを更新する

**Files:**
- Modify: `.github/release-please-config.json`
- Modify: `.github/release-please-manifest.json`
- Modify: `.github/workflows/auto-release--trigger.yaml:51,57`
- Modify: `.github/workflows/reusable--kubernetes-builder.yaml:17`

**Interfaces:**
- Consumes: Task 1 が作った `dystopia/` パス
- Produces: release-please が `dystopia/{monolith,frontend}` を package として認識する。`auto-release--trigger.yaml` の workspace 探索が `dystopia` を見る。

**Note:** release-please の `component` (`monolith` / `frontend`) はパス非依存なので tag 名は変わらない。`release-please-manifest.json` のキーも同時に変えることで既存バージョン (`0.2.1`) が引き継がれる。

- [ ] **Step 1: release-please-config.json のパスキーを変更**

```bash
sed -i '' 's|"services/monolith"|"dystopia/monolith"|; s|"services/frontend"|"dystopia/frontend"|' \
  .github/release-please-config.json .github/release-please-manifest.json
```

- [ ] **Step 2: 変更結果を確認**

Run: `cat .github/release-please-config.json .github/release-please-manifest.json | grep -E '"(dystopia|services|system-components)/'`
Expected: `dystopia/monolith`, `dystopia/frontend`, `system-components/holmes` が config と manifest 両方に出る。`services/` は出ない。

- [ ] **Step 3: auto-release--trigger.yaml の workspace 探索ループを変更**

`.github/workflows/auto-release--trigger.yaml` の 51 行目付近:

```yaml
          for root in services system-components; do
```

を以下に変更する:

```yaml
          for root in dystopia system-components; do
```

同ファイル 57 行目付近のエラーメッセージ:

```yaml
          echo "::error::No workspace directory found for service '$SERVICE' under services/ or system-components/"
```

を以下に変更する:

```yaml
          echo "::error::No workspace directory found for service '$SERVICE' under dystopia/ or system-components/"
```

- [ ] **Step 4: reusable--kubernetes-builder.yaml の description 例を変更**

`.github/workflows/reusable--kubernetes-builder.yaml` の 17 行目:

```yaml
        description: 'Path to kustomize overlay (e.g. services/monolith/kubernetes/overlays/develop)'
```

を以下に変更する:

```yaml
        description: 'Path to kustomize overlay (e.g. dystopia/monolith/kubernetes/overlays/develop)'
```

- [ ] **Step 5: .github/ 配下に services/ 参照が残っていないことを確認**

Run: `git grep -n "services/" -- .github/ || echo "OK: no services/ left in .github/"`
Expected: `OK: no services/ left in .github/`

- [ ] **Step 6: コミット**

```bash
git add .github/
git commit -s -m "refactor(ci): point workflows and release-please at dystopia/

release-please の component (monolith / frontend) はパス非依存のため
tag 名は変わらない。manifest のキーも同時に変えることで既存
version (0.2.1) を引き継ぐ。"
```

---

### Task 4: terragrunt の state key を更新する

**Files:**
- Modify: `dystopia/monolith/terragrunt/envs/production/terragrunt.hcl:22`
- Modify: `dystopia/monolith/terragrunt/root.hcl:35-36`
- Modify: `system-components/holmes/terragrunt/root.hcl:35-36`

**Interfaces:**
- Produces: S3 state key が `dystopia/monolith/{env}/terraform.tfstate` および `dystopia/template/{env}/terraform.tfstate`（monolith root）/ `system-components/template/{env}/terraform.tfstate`（holmes root）になる

**Note:** production account (337169763788) の state bucket には `platform/*` しか存在せず、monorepo 由来の state は未作成（VERIFIED）。したがって **state 移行操作は不要**。書き換えるだけでよい。

**Note:** holmes は `system-components/` 配下なので、その root.hcl の template key を `dystopia/` にするのは意味的に誤り。`system-components/template/` に直す。

- [ ] **Step 1: monolith の env 固有 state key を変更**

`dystopia/monolith/terragrunt/envs/production/terragrunt.hcl` の 22 行目:

```hcl
    key            = "services/monolith/${include.env.locals.environment}/terraform.tfstate"
```

を以下に変更する:

```hcl
    key            = "dystopia/monolith/${include.env.locals.environment}/terraform.tfstate"
```

- [ ] **Step 2: monolith の root.hcl template key を変更**

`dystopia/monolith/terragrunt/root.hcl` の 35-36 行目:

```hcl
    # Service-specific path: services/template/<environment>/terraform.tfstate
    key    = "services/template/${local.environment}/terraform.tfstate"
```

を以下に変更する:

```hcl
    # Service-specific path: dystopia/template/<environment>/terraform.tfstate
    key    = "dystopia/template/${local.environment}/terraform.tfstate"
```

- [ ] **Step 3: holmes の root.hcl template key を変更**

`system-components/holmes/terragrunt/root.hcl` の 35-36 行目:

```hcl
    # Service-specific path: services/template/<environment>/terraform.tfstate
    key    = "services/template/${local.environment}/terraform.tfstate"
```

を以下に変更する（holmes は system-components 配下なので dystopia ではない）:

```hcl
    # Service-specific path: system-components/template/<environment>/terraform.tfstate
    key    = "system-components/template/${local.environment}/terraform.tfstate"
```

- [ ] **Step 4: terragrunt 配下に services/ 参照が残っていないことを確認**

Run: `git grep -n "services/" -- '*/terragrunt/*' || echo "OK: no services/ left in terragrunt"`
Expected: `OK: no services/ left in terragrunt`

- [ ] **Step 5: コミット**

```bash
git add dystopia/monolith/terragrunt system-components/holmes/terragrunt
git commit -s -m "refactor(terragrunt): update state keys to match directory layout

production account の state bucket には platform/* しか存在せず
monorepo 由来の state は未作成のため、state 移行は不要。
holmes は system-components 配下なので template key も
system-components/ に揃える。"
```

---

### Task 5: ドキュメントとソースコメントを更新する

**Files:**
- Modify: `README.md:15,20,35,36,41,64,67`
- Modify: `README-ja.md:15,20,35,36,41,64,67`
- Modify: `docs/ARCHITECTURE.md:34,35`
- Modify: `docs/ドメイン/README.md:33,34`
- Modify: `docs/ドメイン/_feed.md:44,45`
- Modify: `docs/ドメイン/_identity.md:32,33`
- Modify: `docs/ドメイン/_media.md:37,38`
- Modify: `docs/ドメイン/_offer.md:32,33`
- Modify: `docs/ドメイン/_portfolio.md`
- Modify: `docs/ドメイン/_post.md`
- Modify: `docs/ドメイン/_relationship.md`
- Modify: `docs/分散システム設計/AUTHORIZATION.md`
- Modify: `dystopia/README.md`（複数箇所）
- Modify: `dystopia/monolith/workspace/README.md:148`
- Modify: `dystopia/frontend/workspace/src/lib/error-messages.ts:1`
- Modify: `dystopia/frontend/workspace/src/lib/errors.ts:1`
- Modify: `bin/codegen:5,6,24,27`
- Modify: `system-components/holmes/terragrunt/modules/main.tf:15`

**Interfaces:**
- Consumes: Task 1〜4 で確定した新しいパス

**Note:** `bin/codegen` は実際に `cd services/monolith/workspace` を実行しているスクリプトなので、コメントだけでなく **実行行の書き換えが必須**。

- [ ] **Step 1: 対象ファイルを一括置換**

`docs/superpowers/` を除いた全ファイルの `services/` を `dystopia/` に置換する。ただし `system-components/holmes/terragrunt/modules/main.tf` の `services/monolith's pattern` は `dystopia/monolith's pattern` になる（これは正しい）。

```bash
git grep -l "services/" -- . ':!docs/superpowers' ':!*node_modules*' ':!*.next*' ':!pnpm-lock.yaml' \
  | xargs sed -i '' 's|services/|dystopia/|g'
```

- [ ] **Step 2: 誤置換がないか確認**

Run: `git grep -n "dystopia/" -- . ':!docs/superpowers' ':!*node_modules*' ':!*.next*' | grep -iE "system-components|holmes" `
Expected: `system-components/holmes/terragrunt/modules/main.tf` の `mirrors dystopia/monolith's pattern` のみヒットする（これは正しい参照）。`system-components/` 自体が `dystopia/` に化けている行が **無い** こと。

- [ ] **Step 3: bin/codegen の実行行が正しいか確認**

Run: `grep -n "cd dystopia" bin/codegen`
Expected: 2行ヒット（`cd dystopia/monolith/workspace`、`cd dystopia/frontend/workspace`）

- [ ] **Step 4: 全体の残存参照を最終確認**

Run: `git grep -n "services/" -- . ':!docs/superpowers' ':!*node_modules*' ':!*.next*' ':!pnpm-lock.yaml' || echo "OK: no services/ references left"`
Expected: `OK: no services/ references left`

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -s -m "docs: update paths after services/ to dystopia/ rename"
```

---

### Task 6: 検証と PR 作成

**Files:** なし（検証のみ）

**Interfaces:**
- Consumes: Task 1〜5 の全変更

- [ ] **Step 1: kustomize build が通ることを確認**

```bash
kubectl kustomize dystopia/monolith/kubernetes/overlays/production > /dev/null && echo "monolith OK"
kubectl kustomize dystopia/frontend/kubernetes/overlays/production > /dev/null && echo "frontend OK"
kubectl kustomize system-components/holmes/kubernetes/overlays/production > /dev/null && echo "holmes OK"
```

Expected: 3つとも `OK` が出る（overlay が production を持たない service があればその行は skip してよい。存在確認は `ls` で行う）

- [ ] **Step 2: workflow-config.yaml が実体と一致していることを確認**

Run: `grep -A2 "root: dystopia" workflow-config.yaml && ls -d dystopia/*/ `
Expected: config の `root: dystopia/{service}` に対し、`dystopia/frontend/` と `dystopia/monolith/` が存在する（`dystopia/README.md` はディレクトリではないので `{service}` にマッチしない）

- [ ] **Step 3: push して Draft PR を作成**

```bash
git push -u origin HEAD
gh pr create --draft --title "refactor: rename services/ to dystopia/" --body "$(cat <<'EOF'
## Summary
- `services/` を `dystopia/` にリネームし、`workflow-config.yaml` の `root: dystopia/{service}` 規約と実体を一致させる
- `clusters/production/services/` も `clusters/production/dystopia/` に揃える
- terragrunt state key を新パスに追随（production account の state bucket に monorepo 由来の state は未作成のため移行不要）
- release-please の `component` はパス非依存のため tag 名は変わらない

## Test plan
- [ ] CI で kustomize build が通ること
- [ ] PR に deploy label が正しく付くこと（`dystopia/{service}` convention が機能する裏取り）
- [ ] merge 後、release-please が既存 version (0.2.1) を引き継ぐこと
EOF
)"
```

- [ ] **Step 4: CI の結果を確認**

Run: `gh pr checks <PR番号> --watch --interval 20`

PR 番号は以下で取得する:

```bash
gh pr list --head refactor/rename-services-to-dystopia --json number --jq '.[0].number'
```

Expected: 全 check が pass。特に `Dispatch Labels` の出力で `dystopia/{service}` が service として検出されていること。

---

## Self-Review

**1. Spec coverage:** 設計で挙げた10項目すべてにタスクが対応している。
- ディレクトリ移動 (1,2) → Task 1
- Flux manifest (3) → Task 2
- release-please (4) / workflow (5,6) → Task 3
- state key (7) → Task 4
- README / docs / ソースコメント (8,9,10) → Task 5
- 検証 → Task 6

**2. Placeholder scan:** Task 6 Step 4 の `<PR番号>` は、直前に取得コマンドを示しているので実行時に解決可能。それ以外に TBD / TODO なし。

**3. Type consistency:** パス名は全タスクで `dystopia/` に統一。holmes の state key だけ `system-components/template/` と意図的に異なるが、Task 4 Step 3 で理由を明記済み。
