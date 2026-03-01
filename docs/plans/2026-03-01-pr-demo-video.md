# PR Demo Video Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PR 作成時に Claude Code が自動的に UI 変更のデモ動画を生成し、PR description に埋め込むワークフローを構築する。

**Architecture:** Claude Code スキル（`record-demo`）がメインロジックを担い、PostToolUse フックが PR 作成を検知してスキル呼び出しを促す。Playwright の既存 E2E 基盤（`test/e2e/`）を活用し、動的に生成したスクリプトでブラウザ録画を行う。

**Tech Stack:** Claude Code Skills/Hooks, Playwright (`test/e2e/`), ffmpeg (GIF変換), gh CLI (GitHub API)

**Design Doc:** `docs/plans/2026-03-01-pr-demo-video-design.md`

---

### Task 1: Playwright デモ用ディレクトリのセットアップ

**Files:**
- Create: `test/e2e/demos/.gitkeep`
- Modify: `test/e2e/.gitignore` (存在しない場合は作成)

**Step 1: ディレクトリ構造を確認**

Run: `ls -la test/e2e/`
Expected: 既存の `tests/`, `playwright.config.ts` 等が見える

**Step 2: demos ディレクトリを作成**

```bash
mkdir -p test/e2e/demos
touch test/e2e/demos/.gitkeep
```

**Step 3: .gitignore に一時ファイルと録画出力を追加**

`test/e2e/.gitignore` を作成（または既存に追加）:

```gitignore
# Demo recording temporary files
demos/temp-*.spec.ts

# Recording output
test-results/demos/
```

**Step 4: git status で変更を確認**

Run: `git status`
Expected: `test/e2e/demos/.gitkeep` と `test/e2e/.gitignore` が新規ファイルとして表示

**Step 5: Commit**

```bash
git add test/e2e/demos/.gitkeep test/e2e/.gitignore
git commit -m "chore(e2e): add demos directory for PR demo video recordings"
```

---

### Task 2: record-demo スキルの作成

**Files:**
- Create: `.claude/skills/record-demo/SKILL.md`

**Step 1: スキルディレクトリを作成**

```bash
mkdir -p .claude/skills/record-demo
```

**Step 2: SKILL.md を作成**

`.claude/skills/record-demo/SKILL.md`:

````markdown
---
name: record-demo
description: Use when creating PRs with UI-affecting changes to generate demo videos showing the changed functionality using Playwright browser recording
---

# Record Demo Video

## Overview

PR の diff を分析し、UI に影響する変更がある場合に Playwright でブラウザ録画を行い、デモ動画を生成する。

## When to Use

- PR 作成時に UI 変更が含まれる場合
- フック経由で自動的に呼び出された場合
- 手動で `/record-demo` を実行した場合

## Prerequisites

以下が必要。不足している場合は自動で解決する:

| Requirement | Check | Fix |
|------------|-------|-----|
| ローカルサーバー起動中 | `curl -s http://localhost:3000 > /dev/null` | `bash local-run.sh` を実行して待機 |
| Playwright インストール済み | `test/e2e/node_modules/.bin/playwright --version` | `cd test/e2e && pnpm install` |
| ffmpeg インストール済み | `which ffmpeg` | なければ WebM のままアップロード |

## Process

### Step 1: Diff 分析 & UI 影響判定

`git diff main...HEAD` の結果を分析し、以下のパスに変更があるか確認:

| Path Pattern | Impact |
|-------------|--------|
| `web/nyx/workspace/src/**` | フロントエンド直接変更 |
| `proto/**/*.proto` | API スキーマ変更 |
| `services/monolith/workspace/slices/*/actions/**` | API レスポンス変更 |

UI 影響なしの場合: 「UI 変更が検出されませんでした」と報告して終了。

UI 影響ありの場合: ユーザーに確認 → 「UI変更を検出しました。デモ動画を生成しますか？」

### Step 2: 操作シナリオの設計

diff の内容から以下を特定:
1. **変更された画面**: `web/nyx/workspace/src/app/` のルート構造から対象ページを特定
2. **必要な操作**: 変更された機能に到達するためのユーザー操作を設計
3. **確認ポイント**: 変更が視覚的にわかるポイントを特定

### Step 3: Playwright スクリプト生成

`test/e2e/demos/temp-demo.spec.ts` に一時スクリプトを生成する。

**テンプレート:**

```typescript
import { test } from '@playwright/test';

test('Demo: <変更内容の要約>', async ({ page }) => {
  // 認証が必要な場合のログインフロー
  // テストパスワードは '0000'
  // 既存のシードデータのユーザーを使用する

  // 変更された画面に遷移

  // 変更された機能を操作

  // 結果が見えるまで待機
  await page.waitForTimeout(2000);
});
```

**重要**: 既存の E2E テストパターン（`test/e2e/tests/identity/cast.spec.ts`）を参考にする:
- `page.getByRole()`, `page.getByPlaceholder()` でセレクタを書く
- `expect(page).toHaveURL()` でナビゲーションを確認
- `page.waitForLoadState('networkidle')` でページ読み込み完了を待つ

### Step 4: Playwright 録画実行

```bash
cd test/e2e && npx playwright test demos/temp-demo.spec.ts \
  --project=chromium \
  --headed \
  --video=on \
  --output=test-results/demos/
```

録画に失敗した場合:
1. エラー内容を分析
2. スクリプトを修正
3. 再試行（最大 2 回）

### Step 5: GIF 変換（ffmpeg がある場合）

```bash
ffmpeg -i test/e2e/test-results/demos/*/video.webm \
  -vf "fps=10,scale=800:-1:flags=lanczos" \
  -loop 0 \
  test/e2e/test-results/demos/demo.gif
```

ffmpeg がない場合は WebM をそのまま使用する。

### Step 6: GitHub アセットアップロード & PR Description 更新

1. PR 番号を取得:
```bash
gh pr view --json number -q '.number'
```

2. 動画をアップロード（GitHub Issue コメント経由）:
```bash
# 一時コメントで画像/動画をアップロードし、URL を取得
gh pr comment <PR_NUMBER> --body "![Demo](動画ファイルパス)"
```

3. PR description に Demo Video セクションを追加:
```bash
gh pr edit <PR_NUMBER> --body "$(既存body + Demo Video セクション)"
```

Demo Video セクションのフォーマット:
```markdown
## Demo Video

![Demo: <変更内容の要約>](<動画 URL>)

### 操作手順
1. <手順1>
2. <手順2>
3. <手順3>
```

4. 一時コメントを削除

### Step 7: クリーンアップ

```bash
rm -f test/e2e/demos/temp-demo.spec.ts
rm -rf test/e2e/test-results/demos/
```

## Error Handling

| Error | Resolution |
|-------|-----------|
| ローカルサーバー未起動 | `bash local-run.sh` を実行 |
| Playwright 未インストール | `cd test/e2e && pnpm install` |
| 録画失敗 | スクリプトを修正して再試行 |
| GitHub アップロード失敗 | ローカルに動画を残して手動アップロードを案内 |

動画生成に失敗しても PR 作成はブロックしない。
````

**Step 3: スキルが正しく認識されるか確認**

Run: `ls -la .claude/skills/record-demo/SKILL.md`
Expected: ファイルが存在する

**Step 4: Commit**

```bash
git add .claude/skills/record-demo/SKILL.md
git commit -m "feat: add record-demo skill for PR demo video generation"
```

---

### Task 3: PR 作成検知フックの設定

**Files:**
- Create: `.claude/settings.json`
- Create: `.claude/hooks/check-ui-changes.sh`

**Step 1: フックスクリプトを作成**

`.claude/hooks/check-ui-changes.sh`:

```bash
#!/bin/bash

# PostToolUse hook: PR 作成コマンドを検知して UI 変更があれば通知する
# CLAUDE_TOOL_USE_CONTENT には実行されたコマンドの内容が含まれる

TOOL_INPUT="$CLAUDE_TOOL_USE_INPUT"

# gh pr create コマンドかどうかを判定
if ! echo "$TOOL_INPUT" | grep -q "gh pr create"; then
  exit 0
fi

# main ブランチとの差分で UI 影響があるか判定
UI_CHANGES=$(git diff main...HEAD --name-only 2>/dev/null | grep -E '^(web/nyx/workspace/src/|proto/|services/monolith/workspace/slices/.*/actions/)' | head -20)

if [ -z "$UI_CHANGES" ]; then
  exit 0
fi

# UI 変更がある場合、Claude にスキル呼び出しを促す
cat << EOF
UI に影響する変更を検出しました:

$(echo "$UI_CHANGES" | sed 's/^/  - /')

record-demo スキルを使ってデモ動画を生成することを検討してください。
EOF
```

**Step 2: 実行権限を付与**

```bash
chmod +x .claude/hooks/check-ui-changes.sh
```

**Step 3: .claude/settings.json にフックを登録**

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/check-ui-changes.sh"
          }
        ]
      }
    ]
  }
}
```

**Step 4: 設定ファイルの構文チェック**

Run: `cat .claude/settings.json | python3 -m json.tool`
Expected: 整形された JSON が出力される（パースエラーなし）

**Step 5: フックスクリプトの単体テスト**

```bash
# UI 変更がない場合（空出力）
CLAUDE_TOOL_USE_INPUT="ls -la" bash .claude/hooks/check-ui-changes.sh
echo "Exit code: $?"
# Expected: Exit code: 0, 出力なし

# gh pr create コマンドだが UI 変更がない場合
CLAUDE_TOOL_USE_INPUT="gh pr create --title test" bash .claude/hooks/check-ui-changes.sh
echo "Exit code: $?"
# Expected: Exit code: 0, 変更がなければ出力なし
```

**Step 6: Commit**

```bash
git add .claude/settings.json .claude/hooks/check-ui-changes.sh
git commit -m "feat: add PostToolUse hook for PR demo video detection"
```

---

### Task 4: スキルの動作確認（手動テスト）

**Files:**
- None (verification only)

**Step 1: スキルの読み込みテスト**

Claude Code で `/record-demo` を実行して、スキルが正しく読み込まれるか確認する。

Expected: スキルの内容が Claude に提示される

**Step 2: diff 分析のドライラン**

UI 変更を含むブランチで以下を確認:

```bash
git diff main...HEAD --name-only | grep -E '^(web/nyx/workspace/src/|proto/|services/monolith/workspace/slices/.*/actions/)'
```

Expected: UI 関連のファイルがリストアップされる

**Step 3: Playwright 録画テスト**

ローカルサーバーが起動している状態で、簡単なデモスクリプトを手動で作成して実行:

`test/e2e/demos/temp-demo.spec.ts`:

```typescript
import { test } from '@playwright/test';

test('Demo: ログイン画面の表示確認', async ({ page }) => {
  await page.goto('/cast/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
});
```

```bash
cd test/e2e && npx playwright test demos/temp-demo.spec.ts \
  --project=chromium \
  --headed \
  --video=on \
  --output=test-results/demos/
```

Expected: `test/e2e/test-results/demos/` に WebM 動画ファイルが生成される

**Step 4: GIF 変換テスト**

```bash
ffmpeg -i test/e2e/test-results/demos/*/video.webm \
  -vf "fps=10,scale=800:-1:flags=lanczos" \
  -loop 0 \
  test/e2e/test-results/demos/demo.gif
```

Expected: GIF ファイルが生成される。ffmpeg がない場合はスキップ。

**Step 5: クリーンアップ**

```bash
rm -f test/e2e/demos/temp-demo.spec.ts
rm -rf test/e2e/test-results/demos/
```

---

### Task 5: GitHub アップロードの動作確認

**Files:**
- None (verification only)

**Step 1: テスト用 PR でアセットアップロードを確認**

テスト用ブランチで PR を作成し、動画アップロードの流れをテスト:

```bash
# PR の description に画像を含められるか確認
# (実際のPR作成時に統合テストとして実施)
gh pr view --json number,body -q '.number'
```

**Step 2: PR description 更新のテスト**

```bash
# 既存の PR body に Demo Video セクションを追加するテスト
EXISTING_BODY=$(gh pr view --json body -q '.body')
NEW_BODY="${EXISTING_BODY}

## Demo Video

テスト動画セクション"

gh pr edit --body "$NEW_BODY"
```

Expected: PR description が更新される

**Step 3: 不要なテストデータをクリーンアップ**

テスト用の変更を元に戻す。
