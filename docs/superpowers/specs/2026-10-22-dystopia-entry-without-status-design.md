# Dystopia karte and review without status design

## Context

カルテとクチコミは「記録中（open）」と「完了（closed）」の状態を持つ（`2026-10-16-dystopia-karte-lifecycle-design.md`、`2026-10-17-dystopia-review-lifecycle-design.md`）。完了したものだけが平均評価に入り、完了するには星が必要である。

この作りでは、作成画面で星を付けて保存しても記録中になり、詳細を開き直して「完了する」を押さないと平均に入らない（#1582）。押し忘れると、星を付けたのに平均に入らない状態が残る。

状態を持つ理由は「判断材料のない段階の星を平均に入れない」ことだった。星は記録中のあいだ任意なので、「星が付いたら平均に入る」とすれば、同じ目的を完了の操作なしで満たせる。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 状態 | 記録中・完了の状態をなくす | ユーザーの判断。完了の操作と完了忘れをなくす |
| 平均評価に入る条件 | 星が付いていること | 星を付けることが完了の代わりになる |
| 自分の一覧の件数 | 「合計」と「未評価」 | ユーザーの判断。未評価は平均に入っていない件数で、星の付け忘れに気づける |
| 今のデータ | 状態の違いを捨てる。記録中で星付きのものは平均に入るようになる | 本番前の段階であり、移行の手間より最終形のきれいさを優先する |

### Constraints

- frontend と monolith は 1 つのコンテナイメージで同時に deploy される。proto はその場で作り替える
- proto のスタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、変更した package（`karte.v1`、`review.v1`）の差分だけを commit する

## Goals

- カルテ・クチコミに完了・再オープンの操作がない
- 星が付いたものだけが平均評価に入り、星を外すと外れる
- 星・出来事の追記・編集・削除が、いつでもできる
- 自分の一覧に「合計」と「未評価」の件数が出る

## Non-goals

- 星の付け忘れの通知
- 平均評価の計算方法（作成者ごとの平均の平均）の変更

## Rules

| 操作 | 条件 |
|---|---|
| 作成 | 星は任意。出来事 1 件が必要（今のまま） |
| 星を付ける・変える・外す | 作成者ならいつでも |
| 出来事の追記・編集・削除 | 作成者ならいつでも。最後の 1 件を削除すると本体も削除する（#1584 のまま） |
| 本体の削除 | 作成者ならいつでも（今のまま） |

平均評価は、対象のプロフィールに付いた星付きのカルテ（クチコミ）で計算する。計算方法（作成者ごとの平均を出し、その平均を取る）は変えない。

## Architecture

カルテとクチコミは同じ形に変える。以下はカルテで書き、クチコミも `review` に読み替えて同じに変える。

### Database

新しい migration で次を行う。

- `karte.kartes`: 制約 `status_value`・`closed_at_matches_status`・`closed_karte_rated` を外し、列 `status`・`closed_at` を削除する
- 索引 `idx_karte_kartes_reliability` を `WHERE rating IS NOT NULL` で作り直す
- `review.reviews` も同じ（制約 `closed_review_rated` など、索引 `idx_review_reviews_summary`）

### Monolith (`dystopia/monolith/slices/karte/`)

- 削除: `use_cases/close_karte.rb`、`use_cases/reopen_karte.rb`、repository の `close`・`reopen`、handler の `close_karte`・`reopen_karte`、`load_own_karte` の `require_open`、relation の `status`・`closed_at`
- `repositories/karte_repository.rb`
  - `reliability`: `status: "closed"` を `rating IS NOT NULL` に替える
  - `counts_by_author`: `{ total:, unrated: }` を返す
- `use_cases/present_kartes.rb`: `status`・`closed_at` を出さない
- 出来事の追記・編集と星の変更は、状態を確かめない（`require_open` をなくす）
- クチコミの `list_my_reviews.rb` は、件数を `parties_and_statuses_by_account` から数えている。これを星の有無で数える形に変える（見えない相手のものを除く今の絞り込みは保つ）

### Proto (`proto/dystopia/karte/v1/service.proto`)

- 削除: `enum KarteStatus`、`Karte.status`、`Karte.closed_at`、`rpc CloseKarte`・`rpc ReopenKarte` とその message
- `KarteCounts` を `{ int32 total_count = 1; int32 unrated_count = 2; }` にする
- `review.v1` も同じ

### Frontend

- 削除: 完了・再オープンの BFF route（`/api/karte/[id]/close`・`/reopen`）、mutation の `close`・`reopen`、型と mapper の `status`・`closedAt`、`KarteStatus`
- 詳細シート
  - 「完了する」「再オープン」と状態の印をなくす
  - 星の下の説明を「星を付けると平均評価に反映されます」（未評価）／「平均評価に反映されています」（星あり）にする
  - 見出しの「KARTE / 記録中」を「KARTE」にする
  - 出来事の「編集」と「＋ 段階を追記する」は、作成者なら常に出す
- カード: 状態の印をなくす。星か「未評価」は今のまま出す
- 作成ボタン: 「カルテを作成」（クチコミは「クチコミを作成」）
- 出来事のフォームの星の説明から、完了に触れる文をなくす
- 信頼性の見出し: 「N件の評価済みカルテ」（クチコミは「N件の評価済みクチコミ」）
- 自分の一覧の件数: 「合計」「未評価」

## Testing

monolith（rspec、`dystopia/monolith` でローカル実行）:

- 星付きだけが平均に入り、星を外すと外れる
- 星・出来事の操作が状態に関係なくできる
- 自分の件数が合計と未評価を返す
- 完了・再オープンの RPC がない

frontend（vitest、`tsc --noEmit`）:

- 詳細シートに完了・再オープンがなく、星の有無で説明が変わる
- 自分の一覧の件数が「合計」「未評価」
- カードに状態の印がない

ローカルの実機（monolith + frontend、使い捨て DB）:

- 星を付けて作成したカルテが、すぐ相手の平均評価に入る
- 星なしで作成したカルテは平均に入らず、自分の一覧の未評価に数えられる。星を付けると平均に入る
