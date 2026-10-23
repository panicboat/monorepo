# Mention feature design

## Context

[Issue #1343](https://github.com/panicboat/monorepo/issues/1343)「メンション機能の実装」への対応。投稿・コメント・リプライの本文に `@username` を書くとメンションとして認識され、裏では account_id とリンクすることで username が変更されても正しくリンクされ続ける状態を作る。

スコープは [Issue コメント](https://github.com/panicboat/monorepo/issues/1343#issuecomment-5891054414) で明確化済み：オートコンプリートUI・Markdown対応・編集時の再通知・投稿確認時の未解決メンション警告は今回のスコープ外。

### 既存の類似実装との関係

`post.hashtags` は「投稿にタグ文字列の配列を紐付ける」データモデルとしては先例になるが、実際にはクライアント（`PostComposer.tsx`）がhashtagsフィールドを一切送信しておらず、入力・表示どちらの導線も存在しない死んだ機能である。本specの設計はhashtagsの実装パターン（専用テーブル・delete+reinsert）を踏襲するが、「hashtagsが使われているから同じにする」という理由ではなく、要件（後述）から独立に導かれた結果である。

`notifications.preferences` テーブルには既に `mention: Types::Bool` カラムが存在するが、どの通知タイプからも参照されていない（`Notifications::UseCases::Emit::PREFERENCE_FIELD_BY_TYPE` に `"mention"` のマッピングがない）。本specで初めてこのカラムを使う。

## Goals

- 投稿・コメント・リプライの content 中の `@username` を、保存時に実在アカウントへ解決し、account_id とセットで永続化する
- 表示時は保存済みの account_id から都度現在の username を解決してリンクする（username変更後もリンク切れしない）
- メンションされたユーザーに通知を送る（新規作成時のみ）
- 存在しないusername・typoは投稿を失敗させず、静かに無視する（リンクにならないだけ）

## Non-goals

- `@` 入力時のオートコンプリートUI
- 投稿本文のMarkdown対応
- 投稿編集時のメンション再通知
- 投稿確認時の未解決メンション警告

## Architecture

### データモデル

新規テーブル2つ。`post_media`/`comment_media` が投稿用・コメント用で別テーブルに分かれているのと同じ理由（エンティティごとに専用テーブルを持つ既存の慣習）で、投稿用・コメント用（リプライは`comments`テーブルの`parent_id`付きレコードなのでコメントと同じ扱い）に分ける。

```ruby
# dystopia/monolith/config/db/migrate/<timestamp>_create_post_mentions.rb
create_table :post__post_mentions do
  column :id, :uuid, null: false
  column :post_id, :uuid, null: false
  column :account_id, :uuid, null: false
  column :position, :integer, null: false
  column :length, :integer, null: false
  column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

  primary_key [:id]

  index :post_id
  index :account_id
  foreign_key [:post_id], :post__posts, on_delete: :cascade
end
```

```ruby
# dystopia/monolith/config/db/migrate/<timestamp>_create_comment_mentions.rb
create_table :post__comment_mentions do
  column :id, :uuid, null: false
  column :comment_id, :uuid, null: false
  column :account_id, :uuid, null: false
  column :position, :integer, null: false
  column :length, :integer, null: false
  column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

  primary_key [:id]

  index :comment_id
  index :account_id
  foreign_key [:comment_id], :post__comments, on_delete: :cascade
end
```

`position`/`length` はcontent文字列中の `@username` トークンの開始位置と長さを、**Unicodeコードポイント単位**で表す。保存時に確定したこの範囲を、表示のたびに置き換える方式にすることで「usernameが変わっても保存時に指したトークンの範囲は変わらない」という不変条件を保つ。account_idさえ生きていれば、そのアカウントの現在のusernameでリンクし直せる。

新規 `Post::Relations::PostMentions`（`schema(:"post__post_mentions", as: :post_mentions, ...)`）・`Post::Relations::CommentMentions`（`schema(:"post__comment_mentions", as: :comment_mentions, ...)`）を追加し、`Posts`関連に`has_many :post_mentions, foreign_key: :post_id`、`Comments`関連に`has_many :comment_mentions, foreign_key: :comment_id`を追加する。

### 抽出ロジック: `Post::UseCases::ExtractMentions`

新規use case（Post slice内、投稿・コメント両方から共有）。

```ruby
def call(content:)
  # /@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/ を content.to_enum(:scan, regex).map { Regexp.last_match } のように
  # MatchData 付きで走査し、各候補の position（MatchData#begin(0)）/ length（マッチ全体の文字数）を取得する
  # username重複を除きつつ、各候補について profile_repo.find_by_username(username) で解決
  # 見つからない候補は無視。見つかった候補だけ { account_id:, position:, length: } の配列として返す
end
```

- 正規表現は `Profile::UseCases::CheckUsernameAvailability::USERNAME_FORMAT`（`/\A[A-Za-z0-9_]{3,30}\z/`）と同じ文字種を使う
- position/lengthは`String#each_char.with_index`等でコードポイント単位に計算する（Rubyの標準的な文字列インデックスは既にコードポイント単位なので、`Regexp::MatchData#begin(1)`をそのまま使ってよいが、絵文字等のサロゲートペアに関するRuby/JS間の差異を設計注記として残す）
- 同一usernameが複数回登場する場合はそれぞれ別のmentionレコードとして扱う（位置が異なるため）
- usernameの実在確認は `Profile::Slice["repositories.profile_repository"].find_by_username(username)` をユニークな候補ごとに呼ぶ（既存の`ProfileAuthorAdapter#load`も同様にid単位でループする実装のため、この規模のN+1は既存パターンと整合する）

### 保存フロー

**投稿（`Post::Grpc::PostHandler#save_post`）**: content保存後、常に`ExtractMentions`を実行し`post_repo.save_mentions(post_id:, mentions:)`を呼ぶ（`save_hashtags`と同じdelete+reinsert方式）。新規作成か編集かは既存の`m.id.empty?`判定をそのまま使う。

```ruby
mentions = extract_mentions.call(content: content)
# ...create_post/update_post...
post_repo.save_mentions(post_id: post.id, mentions: mentions)
if m.id.empty?
  mentions.each do |mention|
    notifications_emit.call(
      recipient_id: mention[:account_id],
      type: "mention",
      target_resource_id: post.id,
      actor_id: current_user_id,
      target_post_id: post.id
    )
  end
end
```

**コメント・リプライ（`Post::UseCases::Comments::AddComment`）**: コメントに編集機能は存在しない（`AddComment`/`DeleteComment`のみ）ため、編集時の再通知を気にする必要がない。`create_comment`呼び出し前に`ExtractMentions`を実行し、`mentions:`引数として渡して`CommentRepository#create_comment`内部で`save_media`と同じ要領で保存する（`comment_repo.save_media`が既にprivateで内部呼び出しされているパターンに合わせる）。作成後、mentionsごとに`type: "mention"`で通知する。

```ruby
mentions = extract_mentions.call(content: content)
comment = comment_repo.create_comment(..., mentions: mentions)
mentions.each do |mention|
  notifications_emit.call(
    recipient_id: mention[:account_id],
    type: "mention",
    target_resource_id: comment.id,
    actor_id: user_id,
    target_post_id: post.id
  )
end
```

### 通知

`Notifications::UseCases::Emit::PREFERENCE_FIELD_BY_TYPE`に`"mention" => :mention`を追加する。ブロック関係・自己メンション（`recipient_id == actor_id`）は`Emit`側の既存ロジックがそのまま弾く。

### Proto変更

`proto/dystopia/post/v1/post_service.proto`:

```proto
message PostMention {
  string account_id = 1;
  string username = 2;
  int32 position = 3;
  int32 length = 4;
}

message Post {
  // ...既存フィールド...
  repeated PostMention mentions = 12;
}
```

`SavePostRequest`は変更しない。mentionsはクライアントから送るものではなくcontentから抽出するため、リクエスト側に追加フィールドは不要（`hashtags`フィールドとは異なり、クライアント入力を経由しない）。

`proto/dystopia/post/v1/comment_service.proto`:

```proto
message Comment {
  // ...既存フィールド...
  repeated PostMention mentions = 10; // post_service.proto の PostMention を import して再利用
}
```

### レスポンス組み立て（username解決）

`PostPresenter.to_post_proto`/`CommentPresenter.to_proto`・`many_to_proto`に`mentioned_usernames: {}`（`account_id (String) => username (String)`のHash）引数を追加し、`post.post_mentions`/`comment.comment_mentions`の各行をそのHashで解決して`PostMention`プロトを組み立てる。解決できない場合（アカウント削除等）は`username: ""`とし、フロントは空文字なら非リンクのプレーンテキストとして扱う。

呼び出し側での`mentioned_usernames`構築:
- `PostHandler#present_posts`/`#present_post`: 既存の`authors = profile_author_adapter.load(rows.map(&:author_id))`と同様に、`rows.flat_map { |p| p.post_mentions }.map(&:account_id).uniq`を`profile_author_adapter.load`にかけ、`.transform_keys(&:to_s).transform_values(&:username)`でHashを作る
- `Comments::ListComments`/`ListReplies`/`ListCommentsByAuthor`: 既存の`build_authors`と同様の手順で、コメント側の`comment_mentions`からaccount_id一覧を集めてHashを構築し、`result[:mentioned_usernames]`として返す。`CommentHandler`側で`many_to_proto`に渡す
- `CommentHandler#add_comment`（単発レスポンス）: `get_comment_author`と同様に、作成したコメントの`comment_mentions`のaccount_idを`profile_author_adapter.load`で解決する

### フロントエンド

型追加（`dystopia/frontend/src/modules/post/lib/post-view.ts`・`comment-view.ts`）:

```ts
export interface MentionView {
  accountId: string;
  username: string;
  position: number;
  length: number;
}
```

`PostView`/`CommentView`に`mentions: MentionView[]`を追加し、`post-mappers.ts`/`comment-mappers.ts`でproto→view変換する。

新規共有ヘルパー（`dystopia/frontend/src/modules/post/lib/mention-text.tsx`）:

```ts
export function splitContentByMentions(content: string, mentions: MentionView[]) {
  const chars = Array.from(content); // コードポイント単位。サロゲートペア対策でstring indexingではなくArray.fromを使う
  // mentions を position 昇順にソートし、[テキスト片, メンション片, テキスト片, ...] の配列に分割する
  // username が空文字のmentionはプレーンテキストとして扱う（未解決 or アカウント削除）
}

export function MentionText({ content, mentions }: { content: string; mentions: MentionView[] }) {
  // splitContentByMentions の結果を <Fragment> + <Link href={`/u/${username}`}> でレンダリング
}
```

投稿・コメント・リプライのcontentを直接テキスト表示している箇所（`PostCardBinding.tsx`、`CommentList.tsx`、`ReplyList.tsx`、`ReplyWithParentRow.tsx`）を`<MentionText>`に置き換える。`PostComposer.tsx`/`CommentComposer.tsx`/`ReplyComposer.tsx`の入力欄（`<Textarea>`）は変更しない（オートコンプリート・ハイライトはスコープ外）。

## Testing

- monolith（rspec）
  - `Post::UseCases::ExtractMentions`: 複数メンション・重複username・存在しないusername・メンションなし・username境界（`@abc_de`の後に文字が続く場合にマッチしないこと等）の各ケース
  - `Post::Grpc::PostHandler#save_post`もしくは統合的なrepository spec: 新規作成時のみ通知が飛ぶこと、編集時は`save_mentions`は再実行されるが通知は飛ばないこと
  - `Post::UseCases::Comments::AddComment`: mention検出時に通知が飛ぶこと、自己メンションで通知が飛ばないこと（Emit側の既存ガードに委譲されるため、呼び出しが行われることだけ確認すればよい）
  - `Notifications::UseCases::Emit`: `type: "mention"`が`PREFERENCE_FIELD_BY_TYPE`経由で`preferences.mention`を参照すること
- frontend（vitest）
  - `splitContentByMentions`: 通常のメンション分割、絵文字を含むcontentでの位置計算、username未解決（空文字）時にプレーンテキスト化されること
  - `MentionText`: レンダリング結果に`/u/{username}`へのリンクが含まれること
