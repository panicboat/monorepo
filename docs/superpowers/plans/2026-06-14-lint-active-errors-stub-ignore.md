# Lint: fix 2 active errors + ignore stubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `pnpm lint` の baseline 27 problems を **9 problems** (5 legacy errors + 4 残 warnings 程度) に削減する。本 PR で対処する 3 件:
1. `useMediaUpload.ts:84` の `Cannot access variable before it is declared` → 宣言順入れ替え
2. `AccountSettings.tsx:23` の `react-hooks/set-state-in-effect` → state を derived に変更 or 別パターン
3. eslint config の globalIgnores に `src/stub/**` を追加 → stub 生成ファイル 13 件の `Unused eslint-disable directive` 警告を一括撤去

**Architecture:** **Surgical**。frontend のみ、active code 2 件 + 設定 1 件、動作変更ゼロを目指す。5 legacy errors (`portfolio/useCastData.ts`, `portfolio/useGuestData.ts`, `cast/onboarding/images/route.ts`) は **A cleanup で drop されるため本 PR では touch しない**。

**Tech Stack:** Next.js 16 / React 19 / ESLint 9 + flat config / TypeScript / pnpm。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-lint-active-errors-stub-ignore`
- branch: `chore/lint-active-errors-stub-ignore` (origin/main = `bc3ed635` base)
- 検証: `pnpm exec tsc --noEmit` 緑 + `pnpm build` 緑 + `pnpm lint` の error 数が 7 → 5、warning 数が 20 → 7 程度 (合計 27 → 12 前後)
- 触らない: 5 legacy 系 (cast onboarding / portfolio cast/guest hooks)、他 component、他 module、core lib、proto stub 本体

## File Structure

- Modify: `services/frontend/workspace/src/modules/media/hooks/useMediaUpload.ts` (宣言順入れ替え)
- Modify: `services/frontend/workspace/src/modules/profile/components/AccountSettings.tsx` (cascading render 解消)
- Modify: `services/frontend/workspace/eslint.config.mjs` (globalIgnores に `src/stub/**` 追加)

---

## Task 1: `useMediaUpload.ts` 宣言順入れ替え

**Files:** Modify `services/frontend/workspace/src/modules/media/hooks/useMediaUpload.ts`。

- [ ] **Step 1: 該当 file を Read で確認**

`uploadMedia = useCallback(...)` 内部 (L84 周辺) で `registerMedia` を呼んでいるが、`registerMedia` の宣言は L98 周辺と推定。ESLint `no-use-before-define` がこの順序を error 化している。

- [ ] **Step 2: 宣言順を入れ替え**

`registerMedia = useCallback(...)` の定義を `uploadMedia = useCallback(...)` の **前**に移動する。両 callback の body は変更しない。`uploadMedia` の `useCallback(..., [])` の deps array も変更しない (もしくは `registerMedia` を deps に含める判断は別問題、本 PR は最小修正)。

**実装上の注意**:
- Hoisting 上は runtime 動作不変 (`useCallback` body は call 時に評価)、本 PR は static analysis 上の error 解消が目的
- もし `uploadMedia` の deps に `registerMedia` を入れる必要があれば別 issue (exhaustive-deps の方針)

- [ ] **Step 3: 構文 + 型チェック**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-lint-active-errors-stub-ignore/services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
```

緑必須。

---

## Task 2: `AccountSettings.tsx` の cascading render 解消

**Files:** Modify `services/frontend/workspace/src/modules/profile/components/AccountSettings.tsx`。

- [ ] **Step 1: 該当 file を Read で全体把握 (60 行程度)**

L23 で `useEffect(() => { setSaved(false); ... }, [username, profile.username])` が React Compiler 新 rule `react-hooks/set-state-in-effect` に違反。

- [ ] **Step 2: パターン選択**

以下のいずれかを採用 (実装者の判断、最も surgical なもの):

**(a) derived state パターン (推奨)**: `saved` を `useState` から外し、`const saved = !!lastSavedUsername && lastSavedUsername === username` で derive。`handleSave` で `setLastSavedUsername(username)` を呼ぶ。

```tsx
const [lastSavedUsername, setLastSavedUsername] = useState<string | null>(null);
const saved = lastSavedUsername !== null && lastSavedUsername === username;

const handleSave = async () => {
  setSaving(true);
  try {
    await save({ ...profileViewToSavePayload(profile), username });
    setLastSavedUsername(username);
  } finally {
    setSaving(false);
  }
};

// useEffect から setSaved(false) を撤去:
useEffect(() => {
  if (!username || username === profile.username) {
    setStatus(null);
    return;
  }
  const t = setTimeout(async () => {
    try {
      setStatus(await checkUsernameAvailability(username));
    } catch {
      setStatus(null);
    }
  }, 400);
  return () => clearTimeout(t);
}, [username, profile.username]);
```

**(b) event handler パターン**: `setUsername` を呼ぶ入力 handler で `setSaved(false)` を同時に呼ぶ。useEffect 内から setSaved を撤去。

**(c) eslint-disable パターン**: `// eslint-disable-next-line react-hooks/set-state-in-effect` で warn 外し。WHY コメント必須。**最終手段**、(a) / (b) を優先。

- [ ] **Step 3: 採用したパターンで実装**

`saved` が UI 上どこで使われているかを Read で確認、derived/event handler 化が壊れていないこと。動作変更ゼロを保つ。

- [ ] **Step 4: 型チェック**

```bash
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
```

緑必須。

---

## Task 3: eslint config で `src/stub/**` を ignore

**Files:** Modify `services/frontend/workspace/eslint.config.mjs`。

- [ ] **Step 1: 現状の config 確認**

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
```

- [ ] **Step 2: `src/stub/**` を ignore リストに追加**

```js
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // protoc-gen-es output: generator emits `/* eslint-disable */` which ESLint
    // 9 flags as `Unused eslint-disable directive` since none of the rules below
    // would fire on the generated code. Easiest to exclude entirely.
    "src/stub/**",
  ]),
]);
```

理由のコメントで意図を明示。

---

## Task 4: lint / build で検証 + commit

- [ ] **Step 1: `pnpm lint`**

```bash
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待: baseline (27 problems = 7 errors / 20 warnings) → **約 12 problems (5 errors / 7 warnings 程度)**。
- 5 残 errors = 5 legacy 件 (cast/onboarding、portfolio/useCastData、portfolio/useGuestData) で本 PR 範囲外
- 7 残 warnings = stub 撤去後の残 (active code の exhaustive-deps 等)

数値は実測結果を報告に含める。**新 violation を出していないこと** (= baseline からの純減または同等) が必須条件。

- [ ] **Step 2: `pnpm exec tsc --noEmit` + `pnpm build`**

両方緑必須。

- [ ] **Step 3: diff stat 確認**

```bash
/usr/bin/git diff --stat origin/main HEAD
```

期待: 3 source ファイル + plan = 4 ファイル。他に変更ゼロ。

- [ ] **Step 4: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/chore-lint-active-errors-stub-ignore
/usr/bin/git add services/frontend/workspace docs/superpowers/plans/2026-06-14-lint-active-errors-stub-ignore.md
/usr/bin/git commit -s -m "chore(frontend): fix 2 active lint errors and ignore stub directory"
```

push しない。

---

## Deferred

- 5 legacy errors (`portfolio/useCastData.ts`, `portfolio/useGuestData.ts`, `cast/onboarding/images/route.ts`) → **A cleanup で drop** (本 PR では touch しない、修正は無駄になる)
- 残 7 warnings (active code の exhaustive-deps 等) → 別 PR で取捨選別
- protoc-gen-es の `/* eslint-disable */` 出力撤去 (generator-level) → 上流 issue / option 追加が必要、ignore で対症療法

## Self-Review

- **active code 2 件の error 解消**: useMediaUpload 宣言順 + AccountSettings cascading render
- **13 stub warnings の一括撤去**: globalIgnores 追加で対症療法 (削減量大)
- **動作変更ゼロ**: 宣言順入れ替えは runtime 不変、derived state パターンは UI 表示も同等、eslint config は build/runtime 無影響
