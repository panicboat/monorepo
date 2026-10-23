# Re-scope `profile.casts` / retire `profile.guests`

Origin: 全スキーマ監査(2026-09-22)で見つかった「サインアップ後に `profile.casts`/`profile.guests` へ行を作る経路が存在しない」問題の根本原因調査から。トラッキングされたissueはまだ無い。

前提として [`2026-09-21-unify-cast-profile-model-design.md`](./2026-09-21-unify-cast-profile-model-design.md) を読んでいること。本specはその続き・仕上げにあたる。

## Problem

2026-09-21の統合(上記spec)で `profile.casts` は `user_id`(PK)/`visibility`/`created_at`/`updated_at` まで縮小され、`profile.guests` は明示的にスコープ外とされたまま `user_id`/`name`/`avatar_media_id`/`tagline`/`bio` を保持し続けている。

この状態を「行作成経路が無いバグ」として単純に修復しようとしたが、深掘りの結果、そもそも両テーブルの残存カラムがどれも本当に必要なデータかどうかが疑わしいことが分かった。

- **`profile.casts.visibility`**: 前回specが「死んでいるが実害無いので残す、必要になったら設計し直す」と明記した通りのカラム。今回再確認したが、唯一の読み取り経路だった `Profile::Policies::ProfileAccessPolicy#can_view_profile_details?` 自体が、自分自身のspec以外どこからも呼ばれていない(`grep -rn "ProfileAccessPolicy" .` → 定義とspecのみ)。実害が無い状態が2日経っても変わっておらず、新機能が設計されるまでの「待避場所」になる兆しも無い。
- **`profile.guests.name`/`.avatar_media_id`**: `Post::Adapters::GuestAdapter`経由で読めるようにはなっているが、実際に画面へ表示される投稿・コメントの著者名/アバターは前回specの通り`profiles`ベースの`ProfileAuthorAdapter`から来ている。`GuestAdapter`の呼び出し元は`post/grpc/handler.rb`の`find_my_guest`1箇所のみで、そこでも読まれているのは`.user_id`だけ(`.name`/`.avatar_media_id`は一度も参照されない)。
- **`profile.guests.tagline`/`.bio`**: relation宣言のみ、参照ゼロ(前回specの対象漏れ、単純な削除漏れと思われる)。
- **cast/guest存在チェックそのものの冗長性**: `post/grpc/handler.rb`の`find_my_cast`/`find_my_guest`/`find_blocker`は「このuser_idはcastかguestか」を`profile.casts`/`profile.guests`の行の有無で判定している。しかし同じ`post`スライス内の`Post::Adapters::AccountAdapter#get_user_type`は同じ判定を`identity.accounts.role`から直接行っており、こちらは全アカウントで確実に機能する。`profile/repositories/profile_repository.rb`の`list_recent`/`search_by_query`の`role_filter`も同様に`identity.accounts.role`へのsubqueryで実装済みで、`casts`/`guests`の行の有無には一切依存していない。つまり**同じ判定を行う経路が既に2系統存在し、正しく動く方(`identity.accounts.role`ベース)ではなく、壊れている方(行の有無ベース)を`post`スライスが使っている**、というのが実体だった。

行作成の仕組みを新設して「壊れている方」を直すのではなく、`post`スライスの参照先を「正しく動く方」へ揃え、`profile.casts`/`profile.guests`それぞれの残存カラムに実質的な情報価値があるかどうかで、テーブルごとの要否を決める。

## Target design

**`profile.casts`は、cast固有の実データを持つ拡張テーブルとして再定義する。** proto (`service.proto`) が `// cast extras (role = cast)` として明示的にグルーピングしている `age`/`body_stats`/`industry`、および内容的に明らかにcast向け(cityheaven等の業界向けリンクを含む)な `sns_links` を `profile.profiles` から移動する。dev DBの実データでも guest 側はこの4項目が全件null、cast側は値が入っている行がある、という相関が出ており、「全ロール共通」という前提が実態と合っていなかった。

書き込みは `SaveProfile` を拡張し、`profiles`への`upsert`と同じ枠組みで、role=CASTの場合のみ`casts`にも`upsert`する。「行を作る専用の仕組み」を新設するのではなく、既に機能している`upsert`パターンをテーブルが1つ増えるだけとして扱う。これにより「castだが`casts`行が無い」状態は起こり得るが(プロフィール未保存の間)、`profile.profiles`が同じ理由で空でありうることを既に仕様として受け入れているのと同じ扱いにする(Out of scope参照)。

`visibility`は削除する。前回specの「実害が無いので残す」判断を覆すわけではなく、`casts`テーブル自体の役割をここで再定義する以上、根拠の無い死んだカラムを一緒に残す理由が無い。将来cast公開範囲機能が必要になった時に、その機能の一部として設計し直す(前回specの方針を踏襲)。

**`profile.guests`はテーブルごと廃止する。** 残っていた4カラムのうち`name`/`avatar_media_id`は実質未参照(著者表示は`profiles`経由)、`tagline`/`bio`は完全に参照ゼロ。`guests`が持つ情報で`profiles`に無いものは無い。

**`post`スライスのcast/guest判定を`identity.accounts.role`ベースに統一する。** `find_my_cast`/`find_my_guest`/`find_blocker`を`Post::Adapters::AccountAdapter`(既存、`identity.accounts.role`を直接見る)ベースの実装に置き換える。`find_blocker`が最終的に使うのは`current_user_id`と同値のIDのみなので、実装はむしろ単純化される。これに伴い`Post::Adapters::CastAdapter`/`GuestAdapter`は不要になるため削除する。

**`Profile::Policies::ProfileAccessPolicy`を削除する。** 呼び出し元ゼロを確認済み(specのみ)。

## Evidence

- `ProfileAccessPolicy`呼び出し元: `grep -rn "ProfileAccessPolicy" .` → `slices/profile/policies/profile_access_policy.rb`(定義)と`spec/slices/profile/policies/profile_access_policy_spec.rb`(spec)のみ。
- `GuestAdapter`呼び出し元: `grep -rn "guest_adapter\." slices/post` → `slices/post/grpc/handler.rb:60`(`find_my_guest`内)のみ。そこから`.name`/`.avatar_media_id`が読まれている箇所は無い。
- 投稿の著者表示: `post_presenter.rb#post_author_to_proto`は`author.display_name`/`.username`/`.avatar_url`を使用 — `PostAuthor`は`ProfileAuthorAdapter`(前回spec参照)経由で`profiles`から解決されており、`guest_adapter`/`cast_adapter`とは無関係。
- role/cast-guest判定の並行実装: `post/adapters/account_adapter.rb#get_user_type`(`identity.accounts.role`直接参照)と`profile/repositories/profile_repository.rb#list_recent`/`#search_by_query`の`role_filter`(`identity__accounts`へのsubquery)。どちらも`casts`/`guests`テーブルを経由しない。
- dev DB実データ(role別のcast-extras充足率、`bundle exec hanami db migrate`で最新化した状態):
  ```
  role=CAST(2): n=5, has_age=3, has_body_stats=3, has_industry=3, has_sns_links=0
  role=GUEST(1): n=5, has_age=0, has_body_stats=0, has_industry=0, has_sns_links=0
  ```

静的なgrep調査であり実行トレースではない(REASONEDでありVERIFIEDではない、前回specと同じ限界)。実装時に`bundle exec rspec`で再確認する。

## Migration plan

実データを持つ本番運用はまだ無い(2026-09-23時点でプレリリース)ため、段階リリースは不要。ROM::SQLのmigrationを1本で実施する。

1. `profile.casts`に`sns_links`(jsonb)/`age`(integer)/`body_stats`(jsonb)/`industry`(text)を追加。
2. バックフィル: `profile.profiles`の該当4カラムを、`identity.accounts.role = 2`(CAST)のアカウントに限り`profile.casts`へコピーする。
   ```sql
   UPDATE profile.casts c
   SET sns_links = p.sns_links, age = p.age, body_stats = p.body_stats, industry = p.industry
   FROM profile.profiles p
   JOIN identity.accounts a ON a.id = p.account_id
   WHERE c.user_id = p.account_id AND a.role = 2
   ```
3. `profile.casts.visibility`をdrop。
4. `profile.profiles`から`sns_links`/`age`/`body_stats`/`industry`をdrop。
5. `profile.guests`をdrop(テーブル本体 + ROM上のrelation)。

ダウンマイグレーションはデータ復元まで用意しない(destroy-and-recreateを優先する既存方針、前回specと同じ)。

## Consumer changes by slice

- **profile slice**:
  - `relations/casts.rb`: `sns_links`/`age`/`body_stats`/`industry`を追加、`visibility`を削除。
  - `relations/guests.rb`: ファイル削除。
  - `repositories/cast_repository.rb`: `upsert(account_id:, attrs:)`を新設(`profile_repository.rb#upsert`と同形)。既存の存在チェック用メソッド(`find_by_user_id`等)は維持(post slice側の新実装では使わなくなるが、profile slice内で他に使われていないか実装時に再確認 — Open Questions参照)。
  - `repositories/guest_repository.rb`: ファイル削除。
  - `use_cases/save_profile.rb`: `identity_account_repo`でroleを取得し、CASTの場合のみ`cast_repository.upsert`を追加呼び出し。
  - `presenters/profile_presenter.rb`: `sns_links`/`age`/`body_stats`/`industry`を`profile`ではなく`cast`(nilなら空値)から組み立てるよう変更。
  - `grpc/profile_handler.rb#present`: cast行の取得を追加し、presenterに渡す。
  - `policies/profile_access_policy.rb`: ファイル削除(spec含む)。
- **post slice**:
  - `adapters/cast_adapter.rb`/`adapters/guest_adapter.rb`: ファイル削除。
  - `grpc/handler.rb`: `find_my_cast`/`find_my_guest`/`find_blocker`を`account_adapter.get_user_type`+`current_user_id`ベースに置き換え。
- **discovery/schedule/billing等**: 変更なし(いずれも`casts`/`guests`の存在チェックに依存していないことを確認済み)。
- **frontend**: 今回のスコープでは`Cast`/`Guest`専用の型がAPIレスポンス形状に影響する箇所は見つかっていない。proto上`Profile`メッセージの形は変わらない(cast extrasフィールドの中身がcastでないアカウントでは空になるだけ)ため、実装時に念のため`pnpm exec tsc --noEmit`で確認する。

## Testing strategy

- `bundle exec rspec`を実装前後で全体実行(このリポジトリの慣例、CIはrspecを回さないためローカル実行が唯一のシグナル)。
- 追加spec: `save_profile_spec.rb`にrole=CAST/GUESTそれぞれでの`casts`行の有無を検証するケースを追加。
- `post/grpc/handler`相当のspec: `casts`/`guests`行が存在しない状態でもblock判定が`identity.accounts.role`ベースで正しく動くことを回帰テスト化。
- 削除対象(`ProfileAccessPolicy`/`CastAdapter`/`GuestAdapter`)のspecファイルも合わせて削除。
- フロントエンド: `pnpm exec tsc --noEmit`と`pnpm exec vitest run`を回帰確認として実施。

## Out of scope

- `profile.profiles`行がサインアップ直後に存在しない状態(`SaveProfile`が呼ばれるまで空)は、今回のスコープでは仕様として受け入れる。`get_profile`は`profile: nil`を安全に返す設計であり、クラッシュしない。
- `profile.profile_areas`/`profile.areas`(活動エリア)は、proto上同じ"cast extras"コメントブロックに含まれるが、今回は対象外とする。
- `profile.cast_genres`/`profile.cast_gallery_media`/`offer.plans`/`profile.genres`/`profile.guest_prefectures`(丸ごと死んでいる5テーブル)の削除は別spec(project B)で扱う。なお前回spec(2026-09-21)は`cast_genres`/`cast_gallery_media`を「生きている」と記載しているが、今回の監査(2026-09-22)ではどちらも実質未呼出と判定した。この食い違いはproject B側で決着させる。
- `post.posts.cast_user_id`/`post.likes.guest_user_id`まわりのレガシーカラム・死んだrepositoryメソッドの削除は別spec(project C)で扱う。
- このセッションから本番データへ直接手を加えることはしない。migrationは通常のcommit済みファイルとして既存デプロイパイプライン経由で反映する。

## Open questions to confirm during implementation

- `cast_repository.rb`の既存メソッド(`find_by_user_id`/`find_by_ids`/`find_by_user_ids`)が、`post`スライス以外(`profile`スライス自身のquery use case等)からまだ使われていないか実装時に再確認する。使われていなければ、存在チェック専用メソッド群も併せて削除する。
- `sns_links`はproto上「cast extras」の注釈ブロックの外に書かれているが、内容(cityheaven等)から今回はcast専用として扱うと決めた。実装時にfrontend側で guest が sns_links を入力するUIが実在しないか、念のため確認する。
