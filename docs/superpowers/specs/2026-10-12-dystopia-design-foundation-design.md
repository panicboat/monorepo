# Dystopia design foundation design

## Context

[Issue #1517](https://github.com/panicboat/monorepo/issues/1517)「画面デザインの変更」と [Issue #1519](https://github.com/panicboat/monorepo/issues/1519)「カルテの体験を向上する」への対応の第 1 段。

#1517 は添付モック（`dystopia_city_motion_ux_v2.html`）の見た目と動きを、機能を保ったまま frontend に反映することを求めている。#1519 はカルテを「1 回の予約〜接客後 = 1 カルテ」の構造に作り替えることを求めており、その画面は #1517 のサイドシートを前提にしている。

2 つの issue は互いに依存するため、次の 4 段に分けて 1 列の stack として進める。本 spec は第 1 段だけを扱う。

| 段 | 内容 | issue |
|---|---|---|
| 1 | デザイン土台（トークン・動きの部品・共有部品・シェル） | #1517 |
| 2 | カルテのバックエンド（proto・DB・use case・集計） | #1519 |
| 3 | カルテの画面 | #1519 |
| 4 | 残り画面への展開 | #1517 |

### Constraints

- バックエンドとの連携を壊さない。本段は `dystopia/frontend/src/app/api`、`dystopia/frontend/src/stub`、`proto`、`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容も変更しない
- モックにしかない機能は追加しない。現行にしかない機能は削除しない
- 作成ボタンは現行の花形メニュー（`FlowerMenu`）を維持する。モバイルの FAB は見た目も含めて変更しない

### Mock motion rules

モックが定める動きのルールは次の 2 つで、本段はこの 2 つを部品として提供する。

- 作成・編集・詳細は、右からスライドするサイドシートで開く
- ナビゲーションとタブ切り替えは、控えめなフェードで切り替える

## Goals

- ダークテーマの配色をモックの値にする
- 右から入るシート `SideSheet` と、ルート変更時のフェードを提供する
- 共有部品（`Button`・`Tabs`・`PageHeader`・入力系・`Toggle`・`RatingStars`・トースト）とシェルの見た目をモックに合わせる
- 作成ボタンから開く 2 つのモーダルを `SideSheet` に載せ替える

## Non-goals

- 各ページ内部のレイアウト変更（フィードのカード、プロフィール、設定、メッセージ）。第 4 段で扱う。色はトークン経由で本段から変わる
- チップ、タグ選択、星入力、出来事タイムライン。最初の利用者であるカルテ画面（第 3 段）で作る
- `SideSheet` の下部固定フッター、`Button` の控えめ・危険の variant。最初の利用者が現れる段で追加する
- タブ切り替え時のフェードの各ページへの適用。第 3 段・第 4 段で各ページに適用する
- 投稿詳細（`/posts/[id]`）とメッセージスレッド（`/messages/[id]`）をシートにするかの判断。第 4 段で決める
- プロフィール編集モーダル（`EditProfileModal`・`ProfileManager`）と投稿カード内のダイアログの載せ替え。第 4 段で扱う
- 機能ツアー（`FeatureTourModal`）。中央モーダルのまま維持する
- PWA のアイコンと `public/logo.svg`。ロゴは独自の配色を持ち、ブランドトークンに依存しない
- 定義のないクラス（`text-muted-foreground` など 14 ファイル）の置き換え。カルテ分は第 3 段、それ以外は第 4 段で扱う

## Architecture

### Approach

既存のセマンティックトークンの値を差し替え、共有部品とシェルを作り直す。画面側のクラス名は変えない。

モックの CSS（`.btn`、`.feed-entry` など）をそのまま持ち込む案は採らない。Tailwind との二重管理になり、ダーク専用の色が直書きで残るため。

### Design tokens (`dystopia/frontend/src/app/globals.css`)

ダークテーマ（`:root`）の値を次のとおりにする。

| トークン | 値 | モックでの用途 |
|---|---|---|
| `--color-backdrop`（新規） | `#090a0e` | カラムの背後、右ペイン |
| `--color-bg` | `#13151b` | 中央カラム、サイドナビ、モバイルのヘッダーと下部ナビ |
| `--color-bg-elevated`（新規） | `#181a21` | シート、トースト |
| `--color-surface` | `#1b1e27` | カード |
| `--color-bg-secondary` | `#20232b` | ホバー面 |
| `--color-input-bg` | `#2b2c30` | 入力欄 |
| `--color-border` | `#303744` | 枠線 |
| `--color-divider` | `#28313e` | 一覧の罫線 |
| `--color-text-primary` | `#f6f4f8` | 本文 |
| `--color-text-secondary` | `#a4b1c5` | 補助テキスト |
| `--color-text-muted` | `#8390a5` | 注記 |
| `--color-brand-primary` | `#b54bf1` | アクセント |
| `--color-brand-secondary` | `#e344ae` | タブの下線 |
| `--color-brand-gradient-from`（新規） | `#a345ed` | グラデーションの始点 |
| `--color-brand-gradient-to`（新規） | `#e448a8` | グラデーションの終点 |
| `--color-rating`（新規） | `#eab270` | 星 |

- `--gradient-brand-2` は `linear-gradient(110deg, var(--color-brand-gradient-from), var(--color-brand-gradient-to))` にする
- `--shadow-brand-glow` は `0 7px 21px rgb(168 44 146 / 0.27)` にする
- `--color-accent` は `--color-brand-primary` を指したままにする
- モックの `#111318`（サイドナビ）と `#15171d`（タブ列・下部ナビ）は `#13151b` との差が各チャンネル 3 階調以内なので、`--color-bg` に統合する
- `--color-brand-tertiary` と `--gradient-brand-3`（`.bg-gradient-brand-3` を含む）は利用箇所がないので削除する
- ダークの値を直接書くことで参照がなくなる neutral スケールの段（600・700・800・950）を削除する。ライトテーマが参照する段は残す
- 追加するトークンは `@theme inline` にも登録し、`bg-backdrop`・`bg-bg-elevated`・`text-rating` として使えるようにする

ライトテーマ（`[data-theme="light"]`）は現行の値を維持し、追加トークンだけ次の値を与える。

| トークン | 値 |
|---|---|
| `--color-backdrop` | `var(--color-neutral-50)` |
| `--color-bg-elevated` | `#ffffff` |
| `--color-rating` | `var(--color-warning)` |

ブランド色はテーマ共通にする。新旧のコントラスト比は次のとおりで、可読性は変わらない。

| 色 | ダーク背景（`#13151b`） | ライト背景（`#ffffff`） |
|---|---|---|
| primary 旧 `#a855f7` | 4.61 | 3.96 |
| primary 新 `#b54bf1` | 4.55 | 4.01 |
| secondary 旧 `#ec4899` | 5.17 | 3.53 |
| secondary 新 `#e344ae` | 4.96 | 3.68 |

動きのトークンを追加する。

| トークン | 値 |
|---|---|
| `--duration-slide` | `330ms` |
| `--duration-fade` | `200ms` |
| `--duration-quick` | `170ms` |
| `--ease-emphasized` | `cubic-bezier(.22, 1, .36, 1)` |

`@media (prefers-reduced-motion: reduce)` では 3 つの duration を `0ms` にする。

`dystopia/frontend/src/app/layout.tsx` の `viewport.themeColor` のダーク値を `#13151b` にする。モバイルのヘッダーの面と同じ色にして、ステータスバーとの境目をなくすため。

### SideSheet (`dystopia/frontend/src/components/ui/side-sheet.tsx`)

右から入るシート。既存モーダルと同じ `@radix-ui/react-dialog` を土台にし、フォーカスの閉じ込め・Esc・`aria-modal` を引き継ぐ。

```tsx
interface SideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onBack?: () => void;
  stepKey?: string;
  children: React.ReactNode;
}
```

- 幅は `min(100%, 510px)`。幅 510px 以下の画面では全幅になる。`md` 未満では左の枠線を持たない
- ヘッダーは左から「戻るボタン（`onBack` を渡したときだけ表示）」「タイトル」「閉じるボタン」を並べる。本文はシート内でスクロールする
- 面は `bg-bg-elevated`、背後のオーバーレイは黒の 70%
- 開閉は CSS アニメーションで行う。シートは `translateX(103%)` から `0` へ `--duration-slide` と `--ease-emphasized` で動き、オーバーレイは `--duration-fade` でフェードする。Radix は `data-state` の CSS アニメーションの終了を待ってから unmount するので、閉じる動きも再生される
- `stepKey` が変わると、本文に「不透明度 `.4` → `1`、X 方向 `13px` → `0`、`--duration-fade`」の動きをかける。宛先選択から入力への切り替えで使う
- 閉じたとき、開く前にフォーカスがあった要素へフォーカスを戻す。Radix の Dialog は `Dialog.Trigger` を使わない場合フォーカスを戻さないので、`onOpenAutoFocus` で開く前の要素を控え、`onCloseAutoFocus` で戻す
- 開いている間にルート（`usePathname`）が変わったら、`onOpenChange(false)` を呼んで閉じる。シートは開いたページに属するため
- 利用側は `SideSheet` を mount したまま `open` を切り替える。閉じると同時に unmount すると、閉じる動きが再生されない
- 同時に開くシートは 1 枚とする

### Back dismissal (`dystopia/frontend/src/components/ui/useBackDismiss.ts`)

`md` 未満ではシートが全幅になり画面のように見えるため、ブラウザの「戻る」でシートが閉じるようにする。`SideSheet` が内部で使う。

- 開いたとき、同じ URL のまま履歴エントリを 1 つ積み、`history.state` にシートの印を付ける
- `popstate` を受けたら `onOpenChange(false)` を呼ぶ
- ×・Esc・オーバーレイ・呼び出し側の操作で閉じたとき（`open` が `false` になったとき）、現在の履歴エントリがシートの印を持っていれば `history.back()` で取り除く
- 履歴エントリを積むのは 1 回の「開く」につき 1 回とする。effect の再実行（React の StrictMode）で 2 つ積まない
- 開いたまま unmount されたときは履歴を操作しない。effect の cleanup で `history.back()` を呼ぶと、StrictMode の再実行で開いた直後に閉じてしまうため
- シートが複数段（`stepKey`）を持っていても、ブラウザの「戻る」はシート全体を閉じる。段を戻るのはヘッダーの戻るボタンだけとする

Next.js の App Router は `window.history.pushState` を差し替え、内部状態を保ったまま独自の `state` を載せられるようにしている（16.3.7 の `dist/client/components/app-router.js` の `copyNextJsInternalHistoryState` で確認）。

シートの中からルート遷移する場合、遷移は `router.replace` で行い、シートは自分では閉じない。シートの履歴エントリが遷移先に置き換わり、ルートの変化を受けて `SideSheet` が閉じる。遷移先で「戻る」を押すと元のページに戻る。

遷移と「閉じる」の順序をこの形に固定する理由は次のとおり。

- `router.push` で遷移すると、シートのエントリが元のページと同じ URL のまま履歴に残り、「戻る」を 1 回余分に押す必要が生じる
- 遷移を始めた直後に利用側がシートを閉じると、Next.js が履歴を書き換える前に `history.back()` が走り、`replace` が元のページのエントリを置き換えてしまう。Next.js は履歴の書き換えを、新しい `pathname` を反映する commit の `useInsertionEffect` で行う（16.3.7 の `HistoryUpdater` で確認）ので、`pathname` の変化を見て閉じれば、書き換えは必ず先に済んでいる

本段でこの条件に当たるのは、作成メニューの「メッセージ」で宛先を選んだときだけである。`useStartChat` の `start` に遷移方法を選ぶ引数を足し、遷移先のパスを返すようにする。シートから呼ぶときは `replace` を指定する。リクエスト内容は変えない。`StartChatButton` からの呼び出しは `push` のままにする。

遷移先が現在のページと同じとき（すでに開いているスレッドの相手を選んだとき）はルートが変わらないので、利用側が `start` の返すパスと現在のパスを比べ、同じならシートを閉じる。

### Route fade (`dystopia/frontend/src/lib/motion/useEnterAnimation.ts`)

ルート変更時に、`AppShell` の `<main>` へ「不透明度 `.55` → `1`、Y 方向 `5px` → `0`、`--duration-fade`」の動きをかける。

- 要素を再マウントしない。`/messages` の layout は `MessagingPollingProvider` を保持しており、`key` による再マウントでは polling の状態が失われるため
- `useEnterAnimation(ref, key)` は `key` が変わるたびに Web Animations API（`element.animate`）で動きを再生する。初回の描画では再生しない
- 長さは要素の `--duration-fade` を読んで決める。`0ms` のときは再生しない。これにより動き軽減の設定が CSS の 1 箇所で効く

`dystopia/frontend/src/lib/motion/` の既存ファイル（`variants.ts`・`hooks.ts`）は利用箇所がないので削除する。これにより `motion` パッケージの import がなくなるので、`package.json` から `motion` を削除する。

### Shared components (`dystopia/frontend/src/components/ui/`)

API（props）は変えず、見た目だけを変える。文字サイズは rem で指定する（11px は `0.6875rem`、15px は `0.9375rem`、21px は `1.3125rem`）。px で指定すると、ブラウザの文字サイズ設定を上げても拡大されないため。

| 部品 | 変更 |
|---|---|
| `Button` | `primary` はグラデーションと新しいグロー。`secondary` はモックの既定ボタン（枠線はアクセント色の 50%、面はアクセント色の 10%、文字は `text-text-primary`、ピル形、太字） |
| `Tabs` | 余白 `14px 17px`、太字。選択中は `text-text-primary` と `--color-brand-secondary` の 2px 下線。列の面は `bg-bg`。モックと同じくスクロールバーを表示しない |
| `PageHeader` | 見出し 21px・太字、説明 12px。読み込んでいるフォントの太さは 400・500・700 なので、800 は指定しない |
| `Input`・`Textarea`・`Select` | 角丸 12px、高さ 44px 以上、フォーカスで枠線がアクセント色 |
| `Toggle` | 44×26px、オンはアクセント色、オフは枠線の色（`bg-border`）。`--color-bg-secondary` ではカードの面と区別できないため |
| `RatingStars` | 塗りの色を `text-warning` から `text-rating` にする |
| `ToastHost` | 面 `bg-bg-elevated`、アクセント色の枠線、角丸 12px。`md` 未満では下部ナビの上に出す |

### Shell (`dystopia/frontend/src/components/shell/`)

| 部品 | 変更 |
|---|---|
| `AppShell` | 最外の面を `bg-backdrop` にする。コンテナの最大幅 1400px。`<main>` は `bg-bg` で、`xl` 以上では幅 620px に固定し（伸びない）、`md`〜`xl` では残り幅を埋める。`<main>` に `useEnterAnimation` を適用する |
| `SideNav` | 幅 266px、面 `bg-bg`、右に罫線。項目は高さ 51px・角丸 10px・16px。選択中とホバーは `text-text-primary` と `bg-bg-secondary`、選択中のアイコンはアクセント色 |
| `TopBar` | 高さ 62px、面 `bg-bg`、下に罫線 |
| `BottomTab` | ラベル 11px、選択中はアクセント色、面 `bg-bg`、上に罫線。ページが `viewport-fit=cover` を宣言していないので、下端の safe area の余白は持たない |
| `SuggestedUsersPane` | `xl` 以上で残り幅を埋める（最小 185px）。カードは角丸 17px・枠線つき |

次のものは変更しない。

- 花形メニューの動作（PC・モバイル）とモバイルの FAB の見た目
- ドロワーとそのスワイプ操作
- プロフィール切り替え、未読バッジ、`resolveNavItems` によるナビ項目の出し分け
- `BottomTab` の配置方法（`sticky`）と `resolveShellLayout` によるメッセージスレッドの高さ制御
- ブレークポイント（`md`・`xl`）。モックの 720px・1150px には合わせない

PC のサイドナビの作成ボタンは、動作は花形メニューのまま、文言を「投稿する」から「作成する」にする。このボタンは投稿・メッセージ・カルテ（またはレビュー）を選ぶ入口であるため。

### Compose sheets

作成ボタンから開く 2 つのモーダルを `SideSheet` に載せ替える。中身のフォームと API 呼び出しは変えない。

| 現行 | 載せ替え後 |
|---|---|
| `modules/post/components/PostComposerModal.tsx` | `PostComposerSheet.tsx` |
| `components/compose/ComposeToDialog.tsx` | `ComposeToSheet.tsx` |

- `ComposeToSheet` は宛先選択と入力の 2 段を持つ。段を `stepKey` に、宛先の選び直しを `onBack` に渡す
- 「メッセージ」で宛先を選んだときは、`useStartChat` を `replace` で呼ぶ。シートはルートの変化で閉じる
- 宛先を選んでからルートが変わるまで、宛先リストは操作できず、閉じる要求（×・Esc・オーバーレイ）も受け付けない。この間に閉じると、遷移が置き換えるはずの履歴エントリが先に取り除かれるため。スレッドの作成に失敗したときは、操作と閉じる要求を再び受け付ける
- `ComposeLauncher` は選ばれた種類を保持したまま `open` だけを切り替え、閉じる動きの間もシートの中身を保つ。開くたびに `ComposeToSheet` を作り直し、前回の宛先とエラーを持ち越さない

### Deliberate differences from the mock

| モック | 本段 | 理由 |
|---|---|---|
| PC の作成はリスト型ポップオーバー | 花形メニュー | issue #1517 の指定 |
| モバイルのヘッダーのアバターは設定へ移動 | ドロワーを開く | ドロワーは現行機能であり、足跡・ブックマーク・ランキングへの入口を担う |
| ダークのみ | ライトも維持 | テーマ切り替えは現行機能 |
| システムフォント | Noto Sans JP | モックのフォント指定にも含まれており、現行の表示を保つ |
| 720px・1150px のブレークポイント | `md`・`xl` | 既存画面のレイアウトが Tailwind のブレークポイントに依存している |
| フォーカスは `#e39fff` の outline | アクセント色の ring | 既存部品のフォーカス表示を保つ |

## Known limitations

- シートを開いたまま再読み込みすると、印の付いた履歴エントリが持ち主なしで残り、そのページを離れるのに「戻る」が 1 回余分に要る
- 宛先を選んでからルートが変わるまでの間にブラウザの「戻る」を押すと、遷移が元のページのエントリを置き換える。スレッドから「戻る」と元のページを飛ばす
- シートを閉じたあとのフォーカスは、花形メニューから開いた場合、非表示の花弁に戻る。花形メニューを変更しない本段では扱わない
- `stepKey` が変わると本文を作り直すので、段をまたいで入力を保つフォームでは入力が消える。そのようなフォームを載せる段で、本文を保ったまま動きだけを再生する形に変える

## Testing

単体テスト（vitest）で次を確認する。

- `SideSheet`: `open` で表示される。×・Esc・オーバーレイで `onOpenChange(false)` が呼ばれる。`onBack` を渡したときだけ戻るボタンが出る。閉じたあとフォーカスが開く前の要素に戻る。ルートが変わると `onOpenChange(false)` が呼ばれる
- `useBackDismiss`: 開くと履歴エントリが 1 つ増え、URL は変わらない。StrictMode でも 1 つだけ増える。`popstate` で閉じる。UI で閉じると履歴エントリが取り除かれる。現在のエントリがシートの印を持たないときは `history.back()` を呼ばない
- `useEnterAnimation`: `key` が変わると `element.animate` が呼ばれる。初回と `--duration-fade` が `0ms` のときは呼ばれない
- `ComposeToSheet`: 載せ替え前のテストが同じ振る舞いで通る。「メッセージ」の宛先選択は `replace` で遷移し、ルートが変わると閉じ、遷移先が現在のページならその場で閉じる
- `PostComposerSheet`: 投稿すると `/api/posts` へ載せ替え前と同じリクエストを送り、閉じる
- `ComposeLauncher`: 載せ替え前のテストが通る。閉じたあともシートを mount したままにする
- `useStartChat`: 引数なしでは `push`、`replace` 指定では `replace` で遷移し、どちらも遷移先のパスを返す
- 既存のシェルのテスト（`AppShell`・`SideNav`・`BottomTab`・`Drawer`）が通る

静的検査として `tsc --noEmit` と `next build` が通ることを確認する。

ローカルで monolith と frontend を起動し、次を実機で確認する。

- 幅 1440px・1024px・390px のそれぞれで、ダークとライトのホーム・プロフィール・設定・自分のカルテ・メッセージスレッドが崩れていない
- 作成メニューから投稿・メッセージ・カルテ（ゲストではレビュー）のシートが右から入り、×・Esc・オーバーレイ・ブラウザの「戻る」で閉じる
- ブラウザの「戻る」でシートを閉じたとき、ページが再読み込みされず、スクロール位置が保たれる
- 作成メニューからメッセージを始め、スレッドで「戻る」を 1 回押すと元のページに戻る
- 投稿の作成、メッセージの開始、カルテの作成が載せ替え前と同じく成功する
- OS の動き軽減を有効にすると、シートとフェードが動きなしで切り替わる

連携を壊していないことは、`origin/main` との差分が `dystopia/frontend/src/app/api`・`dystopia/frontend/src/stub`・`proto`・`dystopia/monolith` に及んでいないことで確認する。
