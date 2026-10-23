# Dystopia other screens design

## Context

[Issue #1517](https://github.com/panicboat/monorepo/issues/1517)「画面デザインの変更」への対応の第 4 段のうち、残りの画面（4c）。第 4 段の分け方は [post screens の spec](2026-10-16-dystopia-post-screens-design.md) を参照（4a 投稿 → 4b プロフィール → 4c その他 → 4d 旧カルテ表の削除）。

対象はメッセージ・通知・足跡・ランキング・設定。どのページもすでに見出し（`PageHeader`）を持ち、モックに近い形である。本段は、モックとの差（一覧の行の形、説明文、ブロック一覧のシート）を埋め、残っている定義のないクラスを置き換える。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| メッセージのスレッド | ページのまま見た目を合わせる | 長いやり取りを読み書きし、入力欄を下に固定して使う画面で、狭いシートより全画面が向く。通知や作成メニューからの移動（第 1 段で `replace` にした流れ）も変えずに済む |
| ブロック一覧 | 設定のプライバシータブからはシートで開き、`/settings/blocks` を直接開いたときはページで出す。中身は 1 つの部品を両方で使う | モックの「ブロックしたアカウント」のシートに合わせつつ、URL で開く経路を残す（投稿詳細と同じ作り） |

### Constraints

- バックエンドとの連携を壊さない。`src/app/api`・`src/stub`・`proto`・`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容も変更しない
- モックにしかない機能は追加しない（例: 外観の「画面のアニメーションを使う」）。現行にしかない機能は削除しない
- 作成ボタンの花形メニューとモバイルの FAB は変更しない
- シートは第 1 段の `SideSheet` を使う。シートの中からの移動は第 1 段の規則に従う

## Goals

- メッセージの一覧に「＋ 新しいメッセージ」を置き、行と、スレッドの見出し・吹き出しの見た目をモックに合わせる
- 足跡・ランキングの行と説明文をモックに合わせる
- 設定のタブ切り替えをフェードさせ、ブロック一覧をシートにする
- 残っている定義のないクラスを置き換える

## Non-goals

- 4d（旧カルテ表の削除）
- メッセージのスレッドをシートにすること
- 外観の「画面のアニメーションを使う」など、モックにしかない設定
- フォローリクエスト（`/settings/follow-requests`）とレビュー設定（`/settings/reviews`）の作り替え（モックにない。定義のないクラスの置き換えだけ行う）

## Design

### Messages

一覧（`src/app/messages/page.tsx`）:

- 見出しの下に「＋ 新しいメッセージ」を置く。押すと、作成メニューの「メッセージ」と同じ相手選びのシート（`ComposeToSheet` の `kind="message"`）を開く
- 各行: アバター、相手の表示名、最後のメッセージ（なければ「メッセージはまだありません」）、右端に「→」。行全体が今と同じスレッドへのリンク

スレッド（`src/app/messages/[id]/page.tsx`）:

- 見出しを「○○とのメッセージ」にする（○○は相手の表示名。相手が不明なら今の「チャット」）
- 吹き出しの色を、自分の発言はアクセントの面、相手の発言は `bg-surface` にする。送信・読み込みの処理は変えない

### Notifications (`src/app/notifications/page.tsx`)

変えない。今の行（アバター、名前つきの説明、時刻、未読の印、行全体のボタン）はモックの行と同じ要素を持つ。

### Footprints (`src/app/footprints/page.tsx`)

- 一覧の先頭に「最近の訪問を表示しています。足跡を残すかどうかは設定で切り替えられます。」を出す
- 各行（`FootprintRow`）は変えない。モックの「○○に訪問」は、今の相対時刻が英語の表記（`5m ago`）のため付けない

### Ranking (`src/app/ranking/page.tsx`)

各投稿カードの上に小見出し「#N · 期間の人気投稿」を出す（N は順位、期間は選んでいるタブの名前。「24h」のタブは「24時間」、それ以外はタブの名前のまま）。

### Settings

- タブ（`src/app/settings/page.tsx`）を切り替えたら、中身を `useEnterAnimation` でフェードさせる（鍵は選んでいるタブ）
- ブロック一覧: 中身を `src/modules/social/components/BlockedAccountsList.tsx` に移し、`/settings/blocks` のページと、新しい `BlockedAccountsSheet`（見出し「ブロックしたアカウント」）の両方で使う。プライバシータブ（`PrivacySettings`）の「ブロックしたアカウント」はシートを開くボタンにする
- 人格の管理（`ProfileManager`）の各行は変えない。すでにモックと同じ要素（アバター、表示名、`@username`、「使用中」、「切り替える」）を持つ

### Undefined classes

`src/app/settings/page.tsx`・`src/app/footprints/page.tsx`・`src/app/settings/reviews/page.tsx`・`src/modules/profile/components/ProfileManager.tsx` の定義のないクラス（`text-muted-foreground`・`text-text-danger` など）を、定義のあるトークン（`text-text-secondary`・`text-error` など）に替える。

## Testing

vitest:

- メッセージの一覧: 「＋ 新しいメッセージ」でメッセージの相手選びのシートが開く。行に最後のメッセージと「→」
- スレッド: 見出し「○○とのメッセージ」
- 足跡: 説明文
- ランキング: 「#1 · 1週間の人気投稿」、24h のタブで「#1 · 24時間の人気投稿」
- 設定: タブのフェードの鍵、プライバシーの「ブロックしたアカウント」でシートが開く、`/settings/blocks` のページが同じ一覧を出す

実機（使い捨て DB、puppeteer）: メッセージの一覧から新しいメッセージを始める、スレッドの見出し、足跡とランキングの表示、設定のプライバシーからブロック一覧のシートを開いて閉じる、`/settings/blocks` を直接開く。
