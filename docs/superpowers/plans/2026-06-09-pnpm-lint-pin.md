# Fix pnpm lint by pinning @typescript-eslint compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `services/frontend/workspace` の `pnpm lint` を機能させる。現状 `@typescript-eslint/utils@8.52.0` が ESLint 10 / TypeScript 6 の `FlatESLint` と非互換で、モジュール load 時に `Class extends value undefined` で即死する。**根因の依存ペアを特定して bump (or pin) し、lint が緑になる状態に戻す**。

**Architecture:** **Investigation + dependency adjustment**。package.json の direct/transitive dependencies を調査し、`@typescript-eslint/*` の最小限の direct pin (または `pnpm.overrides`) で ESLint 10 互換のバージョンに固定する。codebase 側の lint rule 改変はしない。

**Tech Stack:** pnpm / ESLint 10 / TypeScript 6 / @typescript-eslint / eslint-config-next 16.2.6。

**前提:** posts Q4 等 main マージ済、main HEAD は `c4935928`。現状の package.json: `"eslint": "^10.3.0"`, `"typescript": "^6.0.3"`, `"eslint-config-next": "16.2.6"`、`@typescript-eslint/*` は **direct dep に無く transitive のみ**。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-pnpm-lint-pin`。app root: `services/frontend/workspace`。branch `chore/pnpm-lint-pin` (origin/main base)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- frontend root で `pnpm install` 済の前提 (worktree 初回は `pnpm install` 必要)。
- `pnpm lint` は repo の `package.json` で `"lint": "eslint"` を呼ぶ。現状失敗ログは `Class extends value undefined is not a constructor or null at FlatESLint`。

### 現状の依存状況

```bash
cd services/frontend/workspace
/usr/bin/grep -E '"(typescript|@typescript-eslint|eslint|eslint-config-next)"' package.json
```

期待: 既知 4 行 (eslint ^10.3.0、typescript ^6.0.3、eslint-config-next 16.2.6、lint script)。`@typescript-eslint/*` は direct には無い。

```bash
pnpm list @typescript-eslint/utils @typescript-eslint/parser @typescript-eslint/eslint-plugin 2>&1 | /usr/bin/head -30
```

期待: transitive 経路 (おそらく eslint-config-next or eslint-plugin-react-hooks 経由) が見える。

## File Structure

- Modify: `services/frontend/workspace/package.json` (devDependencies に `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` を direct pin、または `pnpm.overrides` で `@typescript-eslint/utils` を固定)
- Modify: `services/frontend/workspace/pnpm-lock.yaml` (`pnpm install` 後の自動更新)

> ESLint 10 / TS 6 と互換性のある `@typescript-eslint/*` のバージョンは **v8.34.0 以降** (公式 release note によると ESLint 10 サポートは v8.x 後半で入る、要 implementer 確認)。**確証のため `pnpm view @typescript-eslint/utils versions --json | tail -30` か npm registry 確認**。

---

## Task 1: 依存調査 → 互換バージョン特定

- [ ] **Step 1: 現状の transitive 依存元を特定**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-pnpm-lint-pin/services/frontend/workspace
pnpm install 2>&1 | /usr/bin/tail -10
pnpm list @typescript-eslint/utils @typescript-eslint/parser @typescript-eslint/eslint-plugin --depth=10 2>&1 | /usr/bin/head -50
```

期待: どのパッケージから `@typescript-eslint/utils@8.52.0` が引かれているか分かる。

- [ ] **Step 2: ESLint 10 + TypeScript 6 互換の `@typescript-eslint` バージョンを確認**

```bash
pnpm view @typescript-eslint/parser versions --json 2>&1 | /usr/bin/tail -20
pnpm view @typescript-eslint/parser@latest peerDependencies 2>&1
pnpm view @typescript-eslint/parser@8.40.0 peerDependencies 2>&1
```

ESLint 10 / TS 6 を peer に受け入れる最も低いバージョン（または最新安定）を特定。**`@typescript-eslint/utils` も同バージョン**で揃える (monorepo 同期リリース)。

- [ ] **Step 3: 確認した互換バージョンを記録**

例: 「`@typescript-eslint/parser@8.40.0` 以降が ESLint 10 をサポート」。**実値は implementer が registry から確証**、推測しない。

---

## Task 2: package.json に direct pin を追加

**Files:** Modify `services/frontend/workspace/package.json`。

**選択肢 A (推奨)**: `devDependencies` に direct で追加

```json
"devDependencies": {
  ...既存...,
  "@typescript-eslint/parser": "^X.Y.Z",
  "@typescript-eslint/eslint-plugin": "^X.Y.Z"
}
```

direct dep にすれば transitive の `@typescript-eslint/utils` も自動的に互換版に dedup される。

**選択肢 B (transitive 強制 override が必要な場合)**: `pnpm.overrides` で固定

```json
"pnpm": {
  "overrides": {
    "@typescript-eslint/utils": "^X.Y.Z"
  }
}
```

選択肢 A で済めば A を採用、A でも依存解決が崩れる場合 B を併用。**A だけで決着するか、Step 3 で確認**。

- [ ] **Step 1: 編集**
- [ ] **Step 2: `pnpm install` 再実行**

```bash
pnpm install 2>&1 | /usr/bin/tail -15
```

Expected: 警告無く完了。lockfile 更新。

- [ ] **Step 3: 効果確認**

```bash
pnpm list @typescript-eslint/utils 2>&1 | /usr/bin/head -10
```

Expected: 8.52.0 ではなく互換バージョンが入ったこと。

---

## Task 3: lint 緑確認 + build/tsc 回帰

- [ ] **Step 1: `pnpm lint` 実行**

```bash
cd services/frontend/workspace
pnpm lint 2>&1 | /usr/bin/tail -30
```

Expected: モジュール load エラー解消。lint rule 違反が出るならそれは別問題 (本 PR の責任外)、しかし **「クラッシュせず lint が回る」** ことを最低限保証。lint warning / error が出た場合は数件なら別 PR で fix、大量 (50+) なら **BLOCKED** で controller に escalate (rule の strictness が変化した可能性)。

- [ ] **Step 2: 型/build 回帰**

```bash
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -15
pnpm build 2>&1 | /usr/bin/tail -20
```

Expected: 両方緑。dependency bump で型周りが壊れていないこと。

---

## Task 4: commit

- [ ] **Step 1: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

Expected: `package.json` 数行追加 + `pnpm-lock.yaml` 自動更新 + plan。**他にコード変更があれば NG**。

- [ ] **Step 2: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-pnpm-lint-pin
/usr/bin/git add services/frontend/workspace/package.json services/frontend/workspace/pnpm-lock.yaml docs/superpowers/plans/2026-06-09-pnpm-lint-pin.md
/usr/bin/git commit -s -m "chore(frontend): pin @typescript-eslint to ESLint 10-compatible version"
```

push しない。

---

## Deferred

- lint rule の strictness 調整 (本 PR で大量の rule fail が出た場合は別 PR)
- ESLint 9 → 10 マイグレーション関連の `eslint.config.mjs` 構造変更 (FlatESLint が走れば現状の config は OK のはず)

## Self-Review

- **Goal coverage**: `pnpm lint` がクラッシュせず動く状態に戻す。これが満たせれば成功。
- **Risk**: bump で lint rule が変わって既存コードが大量 violation を出す可能性 → BLOCKED で controller 判断仰ぐ。
- **追加調査余地**: bump 後の `@typescript-eslint/utils` バージョンが本当に `FlatESLint` 互換か、または別の transitive ペア (`eslint-plugin-react-hooks` 等) も同時 bump 必要かは Task 1 で確認。
