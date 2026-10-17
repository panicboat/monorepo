# Dystopia post screens design

## Context

[Issue #1517](https://github.com/panicboat/monorepo/issues/1517)「画面デザインの変更」への対応の第 4 段のうち、投稿まわり（4a）。4 段の stack の位置づけは [design foundation の spec](2026-10-12-dystopia-design-foundation-design.md) を参照。

第 4 段は分量が大きいため、次の 4 つの PR に分けて stack に積む。本 spec は 4a だけを扱う。

| PR | 内容 |
|---|---|
| 4a | 投稿まわり（ホーム・検索・投稿詳細・ブックマーク） |
| 4b | プロフィールまわり（プロフィール・編集・人格の追加・出勤・レビュー・フォロー一覧） |
| 4c | その他（メッセージ・通知・足跡・ランキング・設定） |
| 4d | 旧カルテ 3 表（`karte.entries`・`karte.reports`・`karte.access`）の削除 |

第 1 段で、各ページの見出し（`PageHeader`）、ルート切り替えのフェード、投稿の作成シートは入っている。投稿カードと検索は、すでにモックとほぼ同じ形である。4a の中心は、モックの「詳細は右からスライドするシートで開く」を投稿詳細に当てることである。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 第 4 段の分け方 | 4a〜4d の 4 PR に分ける | 1 PR では差分とレビュー・実機確認が大きくなりすぎる |
| 投稿詳細の開き方 | アプリ内ではシートで開き、`/posts/[id]` を直接開いたときはページで出す。中身は 1 つの部品を両方で使う | モックの「詳細は右からスライド」に合わせつつ、URL で開く経路を残す。intercepting route はこのアプリでの前例がなく、レイアウトの作りが変わる |

### Constraints

- バックエンドとの連携を壊さない。`src/app/api`・`src/stub`・`proto`・`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容も変更しない
- モックにしかない機能は追加しない。現行にしかない機能は削除しない
- 作成ボタンの花形メニューとモバイルの FAB は変更しない
- シートは第 1 段の `SideSheet` を使う

## Goals

- 投稿カードのコメントアイコンと、プロフィールの返信タブの「元の投稿」から、投稿詳細を右からのシートで開く
- ホームと検索のタブ切り替えをフェードさせる
- ホーム・検索・ブックマークの文言をモックに合わせる

## Non-goals

- 投稿カードの形の変更（モックと同じ形のため）
- 投稿の作成シート（第 1 段で対応済み）
- 4b・4c・4d の範囲
- 4a で触れないファイルの、定義のないクラスの置き換え（触れる段で直す）

## Design

### Post detail content (`src/modules/post/components/PostDetailContent.tsx`)

投稿 1 件の詳細の中身。`postId` を受け取り、`usePost` で読む。次を上から出す。

1. 投稿カード（`PostCardBinding`）。詳細の中では、本文のリンクとコメントアイコンで詳細を開き直さない
2. 「コメント（N 件）」の見出し、`CommentComposer`、`CommentList`

読み込み中は「読み込み中…」、取得に失敗したか投稿がないときは「投稿が見つかりませんでした。」を出す（現行のページの文言）。

`src/app/posts/[id]/page.tsx` はこの部品を使う形に替える。ページの見た目（`main` の幅と余白）は変えない。

### Post detail sheet (`src/modules/post/components/PostDetailSheet.tsx`)

`SideSheet` に `PostDetailContent` を載せる。見出しは「投稿の詳細」。

開く投稿は store（`src/stores/postSheetStore.ts`）で持つ。

| 状態 | 型 | 意味 |
|---|---|---|
| `postId` | `string \| null` | 開いている投稿 |
| `session` | `number` | 開くたびに増やす。シートの部品を作り直す鍵 |
| `open` | `boolean` | シートが開いているか |

`openPost(postId)` は `postId` を入れ、`session` を増やし、`open` を true にする。`close()` は `open` だけを false にする（閉じるアニメーションの間、中身を残すため）。

シートは `AppShell` のアプリ表示（ナビのある表示）に 1 つだけ置く。投稿カードはホーム・検索・ブックマーク・プロフィールの各タブなど多くの一覧に出るため、一覧ごとに持たせない。戻る操作とルートの移動で閉じるのは `SideSheet` の動きのまま。

### Opening the sheet

`PostCardBinding` のコメントアイコンは、`/posts/[id]` への `Link` のまま、修飾キーのない左クリックのときだけ遷移を止めて `openPost(post.id)` を呼ぶ。Ctrl・⌘・Shift・Alt を押したクリックと中クリックは、今までどおりリンクとして動く（新しいタブで開く等）。

投稿カードの本文（`PostCard` の詳細リンク）も同じ詳細へのリンクなので、同じ規則でシートを開く。`PostCard` に `onDetailClick` を足して本文のリンクに渡す。

`PostCardBinding` に `inDetail?: boolean` を足す。true のとき、本文の詳細リンク（`PostCard` の `detailHref`）を渡さず、コメントアイコンは詳細を開かない（押しても何もしない `span` として件数を出す）。`PostDetailContent` は `inDetail` を渡す。

`ReplyWithParentRow`（プロフィールの返信タブ）の「元の投稿」へのリンクも、同じ規則でシートを開く。

修飾キーの判定は 1 つの関数（`src/lib/utils/isPlainClick.ts`、`isPlainClick(event): boolean`）にまとめる。左ボタン（`button === 0`）で、`metaKey`・`ctrlKey`・`shiftKey`・`altKey` のどれも押していないときに true。

### Tab fade

第 1 段の `useEnterAnimation(ref, key)` を、タブの中身を包む要素に当てる。

| 画面 | 鍵 |
|---|---|
| ホーム（`src/app/page.tsx`） | 選んでいるタブ |
| 検索（`src/app/search/page.tsx`） | 選んでいるタブ（ユーザー・投稿） |

### Copy

| 画面 | 場所 | 文言 |
|---|---|---|
| ホーム | カルテタブの先頭 | 全キャスト間で共有される新着カルテ（記録中を含む）。カードから詳細を確認できます。 |
| ホーム | レビュータブの先頭 | ゲストがキャストに残した新着レビューです。 |
| 検索 | 検索欄の上の見出し（`PageHeader`） | 検索 / ユーザーや投稿を探す |
| ブックマーク | 空のときの 1 行目 | まだブックマークがありません |
| ブックマーク | 空のときの 2 行目 | 投稿のしおりアイコンから追加できます。 |

ホームの説明文は、タブの中身の先頭に `px-4 py-3 text-sm text-text-secondary` で出す。

### Undefined classes

`src/app/page.tsx` の `text-text-danger` を `text-error` に替える。

## Testing

vitest:

- `isPlainClick`: 左クリックだけが true。修飾キーと中クリックは false
- `postSheetStore`: `openPost` で `postId`・`open`・`session` が変わる。`close` は `postId` を残す
- `PostCardBinding`: コメントアイコンと本文の左クリックで `openPost` が呼ばれる。修飾キー付きでは呼ばれない。`inDetail` では本文の詳細リンクがなく、コメントアイコンが詳細を開かない
- `ReplyWithParentRow`: 「元の投稿」の左クリックで `openPost` が呼ばれる
- `PostDetailContent`: 投稿・コメント見出し・入力欄・一覧を出す。読み込み中と見つからないときの文言
- `PostDetailSheet`: store が開いているときに見出し「投稿の詳細」と中身を出す。閉じる操作で `close` が呼ばれる
- `/posts/[id]` のページ: `PostDetailContent` を出す
- ホーム・検索: タブを替えると中身の要素に `useEnterAnimation` の鍵が渡る。ホームのカルテ・レビュータブの説明文
- ブックマーク: 空のときの文言

実機（使い捨て DB、puppeteer）: ホームでコメントアイコンを押すとシートが開く。シートでコメントを書くと一覧に出る。戻る操作で閉じる。⌘ クリックではシートが開かない。`/posts/[id]` を直接開くとページで出る。プロフィールの返信タブから元の投稿をシートで開ける。
