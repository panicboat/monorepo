# Dystopia schedule search design

## Context

#1549 は、出勤の予定からキャストを探せる画面を求めている（issue 添付のプロトタイプ `dystopia_shift_discovery_prototype.html`）。プロトタイプは、出勤日（直近 14 日）・エリア・開始時間帯・「フォロー中だけを見る」で絞り、キャストごとのカード（名前・エリア・出勤時間・ひとこと・フォロー・プロフィール）を並べる。

今は、予定はキャストのプロフィール（予定タブと今週の予定）でしか見られない。予定は鍵の有無にかかわらず誰でも見られる（鍵が制限するのは投稿だけ）。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 置き場所 | 既存の検索画面に「出勤」タブを足す（新しいナビ項目は作らない） | ユーザーの判断。人を見つける場所を 1 つにまとめる |
| 検索ボックス | 出勤タブでは名前・@username の絞り込みに使う。空なら全員 | 既存の検索ボックスをそのまま活かす |
| エリア | プロフィールの都道府県で絞る。出勤ごとの地域（新宿・池袋など）は別 issue | ユーザーの判断。ホームのエリアタブと同じ単位 |
| 出す相手 | キャストだけ。鍵付きも含める。ブロック（両方向）・停止中・無効化は除く | 予定はもともと誰でも見られる。ブロックと停止は既存の検索と同じ扱い |
| ひとこと | #1511 のお知らせ投稿があり、見る人がその投稿を見られるときだけ本文を出す | 予約中・表示終了・フォロワーのみの投稿の本文を漏らさない |
| 「最近の投稿を見る」 | 置かない | プロフィールの初期タブが投稿なので「プロフィール」と行き先が同じ |
| 名前 | 識別子・URL・RPC は schedule（`schedules`）。shift は使わない | ユーザーの判断。以前に shift から schedule へ改名済み |

## Goals

- 検索画面の「出勤」タブで、出勤日・都道府県・開始時間帯・フォロー中だけ・名前で、その日に出勤するキャストを探せる
- 結果のカードからフォローとプロフィールに進める

## Non-goals

- 出勤ごとの地域（別 issue）
- 予約の空き・受付可否
- ホームの帯・右サイドのカードなど、検索以外の入口
- 並びの変更（開始時刻順のみ）

## Rules

### Filters

| 絞り込み | 選択肢 | 初期値 |
|---|---|---|
| 出勤日 | 今日から 14 日分（日本時間） | 今日 |
| エリア | 全国、47 都道府県（`PREFECTURES`） | 全国 |
| 開始時間帯 | すべて／昼（〜17時）／夜（18〜20時）／深夜（21時〜） | すべて |
| フォロー中だけを見る | オン／オフ（オンなら承認済みでフォローしている相手だけ） | オフ |
| 名前 | 検索ボックスの文字（display_name・username の部分一致、大文字小文字を区別しない） | 空（全員） |

開始時間帯は開始時刻で決める:

- 昼: 05:00〜17:59
- 夜: 18:00〜20:59
- 深夜: 21:00〜翌 04:59（開始時刻が 21:00 以降または 05:00 より前）

### Order and paging

- 開始時刻の早い順。ただし 00:00〜04:59 の開始は 23:59 の後ろに並べる（夜の出勤の続きとして）
- 同じ開始時刻はプロフィール ID 順
- 20 件ずつ、カーソルで続きを読む

### Card

```
┌──────────────────────────────────────────┐
│ す  すず @suzu_21              📦 東京都 │
│ ┌──────────────────────────────────────┐ │
│ │ 16:00〜22:00                          │ │
│ │ 10/22（木）                           │ │
│ └──────────────────────────────────────┘ │
│ 久しぶりの出勤。よろしくお願いします。    │  ← ひとこと（あるときだけ）
│                 [＋フォロー] [プロフィール →] │
└──────────────────────────────────────────┘
```

- 出勤時間は「開始〜終了」。終了が開始以下なら終了の後ろに「翌日」
- 業種アイコンは投稿の出勤カードと同じ（`industryIcon`、読み上げ名は業種名、未設定・一覧にないときは出さない）
- フォローは既存の `FollowButton`。自分のプロフィールには出さない
- 結果の上に見出し「10/22（木）の出勤予定」を出す。件数は出さない（ページ送りなので総数が分からない）
- 結果の下の注記: 「キャストが公開した出勤予定です。予約の空きや受付可否を保証するものではありません。」
- 結果がないとき: 「この日の出勤予定はまだありません」

## Architecture

### Proto (`discovery.v1`)

```proto
rpc SearchSchedules(SearchSchedulesRequest) returns (SearchSchedulesResponse);

message SearchSchedulesRequest {
  string work_date = 1;      // YYYY-MM-DD
  string prefecture = 2;     // 空は全国
  string time_band = 3;      // "" | "day" | "evening" | "night"
  bool following_only = 4;
  string query = 5;
  int32 limit = 6;
  string cursor = 7;
}

message ScheduleSearchResult {
  schedule.v1.Schedule schedule = 1;
  profile.v1.ProfileSummary profile = 2;
  string prefecture = 3;
  string note = 4;           // 見る人に見えるお知らせ投稿の本文。なければ空
}

message SearchSchedulesResponse {
  repeated ScheduleSearchResult results = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

不正な `work_date`・`time_band` は INVALID_ARGUMENT。

### Monolith

- `Discovery::UseCases::SearchSchedules`（既存の `SearchPosts`・`SuggestUsers` と同じく、他の slice の repository / use case を組み合わせる）:
  1. 対象のプロフィール ID: profile の repository に、表示可能なキャストを都道府県・名前で絞って ID を返すメソッドを足す（`identity.accounts.role` は既存の `filter_by_role` と同じ副問い合わせ）。フォロー中だけなら social のフォロー中 ID と交わす。両方向のブロック ID を除く
  2. 予定: schedule の repository に、出勤日・開始時間帯・プロフィール ID で絞り、上の並びとカーソルで引くメソッドを足す
  3. 作者: `SummarizeProfiles`（業種を含む）。都道府県は同じ問い合わせか、ID でまとめて引く
  4. ひとこと: そのページの `post_id` をまとめて、見る人に見える投稿だけに絞って本文を引く（`ListReadablePostIds` か `FilterVisiblePosts` を通す。1 回の問い合わせ）
- discovery handler に `search_schedules`。認証は既存の検索と同じ

### Frontend

- 検索画面（`src/app/search/page.tsx`）に「出勤」タブ（id `schedules`）。URL の `?tab=schedules` で開ける
- 出勤タブの中身は `src/modules/schedule/` に部品として置く（絞り込みとカードの一覧）。検索ボックスの文字を名前の絞り込みに渡す
- BFF `GET /api/discovery/schedules`（既存の discovery の BFF route に合わせる）
- 日付チップの表示は既存の `formatDayLabel` などを使う

## Testing

monolith（rspec）:

- 出勤日・都道府県・時間帯（境目の 05:00・17:59・18:00・20:59・21:00・04:59）・フォロー中だけ・名前で絞れる
- キャストだけ。鍵付きは出る。ブロック（両方向）・停止中・無効化は出ない
- 並び: 21:00 → 23:00 → 00:30 → 04:00 の順。カーソルで重複・抜けなく送れる
- ひとこと: 見える表示中のお知らせは本文が入る。予約中・表示終了・フォロワーのみ（見る人が承認済みフォロワーでない）のお知らせは空
- 不正な `work_date`・`time_band` は INVALID_ARGUMENT

frontend（vitest、`tsc --noEmit --incremental false`）:

- 出勤タブの初期値（今日・全国・すべて・オフ）と、絞り込みを変えたときの BFF への問い合わせ
- 検索ボックスの文字が名前の絞り込みに入る。`?tab=schedules` で出勤タブが開く
- カード: 「翌日」、業種アイコン、ひとこと（あるときだけ）、自分にはフォローボタンを出さない、注記と空の表示

ローカルの実機:

- 今日の予定を入れたキャストが出勤タブに出て、時間帯・都道府県・フォロー中だけで出たり消えたりする
- お知らせ投稿のひとことがカードに出る
