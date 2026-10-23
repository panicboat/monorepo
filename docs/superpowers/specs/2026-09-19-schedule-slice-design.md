# Schedule Slice Design — cast attendance broadcast

Date: 2026-09-19
Status: Design spec (implementation-ready)
Scope: キャストが自分の出勤予定を発信する新規 `schedule` スライス。Issue #1166（キャストプロフィールの充実）のうち、参考プロダクト h-sns.net の「出勤スケジュール」セクションに相当する部分。
Related: `2026-05-31-domain-context-map-design.md`（keystone。§Amendment で本specとの関係を追記）、`2026-06-02-profile-slice-design.md`（プロフィール本体。本specは profile を拡張せず独立スライスとする）

## Grounding

参考にした一次情報:
- h-sns.net のプロフィール画面（headless capture で確認）: プロフィールヘッダー直下・投稿一覧より上に常時表示される「出勤スケジュール」セクション。直近数日を `9/18(金) 15:00-22:00` / `9/19(土) -` の形式でリスト表示し、「もっと見る」で展開
- Issue #1166 の走り書き（構成要素の参考のみ。フィールド仕様は流用しない）
- 本リポジトリの過去実装: `dystopia/monolith/config/db/migrate/20260216000000_move_plans_schedules_to_offer.rb` で `offer.schedules` が存在した実績、`20260619010000_drop_offer_schedules.rb` のコメントで「offerスライス撤去に伴い書き手を失ったため削除」と明記

## Goal

キャストが「この日は何時から出ます」を自分で発信できるようにする。ゲストは読むだけ。**予約（booking）ではない** — 空き時間帯の管理、成約、決済は一切扱わない。過去に存在した `offer.schedules`（商取引次元と結合していた）とは異なり、商取引色を排した情報発信機能として再設計する。

## Why a separate slice (not an extension of `profile`)

- `profile` は 2026-06-02 の spec で「エスコート商取引次元を撤去」した経緯があり、出勤という概念を再度背負わせると同じ混同を繰り返す
- 将来 booking を実装する際、booking は schedule を読むだけの一方向の依存にしたい。profile に同居させると profile ⇄ booking の結合が生まれやすい
- 匿名読み取り（プロフィール閲覧）と本人限定書き込み（自分の出勤登録）という権限の非対称性が `profile` の既存パターン（本人のみ編集）と同じだが、ドメイン概念としては別物

## Domain model

`schedule.schedules` — 出勤する日の行のみを保持する。休みの日は行を作らない（不在 = 休み、と表示側で解釈する）。

| フィールド | 型 | 備考 |
|---|---|---|
| account_id | UUID | identity.Account 参照。所有者 |
| work_date | date | 出勤日 |
| start_time | text | "20:00" 形式 |
| end_time | text | "02:00" 形式。日またぎ許容のため time ではなく text |
| created_at / updated_at | time | |

- 一意制約: `(account_id, work_date)`
- 空き時間帯・場所/店舗情報は持たない（Dropped section 参照）
- 過去日の行は削除せず残す（閲覧側は今日以降のみ表示する想定。削除ポリシーは実装時に決めてよい）

### Dropped（意図的に含めない）

- 空き時間帯（Issue走り書きの「空き 22:00 / 24:30」相当）: 予約可能枠を意味し booking 次元に属する
- 場所/店舗情報: dystopia は個人主体で店舗情報を重視しない方針（プロフィール側でも同様の判断）
- 曜日ベースの繰り返しテンプレート（旧 `default_schedules` 相当）: 日付ごとの個別登録のみとし、繰り返し設定は今回スコープ外

## API contract — `proto/schedule/v1`

`ScheduleService`:

| RPC | 概要 | 権限 |
|---|---|---|
| `ListSchedules` | account_id + 期間(from/to date) で出勤行を取得 | ログイン済みの任意アカウント（`GetProfileByUsername` と同じ `authenticate_user!` のみ。役割やフォロー状態による制限なし） |
| `SaveSchedule` | work_date/start_time/end_time を upsert | 本人のみ |
| `DeleteSchedule` | work_date の行を削除（休みに戻す） | 本人のみ |

`Schedule` message = { account_id, work_date, start_time, end_time }。

## Monolith `schedule` slice（Ruby / Hanami / ROM）

- 新規スライス `schedule`。テーブル `schedule.schedules`
- relations: `schedules`
- use_cases: `list_schedules` / `save_schedule` / `delete_schedule`（`save_profile.rb` と同様、本人チェックは gRPC handler の `authenticate_user!` + account_id 突合で行う）
- 既存 `profile` スライスへの依存なし（読み取り時に profile 情報を合成する必要があれば、呼び出し元＝frontend BFF 側で `GetProfile` と `ListSchedules` を並行に呼ぶ）

## Frontend

- 新規モジュール `src/modules/schedule`（`profile` モジュールとは独立）
- プロフィールページ (`src/app/profile/page.tsx` および将来の `/u/<username>` 公開プロフィール) で `ProfileHeader` の直後・`ProfileContentTabs` の直前に常時表示セクションとして配置
- 直近3日を表示し「もっと見る」で展開（展開後の件数/期間は実装時に決定）
- 本人が閲覧している場合、各日をタップして編集（`SaveSchedule`/`DeleteSchedule`）できる導線を持つ。ゲストは読み取りのみ

## Deferred / out of scope

- **予約（booking）**: 別スライスとして将来実装。`schedule` を読み取り専用で参照する一方向の依存とし、`schedule` 側は booking を意識した変更をしない
- 繰り返しテンプレート（曜日ベースの既定スケジュール）
- 空き時間帯・場所/店舗情報

## Amendment to `2026-05-31-domain-context-map-design.md`

keystone doc は「商取引次元を全ドロップ: plans / schedules / offer / 出勤管理 / 予約 は新コンセプトに含めない」と記載しているが、本specは「出勤管理」のうち**予約と結びつかない自己発信部分**を切り出して再導入するものである。keystone doc 側に以下の一文を追記する:

> 出勤情報の自己発信（本人が出勤日時を公開するのみ、予約・成約を伴わないもの）は本ドロップの対象外とし、`2026-09-19-schedule-slice-design.md` で別スライスとして再導入する。plans / offer / 予約（booking）は引き続きドロップ対象。
