# Unify the cast profile data model (`profile.casts` vs `profile.profiles`)

Issue: [#1181](https://github.com/panicboat/monorepo/issues/1181) — 新旧2つの cast データモデルが並存している

## Problem

`dystopia/monolith` の `profile` schema には、castのプロフィールデータを保持するテーブルが2つ存在する。

- `profile.casts` — 2026-01-17作成、cast専用。
- `profile.profiles` — 2026-06-04作成、全ロール共通（cast/guest問わず）。`account_id`をPKとし、`casts.user_id`と同一UUID空間（`identity.accounts.id`）を指す。

意味的に重複しているフィールド: 表示名、bio、avatar/cover画像、年齢、SNSリンク、スリーサイズ/body-stats、「ハンドル」（slug vs username）、registered-at、エリア選択。PR #1182（2026-09-19マージ、issue #1166対応）で `profiles` 側に `body_stats`/`sns_links` を拡充したが `casts` には手を付けておらず、これが本issueの発端になったと見られる。

各テーブルの生きている呼び出し元を全て洗い出した結果（Evidence参照）、実際に壊れている挙動が1件見つかった。

**エリア絞り込みdiscoveryが、実際に設定したエリアを見ていない。** `AreaSettings.tsx` は汎用の `SaveProfile` RPC経由で保存しており、これは `profile.profile_areas` に書き込む。一方castのエリア別discovery（`Profile::UseCases::Cast::Queries::GetPublicCastIdsInPrefecture`）は `profile.cast_areas` を読んでいる。設定画面でエリアを設定しても、エリア絞り込みのcast一覧には一切反映されない。

（当初「投稿とコメントで著者情報の出所が食い違う」ことも生きたバグとして記載していたが、これは調査ミスだった。`comment_handler.rb`は基底クラスの`get_comment_author`を`ProfileAuthorAdapter`ベースの実装で**既にオーバーライド済み**で、`list_comments`/`list_replies`ユースケースも既に`profile_author_adapter`を使っている。基底`Handler#get_comment_author`と`load_media_files_for_comments_with_authors`はどちらも呼び出し元ゼロの死んだコードで、著者解決は投稿・コメントとも既に`profiles`に統一されていた。詳細はEvidence参照。）

## Evidence: live vs. dead code on `casts`

`Profile::Repositories::CastRepository` の全呼び出し元をgrepで洗い出した（静的解析であり実行トレースではない — REASONEDであってVERIFIEDではない。削除実施前に `bundle exec rspec` で再確認すること）。

**生きている**（実際のリクエスト経路から呼ばれている）:
- `save_visibility` — `Profile::UseCases::SaveCastVisibility` 経由。
- `find_by_ids` / `find_by_user_ids` — `Profile::UseCases::Cast::Queries::{GetByIds,GetByUserIds}` 経由。`Post::Adapters::CastAdapter#find_by_user_id`は`find_my_cast`/`find_blocker`（`post`スライスの各handlerで「自分がcastかどうか」を判定するために使用）経由で呼ばれているが、実際に読まれているのは返り値の`user_id`のみ。`CastInfo`が持つ`name`/`avatar_media_id`/`profile_media_id`/`slug`/`visibility`はどれも、これを構築する側（`build_cast_info`）でセットされているだけで、呼び出し側で読まれている箇所はどこにも無い（後述の通り、それらを読んでいたコードはすべて死んでいた）。
- `public_cast_ids`, `area_ids_by_prefecture`, `cast_user_ids_by_area_ids` — `Profile::UseCases::Cast::Queries::{GetPublicCastIds,GetPublicCastIdsInPrefecture}` 経由。
- `cast_genres`/`cast_gallery_media` リレーション — `profiles`側に対応物がない、純粋にcast固有の概念で、各use caseから読み書きされている。（`cast_areas` も上記grep上は「生きている」が、上述のエリア絞り込みバグにしか寄与していない — 廃止する理由はTarget design参照）

**死んでいる**（定義はあるが、spec以外のどこからも呼ばれていない）:
- `Profile::Contracts::Cast::SaveProfileContract`（cast専用のsave-profileバリデーション一式。`name`/`bio`/`slug`/`tagline`/`social_links`/`age`/`height`/`blood_type`/`three_sizes`/`tags`/`default_schedules`の各ルールを含む）。
- `CastRepository#find_by_slug`, `#slug_available?`, `#get_popular_tags`, `#complete_registration`, `#save_images`, `#find_with_plans`, `#find_by_user_id_with_plans`, `#find_gallery_media_ids`, `#private_cast_ids`。最も確信度が低いのは `#find_gallery_media_ids` — ギャラリー画像表示自体は生きている機能なので、削除前にgrepで見落とした呼び出し元がないか再確認すること（Open Questions参照）。
- `Post::Grpc::Handler#load_authors`, `#find_my_cast!`。
- **`Post::Grpc::Handler#get_comment_author`（基底クラス版、`cast_adapter`/`guest_adapter`で分岐する実装）と、`Post::Grpc::CommentHandler#load_media_files_for_comments_with_authors`。** どちらも`cast_adapter.find_by_user_id`/`guest_adapter.find_by_user_id`を経由して`name`/`avatar_media_id`/`profile_media_id`を読んでいるが、呼び出し元がゼロ。`CommentHandler < Handler`は`get_comment_author`を`ProfileAuthorAdapter`ベースの実装で上書きしており、`add_comment`から呼ばれるのは常にそのオーバーライド側。`load_media_files_for_comments_with_authors`に至っては定義以外どこからも参照されていない。当初「投稿とコメントの著者情報が食い違う生きたバグ」だと誤認していたのはこの2メソッドで、実際にはどちらも死んでいた（Problem参照）。
- **`casts.default_schedules`** — 一見cast固有で「明らかに必要」に見えるが、実際にはリレーションのスキーマ定義と、上記の死んでいる`Cast::SaveProfileContract`のバリデーションルールでしか参照されていない。presenter・handler・use caseのどこからも読み書きされておらず、実際にスケジュール機能を提供している`Schedule`スライス（`schedule_handler.rb`の`SaveSchedule`/`ListSchedules`/`DeleteSchedule`、`offer`schema）とは一切結びついていない。spec作成の途中で「これ本当に必要？」と聞かれて気づいた一件— 「cast固有に見える」ことと「生きている」ことは別物であり、この文書に挙げた全カラムは目視ではなく呼び出し元の有無で判定した。維持ではなく削除する。

実務上の含意: `casts.name`, `tagline`, `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`, `default_schedules` のいずれも、現状どの生きたコードパスからも新たな非NULL値を生成できない。既存の値はすべて凍結された残骸である。これにより、この移行は「2つの書き込み経路が競合している」状態よりもかなり安全で、実質「使われなくなったコピーを片付ける」作業に近い。とはいえ`profiles`に無いデータが`casts`側にだけ残っている可能性に備え、一度だけバックフィルする（Migration参照）。

## Target design

**`profile.profiles`** を、全ロール共通の表示系・アイデンティティ系フィールドの唯一の情報源にする: `display_name`, `username`, `bio`, `avatar_media_id`, `cover_media_id`, `age`, `sns_links`, `body_stats`, `prefecture`, `is_private`, `registered_at`, `website`, `industry`、および`profile_areas`によるエリア選択。

**`profile.casts`** は、`profiles`に対応物のないcast固有の業務データだけに縮小する: `user_id`（PK、= `profiles.account_id`）, `visibility`, `created_at`, `updated_at`。関連する`cast_genres`と`cast_gallery_media`はそのまま維持。`cast_areas`は廃止する（後述）。

**完全に削除する**（死んでいるコード・カラムをまとめて削除）: `casts.name`, `tagline`, `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`, `default_schedules`、および`Cast::SaveProfileContract`と上記で挙げた死んでいる`CastRepository`/`Handler`のメソッド群。

**コメント著者解決はコードを書き換える必要が無い**（既に`ProfileAuthorAdapter`に統一済みのため）。代わりに、死んでいる基底`Handler#get_comment_author`と`CommentHandler#load_media_files_for_comments_with_authors`を削除する。これにより`CastAdapter`が表示系フィールドを持つ理由が完全に無くなるので、`CastAdapter`/`CastInfo`を`user_id`だけ（存在確認用）に縮小する。`find_my_cast`/`find_blocker`が読むのは`user_id`だけで、`visibility`はpost slice側では読まれていなかった。`casts.visibility`自体はprofile slice側（`SaveCastVisibility`/discoveryの公開cast一覧）で生きたまま使われ続けるので、削除するのはpost slice側の`CastAdapter`が持つコピーだけである。

**cast向けのエリア絞り込みdiscovery**（`GetPublicCastIdsInPrefecture`）は、`cast_areas`/`area_ids_by_prefecture`ではなく、既にfeedのエリアタブで使われている`profile_repository.account_ids_by_prefecture`を使い、`public_cast_ids`との積集合を取る方式に切り替える。`cast_areas`テーブル・そのリレーション、および`CastRepository#area_ids_by_prefecture` / `#cast_user_ids_by_area_ids` / `CastRepository#save_areas` / `#find_area_ids`（cast専用の方。`ProfileRepository`には`profile_areas`用の`save_areas`/`find_area_ids`が既に別途存在する）は削除する。

## Migration plan

ROM::SQLのmigrationを1本、以下の順で実施する（上記の「死んでいる」という前提が正しければ、各ステップは実質no-opになるはず）。

0. **`profiles`行の存在保証** — `profiles`行は`SaveProfile`（Settingsの汎用保存 or `EditProfileModal`経由）が呼ばれて初めて作られ、signup時に自動生成される保証は無い。2026-06-04より前に登録した、かつ一度もプロフィール編集画面を開いていないcastは`casts`行はあっても`profiles`行が無い可能性がある。カラム削除前に、`casts`にあって`profiles`に無いアカウントへ`profiles`行をINSERTする:
   `INSERT INTO profile.profiles (account_id, display_name, bio, avatar_media_id, registered_at, age, created_at, updated_at) SELECT c.user_id, c.name, c.bio, c.avatar_media_id, c.registered_at, c.age, c.created_at, c.updated_at FROM profile.casts c WHERE NOT EXISTS (SELECT 1 FROM profile.profiles p WHERE p.account_id = c.user_id)`
1. **バックフィル** — 両テーブルに存在し、かつ意味・型が一致するカラムについて、`profiles`側がNULLかつ`casts`側が非NULLの場合のみ`profiles`を更新する:
   `UPDATE profile.profiles p SET <field> = c.<field> FROM profile.casts c WHERE p.account_id = c.user_id AND p.<field> IS NULL AND c.<field> IS NOT NULL`
   — 対象は`name→display_name`, `bio→bio`, `avatar_media_id→avatar_media_id`, `registered_at→registered_at`, `age→age`の5カラムに限定する。両方に値がある場合は`profiles`側（現在実際に編集されている方）を優先する。
   `tagline`/`social_links`/`height`/`blood_type`/`three_sizes`/`tags`/`slug`/`profile_media_id`は`profiles`側に形の異なる対応先（`sns_links`はキー構成が違う、`body_stats`はキー名が違う等）しか無いか、対応先が無いため、バックフィル対象から外し、そのまま破棄する（destroy-and-recreateを優先するこのリポジトリの既存方針に沿う。Open Questions参照）。
2. **カラム削除** — `profile.casts`から`name`, `tagline`, `social_links`, `age`, `height`, `blood_type`, `three_sizes`, `tags`, `slug`, `profile_media_id`, `avatar_media_id`, `registered_at`, `default_schedules`を削除する。（`name`/`bio`は現状`casts`上で`NOT NULL`だが、カラムごと削除するので制約も一緒に消える。安全）
3. **`profile.cast_areas`を削除**（テーブル本体＋ROM上のリレーション/アソシエーション）。
4. 通常のmigration運用に従う（memory「monolith migration追加時のstructure.sql運用」の通り、`structure.sql`の同梱は不要。ローカルでmigrate実行→`bundle exec rspec`で確認する）。

削除するカラムについて、空の状態で作り直す以上のダウンマイグレーション（データ復元）は用意しない。これはこのリポジトリの既存方針（salvageよりdestroy-and-recreateを好む）と、そもそもこれらのカラムが既に死んでいることの両方による。もし特定のカラムについてこの前提が誤っていた場合（Open Questions参照）は、削除後にではなく削除前にそのカラムだけ個別対応する。

## Consumer changes by slice

- **profile slice**: `Cast::SaveProfileContract`を削除。`CastRepository`を`find_by_user_id(s)`/`find_by_id(s)`（`user_id`+`visibility`のみ返す）、`save_visibility`、`public_cast_ids`、および`cast_genres`/`cast_gallery_media`関連メソッド（変更なし）だけに縮小し、上記の死んでいるメソッド群（`private_cast_ids`含む）を削除する。`Relations::Casts`のスキーマを縮小後のカラム構成に更新。`GetPublicCastIdsInPrefecture`を`ProfileRepository`経由に書き換える。
- **post slice**: `Post::Adapters::CastAdapter`の`CastInfo`を`user_id`だけに縮小（`find_by_cast_id`/`find_by_cast_ids`/`find_by_id`/`get_user_ids_by_cast_ids`/`public_cast_ids`など、`find_by_user_id`以外のメソッドも呼び出し元が無ければ併せて削除 — 実装時に再確認）。死んでいる基底`Handler#get_comment_author`・`CommentHandler#load_media_files_for_comments_with_authors`・`load_authors`・`find_my_cast!`を削除。生きている`get_comment_author`（`CommentHandler`の上書き版）・`list_comments`/`list_replies`ユースケースは変更不要。
- **discovery slice**: コード変更は想定していない（既に`profiles`を参照済み）— 回帰テストのみ実施。
- **schedule slice**: 変更なし — `casts.default_schedules`に生きた読み書き元が無いこと、`Schedule`スライス自身のテーブル（`offer`schema）と一切結合していないことを確認済み。単純に削除するだけでよい。
- **frontend**: 今回の調査では`Profile`型と重複する`Cast`型のTS定義は見つからなかった。実装時に再確認し、もし見つかれば（discovery/検索結果のマッピング等）統合後のprofile形状を読むように更新する。

## Testing strategy

- monolith全体で`bundle exec rspec`を実装前後で実行する（このリポジトリの慣例通り。CIはrspecを回さないため、ローカル実行が唯一のシグナル — monolith検証に関するproject memory参照）。
- 追加・修正するspec: エリア絞り込みdiscoveryが`profile_areas`の変更を反映すること。migrationのバックフィル（`casts`/`profiles`に異なる値を仕込んだ状態から`profiles`の結果を検証するmodel/repository spec）。コメント著者解決は既存の生きた実装（`ProfileAuthorAdapter`ベース）を変更しないので新規specは不要 — 削除対象が本当に呼び出し元ゼロであることは`bundle exec rspec`の全体green維持で確認する。
- フロントエンドの挙動変更は意図していない（バックエンドのデータモデル統合のため）。`pnpm exec tsc --noEmit`と`pnpm exec vitest run`は回帰確認としてのみ実施する。

## Out of scope

- `profile.guests`のテーブル構造自体は変更しない。コメント著者解決は既に`profiles`に統一済みなので、`post`スライス側での挙動変更は無い（死んでいる旧実装の削除のみ）。
- 店舗/スケジュールのモデリング（PR #1182で既に明示的にスコープ外とされている）は対象外。
- このセッションから本番データへ直接手を加えることはしない。migrationは通常のcommit済みmigrationファイルとして、このリポジトリの他のmigrationと同様に既存のdeployパイプライン経由で反映される。

## Open questions to confirm during implementation

- `CastRepository#find_gallery_media_ids` — 上記grepでは未使用と判定したが、`cast_gallery_media`自体は生きているリレーションなので、削除する前に別経路（未読のgRPC handler等）から呼ばれていないか再確認すること。
- `casts`側にしかない非NULLデータが実際に存在するアカウントがあるかどうか — バックフィルのステップ自体は汎用的に対応しているが、本番相当の非production DBコピーに対して一度read-onlyクエリを流し、バックフィルが実質no-opだったのか実際にデータを救ったのかをPRのコミットメッセージに書き添えると良い。
