# Dystopia review lifecycle design

## Context

[Issue #1520](https://github.com/panicboat/monorepo/issues/1520)「レビューの体験を向上する」は、名前を「クチコミ」にし、あとはカルテを踏襲することを求めている。

現行のレビューは「1 件 = 星 + 本文」で、ゲストが書き、キャストが受け、全員が読める。キャストは 1 件ずつ非表示にでき、`reviews_visible` で公開そのものをやめられる。画面は #1546 でカルテと同じ「要約のカード + 詳細シート」の作りになっている。

カルテ（[karte lifecycle の spec](2026-10-16-dystopia-karte-lifecycle-design.md)、[karte screens の spec](2026-10-16-dystopia-karte-screens-design.md)）は「1 回の予約〜接客後 = 1 カルテ」で、段階ごとの出来事、記録中と完了の状態、書いた人ごとの平均評価を持つ。本 spec はクチコミをこの構造に作り替える。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 踏襲する範囲 | 構造をすべて踏襲する（段階・対応結果・タグ・補足・発生日、記録中と完了、完了時の星必須、書いた人ごとの平均） | ユーザーの判断 |
| カルテとの共通化 | backend・domain の部品は複製してクチコミ専用に持つ。意味を持たない UI（星のボタン列・切り替わるチップ・状態の印の見た目）だけを `components/ui` に切り出す | カルテはキャスト同士で支え合うコア機能、クチコミはメモであり、似て非なるもの。共通部品にすると、変わる理由の違う 2 つの変更が互いを巻き込み、コア機能への回帰の危険が増える |
| 既存のレビュー | 新しい表へ移さない。旧表は参照を外したあと drop する | 新しい形で必須の段階・対応結果・発生日が既存データにない（カルテと同じ判断） |
| 記録中のクチコミ | 公開する | ユーザーの判断。カルテと同じ |
| キャストによる 1 件ずつの非表示 | 廃止する | ユーザーの判断 |
| キャストによる公開の停止（`reviews_visible`） | 廃止する | ユーザーの判断 |
| ブロック・鍵付き・停止中の当事者の扱い | 今の判定を残す | SNS としての安全のための仕組みで、クチコミ固有の非表示機能ではない |
| 集計の単位 | 書いた人のプロフィール単位（カルテの B 方式） | カルテと同じ。複数プロフィールの spec の「本人以外から同一人物と分からない」を優先する |
| コード上の名前 | `review` のまま。画面の文言だけ「クチコミ」にする | review は英語でクチコミにあたる。URL（`/reviews`）も変えない |

### Constraints

- frontend と monolith は 1 つのコンテナイメージで同時に deploy される（`dystopia/lambda/README.md`）。`review.v1` をその場で作り替えても、新旧が食い違う期間はない
- migration はアプリの入れ替え前に流れる。旧表の drop は、参照を外す deploy の次の deploy で行う（lambda README の 2 回デプロイの規則）
- 作成ボタンの花形メニュー、FAB、ブレークポイントは変えない（design foundation の spec から引き継ぐ）

## Goals

- 1 件のクチコミが段階ごとの出来事を複数持ち、記録中と完了の状態を持つ
- 星をクチコミ全体に 1 つ持ち、完了するときには必ず付いている
- キャストの平均評価を B 方式で集計し、評価した人数と集計対象の件数を返す
- 画面の「レビュー」を「クチコミ」にする
- 非表示と `reviews_visible` を取り除く

## Non-goals

- カルテとの統合（同じ表・同じ slice・同じ画面部品）
- 一覧の絞り込み
- 変更履歴・監査ログ・通報
- 課金による利用制限

## Domain

### Review

ゲストがキャストを 1 回利用した流れ（予約・問い合わせ → 利用 → 利用後）。

| 属性 | 内容 |
|---|---|
| 書き手 | ゲストのアカウントとプロフィール。権限はアカウントで判定し、表示にはプロフィールを使う |
| 対象 | キャストのプロフィール |
| 星 | 1〜5。3 が標準。記録中は未評価でもよく、完了するときは必須 |
| 状態 | 記録中（open）または完了（closed） |
| 完了日時 | 完了したときに記録し、再オープンで消す |
| 出来事 | 1 件以上 |

### Event

属性はカルテの出来事と同じ（段階・対応結果・詳細タグ・補足・発生日）。補足は 500 文字まで、補足必須の対応結果でだけ必須。発生日は `YYYY-MM-DD` で日本時間の今日以前。出来事は発生日の古い順、同じ日なら作成日時の古い順に並べる。

### Outcomes and tags

サーバーはコードで検証し、日本語の表示名は frontend が持つ。どちらも本 spec の表を正とし、変更するときは両方を同時に変える。候補は未確定として扱い、DB では検証しない（変更のたびに migration を要しないため）。

予約・問い合わせ（`reservation`）の対応結果:

| コード | 表示名 | 補足 |
|---|---|---|
| `inquiry_only` | 問い合わせのみ | 任意 |
| `booked` | 予約成立 | 任意 |
| `cancelled_by_cast` | キャストからキャンセル（連絡あり） | 任意 |
| `cast_no_show` | キャストの無断キャンセル・不在 | 必須 |
| `other` | その他 | 任意 |

予約・問い合わせ（`reservation`）の詳細タグ:

| コード | 表示名 |
|---|---|
| `quick_reply` | 返信が早い |
| `slow_reply` | 返信が遅い・途絶えた |
| `clear_conditions` | 料金・条件の説明が明確 |
| `condition_mismatch` | 予約条件の認識違い |
| `rescheduled` | 日程変更あり |
| `polite_response` | 対応が丁寧 |

利用（`service`）の対応結果:

| コード | 表示名 | 補足 |
|---|---|---|
| `satisfied` | 満足して終了 | 任意 |
| `completed_with_issues` | 不満はあったが終了 | 任意 |
| `ended_early` | 途中で終了 | 必須 |
| `other` | その他 | 任意 |

利用（`service`）の詳細タグ:

| コード | 表示名 |
|---|---|
| `punctual` | 時間どおり |
| `late` | 遅刻あり |
| `as_pictured` | 写真・プロフィールどおり |
| `not_as_pictured` | 写真・プロフィールと違う |
| `attentive` | 接客が丁寧 |
| `unagreed_charge` | 合意していない料金・要求あり |

利用後（`aftercare`）の対応結果:

| コード | 表示名 | 補足 |
|---|---|---|
| `closed_without_issues` | 問題なく終了 | 任意 |
| `next_booking_inquiry` | 次回予約の相談 | 任意 |
| `inquiry_handled` | 問い合わせ対応 | 任意 |
| `trouble_occurred` | トラブル発生 | 必須 |
| `trouble_resolved` | トラブル解決 | 任意 |
| `other` | その他 | 任意 |

利用後（`aftercare`）の詳細タグ:

| コード | 表示名 |
|---|---|
| `polite_contact` | 丁寧な連絡あり |
| `excessive_contact` | 連絡が頻繁・執拗 |
| `condition_change_request` | 約束と異なる要求 |
| `resolved` | 問題が解決した |

段階の表示名は「予約・問い合わせ」「利用」「利用後」。

### Lifecycle

カルテと同じ。

| 操作 | 記録中 | 完了 |
|---|---|---|
| 出来事の追加・編集・削除 | ○ | × |
| 星の変更 | ○ | × |
| 完了する | 星があるとき ○ | — |
| 再オープン | — | ○ |
| クチコミの削除 | ○ | ○ |

- 作成するときは最初の出来事 1 件が必須。星は任意
- 記録中は星を外して未評価に戻せる。再オープンしても星は残る
- 最後の 1 件の出来事は削除できない
- 書き手の書き込みは、transaction 内でクチコミの行をロックしてから状態と出来事の件数を確かめる
- 状態に合わない操作は拒否する

### Permissions

| 操作 | 条件 |
|---|---|
| 作成 | 閲覧者がゲストで、対象がキャストのプロフィール。自分のアカウントのプロフィールは対象にできない（現行と同じ） |
| 編集・削除・完了・再オープン・出来事の操作 | 閲覧者がクチコミの書き手と同じアカウント（同じアカウントの別プロフィールからでも可） |
| 閲覧（一覧・詳細・平均評価） | ログインしている全員 |

### Visibility

一覧と詳細には、次の条件をすべて満たすクチコミだけを出す。閲覧者がページの持ち主（キャスト別ならそのキャスト、書き手別ならそのゲスト）のときは、1 を除いて判定しない。

1. 書き手と対象のどちらも、停止中のプロフィール（`disabled_at`）や無効化されたアカウント（`deactivated_at`）ではない（`Profile::Slice["use_cases.list_visible_profile_ids"]`）
2. 閲覧者がページの持ち主のコンテンツを見られる（ブロックと、鍵付きプロフィールのフォロー状態。`Social::Slice["use_cases.filter_visible_posts"]`）
3. 閲覧者と、もう一方の当事者がブロック関係にない（`Review::Adapters::BlockAdapter`）

新着の一覧と 1 件取得（`GetReview`）は、1 と 3 を各クチコミの書き手と対象の両方に当てはめ、2 は対象のキャストについて判定する。ただし書き手と同じアカウントの閲覧者と、対象のキャスト本人には、1 件取得で 1 だけを当てはめる。自分の一覧（`ListMyReviews`）は持ち主本人の閲覧として扱い、1 だけを当てはめる。書き手別の一覧では、閲覧者が持ち主本人でなければ 2 を対象のキャストにも当てはめ、一覧に出るクチコミを 1 件取得でも開けるようにする。

記録中のクチコミも公開する。今の判定から、非表示（`hidden`）と `reviews_visible` の 2 つを外す。

停止中・無効化された当事者の扱いは、存在しないプロフィールと同じにする（現行と同じ）。ページの持ち主がそうであれば一覧は空にし、1 件取得と書き手の操作（星・完了・再オープン・削除・出来事の操作）は「見つからない」（`Review not found`）で拒否する。

### Rating summary

キャストの評価（カルテの B 方式）。対象は、そのキャストのプロフィールに対する完了したクチコミ。

1. 書き手のプロフィールごとに星の平均を出す
2. プロフィールごとの平均を、同じ重みで平均する

| 値 | 内容 |
|---|---|
| 平均評価 | 上の 2 の結果。対象が 0 件なら未評価 |
| 評価した人数 | 対象のクチコミを書いたプロフィールの数 |
| 集計対象の件数 | 対象のクチコミの件数 |

記録中は含めない。集計は保存せず、読むたびに計算する。公開のルール（Visibility）は集計には当てはめず、全員に同じ数字を出す。小数第 1 位への丸めは frontend で行う。

### Profile purge

プロフィールを削除したときは、そのプロフィールが書いたクチコミと受けたクチコミを消す（現行と同じ。カルテは残す方針であり、ここは異なる）。出来事は `ON DELETE CASCADE` で消える。

## Architecture

### Stack

#1553 の上に 3 段を積む。

| 段 | 内容 |
|---|---|
| 1 | 意味を持たない UI 部品の切り出し。カルテは import 先を差し替えるだけで、振る舞いを変えない |
| 2 | クチコミの作り替え（migration・proto・slice・BFF・hook・画面・名称・settings の削除）。アプリから旧表への参照を外す |
| 3 | 旧表（`review.entries`・`review.cast_settings`）の drop |

### Shared UI (stage 1)

`components/ui` に次を置く。どれもドメインの文言と判定を持たない。

| 部品 | 内容 | 元 |
|---|---|---|
| `StarRatingInput` | ★ のボタン 5 つ。読み上げ名「N つ星」、選んでいる星までを塗り、選んでいる星をもう一度押すと `null` に戻す | `KarteRatingInput` |
| `ToggleChip` | `aria-pressed` で選ぶ・外すが切り替わるボタン | `KarteEventForm` の `chipClass` とボタン |
| `StatusBadge` | 状態の印の見た目（警告色・緑の 2 種）。文言は呼び出し側が渡す | `KarteStatusBadge` |

カルテの `KarteRatingInput`・`KarteStatusBadge` は削除し、呼び出し側を新しい部品に替える。カルテの既存テストを回帰の確認に使い、新しい部品にはそれぞれ単体テストを置く。

### Database (stage 2)

`review.reviews`:

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | 主キー（uuid v7） |
| `author_account_id` | uuid | not null |
| `author_profile_id` | uuid | not null |
| `target_profile_id` | uuid | not null |
| `rating` | smallint | null 可、`rating BETWEEN 1 AND 5`。`status = 'open' OR rating IS NOT NULL` |
| `status` | text | not null、`status IN ('open', 'closed')` |
| `closed_at` | timestamptz | `status = 'closed'` のときだけ値を持つ（check 制約） |
| `last_activity_at` | timestamptz | not null、既定値 `now()` |
| `last_occurred_on` | date | not null |
| `created_at` / `updated_at` | timestamptz | not null、既定値 `now()` |

索引:

- `(target_profile_id, last_activity_at DESC, id DESC)`: キャスト別の一覧
- `(author_profile_id, last_activity_at DESC, id DESC)`: 書き手別の一覧
- `(author_account_id, last_activity_at DESC, id DESC)`: 自分の一覧
- `(last_occurred_on DESC, created_at DESC, id DESC)`: 新着
- `(target_profile_id, author_profile_id) WHERE status = 'closed'`: 平均評価

`review.events`: 列・制約・索引はカルテの `karte.events` と同じ（`review_id` が `review.reviews(id)` を参照し、`ON DELETE CASCADE`）。

`last_activity_at` と `last_occurred_on` の更新規則はカルテと同じ（作成・出来事の追加・完了・再オープンで `last_activity_at` を更新し、出来事の追加・編集・削除で `last_occurred_on` を発生日の最大値にする）。新しい表なので、カルテの migration のような既存行の埋め戻しはない。

### Slice structure (`dystopia/monolith/slices/review/`)

カルテと同じ構成で、クチコミ専用に書く。

| ファイル | 責務 |
|---|---|
| `relations/reviews.rb`, `relations/events.rb` | 表の定義 |
| `repositories/review_repository.rb` | 作成・取得・更新・削除、一覧（cursor）、平均評価の集計、件数、プロフィール削除時の削除 |
| `repositories/event_repository.rb` | 出来事の追加・更新・削除、クチコミ群の出来事の一括取得 |
| `catalog.rb` | 本 spec の対応結果・タグ・補足必須 |
| `use_cases/authorize_guest.rb` | 閲覧者がゲストかを判定する |
| `use_cases/validate_event.rb` | 出来事の入力を catalog と発生日の規則で検証する |
| `use_cases/load_own_review.rb` | 行をロックして読み、書き手のアカウントかを確かめる |
| `use_cases/filter_visible_reviews.rb` | Visibility の判定 |
| `use_cases/page_reviews.rb`, `use_cases/present_reviews.rb` | 一覧のページングと、プロフィール（表示名・ユーザー名・アバター）を付けた返す形 |
| `use_cases/*` | RPC ごとの use case |
| `grpc/review_handler.rb` | RPC と use case の対応、エラーの変換 |

集計クエリは relation の暗黙の `ORDER BY` を外す（`.dataset.unordered`）。一覧はページ内の出来事を 1 回の問い合わせで読む。

削除するもの: `relations/entries.rb`・`cast_settings.rb`、`repositories/entry_repository.rb`・`cast_settings_repository.rb`、`use_cases` の `create_entry`・`update_entry`・`delete_entry`・`hide_entry`・`unhide_entry`・`list_entries_by_author`・`list_entries_by_target`・`list_recent_entries`・`filter_visible_entries`・`entry_parties_visible`・`get_my_settings`・`update_my_settings`、それぞれの spec。

`bin/grpc` の Gruf handler の登録が新しい handler を指すことを、plan のチェック項目に入れる（カルテの実装時に登録漏れが起きている）。

### RPC (`proto/dystopia/review/v1/service.proto`)

`review.v1.ReviewService` をその場で作り替える。

| RPC | 入力 | 出力 |
|---|---|---|
| `CreateReview` | 対象プロフィール、星、最初の出来事 | クチコミ |
| `GetReview` | クチコミ | クチコミ |
| `UpdateReviewRating` | クチコミ、星（1〜5、0 は未評価に戻す） | クチコミ |
| `DeleteReview` | クチコミ | なし |
| `CloseReview` | クチコミ（星が必要） | クチコミ |
| `ReopenReview` | クチコミ | クチコミ |
| `AddReviewEvent` | クチコミ、出来事 | クチコミ |
| `UpdateReviewEvent` | 出来事、出来事の内容 | クチコミ |
| `DeleteReviewEvent` | 出来事 | クチコミ |
| `ListReviewsByTarget` | 対象プロフィール、件数、cursor | 一覧、次の cursor、続きの有無、評価の要約 |
| `ListReviewsByAuthor` | 書き手のプロフィール、件数、cursor | 一覧、次の cursor、続きの有無 |
| `ListMyReviews` | 件数、cursor | 一覧、次の cursor、続きの有無、件数 |
| `ListRecentReviews` | 件数、cursor | 一覧、次の cursor、続きの有無 |

メッセージはカルテと同じ形にする（`ReviewStatus`・`ReviewStage`・`ReviewEventInput`・`ReviewEvent`・`Review`・`RatingSummary`・`ReviewCounts`）。`Review` は書き手と対象の `profile_id`・`username`・`display_name`・`avatar_url`、`is_mine`、`rating`（0 は未評価）、`status`、`events`、`created_at`・`updated_at`・`closed_at`・`last_activity_at` を持つ。`ReviewCounts` は `total_count`・`open_count`・`closed_count`（`open` は Ruby の protobuf で `Kernel#open` と衝突しうるため避ける）で、cursor のない最初のページでだけ数える。

並び順: キャスト別・書き手別・自分の一覧は `last_activity_at` の新しい順、新着は `last_occurred_on`・`created_at` の新しい順。件数は既定 20、上限 50。

エラーの変換はカルテと同じ（閲覧者がゲストでない・書き手でないときは `PERMISSION_DENIED`、入力が不正・見つからない・状態に合わないときは `INVALID_ARGUMENT`）。

proto のスタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、`review` package の差分だけを commit する。

### Frontend (stage 2)

**名称**: 画面に出る「レビュー」をすべて「クチコミ」にする。対象はナビ（`resolveNavItems`・`BottomTab`）、作成メニュー（`compose-icons`・`ComposeToSheet`・`resolveRecipientSource`）、ホームのタブ（`app/page.tsx`）、プロフィールのタブ（`app/u/[username]/page.tsx`）、`/reviews/my`、`LandingGuestSections`、`FeatureTourModal`、`ProfileManager` の削除の注意書き。

**BFF**（`src/app/api/review/`）: RPC ごとの route に作り替える（カルテの `src/app/api/karte/` と同じ形）。`[id]/hide`・`[id]/unhide`・`settings` は削除する。

**`modules/review/`**:

| 部品 | 内容 |
|---|---|
| `types.ts`, `lib/mappers.ts` | proto を画面の形（列挙は `"open"`・`"reservation"` などの文字列）に変換する |
| `lib/catalog.ts` | 本 spec の表示名と補足必須の判定 |
| `lib/revalidate.ts` | 表示中の一覧と詳細を取り直すための登録（カルテと同じ形） |
| hooks | 一覧 4 種（キャスト別は評価の要約付き、自分の一覧は件数付き）、1 件取得、作成、星の更新、削除、完了、再オープン、出来事の追加・更新・削除 |
| `ReviewCard` | 小見出し「クチコミ / ゲストからキャストへ」、書き手のアイコン・表示名と最後の動きの相対時刻、押せる枠（キャストの表示名と `@username`、星または「未評価」、最新の出来事 1 行、状態の印、最新の出来事のタグ 2 つまで）、枠の外に「キャストのプロフィールを見る →」（キャストのプロフィールの中では出さない） |
| `ReviewDetailSheet` | 見出し「クチコミの詳細」。「クチコミ / 記録中」または「クチコミ / 完了」、キャストと書き手、大きな星と状態の印と一言（記録中「記録中のため平均評価には含まれません」、完了「完了済みの評価は平均に反映されます」）、「予約から利用後までの記録」。書き手の操作とトーストはカルテと同じ形で、文言の「カルテ」を「クチコミ」にする |
| `ReviewEventForm` | `ActingProfileLabel`、キャストの小さなカード（「`@username` · 全員に公開」）、段階（「予約・問い合わせ」「利用」「利用後」）、対応結果、詳細タグ（`ToggleChip`）、補足、発生日、作成のときだけ星（`StarRatingInput`、初期値なし、一言「3.0 が標準。評価はクチコミ全体につき 1 つです。星は完了するときに必要です」） |
| `ReviewSummaryHeader` | 平均の大きな数字（なければ「—」）と ★（なければ「未評価」）、「利用の満足度（参考評価）」と「N人が評価 · M件の完了済みクチコミ」 |

**画面**:

| 画面 | 内容 |
|---|---|
| キャストのプロフィールの「クチコミ」タブ | `ReviewSummaryHeader` とカード。カードがなければ「クチコミはまだありません」。ゲストが見ているときは一番下に「このキャストのクチコミを書く」（キャストを選び済みの作成シート） |
| ゲストのプロフィールの「クチコミ」タブ | そのゲストが書いたクチコミのカード |
| `/reviews/my` | 見出し「自分のクチコミ」、「＋ クチコミを作成」、件数の欄（自分のクチコミ・記録中・完了。同じアカウントのすべてのプロフィールで書いたもの）、カード。ゲストでない閲覧者には「クチコミはゲストだけが書けます」 |
| ホームの「クチコミ」タブ | 新着のカード |
| 作成メニュー | 今の `ComposeToSheet` のまま（キャストを選ぶ → `ReviewEventForm`） |

**削除するもの**: `/settings/reviews` と `useReviewSettings`、`useHideReview`・`useUnhideReview`、旧 `ReviewComposer`・`ReviewList`・`ReviewsTab` の旧実装と、それぞれのテスト。

### Database drop (stage 3)

`review.entries` と `review.cast_settings` を drop する。seed や spec が数える表の一覧からも外す。

## Testing

monolith（rspec、`dystopia/monolith` でローカル実行）:

- 出来事の検証: 段階ごとの対応結果とタグ、重複タグ、補足の必須と 500 文字、発生日の形式と日本時間の今日以前
- 星の検証: 0〜5（0 は未評価）、未評価への変更は記録中だけ、星のないクチコミは完了できない、DB の check 制約
- 状態遷移: 記録中だけ追記・編集・星の変更、完了と再オープン、最後の出来事は削除できない、削除は状態によらずできる
- 権限: ゲストでない閲覧者の作成、書き手でないアカウント、同じアカウントの別プロフィール、キャストでない対象
- Visibility: ブロック（ページの持ち主・もう一方の当事者）、鍵付きのページ、停止中のプロフィール・無効化されたアカウント、持ち主本人の閲覧、記録中も出ること
- 平均評価: B 方式の計算、記録中の除外、再オープンでの除外と再完了での復帰、0 件、Visibility が集計に影響しないこと
- 一覧: 4 種の並び順と cursor、出来事を全件含む、自分の一覧の件数
- handler: 各 RPC の正常系と、権限・入力エラーのコード
- プロフィール削除: 書いた・受けたクチコミと出来事が消える
- stage 3: 旧表がないこと

frontend（vitest、`tsc --noEmit`）:

- stage 1: 新しい UI 部品の単体テストと、カルテの既存テスト
- 変換（列挙・未評価・空の要約）、BFF の各 route が正しい RPC に渡すこと、catalog が本 spec と一致すること
- 部品の表示と操作（カード・詳細シート・フォーム・要約の見出し・自分のクチコミ）
- 名称: 対象の画面に「レビュー」が残っていないこと

ローカルの実機（monolith + frontend、使い捨て DB）:

- ゲストでクチコミを作成し、追記して完了すると、キャストのプロフィールの平均に反映される
- 再オープンすると平均から外れ、再び完了すると戻る
- 記録中のクチコミがホームとプロフィールに出る
- キャストではクチコミの作成の入口が出ない
- `/settings/reviews` がなくなっている
