# Unify the cast profile data model (`profile.casts` vs `profile.profiles`)

Issue: [#1181](https://github.com/panicboat/monorepo/issues/1181) — 新旧2つの cast データモデルが並存している

## Problem

`dystopia/monolith` の `profile` schema には、castのプロフィールデータを保持するテーブルが2つ存在する。

- `profile.casts` — 2026-01-17作成、cast専用。
- `profile.profiles` — 2026-06-04作成、全ロール共通（cast/guest問わず）。`account_id`をPKとし、`casts.user_id`と同一UUID空間（`identity.accounts.id`）を指す。

意味的に重複しているフィールド: 表示名、bio、avatar/cover画像、年齢、SNSリンク、スリーサイズ/body-stats、「ハンドル」（slug vs username）、registered-at、エリア選択。PR #1182（2026-09-19マージ、issue #1166対応）で `profiles` 側に `body_stats`/`sns_links` を拡充したが `casts` には手を付けておらず、これが本issueの発端になったと見られる。

各テーブルの生きている呼び出し元を全て洗い出した結果（Evidence参照）、実際に壊れている挙動が2件見つかった。

1. **投稿とコメントで著者情報の出所が食い違う。** `post_handler.rb` は投稿の著者を `ProfileAuthorAdapter`（`profiles`経由）で解決している。一方 `comment_handler.rb` の `get_comment_author`（共通基底クラス `Post::Grpc::Handler` に定義）は今も旧`CastAdapter`/`GuestAdapter`（`casts`/`guests`経由）で解決している。設定画面で表示名やアバターを変更しても、投稿には反映されるがコメントには反映されない。
2. **エリア絞り込みdiscoveryが、実際に設定したエリアを見ていない。** `AreaSettings.tsx` は汎用の `SaveProfile` RPC経由で保存しており、これは `profile.profile_areas` に書き込む。一方castのエリア別discovery（`Profile::UseCases::Cast::Queries::GetPublicCastIdsInPrefecture`）は `profile.cast_areas` を読んでいる。設定画面でエリアを設定しても、エリア絞り込みのcast一覧には一切反映されない。

## Evidence: live vs. dead code on `casts`

`Profile::Repositories::CastRepository` の全呼び出し元をgrepで洗い出した（静的解析であり実行トレースではない — REASONEDであってVERIFIEDではない。削除実施前に `bundle exec rspec` で再確認すること）。

**生きている**（実際のリクエスト経路から呼ばれている）:
- `save_visibility` — `Profile::UseCases::SaveCastVisibility` 経由。
- `find_by_ids` / `find_by_user_ids` — `Profile::UseCases::Cast::Queries::{GetByIds,GetByUserIds}` 経由。`Post::Adapters::CastAdapter` が `visibility`/存在確認と、（現状）`name`/`avatar_media_id`/`profile_media_id`/`slug` の表示系フィールドに使用。
- `public_cast_ids`, `area_ids_by_prefecture`, `cast_user_ids_by_area_ids` — `Profile::UseCases::Cast::Queries::{GetPublicCastIds,GetPublicCastIdsInPrefecture}` 経由。
- `cast_genres`/`cast_gallery_media` リレーション — `profiles`側に対応物がない、純粋にcast固有の概念で、各use caseから読み書きされている。（`cast_areas` も上記grep上は「生きている」が、上述のエリア絞り込みバグにしか寄与していない — 廃止する理由はTarget design参照）

**死んでいる**（定義はあるが、spec以外のどこからも呼ばれていない）:
- `Profile::Contracts::Cast::SaveProfileContract`（cast専用のsave-profileバリデーション一式。`name`/`bio`/`slug`/`tagline`/`social_links`/`age`/`height`/`blood_type`/`three_sizes`/`tags`/`default_schedules`の各ルールを含む）。
- `CastRepository#find_by_slug`, `#slug_available?`, `#get_popular_tags`, `#complete_registration`, `#save_images`, `#find_with_plans`, `#find_by_user_id_with_plans`, `#find_gallery_media_ids`, `#private_cast_ids`。最も確信度が低いのは `#find_gallery_media_ids` — ギャラリー画像表示自体は生きている機能なので、削除前にgrepで見落とした呼び出し元がないか再確認すること（Open Questions参照）。
- `Post::Grpc::Handler#load_authors`, `#find_my_cast!`。
- **`casts.default_schedules`** — 一見cast固有で「明らかに必要」に見えるが、実際にはリレーションのスキーマ定義と、上記の死んでいる`Cast::SaveProfileContract`のバリデーションルールでしか参照されていない。presenter・handler・use caseのどこからも読み書きされておらず、実際にスケジュール機能を提供している`Schedule`スライス（`schedule_handler.rb`の`SaveSchedule`/`ListSchedules`/`DeleteSchedule`、`offer`schema）とは一切結びついていない。spec作成の途中で「これ本当に必要？」と聞かれて気づいた一件— 「cast固有に見える」ことと「生きている」ことは別物であり、この文書に挙げた全カラムは目視ではなく呼び出し元の有無で判定した。維持ではなく削除する。

実務上の含意: `casts.name`, `tagline`, `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`, `default_schedules` のいずれも、現状どの生きたコードパスからも新たな非NULL値を生成できない。既存の値はすべて凍結された残骸である。これにより、この移行は「2つの書き込み経路が競合している」状態よりもかなり安全で、実質「使われなくなったコピーを片付ける」作業に近い。とはいえ`profiles`に無いデータが`casts`側にだけ残っている可能性に備え、一度だけバックフィルする（Migration参照）。

## Target design

**`profile.profiles`** を、全ロール共通の表示系・アイデンティティ系フィールドの唯一の情報源にする: `display_name`, `username`, `bio`, `avatar_media_id`, `cover_media_id`, `age`, `sns_links`, `body_stats`, `prefecture`, `is_private`, `registered_at`, `website`, `industry`、および`profile_areas`によるエリア選択。

**`profile.casts`** は、`profiles`に対応物のないcast固有の業務データだけに縮小する: `user_id`（PK、= `profiles.account_id`）, `visibility`, `created_at`, `updated_at`。関連する`cast_genres`と`cast_gallery_media`はそのまま維持。`cast_areas`は廃止する（後述）。

**完全に削除する**（死んでいるコード・カラムをまとめて削除）: `casts.name`, `tagline`, `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`, `default_schedules`、および`Cast::SaveProfileContract`と上記で挙げた死んでいる`CastRepository`/`Handler`のメソッド群。

**`comment_handler.rb`の`get_comment_author`** を書き換え、cast・guestどちらのコメント著者も`ProfileAuthorAdapter`（`profiles`経由）で解決するようにする。投稿の著者解決と同じ扱いにし、このためだけの`account_adapter.get_user_type`による分岐を無くす。この変更により`CastAdapter`が表示系フィールドを持つ最後の理由も無くなる。変更後の`CastAdapter`/`CastInfo`は`user_id`と`visibility`だけを持てばよく（`find_my_cast`/`find_blocker`/投稿の公開範囲判定に使用）。

**cast向けのエリア絞り込みdiscovery**（`GetPublicCastIdsInPrefecture`）は、`cast_areas`/`area_ids_by_prefecture`ではなく、既にfeedのエリアタブで使われている`profile_repository.account_ids_by_prefecture`を使い、`public_cast_ids`との積集合を取る方式に切り替える。`cast_areas`テーブル・そのリレーション、および`CastRepository#area_ids_by_prefecture` / `#cast_user_ids_by_area_ids` / `CastRepository#save_areas` / `#find_area_ids`（cast専用の方。`ProfileRepository`には`profile_areas`用の`save_areas`/`find_area_ids`が既に別途存在する）は削除する。

## Migration plan

ROM::SQLのmigrationを1本、以下の順で実施する（上記の「死んでいる」という前提が正しければ、各ステップは実質no-opになるはず）。

1. **バックフィル** — 両テーブルに存在するカラムそれぞれについて、`profiles`側がNULLかつ`casts`側が非NULLの場合のみ`profiles`を更新する:
   `UPDATE profile.profiles p SET <field> = c.<field> FROM profile.casts c WHERE p.account_id = c.user_id AND p.<field> IS NULL AND c.<field> IS NOT NULL`
   — 重複する各カラムについて繰り返す。両方に値がある場合は`profiles`側（現在実際に編集されている方）を優先する。
2. **カラム削除** — `profile.casts`から`name`, `tagline`, `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`, `default_schedules`を削除する。（`name`/`bio`は現状`casts`上で`NOT NULL`だが、カラムごと削除するので制約も一緒に消える。安全）
3. **`profile.cast_areas`を削除**（テーブル本体＋ROM上のリレーション/アソシエーション）。
4. 通常のmigration運用に従い`structure.sql`を再生成する。

削除するカラムについて、空の状態で作り直す以上のダウンマイグレーション（データ復元）は用意しない。これはこのリポジトリの既存方針（salvageよりdestroy-and-recreateを好む）と、そもそもこれらのカラムが既に死んでいることの両方による。もし特定のカラムについてこの前提が誤っていた場合（Open Questions参照）は、削除後にではなく削除前にそのカラムだけ個別対応する。

## Consumer changes by slice

- **profile slice**: `Cast::SaveProfileContract`を削除。`CastRepository`を`find_by_user_id(s)`/`find_by_id(s)`（`user_id`+`visibility`のみ返す）、`save_visibility`、`public_cast_ids`、および`cast_genres`/`cast_gallery_media`関連メソッド（変更なし）だけに縮小し、上記の死んでいるメソッド群（`private_cast_ids`含む）を削除する。`Relations::Casts`のスキーマを縮小後のカラム構成に更新。`GetPublicCastIdsInPrefecture`を`ProfileRepository`経由に書き換える。
- **post slice**: `Post::Adapters::CastAdapter`の`CastInfo`を`user_id`+`visibility`に縮小。`get_comment_author`（`Post::Grpc::Handler`）を両ロールとも`ProfileAuthorAdapter`経由に書き換え。死んでいる`load_authors`/`find_my_cast!`を削除。
- **discovery slice**: コード変更は想定していない（既に`profiles`を参照済み）— 回帰テストのみ実施。
- **schedule slice**: 変更なし — `casts.default_schedules`に生きた読み書き元が無いこと、`Schedule`スライス自身のテーブル（`offer`schema）と一切結合していないことを確認済み。単純に削除するだけでよい。
- **frontend**: 今回の調査では`Profile`型と重複する`Cast`型のTS定義は見つからなかった。実装時に再確認し、もし見つかれば（discovery/検索結果のマッピング等）統合後のprofile形状を読むように更新する。

## Testing strategy

- monolith全体で`bundle exec rspec`を実装前後で実行する（このリポジトリの慣例通り。CIはrspecを回さないため、ローカル実行が唯一のシグナル — monolith検証に関するproject memory参照）。
- 追加・修正するspec: `get_comment_author`がcast・guestどちらでも現在の`profiles`データを返すこと。エリア絞り込みdiscoveryが`profile_areas`の変更を反映すること。migrationのバックフィル（`casts`/`profiles`に異なる値を仕込んだ状態から`profiles`の結果を検証するmodel/repository spec）。
- フロントエンドの挙動変更は意図していない（バックエンドのデータモデル統合のため）。`pnpm exec tsc --noEmit`と`pnpm exec vitest run`は回帰確認としてのみ実施する。

## Out of scope

- `profile.guests`のテーブル構造自体は変更しない。変更するのは`post`スライスの*コメント著者解決*をcast/guestで対称にする部分のみ（投稿の著者解決は既にそうなっている）。
- 店舗/スケジュールのモデリング（PR #1182で既に明示的にスコープ外とされている）は対象外。
- このセッションから本番データへ直接手を加えることはしない。migrationは通常のcommit済みmigrationファイルとして、このリポジトリの他のmigrationと同様に既存のdeployパイプライン経由で反映される。

## Open questions to confirm during implementation

- `CastRepository#find_gallery_media_ids` — 上記grepでは未使用と判定したが、`cast_gallery_media`自体は生きているリレーションなので、削除する前に別経路（未読のgRPC handler等）から呼ばれていないか再確認すること。
- `casts`側にしかない非NULLデータが実際に存在するアカウントがあるかどうか — バックフィルのステップ自体は汎用的に対応しているが、本番相当の非production DBコピーに対して一度read-onlyクエリを流し、バックフィルが実質no-opだったのか実際にデータを救ったのかをPRのコミットメッセージに書き添えると良い。
