# PR Demo Video Generator - Design Document

## Overview

PR 作成時に Claude Code が自動的にデモ動画を生成し、PR description に埋め込むワークフロー。
フロントエンドの UI 変更が含まれる PR に対して、Playwright でブラウザ録画を行い、変更内容を視覚的に確認できるようにする。

## Architecture

```
PR作成フック発火
  → diff 取得 → UI影響判定
    → 影響あり: record-demo スキル呼び出し
      → diff 分析 → 変更された画面/機能を特定
      → Playwright テストスクリプトを動的生成
      → Playwright 実行（録画ON）
      → WebM → GIF 変換
      → GitHub アセットアップロード
      → PR description に動画リンク埋め込み
```

### Components

| Component | Location | Role |
|-----------|----------|------|
| PR作成フック | `.claude/settings.json` hooks | PR 作成検知 → UI 影響判定 |
| record-demo スキル | `.claude/skills/record-demo/SKILL.md` | diff 分析→スクリプト生成→録画→GIF変換→アップロード→PR更新まで一貫 |
| Playwright 録画設定 | `test/e2e/` 既存設定を活用 | 録画用設定 |

独立したスクリプトファイルは作らず、スキルの指示に従って Claude が `npx playwright`、`ffmpeg`、`gh api` 等のコマンドを直接実行する。

## Diff Analysis & UI Impact Detection

### UI Impact Rules

以下のパスに変更がある場合、UI に影響ありと判定：

| Path Pattern | Reason |
|-------------|--------|
| `web/nyx/workspace/src/**` | フロントエンド直接変更 |
| `proto/**/*.proto` | API スキーマ変更 → UI に反映される可能性 |
| `services/monolith/workspace/slices/*/actions/**` | API レスポンス変更の可能性 |

### Screen Identification Logic

Claude が diff を読み、以下の情報を抽出：

1. **変更されたページ/コンポーネント**: `web/nyx/workspace/src/app/` 配下のルート構造から対象ページを特定
2. **変更の種類**: 新規画面追加 / 既存画面修正 / レイアウト変更 / データ表示変更
3. **操作シナリオ**: 変更に到達するために必要なユーザー操作を推定

### Decision Flow

```
diff 分析
├── UI影響なし → "UI変更なし" をログ出力して終了
├── UI影響あり（フロント変更）→ 録画シナリオ生成へ
└── UI影響あり（API/Proto変更のみ）→ 関連画面を推定して録画シナリオ生成へ
```

## Playwright Script Generation & Recording

### Script Generation

Claude が diff 分析結果を元に一時的な Playwright スクリプトを生成：

```typescript
// test/e2e/demos/temp-demo.spec.ts (例)
import { test } from '@playwright/test';

test('Demo: プロフィール編集画面の変更', async ({ page }) => {
  // 1. ログイン（既存の認証フロー）
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'email' }).fill('cast@example.com');
  await page.getByRole('textbox', { name: 'password' }).fill('0000');
  await page.getByRole('button', { name: 'ログイン' }).click();

  // 2. 変更された画面に遷移
  await page.goto('/profile/edit');
  await page.waitForLoadState('networkidle');

  // 3. 変更された機能を操作
  await page.getByRole('textbox', { name: '自己紹介' }).fill('デモテキスト');
  await page.getByRole('button', { name: '保存' }).click();

  // 4. 結果確認
  await page.waitForSelector('[data-testid="success-toast"]');
});
```

### Recording Execution

既存の `test/e2e/playwright.config.ts` を拡張せず、コマンド実行時にオプションで録画を有効化：

```bash
npx playwright test demos/temp-demo.spec.ts \
  --project=chromium \
  --headed \
  --video=on \
  --output=test-results/demos/
```

### Temporary Script Lifecycle

| Phase | Action |
|-------|--------|
| 生成 | `test/e2e/demos/temp-demo.spec.ts` に書き出し |
| 実行 | Playwright で録画付き実行 |
| 完了後 | 一時スクリプトを削除（git に含めない） |

### Recording Output

- 出力先: `test/e2e/test-results/demos/`
- 形式: WebM（Playwright デフォルト）
- 後処理: `ffmpeg` で GIF に変換

## GitHub Upload & PR Description

### GIF Conversion

```bash
ffmpeg -i test-results/demos/video.webm \
  -vf "fps=10,scale=800:-1:flags=lanczos" \
  -loop 0 \
  demo.gif
```

- FPS を 10 に落としてファイルサイズを抑制
- 幅 800px にリサイズ

### Upload Strategy

GitHub のアセットアップロード API を利用：

1. `gh issue comment` で一時コメント投稿（画像添付付き）→ 画像URLを取得
2. `gh pr edit --body` で PR description に画像URLを埋め込み
3. 一時コメントを削除

### PR Description Template

```markdown
## Demo Video

![Demo: <変更内容の要約>](<GIF URL>)

### 操作手順
1. ログイン
2. <画面>に遷移
3. <操作>を実行
4. <結果>を確認
```

## Error Handling

| Case | Action |
|------|--------|
| ローカルサーバー未起動 | `local-run.sh` を実行してサーバーを起動 |
| Playwright 未インストール | `test/e2e/` で `pnpm install` を実行 |
| ffmpeg 未インストール | WebM のまま直接アップロード（GIF変換をスキップ） |
| 録画失敗（ページエラー等） | エラー内容を分析し、スクリプトを修正して再試行 |
| GitHub アップロード失敗 | 認証エラーなら `gh auth login` を案内、それ以外はリトライ |

### Key Principles

- **動画生成は PR 作成をブロックしない** - エラーが発生しても PR 自体は正常に作成される
- **解決できる問題は Claude が自動で解決する** - サーバー起動やインストールは自動対応

### User Confirmation Points

1. 「UI変更を検出しました。デモ動画を生成しますか？」→ Yes/No
2. 録画完了後「この動画を PR に添付しますか？」→ Yes/No/再録画
