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
| `services/nyx/workspace/src/**` | フロントエンド直接変更 |
| `proto/**/*.proto` | API スキーマ変更 |
| `services/monolith/workspace/slices/*/actions/**` | API レスポンス変更 |

UI 影響なしの場合: 「UI 変更が検出されませんでした」と報告して終了。

UI 影響ありの場合: ユーザーに確認 → 「UI変更を検出しました。デモ動画を生成しますか？」

### Step 2: 操作シナリオの設計

diff の内容から以下を特定:
1. **変更された画面**: `services/nyx/workspace/src/app/` のルート構造から対象ページを特定
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
  --reporter=list \
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

2. 動画ファイルを GitHub にアップロード:
```bash
# GitHub REST API でアセットをアップロード
# リポジトリのオーナーとリポジトリ名を取得
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

# アップロード用の一時 Issue コメントを作成して URL を取得
# gh api を使ってファイルをアップロード
UPLOAD_URL=$(gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" \
  --method POST \
  --field body="uploading demo..." \
  --jq '.id')

# コメント経由でアセット URL を取得後、コメントを削除
gh api "repos/${REPO}/issues/comments/${UPLOAD_URL}" --method DELETE
```

注意: `gh pr comment` はローカルファイルの直接アップロードに対応していないため、
動画ファイルは手動でPRコメントにドラッグ&ドロップするか、GitHub Web UI 経由でアップロードする。
アップロード後の URL を使って PR description を更新する。

3. PR description に Demo Video セクションを追加:
```bash
EXISTING_BODY=$(gh pr view --json body -q '.body')
gh pr edit <PR_NUMBER> --body "${EXISTING_BODY}

## Demo Video

![Demo: <変更内容の要約>](<動画 URL>)

### 操作手順
1. <手順1>
2. <手順2>
3. <手順3>"
```

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
