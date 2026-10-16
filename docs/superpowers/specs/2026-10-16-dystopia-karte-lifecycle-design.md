# Dystopia karte lifecycle design

## Context

[Issue #1519](https://github.com/panicboat/monorepo/issues/1519)「カルテの体験を向上する」への対応の第 2 段。4 段の stack の位置づけは [design foundation の spec](2026-10-12-dystopia-design-foundation-design.md) を参照。

現行のカルテは「1 エントリ = 星（必須）+ メモ 500 字」の 1 表で、平均は全件の単純平均である。#1519 はこれを「1 回の予約から接客後までの一連のやり取り = 1 カルテ」に作り替え、段階ごとの出来事を記録し、記録中と完了の状態を持たせることを求めている。

本段は proto・DB・use case・集計を作り替え、frontend の BFF・型・hook をそれに合わせる。既存のカルテ画面は新しい形で動く最小限の改修にとどめ、見た目は第 3 段で作り直す。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 第 2 段と第 3 段の境目 | 第 2 段に frontend の最小限の追従を含め、単独で deploy できる状態にする | 各 PR を単独で壊さないため |
| 既存のカルテ | 新しい表へは移さない（旧 3 表のデータは使われなくなる） | 新しい形で必須の「対応結果」と「発生日」が既存データにない |
| 通報（`ReportEntry` と警告表示） | 削除する | #1519 は専用の通報を MVP 対象外としている |
| 記録中のカルテのホーム新着への掲載 | 載せる | 記録中も全キャストに公開される状態であり、予約段階の注意情報を早く共有できる |
| 閲覧権の表（`karte.access`） | 削除する | `GetMyAccess` は常に許可を返しており、表は使われていない。課金で絞る必要が出たら改めて設計する |
| 信頼性の集計単位 | プロフィール単位。#1519 §6.2 の「同一アカウントとして集計」は採らない | 複数プロフィールの spec の「本人以外から同一人物と分からない」を優先する。評価者の人数と各カードの作成者・星から紐付きが分かるため。代償として、同一人物が別人格で書くと最大 5 人分の重みになる |
| 星評価 | 記録中は任意、完了するときに必須（#1519 §4.3 の「未評価も許可する」から変更） | 予約段階では判断材料がないので星なしで記録を始められ、完了したカルテは必ず平均評価に寄与する |

### Constraints

- frontend と monolith は 1 つのコンテナイメージで同時に deploy される（`dystopia/lambda/README.md`）。そのため `karte.v1` をその場で作り替えても、新旧が食い違う期間はない
- proto の互換性検査（`buf breaking`）は CI で実行されていない
- 第 1 段の constraint（作成ボタンの花形メニュー、FAB、ブレークポイントを変えない）を引き継ぐ

## Goals

- 1 カルテが段階ごとの出来事を複数持ち、記録中と完了の状態を持つ
- 星評価をカルテ全体に 1 つ持ち、完了するときには必ず付いている
- ゲストの平均評価を #1519 の B 方式（作成者のプロフィール単位平均）で集計し、評価したプロフィール数と集計対象のカルテ件数を返す
- frontend の BFF・型・hook を新しい形にし、既存のカルテ画面を新しい形で動かす
- 通報と閲覧権の仕組みを取り除く

## Non-goals

- カルテ画面の新しい見た目（フィードのカード、詳細・作成・追記のシート、ゲストプロフィールの平均評価の見出し）。第 3 段で扱う
- 変更履歴、監査ログ、訂正・削除申請、AI 要約、信用ランク（#1519 §9.2 の MVP 対象外）
- ゲスト本人へのカルテ表示（#1519 では未決定）
- 一覧の絞り込み（#1519 では未決定）
- 課金による利用制限

## Domain

### Karte

1 回の予約から接客後までの一連のやり取り。

| 属性 | 内容 |
|---|---|
| 作成者 | アカウントとプロフィール。権限はアカウント単位で判定し、表示にはプロフィールを使う |
| 対象 | ゲストのプロフィール |
| 星 | 1〜5。3 が標準。記録中は未評価でもよく、完了するときは必須 |
| 状態 | 記録中（open）または完了（closed） |
| 完了日時 | 完了したときに記録し、再オープンで消す |
| 出来事 | 1 件以上 |

### Event

カルテの中の 1 つの出来事。

| 属性 | 必須 | 内容 |
|---|---|---|
| 段階 | ○ | 予約・問い合わせ（`reservation`）、接客（`service`）、接客後（`aftercare`） |
| 対応結果 | ○ | 段階ごとの固定リストから 1 つ |
| 詳細タグ | — | 段階ごとの固定リストから 0 個以上、重複なし |
| 補足 | 重大な対応結果のときだけ必須 | 500 文字まで |
| 発生日 | ○ | `YYYY-MM-DD`。日本時間の今日以前 |

同じ段階に複数の出来事を記録できる。出来事は発生日の古い順、同じ日なら作成日時の古い順に並べる。

### Outcomes and tags

#1519 §3 の候補を採用する。サーバーはコードで検証し、日本語の表示名は frontend が持つ。

予約・問い合わせ（`reservation`）の対応結果:

| コード | 表示名 | 補足 |
|---|---|---|
| `inquiry_only` | 問い合わせのみ | 任意 |
| `booked` | 予約成立 | 任意 |
| `cancelled_with_notice` | キャンセル（連絡あり） | 任意 |
| `no_show` | 無断キャンセル・来店なし | 必須 |
| `other` | その他 | 任意 |

予約・問い合わせ（`reservation`）の詳細タグ:

| コード | 表示名 |
|---|---|
| `smooth_contact` | 連絡が円滑 |
| `contact_problem` | 返信・連絡に問題あり |
| `condition_mismatch` | 予約条件の認識違い |
| `rescheduled` | 日程変更 |
| `advance_notice` | 事前連絡あり |
| `unagreed_request` | 合意していない要求あり |

接客（`service`）の対応結果:

| コード | 表示名 | 補足 |
|---|---|---|
| `completed` | 問題なく完了 | 任意 |
| `completed_with_issues` | 問題はあったが完了 | 任意 |
| `ended_early` | 途中終了 | 必須 |
| `other` | その他 | 任意 |

接客（`service`）の詳細タグ:

| コード | 表示名 |
|---|---|
| `punctual` | 時間遵守 |
| `late` | 遅刻あり |
| `payment_ok` | 支払いに問題なし |
| `payment_trouble` | 支払いトラブルあり |
| `smooth_communication` | コミュニケーションが円滑 |
| `excessive_request` | 合意条件を超える要求あり |

接客後（`aftercare`）の対応結果:

| コード | 表示名 | 補足 |
|---|---|---|
| `closed_without_issues` | 問題なく対応終了 | 任意 |
| `next_booking_inquiry` | 次回予約の相談 | 任意 |
| `inquiry_handled` | 問い合わせ対応 | 任意 |
| `trouble_occurred` | トラブル発生 | 必須 |
| `trouble_resolved` | トラブル解決 | 任意 |
| `other` | その他 | 任意 |

接客後（`aftercare`）の詳細タグ:

| コード | 表示名 |
|---|---|
| `polite_contact` | 丁寧な連絡あり |
| `excessive_contact` | 連絡が頻繁・執拗 |
| `personal_contact_request` | 個人的な連絡先の要求 |
| `condition_change_request` | 約束した条件と異なる要求 |
| `resolved` | 問題が解決した |

補足を必須にする 3 つは、#1519 の「重大なトラブルについては具体的な出来事の補足を求める」を具体化したもの。

コードの一覧は monolith（検証）と frontend（表示名）の 2 箇所に置く。どちらも本 spec の表を正とし、変更するときは両方を同時に変える。

### Lifecycle

```text
作成（記録中） ──完了する──▶ 完了
      ▲                       │
      └──────再オープン────────┘
```

| 操作 | 記録中 | 完了 |
|---|---|---|
| 出来事の追加・編集・削除 | ○ | × |
| 星の変更 | ○ | × |
| 完了する | 星があるとき ○ | — |
| 再オープン | — | ○ |
| カルテの削除 | ○ | ○ |

- 作成するときは、最初の出来事 1 件が必須。星は任意
- 完了するには星が必要。星のない記録中のカルテは完了できない
- 記録中は星を外して未評価に戻せる。再オープンしても星は残る
- 最後の 1 件の出来事は削除できない。消したい場合はカルテごと削除する
- 作成者の書き込み（星・完了・再オープン・出来事の操作）は、トランザクション内でカルテの行をロックしてから状態と出来事の件数を確かめる。同時に操作しても、最後の出来事の削除や星なしの完了が通らないようにするため
- 状態に合わない操作（完了中の追記など）は拒否する

### Permissions

| 操作 | 条件 |
|---|---|
| 閲覧（一覧・詳細・平均評価） | 閲覧者がキャスト |
| 作成 | 閲覧者がキャストで、対象がゲストのプロフィール |
| 編集・削除・完了・再オープン・出来事の操作 | 閲覧者がカルテの作成者と同じアカウント |

同じアカウントの別プロフィールからも、自分のカルテとして操作できる。どのプロフィールからでも自分の記録を読み書きできるようにするため（複数プロフィールの spec の「所有は account」と揃える）。

### Reliability summary

ゲストの信頼性（#1519 §6 の B 方式）。対象は、そのゲストのプロフィールに対する完了したカルテ。

1. 作成者のプロフィールごとに星の平均を出す
2. プロフィールごとの平均を、同じ重みで平均する

返す値:

| 値 | 内容 |
|---|---|
| 平均評価 | 上の 2 の結果。対象が 0 件なら未評価 |
| 評価したキャスト数 | 対象のカルテを書いたプロフィールの数 |
| 集計対象のカルテ件数 | 対象のカルテの件数 |

記録中のカルテは含めない。再オープンすると集計から外れ、再び完了すると最新の星で集計に戻る（集計は保存せず、読むたびに計算するため）。小数第 1 位への丸めは frontend で行う。

## Architecture

### Database

次の 2 表を作る。旧 3 表（entries・reports・access）は、この段ではアプリから参照を外すだけにし、削除は次以降の段の deploy で行う（lambda README の 2 回デプロイの規則）。旧 3 表のデータは新しい表に移さない。

`karte.kartes`:

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | 主キー（uuid v7） |
| `author_account_id` | uuid | not null |
| `author_profile_id` | uuid | not null |
| `target_profile_id` | uuid | not null |
| `rating` | smallint | null 可、`rating BETWEEN 1 AND 5`。`status = 'open' OR rating IS NOT NULL`（完了したカルテは必ず星を持つ） |
| `status` | text | not null、`status IN ('open', 'closed')` |
| `closed_at` | timestamptz | `status = 'closed'` のときだけ値を持つ（check 制約） |
| `created_at` / `updated_at` | timestamptz | not null、既定値 `now()` |

索引:

- `(target_profile_id, created_at DESC, id DESC)`: ゲスト別の一覧
- `(author_account_id, created_at DESC, id DESC)`: 自分の一覧
- `(created_at DESC, id DESC)`: 新着
- `(target_profile_id, author_profile_id) WHERE status = 'closed'`: 平均評価

`karte.events`:

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | 主キー（uuid v7） |
| `karte_id` | uuid | not null、`karte.kartes(id)` を参照、`ON DELETE CASCADE` |
| `stage` | text | not null、`stage IN ('reservation', 'service', 'aftercare')` |
| `outcome` | text | not null |
| `tags` | text[] | not null、既定値 `'{}'` |
| `note` | text | null 可 |
| `occurred_on` | date | not null |
| `created_at` / `updated_at` | timestamptz | not null、既定値 `now()` |

索引: `(karte_id, occurred_on, created_at)`。

対応結果とタグが段階ごとのリストに含まれるかは DB では検証せず、use case で検証する。リストが #1519 で「候補・未確定」であり、変更のたびに migration を要しないようにするため。

出来事を変更したときは、親カルテの `updated_at` も更新する。

### Slice structure (`dystopia/monolith/slices/karte/`)

| ファイル | 責務 |
|---|---|
| `relations/kartes.rb`, `relations/events.rb` | 表の定義 |
| `repositories/karte_repository.rb` | カルテの作成・取得・更新・削除、一覧（cursor pagination）、平均評価の集計 |
| `repositories/event_repository.rb` | 出来事の追加・更新・削除、カルテ群の出来事の一括取得 |
| `catalog.rb` | 段階ごとの対応結果・タグ・補足必須の対応結果（本 spec の表） |
| `use_cases/authorize_cast.rb` | 閲覧者がキャストかを判定する |
| `use_cases/validate_event.rb` | 出来事の入力を catalog と発生日の規則で検証する |
| `use_cases/create_karte.rb` 他 | RPC ごとの use case（下の表） |
| `presenters/karte_presenter.rb` | カルテと出来事に作成者・対象のプロフィール（ユーザー名・アバター）を付けて返す形にする |
| `grpc/karte_handler.rb` | RPC と use case の対応、エラーの変換 |

一覧の use case は、カルテ 1 ページ分の出来事を 1 回の問い合わせで読む。プロフィールはページ内でキャッシュし、同じプロフィールを繰り返し引かない。集計クエリは relation の暗黙の `ORDER BY` を外す（`.dataset.unordered`。PostgreSQL は集約と `ORDER BY` の組み合わせを拒否するため）。

削除するもの: `relations/entries.rb`・`reports.rb`・`access.rb`、`repositories/entry_repository.rb`・`report_repository.rb`・`access_repository.rb`、`use_cases` の既存 10 ファイル（`authorize_cast_access`・`create_entry`・`update_entry`・`delete_entry`・`list_entries_by_target`・`list_my_entries`・`list_recent_entries`・`report_entry`・`get_my_access`・`purge_account`）と対応する spec、`config/db/seeds/karte/access.rb`。seed の spec（`spec/config/db/seeds_spec.rb`）が数える表の一覧からも `karte__access` を外す。

`Identity::UseCases::Account::PurgeIdentity` からカルテの退会処理の呼び出しを外す。カルテ側に退会時に消すものがなくなるため。書いたカルテは現行どおり残る。

### RPC (`proto/dystopia/karte/v1/service.proto`)

`karte.v1.KarteService` をその場で作り替える。

| RPC | 入力 | 出力 |
|---|---|---|
| `CreateKarte` | 対象プロフィール、星、最初の出来事 | カルテ |
| `GetKarte` | カルテ | カルテ |
| `UpdateKarteRating` | カルテ、星（1〜5、0 は未評価に戻す） | カルテ |
| `DeleteKarte` | カルテ | なし |
| `CloseKarte` | カルテ（星が必要） | カルテ |
| `ReopenKarte` | カルテ | カルテ |
| `AddKarteEvent` | カルテ、出来事 | カルテ |
| `UpdateKarteEvent` | 出来事、出来事の内容 | カルテ |
| `DeleteKarteEvent` | 出来事 | カルテ |
| `ListKartesByTarget` | 対象プロフィール、件数、cursor | カルテの一覧、次の cursor、続きの有無、信頼性 |
| `ListMyKartes` | 件数、cursor | カルテの一覧、次の cursor、続きの有無 |
| `ListRecentKartes` | 件数、cursor | カルテの一覧、次の cursor、続きの有無 |

出来事を変える RPC がカルテ全体を返すのは、画面が段階の一覧と状態をまとめて描き直すため。

主なメッセージ:

```proto
enum KarteStatus {
  KARTE_STATUS_UNSPECIFIED = 0;
  KARTE_STATUS_OPEN = 1;
  KARTE_STATUS_CLOSED = 2;
}

enum KarteStage {
  KARTE_STAGE_UNSPECIFIED = 0;
  KARTE_STAGE_RESERVATION = 1;
  KARTE_STAGE_SERVICE = 2;
  KARTE_STAGE_AFTERCARE = 3;
}

message KarteEventInput {
  KarteStage stage = 1;
  string outcome = 2;
  repeated string tags = 3;
  string note = 4;
  string occurred_on = 5;
}

message KarteEvent {
  string id = 1;
  KarteStage stage = 2;
  string outcome = 3;
  repeated string tags = 4;
  string note = 5;
  string occurred_on = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
}

message Karte {
  string id = 1;
  string author_profile_id = 2;
  string author_username = 3;
  string author_avatar_url = 4;
  string target_profile_id = 5;
  string target_username = 6;
  string target_avatar_url = 7;
  bool is_mine = 8;
  int32 rating = 9;
  KarteStatus status = 10;
  repeated KarteEvent events = 11;
  google.protobuf.Timestamp created_at = 12;
  google.protobuf.Timestamp updated_at = 13;
  google.protobuf.Timestamp closed_at = 14;
}

message ReliabilitySummary {
  double average_rating = 1;
  int32 rater_count = 2;
  int32 karte_count = 3;
}
```

- `rating` の 0 は未評価を表す。未評価になるのは記録中のカルテだけ
- `ReliabilitySummary` は `karte_count` が 0 のとき未評価（完了したカルテがない）を表し、`average_rating` は 0 になる
- 一覧は作成日時の新しい順に並べる。追記してもカルテの位置は動かない（#1519 で一覧順序は未決定のため、現行と同じ順序を採る）
- 一覧の件数は既定 20、上限 50

エラーの変換は現行の規約に揃える。

| 状況 | gRPC コード |
|---|---|
| 閲覧者がキャストでない、作成者でない | `PERMISSION_DENIED` |
| 入力が不正、カルテ・出来事が見つからない、状態に合わない操作 | `INVALID_ARGUMENT`（理由をメッセージに入れる） |

### Frontend

**作り直すもの**（第 3 段もそのまま使う）

- BFF（`src/app/api/karte/`）: RPC ごとの route。`/api/karte/[id]/report` と `/api/karte/access` は削除する
- 型と変換（`src/modules/karte/types.ts`、`lib/mappers.ts`）: proto のカルテ・出来事・信頼性を、画面で使う形（列挙は `"open"`・`"reservation"` などの文字列）に変換する
- 選択肢（`src/modules/karte/lib/catalog.ts`、新規）: 本 spec の表のコードと表示名、補足必須の対応結果
- hook（`src/modules/karte/hooks/`）: 一覧 3 種（ゲスト別は信頼性つき）、取得、作成、星の更新、削除、完了、再オープン、出来事の追加・更新・削除

**最小限の改修にとどめるもの**（第 3 段で作り直す）

- `KarteComposer`: 段階・対応結果・タグ・補足・発生日（既定は今日）・星を入力して作成する。星は任意で初期値を持たない（選ばずに保存した 3 が平均に混ざらないようにするため）
- `KarteEntryCard`: 星（記録中は未評価を含む）、状態、最後の出来事（段階・対応結果・補足）を表示する。作成者には、完了・再オープン・削除の操作と、記録中のときの出来事の追加と星の変更を出す。星のない記録中のカルテでは、完了の前に星を選ばせる
- `KarteAggregateHeader`: 平均評価、評価したキャスト数、集計対象のカルテ件数を表示する
- 通報の UI を削除する

**キャスト判定への置き換え**

閲覧権の hook（`useMyKarteAccess`）と `GetMyAccess` の呼び出しをなくし、`useAuthStore` の役割が `cast` かどうかで出し分ける。対象はナビ（`resolveNavItems`・`SideNav`・`Drawer`・`BottomTab`）、作成メニュー（`resolveComposeKinds`・`ComposeLauncher`）、ホームのカルテタブ、ゲストのプロフィールのカルテタブ、自分のカルテの画面。自分のカルテの画面の「有料機能です」の案内は、「カルテはキャストだけが使えます」に置き換える。

proto のスタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、`karte` package の差分だけを commit する。両コマンドは関係のない package のスタブにも差分を出すため。

## Testing

monolith（rspec）:

- 出来事の検証: 段階ごとの対応結果とタグ、重複タグ、補足の必須と 500 文字、発生日の形式と日本時間の今日以前
- 星の検証: 作成時と変更時は 0〜5（0 は未評価）、未評価への変更は記録中だけ、星のないカルテは完了できない、完了中のカルテの星は常に 1〜5（DB の check 制約を含む）
- 状態遷移: 記録中だけ追記・編集・星の変更ができる、完了と再オープン、最後の出来事は削除できない、削除は状態によらずできる
- 権限: キャストでない閲覧者、作成者でないアカウント、同じアカウントの別プロフィール、ゲストでない対象
- 信頼性: B 方式の計算（プロフィールごとに平均し、1 プロフィールが多数書いても重みが等しい。同じアカウントの 2 プロフィールは別の評価者として数える）、記録中の除外、再オープンでの除外と再完了での復帰、0 件
- 一覧: 3 種の並び順と cursor、出来事を全件含む、出来事を 1 回で読む
- handler: 各 RPC の正常系と、権限・入力エラーのコード
- migration 後の表の制約（`rating`・`status`・`closed_at`・完了時の星・`stage`）
- 退会処理がカルテに触れないこと

frontend（vitest、`tsc --noEmit`）:

- 変換: proto の列挙、未評価（`rating` 0）、空の信頼性
- BFF の各 route がリクエストを正しい RPC に渡す
- 選択肢の表が本 spec と一致する（コードの一覧を monolith の catalog と照合するテストは置かず、本 spec を正とする）
- キャスト判定への置き換え後も、ナビ・作成メニュー・タブの出し分けが役割どおりになる
- 改修した 3 つの部品の表示と操作

ローカルの実機（monolith + frontend）で次を確認する。

- キャストでカルテを作成し、出来事を追記し、完了すると、ゲストのプロフィールの平均評価に反映される
- 再オープンすると平均評価から外れ、再び完了すると戻る
- 記録中のカルテがホームの新着に出る
- ゲストではカルテの入口が出ない

連携の確認として、第 1 段の constraint に加え、`proto` と `dystopia/monolith` の変更が `karte` に閉じていること（退会処理の 1 箇所と seed・migration を除く）を `git diff --stat` で確かめる。
