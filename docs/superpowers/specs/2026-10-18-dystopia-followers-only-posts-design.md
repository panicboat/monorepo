# Dystopia followers-only posts design

## Context

投稿には公開範囲（`visibility`）があり、投稿画面で「公開 / 非公開」を選べる。ところが「非公開」の投稿は、一覧のどこにも出ない。プロフィールの投稿一覧・フィード・検索・ランキングがすべて `visibility: "public"` で絞っているためで、作者本人も投稿の URL を直接開いたときしか見られない。投稿した瞬間に消えたように見える。

見られるかの判定は 2 か所に分かれている。

| 場所 | 判定 |
|---|---|
| social の `FilterVisiblePosts` / `ViewerCanSeePost` | 鍵付きの**プロフィール**の投稿は、承認済みのフォロワーと本人だけ。ブロックはどちらの向きでも見えない |
| post slice の `find_readable_post`（`grpc/handler.rb`）と `ListReadablePostIds` | **非公開の投稿**は本人だけ |

本 spec は「非公開」を「フォロワーのみ」に作り替え、作者本人と承認済みのフォロワーに見せる。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 非公開の投稿を見られる人 | 本人と承認済みのフォロワー | ユーザーの判断 |
| 出す場所 | 作者のプロフィールの投稿一覧と、ホームの「フォロー中」 | ユーザーの判断。全国・エリア・検索・ランキングは公開の投稿だけのまま |
| 見られない人へのメンションの通知 | 送らない | 開けない投稿への通知になるため |
| 投稿画面の文言 | 「公開 / フォロワーのみ」 | カードの印「フォロワーのみ」（#1564）とそろえる |
| 投稿画面の説明 | 切替の下に、選択とアカウントの鍵の状態に応じた 1 行を出す | ユーザーの判断。鍵付きで「公開」を選んだ投稿は、鍵を外すと誰でも見られるようになることを伝える |
| 判定の置き場所 | social の 2 つの use case に集約し、post slice の「非公開は本人だけ」の判定は削除する | 判定を 1 か所にまとめる。一覧は今の「取ってから social の判定で絞る」作りのまま |

### Constraints

- DB の値（`visibility` の `"public"` / `"private"`）と proto は変えない。画面の文言だけを「フォロワーのみ」にする
- フォロー申請中（`pending`）は承認済みではないので、見られない
- #1564（`ProfileName` とカードの印）の上に積む

## Goals

- 非公開の投稿を、作者本人と承認済みのフォロワーが、プロフィールの投稿一覧・「フォロー中」・投稿詳細で見られる
- 見られる人は、いいね・コメントができる
- 見られない人には、メンションの通知が届かない
- 投稿画面で、公開範囲と鍵付きアカウントの関係が分かる

## Non-goals

- 全国・エリア・検索・ハッシュタグ・ランキングへの掲載
- 公開範囲の種類を増やすこと（相互フォローのみ、など）
- 既存の投稿の公開範囲の一括変更

## Rules

### Who can see a post

ブロック関係（どちらの向きでも）があれば、作者本人以外は見られない。そのうえで:

| プロフィール | 投稿 | 見られる人 |
|---|---|---|
| 公開 | 公開 | 全員 |
| 公開 | フォロワーのみ | 本人と承認済みのフォロワー |
| 鍵付き | どちらでも | 本人と承認済みのフォロワー |

停止中・削除済みの作者の投稿は、今までどおり誰にも見えない。

### Where it appears

| 場所 | フォロワーのみの投稿 |
|---|---|
| 作者のプロフィールの「投稿」「メディア」タブ | 本人と承認済みのフォロワーに出す |
| ホームの「フォロー中」 | フォローしている相手（承認済み）の投稿として出す |
| 全国・エリア | 出さない |
| 検索・ハッシュタグ・ランキング | 出さない |
| ブックマーク・いいねの一覧・返信タブの元の投稿 | 上のルールで見られる人にだけ出す（フォローを外すと見えなくなる） |
| 投稿詳細・いいね・コメント | 上のルールで見られる人が開ける・反応できる |

### Notifications

投稿や返信のメンションの通知は、メンションされた人がその投稿を見られる場合だけ送る。判定は上のルール（メンションされた人を閲覧者として）を使う。いいね・コメントの作者への通知は変えない。

## Architecture

### Social (`dystopia/monolith/slices/social/use_cases/`)

- `FilterVisiblePosts#call(viewer_profile_id:, posts:)`: 「フォローが要るか」を `profile.is_private || post.visibility == "private"` で判定する。それ以外の分岐（本人、作者が見えない、ブロック、未ログイン）は今のまま
- `ViewerCanSeePost#call(viewer_profile_id:, post:)`: 同じ条件にする
- 投稿が `visibility` を持たない呼び出し（他 slice の参照用の構造体など）は公開として扱う（`post.respond_to?(:visibility)` で判定）

### Post slice (`dystopia/monolith/slices/post/`)

- `grpc/handler.rb` の `find_readable_post` から、`visibility == "private"` で本人以外を弾く行を削除する（`ViewerCanSeePost` が判定する）
- `use_cases/posts/list_readable_post_ids.rb` から、同じ判定の行を削除する
- `repositories/post_repository.rb`:
  - `list_posts(..., include_private: false)`: `include_private` が true なら `visibility` で絞らない
  - `list_public_post_ids` を `list_post_ids(..., include_private: false)` に改名し、同じ引数を足す
- `grpc/post_handler.rb` の `list_posts`: 作者を指定した一覧で、閲覧者が作者本人か承認済みのフォロワーなら `include_private: true` にする。フォロー状態は `Social::Slice["repositories.follow_repository"]` の `find` で 1 回だけ見る。ブロック・鍵付きの判定は、今の一覧の後段の絞り込みに任せる
- メンションの通知（`grpc/post_handler.rb` の投稿作成と、`use_cases/comments/add_comment.rb`）: 通知を作る前に、メンションされた各プロフィールについて `ViewerCanSeePost` で投稿を見られるかを判定し、見られない人を除く

### Feed (`dystopia/monolith/slices/feed/use_cases/list_feed.rb`)

- `list_post_ids` を呼ぶとき、`filter == "following"` なら `include_private: true`、それ以外は `false`。フォロー中の相手は承認済みだけ（`following_profile_ids` が `status: "approved"` で絞っている）

### Frontend (`dystopia/frontend/src/modules/post/components/PostComposer.tsx`)

- 切替の文言を「公開 / フォロワーのみ」にし、読み上げ名を「フォロワーのみ」にする
- 切替の下に説明を 1 行出す。アカウントが鍵付きかは `useProfile()` の `profile?.isPrivate` から取る

| アカウント | 選択 | 説明 |
|---|---|---|
| 公開 | 公開 | 誰でも見られます |
| 公開 | フォロワーのみ | あなたとフォロワーだけが見られます |
| 鍵付き | 公開 | 今は鍵付きのため、フォロワーだけに表示されます。鍵を外すと誰でも見られるようになります |
| 鍵付き | フォロワーのみ | あなたとフォロワーだけが見られます。鍵を外してもフォロワーのみのままです |

- 切替は鍵付きでも常に出す。隠すと、鍵を外したときに公開になる投稿を気づかずに作ってしまうため

## Testing

monolith（rspec、`dystopia/monolith` でローカル実行）:

- social: ルールの表の 3 行、ブロック（両方向）、フォロー申請中、未ログイン、本人
- post: プロフィールの投稿一覧で、本人・承認済みのフォロワー・フォロワーでない人・申請中の人の見え方。1 件取得、いいね、コメントの可否
- feed: フォロワーのみの投稿が「フォロー中」に出て、全国・エリアに出ない
- 検索・ランキング: フォロワーのみの投稿が出ない
- 通知: 見られない人にメンションの通知が行かず、見られる人には行く
- ブックマーク・いいねの一覧: フォローを外すと見えなくなる

frontend（vitest、`tsc --noEmit`）:

- 投稿画面の文言と、説明の 4 通りの出し分け

ローカルの実機（monolith + frontend、使い捨て DB）:

- 公開アカウントでフォロワーのみの投稿をし、本人・フォロワーのプロフィールと「フォロー中」に出て、フォロワーでない人には出ない
- フォロワーがいいね・コメントでき、フォロワーでない人は投稿詳細を開けない
- 投稿画面の説明が、鍵の状態と選択に応じて変わる
